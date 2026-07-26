export function normalizeBpmText(value: string, max = 400): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  const withoutLeadingZeros = digits.replace(/^0+(?=\d)/, '');
  const numeric = Number(withoutLeadingZeros);
  if (!Number.isFinite(numeric)) return '';
  return String(Math.min(max, numeric));
}

export function clampBpm(value: number, min = 20, max = 400): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function parseBpmText(value: string, fallback: number, min = 20, max = 400): number {
  const normalized = normalizeBpmText(value, max);
  if (!normalized) return clampBpm(fallback, min, max);
  return clampBpm(Number(normalized), min, max);
}
