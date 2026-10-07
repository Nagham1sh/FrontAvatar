import { useGLTF } from '@react-three/drei';

type GarmentProps = {
  url: string;
  visible?: boolean;
  enabled?: boolean;
};

export function Garment({
  url,
  visible = true,
  enabled = false,
}: GarmentProps) {
  if (!enabled) {
    return null;
  }

  const { scene } = useGLTF(url);

  return (
    <primitive
      object={scene}
      visible={visible}
    />
  );
}
