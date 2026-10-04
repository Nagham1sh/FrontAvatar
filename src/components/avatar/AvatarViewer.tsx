import { Suspense, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Loader, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Avatar } from './Avatar';

const CAMERA_POSITION: [number, number, number] = [0, 1.1, 3.6];
const CAMERA_TARGET: [number, number, number] = [0, 0.9, 0];

/**
 * Canvas + scene. Created once; avatar changes happen inside the scene graph,
 * never by re-mounting the Canvas.
 */
export function AvatarViewer() {
  const controls = useRef<OrbitControlsImpl>(null);

  const resetCamera = useCallback(() => {
    const c = controls.current;
    if (!c) return;

    // With damping on, leftover rotation momentum would be re-applied after the reset.
    const damping = c.enableDamping;
    c.enableDamping = false;

    c.object.position.set(...CAMERA_POSITION);
    c.target.set(...CAMERA_TARGET);
    c.update();

    c.enableDamping = damping;
  }, []);

  return (
    <div className="viewer">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{
          position: CAMERA_POSITION,
          fov: 35,
          near: 0.05,
          far: 50,
        }}
      >
        <color attach="background" args={['#eef0f3']} />

        <hemisphereLight
          args={['#ffffff', '#b9a99a', 1.1]}
        />

        <directionalLight
          position={[2.5, 4, 3]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        <directionalLight
          position={[-3, 2, -2]}
          intensity={0.6}
        />

        <Suspense fallback={null}>
          <Avatar />
        </Suspense>

        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.45}
          scale={4}
          blur={2.2}
          far={2}
        />

        <OrbitControls
          ref={controls}
          makeDefault
          target={CAMERA_TARGET}
          enablePan
          minDistance={0.6}
          maxDistance={8}
          maxPolarAngle={Math.PI * 0.95}
        />
      </Canvas>

      <Loader />

      <button
        type="button"
        className="viewer__reset"
        onClick={resetCamera}
      >
        Reset camera
      </button>
    </div>
  );
}

