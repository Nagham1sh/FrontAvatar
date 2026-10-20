import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { FABRICS } from '../fabrics';
import type { FabricId } from '../types';
import { createFabricMaterial, disposeFabricMaterial } from './fabricMaterial';

type GarmentModelProps = {
  url: string;
  fabric: FabricId;
  color: string;
  /** Replace the model's own materials with the selected fabric's look. */
  applyFabric: boolean;
};

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as THREE.Mesh).isMesh === true;
}

/**
 * Shows a garment GLB on its own (no avatar). The cached glTF scene is cloned
 * so material changes never leak into other viewers (e.g. the fitting room).
 */
export function GarmentModel({ url, fabric, color, applyFabric }: GarmentModelProps) {
  const gltf = useGLTF(url);

  const { scene, created } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const createdMaterials: THREE.Material[] = [];

    clone.traverse((object) => {
      if (!isMesh(object)) return;
      object.castShadow = true;
      object.receiveShadow = true;

      // Some project models ship without normals; lighting needs them.
      if (!object.geometry.getAttribute('normal')) {
        object.geometry = object.geometry.clone();
        object.geometry.computeVertexNormals();
      }

      if (!applyFabric) return;

      const originals = Array.isArray(object.material) ? object.material : [object.material];
      const replaced = originals.map((original) => {
        const source = original as THREE.MeshStandardMaterial;
        const material = createFabricMaterial(FABRICS[fabric].render, {
          color,
          // Keep the model's own print/texture; only the surface response changes.
          map: source.map ?? null,
          normalMap: source.normalMap ?? null,
          side: source.side,
        });
        createdMaterials.push(material);
        return material;
      });
      object.material = Array.isArray(object.material) ? replaced : replaced[0];
    });

    return { scene: clone, created: createdMaterials };
  }, [gltf.scene, applyFabric, fabric, color]);

  useEffect(() => () => created.forEach(disposeFabricMaterial), [created]);

  return <primitive object={scene} />;
}
