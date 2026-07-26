import { useEffect, useState } from 'react';
import App from './App';
import AppUtilities from './components/AppUtilities';
import MetronomeAudioRecovery from './components/MetronomeAudioRecovery';
import PracticeCoach from './components/PracticeCoach';
import MetronomeLabPage from './pages/MetronomeLabPage';

function readRoute(): 'practice' | 'metronome' {
  return window.location.hash.replace(/^#\/?/, '') === 'metronome' ? 'metronome' : 'practice';
}

export default function AdvancedApp() {
  const [landscapePractice, setLandscapePractice] = useState(false);
  const [route, setRoute] = useState(readRoute);

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
        <MetronomeLabPage />
        <MetronomeAudioRecovery />
      </>
    );
  }

  return (
    <>
      <App />
      <button type="button" className="mode-launcher" onClick={() => { window.location.hash = 'metronome'; }}>
        메트로놈 전용 연습
      </button>
      <PracticeCoach />
      <AppUtilities />
      <MetronomeAudioRecovery />
    </>
  );
}
