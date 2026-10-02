"""Phase 2: bake the Anny parametric body into a browser-ready avatar.

Offline build tool. Run once during development:
    .venv\\Scripts\\python.exe scripts\\generate_avatar.py

Outputs
    public/assets/avatar/avatar.glb      mesh + skeleton + UVs + morph targets (meshopt-compressed)
    src/data/avatar/morphTargets.json    morph target layout, corner phenotypes, bone/floor deltas
    src/data/avatar/lookup.json          user units (years, cm, kg) -> Anny phenotype values

How the morph targets reproduce Anny exactly
    Anny's rest mesh is multilinear in its phenotype parameters: every blendshape
    weight is a product of per-parameter linear-interpolation coefficients between
    anchors. Baking the mesh at every anchor combination ("corner") therefore lets
    the browser rebuild any in-range body as  sum_c w_c * mesh_c,  where w_c is the
    product of the per-parameter coefficients (they sum to 1). We store
    mesh_c - base as morph targets, so the browser sets morphTargetInfluences = w_c.
    Local changes (waist, chest, ...) are plain linear blendshapes and become
    additive +/- targets.
"""

import argparse
import itertools
import json
import os
import shutil
import subprocess
import time
import warnings
from pathlib import Path

import numpy as np
import pygltflib as gl
import torch
import trimesh

import anny
from anny.paths import get_anny_root_dir

warnings.filterwarnings("ignore", category=DeprecationWarning)

ROOT = Path(__file__).resolve().parent.parent
GLB_OUT = ROOT / "public" / "assets" / "avatar" / "avatar.glb"
DATA_OUT = ROOT / "src" / "data" / "avatar"
RAW_GLB = ROOT / "build" / "avatar.raw.glb"

# Phenotype anchors baked as corners. Values are Anny anchor positions, so the
# browser-side interpolation matches Anny's own piecewise-linear scheme.
#   age: anchors are linspace(-1/3, 1, 5) -> "young" = 2/3, "old" = 1. Adults
#        (16..110 years) live entirely in this segment.
CORNER_AXES = {
    "gender": [0.0, 1.0],
    "age": [2 / 3, 1.0],
    "muscle": [0.0, 0.5, 1.0],
    "weight": [0.0, 0.5, 1.0],
    "height": [0.0, 1.0],
}
FIXED_PHENOTYPE = {"proportions": 0.5}
NEUTRAL = {"gender": 0.5, "age": 0.8, "muscle": 0.5, "weight": 0.5, "height": 0.5}

# Local changes exposed as body measurements. Each group is driven by one
# browser parameter in [-1, 1]; all labels in a group move together.
LOCAL_GROUPS = {
    "chest": ["measure-bust-circ-incr"],
    "waist": ["measure-waist-circ-incr"],
    "hips": ["measure-hips-circ-incr"],
    "shoulders": ["measure-shoulder-dist-incr"],
    "armLength": ["measure-upperarm-length-incr", "measure-lowerarm-length-incr"],
    "legLength": ["measure-upperleg-height-incr", "measure-lowerleg-height-incr"],
    "headSize": ["head-scale-vert-incr", "head-scale-horiz-incr", "head-scale-depth-incr"],
}

# Grid used to measure height/mass so the browser can invert cm/kg -> parameters.
MEASURE_GRID = {
    "gender": [0.0, 1.0],
    "age": [0.77, 0.83, 0.92],  # ~18, ~64, ~90 years (Anny calibration)
    "muscle": [0.0, 0.25, 0.5, 0.75, 1.0],
    "height": [0.0, 0.25, 0.5, 0.75, 1.0],
    "weight": [0.0, 0.25, 0.5, 0.75, 1.0],
}
BODY_DENSITY = 980.0  # kg/m^3, same constant as anny.anthropometry
SKIN_COLOR = [0.80, 0.62, 0.52, 1.0]

# Anny is Z-up / face -Y (Blender). glTF is Y-up / face +Z.
Z_UP_TO_Y_UP = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.float64)


def to_y_up(points):
    return points @ Z_UP_TO_Y_UP.T


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# --------------------------------------------------------------------------- model


def build_model():
    labels = [label for group in LOCAL_GROUPS.values() for label in group]
    model = anny.Anny(local_changes=labels)
    missing = set(labels) - set(model.local_change_labels)
    if missing:
        raise RuntimeError(f"Local changes not available in this Anny version: {missing}")
    return model


