import { v4 as uuidv4 } from 'uuid';
import deepEqual from 'fast-deep-equal';

import { CanvasDisplayListEncoder } from '../src/render/canvas-display-list.js';

import {
  encodeCanvasDisplayList_fg,
  encodeCanvasDisplayList_videoLayersPreview,
} from '../src/render/canvas.js';

import { encodeCompVideoSceneDesc } from '../src/render/video-scenedesc.js';

import { makeAttributedStringDesc } from './text/attributed-string.js';
import {
  performTextLayout,
  measureTextLayoutBlocks,
} from './text/text-layout.js';

// these are the intrinsic elements that our React components are ultimately composed of.
// (think similar to 'div', 'img' etc. in React-DOM)
export const IntrinsicNodeType = {
  ROOT: 'root',
  BOX: 'box',
  IMAGE: 'image',
  TEXT: 'label',
  VIDEO: 'video',
  WEBFRAME: 'webframe',
};

function getDefaultGridUnitSizeForViewport(viewportSize) {
  const minDim = Math.min(viewportSize.w, viewportSize.h);
  return minDim / 36;
}

export class Composition {
  constructor(viewportSize, commitFinishedCb, sourceMetadataCb) {
    console.assert(
      viewportSize.w > 0 && viewportSize.h > 0,
      `** invalid Composition viewportSize arg: ${viewportSize}`
    );
    if (commitFinishedCb) {
      console.assert(
        typeof commitFinishedCb === 'function',
        `** invalid Composition commitFinishedCb arg: ${commitFinishedCb}`
      );
    }

    this.viewportSize = viewportSize;

    this.pixelsPerGridUnit = getDefaultGridUnitSizeForViewport(
      this.viewportSize
    );

    this.nodes = [];
    this.rootNode = null;

    this.uncommitted = true;
    this.commitFinishedCb = commitFinishedCb;

    this.sourceMetadataCb = sourceMetadataCb;

    this.currentWebframeProps = {};
    this.webFramePropsDidChange = false;
  }

  createNode(type, props) {
    let node;
    switch (type) {
      case IntrinsicNodeType.ROOT:
        node = new RootNode();
        break;
      case IntrinsicNodeType.BOX:
        node = new BoxNode();
        break;
      case IntrinsicNodeType.IMAGE:
        node = new ImageNode();
        break;
      case IntrinsicNodeType.TEXT:
        node = new TextNode();
        break;
      case IntrinsicNodeType.VIDEO:
        node = new VideoNode();
        break;
      case IntrinsicNodeType.WEBFRAME:
        node = new WebFrameNode();
        break;
    }

    if (!node) {
      console.error("** couldn't create node: ", type, props);
    } else {
      this.nodes.push(node);
    }

    node.commit(this, {}, props);

    return node;
  }

  deleteNode(node) {
    const idx = this.nodes.indexOf(node);
    this.nodes.splice(idx, 1);

    //console.log("deleted node at %d in array", idx)
  }

  attachRootNode(rootNode) {
    this.rootNode = rootNode;
    for (const node of this.nodes) {
      node.container = this;
    }
  }

  prepareForFirstCommit() {
    //console.log("prepare for first commit; we have %d nodes", this.nodes.length);

    this.uncommitted = false;
  }

  didUpdateWebframePropsInCommit(newProps) {
    const oldProps = this.currentWebframeProps || {};
    if (
      oldProps.src !== newProps.src ||
      !isEqualViewportSize(oldProps.viewportSize, newProps.viewportSize) ||
      !isEqualWebFrameAction(oldProps.keyPressAction, newProps.keyPressAction)
    ) {
      this.webFramePropsDidChange = true;
      this.currentWebframeProps = newProps;
    }
  }

  reactFinishedCommits() {
    this._performLayout();

    const opts = {};

    if (this.webFramePropsDidChange) {
      opts.newWebFrameProps = { ...this.currentWebframeProps };
      this.webFramePropsDidChange = false;
    }

    if (this.commitFinishedCb) {
      this.commitFinishedCb(this, opts);
    }
  }

