import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Object3D, Mesh, SkinnedMesh } from 'three';

type ShirtSize = 'S' | 'M' | 'L' | 'XL';

/** إعدادات التلبيس: بتتغير من لبسة للبسة */
export interface FitConfig {
  top: number; // أعلى نقطة باللبسة كنسبة من طول الأفاتار (الرقبة افتراضياً)
  bottom: number; // أسفل نقطة (الذيل)
  sleeves: boolean; // اللبسة فيها أكمام؟
  ease: Record<ShirtSize, number>; // الهامش بين القماش والجسم (متر)
  loose: Record<ShirtSize, number>; // أقصى ارتخاء مسموح فوق الورك (متر)
}

interface ShirtProps {
  size: ShirtSize;
  avatar: Object3D;
  height?: number; // محفوظة للتوافق: المراقب بيلقط التغيير تلقائياً
  weight?: number;
  url?: string; // مسار ملف GLB (افتراضي: /models/shirt_{size}.glb)
  fit?: Partial<FitConfig>;
}

/* ---------- الثوابت ---------- */
const EASE: Record<ShirtSize, number> = { S: 0.008, M: 0.014, L: 0.022, XL: 0.032 };
const LOOSE: Record<ShirtSize, number> = { S: 0.03, M: 0.045, L: 0.065, XL: 0.09 };

const NECK_RATIO = 0.865;
const HEM_RATIO = 0.015;
const CHEST_BAND: [number, number] = [0.65, 0.83];
const HIP_BAND: [number, number] = [0.45, 0.59];

const DEFAULT_FIT: FitConfig = {
  top: NECK_RATIO,
  bottom: HEM_RATIO,
  sleeves: true,
  ease: EASE,
  loose: LOOSE,
};

const SLICES = 64;
const TORSO_HALF = 0.13;
const FRONT_FOOT_CUT = 0.08;
const BACK_FOOT_CUT = 0.02;

const COLLIDE_R = 0.08;
const COLLIDE_PASSES = 2;
const FINAL_PASSES = 2;
const COLLIDE_FOOT_CUT = 0.02;
const LOW_EXTRA_EASE = 0.016;
const LOW_ZONE_RATIO = 0.3;
const HORIZ_PUSH_MIN = 0.6;
const UPPER_HASH_RATIO = 0.6; // فوق هالنسبة من الطول: التصادم بيشمل الأذرع

const HAND_LEN = 0.1;
const AXIS_BINS = 12;
const SLEEVE_BLEND_X = 0.12; // مسافة تدرّج التدوير بعيداً عن الجذع (نسبة من الطول)
const SLEEVE_BLEND_U = 0.2; // مسافة تدرّج التدوير على طول الكم (نسبة من الطول)

const SMOOTH_ITERS = 4;
const SMOOTH_L = 0.5;
const SUBDIV_EDGE_RATIO = 0.012; // أي حافة أطول من هالنسبة من ارتفاع الـ mesh بتنقسم
const SUBDIV_MAX_VERTS = 120000;

const WATCH_EVERY_N_FRAMES = 4;

/* ---------- أدوات عامة ---------- */
function isRenderableMesh(object: Object3D): object is Mesh | SkinnedMesh {
  return (object as Mesh).isMesh === true || (object as SkinnedMesh).isSkinnedMesh === true;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const sm = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

interface Profile {
  xMin: Float32Array;
  xMax: Float32Array;
  zMin: Float32Array;
  zMax: Float32Array;
  ok: boolean;
}

interface Body {
  pos: Float32Array;
  nor: Float32Array;
}

interface Weld {
  map: Int32Array;
  nbr: Int32Array[];
}

interface Axis {
  D: THREE.Vector3;
  L: number;
  us: number[];
  pts: THREE.Vector3[];
  tan: THREE.Vector3[];
}

interface SleeveMap {
  sgn: number;
  S: THREE.Vector3;
  g: Axis;
  a: Axis;
  ratio: number;
}

/* ---------- بصمة الأفاتار (لاكتشاف تغيّر الطول/الوزن/أي شي) ---------- */
function avatarSignature(root: Object3D): number[] {
  root.updateWorldMatrix(true, true);
  const sig: number[] = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!isRenderableMesh(o)) return;
    const n = o.geometry.getAttribute('position').count;
    const step = Math.max(1, Math.floor(n / 24));
    for (let i = 0; i < n; i += step) {
      o.getVertexPosition(i, v);
      v.applyMatrix4(o.matrixWorld);
      sig.push(v.x, v.y, v.z);
    }
  });
  return sig;
}

const sameSig = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-5) return false;
  return true;
};

