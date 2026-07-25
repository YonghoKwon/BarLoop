export type Subdivision = 1 | 2 | 3 | 4;

export interface MetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  subdivision: Subdivision;
  volume: number;
  playbackRate: number;
  firstDownbeat: number;
  gapEnabled: boolean;
  gapPlayBars: number;
  gapMuteBars: number;
}

interface CountInSettings {
  bpm: number;
  beatsPerBar: number;
  bars: number;
  volume: number;
  onBeat: (remainingBeats: number, beatInBar: number) => void;
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  const scope = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? scope.webkitAudioContext ?? null;
}

export class MetronomeEngine {
  private context: AudioContext | null = null;
  private timerId = 0;
  private countInTimers: number[] = [];
  private running = false;
  private nextSubdivisionIndex = 0;
  private lastMediaTime = 0;
  private getMediaTime: (() => number) | null = null;
  private settings: MetronomeSettings | null = null;
  private onBeat: ((beatInBar: number, audible: boolean) => void) | null = null;

  private async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      const Constructor = getAudioContextConstructor();
      if (!Constructor) throw new Error('이 브라우저는 Web Audio를 지원하지 않습니다.');
      this.context = new Constructor({ latencyHint: 'interactive' });
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context;
  }

  async unlock(): Promise<void> {
    await this.ensureContext();
  }

  async start(
    getMediaTime: () => number,
    settings: MetronomeSettings,
    onBeat?: (beatInBar: number, audible: boolean) => void,
  ): Promise<void> {
    await this.ensureContext();
    this.stopContinuous();
    this.running = true;
    this.getMediaTime = getMediaTime;
    this.settings = settings;
    this.onBeat = onBeat ?? null;
    this.resync();
    this.schedule();
  }

  update(settings: MetronomeSettings): void {
    this.settings = settings;
    if (this.running) this.resync();
  }

  resync(): void {
    if (!this.getMediaTime || !this.settings) return;
    const mediaTime = this.getMediaTime();
    const subdivisionDuration = 60 / this.settings.bpm / this.settings.subdivision;
    this.nextSubdivisionIndex = Math.max(
      0,
      Math.floor((mediaTime - this.settings.firstDownbeat) / subdivisionDuration) + 1,
    );
    this.lastMediaTime = mediaTime;
  }

  stopContinuous(): void {
    this.running = false;
    window.clearTimeout(this.timerId);
    this.timerId = 0;
  }

  stopAll(): void {
    this.stopContinuous();
    this.cancelCountIn();
  }

  cancelCountIn(): void {
    this.countInTimers.forEach((timer) => window.clearTimeout(timer));
    this.countInTimers = [];
  }

  async countIn(settings: CountInSettings): Promise<void> {
    this.cancelCountIn();
    const context = await this.ensureContext();
    const totalBeats = Math.max(0, Math.round(settings.beatsPerBar * settings.bars));
    if (totalBeats === 0) return;

    const interval = 60 / settings.bpm;
    const startAt = context.currentTime + 0.06;

    for (let index = 0; index < totalBeats; index += 1) {
      const beatInBar = index % settings.beatsPerBar;
      this.scheduleClick(startAt + index * interval, beatInBar === 0, settings.volume);
      const timer = window.setTimeout(
        () => settings.onBeat(totalBeats - index - 1, beatInBar),
        Math.max(0, (startAt - context.currentTime + index * interval) * 1000),
      );
      this.countInTimers.push(timer);
    }

    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, (startAt - context.currentTime + totalBeats * interval) * 1000);
      this.countInTimers.push(timer);
    });
    this.countInTimers = [];
  }

  private schedule = () => {
    if (!this.running || !this.context || !this.getMediaTime || !this.settings) return;

    const settings = this.settings;
    const mediaTime = this.getMediaTime();
    const subdivisionDuration = 60 / settings.bpm / settings.subdivision;
    const expectedIndex = Math.max(
      0,
      Math.floor((mediaTime - settings.firstDownbeat) / subdivisionDuration) + 1,
    );

    if (
      mediaTime < this.lastMediaTime - 0.08 ||
      Math.abs(expectedIndex - this.nextSubdivisionIndex) > settings.subdivision * 2
    ) {
      this.nextSubdivisionIndex = expectedIndex;
    }
    this.lastMediaTime = mediaTime;

    const horizonMediaTime = mediaTime + 0.13 * Math.max(0.1, settings.playbackRate);
    while (true) {
      const targetMediaTime =
        settings.firstDownbeat + this.nextSubdivisionIndex * subdivisionDuration;
      if (targetMediaTime > horizonMediaTime) break;

      const realDelay = (targetMediaTime - mediaTime) / Math.max(0.1, settings.playbackRate);
      const when = this.context.currentTime + Math.max(0.004, realDelay);
      const subdivisionInBeat = this.nextSubdivisionIndex % settings.subdivision;
      const quarterBeatIndex = Math.floor(this.nextSubdivisionIndex / settings.subdivision);
      const beatInBar = ((quarterBeatIndex % settings.beatsPerBar) + settings.beatsPerBar) % settings.beatsPerBar;
      const shouldSound = this.shouldSound(quarterBeatIndex, settings);

      if (shouldSound) {
        const accent = subdivisionInBeat === 0 && beatInBar === 0;
        const secondary = subdivisionInBeat !== 0;
        this.scheduleClick(when, accent, settings.volume, secondary);
      }
      if (subdivisionInBeat === 0) this.onBeat?.(beatInBar, shouldSound);
      this.nextSubdivisionIndex += 1;
    }

    this.timerId = window.setTimeout(this.schedule, 24);
  };

  private shouldSound(quarterBeatIndex: number, settings: MetronomeSettings): boolean {
    if (!settings.gapEnabled || settings.gapMuteBars <= 0) return true;
    const barIndex = Math.floor(Math.max(0, quarterBeatIndex) / settings.beatsPerBar);
    const cycle = Math.max(1, settings.gapPlayBars + settings.gapMuteBars);
    return barIndex % cycle < settings.gapPlayBars;
  }

  private scheduleClick(
    when: number,
    accent: boolean,
    volume: number,
    secondary = false,
  ): void {
    const context = this.context;
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(accent ? 1450 : secondary ? 760 : 1050, when);

    const level = Math.max(0, Math.min(1, volume)) * (accent ? 0.9 : secondary ? 0.34 : 0.58);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + (secondary ? 0.035 : 0.055));

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + 0.07);
  }
}
