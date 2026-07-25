import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function downloadJson(value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `barloop-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function AppUtilities() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState('저장됨');
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onStorage = () => {
      setSaved('저장 중…');
      window.setTimeout(() => setSaved('저장됨'), 450);
    };
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) {
      original.apply(this, args);
      window.dispatchEvent(new Event('barloop-storage-change'));
    };
    window.addEventListener('barloop-storage-change', onStorage);
    return () => {
      Storage.prototype.setItem = original;
      window.removeEventListener('barloop-storage-change', onStorage);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const diagnostics = useMemo(() => ({
    browser: navigator.userAgent,
    webAudio: Boolean(window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext),
    wakeLock: 'wakeLock' in navigator,
    fullscreen: Boolean(document.documentElement.requestFullscreen),
    midi: 'requestMIDIAccess' in navigator,
    serviceWorker: 'serviceWorker' in navigator,
    storage: (() => {
      try {
        localStorage.setItem('barloop:diagnostic', '1');
        localStorage.removeItem('barloop:diagnostic');
        return true;
      } catch {
        return false;
      }
    })(),
  }), []);

  const exportAll = () => {
    const data: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('barloop:')) data[key] = localStorage.getItem(key) || '';
    }
    downloadJson({ version: 1, exportedAt: new Date().toISOString(), data });
  };

  const importAll = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { data?: Record<string, string> };
      if (!parsed.data || typeof parsed.data !== 'object') throw new Error();
      Object.entries(parsed.data).forEach(([key, value]) => {
        if (key.startsWith('barloop:') && typeof value === 'string') localStorage.setItem(key, value);
      });
      setSaved('복원 완료 · 새로고침 필요');
    } catch {
      setSaved('복원 실패 · 올바른 백업 파일을 선택하세요');
    }
  };

  return (
    <div className="app-utilities">
      <button type="button" className="utility-fab" onClick={() => setOpen((value) => !value)}>{saved}</button>
      {open && (
        <section className="utility-sheet">
          <header><div><span className="eyebrow">APP & DATA</span><h2>백업과 기기 진단</h2></div><button type="button" onClick={() => setOpen(false)}>닫기</button></header>
          <div className="utility-actions">
            <button type="button" onClick={exportAll}>전체 백업 내보내기</button>
            <button type="button" onClick={() => importRef.current?.click()}>백업 복원</button>
            <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={importAll} />
            {installPrompt && <button type="button" className="primary-button" onClick={async () => { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }}>홈 화면에 설치</button>}
            {saved.includes('복원 완료') && <button type="button" onClick={() => location.reload()}>지금 새로고침</button>}
          </div>
          <p className="utility-note">백업에는 미디어 파일이 포함되지 않으며, BarLoop 설정·구간·연습 기록만 저장됩니다.</p>
          <div className="diagnostic-grid">
            <div><span>Web Audio</span><strong>{diagnostics.webAudio ? '지원' : '미지원'}</strong></div>
            <div><span>화면 꺼짐 방지</span><strong>{diagnostics.wakeLock ? '지원' : '미지원'}</strong></div>
            <div><span>전체 화면</span><strong>{diagnostics.fullscreen ? '지원' : '제한적'}</strong></div>
            <div><span>Web MIDI</span><strong>{diagnostics.midi ? '지원' : '미지원'}</strong></div>
            <div><span>오프라인 앱</span><strong>{diagnostics.serviceWorker ? '지원' : '미지원'}</strong></div>
            <div><span>로컬 저장</span><strong>{diagnostics.storage ? '정상' : '사용 불가'}</strong></div>
          </div>
          <details><summary>브라우저 정보</summary><code className="browser-info">{diagnostics.browser}</code></details>
        </section>
      )}
    </div>
  );
}
