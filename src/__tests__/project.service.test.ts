import { beforeEach, describe, expect, it } from 'vitest';
import { projectService } from '../services/project.service';

const newProject = (width = 8, height = 8) => {
  const json = projectService.createNewProject('test_sprite', width, height, 12);
  projectService.setProjectJson(json);
  projectService.clearHistory();
};

describe('pixel editing', () => {
  beforeEach(() => newProject());

  it('paints into the selected layer and recomposes the frame', () => {
    projectService.setPixels(0, [{ x: 1, y: 1 }, { x: 2, y: 1 }], '#ff0000');
    const composite = projectService.getFrameComposite(0);
    expect(composite['1,1']).toBe('#ff0000');
    expect(composite['2,1']).toBe('#ff0000');
  });

  it('bumps the frame revision so thumbnails invalidate on a same-count repaint', () => {
    projectService.setPixels(0, [{ x: 1, y: 1 }], '#ff0000');
    const first = projectService.getFrameRevisions()[0];
    // Repaint the same pixel a different color: the pixel count does not change.
    projectService.setPixels(0, [{ x: 1, y: 1 }], '#00ff00');
    expect(projectService.getFrameRevisions()[0]).toBeGreaterThan(first);
  });

  it('changes the thumbnail cache epoch when a document is replaced', () => {
    const replacement = projectService.createNewProject('replacement', 8, 8, 12);
    const before = projectService.getFramesEpoch();
    projectService.setProjectJson(replacement);
    expect(projectService.getFramesEpoch()).toBeGreaterThan(before);
  });
});

describe('history', () => {
  beforeEach(() => newProject());

  it('undoes and redoes a stroke without touching the engine document', () => {
    projectService.setPixels(0, [{ x: 3, y: 3 }], '#123456');
    expect(projectService.getFrameComposite(0)['3,3']).toBe('#123456');

    expect(projectService.undo()).toBe(true);
    expect(projectService.didLastHistoryChangeStructure()).toBe(false);
    expect(projectService.getFrameComposite(0)['3,3']).toBeUndefined();

    expect(projectService.redo()).toBe(true);
    expect(projectService.getFrameComposite(0)['3,3']).toBe('#123456');
  });

  it('reports nothing to undo on a fresh document', () => {
    expect(projectService.canUndo()).toBe(false);
    expect(projectService.undo()).toBe(false);
  });

  it('marks structural steps so the caller reloads the engine', () => {
    projectService.addLayer('Second layer');
    expect(projectService.undo()).toBe(true);
    expect(projectService.didLastHistoryChangeStructure()).toBe(true);
  });

  it('records no history entry for a stroke that changes nothing', () => {
    projectService.setPixels(0, [{ x: 4, y: 4 }], '#abcdef');
    projectService.setPixels(0, [{ x: 4, y: 4 }], '#abcdef');
    expect(projectService.undo()).toBe(true);
    expect(projectService.getFrameComposite(0)['4,4']).toBeUndefined();
  });
});

describe('layer opacity', () => {
  beforeEach(() => newProject());

  it('updates, clamps and serializes the base layer opacity', () => {
    projectService.setLayerOpacity('layer_base', 1.5);
    expect(projectService.getState().layers[0].default_transform?.opacity).toBe(1);

    projectService.setLayerOpacity('layer_base', 0.5);
    expect(projectService.getState().layers[0].default_transform?.opacity).toBe(0.5);
    expect(JSON.parse(projectService.getRawJson()).layers[0].default_transform.opacity).toBe(0.5);

    expect(projectService.undo()).toBe(true);
    expect(projectService.getState().layers[0].default_transform?.opacity).toBe(1);
  });

  it('applies layer opacity to the composited raster frame', () => {
    projectService.setPixels(0, [{ x: 2, y: 3 }], '#ff0000');
    projectService.setLayerOpacity('layer_base', 0.5);

    expect(projectService.getFrameComposite(0)['2,3']).toBe('#ff000080');
  });
});

describe('engine document', () => {
  beforeEach(() => newProject());

  it('excludes pixel data the Rust engine does not declare', () => {
    projectService.setPixels(0, [{ x: 0, y: 0 }], '#ffffff');
    const engineDoc = JSON.parse(projectService.getEngineJson());

    expect(engineDoc.meta.canvas_width).toBe(8);
    expect(engineDoc.layers.length).toBeGreaterThan(0);
    expect(engineDoc.layers[0].frame_pixels).toBeUndefined();
    expect(engineDoc.frame_pixels).toBeUndefined();
    expect(engineDoc.layers[0].tracks).toBeDefined();
  });

  it('stays byte-identical across a pixel-only edit, so the engine can skip reloading', () => {
    const before = projectService.getEngineJson();
    projectService.setPixels(0, [{ x: 5, y: 5 }], '#010203');
    expect(projectService.getEngineJson()).toBe(before);
  });

  it('changes when a layer transform changes', () => {
    const before = projectService.getEngineJson();
    projectService.addLayer('Arm');
    expect(projectService.getEngineJson()).not.toBe(before);
  });
});

describe('animation tabs', () => {
  beforeEach(() => newProject());

  it('publishes new animation array references after add and rename', () => {
    const initial = projectService.getState().animations;
    const animationId = projectService.addAnimation('walk');
    const afterAdd = projectService.getState().animations;

    expect(afterAdd).not.toBe(initial);
    expect(afterAdd).toHaveLength(2);

    projectService.renameAnimation(animationId, 'run');
    const afterRename = projectService.getState().animations;
    expect(afterRename).not.toBe(afterAdd);
    expect(afterRename.find((animation) => animation.id === animationId)?.name).toBe('run');
  });
});

describe('serialization', () => {
  beforeEach(() => newProject());

  it('round-trips the document through save and load', () => {
    projectService.setPixels(0, [{ x: 2, y: 2 }], '#0f0f0f');
    const saved = projectService.getRawJson();

    projectService.setProjectJson(saved);
    expect(projectService.getFrameComposite(0)['2,2']).toBe('#0f0f0f');
  });

  it('serializes compactly, not pretty-printed', () => {
    expect(projectService.getRawJson()).not.toContain('\n  ');
  });
});
