import type { FitStatus } from './fitLogic';

type FitResultProps = {
  status: FitStatus;
  ease: number;
};

export function FitResult({ status, ease }: FitResultProps) {
  return (
    <div>
      <h2>Fit Result</h2>
      <p>
        Fit: <strong>{status}</strong>
      </p>
      <p>
        Ease: <strong>{ease.toFixed(1)} cm</strong>
      </p>
    </div>
  );
}
