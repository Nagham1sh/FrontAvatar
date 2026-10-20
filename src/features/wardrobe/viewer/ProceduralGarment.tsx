import { useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { FABRICS } from '../fabrics';
import type { FabricId, GarmentMeasurements, GarmentType } from '../types';
import { buildGarmentOutline } from './garmentOutline';
import { createFabricMaterial, disposeFabricMaterial } from './fabricMaterial';
import { createPhotoTexture } from './photoTexture';

const CM = 0.01;
const THICKNESS = 0.025;

type ProceduralGarmentProps = {
  type: GarmentType;
  measurements: GarmentMeasurements;
  fabric: FabricId;
  color: string;
  frontImage: string | null;
  backImage: string | null;
  showPhotos: boolean;
};

/** Flat ShapeGeometry with UVs stretched over the silhouette's bounding box. */
function useFaceGeometry(shape: THREE.Shape) {
  const geometry = useMemo(() => {
    const g = new THREE.ShapeGeometry(shape, 8);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const w = box.max.x - box.min.x || 1;
    const h = box.max.y - box.min.y || 1;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) - box.min.x) / w, (pos.getY(i) - box.min.y) / h);
    }
    uv.needsUpdate = true;
    return g;
  }, [shape]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function useFabricMaterial(fabric: FabricId, color: string, map: THREE.Texture | null) {
  const material = useMemo(
    () => createFabricMaterial(FABRICS[fabric].render, { color, map }),
    [fabric, color, map],
  );
  useEffect(() => () => disposeFabricMaterial(material), [material]);
  return material;
}

type FaceProps = {
  geometry: THREE.BufferGeometry;
  fabric: FabricId;
  color: string;
  side: 'front' | 'back';
};

function Face({ geometry, fabric, color, side, map }: FaceProps & { map: THREE.Texture | null }) {
  const material = useFabricMaterial(fabric, color, map);
  return side === 'front' ? (
    <mesh geometry={geometry} material={material} position-z={THICKNESS / 2 + 0.0005} castShadow />
  ) : (
    // Rotated half a turn so the back photo reads correctly when viewed from behind.
    <mesh geometry={geometry} material={material} position-z={-THICKNESS / 2 - 0.0005} rotation-y={Math.PI} castShadow />
  );
}

function PhotoFace({ url, ...props }: FaceProps & { url: string }) {
  const image = useLoader(THREE.ImageLoader, url);
  const texture = useMemo(() => createPhotoTexture(image, props.color), [image, props.color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <Face {...props} map={texture} />;
}

/**
 * Approximate 3D preview generated from the garment type + measurements, with
 * the front/back photos projected on each side. Used when the product has no
 * real 3D model. It is NOT an automatic photo-to-3D reconstruction.
 */
export function ProceduralGarment({
  type,
  measurements,
  fabric,
  color,
  frontImage,
  backImage,
  showPhotos,
}: ProceduralGarmentProps) {
  const shape = useMemo(() => {
    const outline = buildGarmentOutline(type, measurements);
    const offsetY = outline.height / 2;
    return new THREE.Shape(outline.points.map(([x, y]) => new THREE.Vector2(x * CM, (y - offsetY) * CM)));
  }, [type, measurements]);

  const faceGeometry = useFaceGeometry(shape);

  const sideGeometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: THICKNESS, bevelEnabled: false, curveSegments: 8 });
    g.translate(0, 0, -THICKNESS / 2);
    return g;
  }, [shape]);
  useEffect(() => () => sideGeometry.dispose(), [sideGeometry]);

  // Extrude group 0 = caps (covered by the faces), group 1 = side walls.
  const sideMaterials = useMemo(
    () => [
      new THREE.MeshBasicMaterial({ visible: false }),
      createFabricMaterial(FABRICS[fabric].render, { color: new THREE.Color(color).multiplyScalar(0.8).getStyle() }),
    ],
    [fabric, color],
  );
  useEffect(() => () => sideMaterials.forEach(disposeFabricMaterial), [sideMaterials]);

  const faceProps = { geometry: faceGeometry, fabric, color };

  return (
    <group>
      {showPhotos && frontImage ? (
        <PhotoFace {...faceProps} side="front" url={frontImage} />
      ) : (
        <Face {...faceProps} side="front" map={null} />
      )}
      {showPhotos && backImage ? (
        <PhotoFace {...faceProps} side="back" url={backImage} />
      ) : (
        <Face {...faceProps} side="back" map={null} />
      )}
      <mesh geometry={sideGeometry} material={sideMaterials} castShadow />
    </group>
  );
}