/* ---------- تقسيم الحواف الطويلة فقط (بدون شقوق) ---------- */
function splitLongEdges(geo: THREE.BufferGeometry, maxEdge: number, maxVerts: number): THREE.BufferGeometry {
  const idx = geo.index;
  if (!idx || geo.getAttribute('skinIndex')) return geo;
  for (const name of Object.keys(geo.attributes)) {
    if ((geo.getAttribute(name) as any).isInterleavedBufferAttribute) return geo;
  }

  const count = geo.getAttribute('position').count;
  if (count > maxVerts) return geo;
  const P = geo.getAttribute('position').array as ArrayLike<number>;
  const max2 = maxEdge * maxEdge;
  const isLong = (a: number, b: number) => {
    const dx = P[a * 3] - P[b * 3];
    const dy = P[a * 3 + 1] - P[b * 3 + 1];
    const dz = P[a * 3 + 2] - P[b * 3 + 2];
    return dx * dx + dy * dy + dz * dz > max2;
  };
  const key = (a: number, b: number) => (a < b ? a * count + b : b * count + a);

  // 1) علّم الحواف الطويلة
  const marked = new Map<number, number>();
  const edges: number[] = [];
  const mark = (u: number, v: number) => {
    if (!isLong(u, v)) return;
    const k = key(u, v);
    if (marked.has(k)) return;
    marked.set(k, count + edges.length / 2);
    edges.push(u, v);
  };
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    mark(a, b);
    mark(b, c);
    mark(c, a);
  }
  if (edges.length === 0) return geo;
  const total = count + edges.length / 2;
  if (total > maxVerts) return geo;

  // 2) أعد بناء المثلثات (مع الحفاظ على مجموعات الماتيريال)
  const out: number[] = [];
  const groups = geo.groups.length
    ? geo.groups
    : [{ start: 0, count: idx.count, materialIndex: 0 }];
  const newGroups: { start: number; count: number; materialIndex: number }[] = [];

  for (const gr of groups) {
    const start = out.length;
    for (let t = gr.start; t < gr.start + gr.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      const m0 = marked.get(key(a, b));
      const m1 = marked.get(key(b, c));
      const m2 = marked.get(key(c, a));
      const n = (m0 !== undefined ? 1 : 0) + (m1 !== undefined ? 1 : 0) + (m2 !== undefined ? 1 : 0);

      if (n === 0) {
        out.push(a, b, c);
      } else if (n === 3) {
        out.push(a, m0!, m2!, m0!, b, m1!, m2!, m1!, c, m0!, m1!, m2!);
      } else if (n === 1) {
        if (m0 !== undefined) out.push(a, m0, c, m0, b, c);
        else if (m1 !== undefined) out.push(b, m1, a, m1, c, a);
        else out.push(c, m2!, b, m2!, a, b);
      } else {
        // حافتين معلّمتين: ندوّر المثلث بحيث تكون الحافتين pq و qr
        let p: number, q: number, r: number, mpq: number, mqr: number;
        if (m0 === undefined) { p = b; q = c; r = a; mpq = m1!; mqr = m2!; }
        else if (m1 === undefined) { p = c; q = a; r = b; mpq = m2!; mqr = m0!; }
        else { p = a; q = b; r = c; mpq = m0!; mqr = m1!; }
        out.push(mpq, q, mqr, p, mpq, mqr, p, mqr, r);
      }
    }
    newGroups.push({ start, count: out.length - start, materialIndex: gr.materialIndex ?? 0 });
  }

  // 3) الـ attributes (النقاط الجديدة = منتصف الحافة)
  const g = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) {
    const at = geo.getAttribute(name) as THREE.BufferAttribute;
    const size = at.itemSize;
    const Ctor = at.array.constructor as new (n: number) => Float32Array;
    const arr = new Ctor(total * size);
    arr.set(at.array as Float32Array);
    for (let e = 0; e < edges.length / 2; e++) {
      const a = edges[2 * e];
      const b = edges[2 * e + 1];
      for (let k = 0; k < size; k++) {
        arr[(count + e) * size + k] = (at.array[a * size + k] + at.array[b * size + k]) / 2;
      }
    }
    g.setAttribute(name, new THREE.BufferAttribute(arr, size, at.normalized));
  }
  g.setIndex(out);
  if (geo.groups.length) for (const gr of newGroups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  return g;
}

function subdivideLong(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return geo;
  const h = bb.max.y - bb.min.y;
  if (!(h > 0)) return geo;
  const maxEdge = h * SUBDIV_EDGE_RATIO;
  let cur = geo;
  for (let round = 0; round < 2; round++) {
    const next = splitLongEdges(cur, maxEdge, SUBDIV_MAX_VERTS);
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/* ---------- دمج الرؤوس المتطابقة + الجيران (للتنعيم) ---------- */
function buildWeld(geo: THREE.BufferGeometry, pos: Float32Array): Weld {
  const n = pos.length / 3;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const q = 1 / (diag * 1e-5);

  const keyMap = new Map<string, number>();
  const map = new Int32Array(n);
  let u = 0;
  for (let i = 0; i < n; i++) {
    const key =
      Math.round(pos[i * 3] * q) + ',' + Math.round(pos[i * 3 + 1] * q) + ',' + Math.round(pos[i * 3 + 2] * q);
    let id = keyMap.get(key);
    if (id === undefined) {
      id = u++;
      keyMap.set(key, id);
    }
    map[i] = id;
  }

  const sets: Set<number>[] = Array.from({ length: u }, () => new Set<number>());
  const idx = geo.index;
  const tris = idx ? idx.count / 3 : Math.floor(n / 3);
  for (let t = 0; t < tris; t++) {
    const a = map[idx ? idx.getX(3 * t) : 3 * t];
    const b = map[idx ? idx.getX(3 * t + 1) : 3 * t + 1];
    const c = map[idx ? idx.getX(3 * t + 2) : 3 * t + 2];
    if (a !== b) { sets[a].add(b); sets[b].add(a); }
    if (b !== c) { sets[b].add(c); sets[c].add(b); }
    if (c !== a) { sets[c].add(a); sets[a].add(c); }
  }
  return { map, nbr: sets.map((s) => Int32Array.from(s)) };
}

/* ---------- جمع رؤوس المجسمات ---------- */
function collectWorldVerts(root: Object3D): Float32Array {
  const out: number[] = [];
  const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!isRenderableMesh(o)) return;
    const n = o.geometry.getAttribute('position').count;
    for (let i = 0; i < n; i++) {
      o.getVertexPosition(i, v);
      v.applyMatrix4(o.matrixWorld);
      out.push(v.x, v.y, v.z);
    }
  });
  return Float32Array.from(out);
}

