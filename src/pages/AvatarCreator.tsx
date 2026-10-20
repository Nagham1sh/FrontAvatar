import { useEffect, useState } from 'react';
import { AvatarViewer } from '../components/avatar/AvatarViewer';
import { SizeSelector } from '../components/clothing/SizeSelector';
import { FitResult } from '../components/clothing/FitResult';
import { CLOTHING_SIZES } from '../components/clothing/clothingSizes';
import { getFitStatus } from '../components/clothing/fitLogic';
import type { ClothingSize } from '../components/clothing/fitLogic';
import { IncomingGarmentPanel } from '../integration/fittingRoom/IncomingGarmentPanel';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

const API_URL = 'http://127.0.0.1:8000';

type Gender = 'female' | 'male';

type AvatarMeasurements = {
  height: number;
  weight: number;
  waist: number;
  chest: number;
  hip: number;
};

type GeneratedMeasurements = {
  height_m?: number;
  mass_kg?: number;
  bmi?: number;
  waist_m?: number;
  chest_m?: number;
  hip_m?: number;
};

type GenerateResponse = {
  message: string;
  avatar_url: string;
  parameters: {
    height: number;
    weight: number;
    age: number;
    muscle: number;
    proportions: number;
  };
  measurements: GeneratedMeasurements;
};

const DEFAULT_VALUES: AvatarMeasurements = {
  height: 162.62,
  weight: 49.99,
  waist: 71.8,
  chest: 86.6,
  hip: 92.15,
};

const SAVED_MEASUREMENTS_KEY = 'avatar_measurements';
const SAVED_GENDER_KEY = 'avatar_gender';

export function AvatarCreator() {
  const [gender, setGender] = useState<Gender>(() => {
    const savedGender = localStorage.getItem(SAVED_GENDER_KEY);

    return savedGender === 'male' || savedGender === 'female'
      ? savedGender
      : 'female';
  });

  const [measurements, setMeasurements] =
    useState<AvatarMeasurements>(() => {
      const savedMeasurements =
        localStorage.getItem(SAVED_MEASUREMENTS_KEY);

      if (savedMeasurements) {
        try {
          return JSON.parse(savedMeasurements);
        } catch {
          return DEFAULT_VALUES;
        }
      }

      return DEFAULT_VALUES;
    });

  const [avatarUrl, setAvatarUrl] = useState<string>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<GeneratedMeasurements>();

  const [selectedSize, setSelectedSize] =
    useState<ClothingSize>('M');

  const selectedClothing = CLOTHING_SIZES[selectedSize];

  const ease =
    selectedClothing.chestCm - measurements.chest;

  const fitStatus = getFitStatus(
    measurements.chest,
    selectedClothing.chestCm,
  );

  useEffect(() => {
    localStorage.setItem(
      SAVED_MEASUREMENTS_KEY,
      JSON.stringify(measurements),
    );
  }, [measurements]);

  useEffect(() => {
    localStorage.setItem(SAVED_GENDER_KEY, gender);
  }, [gender]);

  function updateMeasurement(
    field: keyof AvatarMeasurements,
    value: string,
  ) {
    setMeasurements((current) => ({
      ...current,
      [field]: Number(value),
    }));
  }

  async function generateAvatar() {
    setLoading(true);
    setError(undefined);
    setResult(undefined);

    try {
      const response = await fetch(`${API_URL}/generate-avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gender,
          height: measurements.height,
          weight: measurements.weight,
          waist: measurements.waist,
          chest: measurements.chest,
          hip: measurements.hip,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Avatar generation failed (${response.status})`,
        );
      }

      const data: GenerateResponse = await response.json();

      const newAvatarUrl =
        `${API_URL}${data.avatar_url}?t=${Date.now()}`;

      setAvatarUrl(newAvatarUrl);
      setResult(data.measurements);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while generating the avatar.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="creator">
      <aside className="creator__panel">
        <h1>Create Avatar</h1>

        <p className="muted">
          Enter your body measurements to generate a personalized avatar.
        </p>

        <label>
          Gender
          <select
            value={gender}
            onChange={(event) =>
              setGender(event.target.value as Gender)
            }
            disabled={loading}
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>

        <label>
          Height (cm)
          <input
            type="number"
            step="0.01"
            value={measurements.height}
            onChange={(event) =>
              updateMeasurement('height', event.target.value)
            }
            disabled={loading}
          />
        </label>

        <label>
          Weight (kg)
          <input
            type="number"
            step="0.01"
            value={measurements.weight}
            onChange={(event) =>
              updateMeasurement('weight', event.target.value)
            }
            disabled={loading}
          />
        </label>

        <label>
          Waist (cm)
          <input
            type="number"
            step="0.01"
            value={measurements.waist}
            onChange={(event) =>
              updateMeasurement('waist', event.target.value)
            }
            disabled={loading}
          />
        </label>

        <label>
          Chest (cm)
          <input
            type="number"
            step="0.01"
            value={measurements.chest}
            onChange={(event) =>
              updateMeasurement('chest', event.target.value)
            }
            disabled={loading}
          />
        </label>

        <label>
          Hip (cm)
          <input
            type="number"
            step="0.01"
            value={measurements.hip}
            onChange={(event) =>
              updateMeasurement('hip', event.target.value)
            }
            disabled={loading}
          />
        </label>

        <button
          type="button"
          onClick={generateAvatar}
          disabled={loading}
        >
          {loading ? 'Generating avatar...' : 'Generate Avatar'}
        </button>

        {loading && (
          <p className="muted">
            This may take about 1–2 minutes.
          </p>
        )}

        {error && (
          <p role="alert">
            {error}
          </p>
        )}

        {result && (
          <section>
            <h2>Generated Measurements</h2>

            <p>
              Height:{' '}
              {result.height_m !== undefined
                ? `${(result.height_m * 100).toFixed(2)} cm`
                : '-'}
            </p>

            <p>
              Weight:{' '}
              {result.mass_kg !== undefined
                ? `${result.mass_kg.toFixed(2)} kg`
                : '-'}
            </p>

            <p>
              Waist:{' '}
              {result.waist_m !== undefined
                ? `${(result.waist_m * 100).toFixed(2)} cm`
                : '-'}
            </p>

            <p>
              Chest:{' '}
              {result.chest_m !== undefined
                ? `${(result.chest_m * 100).toFixed(2)} cm`
                : '-'}
            </p>

            <p>
              Hip:{' '}
              {result.hip_m !== undefined
                ? `${(result.hip_m * 100).toFixed(2)} cm`
                : '-'}
            </p>
          </section>
        )}

        <section>
          <SizeSelector
            selectedSize={selectedSize}
            onSizeChange={setSelectedSize}
          />

          <p>
            Selected size:{' '}
            <strong>{selectedSize}</strong>
          </p>

          <FitResult
            status={fitStatus}
            ease={ease}
          />
        </section>

        <IncomingGarmentPanel />
      </aside>

      <section className="creator__stage">
        <ErrorBoundary key={avatarUrl} title="تعذّر تحميل الأفاتار">
          <AvatarViewer
            avatarUrl={avatarUrl}
            size={selectedSize}
          />
        </ErrorBoundary>
      </section>
    </main>
  );
}