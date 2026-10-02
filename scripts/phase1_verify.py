"""Phase 1 verification: adult ranges, multilinearity, UV seams, skin influences.

Run:  .venv\\Scripts\\python.exe scripts\\phase1_verify.py
"""

import itertools
import json
import warnings
from pathlib import Path

import numpy as np
import torch

import anny
from anny.anthropometry import Anthropometry
from anny.shape_distribution import MorphologicalAgeMapping  # noqa: F401  (existence check)

warnings.filterwarnings("ignore", category=DeprecationWarning)
OUT = Path(__file__).resolve().parent.parent / "build" / "phase1"
OUT.mkdir(parents=True, exist_ok=True)

model = anny.Anny()
anthro = Anthropometry(model)
ADULT_AGE = 2 / 3  # anchor "young" = linspace(-1/3, 1, 5)[3]


def rest(**kw):
    with torch.no_grad():
        return model(phenotype_kwargs=kw)["rest_vertices"][0]


def measure(**kw):
    v = rest(**kw)[None]
    return {k: round(float(x[0]), 3) for k, x in anthro(v).items()}


print("=== Adult ranges (age=young anchor) ===")
ranges = {}
for g, gname in [(0.0, "male"), (1.0, "female")]:
    for h, w, m in itertools.product([0.0, 0.5, 1.0], [0.0, 0.5, 1.0], [0.5]):
        r = measure(gender=g, age=ADULT_AGE, height=h, weight=w, muscle=m)
        ranges[f"{gname} h={h} w={w}"] = r
        print(f"{gname:6s} height={h:.1f} weight={w:.1f} -> {r['height']:.3f} m, ~{r['mass']:.1f} kg, BMI {r['bmi']:.1f}")

print("\n=== Multilinearity test (is the mesh exactly linear between anchors?) ===")
base = dict(gender=0.3, age=ADULT_AGE, muscle=0.5, height=0.5)
v_a = rest(**base, weight=0.0)
v_b = rest(**base, weight=0.5)
v_mid = rest(**base, weight=0.25)
err_inside = float((v_mid - 0.5 * (v_a + v_b)).abs().max())
v_c = rest(**base, weight=1.0)
err_across = float((rest(**base, weight=0.5) - 0.5 * (v_a + v_c)).abs().max())
print(f"weight 0.25 vs mean(0, 0.5): max error {err_inside * 1000:.4f} mm  (expect ~0: same segment)")
print(f"weight 0.5 vs mean(0, 1.0):  max error {err_across * 1000:.2f} mm  (expect >0: crosses middle anchor)")

# Corner reconstruction: gender 0.3 between male/female, height 0.7 between min/max
g, h = 0.3, 0.7
corners = {(gi, hi): rest(gender=gi, age=ADULT_AGE, muscle=0.5, weight=0.5, height=hi)
           for gi in (0.0, 1.0) for hi in (0.0, 1.0)}
recon = sum(((1 - g) if gi == 0 else g) * ((1 - h) if hi == 0 else h) * v
            for (gi, hi), v in corners.items())
truth = rest(gender=g, age=ADULT_AGE, muscle=0.5, weight=0.5, height=h)
err_bilinear = float((recon - truth).abs().max())
print(f"bilinear corner reconstruction (gender x height): max error {err_bilinear * 1000:.4f} mm")

print("\n=== Bones follow shape? ===")
with torch.no_grad():
    b0 = model(phenotype_kwargs=dict(age=ADULT_AGE, height=0.0))["rest_bone_heads"][0]
    b1 = model(phenotype_kwargs=dict(age=ADULT_AGE, height=1.0))["rest_bone_heads"][0]
print(f"max bone-head displacement short->tall: {float((b1 - b0).norm(dim=-1).max()):.3f} m")

print("\n=== UV seams (glTF needs one UV per vertex) ===")
faces = model.faces.cpu().numpy()
ftc = model.face_texture_coordinate_indices.cpu().numpy()
pairs = np.unique(np.stack([faces.ravel(), ftc.ravel()], 1), axis=0)
print(f"vertices {model.template_vertices.shape[0]}, unique (vertex, uv) pairs {len(pairs)} -> glTF vertex count after split")

print("\n=== Skin influences (three.js uses 4 per vertex) ===")
w = model.vertex_bone_weights.cpu().numpy()
nz = (w > 1e-4).sum(1)
top4 = np.sort(w, 1)[:, ::-1][:, :4].sum(1) / np.maximum(w.sum(1), 1e-9)
print(f"influences per vertex: max {nz.max()}, vertices with >4: {(nz > 4).sum()}")
print(f"weight kept by top-4: min {top4.min():.3f}, mean {top4.mean():.4f}")

(OUT / "verify.json").write_text(json.dumps(dict(
    adult_ranges=ranges, err_inside_mm=err_inside * 1000, err_across_mm=err_across * 1000,
    err_bilinear_mm=err_bilinear * 1000, gltf_vertices=int(len(pairs)),
    max_influences=int(nz.max()), top4_min=float(top4.min())), indent=2))
print("\nreport ->", OUT / "verify.json")