function collectBody(root: Object3D): Body {
  const P: number[] = [];
  const N: number[] = [];
  const v = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const f = new THREE.Vector3();
  root.updateWorldMatrix(true, true);

  root.traverse((o) => {
    if (!isRenderableMesh(o)) return;
    const g = o.geometry;
    const count = g.getAttribute('position').count;
    const base = P.length / 3;
    const cen = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      o.getVertexPosition(i, v);
      v.applyMatrix4(o.matrixWorld);
      P.push(v.x, v.y, v.z);
      cen.add(v);
    }
    cen.divideScalar(Math.max(1, count));

    const nrm = new Float32Array(count * 3);
    const idx = g.index;
    const tris = idx ? idx.count / 3 : Math.floor(count / 3);
    for (let t = 0; t < tris; t++) {
      const ia = idx ? idx.getX(3 * t) : 3 * t;
      const ib = idx ? idx.getX(3 * t + 1) : 3 * t + 1;
      const ic = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
      a.set(P[(base + ia) * 3], P[(base + ia) * 3 + 1], P[(base + ia) * 3 + 2]);
      b.set(P[(base + ib) * 3], P[(base + ib) * 3 + 1], P[(base + ib) * 3 + 2]);
      c.set(P[(base + ic) * 3], P[(base + ic) * 3 + 1], P[(base + ic) * 3 + 2]);
      e1.subVectors(b, a);
      e2.subVectors(c, a);
      f.crossVectors(e1, e2);
      for (const k of [ia, ib, ic]) {
        nrm[k * 3] += f.x;
        nrm[k * 3 + 1] += f.y;
        nrm[k * 3 + 2] += f.z;
      }
    }

    let facing = 0;
    for (let i = 0; i < count; i++) {
      const x = nrm[i * 3], y = nrm[i * 3 + 1], z = nrm[i * 3 + 2];
      const len = Math.hypot(x, y, z) || 1;
      nrm[i * 3] = x / len;
      nrm[i * 3 + 1] = y / len;
      nrm[i * 3 + 2] = z / len;
      facing +=
        nrm[i * 3] * (P[(base + i) * 3] - cen.x) +
        nrm[i * 3 + 1] * (P[(base + i) * 3 + 1] - cen.y) +
        nrm[i * 3 + 2] * (P[(base + i) * 3 + 2] - cen.z);
    }
    const sgn = facing < 0 ? -1 : 1;
    for (let i = 0; i < count * 3; i++) N.push(nrm[i] * sgn);
  });

  return { pos: Float32Array.from(P), nor: Float32Array.from(N) };
}

/* ---------- شبكة تقسيم مكاني + التصادم ---------- */
const cellKey = (ix: number, iy: number, iz: number) =>
  ((ix + 512) * 1024 + (iy + 512)) * 1024 + (iz + 512);

function buildHash(
  body: Body,
  yLo: number,
  yHi: number,
  cell: number,
  accept?: (x: number, y: number, z: number) => boolean
) {
  const map = new Map<number, number[]>();
  const n = body.pos.length / 3;
  for (let i = 0; i < n; i++) {
    const x = body.pos[i * 3], y = body.pos[i * 3 + 1], z = body.pos[i * 3 + 2];
    if (y < yLo || y > yHi) continue;
    if (accept && !accept(x, y, z)) continue;
    const k = cellKey(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell));
    const arr = map.get(k);
    if (arr) arr.push(i);
    else map.set(k, [i]);
  }
  return map;
}

