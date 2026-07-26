type WebAudioSessionType = 'auto' | 'playback';

type NavigatorWithAudioSession = {
  audioSession?: {
    type: WebAudioSessionType;
  };
};

let playbackAnchor: HTMLAudioElement | null = null;
let silentWavUrl = '';

export function buildNearSilentWavBytes(sampleRate = 8000, durationSeconds = 1): Uint8Array {
  const sampleCount = Math.max(1, Math.round(sampleRate * durationSeconds));
  const bytesPerSample = 2;
  const dataLength = sampleCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataLength, true);

  for (let index = 0; index < sampleCount; index += 1) {
    view.setInt16(44 + index * bytesPerSample, index % 2 === 0 ? 1 : -1, true);
  }

  return new Uint8Array(buffer);
}

function bytesToDataUrl(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function setAudioSessionType(type: WebAudioSessionType): boolean {
  try {
    const audioSession = (navigator as unknown as NavigatorWithAudioSession).audioSession;
    if (!audioSession) return false;
    audioSession.type = type;
    return true;
  } catch {
    return false;
  }
}

function getPlaybackAnchor(): HTMLAudioElement {
  if (playbackAnchor) return playbackAnchor;

  const audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.loop = true;
  audio.muted = false;
  audio.volume = 0.01;
  audio.setAttribute('playsinline', '');
  audio.setAttribute('aria-hidden', 'true');
  audio.style.display = 'none';

  if (!silentWavUrl) silentWavUrl = bytesToDataUrl(buildNearSilentWavBytes());
  audio.src = silentWavUrl;
  document.body.appendChild(audio);
  playbackAnchor = audio;
  return audio;
}

export async function preparePlaybackAudioSession(): Promise<boolean> {
  setAudioSessionType('playback');

  try {
    const audio = getPlaybackAnchor();
    if (audio.paused) await audio.play();
    return true;
  } catch {
    return false;
  }
}

export function releasePlaybackAudioSession(): void {
  if (playbackAnchor) {
    playbackAnchor.pause();
    try {
      playbackAnchor.currentTime = 0;
    } catch {
      // Some Safari versions reject seeking before metadata is ready.
    }
  }
  setAudioSessionType('auto');
}
