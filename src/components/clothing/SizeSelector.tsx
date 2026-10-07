import type { ClothingSize } from './fitLogic';

type SizeSelectorProps = {
  selectedSize: ClothingSize;
  onSizeChange: (size: ClothingSize) => void;
};

const SIZES: ClothingSize[] = ['S', 'M', 'L', 'XL'];

export function SizeSelector({
  selectedSize,
  onSizeChange,
}: SizeSelectorProps) {
  return (
    <div>
      <h2>Choose Size</h2>

      <div>
        {SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onSizeChange(size)}
            aria-pressed={selectedSize === size}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}