def run_batch(model, phenotypes, local_changes=None):
    """phenotypes: list of dicts -> (rest_vertices [B,V,3], rest_bone_poses [B,J,4,4]) in Z-up."""
    keys = list(phenotypes[0].keys())
    kwargs = {k: torch.tensor([p[k] for p in phenotypes], dtype=model.dtype) for k in keys}
    local_kwargs = None
    if local_changes is not None:
        local_kwargs = {
            label: torch.tensor([lc.get(label, 0.0) for lc in local_changes], dtype=model.dtype)
            for label in model.local_change_labels
        }
    with torch.no_grad():
        out = model(phenotype_kwargs=kwargs, local_changes_kwargs=local_kwargs)
    return (
        out["rest_vertices"].double().cpu().numpy(),
        out["rest_bone_poses"].double().cpu().numpy(),
    )


def corner_list():
    names = list(CORNER_AXES)
    corners = []
    for values in itertools.product(*CORNER_AXES.values()):
        pheno = dict(zip(names, values))
        idx = [CORNER_AXES[n].index(v) for n, v in zip(names, values)]
        name = "c_" + "_".join(f"{n[0]}{i}" for n, i in zip(names, idx))
        corners.append((name, pheno))
    return corners


# ----------------------------------------------------------------------- geometry


def vertex_normals(vertices, faces):
    return np.asarray(
        trimesh.Trimesh(vertices=vertices, faces=faces, process=False).vertex_normals,
        dtype=np.float64,
    )


def split_uv_seams(faces, face_uv_idx):
    """glTF needs one UV per vertex: duplicate vertices along UV seams."""
    pairs = np.stack([faces.ravel(), face_uv_idx.ravel()], axis=1)
    unique_pairs, inverse = np.unique(pairs, axis=0, return_inverse=True)
    vertex_map = unique_pairs[:, 0]  # gltf vertex -> anny vertex
    uv_map = unique_pairs[:, 1]  # gltf vertex -> anny uv
    new_faces = inverse.reshape(-1, 3).astype(np.uint32)
    return vertex_map, uv_map, new_faces


def top4_skin(weights, indices):
    order = np.argsort(-weights, axis=1)[:, :4]
    w = np.take_along_axis(weights, order, axis=1)
    j = np.take_along_axis(indices, order, axis=1)
    w = w / np.maximum(w.sum(axis=1, keepdims=True), 1e-12)
    j = np.where(w > 0, j, 0)
    return w.astype(np.float32), j.astype(np.uint8)


def mesh_volume(vertices, faces):
    v0, v1, v2 = vertices[..., faces[:, 0], :], vertices[..., faces[:, 1], :], vertices[..., faces[:, 2], :]
    return np.abs((np.cross(v0, v1) * v2).sum(-1).sum(-1) / 6.0)


# --------------------------------------------------------------------------- glTF


class GltfBuilder:
    def __init__(self):
        self.gltf = gl.GLTF2(asset=gl.Asset(generator="baraha-avatar generate_avatar.py", version="2.0"))
        self.blob = bytearray()

    def accessor(self, array, component, kind, target=None, minmax=False, normalized=False):
        array = np.ascontiguousarray(array)
        while len(self.blob) % 4:
            self.blob.append(0)
        offset = len(self.blob)
        self.blob.extend(array.tobytes())
        view = gl.BufferView(buffer=0, byteOffset=offset, byteLength=array.nbytes, target=target)
        self.gltf.bufferViews.append(view)
        acc = gl.Accessor(
            bufferView=len(self.gltf.bufferViews) - 1,
            componentType=component,
            count=array.shape[0],
            type=kind,
            normalized=normalized or None,
        )
        if minmax:
            acc.min = array.min(axis=0).tolist()
            acc.max = array.max(axis=0).tolist()
        self.gltf.accessors.append(acc)
        return len(self.gltf.accessors) - 1

    def finish(self, path):
        self.gltf.buffers.append(gl.Buffer(byteLength=len(self.blob)))
        self.gltf.set_binary_blob(bytes(self.blob))
        path.parent.mkdir(parents=True, exist_ok=True)
        self.gltf.save_binary(str(path))


def decompose(matrix):
    t = matrix[:3, 3]
    r = matrix[:3, :3]
    # Re-orthonormalise to strip numerical noise before converting to a quaternion.
    u, _, vt = np.linalg.svd(r)
    r = u @ vt
    q = trimesh.transformations.quaternion_from_matrix(np.block([[r, np.zeros((3, 1))], [np.zeros((1, 3)), 1]]))
    return t.tolist(), [q[1], q[2], q[3], q[0]]  # wxyz -> glTF xyzw


