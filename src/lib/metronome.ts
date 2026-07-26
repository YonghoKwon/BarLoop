import {
  METRONOME_AUDIO_RESUME_EVENT,
  METRONOME_AUDIO_STATE_EVENT,
  type MetronomeAudioState,
  type MetronomeSound,
} from './standaloneMetronome';

export type Subdivision = 1 | 2 | 3 | 4;
export type MediaCountMode = 'click' | 'voice' | 'both';
export type CountInClickMode = 'beat' | 'subdivision';

export interface MetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  subdivision: Subdivision;
  volume: number;
  accentVolume: number;
  subdivisionVolume: number;
  sound: MetronomeSound;
  accentSound: MetronomeSound;
  playbackRate: number;
  firstDownbeat: number;
  syncOffsetMs: number;
  clickEnabled: boolean;
  gapEnabled: boolean;
  gapPlayBars: number;
  gapMuteBars: number;
}

interface CountInSettings {
  bpm: number;
  beatsPerBar: number;
  bars: number;
  volume: number;
  accentVolume: number;
  subdivisionVolume: number;
  sound: MetronomeSound;
  accentSound: MetronomeSound;
  subdivision: Subdivision;
  clickMode: CountInClickMode;
  clickEnabled: boolean;
  onStep: (
    remainingBeats: number,
    beatInBar: number,
    subdivisionInBeat: number,
    audible: boolean,
  ) => void;
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  const scope = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? scope.webkitAudioContext ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class MetronomeEngine {
  private context: AudioContext | null = null;
  private timerId = 0;
  private countInTimers = new Set<number>();
  private positionTimers = new Set<number>();
  private scheduledSources = new Set<OscillatorNode>();
  private running = false;
  private countInActive = false;
  private nextSubdivisionIndex = 0;
  private lastMediaTime = 0;
  private getMediaTime: (() => number) | null = null;
  private settings: MetronomeSettings | null = null;
  private onPosition: ((beatInBar: number, subdivisionInBeat: number, audible: boolean) => void) | null = null;
  private lifecycleAttached = false;

  private notifyAudioState(state: MetronomeAudioState): void {
    window.dispatchEvent(
      new CustomEvent<{ state: MetronomeAudioState }>(METRONOME_AUDIO_STATE_EVENT, {
        detail: { state },
      }),
    );
  }

  private hasActiveAudio(): boolean {
    return this.running || this.countInActive;
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
    this.attachLifecycleListeners();
    this.notifyAudioState('starting');
    await this.ensureContext();
    this.notifyAudioState('running');
  }

  async start(
    getMediaTime: () => number,
    settings: MetronomeSettings,
    onPosition?: (beatInBar: number, subdivisionInBeat: number, audible: boolean) => void,
  ): Promise<void> {
    await this.ensureContext();
    this.stopContinuous();
    this.running = true;
    this.getMediaTime = getMediaTime;
    this.settings = settings;
    this.onPosition = onPosition ?? null;
    this.attachLifecycleListeners();
    this.resync();
    this.notifyAudioState('running');
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
    const adjustedMediaTime =
      mediaTime - this.settings.firstDownbeat - clamp(this.settings.syncOffsetMs, -500, 500) / 1000;
    this.nextSubdivisionIndex = Math.max(0, Math.floor(adjustedMediaTime / subdivisionDuration) + 1);
    this.lastMediaTime = mediaTime;
  }

  stopContinuous(): void {
    this.running = false;
    window.clearTimeout(this.timerId);
    this.timerId = 0;
    this.clearPositionTimers();
    this.clearScheduledSources();
  }

  stopAll(): void {
    this.stopContinuous();
    this.cancelCountIn();
    this.getMediaTime = null;
    this.settings = null;
    this.onPosition = null;
    this.detachLifecycleListeners();
    this.notifyAudioState('idle');
  }

  cancelCountIn(): void {
    this.countInTimers.forEach((timer) => window.clearTimeout(timer));
    this.countInTimers.clear();
    this.countInActive = false;
    this.clearScheduledSources();
    if (!this.running) this.notifyAudioState('idle');
  }

  async countIn(settings: CountInSettings): Promise<void> {
    this.cancelCountIn();
    this.attachLifecycleListeners();
    this.countInActive = true;
    this.notifyAudioState('starting');
    const context = await this.ensureContext();
    this.notifyAudioState('running');

    const safeSubdivision = Math.max(1, settings.subdivision);
    const totalBeats = Math.max(0, Math.round(settings.beatsPerBar * settings.bars));
    const totalSteps = totalBeats * safeSubdivision;
    if (totalSteps === 0) {
      this.countInActive = false;
      return;
    }

    const interval = 60 / clamp(settings.bpm, 20, 800) / safeSubdivision;
    const startAt = context.currentTime + 0.07;

    for (let index = 0; index < totalSteps; index += 1) {
      const subdivisionInBeat = index % safeSubdivision;
      const absoluteBeatIndex = Math.floor(index / safeSubdivision);
      const beatInBar = absoluteBeatIndex % settings.beatsPerBar;
      const clickThisStep = settings.clickMode === 'subdivision' || subdivisionInBeat === 0;

      if (settings.clickEnabled && clickThisStep) {
        this.scheduleClick(
          startAt + index * interval,
          subdivisionInBeat === 0 && beatInBar === 0,
          subdivisionInBeat !== 0,
          settings,
        );
      }

      const delay = Math.max(0, (startAt - context.currentTime + index * interval) * 1000);
      const timer = window.setTimeout(() => {
        this.countInTimers.delete(timer);
        if (!this.countInActive) return;
        const remainingSteps = totalSteps - index - 1;
        settings.onStep(
          Math.ceil(remainingSteps / safeSubdivision),
          beatInBar,
          subdivisionInBeat,
          true,
        );
      }, delay);
      this.countInTimers.add(timer);
    }

    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        this.countInTimers.delete(timer);
        resolve();
      }, Math.max(0, (startAt - context.currentTime + totalSteps * interval) * 1000));
      this.countInTimers.add(timer);
    });

    this.countInTimers.clear();
    this.countInActive = false;
    if (!this.running) this.notifyAudioState('idle');
  }

  async resumeAfterInterruption(playConfirmationClick = false): Promise<boolean> {
    if (!this.hasActiveAudio()) return false;
    try {
      const context = await this.ensureContext();
      if (this.running) {
        this.resync();
        window.clearTimeout(this.timerId);
        this.schedule();
      }
      if (playConfirmationClick) {
        this.scheduleClick(context.currentTime + 0.025, true, false, this.settings ?? { volume: .55, accentVolume: .82, subdivisionVolume: .3, sound: 'classic', accentSound: 'wood' });
      }
      this.notifyAudioState('running');
      return true;
    } catch {
      this.notifyAudioState('suspended');
      return false;
    }
  }

  async testClick(accent = false): Promise<void> {
    const context = await this.ensureContext();
    this.scheduleClick(context.currentTime + 0.025, accent, false, this.settings ?? { volume: .55, accentVolume: .82, subdivisionVolume: .3, sound: 'classic', accentSound: 'wood' });
  }

  private schedule = (): void => {
    if (!this.running || !this.context || !this.getMediaTime || !this.settings) return;

    if (this.context.state !== 'running') {
      const state = String(this.context.state) === 'interrupted' ? 'interrupted' : 'suspended';
      this.notifyAudioState(state);
      this.timerId = window.setTimeout(this.schedule, 250);
      return;
    }

    const settings = this.settings;
    const mediaTime = this.getMediaTime();
    const subdivisionDuration = 60 / settings.bpm / settings.subdivision;
    const adjustedMediaTime =
      mediaTime - settings.firstDownbeat - clamp(settings.syncOffsetMs, -500, 500) / 1000;
    const expectedIndex = Math.max(0, Math.floor(adjustedMediaTime / subdivisionDuration) + 1);

    if (
      mediaTime < this.lastMediaTime - 0.08 ||
      Math.abs(expectedIndex - this.nextSubdivisionIndex) > settings.subdivision * 2
    ) {
      this.nextSubdivisionIndex = expectedIndex;
    }
    this.lastMediaTime = mediaTime;

    const horizonMediaTime = mediaTime + 0.14 * Math.max(0.1, settings.playbackRate);
    let scheduled = 0;
    while (scheduled < 256) {
      const targetMediaTime =
        settings.firstDownbeat +
        clamp(settings.syncOffsetMs, -500, 500) / 1000 +
        this.nextSubdivisionIndex * subdivisionDuration;
      if (targetMediaTime > horizonMediaTime) break;

      const realDelay = (targetMediaTime - mediaTime) / Math.max(0.1, settings.playbackRate);
      const when = this.context.currentTime + Math.max(0.004, realDelay);
      const subdivisionInBeat = this.nextSubdivisionIndex % settings.subdivision;
      const quarterBeatIndex = Math.floor(this.nextSubdivisionIndex / settings.subdivision);
      const beatInBar =
        ((quarterBeatIndex % settings.beatsPerBar) + settings.beatsPerBar) % settings.beatsPerBar;
      const shouldSound = this.shouldSound(quarterBeatIndex, settings);

      if (shouldSound && settings.clickEnabled) {
        this.scheduleClick(
          when,
          subdivisionInBeat === 0 && beatInBar === 0,
          subdivisionInBeat !== 0,
          settings,
        );
      }
      this.schedulePosition(when, beatInBar, subdivisionInBeat, shouldSound);
      this.nextSubdivisionIndex += 1;
      scheduled += 1;
    }

    this.timerId = window.setTimeout(this.schedule, 22);
  };

  private schedulePosition(
    when: number,
    beatInBar: number,
    subdivisionInBeat: number,
    audible: boolean,
  ): void {
    const context = this.context;
    if (!context) return;
    const delay = Math.max(0, (when - context.currentTime) * 1000);
    const timer = window.setTimeout(() => {
      this.positionTimers.delete(timer);
      if (!this.running) return;
      this.onPosition?.(beatInBar, subdivisionInBeat, audible);
    }, delay);
    this.positionTimers.add(timer);
  }

  private shouldSound(quarterBeatIndex: number, settings: MetronomeSettings): boolean {
    if (!settings.gapEnabled || settings.gapMuteBars <= 0) return true;
    const barIndex = Math.floor(Math.max(0, quarterBeatIndex) / settings.beatsPerBar);
    const cycle = Math.max(1, settings.gapPlayBars + settings.gapMuteBars);
    return barIndex % cycle < settings.gapPlayBars;
  }

  private scheduleClick(
    when: number,
    accent: boolean,
    secondary: boolean,
    settings: Pick<MetronomeSettings, 'volume' | 'accentVolume' | 'subdivisionVolume' | 'sound' | 'accentSound'>,
  ): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const sound = accent ? settings.accentSound : settings.sound;
    const config: Record<MetronomeSound, { type: OscillatorType; frequency: number; decay: number }> = {
      classic: { type: 'sine', frequency: 1040, decay: .055 }, wood: { type: 'sine', frequency: 820, decay: .06 },
      rim: { type: 'square', frequency: 1160, decay: .04 }, cowbell: { type: 'triangle', frequency: 560, decay: .09 },
      digital: { type: 'square', frequency: 1480, decay: .027 }, clave: { type: 'triangle', frequency: 1780, decay: .042 },
      shaker: { type: 'sawtooth', frequency: 6200, decay: .024 }, low: { type: 'sine', frequency: 320, decay: .078 },
    };
    const profile = config[sound];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(accent ? profile.frequency * 1.18 : secondary ? profile.frequency * .72 : profile.frequency, when);
    const volume = accent ? settings.accentVolume : secondary ? settings.subdivisionVolume : settings.volume;
    const level = clamp(volume, 0, 1) * (accent ? .95 : secondary ? .45 : .72);
    const decay = secondary ? Math.min(profile.decay, .032) : profile.decay;
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level), when + .003);
    gain.gain.exponentialRampToValueAtTime(.0001, when + decay);
    oscillator.connect(gain); gain.connect(context.destination);
    this.scheduledSources.add(oscillator);
    oscillator.addEventListener('ended', () => { this.scheduledSources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); }, { once: true });
    oscillator.start(when); oscillator.stop(when + decay + .02);
  }

  private clearPositionTimers(): void {
    this.positionTimers.forEach((timer) => window.clearTimeout(timer));
    this.positionTimers.clear();
  }

  private clearScheduledSources(): void {
    this.scheduledSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // The source may already have stopped.
      }
    });
    this.scheduledSources.clear();
  }

  private handleContextStateChange = (): void => {
    const context = this.context;
    if (!context || !this.hasActiveAudio()) return;
    const state = String(context.state);
    if (state === 'running') {
      if (this.running) {
        this.resync();
        window.clearTimeout(this.timerId);
        this.schedule();
      }
      this.notifyAudioState('running');
      return;
    }
    this.notifyAudioState(
      state === 'interrupted' ? 'interrupted' : state === 'closed' ? 'closed' : 'suspended',
    );
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.hasActiveAudio()) {
      void this.resumeAfterInterruption();
    }
  };

  private handleWindowFocus = (): void => {
    if (this.hasActiveAudio()) void this.resumeAfterInterruption();
  };

  private handlePointerDown = (): void => {
    if (this.hasActiveAudio() && this.context?.state !== 'running') {
      void this.resumeAfterInterruption(true);
    }
  };

  private handleResumeRequest = (): void => {
    if (this.hasActiveAudio()) void this.resumeAfterInterruption(true);
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
}