  _makeLayoutCtxHooks(node, deps, passIndex) {
    // record use of these hooks by a layout function.
    // this data could be used for caching of layout results
    // (but we're not currently doing it because it's fast enough to just recompute...)
    return {
      useIntrinsicSize: function () {
        deps.add('intrinsicSize');
        return node.intrinsicSize ? node.intrinsicSize : { w: -1, h: -1 };
      },
      useContentSize: function () {
        deps.add('contentSize');
        if (passIndex > 0 && node.flowFrame && node.flowFrame.w > 0) {
          return { w: node.flowFrame.w, h: node.flowFrame.h };
        }
        return { w: 0, h: 0 };
      },
    };
  }

  _performLayout() {
    if (!this.rootNode) return;

    let passIndex = 0;
    let usedDeps = new Set();
    const makeLayoutCtxHooks = this._makeLayoutCtxHooks;
    const layoutCtxBase = {
      viewport: { x: 0, y: 0, w: this.viewportSize.w, h: this.viewportSize.h },
      pixelsPerGridUnit: this.pixelsPerGridUnit,
    };

    function recurseLayout(node, parentFrame, childFrames) {
      let frame = { ...parentFrame };

      let thisNodeChildFrames;

      if (node.layoutFunc) {
        const thisNodeDeps = new Set();

        frame = node.layoutFunc(frame, node.layoutParams, {
          ...layoutCtxBase,
          ...makeLayoutCtxHooks(node, thisNodeDeps, passIndex),
          node,
        });

        for (const dep of thisNodeDeps) usedDeps.add(dep);

        if (thisNodeDeps.has('contentSize') || frame.containerTransform) {
          // capture child frames (including nested container offsets) if
          // 1) this layout node wants the content size after the first pass, or
          // 2) this node applies a container transform.
          thisNodeChildFrames = [];
        }
      }

      node.setLayoutFrame(frame);

      /*console.log(
        "frame for node '%s' (%s): ",
        node.userGivenId,
        node.constructor.nodeType,
        JSON.stringify(node.layoutFrame)
      );*/

      for (const c of node.children) {
        recurseLayout(c, frame, thisNodeChildFrames || childFrames);
      }

      if (thisNodeChildFrames) {
        /*console.log(
          'child frames for node %s, frame = %s: ',
          node.userGivenId,
          JSON.stringify(frame),
          thisNodeChildFrames
        );*/
        // union of child frames
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const cf of thisNodeChildFrames) {
          minX = Math.min(cf.x, minX);
          minY = Math.min(cf.y, minY);
          maxX = Math.max(cf.x + cf.w, maxX);
          maxY = Math.max(cf.y + cf.h, maxY);
        }
        let flowFrame = { x: 0, y: 0, w: 0, h: 0 };
        if (minX < Infinity) {
          flowFrame.x = minX;
          flowFrame.y = minY;
          flowFrame.w = maxX - minX;
          flowFrame.h = maxY - minY;
        }
        if (frame.containerTransform) {
          flowFrame.x -= frame.containerTransform.x;
          flowFrame.y -= frame.containerTransform.y;
          flowFrame.w -= frame.containerTransform.w;
          flowFrame.h -= frame.containerTransform.h;
        }
        node.flowFrame = flowFrame;
      }

      if (childFrames) {
        // a parent wants our frame for content size calculation
        const frameInfo = node.captureFlowFrameForContainer();
        if (frameInfo) childFrames.push(frameInfo);
      }
    }

    // first pass
    recurseLayout(this.rootNode, layoutCtxBase.viewport, null);

