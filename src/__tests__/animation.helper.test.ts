import { getOnionFrameIndex } from '../helpers/animation.helper';

describe('group onion skin', () => {
  it('uses only earlier frames, skipping automatic intermediate frames', () => {
    const group = { start_frame: 1, end_frame: 4 };
    expect(getOnionFrameIndex(1, 6, [group])).toBe(0);
    expect(getOnionFrameIndex(4, 6, [group])).toBe(1);
    expect(getOnionFrameIndex(2, 6, [group])).toBe(1);
    expect(getOnionFrameIndex(3, 6, [group])).toBe(1);
    expect(getOnionFrameIndex(0, 6, [group])).toBe(5);
  });

  it('uses the previous frame outside a group', () => {
    expect(getOnionFrameIndex(0, 6)).toBe(5);
    expect(getOnionFrameIndex(3, 6)).toBe(2);
  });

  it('skips intermediate frames across neighboring groups and wraparound', () => {
    const groups = [{ start_frame: 0, end_frame: 2 }, { start_frame: 2, end_frame: 5 }];
    expect(getOnionFrameIndex(5, 7, groups)).toBe(2);
    expect(getOnionFrameIndex(3, 7, groups)).toBe(2);
    expect(getOnionFrameIndex(0, 7, groups)).toBe(6);
    expect(getOnionFrameIndex(2, 7, groups)).toBe(0);
  });
});
import { describe, expect, it } from 'vitest';
import { getDiscreteFrameIndex } from '../helpers/animation.helper';

describe('getDiscreteFrameIndex', () => {
  it('keeps the final fractional frame on the final valid cel', () => {
    expect(getDiscreteFrameIndex(23.99, 24)).toBe(23);
  });

  it('wraps the exact loop boundary directly to the first cel', () => {
    expect(getDiscreteFrameIndex(24, 24)).toBe(0);
  });

  it('normalizes negative frame values', () => {
    expect(getDiscreteFrameIndex(-0.01, 24)).toBe(23);
  });
});
