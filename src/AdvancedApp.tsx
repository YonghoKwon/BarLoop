import { useEffect, useState } from 'react';
import App from './App';
import AppUtilities from './components/AppUtilities';
import PracticeCoach from './components/PracticeCoach';

export default function AdvancedApp() {
  const [landscapePractice, setLandscapePractice] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(orientation: landscape) and (max-height: 600px)');
    const update = () => setLandscapePractice(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.layout = landscapePractice ? 'landscape-practice' : 'standard';
    return () => {
      delete document.documentElement.dataset.layout;
    };
  }, [landscapePractice]);

  return (
    <>
      <App />
      <PracticeCoach />
      <AppUtilities />
    </>
  );
}
