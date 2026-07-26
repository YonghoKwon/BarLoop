import { DRUM_INSTRUMENT_IDS, type DrumInstrument, type DrumPattern } from './drummerPractice';

export type MetronomeSound = 'classic' | 'wood' | 'rim' | 'cowbell' | 'digital' | 'clave' | 'shaker' | 'low';
export type MetronomeSubdivision = 1 | 2 | 3 | 4;
export type MetronomeAudioState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'suspended'
  | 'interrupted'
  | 'closed'
  | 'error';

export const METRONOME_AUDIO_STATE_EVENT = 'barloop-metronome-audio-state';
export const METRONOME_AUDIO_RESUME_EVENT = 'barloop-metronome-audio-resume';

export interface StandaloneMetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  subdivision: MetronomeSubdivision;
  volume: number;
  accentVolume: number;
  subdivisionVolume: number;
  swing: number;
  sound: MetronomeSound;
  accentSound?: MetronomeSound;
  accents: boolean[];
  clickEnabled?: boolean;
  clickOverlayEnabled?: boolean;
  guideSubdivision?: MetronomeSubdivision;
  gapEnabled: boolean;
  gapPlayBars: number;
  gapMuteBars: number;
  rhythmEnabled?: boolean;
  rhythmPattern?: DrumPattern;
  rhythmVolume?: number;
  movingAccentStep?: number | null;
}

export interface MetronomeTick {
  beatInBar: number;
  subdivisionInBeat: number;
  barIndex: number;
  stepInBar: number;
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

export function shouldResynchronize(nextNoteTime: number, currentTime: number): boolean {
  return nextNoteTime < currentTime - 0.18 || nextNoteTime > currentTime + 1;
}

export function isBarAudible(
  barIndex: number,
  gapEnabled: boolean,
  gapPlayBars: number,
  gapMuteBars: number,
): boolean {
  if (!gapEnabled || gapMuteBars <= 0) return true;
  const cycle = Math.max(1, gapPlayBars + gapMuteBars);
  return barIndex % cycle < gapPlayBars;
}

export class StandaloneMetronomeEngine {
  private context: AudioContext | null = null;
  private timerId = 0;
  private running = false;
  private nextNoteTime = 0;
  private subdivisionIndex = 0;
  private settings: StandaloneMetronomeSettings | null = null;
  private onTick: ((tick: MetronomeTick) => void) | null = null;
  private onAudioState: ((state: MetronomeAudioState) => void) | null = null;
  private onGuideTick: ((beatInBar: number, subdivisionInBeat: number, subdivision: MetronomeSubdivision) => void) | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private lifecycleAttached = false;
  private tickTimers = new Set<number>();
  private scheduledSources = new Set<OscillatorNode>();

  private notifyAudioState(state: MetronomeAudioState): void {
    this.onAudioState?.(state);
    window.dispatchEvent(
      new CustomEvent<{ state: MetronomeAudioState }>(METRONOME_AUDIO_STATE_EVENT, {
        detail: { state },
      }),
    );
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.context || this.context.state === 'closed') {
      const Constructor = getAudioContextConstructor();
      if (!Constructor) throw new Error('이 브라우저는 Web Audio를 지원하지 않습니다.');
      this.context = new Constructor({ latencyHint: 'interactive' });
      this.context.addEventListener('statechange', this.handleContextStateChange);
    }

    if (this.context.state !== 'running') await this.context.resume();
    if (this.context.state !== 'running') {
      throw new Error('브라우저가 오디오를 일시 중단했습니다. 화면을 탭해 소리를 다시 켜 주세요.');
    }
    return this.context;
  }

  async unlock(): Promise<void> {
    await this.ensureContext();
  }

  async start(
    settings: StandaloneMetronomeSettings,
    onTick?: (tick: MetronomeTick) => void,
    onAudioState?: (state: MetronomeAudioState) => void,
    onGuideTick?: (beatInBar: number, subdivisionInBeat: number, subdivision: MetronomeSubdivision) => void,
  ): Promise<void> {
    this.stop();
    this.settings = settings;
    this.onTick = onTick ?? null;
    this.onAudioState = onAudioState ?? null;
    this.onGuideTick = onGuideTick ?? null;
    this.attachLifecycleListeners();
    this.notifyAudioState('starting');

    try {
      const context = await this.ensureContext();
      this.running = true;
      this.subdivisionIndex = 0;
      this.nextNoteTime = context.currentTime + 0.08;
      this.notifyAudioState('running');
      void this.requestWakeLock();
      this.scheduler();
    } catch (error) {
      this.notifyAudioState('error');
      this.detachLifecycleListeners();
      throw error;
    }
  }

