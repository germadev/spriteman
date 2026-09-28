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