    // do second pass only if any node uses the content size hook
    if (usedDeps.has('contentSize')) {
      passIndex = 1;
      recurseLayout(this.rootNode, layoutCtxBase.viewport, null);
    }
  }

  // if optional 'prev' is provided, this call returns
  // only those top-level keys that have changed from 'prev'
  writeSceneDescription(imageSources, prev, opts) {
    if (!this.rootNode) {
      // this happens if the React render cycle ended up in an error state
      /*console.error(
        "** can't write scene description, composition rootNode is null (nodes len %d, uncommitted %s)",
        this.nodes.length,
        this.uncommitted
      );*/
      throw new Error('Composition setup is invalid for scene description');
    }

    // get foreground graphics as a display list
    const encoder = new CanvasDisplayListEncoder(
      this.viewportSize.w,
      this.viewportSize.h
    );

    encodeCanvasDisplayList_fg(this, encoder, imageSources);

    const fgDisplayList = encoder.finalize();

    // get video elements
    let videoLayers = encodeCompVideoSceneDesc(this, imageSources, opts);

    if (
      videoLayers &&
      videoLayers.length > 0 &&
      opts &&
      opts.disallowMultipleVideoLayersPerInputId
    ) {
      // VCS elements can be composed to render the same input many times,
      // but compositing targets may not support this (if they have a fixed set
      // of output layers where each input is represented once).
      // this flag ensures we don't write incompatible output in such a setup.
      const newLayers = [];
      const usedIds = new Set();
      const duplicatedIds = new Set();
      for (const vl of videoLayers) {
        if (vl.type !== 'video' || !vl.id) continue;

        if (usedIds.has(vl.id)) {
          duplicatedIds.add(vl.id);
          continue;
        }
        newLayers.push(vl);
        usedIds.add(vl.id);
      }
      videoLayers = newLayers;

      if (duplicatedIds.size > 0) {
        console.error(
          'Composition#writeSceneDescription: found and removed duplicated video ids: ',
          duplicatedIds
        );
      }
    }

    if (prev) {
      // if the caller provides their previous cached sceneDesc,
      // only return those keys that have changed.
      // deep compare here should be fast enough because videoLayers is
      // a fairly small object, and fgDisplayList is a flat array.
      let obj = {};
      if (!deepEqual(prev.videoLayers, videoLayers))
        obj.videoLayers = videoLayers;
      if (!deepEqual(prev.fgDisplayList, fgDisplayList))
        obj.fgDisplayList = fgDisplayList;
      return obj;
    }

    return {
      videoLayers,
      fgDisplayList,
    };
  }

  writeVideoLayersPreview() {
    // write a display list that can be used to render a preview
    const encoder = new CanvasDisplayListEncoder(
      this.viewportSize.w,
      this.viewportSize.h
    );

    encodeCanvasDisplayList_videoLayersPreview(this, encoder);

    return encoder.finalize();
  }

  getIntrinsicSizeForImageSrc(src) {
    let ret;
    if (src && this.sourceMetadataCb) {
      ret = this.sourceMetadataCb(this, 'image', src);
    }
    // if callback didn't provide a valid size, return zero size
    if (!ret || !isFinite(ret.w) || !isFinite(ret.h)) return { w: 0, h: 0 };
    return ret;
  }
}

// NaN messes up params value comparison, remove it early
function cleanLayoutParams(obj) {
  let obj2;
  for (const k in obj) {
    const v = obj[k];
    if (Number.isNaN(v)) {
      if (!obj2) obj2 = { ...obj };
      delete obj2[k];
    }
  }
  return obj2 || obj;
}

function compareFlatObj(a, b) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  const keyCount = keysA.length;
  if (keyCount !== keysB.length) return false;
  if (keyCount === 0) return true;

  for (const key of keysA) {
    const vA = a[key];
    const vB = b[key];

    // allow arrays of primitive values (e.g. RGBA colors defined as arrays)
    if (Array.isArray(vA)) {
      if (!Array.isArray(vB)) return false;
      if (vA.length !== vB.length) return false;
      for (let i = 0; i < vA.length; i++) {
        if (vA[i] !== vB[i]) return false;
      }
      continue;
    }
    // ignore object values, we don't support them for these props at all.
    // if they weren't ignored, they would trip up the comparison every time
    // because objects created in a React component's render function
    // won't be the same reference between iterations.
    if (typeof vA === 'object') {
      console.error(
        "warning: VCS Node internal compareFlatObj can't compare objects, will ignore (key '%s')",
        key
      );
      continue;
    }

    if (vA !== vB) return false;
  }
  return true;
}

