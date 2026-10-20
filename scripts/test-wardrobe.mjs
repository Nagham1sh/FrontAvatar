// Logic tests for the wardrobe feature (validation, outlines, export payload).
// Uses the project's own Vite to load the TypeScript modules — no test framework needed.
// Run: npm run test:wardrobe
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const load = (path) => server.ssrLoadModule(path);

const { validateProductDraft, normalizeDraft, measurementErrorKey } = await load('/src/features/wardrobe/validation.ts');
const { emptyDraft, GARMENT_TYPES } = await load('/src/features/wardrobe/types.ts');
const { MEASUREMENTS_BY_TYPE } = await load('/src/features/wardrobe/garmentCatalog.ts');
const { buildGarmentOutline } = await load('/src/features/wardrobe/viewer/garmentOutline.ts');
const { buildFittingRoomPayload } = await load('/src/features/wardrobe/fittingRoomExport.ts');
const { isGarmentPayload, getMeasurementBySize, garmentModelUrl } = await load('/src/integration/fittingRoom/handoff.ts');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function validDraft() {
  return {
    ...emptyDraft(),
    name: 'تيشيرت قطن',
    type: 'tshirt',
    images: { front: 'data:image/webp;base64,AAAA', back: null },
    sizes: ['S', 'M'],
    measurements: { S: { chest: 96, length: 68 }, M: { chest: 104, length: 70, sleeveLength: 21 } },
  };
}

function product(overrides = {}) {
  return { ...validDraft(), id: 'p-1', createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z', ...overrides };
}

test('valid draft has no errors', () => {
  assert.deepEqual(validateProductDraft(validDraft()), {});
});

test('empty draft reports required fields', () => {
  const errors = validateProductDraft(emptyDraft());
  assert.ok(errors.name);
  assert.ok(errors['images.front']);
  assert.ok(errors.sizes);
});

test('required measurement missing for a selected size', () => {
  const draft = validDraft();
  draft.measurements.S = { chest: 96 };
  const errors = validateProductDraft(draft);
  assert.ok(errors[measurementErrorKey('S', 'length')]);
  assert.equal(Object.keys(errors).length, 1);
});

test('out-of-range measurement and negative price are rejected', () => {
  const draft = validDraft();
  draft.measurements.M.chest = 900;
  draft.extra.price = -5;
  const errors = validateProductDraft(draft);
  assert.ok(errors[measurementErrorKey('M', 'chest')]);
  assert.ok(errors['extra.price']);
});

test('fabric "other" needs a name', () => {
  const draft = { ...validDraft(), fabric: 'other', fabricNote: '  ' };
  assert.ok(validateProductDraft(draft).fabricNote);
  assert.deepEqual(validateProductDraft({ ...draft, fabricNote: 'تول' }), {});
});

test('each garment type requires its own measurements', () => {
  for (const type of GARMENT_TYPES) {
    const draft = { ...validDraft(), type, sizes: ['M'], measurements: { M: {} } };
    const errors = validateProductDraft(draft);
    const required = MEASUREMENTS_BY_TYPE[type].filter((f) => f.required).map((f) => f.key);
    for (const key of required) assert.ok(errors[measurementErrorKey('M', key)], `${type}.${key}`);
  }
});

test('normalizeDraft drops unselected sizes and keys of other types', () => {
  const draft = validDraft();
  draft.sizes = ['M'];
  draft.measurements.M.inseam = 80; // not a t-shirt measurement
  draft.name = '  اسم  ';
  const clean = normalizeDraft(draft);
  assert.deepEqual(clean.sizes, ['M']);
  assert.equal(clean.measurements.S, undefined);
  assert.equal(clean.measurements.M.inseam, undefined);
  assert.equal(clean.measurements.M.chest, 104);
  assert.equal(clean.name, 'اسم');
});

test('outlines are closed, symmetric and scale with measurements', () => {
  for (const type of GARMENT_TYPES) {
    const { points, width, height } = buildGarmentOutline(type, {});
    assert.ok(points.length >= 6, type);
    assert.ok(width > 10 && height > 10, type);
    for (const [x, y] of points) assert.ok(Number.isFinite(x) && Number.isFinite(y), type);
    const xs = points.map(([x]) => x);
    assert.ok(Math.abs(Math.max(...xs) + Math.min(...xs)) < 1e-9, `${type} symmetric`);
  }
  const small = buildGarmentOutline('tshirt', { chest: 90, length: 60 });
  const large = buildGarmentOutline('tshirt', { chest: 120, length: 76 });
  assert.ok(large.width > small.width);
  assert.ok(large.height > small.height);
  assert.equal(Math.round(buildGarmentOutline('skirt', { waist: 70, length: 55 }).height), 55);
});

test('export payload contains everything the fitting room needs', () => {
  const p = product({ fabric: 'linen', model: { kind: 'project', url: '/models/shirt_M.glb', label: 'x' } });
  const check = buildFittingRoomPayload(p, { exportId: 'e-1', now: new Date('2026-10-20T12:00:00Z') });
  assert.equal(check.ok, true);
  const { payload } = check;
  assert.equal(payload.schema, 'palestine-tryon/garment@1');
  assert.equal(payload.exportId, 'e-1');
  assert.equal(payload.garment.productId, 'p-1');
  assert.equal(payload.garment.name, 'تيشيرت قطن');
  assert.equal(payload.garment.type, 'tshirt');
  assert.equal(payload.garment.typeLabel, 'تيشيرت');
  assert.equal(payload.garment.category, 'top');
  assert.deepEqual(payload.garment.fabric, { id: 'linen', label: 'كتان' });
  assert.equal(payload.garment.images.front, 'data:image/webp;base64,AAAA');
  assert.deepEqual(payload.garment.sizes, [
    { size: 'S', measurementsCm: { chest: 96, length: 68 } },
    { size: 'M', measurementsCm: { chest: 104, length: 70, sleeveLength: 21 } },
  ]);
  assert.deepEqual(payload.garment.model, { kind: 'url', url: '/models/shirt_M.glb' });
  assert.ok(isGarmentPayload(payload));
  assert.deepEqual(getMeasurementBySize(payload, 'chest'), { S: 96, M: 104 });
  assert.equal(garmentModelUrl(payload), '/models/shirt_M.glb');
  // Must survive JSON (API / file hand-off).
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
});

test('uploaded model is embedded; no model gives null', () => {
  const up = buildFittingRoomPayload(product({ model: { kind: 'upload', dataUrl: 'data:model/gltf-binary;base64,Zw==', fileName: 'a.glb', sizeBytes: 1 } }));
  assert.equal(up.payload.garment.model.kind, 'embedded-glb');
  assert.equal(garmentModelUrl(up.payload), 'data:model/gltf-binary;base64,Zw==');
  assert.equal(buildFittingRoomPayload(product()).payload.garment.model, null);
});

test('export is refused without a product or with invalid data', () => {
  assert.equal(buildFittingRoomPayload(null).ok, false);
  const bad = buildFittingRoomPayload(product({ images: { front: null, back: null } }));
  assert.equal(bad.ok, false);
  assert.ok(bad.problems.some((m) => m.includes('الأمام')));
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${name}\n    ${err.message}`);
  }
}
await server.close();
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
