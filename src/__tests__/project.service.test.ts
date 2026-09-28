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

describe('frame reordering', () => {
  beforeEach(() => newProject());

  it('moves per-layer frame content to the requested index', () => {
    projectService.setPixels(0, [{ x: 1, y: 1 }], '#ff0000');
    projectService.addFrame(false);
    projectService.setPixels(1, [{ x: 2, y: 2 }], '#00ff00');
    projectService.addFrame(false);
    projectService.setPixels(2, [{ x: 3, y: 3 }], '#0000ff');

    projectService.reorderFrame(0, 2);

    expect(projectService.getFrameComposite(0)['2,2']).toBe('#00ff00');
    expect(projectService.getFrameComposite(1)['3,3']).toBe('#0000ff');
    expect(projectService.getFrameComposite(2)['1,1']).toBe('#ff0000');
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

  it('groups continuous opacity updates into one undo step', () => {
    const revisionsBeforePreview = projectService.getFrameRevisions();
    projectService.beginLayerOpacityEdit('layer_base');
    projectService.previewLayerOpacity('layer_base', 0.8, [0]);
    projectService.previewLayerOpacity('layer_base', 0.5, [0]);
    projectService.previewLayerOpacity('layer_base', 0.2, [0]);

    const revisionsDuringPreview = projectService.getFrameRevisions();
    expect(revisionsDuringPreview[0]).toBe(revisionsBeforePreview[0] + 3);
    expect(revisionsDuringPreview.slice(1)).toEqual(revisionsBeforePreview.slice(1));

    projectService.finishLayerOpacityEdit();

    expect(projectService.getState().layers[0].default_transform?.opacity).toBe(0.2);
    expect(projectService.getFrameRevisions().slice(1)).toEqual(
      revisionsBeforePreview.slice(1).map((revision) => revision + 1)
    );
    expect(projectService.undo()).toBe(true);
    expect(projectService.getState().layers[0].default_transform?.opacity).toBe(1);
    expect(projectService.undo()).toBe(false);
  });
});

describe('group reference points', () => {
  beforeEach(() => newProject());

  it('warps nearby pixels with their reference displacement', () => {
    projectService.setPixels(0, [{ x: 1, y: 1 }], '#ff0000');
    projectService.setPixels(0, [{ x: 6, y: 6 }], '#0000ff');
    projectService.setPixels(2, [{ x: 1, y: 3 }], '#ff0000');
    projectService.setPixels(2, [{ x: 6, y: 4 }], '#0000ff');
    const group = projectService.createFrameGroup('layer_base', 0, 2, 'Warp');
    expect(group).not.toBeNull();

    const firstId = projectService.addGroupReferencePoint('layer_base', group!.id, 1, 1)!;
    projectService.setGroupReferencePoint('layer_base', group!.id, firstId, 'end', 1, 3);
    const secondId = projectService.addGroupReferencePoint('layer_base', group!.id, 6, 6)!;
    projectService.setGroupReferencePoint('layer_base', group!.id, secondId, 'end', 6, 4);

    const middle = projectService.getState().layers[0].frame_pixels?.[1] || {};
    expect(middle['1,2']).toBe('#ff0000');
    expect(middle['6,5']).toBe('#0000ff');
    expect(JSON.parse(projectService.getRawJson()).animations[0].layer_groups.layer_base[0].reference_points).toHaveLength(2);
  });

  it('treats one stationary reference as a fixed anchor', () => {
    projectService.setPixels(0, [{ x: 2, y: 2 }], '#ff0000');
    projectService.setPixels(2, [{ x: 4, y: 2 }], '#ff0000');
    const group = projectService.createFrameGroup('layer_base', 0, 2, 'Anchor')!;
    projectService.addGroupReferencePoint('layer_base', group.id, 2, 2);

    expect(projectService.getState().layers[0].frame_pixels?.[1]?.['2,2']).toBe('#ff0000');
  });

  it('groups a dragged reference endpoint into one undo step', () => {
    const group = projectService.createFrameGroup('layer_base', 0, 2, 'Drag')!;
    const referenceId = projectService.addGroupReferencePoint('layer_base', group.id, 2, 2)!;
    projectService.finishGroupReferenceEdit();
    projectService.clearHistory();

    expect(projectService.beginGroupReferenceEdit('layer_base', group.id, referenceId)).toBe(true);
    projectService.setGroupReferencePoint('layer_base', group.id, referenceId, 'end', 3, 2);
    projectService.setGroupReferencePoint('layer_base', group.id, referenceId, 'end', 4, 2);
    projectService.finishGroupReferenceEdit();

    expect(projectService.undo()).toBe(true);
    const restored = projectService.getState().layers[0].groups?.[0].reference_points?.[0];
    expect(restored?.end).toEqual({ x: 2, y: 2 });
    expect(projectService.undo()).toBe(false);
  });
});

describe('frame links', () => {
  beforeEach(() => {
    newProject();
    projectService.addFrame(true);
    projectService.clearHistory();
  });

  it('links adjacent frames with one intermediate frame in one undo step', () => {
    const group = projectService.linkFrames('layer_base', 0);

    expect(group).toMatchObject({ start_frame: 0, end_frame: 2 });
    expect(projectService.getState().meta.total_frames).toBe(3);
    expect(projectService.undo()).toBe(true);
    expect(projectService.getState().meta.total_frames).toBe(2);
    expect(projectService.getState().layers[0].groups).toEqual([]);
    expect(projectService.undo()).toBe(false);
  });

  it('resizes a link while keeping at least one intermediate frame', () => {
    const group = projectService.linkFrames('layer_base', 0)!;
    projectService.clearHistory();

    projectService.setFrameGroupIntermediateCount('layer_base', group.id, 3);
    expect(projectService.getState().meta.total_frames).toBe(5);
    expect(projectService.getState().layers[0].groups?.[0].end_frame).toBe(4);
    expect(projectService.getState().layers[0].groups?.[0].name).toBe('Grupo 1..5');

    projectService.setFrameGroupIntermediateCount('layer_base', group.id, 0);
    expect(projectService.getState().meta.total_frames).toBe(3);
    expect(projectService.getState().layers[0].groups?.[0].end_frame).toBe(2);
  });

  it('dissolves a link and removes only its intermediate frames', () => {
    projectService.setPixels(0, [{ x: 1, y: 1 }], '#ff0000');
    projectService.setPixels(1, [{ x: 6, y: 6 }], '#00ff00');
    const group = projectService.linkFrames('layer_base', 0)!;
    projectService.setFrameGroupIntermediateCount('layer_base', group.id, 3);
    projectService.clearHistory();

    expect(projectService.deleteFrameGroup('layer_base', group.id)).toBe(0);
    expect(projectService.getState().meta.total_frames).toBe(2);
    expect(projectService.getState().layers[0].groups).toEqual([]);
    expect(projectService.getFrameComposite(0)['1,1']).toBe('#ff0000');
    expect(projectService.getFrameComposite(1)['6,6']).toBe('#00ff00');

    expect(projectService.undo()).toBe(true);
    expect(projectService.getState().meta.total_frames).toBe(5);
    expect(projectService.getState().layers[0].groups?.[0]).toMatchObject({ start_frame: 0, end_frame: 4 });
    expect(projectService.undo()).toBe(false);
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
