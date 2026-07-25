import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdvancedApp from './AdvancedApp';
import './styles.css';
import './advanced.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdvancedApp />
  </StrictMode>,
);
