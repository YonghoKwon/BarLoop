import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdvancedApp from './AdvancedApp';
import './styles.css';
import './advanced.css';
import './metronome-lab.css';
import './media-practice.css';
import './ios-responsive.css';
import './ios-overflow-fix.css';
import './full-bar-guide.css';
import './drummer-training.css';

// Keep feature styles explicit so mobile Safari loads the complete training UI.
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