def write_glb(path, *, positions, normals, uvs, faces, joints, weights, targets, target_names,
              bone_labels, bone_parents, bone_world):
    b = GltfBuilder()
    g = b.gltf
    A, E = gl.ARRAY_BUFFER, gl.ELEMENT_ARRAY_BUFFER
    f32 = lambda a: np.asarray(a, dtype=np.float32)

    attributes = gl.Attributes(
        POSITION=b.accessor(f32(positions), gl.FLOAT, gl.VEC3, A, minmax=True),
        NORMAL=b.accessor(f32(normals), gl.FLOAT, gl.VEC3, A),
        TEXCOORD_0=b.accessor(f32(uvs), gl.FLOAT, gl.VEC2, A),
        JOINTS_0=b.accessor(joints, gl.UNSIGNED_BYTE, gl.VEC4, A),
        WEIGHTS_0=b.accessor(weights, gl.FLOAT, gl.VEC4, A),
    )
    morph = []
    for d_pos, d_nrm in targets:
        entry = {"POSITION": b.accessor(f32(d_pos), gl.FLOAT, gl.VEC3, A, minmax=True)}
        if d_nrm is not None:
            entry["NORMAL"] = b.accessor(f32(d_nrm), gl.FLOAT, gl.VEC3, A)
        morph.append(entry)
    indices = b.accessor(faces.reshape(-1), gl.UNSIGNED_INT, gl.SCALAR, E)

    g.materials.append(gl.Material(
        name="Skin",
        pbrMetallicRoughness=gl.PbrMetallicRoughness(baseColorFactor=SKIN_COLOR, metallicFactor=0.0, roughnessFactor=0.65),
    ))
    g.meshes.append(gl.Mesh(
        name="Body",
        primitives=[gl.Primitive(attributes=attributes, indices=indices, material=0, targets=morph)],
        weights=[0.0] * len(morph),
        extras={"targetNames": target_names},
    ))

    # Bones: node i+2 is bone i (node 0 = Avatar root, node 1 = Body mesh).
    first_bone = 2
    bone_nodes = []
    for i, label in enumerate(bone_labels):
        parent = bone_parents[i]
        local = bone_world[i] if parent < 0 else np.linalg.inv(bone_world[parent]) @ bone_world[i]
        t, r = decompose(local)
        bone_nodes.append(gl.Node(name=label, translation=t, rotation=r, children=[]))
    for i, parent in enumerate(bone_parents):
        if parent >= 0:
            bone_nodes[parent].children.append(first_bone + i)
    roots = [first_bone + i for i, p in enumerate(bone_parents) if p < 0]

    inverse_bind = np.stack([np.linalg.inv(m).T for m in bone_world]).astype(np.float32)  # column-major
    ibm = b.accessor(inverse_bind.reshape(len(bone_labels), 16), gl.FLOAT, gl.MAT4)
    g.skins.append(gl.Skin(name="AnnySkeleton", joints=[first_bone + i for i in range(len(bone_labels))],
                           inverseBindMatrices=ibm, skeleton=roots[0]))

    g.nodes.append(gl.Node(name="Avatar", children=[1] + roots))
    g.nodes.append(gl.Node(name="Body", mesh=0, skin=0))
    g.nodes.extend(bone_nodes)
    g.scenes.append(gl.Scene(name="Scene", nodes=[0]))
    g.scene = 0
    b.finish(path)


def compress_glb(src, dst):
    """Meshopt compression + quantization with gltfpack (npm cache kept inside the project).

    Default quantization (14-bit positions, ~0.15 mm on a 2.5 m body) cuts the GLB
    from ~20 MB to ~4.7 MB. three.js / drei decode it with MeshoptDecoder.
    -kv keeps UVs: without a texture in the material gltfpack would strip them.
    """
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if npx is None:
        log("npx not found: copying uncompressed GLB")
        shutil.copyfile(src, dst)
        return
    env = dict(os.environ, npm_config_cache=str(ROOT / ".tools" / "npm-cache"))
    cmd = [npx, "--yes", "gltfpack@0.25.0", "-i", str(src), "-o", str(dst), "-cc", "-kn", "-km", "-ke", "-kv"]
    log("running " + " ".join(cmd[1:]))
    subprocess.run(cmd, check=True, env=env)


# ------------------------------------------------------------------------- lookup


def age_mapping():
    sd = torch.load(get_anny_root_dir() / "data" / "shape_calibration" / "boys.pth", weights_only=True)
    m = sd["morphological_age_mapping"]
    return {
        "years": [round(x, 3) for x in m["morphological_age_anchors"].tolist()],
        "anny": [round(x, 4) for x in m["anny_age_anchors"].tolist()],
    }


