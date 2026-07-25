import { useEffect, useRef, useState, type PointerEvent } from 'react';

interface WaveformLoopEditorProps {
  peaks: number[] | null;
  duration: number;
  currentTime: number;
  loopStart: number;
  loopEnd: number;
  disabled: boolean;
  onSeek: (seconds: number) => void;
  onLoopChange: (start: number, end: number) => void;
}

type DragTarget = 'start' | 'end' | null;

export default function WaveformLoopEditor({
  peaks,
  duration,
  currentTime,
  loopStart,
  loopEnd,
  disabled,
  onSeek,
  onLoopChange,
}: WaveformLoopEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(ratio, ratio);
    const width = rect.width;
    const height = rect.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#0b0e14';
    context.fillRect(0, 0, width, height);

    context.strokeStyle = '#222936';
    context.lineWidth = 1;
    for (let index = 1; index < 8; index += 1) {
      const x = (width / 8) * index;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    if (peaks?.length) {
      context.strokeStyle = '#6f7b91';
      context.lineWidth = Math.max(1, width / peaks.length * 0.72);
      peaks.forEach((peak, index) => {
        const x = (index / Math.max(1, peaks.length - 1)) * width;
        const amplitude = Math.max(1, peak * (height * 0.42));
        context.beginPath();
        context.moveTo(x, height / 2 - amplitude);
        context.lineTo(x, height / 2 + amplitude);
        context.stroke();
      });
    } else {
      context.strokeStyle = '#465064';
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.stroke();
    }

    if (duration > 0) {
      const startX = (loopStart / duration) * width;
      const endX = (loopEnd / duration) * width;
      context.fillStyle = 'rgba(84, 214, 155, 0.14)';
      context.fillRect(startX, 0, Math.max(0, endX - startX), height);

      context.fillStyle = '#54d69b';
      context.fillRect(startX - 2, 0, 4, height);
      context.fillRect(endX - 2, 0, 4, height);

      const progressX = (currentTime / duration) * width;
      context.fillStyle = '#ff6a3d';
      context.fillRect(progressX - 1, 0, 2, height);

      context.font = '700 11px system-ui';
      context.fillStyle = '#dff9ed';
      context.fillText('A', Math.max(4, startX + 5), 15);
      context.fillText('B', Math.min(width - 14, endX - 14), 15);
    }
  }, [currentTime, duration, loopEnd, loopStart, peaks]);

  const pointToTime = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    return ratio * duration;
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled || duration <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const time = pointToTime(event);
    const threshold = Math.max(duration * 0.035, 0.45);
    if (Math.abs(time - loopStart) <= threshold) setDragTarget('start');
    else if (Math.abs(time - loopEnd) <= threshold) setDragTarget('end');
    else onSeek(time);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragTarget || disabled) return;
    const time = pointToTime(event);
    if (dragTarget === 'start') onLoopChange(Math.min(time, loopEnd - 0.04), loopEnd);
    else onLoopChange(loopStart, Math.max(time, loopStart + 0.04));
  };

  return (
    <div className="waveform-editor">
      <canvas
        ref={canvasRef}
        aria-label="파형 및 반복 구간 편집기"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDragTarget(null)}
        onPointerCancel={() => setDragTarget(null)}
      />
      <p className="hint">파형을 탭하면 이동하고, A/B 선 가까이를 끌면 반복 경계를 조절합니다.</p>
    </div>
  );
}
