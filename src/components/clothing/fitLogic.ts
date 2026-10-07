export type ClothingSize = 'S' | 'M' | 'L' | 'XL';

export type FitStatus = 'Too Small' | 'Snug' | 'Regular' | 'Oversized';

export function getFitStatus(
  userChest: number,
  garmentChest: number,
): FitStatus {
  const ease = garmentChest - userChest;

  if (ease < 0) return 'Too Small';
  if (ease <= 4) return 'Snug';
  if (ease <= 12) return 'Regular';
  return 'Oversized';
}
