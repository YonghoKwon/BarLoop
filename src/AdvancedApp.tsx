import { useEffect, useState } from 'react';
import App from './App';
import AppUtilities from './components/AppUtilities';
import MetronomeAudioRecovery from './components/MetronomeAudioRecovery';
import PracticeCoach from './components/PracticeCoach';
import DrummerTrainingPage from './pages/DrummerTrainingPage';
import MetronomePage from './pages/MetronomePage';

type AppRoute = 'practice' | 'metronome' | 'drummer-training';

function readRoute(): AppRoute {
  const route = window.location.hash.replace(/^#\/?/, '');
  if (route === 'metronome') return 'metronome';
  if (route === 'drummer-training' || route === 'training') return 'drummer-training';
  return 'practice';
}

export default function AdvancedApp() {
  const [landscapePractice, setLandscapePractice] = useState(false);
  const [route, setRoute] = useState<AppRoute>(readRoute);

  useEffect(() => {
    const handleHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(orientation: landscape) and (max-height: 600px)');
    const update = () => setLandscapePractice(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.layout = landscapePractice ? 'landscape-practice' : 'standard';
    document.documentElement.dataset.route = route;
    return () => {
      delete document.documentElement.dataset.layout;
      delete document.documentElement.dataset.route;
    };
  }, [landscapePractice, route]);

  if (route === 'metronome') {
    return (
      <>
        <MetronomePage />
        <MetronomeAudioRecovery />
      </>
    );
  }

  if (route === 'drummer-training') {
    return (
      <>
        <DrummerTrainingPage />
        <MetronomeAudioRecovery />
      </>
    );
  }

  return (
    <>
      <App />
      <nav className="mode-launcher-group" aria-label="독립 연습 페이지">
        <button type="button" className="mode-launcher" onClick={() => { window.location.hash = 'metronome'; }}>
          메트로놈
        </button>
        <button type="button" className="mode-launcher training" onClick={() => { window.location.hash = 'drummer-training'; }}>
          드럼 트레이닝
        </button>
      </nav>
      <PracticeCoach />
      <AppUtilities />
      <MetronomeAudioRecovery />
    </>
  );
}
