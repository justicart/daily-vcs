import { v4 as uuidv4 } from 'uuid';


// these are the intrinsic elements that our React components are ultimately composed of.
// (think similar to 'div', 'img' etc. in React-DOM)
const IntrinsicNodeType = {
  ROOT: 'root',
  BOX: 'box',
  VIDEO: 'video',
  IMAGE: 'image',
};

export class Composition {
  constructor(cb) {
    this.nodes = [];
    this.rootNode = null;

    this.uncommitted = true;

    this.commitFinishedCb = cb;
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
      case IntrinsicNodeType.VIDEO:
        node = new VideoNode();
        break;
      case IntrinsicNodeType.IMAGE:
        node = new ImageNode();
        break;
      }

    if ( !node) {
      console.log("** couldn't create node: ", type, props);
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

  attachRootNode(node) {
    this.rootNode = node;
    for (const node of this.nodes) {
      node.container = this;
    }
  }

  prepareForFirstCommit() {
    //console.log("prepare for first commit; we have %d nodes", this.nodes.length);

    this.uncommitted = false;

  }

  reactFinishedCommits() {
    this._performLayout();

    if (this.commitFinishedCb) {
      this.commitFinishedCb(this);
    }
  }

  _performLayout() {
    if (!this.rootNode) return;

    const viewport = {x: 0, y: 0, w: 1280, h: 720};

    function recurseLayout(node, parentFrame) {
      let frame = {...parentFrame};
      if (node.layoutFunc) {
        frame = node.layoutFunc(frame, viewport, node.layoutParams);
      }
      node.layoutFrame = frame;
      console.log("frame for node '%s': ", node.userGivenId, JSON.stringify(node.layoutFrame));

      for (const c of node.children) {
        recurseLayout(c, frame);
      }
    }

    recurseLayout(this.rootNode, viewport);

  }

  serialize() {
    if (!this.rootNode) return {};

    return this.rootNode.serialize();
  }
}


function isEqualLayoutProps(oldFn, oldParams, newFn, newParams) {
  if (!oldFn && !newFn) return true;

  if (oldFn !== newFn) return false;

  if (newParams && !oldParams) return false;
  if (oldParams && !newParams) return false;

  for (const k in oldParams) {
    if (oldParams[k] !== newParams[k]) return false;
  }
  for (const k in newParams) {
    if (oldParams[k] !== newParams[k]) return false;
  }

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
  }

  shouldUpdate(container, oldProps, newProps) {
    // should return true only if the newProps represent a change that requires a commit

    //console.log("shouldupdate %s, '%s'", this.uuid, newProps.id);

    let newLayout = [];
    if (newProps.layout) {
      if (!Array.isArray(newProps.layout)) {
        console.warn("invalid layout prop passed to node: ", newProps.layout);
      } else {
        newLayout = newProps.layout;
      }
    }
    if (!isEqualLayoutProps(this.layoutFunc, this.layoutParams, newLayout[0], newLayout[1])) {
      console.log("layout props will be updated for '%s'", newProps.id || '');
      return true;
    }

    return false;
  }

  commit(container, oldProps, newProps) {    
    //console.log("commit %s, %s", this.uuid, newProps.id)

    if (newProps.id) this.userGivenId = newProps.id;

    if (Array.isArray(newProps.layout)) {
      this.layoutFunc = newProps.layout[0];
      this.layoutParams = newProps.layout[1] || {};
      //console.log("new layout for '%s': ", this.userGivenId, this.layoutFunc, JSON.stringify(this.layoutParams));
    } else {
      this.layoutFunc = null;
      this.layoutParams = {};
    }
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
}

class RootNode extends NodeBase {
  static nodeType = IntrinsicNodeType.ROOT;

  constructor() {
    super();
    this.userGivenId = '__root';
  }
}

class BoxNode extends NodeBase {
  static nodeType = IntrinsicNodeType.BOX;
}

class VideoNode extends NodeBase {
  static nodeType = IntrinsicNodeType.VIDEO;
}

class ImageNode extends NodeBase {
  static nodeType = IntrinsicNodeType.IMAGE;

}