function collide(p: THREE.Vector3, body: Body, hash: Map<number, number[]>, cell: number, ease: number) {
  const ix = Math.floor(p.x / cell);
  const iy = Math.floor(p.y / cell);
  const iz = Math.floor(p.z / cell);
  let best = -1;
  let bd = COLLIDE_R * COLLIDE_R;

  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      for (let oz = -1; oz <= 1; oz++) {
        const arr = hash.get(cellKey(ix + ox, iy + oy, iz + oz));
        if (!arr) continue;
        for (let m = 0; m < arr.length; m++) {
          const j = arr[m];
          const ddx = p.x - body.pos[j * 3];
          const ddy = p.y - body.pos[j * 3 + 1];
          const ddz = p.z - body.pos[j * 3 + 2];
          const d = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d < bd) {
            bd = d;
            best = j;
          }
        }
      }
    }
  }
  if (best < 0) return;

  const nx = body.nor[best * 3], ny = body.nor[best * 3 + 1], nz = body.nor[best * 3 + 2];
  const s =
    (p.x - body.pos[best * 3]) * nx +
    (p.y - body.pos[best * 3 + 1]) * ny +
    (p.z - body.pos[best * 3 + 2]) * nz;
  if (s >= ease) return;

  const need = ease - s;
  const hlen = Math.hypot(nx, nz);
  if (hlen > HORIZ_PUSH_MIN) {
    // سطح شبه عمودي (جذع/ساق): دفع أفقي فقط عشان ما تنفتح فجوات بالخصر
    const k = need / hlen;
    p.x += (nx / hlen) * k;
    p.z += (nz / hlen) * k;
  } else {
    p.x += nx * need;
    p.y += ny * need;
    p.z += nz * need;
  }
}

/* ---------- محاور الذراع والكم ---------- */
function buildAxis(
  verts: Float32Array,
  S: THREE.Vector3,
  sgn: number,
  cx: number,
  farX: number,
  binX: number,
  yMin: number,
  perp: number,
  bins: number
): Axis | null {
  const n = verts.length / 3;

  let far = -1;
  let fd = 0;
  for (let i = 0; i < n; i++) {
    const x = verts[i * 3], y = verts[i * 3 + 1], z = verts[i * 3 + 2];
    if (sgn * (x - cx) <= farX || y < yMin) continue;
    const dx = x - S.x, dy = y - S.y, dz = z - S.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > fd) {
      fd = d2;
      far = i;
    }
  }
  if (far < 0) return null;
  const L = Math.sqrt(fd);
  if (L < 0.05) return null;

  const D = new THREE.Vector3(verts[far * 3] - S.x, verts[far * 3 + 1] - S.y, verts[far * 3 + 2] - S.z).normalize();

  const sum = Array.from({ length: bins }, () => new THREE.Vector3());
  const cnt = new Array<number>(bins).fill(0);
  for (let i = 0; i < n; i++) {
    const x = verts[i * 3], y = verts[i * 3 + 1], z = verts[i * 3 + 2];
    if (sgn * (x - cx) <= binX || y < yMin) continue;
    const qx = x - S.x, qy = y - S.y, qz = z - S.z;
    const u = qx * D.x + qy * D.y + qz * D.z;
    if (u < 0 || u > L) continue;
    const r2 = qx * qx + qy * qy + qz * qz - u * u;
    if (r2 > perp * perp) continue;
    const b = Math.min(bins - 1, Math.floor((u / L) * bins));
    sum[b].x += x;
    sum[b].y += y;
    sum[b].z += z;
    cnt[b]++;
  }

  const us: number[] = [0];
  let pts: THREE.Vector3[] = [S.clone()];
  for (let b = 0; b < bins; b++) {
    const uc = ((b + 0.5) / bins) * L;
    us.push(uc);
    if (cnt[b] > 0) pts.push(sum[b].clone().divideScalar(cnt[b]));
    else pts.push(S.clone().addScaledVector(D, uc));
  }

  const sp = pts.map((p) => p.clone());
  for (let k = 1; k < pts.length - 1; k++) {
    sp[k].copy(pts[k - 1]).add(pts[k]).add(pts[k]).add(pts[k + 1]).multiplyScalar(0.25);
  }
  pts = sp;

  const tan = pts.map((_, k) => {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(pts.length - 1, k + 1)];
    const t = new THREE.Vector3().subVectors(b, a);
    return t.lengthSq() > 1e-10 ? t.normalize() : D.clone();
  });

  return { D, L, us, pts, tan };
}

function evalAxis(ax: Axis, u: number, pos: THREE.Vector3, tan: THREE.Vector3) {
  const last = ax.us.length - 1;
  if (u <= ax.us[0]) {
    pos.copy(ax.pts[0]).addScaledVector(ax.D, u - ax.us[0]);
    tan.copy(ax.tan[0]);
    return;
  }
  if (u >= ax.us[last]) {
    pos.copy(ax.pts[last]).addScaledVector(ax.tan[last], u - ax.us[last]);
    tan.copy(ax.tan[last]);
    return;
  }
  let k = 0;
  while (k < last - 1 && u > ax.us[k + 1]) k++;
  const f = (u - ax.us[k]) / (ax.us[k + 1] - ax.us[k]);
  pos.copy(ax.pts[k]).lerp(ax.pts[k + 1], f);
  tan.copy(ax.tan[k]).lerp(ax.tan[k + 1], f).normalize();
}

