import { useLayoutEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Object3D, SkinnedMesh } from 'three';
import morphTargets from '../../data/avatar/morphTargets.json';

export const AVATAR_URL = '/assets/avatar/avatar.glb';

function isSkinnedMesh(object: Object3D): object is SkinnedMesh {
  return (object as SkinnedMesh).isSkinnedMesh === true;
}

/**
 * The single parametric avatar. useGLTF caches the parsed GLB, so this component
 * can re-render freely without reloading or re-creating any three.js objects.
 */
export function Avatar() {
  const { scene } = useGLTF(AVATAR_URL);

  useLayoutEffect(() => {
    scene.traverse((object) => {
      if (isSkinnedMesh(object)) {
        // The bind-pose bounding sphere is stale once morph targets/bones change.
        object.frustumCulled = false;
        object.castShadow = true;
      }
    });
  }, [scene]);

  // Anny's origin is at the pelvis; lift the body so the feet rest on y = 0.
  return <primitive object={scene} position={[0, -morphTargets.baseFloorY, 0]} />;
}

useGLTF.preload(AVATAR_URL);
