export type DrumInstrument = 'hihat' | 'snare' | 'kick';
export type DrumStepLevel = 0 | 1 | 2;

export interface DrumPattern {
  id: string;
  name: string;
  description: string;
  swing: number;
  steps: Record<DrumInstrument, DrumStepLevel[]>;
}

export interface PracticeRoutineStep {
  id: string;
  name: string;
  bpm: number;
  bars: number;
  patternId: string;
  accentTrainer: boolean;
}

const emptySteps = (): DrumStepLevel[] => Array.from({ length: 16 }, () => 0 as DrumStepLevel);

function pattern(
  id: string,
  name: string,
  description: string,
  swing: number,
  hihat: number[],
  snare: number[],
  kick: number[],
): DrumPattern {
  const toSteps = (values: number[]): DrumStepLevel[] =>
    Array.from({ length: 16 }, (_, index) => {
      const value = values[index] ?? 0;
      return value === 2 ? 2 : value === 1 ? 1 : 0;
    });
  return { id, name, description, swing, steps: { hihat: toSteps(hihat), snare: toSteps(snare), kick: toSteps(kick) } };
}

export const GROOVE_PATTERNS: DrumPattern[] = [
  pattern(
    'basic-rock',
    '8비트 기본 록',
    '하이햇 8분음표와 2·4박 스네어를 사용하는 가장 기본적인 록 그루브입니다.',
    0.5,
    [2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
    [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 1, 0],
  ),
  pattern(
    'four-floor',
    '포 온 더 플로어',
    '모든 박에 킥을 배치해 템포와 다운비트를 강하게 느끼는 댄스·록 연습 패턴입니다.',
    0.5,
    [2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
    [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0],
  ),
  pattern(
    'sixteenth-funk',
    '16비트 펑크',
    '16분 하이햇과 싱코페이션 킥으로 손발 간격과 고스트 감각을 연습합니다.',
    0.5,
    [2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1],
    [2, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 0, 0, 1, 0, 0],
  ),
  pattern(
    'half-time',
    '하프타임',
    '3박에 강한 스네어를 배치해 느린 백비트와 넓은 그루브를 연습합니다.',
    0.5,
    [2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
    [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0],
  ),
  pattern(
    'shuffle',
    '셔플 그루브',
    '스윙된 8분음표와 백비트를 사용해 셔플의 긴-짧은 흐름을 연습합니다.',
    0.66,
    [2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
    [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 1, 0],
  ),
];

export const DEFAULT_CUSTOM_PATTERN: DrumPattern = {
  ...GROOVE_PATTERNS[0],
  id: 'custom',
  name: '내 커스텀 패턴',
  description: '각 칸을 눌러 무음 → 일반 → 강세 순서로 변경할 수 있습니다.',
  steps: {
    hihat: [...GROOVE_PATTERNS[0].steps.hihat],
    snare: [...GROOVE_PATTERNS[0].steps.snare],
    kick: [...GROOVE_PATTERNS[0].steps.kick],
  },
};

export const DEFAULT_ROUTINE: PracticeRoutineStep[] = [
  { id: 'warmup', name: '워밍업', bpm: 80, bars: 8, patternId: 'basic-rock', accentTrainer: false },
  { id: 'control', name: '16분 컨트롤', bpm: 75, bars: 8, patternId: 'sixteenth-funk', accentTrainer: true },
  { id: 'time', name: '타임 점검', bpm: 95, bars: 8, patternId: 'half-time', accentTrainer: false },
];

export function clonePattern(source: DrumPattern, id = source.id, name = source.name): DrumPattern {
  return {
    ...source,
    id,
    name,
    steps: {
      hihat: [...source.steps.hihat],
      snare: [...source.steps.snare],
      kick: [...source.steps.kick],
    },
  };
}

export function normalizePattern(value: unknown): DrumPattern {
  if (!value || typeof value !== 'object') return clonePattern(DEFAULT_CUSTOM_PATTERN);
  const candidate = value as Partial<DrumPattern> & { steps?: Partial<Record<DrumInstrument, unknown>> };
  const normalizeSteps = (instrument: DrumInstrument): DrumStepLevel[] => {
    const raw = Array.isArray(candidate.steps?.[instrument]) ? candidate.steps?.[instrument] as unknown[] : emptySteps();
    return Array.from({ length: 16 }, (_, index) => {
      const item = Number(raw[index] ?? 0);
      return item === 2 ? 2 : item === 1 ? 1 : 0;
    });
  };
  return {
    id: typeof candidate.id === 'string' ? candidate.id : 'custom',
    name: typeof candidate.name === 'string' ? candidate.name : '내 커스텀 패턴',
    description: typeof candidate.description === 'string' ? candidate.description : DEFAULT_CUSTOM_PATTERN.description,
    swing: Number(candidate.swing) >= 0.5 && Number(candidate.swing) <= 0.75 ? Number(candidate.swing) : 0.5,
    steps: { hihat: normalizeSteps('hihat'), snare: normalizeSteps('snare'), kick: normalizeSteps('kick') },
  };
}

export function cycleStepLevel(level: DrumStepLevel): DrumStepLevel {
  return level === 0 ? 1 : level === 1 ? 2 : 0;
}

export function grooveById(id: string, customPattern?: DrumPattern): DrumPattern {
  if (id === 'custom' && customPattern) return normalizePattern(customPattern);
  return clonePattern(GROOVE_PATTERNS.find((item) => item.id === id) ?? GROOVE_PATTERNS[0]);
}

export function nextMovingAccentIndex(current: number, mode: 'forward' | 'random'): number {
  if (mode === 'random') {
    const next = Math.floor(Math.random() * 16);
    return next === current ? (next + 1) % 16 : next;
  }
  return (current + 1) % 16;
}

export function routineTotalBars(steps: PracticeRoutineStep[]): number {
  return steps.reduce((sum, step) => sum + Math.max(1, Math.round(step.bars)), 0);
}