function computeSleeve(
  sgn: number,
  gVerts: Float32Array,
  bVerts: Float32Array,
  cx: number,
  half: number,
  aMinY: number,
  aH: number,
  zc: number
): SleeveMap | null {
  const S = new THREE.Vector3(cx + sgn * aH * 0.105, aMinY + aH * 0.8, zc);
  const farX = aH * 0.2;
  const binX = half * 0.95;
  const yMin = aMinY + aH * 0.4;
  const perp = aH * 0.085;

  const g = buildAxis(gVerts, S, sgn, cx, farX, binX, yMin, perp, AXIS_BINS);
  const a = buildAxis(bVerts, S, sgn, cx, farX, binX, yMin, perp, AXIS_BINS);
  if (!g || !a) return null;

  const wrist = a.L - aH * HAND_LEN;
  if (wrist < 0.1) return null;
  const ratio = clamp(wrist / g.L, 0.7, 1.4);
  return { sgn, S, g, a, ratio };
}

const _gp = new THREE.Vector3();
const _gt = new THREE.Vector3();
const _ap = new THREE.Vector3();
const _at = new THREE.Vector3();
const _o = new THREE.Vector3();
const _q = new THREE.Quaternion();

function applySleeve(p: THREE.Vector3, m: SleeveMap, cx: number, half: number, aH: number): number {
  const d = m.sgn * (p.x - cx);
  const tx = sm((d - half * 0.95) / (aH * SLEEVE_BLEND_X));
  if (tx <= 0) return 0;

  const ug = (p.x - m.S.x) * m.g.D.x + (p.y - m.S.y) * m.g.D.y + (p.z - m.S.z) * m.g.D.z;
  if (ug <= 0) return 0;

  evalAxis(m.g, ug, _gp, _gt);
  _o.copy(p).sub(_gp);
  const r = _o.length();
  const wR = 1 - sm((r - aH * 0.085) / (aH * 0.035));
  if (wR <= 0) return 0;

  const w = tx * sm(ug / (aH * SLEEVE_BLEND_U)) * wR;
  if (w <= 0) return 0;

  const ua = ug <= m.g.L ? ug * m.ratio : m.g.L * m.ratio + (ug - m.g.L);
  evalAxis(m.a, ua, _ap, _at);
  _q.setFromUnitVectors(_gt, _at);
  _o.applyQuaternion(_q);
  _ap.add(_o);
  p.lerp(_ap, w);
  return w;
}

/* ---------- بروفايل الشرائح ---------- */
function fillGaps(a: Float32Array) {
  let last = -1;
  for (let i = 0; i < a.length; i++) {
    if (!isFinite(a[i])) continue;
    if (last === -1) {
      for (let j = 0; j < i; j++) a[j] = a[i];
    } else {
      for (let j = last + 1; j < i; j++) {
        a[j] = a[last] + ((a[i] - a[last]) * (j - last)) / (i - last);
      }
    }
    last = i;
  }
  if (last >= 0) for (let j = last + 1; j < a.length; j++) a[j] = a[last];
}

function buildProfile(
  verts: Float32Array,
  yMin: number,
  yMax: number,
  cx: number,
  half: number,
  skipBelow = -Infinity,
  skipFrontBelow = -Infinity
): Profile {
  const mk = (f: number) => new Float32Array(SLICES).fill(f);
  const p: Profile = {
    xMin: mk(Infinity),
    xMax: mk(-Infinity),
    zMin: mk(Infinity),
    zMax: mk(-Infinity),
    ok: true,
  };
  for (let i = 0; i < verts.length; i += 3) {
    const x = verts[i];
    const y = verts[i + 1];
    const z = verts[i + 2];
    if (y < yMin || y > yMax || y < skipBelow || Math.abs(x - cx) > half) continue;
    const s = Math.min(SLICES - 1, Math.floor(((y - yMin) / (yMax - yMin)) * SLICES));
    if (x < p.xMin[s]) p.xMin[s] = x;
    if (x > p.xMax[s]) p.xMax[s] = x;
    if (z < p.zMin[s]) p.zMin[s] = z;
    if (y >= skipFrontBelow && z > p.zMax[s]) p.zMax[s] = z;
  }
  [p.xMin, p.xMax, p.zMin, p.zMax].forEach(fillGaps);
  p.ok = isFinite(p.xMin[0]) && isFinite(p.zMax[SLICES - 1]);
  return p;
}

function blur(a: Float32Array, passes = 2) {
  const d = Float32Array.from(a);
  for (let k = 0; k < passes; k++) {
    const t = Float32Array.from(d);
    for (let i = 0; i < d.length; i++) {
      d[i] = (t[Math.max(0, i - 1)] + t[i] + t[Math.min(d.length - 1, i + 1)]) / 3;
    }
  }
  return d;
}

function dilateBlur(a: Float32Array, r = 2, passes = 2) {
  const d = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    let m = 0;
    for (let j = Math.max(0, i - r); j <= Math.min(a.length - 1, i + r); j++) {
      m = Math.max(m, a[j]);
    }
    d[i] = m;
  }
  return blur(d, passes);
}

