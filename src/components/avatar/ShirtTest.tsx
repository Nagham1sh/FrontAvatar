import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

const SHIRT_URL = '/models/shirt_S.glb';

function ShirtModel() {
  const { scene } = useGLTF(SHIRT_URL);

  return <primitive object={scene} />;
}

export function ShirtTest() {
  return (
    <Canvas
      camera={{
        position: [0, 1, 3],
        fov: 40,
      }}
    >
      <color attach="background" args={['#eef0f3']} />

      <ambientLight intensity={1.5} />

      <directionalLight
        position={[2, 4, 3]}
        intensity={2}
      />

      <ShirtModel />

      <OrbitControls />
    </Canvas>
  );
}

useGLTF.preload(SHIRT_URL);
