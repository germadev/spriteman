import { decodeCel, EncodedCel, PixelMap } from './cel.helper';
import { parseHexColor } from './canvas.helper';

export type ExportScope = 'frame' | 'animation' | 'project';
export type ExportFormat = 'svg' | 'spritemotion' | 'lottie' | 'ico' | 'ani';

interface ExportLayer {
  id: string;
  visible?: boolean;
  z_index?: number;
  default_transform?: { opacity?: number };
}

interface ExportClip {
  id: string;
  name: string;
  fps: number;
  total_frames: number;
  cels?: Record<string, Record<string, EncodedCel>>;
}

interface ExportDocument {
  version: string;
  meta: { name: string; canvas_width: number; canvas_height: number };
  layers: ExportLayer[];
  animations: ExportClip[];
  activeAnimationId: string;
}

export interface ExportAnimation {
  name: string;
  width: number;
  height: number;
  fps: number;
  frames: PixelMap[];
}

const hex = (value: number): string => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

const blendColor = (background: string | undefined, foreground: string, opacity: number): string => {
  const source = parseHexColor(foreground);
  if (!source || opacity >= 1 && source[3] === 255) return foreground;
  const destination = background ? parseHexColor(background) : null;
  const sourceAlpha = (source[3] / 255) * opacity;
  const destinationAlpha = destination ? destination[3] / 255 : 0;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) return '#00000000';
  const channel = (index: number) =>
    (source[index] * sourceAlpha + (destination?.[index] ?? 0) * destinationAlpha * (1 - sourceAlpha)) / outputAlpha;
  return `#${hex(channel(0))}${hex(channel(1))}${hex(channel(2))}${hex(outputAlpha * 255)}`;
};

export function readActiveAnimation(projectJson: string): ExportAnimation {
  const project = JSON.parse(projectJson) as ExportDocument;
  const width = Math.max(1, project.meta.canvas_width);
  const height = Math.max(1, project.meta.canvas_height);
  const clip = project.animations.find((candidate) => candidate.id === project.activeAnimationId) ?? project.animations[0];
  if (!clip) throw new Error('Project has no animation clips');

  const layers = [...(project.layers || [])].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
  const totalFrames = Math.max(1, clip.total_frames || 1);
  const frames: PixelMap[] = [];

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const composite: PixelMap = {};
    for (const layer of layers) {
      if (layer.visible === false) continue;
      const opacity = Math.max(0, Math.min(1, layer.default_transform?.opacity ?? 1));
      if (opacity === 0) continue;
      const pixels = decodeCel(clip.cels?.[layer.id]?.[String(frameIndex)], width, height);
      for (const [coordinate, color] of Object.entries(pixels)) {
        composite[coordinate] = blendColor(composite[coordinate], color, opacity);
      }
    }
    frames.push(composite);
  }

  return { name: clip.name || project.meta.name, width, height, fps: Math.max(1, clip.fps || 1), frames };
}

interface ColorRun { x: number; y: number; width: number; color: string }

const collectRuns = (pixels: PixelMap, width: number, height: number): ColorRun[] => {
  const runs: ColorRun[] = [];
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const color = pixels[`${x},${y}`];
      if (!color) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < width && pixels[`${end},${y}`] === color) end++;
      runs.push({ x, y, width: end - x, color });
      x = end;
    }
  }
  return runs;
};

const svgFill = (color: string): { fill: string; opacity: number } => {
  const rgba = parseHexColor(color);
  if (!rgba) return { fill: color, opacity: 1 };
  return { fill: `#${hex(rgba[0])}${hex(rgba[1])}${hex(rgba[2])}`, opacity: rgba[3] / 255 };
};

const svgFrameBody = (pixels: PixelMap, width: number, height: number): string => {
  const byColor = new Map<string, ColorRun[]>();
  for (const run of collectRuns(pixels, width, height)) {
    const list = byColor.get(run.color) ?? [];
    list.push(run);
    byColor.set(run.color, list);
  }
  return [...byColor.entries()].map(([color, runs]) => {
    const paint = svgFill(color);
    const path = runs.map((run) => `M${run.x} ${run.y}h${run.width}v1H${run.x}z`).join('');
    const alpha = paint.opacity < 1 ? ` fill-opacity="${paint.opacity.toFixed(3)}"` : '';
    return `<path fill="${paint.fill}"${alpha} d="${path}"/>`;
  }).join('');
};

export function exportFrameSvg(animation: ExportAnimation, frameIndex: number): string {
  const index = Math.max(0, Math.min(animation.frames.length - 1, frameIndex));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${animation.width}" height="${animation.height}" viewBox="0 0 ${animation.width} ${animation.height}" shape-rendering="crispEdges">${svgFrameBody(animation.frames[index], animation.width, animation.height)}</svg>`;
}

