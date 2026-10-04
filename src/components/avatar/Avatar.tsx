import { useLayoutEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Object3D, Mesh, SkinnedMesh } from 'three';

export const AVATAR_URL = '/models/avatar.glb';

function isRenderableMesh(object: Object3D): object is Mesh | SkinnedMesh {
  return (
    (object as Mesh).isMesh === true ||
    (object as SkinnedMesh).isSkinnedMesh === true
  );
}

export function Avatar() {
  const { scene } = useGLTF(AVATAR_URL);

  useLayoutEffect(() => {
    scene.traverse((object) => {
      if (isRenderableMesh(object)) {
        object.frustumCulled = false;
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}

useGLTF.preload(AVATAR_URL);