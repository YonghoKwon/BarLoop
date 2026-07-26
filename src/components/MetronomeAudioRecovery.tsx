import { useEffect, useState } from 'react';
import {
  METRONOME_AUDIO_RESUME_EVENT,
  METRONOME_AUDIO_STATE_EVENT,
  type MetronomeAudioState,
} from '../lib/standaloneMetronome';

const PROBLEM_STATES = new Set<MetronomeAudioState>([
  'suspended',
  'interrupted',
  'closed',
  'error',
]);

export default function MetronomeAudioRecovery() {
  const [state, setState] = useState<MetronomeAudioState>('idle');

  useEffect(() => {
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: MetronomeAudioState }>).detail;
      if (detail?.state) setState(detail.state);
    };
    window.addEventListener(METRONOME_AUDIO_STATE_EVENT, handleState);
    return () => window.removeEventListener(METRONOME_AUDIO_STATE_EVENT, handleState);
  }, []);

  if (!PROBLEM_STATES.has(state)) return null;

  return (
    <aside
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        zIndex: 10000,
        left: 'max(12px, env(safe-area-inset-left))',
        right: 'max(12px, env(safe-area-inset-right))',
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        maxWidth: 620,
        margin: '0 auto',
        padding: 14,
        borderRadius: 16,
        background: 'rgba(18, 22, 32, 0.97)',
        border: '1px solid rgba(255, 185, 70, 0.7)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.38)',
        color: '#fff',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 5 }}>메트로놈 소리가 일시 중단됐습니다</strong>
      <p style={{ margin: '0 0 10px', opacity: 0.82, lineHeight: 1.45 }}>
        화면 잠금, 앱 전환 또는 출력 장치 변경 후 발생할 수 있습니다. 아래 버튼을 직접 눌러
        오디오를 다시 활성화해 주세요.
      </p>
      <button
        type="button"
        className="primary-button"
        style={{ width: '100%', minHeight: 46 }}
        onClick={() => window.dispatchEvent(new Event(METRONOME_AUDIO_RESUME_EVENT))}
      >
        소리 다시 켜기 · 테스트 클릭
      </button>
    </aside>
  );
}
