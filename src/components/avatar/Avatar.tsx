import { useLayoutEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Object3D, Mesh, SkinnedMesh } from 'three';

export const AVATAR_BASE_URL =
  'http://127.0.0.1:8000/models/generated_avatar.glb';

function isRenderableMesh(object: Object3D): object is Mesh | SkinnedMesh {
  return (
    (object as Mesh).isMesh === true ||
    (object as SkinnedMesh).isSkinnedMesh === true
  );
}

type AvatarProps = {
  avatarUrl?: string;
  onLoaded?: (object: Object3D) => void;
};

export function Avatar({
  avatarUrl = AVATAR_BASE_URL,
  onLoaded,
}: AvatarProps) {
  const { scene } = useGLTF(avatarUrl);

  useLayoutEffect(() => {
    scene.traverse((object) => {
      if (isRenderableMesh(object)) {
        object.frustumCulled = false;
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    onLoaded?.(scene);
  }, [scene, onLoaded]);

  return <primitive object={scene} />;
}

useGLTF.preload(AVATAR_BASE_URL);