  update(settings: StandaloneMetronomeSettings): void {
    this.settings = settings;
  }

  stop(): void {
    this.running = false;
    window.clearTimeout(this.timerId);
    this.timerId = 0;
    this.tickTimers.forEach((timer) => window.clearTimeout(timer));
    this.tickTimers.clear();
    this.scheduledSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // The source may already have stopped.
      }
    });
    this.scheduledSources.clear();
    this.detachLifecycleListeners();
    void this.releaseWakeLock();
    this.notifyAudioState('idle');
    this.onTick = null;
    this.onAudioState = null;
    this.onGuideTick = null;
  }

  isRunning(): boolean {
    return this.running;
  }

  async resumeAfterInterruption(playConfirmationClick = false): Promise<boolean> {
    if (!this.running || !this.settings) return false;

    try {
      const context = await this.ensureContext();
      this.resynchronize(context);
      window.clearTimeout(this.timerId);
      this.scheduler();
      await this.requestWakeLock();
      if (playConfirmationClick) {
        this.scheduleClick(context.currentTime + 0.025, true, false, this.settings);
      }
      this.notifyAudioState('running');
      return true;
    } catch {
      this.notifyAudioState('suspended');
      return false;
    }
  }

  private resynchronize(context: AudioContext): void {
    this.nextNoteTime = context.currentTime + 0.06;
  }

  private scheduler = (): void => {
    const context = this.context;
    const settings = this.settings;
    if (!this.running || !context || !settings) return;

    if (context.state !== 'running') {
      const state = String(context.state) === 'interrupted' ? 'interrupted' : 'suspended';
      this.notifyAudioState(state);
      this.timerId = window.setTimeout(this.scheduler, 250);
      return;
    }

    if (shouldResynchronize(this.nextNoteTime, context.currentTime)) {
      this.resynchronize(context);
    }

    const scheduleAhead = 0.14;
    let scheduled = 0;
    while (this.nextNoteTime < context.currentTime + scheduleAhead && scheduled < 256) {
      this.scheduleSubdivision(this.nextNoteTime, this.subdivisionIndex, settings);
      this.nextNoteTime += this.getNextInterval(this.subdivisionIndex, settings);
      this.subdivisionIndex += 1;
      scheduled += 1;
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
    const audible = isBarAudible(
      barIndex,
      settings.gapEnabled,
      settings.gapPlayBars,
      settings.gapMuteBars,
    );
    const stepInBar = beatInBar * 4 + (settings.subdivision === 4
      ? subdivisionInBeat
      : Math.min(3, Math.floor(subdivisionInBeat * 4 / settings.subdivision)));
    const movingAccent = settings.movingAccentStep === stepInBar;
    const accented = (subdivisionInBeat === 0 && Boolean(settings.accents[beatInBar])) || movingAccent;

    if (audible) {
      if (settings.rhythmEnabled && settings.rhythmPattern && settings.subdivision === 4) {
        const sounded = this.scheduleDrumPatternStep(when, stepInBar, movingAccent, settings);
        if (settings.clickOverlayEnabled) this.scheduleGuideOverlay(when, beatInBar, subdivisionInBeat, settings);
        if (movingAccent && !sounded && !settings.clickOverlayEnabled) this.scheduleClick(when, true, true, settings);
      } else if (settings.clickEnabled !== false) {
        if (settings.guideSubdivision) this.scheduleGuideOverlay(when, beatInBar, subdivisionInBeat, settings);
        else this.scheduleClick(when, accented, subdivisionInBeat !== 0, settings);
      }
    }

    const delay = Math.max(0, (when - (this.context?.currentTime ?? when)) * 1000);
    const timer = window.setTimeout(() => {
      this.tickTimers.delete(timer);
      if (!this.running) return;
      this.onTick?.({ beatInBar, subdivisionInBeat, barIndex, stepInBar, audible });
    }, delay);
    this.tickTimers.add(timer);
  }

  private scheduleGuideOverlay(when: number, beatInBar: number, sixteenthStep: number, settings: StandaloneMetronomeSettings): void {
    const guide = settings.guideSubdivision ?? 1;
    const accentBeat = Boolean(settings.accents[beatInBar]);
    if (guide === 3) {
      if (sixteenthStep !== 0) return;
      const beatDuration = 60 / clamp(settings.bpm, 20, 400);
      for (let index = 0; index < 3; index += 1) {
        const at = when + index * beatDuration / 3;
        this.scheduleClick(at, index === 0 && accentBeat, index > 0, settings);
        this.scheduleGuideTick(at, beatInBar, index, guide);
      }
      return;
    }
    const shouldClick = guide === 1 ? sixteenthStep === 0 : guide === 2 ? sixteenthStep % 2 === 0 : true;
    if (!shouldClick) return;
    const guideStep = guide === 1 ? 0 : guide === 2 ? Math.floor(sixteenthStep / 2) : sixteenthStep;
    this.scheduleClick(when, guideStep === 0 && accentBeat, guideStep > 0, settings);
    this.scheduleGuideTick(when, beatInBar, guideStep, guide);
  }

  private scheduleGuideTick(when: number, beatInBar: number, subdivisionInBeat: number, subdivision: MetronomeSubdivision): void {
    const delay = Math.max(0, (when - (this.context?.currentTime ?? when)) * 1000);
    const timer = window.setTimeout(() => {
      this.tickTimers.delete(timer);
      if (this.running) this.onGuideTick?.(beatInBar, subdivisionInBeat, subdivision);
    }, delay);
    this.tickTimers.add(timer);
  }

  private scheduleDrumPatternStep(
    when: number,
    stepInBar: number,
    movingAccent: boolean,
    settings: StandaloneMetronomeSettings,
  ): boolean {
    const pattern = settings.rhythmPattern;
    if (!pattern) return false;
    const instruments: DrumInstrument[] = DRUM_INSTRUMENT_IDS;
    let sounded = false;
    instruments.forEach((instrument) => {
      const level = pattern.steps[instrument]?.[stepInBar] ?? 0;
      if (level === 0) return;
      sounded = true;
      this.scheduleDrumVoice(when, instrument, level === 2 || movingAccent, settings.rhythmVolume ?? settings.volume);
    });
    return sounded;
  }

  private scheduleDrumVoice(
    when: number,
    instrument: DrumInstrument,
    accent: boolean,
    volume: number,
  ): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const level = clamp(volume, 0, 1) * (accent ? 0.9 : 0.58);
    const decayByInstrument: Record<DrumInstrument, number> = {
      crash: 0.18,
      ride: 0.13,
      hihat: 0.035,
      rackTom: 0.12,
      midTom: 0.14,
      floorTom: 0.16,
      snare: 0.07,
      kick: 0.11,
    };
    const decay = decayByInstrument[instrument];

    oscillator.type = instrument === 'hihat' || instrument === 'crash'
      ? 'square'
      : instrument === 'ride' || instrument === 'snare'
        ? 'triangle'
        : 'sine';
    if (instrument === 'kick') {
      oscillator.frequency.setValueAtTime(accent ? 175 : 138, when);
      oscillator.frequency.exponentialRampToValueAtTime(46, when + decay);
    } else if (instrument === 'floorTom') {
      oscillator.frequency.setValueAtTime(accent ? 155 : 132, when);
      oscillator.frequency.exponentialRampToValueAtTime(72, when + decay);
    } else if (instrument === 'midTom') {
      oscillator.frequency.setValueAtTime(accent ? 195 : 170, when);
      oscillator.frequency.exponentialRampToValueAtTime(92, when + decay);
    } else if (instrument === 'rackTom') {
      oscillator.frequency.setValueAtTime(accent ? 265 : 230, when);
      oscillator.frequency.exponentialRampToValueAtTime(138, when + decay);
    } else if (instrument === 'snare') {
      oscillator.frequency.setValueAtTime(accent ? 255 : 205, when);
    } else if (instrument === 'ride') {
      oscillator.frequency.setValueAtTime(accent ? 2350 : 1900, when);
    } else if (instrument === 'crash') {
      oscillator.frequency.setValueAtTime(accent ? 4100 : 3350, when);
    } else {
      oscillator.frequency.setValueAtTime(accent ? 7600 : 6100, when);
    }

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this.scheduledSources.add(oscillator);
    oscillator.addEventListener('ended', () => {
      this.scheduledSources.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
    oscillator.start(when);
    oscillator.stop(when + decay + 0.02);
  }

  private scheduleClick(
    when: number,
    accent: boolean,
    secondary: boolean,
    settings: StandaloneMetronomeSettings,
  ): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const sound = accent ? settings.accentSound ?? settings.sound : settings.sound;

    const soundConfig: Record<MetronomeSound, { type: OscillatorType; frequency: number; decay: number }> = {
      classic: { type: 'sine', frequency: 1040, decay: 0.055 },
      wood: { type: 'sine', frequency: 820, decay: 0.06 },
      rim: { type: 'square', frequency: 1160, decay: 0.04 },
      cowbell: { type: 'triangle', frequency: 560, decay: 0.09 },
      digital: { type: 'square', frequency: 1480, decay: 0.027 },
      clave: { type: 'triangle', frequency: 1780, decay: 0.042 },
      shaker: { type: 'sawtooth', frequency: 6200, decay: 0.024 },
      low: { type: 'sine', frequency: 320, decay: 0.078 },
    };
    const config = soundConfig[sound];
    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(
      accent ? config.frequency * 1.45 : secondary ? config.frequency * 0.72 : config.frequency,
      when,
    );

    const volume = accent
      ? settings.accentVolume
      : secondary
        ? settings.subdivisionVolume
        : settings.volume;
    const level = clamp(volume, 0, 1) * (accent ? 0.95 : secondary ? 0.45 : 0.72);
    const decay = secondary ? Math.min(config.decay, 0.032) : config.decay;

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);

    oscillator.connect(gain);
    gain.connect(context.destination);
    this.scheduledSources.add(oscillator);
    oscillator.addEventListener(
      'ended',
      () => {
        this.scheduledSources.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      },
      { once: true },
    );
    oscillator.start(when);
    oscillator.stop(when + decay + 0.02);
  }

  private handleContextStateChange = (): void => {
    const context = this.context;
    if (!context || !this.running) return;
    const state = String(context.state);
    if (state === 'running') {
      this.resynchronize(context);
      window.clearTimeout(this.timerId);
      this.scheduler();
      this.notifyAudioState('running');
      return;
    }
    this.notifyAudioState(state === 'interrupted' ? 'interrupted' : state === 'closed' ? 'closed' : 'suspended');
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.running) {
      void this.resumeAfterInterruption();
    }
  };

  private handleWindowFocus = (): void => {
    if (this.running) void this.resumeAfterInterruption();
  };

  private handlePointerDown = (): void => {
    if (this.running && this.context?.state !== 'running') {
      void this.resumeAfterInterruption(true);
    }
  };

  private handleResumeRequest = (): void => {
    if (this.running) void this.resumeAfterInterruption(true);
  };

  private attachLifecycleListeners(): void {
    if (this.lifecycleAttached) return;
    this.lifecycleAttached = true;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('focus', this.handleWindowFocus);
    window.addEventListener('pageshow', this.handleWindowFocus);
    window.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
    window.addEventListener(METRONOME_AUDIO_RESUME_EVENT, this.handleResumeRequest);
  }

  private detachLifecycleListeners(): void {
    if (!this.lifecycleAttached) return;
    this.lifecycleAttached = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('pageshow', this.handleWindowFocus);
    window.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener(METRONOME_AUDIO_RESUME_EVENT, this.handleResumeRequest);
  }

  private async requestWakeLock(): Promise<void> {
    if (document.visibilityState !== 'visible' || this.wakeLock || !('wakeLock' in navigator)) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      this.wakeLock = lock;
      lock.addEventListener(
        'release',
        () => {
          if (this.wakeLock === lock) this.wakeLock = null;
          if (this.running && document.visibilityState === 'visible') {
            window.setTimeout(() => void this.requestWakeLock(), 250);
          }
        },
        { once: true },
      );
    } catch {
      this.wakeLock = null;
    }
  }

  private async releaseWakeLock(): Promise<void> {
    const lock = this.wakeLock;
    this.wakeLock = null;
    if (!lock) return;
    try {
      await lock.release();
    } catch {
      // The browser may already have released it while the page was hidden.
    }
  }
}