def interp_coeffs(value, anchors):
    """Same piecewise-linear scheme as anny.utils.interpolation (no extrapolation)."""
    value = min(max(value, anchors[0]), anchors[-1])
    coeffs = [0.0] * len(anchors)
    for i in range(len(anchors) - 1):
        lo, hi = anchors[i], anchors[i + 1]
        if lo <= value <= hi:
            t = (value - lo) / (hi - lo)
            coeffs[i], coeffs[i + 1] = 1 - t, t
            break
    return coeffs


def corner_weights(pheno, corners):
    per_axis = {k: interp_coeffs(pheno[k], CORNER_AXES[k]) for k in CORNER_AXES}
    return np.array([
        np.prod([per_axis[k][CORNER_AXES[k].index(c[k])] for k in CORNER_AXES]) for _, c in corners
    ])


def build_lookup(corners, corner_verts, faces):
    names = list(MEASURE_GRID)
    samples = list(itertools.product(*MEASURE_GRID.values()))
    weights = np.stack([corner_weights(dict(zip(names, s)), corners) for s in samples])  # [S, C]
    heights, masses = [], []
    for chunk in np.array_split(np.arange(len(samples)), 10):
        verts = np.einsum("sc,cvk->svk", weights[chunk], corner_verts)
        heights.append(verts[..., 2].max(-1) - verts[..., 2].min(-1))
        masses.append(mesh_volume(verts, faces) * BODY_DENSITY)
    heights = np.concatenate(heights) * 100.0
    masses = np.concatenate(masses)

    shape = [len(v) for v in MEASURE_GRID.values()]
    lookup = {
        "version": 1,
        "description": "Measured Anny body (cm, kg) on a phenotype grid; invert in the browser.",
        "ageMapping": age_mapping(),
        "grid": {"axes": names, "values": MEASURE_GRID, "shape": shape},
        "heightCm": np.round(heights, 2).reshape(shape).tolist(),
        "massKg": np.round(masses, 2).reshape(shape).tolist(),
        "ranges": {},
        "simple": {},
    }

    # Human-readable view at an average adult (age ~35, muscle 0.5).
    def sample(pheno):
        w = corner_weights(pheno, corners)
        v = np.einsum("c,cvk->vk", w, corner_verts)
        return (v[:, 2].max() - v[:, 2].min()) * 100.0, mesh_volume(v, faces) * BODY_DENSITY

    for gname, g in (("male", 0.0), ("female", 1.0)):
        base = {"gender": g, "age": 0.8, "muscle": 0.5}
        h_table, w_table = {}, {}
        for hp in np.linspace(0, 1, 21):
            cm, _ = sample({**base, "height": hp, "weight": 0.5})
            h_table[f"{cm:.0f}"] = round(float(hp), 3)
        for wp in np.linspace(0, 1, 11):
            _, kg = sample({**base, "height": 0.5, "weight": wp})
            w_table[f"{kg:.0f}"] = round(float(wp), 3)
        lo, _ = sample({**base, "height": 0.0, "weight": 0.5})
        hi, _ = sample({**base, "height": 1.0, "weight": 0.5})
        lookup["simple"][gname] = {"height": h_table, "weightAtHeight0.5": w_table}
        lookup["ranges"][gname] = {"heightCm": [round(lo, 1), round(hi, 1)]}
    return lookup


