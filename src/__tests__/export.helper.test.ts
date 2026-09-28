import { describe, expect, it } from 'vitest';
import { encodeCel } from '../helpers/cel.helper';
import {
  buildAni,
  buildIco,
  exportAnimationSvg,
  exportFrameSvg,
  exportLottie,
  readActiveAnimation,
} from '../helpers/export.helper';

const projectJson = JSON.stringify({
  version: '2.0.0',
  meta: { name: 'test', canvas_width: 4, canvas_height: 3 },
  activeAnimationId: 'walk',
  layers: [
    { id: 'back', z_index: 0, visible: true, default_transform: { opacity: 1 } },
    { id: 'front', z_index: 1, visible: true, default_transform: { opacity: 0.5 } },
  ],
  animations: [{
    id: 'walk', name: 'walk', fps: 12, total_frames: 2,
    cels: {
      back: { 0: encodeCel({ '0,0': '#0000ff', '1,0': '#0000ff' }, 4, 3) },
      front: { 0: encodeCel({ '1,0': '#ff0000' }, 4, 3), 1: encodeCel({ '2,1': '#00ff00' }, 4, 3) },
    },
  }],
});

describe('export helpers', () => {
  it('reads and composites the active clip frames', () => {
    const animation = readActiveAnimation(projectJson);
    expect(animation.frames).toHaveLength(2);
    expect(animation.frames[0]['0,0']).toBe('#0000ff');
    expect(animation.frames[0]['1,0']).toBe('#800080ff');
    expect(animation.frames[1]['2,1']).toBe('#00ff0080');
  });

  it('groups horizontal pixels in frame and animated SVG output', () => {
    const animation = readActiveAnimation(projectJson);
    const frameSvg = exportFrameSvg(animation, 0);
    expect(frameSvg).toContain('shape-rendering="crispEdges"');
    expect(frameSvg).toContain('M0 0h1v1H0z');

    const animatedSvg = exportAnimationSvg(animation);
    expect(animatedSvg).toContain('@keyframes frame-0');
    expect(animatedSvg).toContain('infinite');
  });

  it('emits a structurally valid Lottie document', () => {
    const lottie = JSON.parse(exportLottie(readActiveAnimation(projectJson)));
    expect(lottie.v).toBe('5.12.2');
    expect(lottie.fr).toBe(12);
    expect(lottie.op).toBe(2);
    expect(lottie.layers).toHaveLength(2);
    expect(lottie.layers[0].ty).toBe(4);
  });

  it('builds an ICO directory around PNG bytes', () => {
    const png = new Uint8Array([137, 80, 78, 71]);
    const ico = buildIco(png, 32, 32);
    const view = new DataView(ico.buffer);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(1);
    expect(view.getUint32(14, true)).toBe(4);
    expect(view.getUint32(18, true)).toBe(22);
    expect(Array.from(ico.slice(22))).toEqual(Array.from(png));
  });

  it('builds a RIFF ACON animated cursor with embedded icon chunks', () => {
    const ani = buildAni([new Uint8Array([1, 2]), new Uint8Array([3, 4])], 32, 32, 12);
    const text = new TextDecoder().decode(ani);
    expect(text.slice(0, 4)).toBe('RIFF');
    expect(text.slice(8, 12)).toBe('ACON');
    expect(text).toContain('anih');
    expect(text).toContain('rate');
    expect(text).toContain('fram');
    expect(text.match(/icon/g)).toHaveLength(2);
  });
});
