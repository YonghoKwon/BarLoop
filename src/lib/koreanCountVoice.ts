export type CountVoiceMode = 'click' | 'voice' | 'both';

const KOREAN_COUNTS = [
  '하나',
  '둘',
  '셋',
  '넷',
  '다섯',
  '여섯',
  '일곱',
  '여덟',
  '아홉',
  '열',
  '열하나',
  '열둘',
] as const;

let preferredVoice: SpeechSynthesisVoice | null = null;

export function getKoreanCountLabel(beatInBar: number): string {
  const safeIndex = Math.max(0, Math.floor(beatInBar));
  return KOREAN_COUNTS[safeIndex] ?? String(safeIndex + 1);
}

export function getKoreanCountRate(bpm: number): number {
  return Math.min(2, Math.max(0.8, bpm / 95));
}

export function isKoreanCountVoiceSupported(): boolean {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function resolveKoreanVoice(): SpeechSynthesisVoice | null {
  if (!isKoreanCountVoiceSupported()) return null;
  if (preferredVoice) return preferredVoice;

  const voices = window.speechSynthesis.getVoices();
  preferredVoice =
    voices.find((voice) => voice.lang.toLowerCase() === 'ko-kr') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('ko')) ??
    null;
  return preferredVoice;
}

export function primeKoreanCountVoice(): void {
  if (!isKoreanCountVoiceSupported()) return;
  resolveKoreanVoice();
}

export function speakKoreanCount(beatInBar: number, bpm: number, volume: number): boolean {
  if (!isKoreanCountVoiceSupported()) return false;

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(getKoreanCountLabel(beatInBar));
  utterance.lang = 'ko-KR';
  utterance.rate = getKoreanCountRate(bpm);
  utterance.pitch = 1;
  utterance.volume = Math.min(1, Math.max(0.2, volume));

  const voice = resolveKoreanVoice();
  if (voice) utterance.voice = voice;

  if (synth.speaking || synth.pending) synth.cancel();
  synth.speak(utterance);
  return true;
}

export function stopKoreanCountVoice(): void {
  if (!isKoreanCountVoiceSupported()) return;
  window.speechSynthesis.cancel();
}
