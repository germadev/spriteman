export function getOnionFrameIndex(current: number, total: number, groups: Array<{ start_frame: number; end_frame: number }> = []): number {
  for (let offset = 1; offset < total; offset++) {
    const previous = (current - offset + total) % total;
    if (!groups.some((group) => previous > group.start_frame && previous < group.end_frame)) return previous;
  }
  return current;
}
export function getDiscreteFrameIndex(frame: number, totalFrames: number): number {
  const total = Math.max(1, Math.floor(totalFrames));
  const normalized = ((frame % total) + total) % total;
  return Math.floor(normalized);
}