export function exportAnimationSvg(animation: ExportAnimation): string {
  const count = animation.frames.length;
  const duration = count / animation.fps;
  const groups = animation.frames.map((frame, index) => {
    const start = (index / count) * 100;
    const end = ((index + 1) / count) * 100;
    return `<g class="frame frame-${index}">${svgFrameBody(frame, animation.width, animation.height)}</g><style>@keyframes frame-${index}{0%,${Math.max(0, start - 0.001).toFixed(3)}%{opacity:0}${start.toFixed(3)}%,${Math.max(start, end - 0.001).toFixed(3)}%{opacity:1}${end.toFixed(3)}%,100%{opacity:0}}.frame-${index}{opacity:0;animation:frame-${index} ${duration.toFixed(6)}s steps(1,end) infinite}</style>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${animation.width}" height="${animation.height}" viewBox="0 0 ${animation.width} ${animation.height}" shape-rendering="crispEdges">${groups}</svg>`;
}

const lottieColor = (color: string): { color: number[]; opacity: number } => {
  const rgba = parseHexColor(color) ?? [0, 0, 0, 255];
  return { color: [rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, 1], opacity: (rgba[3] / 255) * 100 };
};

export function exportLottie(animation: ExportAnimation): string {
  const layers = animation.frames.map((pixels, frameIndex) => {
    const byColor = new Map<string, ColorRun[]>();
    for (const run of collectRuns(pixels, animation.width, animation.height)) {
      const list = byColor.get(run.color) ?? [];
      list.push(run);
      byColor.set(run.color, list);
    }
    const shapes = [...byColor.entries()].map(([color, runs], colorIndex) => {
      const paint = lottieColor(color);
      return {
        ty: 'gr', nm: `Color ${colorIndex + 1}`,
        it: [
          ...runs.map((run, runIndex) => ({
            ty: 'rc', nm: `Run ${runIndex + 1}`, d: 1,
            p: { a: 0, k: [run.x + run.width / 2, run.y + 0.5] },
            s: { a: 0, k: [run.width, 1] }, r: { a: 0, k: 0 },
          })),
          { ty: 'fl', c: { a: 0, k: paint.color }, o: { a: 0, k: paint.opacity }, r: 1 },
          { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } },
        ],
      };
    });
    return {
      ddd: 0, ind: frameIndex + 1, ty: 4, nm: `Frame ${frameIndex + 1}`,
      sr: 1, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      ao: 0, shapes, ip: frameIndex, op: frameIndex + 1, st: 0, bm: 0,
    };
  });
  return JSON.stringify({ v: '5.12.2', fr: animation.fps, ip: 0, op: animation.frames.length, w: animation.width, h: animation.height, nm: animation.name, ddd: 0, assets: [], layers }, null, 2);
}

const writeU16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const writeU32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value, true);
const fourCC = (value: string): Uint8Array => new TextEncoder().encode(value);
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};

export function buildIco(png: Uint8Array, width: number, height: number): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  writeU16(view, 0, 0); writeU16(view, 2, 1); writeU16(view, 4, 1);
  header[6] = width >= 256 ? 0 : width;
  header[7] = height >= 256 ? 0 : height;
  writeU16(view, 10, 1); writeU16(view, 12, 32);
  writeU32(view, 14, png.length); writeU32(view, 18, header.length);
  return concat(header, png);
}

const chunk = (id: string, data: Uint8Array): Uint8Array => {
  const header = new Uint8Array(8);
  header.set(fourCC(id), 0);
  writeU32(new DataView(header.buffer), 4, data.length);
  return concat(header, data, data.length % 2 ? new Uint8Array(1) : new Uint8Array(0));
};

export function buildAni(icons: Uint8Array[], width: number, height: number, fps: number): Uint8Array {
  const count = icons.length;
  const jiffies = Math.max(1, Math.round(60 / Math.max(1, fps)));
  const anih = new Uint8Array(36);
  const anihView = new DataView(anih.buffer);
  [36, count, count, width, height, 32, 1, jiffies, 1].forEach((value, index) => writeU32(anihView, index * 4, value));
  const rate = new Uint8Array(count * 4);
  const seq = new Uint8Array(count * 4);
  const rateView = new DataView(rate.buffer);
  const seqView = new DataView(seq.buffer);
  for (let index = 0; index < count; index++) { writeU32(rateView, index * 4, jiffies); writeU32(seqView, index * 4, index); }
  const frameList = concat(fourCC('fram'), ...icons.map((icon) => chunk('icon', icon)));
  const body = concat(fourCC('ACON'), chunk('anih', anih), chunk('rate', rate), chunk('seq ', seq), chunk('LIST', frameList));
  const riff = new Uint8Array(8);
  riff.set(fourCC('RIFF'), 0);
  writeU32(new DataView(riff.buffer), 4, body.length);
  return concat(riff, body);
}

export async function renderFramePng(pixels: PixelMap, width: number, height: number): Promise<Uint8Array> {
  const targetWidth = Math.min(256, Math.max(1, width));
  const targetHeight = Math.min(256, Math.max(1, height));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  context.imageSmoothingEnabled = false;
  const scaleX = targetWidth / width;
  const scaleY = targetHeight / height;
  for (const [coordinate, color] of Object.entries(pixels)) {
    const [x, y] = coordinate.split(',').map(Number);
    context.fillStyle = color;
    context.fillRect(Math.floor(x * scaleX), Math.floor(y * scaleY), Math.ceil(scaleX), Math.ceil(scaleY));
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export const safeExportName = (value: string): string => value.trim().replace(/[^a-zA-Z0-9._-]+/g, '_') || 'spritemotion';
