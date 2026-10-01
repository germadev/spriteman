import { describe, expect, it } from 'vitest';
import {
  buildClusterOutline,
  getFloodFillPixels,
  getLinePixels,
  getShapePixels,
  mirrorPixels,
  replacePixelColor,
  parseHexColor,
  parsePixelKey,
} from '../helpers/canvas.helper';

describe('getLinePixels', () => {
  it('returns the single pixel for a zero-length line', () => {
    expect(getLinePixels(3, 4, 3, 4)).toEqual([{ x: 3, y: 4 }]);
  });

  it('walks a horizontal run without gaps', () => {
    expect(getLinePixels(0, 0, 3, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('walks a diagonal in both directions', () => {
    expect(getLinePixels(2, 2, 0, 0)).toEqual([
      { x: 2, y: 2 },
      { x: 1, y: 1 },
      { x: 0, y: 0 },
    ]);
  });
});

describe('getFloodFillPixels', () => {
  const pixels = { '1,0': '#111', '1,1': '#111', '2,1': '#222' };

  it('fills only four-connected pixels of the same color', () => {
    expect(getFloodFillPixels(pixels, { x: 1, y: 0 }, 3, 3, '#333')).toEqual([
      { x: 1, y: 0 }, { x: 1, y: 1 },
    ]);
  });

  it('erases only the connected region when the replacement is transparent', () => {
    expect(getFloodFillPixels(pixels, { x: 1, y: 0 }, 3, 3, null)).toEqual([
      { x: 1, y: 0 }, { x: 1, y: 1 },
    ]);
  });

  it('fills transparent space within the board but not across colored barriers', () => {
    const result = getFloodFillPixels({ '1,0': '#111', '1,1': '#111', '1,2': '#111' }, { x: 0, y: 0 }, 3, 3, '#333');
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ x: 0, y: 2 });
  });

  it('does nothing outside the board or when the replacement is unchanged', () => {
    expect(getFloodFillPixels(pixels, { x: -1, y: 0 }, 3, 3, '#333')).toEqual([]);
    expect(getFloodFillPixels(pixels, { x: 1, y: 0 }, 3, 3, '#111')).toEqual([]);
    expect(getFloodFillPixels(pixels, { x: 0, y: 0 }, 3, 3, null)).toEqual([]);
  });
});

describe('getShapePixels', () => {
  it('clips lines and returns no off-board pixels', () => {
    expect(getShapePixels('line', { x: -1, y: 1 }, { x: 2, y: 1 }, 3, 3)).toEqual([
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
    ]);
  });

  it('distinguishes filled and outlined rectangles', () => {
    expect(getShapePixels('rectangle', { x: 0, y: 0 }, { x: 2, y: 2 }, 3, 3)).toHaveLength(8);
    expect(getShapePixels('rectangle', { x: 0, y: 0 }, { x: 2, y: 2 }, 3, 3, true)).toHaveLength(9);
  });

  it('rasterizes circle and triangle inside their drag bounds', () => {
    for (const tool of ['circle', 'triangle'] as const) {
      const outline = getShapePixels(tool, { x: 1, y: 1 }, { x: 7, y: 7 }, 9, 9);
      const filled = getShapePixels(tool, { x: 1, y: 1 }, { x: 7, y: 7 }, 9, 9, true);
      expect(outline.length).toBeGreaterThan(0);
      expect(filled.length).toBeGreaterThan(outline.length);
      expect(filled.every(({ x, y }) => x >= 1 && x <= 7 && y >= 1 && y <= 7)).toBe(true);
    }
  });
});

describe('frame pixel transforms', () => {
  it('replaces exact matching colors without changing source pixels', () => {
    const pixels = { '0,0': '#111', '1,0': '#222' };
    expect(replacePixelColor(pixels, '#111', '#333')).toEqual({ '0,0': '#333', '1,0': '#222' });
    expect(replacePixelColor(pixels, '#111', '__eraser__')).toEqual({ '1,0': '#222' });
    expect(pixels['0,0']).toBe('#111');
  });

  it('mirrors into empty pixels on either axis without overwriting artwork', () => {
    const pixels = { '0,0': '#111', '3,0': '#222' };
    expect(mirrorPixels(pixels, 4, 3, 'horizontal')).toEqual(pixels);
    expect(mirrorPixels(pixels, 4, 3, 'vertical')).toEqual({
      ...pixels, '0,2': '#111', '3,2': '#222',
    });
  });
});

describe('parseHexColor', () => {
  it('expands the short form', () => {
    expect(parseHexColor('#f0a')).toEqual([255, 0, 170, 255]);
  });

  it('reads six and eight digit forms', () => {
    expect(parseHexColor('#3a5f8a')).toEqual([58, 95, 138, 255]);
    expect(parseHexColor('#3a5f8a80')).toEqual([58, 95, 138, 128]);
  });

  it('rejects anything it cannot parse, so callers can fall back', () => {
    expect(parseHexColor('rgba(1,2,3,0.5)')).toBeNull();
    expect(parseHexColor('__eraser__')).toBeNull();
    expect(parseHexColor('#zzzzzz')).toBeNull();
  });
});

describe('parsePixelKey', () => {
  it('splits a coordinate key', () => {
    expect(parsePixelKey('12,7')).toEqual({ x: 12, y: 7 });
  });

  it('rejects malformed keys', () => {
    expect(parsePixelKey('12')).toBeNull();
    expect(parsePixelKey('a,b')).toBeNull();
  });
});

describe('buildClusterOutline', () => {
  it('outlines a single pixel with four edges', () => {
    const segments = buildClusterOutline({ '0,0': '#000000' });
    expect(segments.length).toBe(16); // 4 edges x 4 numbers
  });

  it('drops the shared edge between two neighbours', () => {
    const segments = buildClusterOutline({ '0,0': '#000000', '1,0': '#000000' });
    expect(segments.length).toBe(24); // 6 outer edges, the touching pair omitted
  });

  it('returns nothing for an empty cluster', () => {
    expect(buildClusterOutline(null).length).toBe(0);
    expect(buildClusterOutline({}).length).toBe(0);
  });
});
