import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useBounds, useGLTF } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { FABRICS } from '../fabrics';
import type { ClothingProduct, SizeLabel } from '../types';
import { GarmentModel } from './GarmentModel';
import { ProceduralGarment } from './ProceduralGarment';

type ViewerMode = 'model' | 'procedural';

type ClothingViewerProps = {
  product: ClothingProduct;
  size: SizeLabel | null;
};

class SceneErrorBoundary extends Component<
  { onError: (error: Error) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Mounted only while the Suspense fallback is shown -> drives the HTML loading overlay. */
function LoadingSignal({ onChange }: { onChange: (loading: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

/** Re-frames the camera when `token` changes (reset button / new garment). */
function FitOnChange({ token }: { token: string }) {
  const bounds = useBounds();
  useEffect(() => {
    bounds.refresh().clip().fit();
  }, [bounds, token]);
  return null;
}

function modelUrl(product: ClothingProduct): string | null {
  if (!product.model) return null;
  return product.model.kind === 'project' ? product.model.url : product.model.dataUrl;
}

function zoom(controls: OrbitControlsImpl | null, factor: number) {
  if (!controls) return;
  const offset = controls.object.position.clone().sub(controls.target);
  const distance = Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length() * factor));
  controls.object.position.copy(controls.target).add(offset.setLength(distance));
  controls.update();
}

/**
 * Standalone 3D clothing viewer — the garment alone, without an avatar.
 * Shows the product's GLB when it has one; otherwise an approximate preview
 * generated from its type, measurements and photos (clearly labelled).
 */
export function ClothingViewer({ product, size }: ClothingViewerProps) {
  const url = modelUrl(product);
  const [mode, setMode] = useState<ViewerMode>(url ? 'model' : 'procedural');
  const [showPhotos, setShowPhotos] = useState(true);
  const [applyFabric, setApplyFabric] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [fitToken, setFitToken] = useState(0);
  const controls = useRef<OrbitControlsImpl>(null);

  // A different product (or a model added/removed) resets the viewer.
  useEffect(() => {
    setMode(url ? 'model' : 'procedural');
    setError(undefined);
    setLoading(false);
  }, [product.id, url]);

  const handleError = useCallback((err: Error) => {
    console.error('Clothing viewer failed to load', err);
    setLoading(false);
    setError(
      mode === 'model'
        ? 'تعذّر تحميل النموذج ثلاثي الأبعاد. قد يكون الملف تالفًا أو غير متوفر.'
        : 'تعذّر تجهيز المعاينة (قد تكون صورة القطعة تالفة).',
    );
  }, [mode]);

  const retry = () => {
    if (url) useGLTF.clear(url);
    setError(undefined);
    setAttempt((n) => n + 1);
  };

  const measurements = (size && product.measurements[size]) || {};
  const activeMode: ViewerMode = mode === 'model' && url ? 'model' : 'procedural';
  const sceneKey = `${product.id}|${activeMode}|${url ?? ''}|${attempt}`;
  const fitKey = `${sceneKey}|${size}|${fitToken}|${product.updatedAt}`;

  return (
    <div className="wd-viewer">
      <div className="wd-viewer__canvas">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          camera={{ position: [0, 0, 2.6], fov: 35, near: 0.01, far: 500 }}
        >
          <color attach="background" args={['#eef0f3']} />
          <hemisphereLight args={['#ffffff', '#b9a99a', 1.1]} />
          <directionalLight position={[2.5, 4, 3]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-3, 2, -3]} intensity={0.8} />
          <directionalLight position={[0, 1, -4]} intensity={0.5} />

          <SceneErrorBoundary key={sceneKey} onError={handleError}>
            <Suspense fallback={<LoadingSignal onChange={setLoading} />}>
              <Bounds fit clip observe margin={1.25} maxDuration={0.6}>
                <FitOnChange token={fitKey} />
                <Center>
                  {activeMode === 'model' && url ? (
                    <GarmentModel url={url} fabric={product.fabric} color={product.color} applyFabric={applyFabric} />
                  ) : (
                    <ProceduralGarment
                      type={product.type}
                      measurements={measurements}
                      fabric={product.fabric}
                      color={product.color}
                      frontImage={product.images.front}
                      backImage={product.images.back}
                      showPhotos={showPhotos}
                    />
                  )}
                </Center>
              </Bounds>
            </Suspense>
          </SceneErrorBoundary>

          <OrbitControls
            ref={controls}
            makeDefault
            enablePan={false}
            enableDamping
            autoRotate={autoRotate}
            autoRotateSpeed={1.5}
            minDistance={0.05}
            maxDistance={200}
          />
        </Canvas>

        <span className="wd-viewer__badge">
          {activeMode === 'model'
            ? 'نموذج ثلاثي الأبعاد'
            : 'معاينة تقريبية مولّدة من النوع والقياسات — ليست نموذجًا حقيقيًا'}
        </span>

        {loading && !error && (
          <div className="wd-viewer__overlay" role="status">
            <span className="wd-spinner" aria-hidden="true" />
            جارٍ تجهيز العرض ثلاثي الأبعاد…
          </div>
        )}

        {error && (
          <div className="wd-viewer__overlay wd-viewer__overlay--error" role="alert">
            <p>{error}</p>
            <div className="wd-row">
              <button type="button" className="wd-btn wd-btn--small" onClick={retry}>
                إعادة المحاولة
              </button>
              {activeMode === 'model' && (
                <button
                  type="button"
                  className="wd-btn wd-btn--small wd-btn--ghost"
                  onClick={() => {
                    setError(undefined);
                    setMode('procedural');
                  }}
                >
                  عرض المعاينة التقريبية بدلًا منه
                </button>
              )}
            </div>
          </div>
        )}

        <div className="wd-viewer__zoom">
          <button type="button" aria-label="تكبير" title="تكبير" onClick={() => zoom(controls.current, 0.8)}>
            +
          </button>
          <button type="button" aria-label="تصغير" title="تصغير" onClick={() => zoom(controls.current, 1.25)}>
            −
          </button>
          <button type="button" aria-label="إعادة ضبط الكاميرا" title="إعادة ضبط الكاميرا" onClick={() => setFitToken((n) => n + 1)}>
            ⟲
          </button>
        </div>
      </div>

      <div className="wd-viewer__controls">
        {url && (
          <div className="wd-segmented" role="group" aria-label="مصدر العرض">
            <button type="button" aria-pressed={activeMode === 'model'} onClick={() => setMode('model')}>
              النموذج
            </button>
            <button type="button" aria-pressed={activeMode === 'procedural'} onClick={() => setMode('procedural')}>
              معاينة تقريبية
            </button>
          </div>
        )}
        {activeMode === 'procedural' && (
          <label className="wd-check">
            <input type="checkbox" checked={showPhotos} onChange={(e) => setShowPhotos(e.target.checked)} />
            إسقاط الصور على المعاينة
          </label>
        )}
        {activeMode === 'model' && (
          <label className="wd-check">
            <input type="checkbox" checked={applyFabric} onChange={(e) => setApplyFabric(e.target.checked)} />
            تطبيق مظهر القماش ({FABRICS[product.fabric].label})
          </label>
        )}
        <label className="wd-check">
          <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
          دوران تلقائي
        </label>
      </div>
      <p className="wd-hint">اسحب للتدوير، واستخدم عجلة الفأرة أو إصبعين للتكبير والتصغير.</p>
    </div>
  );
}
