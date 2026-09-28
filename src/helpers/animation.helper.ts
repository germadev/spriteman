export function getDiscreteFrameIndex(frame: number, totalFrames: number): number {
  const total = Math.max(1, Math.floor(totalFrames));
  const normalized = ((frame % total) + total) % total;
  return Math.floor(normalized);
}