function isEqualLayoutProps(oldFn, oldParams, newFn, newParams) {
  if (!oldFn && !newFn) return true;

  if (oldFn !== newFn) return false;

  if (newParams || oldParams) {
    if (newParams && !oldParams) return false;
    if (oldParams && !newParams) return false;

    if (!deepEqual(newParams, oldParams)) return false;
  }
  return true;
}

function isEqualStyle(oldStyle, newStyle) {
  if (!oldStyle && !newStyle) return true;
  if (newStyle && !oldStyle) return false;
  if (oldStyle && !newStyle) return false;

  if (!compareFlatObj(newStyle, oldStyle)) return false;

  return true;
}

function isEqualTransform(oldObj, newObj) {
  if (!oldObj && !newObj) return true;
  if (newObj && !oldObj) return false;
  if (oldObj && !newObj) return false;

  if (oldObj.scale !== newObj.scale) return false;
  if (oldObj.scaleX !== newObj.scaleX) return false;
  if (oldObj.scaleY !== newObj.scaleY) return false;
  if (oldObj.rotate_deg !== newObj.rotate_deg) return false;

  return true;
}

function isEqualBlend(oldObj, newObj) {
  if (!oldObj && !newObj) return true;
  if (newObj && !oldObj) return false;
  if (oldObj && !newObj) return false;

  if (oldObj.opacity !== newObj.opacity) return false;

  return true;
}

function isEqualViewportSize(oldSize, newSize) {
  if (!oldSize && !newSize) return true;
  if (newSize && !oldSize) return false;
  if (oldSize && !newSize) return false;

  if (oldSize.w !== newSize.w || oldSize.h !== newSize.h) return false;

  return true;
}

function isEqualLayoutFrame(oldFrame, newFrame) {
  if (!oldFrame && !newFrame) return true;
  if (newFrame && !oldFrame) return false;
  if (oldFrame && !newFrame) return false;

  if (
    oldFrame.x !== newFrame.x ||
    oldFrame.y !== newFrame.y ||
    oldFrame.w !== newFrame.w ||
    oldFrame.h !== newFrame.h
  )
    return false;

  return true;
}

function isEqualWebFrameAction(oldAction, newAction) {
  if (!oldAction && !newAction) return true;
  if (newAction && !oldAction) return false;
  if (oldAction && !newAction) return false;

  if (oldAction.name !== newAction.name) return false;
  if (oldAction.key !== newAction.key) return false;
  if (oldAction.modifiers !== newAction.modifiers) return false;

  return true;
}

class NodeBase {
  static nodeType = null; // abstract base class

  constructor() {
    this.uuid = uuidv4();
    this.userGivenId = '';

    this.parent = null;
    this.children = [];
    this.container = null;

    this.layoutFunc = null;
    this.layoutParams = {};
    this.layoutFuncDeps = []; // hooks used by the layout function

    this.clip = false;
  }

  shouldUpdate(container, oldProps, newProps) {
    // should return true only if the newProps represent a change that requires a commit.
    let newLayout = [];
    if (newProps.layout) {
      if (!Array.isArray(newProps.layout)) {
        console.error(
          'invalid layout prop passed to node, must be an array (got %s)',
          typeof newProps.layout
        );
      } else {
        newLayout = newProps.layout;
      }
    }
    if (
      !isEqualLayoutProps(
        this.layoutFunc,
        this.layoutParams,
        newLayout[0],
        newLayout[1] ? cleanLayoutParams(newLayout[1]) : {}
      )
    ) {
      //console.log("layout props will be updated for %s '%s'", this.uuid, newProps.id || '');
      return true;
    }

    if (oldProps.clip !== newProps.clip) return true;

    if (!isEqualTransform(oldProps.transform, newProps.transform)) return true;

    if (!isEqualBlend(oldProps.blend, newProps.blend)) return true;

    return false;
  }

