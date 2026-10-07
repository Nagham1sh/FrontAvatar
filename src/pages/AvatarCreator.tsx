import { useState } from 'react';
import { AvatarViewer } from '../components/avatar/AvatarViewer';
import { SizeSelector } from '../components/clothing/SizeSelector';
import { FitResult } from '../components/clothing/FitResult';
import { getFitStatus } from '../components/clothing/fitLogic';
import { CLOTHING_SIZES } from '../components/clothing/clothingSizes';
import type { ClothingSize } from '../components/clothing/fitLogic';

export function AvatarCreator() {
  const [selectedSize, setSelectedSize] = useState<ClothingSize>('M');

  const selectedClothing = CLOTHING_SIZES[selectedSize];

  const userChest = 96;
  const ease = selectedClothing.chestCm - userChest;
  const fitStatus = getFitStatus(userChest, selectedClothing.chestCm);

  return (
    <main className="creator">
      <aside className="creator__panel">
        <h1>Create Avatar</h1>

        <p className="muted">Choose your shirt size</p>

        <SizeSelector
          selectedSize={selectedSize}
          onSizeChange={setSelectedSize}
        />

        <p>
          Selected size: <strong>{selectedSize}</strong>
        </p>

        <p>
          Model: <strong>{selectedClothing.model}</strong>
        </p>

        <FitResult status={fitStatus} ease={ease} />
      </aside>

      <section className="creator__stage">
        <AvatarViewer garmentUrl={selectedClothing.model} showGarment={false} />
      </section>
    </main>
  );
}