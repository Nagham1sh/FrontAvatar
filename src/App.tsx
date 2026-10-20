import { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AvatarCreator } from './pages/AvatarCreator';
import { WardrobeDashboard } from './features/wardrobe/WardrobeDashboard';
import './App.css';

type Route = 'wardrobe' | 'fitting-room';

function readRoute(): Route {
  return window.location.hash.startsWith('#/wardrobe') ? 'wardrobe' : 'fitting-room';
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="app">
      <nav className="app-nav" dir="rtl" aria-label="التنقل الرئيسي">
        <span className="app-nav__brand">منصة تجربة الملابس الافتراضية</span>
        <a href="#/wardrobe" aria-current={route === 'wardrobe' ? 'page' : undefined}>
          لوحة الملابس
        </a>
        <a href="#/fitting-room" aria-current={route === 'fitting-room' ? 'page' : undefined}>
          غرفة القياس
        </a>
      </nav>
      <div className="app__page">
        <ErrorBoundary key={route} title="تعذّر عرض هذه الصفحة">
          {route === 'wardrobe' ? <WardrobeDashboard /> : <AvatarCreator />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