  commit(container, oldProps, newProps) {
    // ensure a reference to container is available so nodes can access composition state
    // (e.g. viewport size) as part of their commit cycle
    this.container = container;

    //console.log('commit %s, %s: ', this.uuid, this.constructor.nodeType, newProps);

    if (newProps.id) this.userGivenId = newProps.id;

    if (Array.isArray(newProps.layout)) {
      const params = newProps.layout[1];

      this.layoutFunc = newProps.layout[0];
      this.layoutParams = params ? cleanLayoutParams(params) : {};
      //console.log("new layout for '%s': ", this.userGivenId, this.layoutFunc, JSON.stringify(this.layoutParams));
    } else {
      this.layoutFunc = null;
      this.layoutParams = {};
    }

    this.clip = newProps.clip;

    // we should compute a 2D transformation matrix at this point
    // and encapsulate any scale / rotate / anchor point props there
    // to make rendering easier (so that targets don't have to compute this
    // same stuff over again).
    // for now, just pass through the object received from the composition.
    this.transform = newProps.transform;

    this.blend = newProps.blend;
  }

  delete() {
    //console.log("child delete");

    this.parent = null;

    if (this.container) {
      this.container.deleteNode(this);
      this.container = null;
    }
  }

  serialize() {
    const obj = {
      type: this.constructor.nodeType,
    };
    if (this.children.length > 0) {
      obj.children = [];
      for (const c of this.children) {
        obj.children.push(c.serialize());
      }
    }
    return obj;
  }

  setLayoutFrame(frame) {
    this.layoutFrame = frame;
  }

  captureFlowFrameForContainer() {
    const frame = this.flowFrame || this.layoutFrame;
    if (!frame || !Number.isFinite(frame.w)) return null;

    return { ...frame, id: this.userGivenId }; // id for debugging only
  }
}

class RootNode extends NodeBase {
  static nodeType = IntrinsicNodeType.ROOT;

  constructor() {
    super();
    this.userGivenId = '__root';
  }
}

class StyledNodeBase extends NodeBase {
  shouldUpdate(container, oldProps, newProps) {
    if (super.shouldUpdate(container, oldProps, newProps)) return true;

    if (!isEqualStyle(oldProps.style, newProps.style)) return true;

    return false;
  }

  commit(container, oldProps, newProps) {
    super.commit(container, oldProps, newProps);

    this.style = newProps.style;
  }
}

class BoxNode extends StyledNodeBase {
  static nodeType = IntrinsicNodeType.BOX;
}

class TextNode extends StyledNodeBase {
  static nodeType = IntrinsicNodeType.TEXT;

  shouldUpdate(container, oldProps, newProps) {
    if (super.shouldUpdate(container, oldProps, newProps)) return true;

    if (oldProps.text !== newProps.text) return true;

    return false;
  }

  commit(container, oldProps, newProps) {
    super.commit(container, oldProps, newProps);

    this.text = newProps.text || '';

    if (this.text.length < 1) {
      this.attrStringDesc = null;
    } else {
      if (!this.container) {
        console.error('** container missing for text node %s', this.uuid);
        return;
      }
      this.attrStringDesc = makeAttributedStringDesc(
        this.text,
        this.style || {},
        this.container.viewportSize,
        this.container.pixelsPerGridUnit
      );

      try {
        // measure text's intrinsic size now
        this.computeTextSize();

        // if we have a known layout frame, we also want to update the cached text blocks now
        if (
          this.layoutFrame &&
          this.layoutFrame.w > 0 &&
          this.layoutFrame.h > 0
        ) {
          this.computeTextSize(this.layoutFrame);
        }

        /*console.log(
          "commit measured text size '%s': ",
          this.text,
          this.intrinsicSize
        );*/
      } catch (e) {
        console.error('** exception when measuring text size: ', e);
      }
    }
  }

  setLayoutFrame(frame) {
    if (isEqualLayoutFrame(frame, this.layoutFrame)) return;

    this.layoutFrame = frame;

    this.computeTextSize(this.layoutFrame);
  }

