import { useLayoutEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Object3D, Mesh, SkinnedMesh } from 'three';

export const SHIRT_URL = '/models/shirt_S.glb';

function isRenderableMesh(object: Object3D): object is Mesh | SkinnedMesh {
  return (
    (object as Mesh).isMesh === true ||
    (object as SkinnedMesh).isSkinnedMesh === true
  );
}

export function Shirt() {
  const { scene } = useGLTF(SHIRT_URL);

  useLayoutEffect(() => {
    scene.traverse((object) => {
      if (isRenderableMesh(object)) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}

useGLTF.preload(SHIRT_URL);

