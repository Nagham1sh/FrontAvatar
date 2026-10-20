import { MEASUREMENT_LABELS } from '../../features/wardrobe/garmentCatalog';
import type { MeasurementKey } from '../../features/wardrobe/types';
import { useIncomingGarment } from './useIncomingGarment';

/**
 * Read-only summary shown in the fitting room of the garment exported from the
 * wardrobe dashboard. It only displays the received data; dressing the avatar
 * and fit evaluation stay with the fitting-room / avatar code.
 */
export function IncomingGarmentPanel() {
  const { garment, error, clear } = useIncomingGarment();
  const keys = [
    ...new Set(garment?.garment.sizes.flatMap((entry) => Object.keys(entry.measurementsCm)) ?? []),
  ] as MeasurementKey[];

  return (
    <section className="incoming-garment" dir="rtl" lang="ar" aria-label="القطعة المستلمة من لوحة الملابس">
      <h2>القطعة المستلمة من لوحة الملابس</h2>

      {error && <p role="alert">{error}</p>}

      {!garment && !error && (
        <p className="muted">
          لم تُصدَّر أي قطعة بعد. <a href="#/wardrobe">افتح لوحة الملابس</a> واضغط «تصدير إلى غرفة القياس».
        </p>
      )}

      {garment && (
        <>
          <div className="incoming-garment__head">
            <img src={garment.garment.images.front} alt="" />
            <div>
              <strong>{garment.garment.name}</strong>
              <p className="muted">
                {garment.garment.typeLabel} · {garment.garment.fabric.label}
                <br />
                {garment.garment.model ? 'يتضمن نموذجًا ثلاثي الأبعاد' : 'بدون نموذج ثلاثي الأبعاد'}
              </p>
            </div>
          </div>

          <table className="incoming-garment__table">
            <caption className="muted">قياسات القطعة (سم)</caption>
            <thead>
              <tr>
                <th scope="col">المقاس</th>
                {keys.map((key) => (
                  <th key={key} scope="col">
                    {MEASUREMENT_LABELS[key]?.label ?? key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {garment.garment.sizes.map((entry) => (
                <tr key={entry.size}>
                  <th scope="row">{entry.size}</th>
                  {keys.map((key) => (
                    <td key={key}>{entry.measurementsCm[key] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="muted">
            صُدّرت في {new Date(garment.exportedAt).toLocaleString('ar')}
          </p>
          <button type="button" onClick={() => void clear()}>
            إزالة القطعة
          </button>
        </>
      )}
    </section>
  );
}
