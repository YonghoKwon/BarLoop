import { useMemo, useState } from 'react';
import { formatTime } from '../lib/time';
import type { BarSegment } from '../types';

interface BarRangePickerProps {
  bars: BarSegment[];
  startIndex: number;
  endIndex: number;
  currentBarIndex: number;
  onStartChange: (index: number) => void;
  onEndChange: (index: number) => void;
  onSeek: (seconds: number) => void;
  onMoveRange: (direction: -1 | 1) => void;
}

export default function BarRangePicker({
  bars,
  startIndex,
  endIndex,
  currentBarIndex,
  onStartChange,
  onEndChange,
  onSeek,
  onMoveRange,
}: BarRangePickerProps) {
  const [editingBoundary, setEditingBoundary] = useState<'start' | 'end'>('start');
  const safeStart = Math.max(0, Math.min(bars.length - 1, startIndex));
  const safeEnd = Math.max(safeStart, Math.min(bars.length - 1, endIndex));
  const length = safeEnd - safeStart + 1;

  const visibleBars = useMemo(() => {
    if (bars.length <= 64) return bars;
    const focus = currentBarIndex >= 0 ? currentBarIndex : safeStart;
    const start = Math.max(0, Math.min(safeStart, focus) - 16);
    return bars.slice(start, Math.min(bars.length, start + 56));
  }, [bars, currentBarIndex, safeStart]);

  const setStart = (index: number) => {
    const next = Math.max(0, Math.min(index, bars.length - 1));
    onStartChange(next);
    if (next > safeEnd) onEndChange(next);
    onSeek(bars[next].start);
  };

  const setEnd = (index: number) => {
    const next = Math.max(safeStart, Math.min(index, bars.length - 1));
    onEndChange(next);
  };

  const applyLength = (barsLong: number) => {
    onEndChange(Math.min(bars.length - 1, safeStart + barsLong - 1));
  };

  const selectBar = (index: number) => {
    if (editingBoundary === 'start') {
      setStart(index);
      setEditingBoundary('end');
    } else {
      setEnd(index);
    }
  };

  return (
    <div className="bar-range-picker" aria-label="마디 반복 범위 편집기">
      <div className="bar-now-playing" role="status">
        <span>현재 재생</span>
        <strong>{currentBarIndex >= 0 ? `${currentBarIndex + 1}마디` : '마디 밖'}</strong>
        <small>{currentBarIndex >= 0 ? formatTime(bars[currentBarIndex].start, true) : '첫 다운비트 이전 구간'}</small>
      </div>

      <div className="bar-boundary-cards">
        <button type="button" className={editingBoundary === 'start' ? 'boundary-card active' : 'boundary-card'} onClick={() => setEditingBoundary('start')}>
          <span>A · 시작</span><strong>{safeStart + 1}마디</strong><small>{formatTime(bars[safeStart].start, true)}</small>
        </button>
        <div className="range-arrow">→</div>
        <button type="button" className={editingBoundary === 'end' ? 'boundary-card active' : 'boundary-card'} onClick={() => setEditingBoundary('end')}>
          <span>B · 종료</span><strong>{safeEnd + 1}마디</strong><small>{formatTime(bars[safeEnd].end, true)}</small>
        </button>
      </div>

      <div className="bar-range-sliders">
        <label><span>A 시작 마디</span><input aria-label="A 시작 마디" type="range" min={0} max={bars.length - 1} value={safeStart} onChange={(event) => setStart(Number(event.target.value))} /></label>
        <label><span>B 종료 마디</span><input aria-label="B 종료 마디" type="range" min={safeStart} max={bars.length - 1} value={safeEnd} onChange={(event) => setEnd(Number(event.target.value))} /></label>
      </div>

      <div className="bar-range-actions">
        <button type="button" disabled={currentBarIndex < 0} onClick={() => currentBarIndex >= 0 && setStart(currentBarIndex)}>현재 마디를 A로</button>
        <button type="button" disabled={currentBarIndex < 0} onClick={() => currentBarIndex >= 0 && setEnd(currentBarIndex)}>현재 마디를 B로</button>
        <button type="button" onClick={() => onMoveRange(-1)}>← 범위 이동</button>
        <button type="button" onClick={() => onMoveRange(1)}>범위 이동 →</button>
      </div>

      <div className="bar-length-presets" aria-label="반복 마디 길이">
        <span>길이 {length}마디</span>
        {[1, 2, 4, 8].map((value) => <button key={value} type="button" className={length === value ? 'active' : ''} onClick={() => applyLength(value)}>{value}마디</button>)}
      </div>

      <div className="bar-grid modern-bar-grid">
        {visibleBars.map((bar) => {
          const selected = bar.index >= safeStart && bar.index <= safeEnd;
          const current = bar.index === currentBarIndex;
          const boundary = bar.index === safeStart ? 'start' : bar.index === safeEnd ? 'end' : '';
          return (
            <button
              type="button"
              key={bar.index}
              className={['bar-button', selected ? 'active' : '', current ? 'current' : '', boundary ? `boundary-${boundary}` : ''].filter(Boolean).join(' ')}
              aria-label={`${bar.index + 1}번 마디${current ? ' 현재 재생' : ''}${selected ? ' 반복 선택' : ''}`}
              onClick={() => selectBar(bar.index)}
            >
              <strong>{bar.index + 1}</strong><span>{formatTime(bar.start)}</span>{current && <i>NOW</i>}
            </button>
          );
        })}
      </div>
      {visibleBars.length < bars.length && <p className="hint">현재 마디와 반복 범위 주변을 표시합니다. 슬라이더로 전체 {bars.length}마디를 바로 이동할 수 있습니다.</p>}
    </div>
  );
}