const sample = (a: Float32Array, s: number) => {
  const f = clamp(s, 0, a.length - 1);
  const i0 = Math.floor(f);
  const i1 = Math.min(a.length - 1, i0 + 1);
  return a[i0] + (a[i1] - a[i0]) * (f - i0);
};

const remapC = (v: number, g0: number, g1: number, t0: number, t1: number) => {
  if (g1 - g0 < 1e-5) return v;
  if (v < g0) return v + (t0 - g0);
  if (v > g1) return v + (t1 - g1);
  return t0 + ((v - g0) * (t1 - t0)) / (g1 - g0);
};

function restoreGeometry(root: Object3D) {
  root.traverse((o) => {
    if (!isRenderableMesh(o)) return;
    const orig = o.userData.origPos as Float32Array | undefined;
    const attr = o.geometry.getAttribute('position');
    if (orig && attr && attr.array.length === orig.length) {
      (attr.array as Float32Array).set(orig);
      attr.needsUpdate = true;
    }
  });
}

/* ---------- التلبيس الكامل ---------- */
function fitGarment(shirt: Object3D, avatar: Object3D, size: ShirtSize, cfg: FitConfig) {
  restoreGeometry(shirt);
  shirt.position.set(0, 0, 0);
  shirt.rotation.set(0, 0, 0);
  shirt.scale.set(1, 1, 1);
  shirt.updateWorldMatrix(true, true);
  avatar.updateWorldMatrix(true, true);

  const aBox = new THREE.Box3().setFromObject(avatar, true);
  const aH = aBox.max.y - aBox.min.y;
  if (!isFinite(aH) || aH < 0.3 || aH > 4) return; // قياس غير منطقي: نتجاهله
  if (cfg.top - cfg.bottom < 0.1) return;

  const topY = aBox.min.y + aH * cfg.top;
  const botY = aBox.min.y + aH * cfg.bottom;
  const span = topY - botY;
  const ease = cfg.ease[size];
  const loose = cfg.loose[size];

  // (1) مقياس رأسي موحّد + محاذاة الأعلى
  const sBox0 = new THREE.Box3().setFromObject(shirt);
  const sH0 = sBox0.max.y - sBox0.min.y;
  if (!(sH0 > 0)) return;
  shirt.scale.setScalar(span / sH0);
  shirt.updateWorldMatrix(true, true);
  const sBox1 = new THREE.Box3().setFromObject(shirt);
  shirt.position.y += topY - sBox1.max.y;
  shirt.updateWorldMatrix(true, true);

  // (2) الأفاتار
  const half = aH * TORSO_HALF;
  const cxA = (aBox.min.x + aBox.max.x) / 2;
  const backCutY = aBox.min.y + aH * BACK_FOOT_CUT;
  const frontCutY = aBox.min.y + aH * FRONT_FOOT_CUT;
  const body = collectBody(avatar);
  const A = buildProfile(body.pos, botY, topY, cxA, half, backCutY, frontCutY);

  // (3) محاذاة مركز الجذع
  let gVerts = collectWorldVerts(shirt);
  let G = buildProfile(gVerts, botY, topY, cxA, half);
  if (!A.ok || !G.ok) return;

  const sliceOf = (yFrac: number) =>
    clamp(Math.floor(((yFrac - cfg.bottom) / (cfg.top - cfg.bottom)) * SLICES), 0, SLICES - 1);
  let lo = Math.max(HIP_BAND[0], cfg.bottom);
  let hi = Math.min(CHEST_BAND[1], cfg.top);
  if (hi - lo < 0.05) {
    lo = cfg.bottom;
    hi = cfg.top;
  }
  const i0 = sliceOf(lo);
  const i1 = Math.max(i0, sliceOf(hi));

  const mid = (p: Profile, k: 'x' | 'z') => {
    let s = 0;
    let n = 0;
    for (let i = i0; i <= i1; i++) {
      s += k === 'x' ? (p.xMin[i] + p.xMax[i]) / 2 : (p.zMin[i] + p.zMax[i]) / 2;
      n++;
    }
    return s / Math.max(1, n);
  };

  shirt.position.x += mid(A, 'x') - mid(G, 'x');
  shirt.position.z += mid(A, 'z') - mid(G, 'z');
  shirt.updateWorldMatrix(true, true);

  gVerts = collectWorldVerts(shirt);
  G = buildProfile(gVerts, botY, topY, cxA, half);
  if (!G.ok) return;

  // (4) محاور الأكمام (كتف -> معصم)
  const sIdx = sliceOf(0.8);
  const zc = (A.zMin[sIdx] + A.zMax[sIdx]) / 2;
  const sleeveL = cfg.sleeves ? computeSleeve(-1, gVerts, body.pos, cxA, half, aBox.min.y, aH, zc) : null;
  const sleeveR = cfg.sleeves ? computeSleeve(1, gVerts, body.pos, cxA, half, aBox.min.y, aH, zc) : null;
  const sleeveYMin = aBox.min.y + aH * 0.45;
  const upperHashY = aBox.min.y + aH * UPPER_HASH_RATIO;

  // (5) الدفع (للخارج) أو السحب (للداخل) لكل شريحة
  const yFracOf = (i: number) => cfg.bottom + ((i + 0.5) / SLICES) * (cfg.top - cfg.bottom);
  const shrinkW = (i: number) => sm((yFracOf(i) - HIP_BAND[0]) / (HIP_BAND[1] - HIP_BAND[0]));

  const mkNet = (needOut: (i: number) => number, excess: (i: number) => number) => {
    const out = dilateBlur(Float32Array.from({ length: SLICES }, (_, i) => Math.max(0, needOut(i))));
    const inn = blur(
      Float32Array.from({ length: SLICES }, (_, i) => Math.max(0, excess(i)) * shrinkW(i)),
      3
    );
    const net = new Float32Array(SLICES);
    for (let i = 0; i < SLICES; i++) net[i] = out[i] - inn[i];
    return net;
  };

  const pxMin = mkNet(
    (i) => G.xMin[i] - (A.xMin[i] - ease),
    (i) => A.xMin[i] - ease - loose - G.xMin[i]
  );
  const pxMax = mkNet(
    (i) => A.xMax[i] + ease - G.xMax[i],
    (i) => G.xMax[i] - (A.xMax[i] + ease + loose)
  );
  const pzMin = mkNet(
    (i) => G.zMin[i] - (A.zMin[i] - ease),
    (i) => A.zMin[i] - ease - loose - G.zMin[i]
  );
  const pzMax = mkNet(
    (i) => A.zMax[i] + ease - G.zMax[i],
    (i) => G.zMax[i] - (A.zMax[i] + ease + loose)
  );

  // (6) شبكتين للتصادم: جسم بدون أذرع (للخصر وتحت) + جسم كامل (للأكتاف والأكمام)
  const cell = COLLIDE_R;
  const yLo = aBox.min.y + aH * COLLIDE_FOOT_CUT;
  const yHi = topY + 0.01;
  const armYMin = aBox.min.y + aH * 0.35;
  const hashAll = buildHash(body, yLo, yHi, cell);
  const hashBody = buildHash(
    body,
    yLo,
    yHi,
    cell,
    (x, y) => !(Math.abs(x - cxA) > half * 0.95 && y > armYMin)
  );
  const lowZone = aBox.min.y + aH * LOW_ZONE_RATIO;
  const easeAt = (y: number) => (y < lowZone ? ease + LOW_EXTRA_EASE : ease);

  // (7) تطبيق كل شي على كل رأس
  const p = new THREE.Vector3();
  shirt.traverse((o) => {
    if (!isRenderableMesh(o)) return;
    const pos = o.geometry.getAttribute('position');
    const weld = o.userData.weld as Weld;
    const n = pos.count;
    const mw = o.matrixWorld;
    const inv = mw.clone().invert();
    const W0 = new Float32Array(n * 3);
    const W1 = new Float32Array(n * 3);
    const useAll = new Uint8Array(n); // 1 = التصادم مع الجسم كامل (بما فيه الأذرع)

    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mw);
      W0[i * 3] = p.x;
      W0[i * 3 + 1] = p.y;
      W0[i * 3 + 2] = p.z;

      const sl = p.x >= cxA ? sleeveR : sleeveL;
      const w = sl && p.y > sleeveYMin ? applySleeve(p, sl, cxA, half, aH) : 0;

      const s = ((p.y - botY) / span) * SLICES - 0.5;
      const gx0 = sample(G.xMin, s);
      const gx1 = sample(G.xMax, s);
      const gz0 = sample(G.zMin, s);
      const gz1 = sample(G.zMax, s);
      const nx = remapC(p.x, gx0, gx1, gx0 - sample(pxMin, s), gx1 + sample(pxMax, s));
      const nz = remapC(p.z, gz0, gz1, gz0 - sample(pzMin, s), gz1 + sample(pzMax, s));
      p.x += (nx - p.x) * (1 - w);
      p.z += (nz - p.z) * (1 - w);

      useAll[i] = w > 0.02 || p.y > upperHashY ? 1 : 0;

      const e = easeAt(p.y);
      const h = useAll[i] ? hashAll : hashBody;
      for (let k = 0; k < COLLIDE_PASSES; k++) collide(p, body, h, cell, e);

      W1[i * 3] = p.x;
      W1[i * 3 + 1] = p.y;
      W1[i * 3 + 2] = p.z;
    }

    // تنعيم حقل الإزاحة (مو الأسطح، عشان تضل تجاعيد القماش)
    const U = weld.nbr.length;
    let D = new Float32Array(U * 3);
    for (let i = 0; i < n; i++) {
      const u = weld.map[i];
      D[u * 3] = W1[i * 3] - W0[i * 3];
      D[u * 3 + 1] = W1[i * 3 + 1] - W0[i * 3 + 1];
      D[u * 3 + 2] = W1[i * 3 + 2] - W0[i * 3 + 2];
    }
    for (let it = 0; it < SMOOTH_ITERS; it++) {
      const D2 = new Float32Array(D.length);
      for (let u = 0; u < U; u++) {
        const nb = weld.nbr[u];
        if (nb.length === 0) {
          D2[u * 3] = D[u * 3];
          D2[u * 3 + 1] = D[u * 3 + 1];
          D2[u * 3 + 2] = D[u * 3 + 2];
          continue;
        }
        let sx = 0, sy = 0, sz = 0;
        for (let k = 0; k < nb.length; k++) {
          sx += D[nb[k] * 3];
          sy += D[nb[k] * 3 + 1];
          sz += D[nb[k] * 3 + 2];
        }
        sx /= nb.length;
        sy /= nb.length;
        sz /= nb.length;
        D2[u * 3] = D[u * 3] + SMOOTH_L * (sx - D[u * 3]);
        D2[u * 3 + 1] = D[u * 3 + 1] + SMOOTH_L * (sy - D[u * 3 + 1]);
        D2[u * 3 + 2] = D[u * 3 + 2] + SMOOTH_L * (sz - D[u * 3 + 2]);
      }
      D = D2;
    }

    // إسقاط نهائي + الرجوع للفضاء المحلي (مع حماية من NaN)
    for (let i = 0; i < n; i++) {
      const u = weld.map[i];
      p.set(W0[i * 3] + D[u * 3], W0[i * 3 + 1] + D[u * 3 + 1], W0[i * 3 + 2] + D[u * 3 + 2]);
      const e = easeAt(p.y);
      const h = useAll[i] || p.y > upperHashY ? hashAll : hashBody;
      for (let k = 0; k < FINAL_PASSES; k++) collide(p, body, h, cell, e);
      if (!isFinite(p.x + p.y + p.z)) p.set(W0[i * 3], W0[i * 3 + 1], W0[i * 3 + 2]);
      p.applyMatrix4(inv);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    o.geometry.computeBoundingSphere();
  });
  shirt.updateWorldMatrix(true, true);
}

