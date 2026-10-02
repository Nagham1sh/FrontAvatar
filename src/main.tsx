import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AvatarCreator } from './pages/AvatarCreator';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AvatarCreator />
  </StrictMode>,
);