  computeTextSize(overrideFrame) {
    let frame = overrideFrame || this.container.viewportSize;
    if (!this.attrStringDesc || !this.attrStringDesc.fragments) {
      frame.w = 0;
      frame.h = 0;
      this.flowFrame = frame;
      if (!overrideFrame) {
        this.intrinsicSize = { w: 0, h: 0 };
      }
      return;
    }

    const textContainerFrame = {
      x: 0,
      y: 0,
      width: frame && frame.w ? frame.w : Infinity,
      height: frame && frame.h ? frame.h : Infinity,
    };

    const blocks = performTextLayout(this.attrStringDesc, textContainerFrame);

    const { totalBox, numLines } = measureTextLayoutBlocks(blocks);

    /*console.log(
      'measure text: numLines %d, frame, totalBox: ',
      numLines,
      frame,
      totalBox
    );*/

    if (numLines > 1 && frame && frame.w) {
      // for multiple lines, the width is the given max
      totalBox.w = frame.w;
    }

    this.textLayoutBlocks = blocks;
    this.textNumLines = numLines > 0 ? numLines : 0;

    // the frame adapted by the final text flow size.
    // this is accessed by the layout engine during container sizing.
    this.flowFrame = {
      x: frame.x,
      y: frame.y,
      w: Math.ceil(totalBox.w),
      h: Math.ceil(totalBox.h),
    };

    if (!overrideFrame) {
      this.intrinsicSize = {
        w: this.flowFrame.w,
        h: this.flowFrame.h,
      };
    }

    /*console.log(
      'numlines %d, intrinsicSize: ',
      this.textNumLines,
      this.intrinsicSize,
      this.textLayoutBlocks
    );*/
  }
}

class ImageNode extends StyledNodeBase {
  static nodeType = IntrinsicNodeType.IMAGE;

  shouldUpdate(container, oldProps, newProps) {
    if (super.shouldUpdate(container, oldProps, newProps)) return true;

    if (oldProps.src !== newProps.src) return true;

    if (oldProps.scaleMode !== newProps.scaleMode) return true;

    if (oldProps.liveAssetUpdateKey !== newProps.liveAssetUpdateKey)
      return true;

    return false;
  }

  commit(container, oldProps, newProps) {
    super.commit(container, oldProps, newProps);

    this.src = newProps.src;
    this.scaleMode = newProps.scaleMode;
    this.liveAssetUpdateKey = newProps.liveAssetUpdateKey;

    this.intrinsicSize = this.container.getIntrinsicSizeForImageSrc(this.src);
  }
}

class VideoNode extends ImageNode {
  // inherits 'src', etc.
  static nodeType = IntrinsicNodeType.VIDEO;
}

class WebFrameNode extends ImageNode {
  // inherits 'src', etc.
  static nodeType = IntrinsicNodeType.WEBFRAME;

  static defaultViewportSize = { w: 1280, h: 720 };

  constructor() {
    super();
    this.keyPressAction = { name: '', key: '' };
  }

  shouldUpdate(container, oldProps, newProps) {
    if (super.shouldUpdate(container, oldProps, newProps)) return true;

    if (!isEqualViewportSize(oldProps.viewportSize, newProps.viewportSize))
      return true;

    if (
      !isEqualWebFrameAction(oldProps.keyPressAction, newProps.keyPressAction)
    )
      return true;

    return false;
  }

  commit(container, oldProps, newProps) {
    super.commit(container, oldProps, newProps);

    // webframe's intrinsic size is simply the size given by the user
    this.intrinsicSize = this.viewportSize;

    // do prop eq checks again so we can record the time when they're actually updated.
    // this is useful for debugging and optimizing rendering.

    const newViewportSize =
      newProps.viewportSize || this.constructor.defaultViewportSize;
    if (!isEqualViewportSize(oldProps.viewportSize, newViewportSize)) {
      this.viewportSize = newViewportSize;

      this.viewportSizeLastUpdateTs = Date.now() / 1000;
    }

    if (!isEqualWebFrameAction(this.keyPressAction, newProps.keyPressAction)) {
      this.keyPressAction = newProps.keyPressAction || { name: '', key: '' };

      this.keyPressActionLastUpdateTs = Date.now() / 1000;
    }

    container.didUpdateWebframePropsInCommit({
      src: this.src,
      viewportSize: this.viewportSize,
      keyPressAction: this.keyPressAction,
    });
  }
}
