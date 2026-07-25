export async function createWaveformPeaks(file: File, pointCount = 720): Promise<number[]> {
  const Context = window.AudioContext;
  if (!Context) return [];

  const context = new Context();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const points = Math.max(120, Math.min(1200, pointCount));
    const blockSize = Math.max(1, Math.floor(channel.length / points));
    const peaks: number[] = [];

    for (let index = 0; index < points; index += 1) {
      const start = index * blockSize;
      const end = Math.min(channel.length, start + blockSize);
      let peak = 0;
      for (let cursor = start; cursor < end; cursor += 1) {
        peak = Math.max(peak, Math.abs(channel[cursor]));
      }
      peaks.push(peak);
    }

    const max = Math.max(...peaks, 0.0001);
    return peaks.map((peak) => peak / max);
  } finally {
    await context.close();
  }
}