/* ---------- المكوّن الرئيسي ---------- */
export function Shirt({ size, avatar, url, fit }: ShirtProps) {
  const path = url ?? `/models/shirt_${size}.glb`;
  const { scene } = useGLTF(path);

  const fitKey = JSON.stringify(fit ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cfg = useMemo<FitConfig>(() => ({ ...DEFAULT_FIT, ...(fit ?? {}) }), [fitKey]);

  // 1. استنساخ + تقسيم الحواف الطويلة + تجهيز التنعيم
  const shirt = useMemo(() => {
    const root = cloneSkeleton(scene);
    root.traverse((o) => {
      if (!isRenderableMesh(o)) return;
      const g = subdivideLong(o.geometry.clone());
      o.geometry = g;
      const orig = Float32Array.from(g.getAttribute('position').array as ArrayLike<number>);
      o.userData.origPos = orig;
      o.userData.weld = buildWeld(g, orig);
    });
    return root;
  }, [scene]);

  // 2. الماتيريال والظل
  useLayoutEffect(() => {
    const created: THREE.Material[] = [];
    shirt.traverse((o) => {
      if (!isRenderableMesh(o)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;

      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map((m) => {
        const c = m.clone();
        c.side = THREE.DoubleSide;
        c.polygonOffset = true;
        c.polygonOffsetFactor = -1;
        c.polygonOffsetUnits = -1;
        created.push(c);
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
    return () => {
      created.forEach((m) => m.dispose());
      shirt.traverse((o) => {
        if (isRenderableMesh(o)) o.geometry.dispose();
      });
    };
  }, [shirt]);

  // 3. التلبيس + المراقب
  const fittedSig = useRef<number[] | null>(null);
  const lastSig = useRef<number[] | null>(null);
  const tick = useRef(0);

  const runFit = useCallback(() => {
    if (!avatar || !shirt) return;
    try {
      fitGarment(shirt, avatar, size, cfg);
    } catch (e) {
      console.error('[Shirt] fit failed', e);
      restoreGeometry(shirt);
    }
    fittedSig.current = avatarSignature(avatar);
  }, [shirt, avatar, size, cfg]);

  // تلبيس أولي عند تغيّر اللبسة/المقاس/الإعدادات
  useLayoutEffect(() => {
    lastSig.current = null;
    runFit();
  }, [runFit]);

  // مراقبة الأفاتار: أي تغيّر بالطول/الوزن/المقاس بيتلقط بعد ما يستقر
  // (بيفترض الأفاتار ثابت بوضعية A-pose؛ مع أنيميشن مستمر بتتعطل المراقبة)
  useFrame(() => {
    if (!avatar) return;
    if (tick.current++ % WATCH_EVERY_N_FRAMES !== 0) return;
    const sig = avatarSignature(avatar);
    const stable = lastSig.current !== null && sameSig(sig, lastSig.current);
    lastSig.current = sig;
    if (stable && (!fittedSig.current || !sameSig(sig, fittedSig.current))) runFit();
  });

  return <primitive object={shirt} />;
}

useGLTF.preload('/models/shirt_S.glb');
useGLTF.preload('/models/shirt_M.glb');
useGLTF.preload('/models/shirt_L.glb');
useGLTF.preload('/models/shirt_XL.glb');