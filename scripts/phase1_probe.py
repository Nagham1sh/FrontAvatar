"""Phase 1 probe: inspect the installed Anny package and what it can export.

Run:  .venv\\Scripts\\python.exe scripts\\phase1_probe.py
Writes reports to build/phase1/ (nothing outside the project folder).
"""

import json
import time
import warnings
from importlib.metadata import version
from pathlib import Path

import numpy as np
import torch
import trimesh

import anny
from anny.anthropometry import Anthropometry
from anny.models.model_data import PHENOTYPE_VARIATIONS

OUT = Path(__file__).resolve().parent.parent / "build" / "phase1"
OUT.mkdir(parents=True, exist_ok=True)
warnings.filterwarnings("ignore", category=DeprecationWarning)


def section(title):
    print(f"\n=== {title} ===")


def shape(t):
    return None if t is None else tuple(t.shape)


section("Versions")
print("anny", version("anny"), "| torch", torch.__version__, "| trimesh", trimesh.__version__)

section("Model construction (Anny(), current API)")
t0 = time.time()
model = anny.Anny(local_changes="all")
print(f"Anny(local_changes='all') built in {time.time() - t0:.1f}s")
print("config:", model.config)

section("Phenotype parameters")
print("phenotype_labels:", model.phenotype_labels)
print("all PHENOTYPE_VARIATIONS (anchors):", json.dumps(PHENOTYPE_VARIATIONS))
print("extrapolate_phenotypes:", model.extrapolate_phenotypes)

section("Local changes (candidate waist/chest/hips/... controls)")
print("count:", len(model.local_change_labels))
print(model.local_change_labels)

section("Mesh / skeleton / UV / blendshape tensors")
info = {
    "template_vertices": shape(model.template_vertices),
    "faces": shape(model.faces),
    "blendshapes": shape(model.blendshapes),
    "texture_coordinates": shape(model.texture_coordinates),
    "face_texture_coordinate_indices": shape(model.face_texture_coordinate_indices),
    "vertex_bone_weights": shape(model.vertex_bone_weights),
    "vertex_bone_indices": shape(model.vertex_bone_indices),
    "template_bone_heads": shape(model.template_bone_heads),
    "bone_count": len(model.bone_labels),
}
for k, v in info.items():
    print(f"{k:34s} {v}")
print("first bones:", model.bone_labels[:25])

section("Forward pass at default phenotype (all 0.5)")
with torch.no_grad():
    t0 = time.time()
    out = model()
    print(f"forward in {(time.time() - t0) * 1000:.0f} ms")
    print("output keys:", {k: shape(v) for k, v in out.items() if torch.is_tensor(v)})

section("Anthropometry sanity check (units)")
anthro = Anthropometry(model)
cases = {
    "male_avg": dict(gender=0.0),
    "female_avg": dict(gender=1.0),
    "male_tall_heavy": dict(gender=0.0, height=1.0, weight=1.0),
    "female_short_light": dict(gender=1.0, height=0.0, weight=0.0),
}
anthro_rows = {}
with torch.no_grad():
    for name, kw in cases.items():
        o = model(phenotype_kwargs=kw)
        m = anthro(o["rest_vertices"])
        anthro_rows[name] = {k: round(float(v[0]), 3) for k, v in m.items()}
        print(name, anthro_rows[name])

section("Plain mesh export test (trimesh -> GLB, no skeleton/morphs)")
with torch.no_grad():
    verts = model(phenotype_kwargs=dict(gender=1.0))["rest_vertices"][0].cpu().numpy()
faces = model.faces.cpu().numpy()
mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
glb_path = OUT / "probe_female_static.glb"
mesh.export(glb_path)
print("wrote", glb_path, f"{glb_path.stat().st_size / 1e6:.2f} MB")

section("Blendshape budget estimate for browser morph targets")
V = model.template_vertices.shape[0]
n_bs = model.blendshapes.shape[0]
mb_per_target = V * 3 * 4 / 1e6
print(f"vertices={V}, raw blendshapes={n_bs}, {mb_per_target:.2f} MB per float32 target")
print(f"all raw blendshapes as morph targets ~ {n_bs * mb_per_target:.0f} MB (uncompressed)")
nonzero = (model.blendshapes.abs().sum(-1) > 1e-6).sum(-1).cpu().numpy()
print("non-zero vertices per blendshape: min/median/max =",
      int(nonzero.min()), int(np.median(nonzero)), int(nonzero.max()))

report = dict(anny=version("anny"), phenotype_labels=model.phenotype_labels,
              local_change_labels=model.local_change_labels, tensors=info,
              bones=model.bone_labels, anthropometry=anthro_rows)
(OUT / "report.json").write_text(json.dumps(report, indent=2))
print("\nreport ->", OUT / "report.json")
