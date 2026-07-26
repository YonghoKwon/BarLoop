export type MetronomeSound = 'classic' | 'wood' | 'rim' | 'cowbell';
export type MetronomeSubdivision = 1 | 2 | 3 | 4;

export interface StandaloneMetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  subdivision: MetronomeSubdivision;
  volume: number;
  accentVolume: number;
  subdivisionVolume: number;
  swing: number;
  sound: MetronomeSound;
  accents: boolean[];
  gapEnabled: boolean;
  gapPlayBars: number;
  gapMuteBars: number;
}

export interface MetronomeTick {
  beatInBar: number;
  subdivisionInBeat: number;
  barIndex: number;
  audible: boolean;
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  const scope = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? scope.webkitAudioContext ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class StandaloneMetronomeEngine {
  private context: AudioContext | null = null;
  private timerId = 0;
  private running = false;
  private nextNoteTime = 0;
  private subdivisionIndex = 0;
  private settings: StandaloneMetronomeSettings | null = null;
  private onTick: ((tick: MetronomeTick) => void) | null = null;

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
    settings: StandaloneMetronomeSettings,
    onTick?: (tick: MetronomeTick) => void,
  ): Promise<void> {
    const context = await this.ensureContext();
    this.stop();
    this.settings = settings;
    this.onTick = onTick ?? null;
    this.running = true;
    this.subdivisionIndex = 0;
    this.nextNoteTime = context.currentTime + 0.08;
    this.scheduler();
  }

  update(settings: StandaloneMetronomeSettings): void {
    this.settings = settings;
  }

  stop(): void {
    this.running = false;
    window.clearTimeout(this.timerId);
    this.timerId = 0;
  }

  isRunning(): boolean {
    return this.running;
  }

  private scheduler = (): void => {
    const context = this.context;
    const settings = this.settings;
    if (!this.running || !context || !settings) return;

    const scheduleAhead = 0.14;
    while (this.nextNoteTime < context.currentTime + scheduleAhead) {
      this.scheduleSubdivision(this.nextNoteTime, this.subdivisionIndex, settings);
      this.nextNoteTime += this.getNextInterval(this.subdivisionIndex, settings);
      this.subdivisionIndex += 1;
    }

    this.timerId = window.setTimeout(this.scheduler, 22);
  };

  private getNextInterval(index: number, settings: StandaloneMetronomeSettings): number {
    const base = 60 / clamp(settings.bpm, 20, 400) / settings.subdivision;
    if ((settings.subdivision === 2 || settings.subdivision === 4) && settings.swing > 0.5) {
      const pairPosition = index % 2;
      return pairPosition === 0
        ? base * 2 * clamp(settings.swing, 0.5, 0.75)
        : base * 2 * (1 - clamp(settings.swing, 0.5, 0.75));
    }
    return base;
  }

  private scheduleSubdivision(
    when: number,
    index: number,
    settings: StandaloneMetronomeSettings,
  ): void {
    const subdivisionInBeat = index % settings.subdivision;
    const beatIndex = Math.floor(index / settings.subdivision);
    const beatInBar = beatIndex % settings.beatsPerBar;
    const barIndex = Math.floor(beatIndex / settings.beatsPerBar);
    const audible = this.shouldSound(barIndex, settings);
    const accented = subdivisionInBeat === 0 && Boolean(settings.accents[beatInBar]);

    if (audible) this.scheduleClick(when, accented, subdivisionInBeat !== 0, settings);

    const delay = Math.max(0, (when - (this.context?.currentTime ?? when)) * 1000);
    window.setTimeout(() => {
      if (!this.running) return;
      this.onTick?.({ beatInBar, subdivisionInBeat, barIndex, audible });
    }, delay);
  }

  private shouldSound(barIndex: number, settings: StandaloneMetronomeSettings): boolean {
    if (!settings.gapEnabled || settings.gapMuteBars <= 0) return true;
    const cycle = Math.max(1, settings.gapPlayBars + settings.gapMuteBars);
    return barIndex % cycle < settings.gapPlayBars;
  }

  private scheduleClick(
    when: number,
    accent: boolean,
    secondary: boolean,
    settings: StandaloneMetronomeSettings,
  ): void {
    const context = this.context;
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const sound = settings.sound;

    oscillator.type = sound === 'rim' ? 'square' : sound === 'cowbell' ? 'triangle' : 'sine';
    const baseFrequency =
      sound === 'wood' ? 820 : sound === 'rim' ? 1160 : sound === 'cowbell' ? 560 : 1040;
    oscillator.frequency.setValueAtTime(
      accent ? baseFrequency * 1.45 : secondary ? baseFrequency * 0.72 : baseFrequency,
      when,
    );

    const volume = accent
      ? settings.accentVolume
      : secondary
        ? settings.subdivisionVolume
        : settings.volume;
    const level = clamp(volume, 0, 1) * (accent ? 0.95 : secondary ? 0.45 : 0.72);
    const decay = sound === 'cowbell' ? 0.09 : secondary ? 0.032 : 0.055;

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + decay + 0.02);
  }
}
