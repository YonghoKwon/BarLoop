import { useEffect, useState } from 'react';
import { clampBpm, normalizeBpmText, parseBpmText } from '../lib/bpm';

interface BpmNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
}

export default function BpmNumberInput({
  value,
  onChange,
  min = 20,
  max = 400,
  className,
  ariaLabel,
}: BpmNumberInputProps) {
  const [text, setText] = useState(String(clampBpm(value, min, max)));

  useEffect(() => {
    const next = String(clampBpm(value, min, max));
    setText((current) => (Number(current) === value ? current : next));
  }, [max, min, value]);

  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={text}
      aria-label={ariaLabel}
      onChange={(event) => {
        const normalized = normalizeBpmText(event.target.value, max);
        setText(normalized);
        if (normalized) onChange(Number(normalized));
      }}
      onBlur={() => {
        const next = parseBpmText(text, value, min, max);
        setText(String(next));
        if (next !== value) onChange(next);
      }}
    />
  );
}