# --------------------------------------------------------------------------- main


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--no-morph-normals", action="store_true", help="smaller GLB, slightly wrong shading on extreme bodies")
    parser.add_argument("--no-compress", action="store_true", help="skip gltfpack")
    args = parser.parse_args()

    t_start = time.time()
    log("building Anny model (first run parses MakeHuman assets, ~1 min)")
    model = build_model()
    faces_anny = model.faces.cpu().numpy()
    bone_labels = list(model.bone_labels)
    bone_parents = [int(p) for p in model.bone_parents]

    corners = corner_list()
    log(f"baking {len(corners)} phenotype corners")
    corner_pheno = [{**c, **FIXED_PHENOTYPE} for _, c in corners]
    corner_verts, corner_bones = run_batch(model, corner_pheno)

    log("baking neutral base + local-change targets")
    neutral = {**NEUTRAL, **FIXED_PHENOTYPE}
    local_rows = [{}]
    for group in LOCAL_GROUPS.values():
        local_rows.append({label: 1.0 for label in group})
        local_rows.append({label: -1.0 for label in group})
    local_verts, local_bones = run_batch(model, [neutral] * len(local_rows), local_rows)
    base_verts, base_bones = local_verts[0], local_bones[0]

    # --- glTF vertex layout (UV seams split), Y-up
    vertex_map, uv_map, faces = split_uv_seams(faces_anny, model.face_texture_coordinate_indices.cpu().numpy())
    uvs = model.texture_coordinates.cpu().numpy()[uv_map].copy()
    uvs[:, 1] = 1.0 - uvs[:, 1]  # glTF UV origin is top-left
    log(f"vertices: anny {len(model.template_vertices)} -> glTF {len(vertex_map)}")

    def gl_positions(v):
        return to_y_up(v)[vertex_map]

    def gl_normals(v):
        return to_y_up(vertex_normals(v, faces_anny))[vertex_map]

    base_pos, base_nrm = gl_positions(base_verts), gl_normals(base_verts)
    base_floor = float(to_y_up(base_verts)[:, 1].min())

    def bone_world(poses):
        out = np.repeat(np.eye(4)[None], len(poses), axis=0)
        out[:, :3, :3] = np.einsum("ij,bjk->bik", Z_UP_TO_Y_UP, poses[:, :3, :3])
        out[:, :3, 3] = to_y_up(poses[:, :3, 3])
        return out

    base_bone_world = bone_world(base_bones)
    base_heads = base_bone_world[:, :3, 3]

    targets, target_names, target_meta = [], [], []

    def add_target(name, verts, bones, meta):
        d_pos = gl_positions(verts) - base_pos
        d_nrm = None if args.no_morph_normals else gl_normals(verts) - base_nrm
        targets.append((d_pos, d_nrm))
        target_names.append(name)
        heads = bone_world(bones)[:, :3, 3]
        target_meta.append({
            **meta,
            "floorDelta": round(float(to_y_up(verts)[:, 1].min()) - base_floor, 5),
            "boneHeadDeltas": np.round(heads - base_heads, 5).reshape(-1).tolist(),
        })

    for (name, pheno), verts, bones in zip(corners, corner_verts, corner_bones):
        add_target(name, verts, bones, {"name": name, "kind": "corner", "phenotype": pheno})
    for i, group in enumerate(LOCAL_GROUPS):
        for sign, row in (("+", 1 + 2 * i), ("-", 2 + 2 * i)):
            add_target(f"{group}{sign}", local_verts[row], local_bones[row],
                       {"name": f"{group}{sign}", "kind": "local", "group": group, "sign": sign})

    # --- skin
    skin_w, skin_j = top4_skin(model.vertex_bone_weights.cpu().numpy()[vertex_map],
                               model.vertex_bone_indices.cpu().numpy()[vertex_map])

    log(f"writing raw GLB with {len(targets)} morph targets")
    write_glb(RAW_GLB, positions=base_pos, normals=base_nrm, uvs=uvs, faces=faces, joints=skin_j,
              weights=skin_w, targets=targets, target_names=target_names, bone_labels=bone_labels,
              bone_parents=bone_parents, bone_world=base_bone_world)
    log(f"raw GLB {RAW_GLB.stat().st_size / 1e6:.1f} MB")

    GLB_OUT.parent.mkdir(parents=True, exist_ok=True)
    if args.no_compress:
        shutil.copyfile(RAW_GLB, GLB_OUT)
    else:
        compress_glb(RAW_GLB, GLB_OUT)
    log(f"avatar.glb {GLB_OUT.stat().st_size / 1e6:.2f} MB -> {GLB_OUT}")

    # --- JSON side data
    DATA_OUT.mkdir(parents=True, exist_ok=True)
    morph_json = {
        "version": 1,
        "anny": anny.__version__ if hasattr(anny, "__version__") else None,
        "coordinateSystem": "glTF Y-up, metres, face +Z",
        "neutral": NEUTRAL,
        "fixedPhenotype": FIXED_PHENOTYPE,
        "cornerAxes": CORNER_AXES,
        "localGroups": {g: {"labels": labels, "plus": f"{g}+", "minus": f"{g}-", "range": [-1, 1]}
                        for g, labels in LOCAL_GROUPS.items()},
        "baseFloorY": round(base_floor, 5),
        "bones": {"names": bone_labels, "parents": bone_parents,
                  "baseHeads": np.round(base_heads, 5).reshape(-1).tolist()},
        "targets": target_meta,
    }
    (DATA_OUT / "morphTargets.json").write_text(json.dumps(morph_json, separators=(",", ":")))

    log("measuring height/mass grid for lookup.json")
    lookup = build_lookup(corners, corner_verts, faces_anny)
    (DATA_OUT / "lookup.json").write_text(json.dumps(lookup, indent=1))

    for f in (DATA_OUT / "morphTargets.json", DATA_OUT / "lookup.json"):
        log(f"{f.relative_to(ROOT)} {f.stat().st_size / 1e3:.0f} KB")
    log(f"done in {time.time() - t_start:.0f}s")


if __name__ == "__main__":
    main()
