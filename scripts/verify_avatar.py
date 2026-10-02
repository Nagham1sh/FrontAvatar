"""Phase 2 verification: check avatar.glb + JSON against Anny itself.

Run:  .venv\\Scripts\\python.exe scripts\\verify_avatar.py

1. Structure of the compressed avatar.glb (skin, bones, morph target count/names).
2. Exactness: rebuild random bodies from the raw (uncompressed) GLB using the
   browser formula  base + sum_i w_i * target_i  and compare to Anny's forward pass.
3. lookup.json sanity: the 157 cm / 45 kg example.
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pygltflib as gl
import torch

import anny

from generate_avatar import (CORNER_AXES, FIXED_PHENOTYPE, LOCAL_GROUPS, RAW_GLB, GLB_OUT, DATA_OUT,
                             corner_list, corner_weights, to_y_up)

warnings.filterwarnings("ignore", category=DeprecationWarning)
ok = True


def check(cond, msg):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + msg)


# ---- 1. compressed GLB structure
g = gl.GLTF2().load(str(GLB_OUT))
mesh = g.meshes[0]
prim = mesh.primitives[0]
names = (mesh.extras or {}).get("targetNames", [])
morph = json.loads((DATA_OUT / "morphTargets.json").read_text())
print(f"avatar.glb: {GLB_OUT.stat().st_size / 1e6:.2f} MB, extensions {g.extensionsUsed}")
check(len(g.skins) == 1 and len(g.skins[0].joints) == 104, f"skin with {len(g.skins[0].joints)} joints")
check(len(prim.targets) == len(morph["targets"]) == 86, f"{len(prim.targets)} morph targets")
check(names == [t["name"] for t in morph["targets"]], "targetNames preserved and match morphTargets.json")
bone_names = [g.nodes[j].name for j in g.skins[0].joints]
check(bone_names == morph["bones"]["names"], "bone names/order preserved")
check(all(k in prim.attributes.__dict__ and prim.attributes.__dict__[k] is not None
          for k in ("POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0")), "mesh has POSITION/NORMAL/UV/JOINTS/WEIGHTS")

# ---- 2. exactness against Anny, using the raw GLB
raw = gl.GLTF2().load(str(RAW_GLB))
blob = raw.binary_blob()


def read(idx):
    acc = raw.accessors[idx]
    view = raw.bufferViews[acc.bufferView]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc.type]
    return np.frombuffer(blob, np.float32, acc.count * n, view.byteOffset).reshape(acc.count, n)


rp = raw.meshes[0].primitives[0]
base = read(rp.attributes.POSITION).astype(np.float64)
deltas = np.stack([read(t["POSITION"]) for t in rp.targets]).astype(np.float64)
corners = corner_list()

# glTF vertex -> anny vertex map: recover via the UV split used by the generator
from generate_avatar import split_uv_seams  # noqa: E402

model = anny.Anny(local_changes=[l for grp in LOCAL_GROUPS.values() for l in grp])
vmap, _, _ = split_uv_seams(model.faces.cpu().numpy(), model.face_texture_coordinate_indices.cpu().numpy())

rng = np.random.default_rng(0)
worst = 0.0
for _ in range(6):
    pheno = {"gender": rng.uniform(0, 1), "age": rng.uniform(0.77, 0.92), "muscle": rng.uniform(0, 1),
             "weight": rng.uniform(0, 1), "height": rng.uniform(0, 1)}
    local = {grp: rng.uniform(-1, 1) for grp in LOCAL_GROUPS}
    w = np.zeros(len(deltas))
    w[: len(corners)] = corner_weights(pheno, corners)
    for i, grp in enumerate(LOCAL_GROUPS):
        w[len(corners) + 2 * i] = max(local[grp], 0)
        w[len(corners) + 2 * i + 1] = max(-local[grp], 0)
    browser = base + np.einsum("t,tvk->vk", w, deltas)
    lk = {lbl: torch.tensor([local[grp]]) for grp, lbls in LOCAL_GROUPS.items() for lbl in lbls}
    with torch.no_grad():
        truth = model(phenotype_kwargs={**{k: torch.tensor([v]) for k, v in pheno.items()},
                                        **{k: torch.tensor([v]) for k, v in FIXED_PHENOTYPE.items()}},
                      local_changes_kwargs=lk)["rest_vertices"][0].double().numpy()
    err = np.abs(browser - to_y_up(truth)[vmap]).max() * 1000
    worst = max(worst, err)
check(worst < 0.5, f"browser morph formula vs Anny forward, 6 random bodies: max error {worst:.4f} mm")
check(abs(sum(corner_weights({"gender": .3, "age": .8, "muscle": .7, "weight": .2, "height": .6}, corners)) - 1) < 1e-9,
      "corner weights sum to 1")

# ---- 3. lookup.json sanity
lookup = json.loads((DATA_OUT / "lookup.json").read_text())
print("ranges:", lookup["ranges"])
print("female simple height table:", lookup["simple"]["female"]["height"])
print("female weight table @height 0.5:", lookup["simple"]["female"]["weightAtHeight0.5"])
print("\nALL CHECKS PASSED" if ok else "\nSOME CHECKS FAILED")
