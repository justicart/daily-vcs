import * as React from 'react';
import {Box, Image, Label, Video} from '../src/react/components';
import {useParams, useVideoTime, useVideoCall} from '../src/react/hooks';


// -- the root component of this composition --
export default function HelloDailyVCS() {
  // this comp's params are defined in compositionInterface below
  const params = useParams();
  const {showGraphics, fitGridToGraphics, graphicsOnSide: onSide} = params;

  // layout setup for graphics
  const baseLayoutFn = (onSide) ? layoutFuncs.splitH : layoutFuncs.splitV;
  const splitPos = (onSide) ? 0.8 : 0.67;
  const graphicsLayout = [baseLayoutFn, {index: 1, pos: splitPos}];
  
  // if we want to shrink the grid so it doesn't overlap with the graphics,
  // pass it the same split layout function, just with a different index
  let gridLayout;
  if (showGraphics && fitGridToGraphics) {
    gridLayout = [baseLayoutFn, {index: 0, pos: splitPos}];
  }
  
  return (
    <Box id="main">
      <VideoGrid layout={gridLayout} />
      {showGraphics ?
        <TimedExampleGraphics
          layout={graphicsLayout}
          onSide={onSide}
          demoAnim={params.demoAnimation}
        /> : null}
    </Box>
  )
}

// -- the control interface exposed by this composition --
export const compositionInterface = {
  displayMeta: {
    name: "Hello Daily",
    description: "An example composition in a single file",
  },
  modes: [
    "grid",
  ],
  params: [
    {
      id: "showGraphics",
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "graphicsOnSide",
      type: "boolean",
      defaultValue: false,
    },
    {
      id: "fitGridToGraphics",
      type: "boolean",
      defaultValue: false,
    },
    /*{
      id: "demoAnimation",
      type: "boolean",
      defaultValue: false,
    },*/
  ]
};


// --- components ---

function VideoGrid({layout}) {
  const {activeParticipants} = useVideoCall();

  let maxParticipants = activeParticipants.length;
  let activeIndexes = [];
  let n = 0;
  for (let i = 0; i < maxParticipants; i++) {
    if (activeParticipants[i]) {
      activeIndexes.push(i);
      n++;
    }
  }

  return (
    <Box id="videogrid" layout={layout}>
      {activeIndexes.map((srcIdx, i) => {
        const key = 'videogrid_'+i;
        return <Video
          src={srcIdx} key={key} id={key}
          layout={[layoutFuncs.grid, {index: i, total: n}]}
        />;
      })}
    </Box>
  );
}

function TimedExampleGraphics({onSide, layout: baseLayout, demoAnim}) {
  const t = useVideoTime();

  // change some properties based on time
  let imageSize = 0.1;
  if (t % 12 > 5) {
    imageSize = 0.15;
  }
  if (t % 12 > 9) {
    imageSize = 0.25;
  }
  let imageLayoutFn = layoutFuncs.cornerBug_topRight;
  if (t % 6 >= 3) {
    imageLayoutFn = layoutFuncs.cornerBug_bottomLeft;    
  }

  const textStyle = {
    textColor: 'rgba(255, 250, 200, 0.93)',
    fontFamily: 'Helvetica',
    fontWeight: '200',
    fontSize_vh: onSide ? 0.035 : 0.055,
  };
  const textLayoutFn = layoutFuncs.pad;
  const textPad_px = 20;

  return (
    <Box id="graphicsBox"
      style={{fillColor: 'rgba(50, 70, 255, 0.7)'}}
      layout={baseLayout}
    >
      <Label style={textStyle} layout={[textLayoutFn, {pad: textPad_px}]}>
        Hello world
      </Label>
      <Image src="test_square" layout={[imageLayoutFn, {size: imageSize}]} />
    </Box>
  );
}


// --- layout functions and utils ---

const layoutFuncs = {
  splitV: (parentFrame, params) => {
    const pos = params.pos || 0.5;
    const idx = params.index || 0;

    const frame = {...parentFrame};
    if (idx === 0) {
      frame.h = Math.round(parentFrame.h * pos);
    } else {
      frame.h = Math.round(parentFrame.h * (1 - pos));
      frame.y += parentFrame.h - frame.h;
    }
    return frame;
  },

  splitH: (parentFrame, params) => {
    const pos = params.pos || 0.5;
    const idx = params.index || 0;

    const frame = {...parentFrame};
    if (idx === 0) {
      frame.w = Math.round(parentFrame.w * pos);
    } else {
      frame.w = Math.round(parentFrame.w * (1 - pos));
      frame.x += parentFrame.w - frame.w;
    }
    return frame;
  },

  cornerBug_topRight: (parentFrame, params, layoutCtx) => {
    const margin = cornerBugMargin(layoutCtx);
    const {w, h} = cornerBugSize(params, layoutCtx);

    let {x, y} = parentFrame;
    x += parentFrame.w - w - margin;
    y += margin;

    return {x, y, w, h};
  },

  cornerBug_bottomLeft: (parentFrame, params, layoutCtx) => {
    const margin = cornerBugMargin(layoutCtx);
    const {w, h} = cornerBugSize(params, layoutCtx);

    let {x, y} = parentFrame;
    x += margin;
    y += parentFrame.h - h - margin;

    return {x, y, w, h};
  },

  pad: (parentFrame, params, layoutCtx) => {
    let {x, y, w, h} = parentFrame;
    const pad = params.pad || 0;

    x += pad;
    y += pad;
    w -= 2*pad;
    h -= 2*pad;

    return {x, y, w, h};
  },

  grid: (parentFrame, params, layoutCtx) => {
    const {index, total} = params;
    const {viewport} = layoutCtx;

    if (total < 1 || !isFinite(total)) {
      return {...parentFrame};
    }

    const outerMargin = total > 1 ? viewport.h*0.05 : 0;
    const innerMargin = total > 1 ? viewport.h*0.05 : 0;

    const numCols = (total > 9) ? 4 : (total > 4) ? 3 : (total > 1) ? 2 : 1;
    const numRows = Math.ceil(total / numCols);

    // for proto, hardcoded video item aspect ratio
    const videoAsp = 16 / 9;
    const parentAsp = parentFrame.w / parentFrame.h;
    const contentAsp = (numCols*videoAsp) / numRows;

    let {x, y, w, h} = parentFrame;
    let itemW, itemH;

    // item size depends on whether our content is wider or narrower than the parent frame
    if (contentAsp >= parentAsp) {
      itemW = (parentFrame.w - 2*outerMargin - (numCols - 1)*innerMargin) / numCols;
      itemH = itemW / videoAsp;

      // center grid vertically
      x += outerMargin;
      y += (parentFrame.h - (numRows*itemH + innerMargin*(numRows - 1))) / 2;  
    } else {
      itemH = (parentFrame.h - 2*outerMargin - (numRows - 1)*innerMargin) / numRows;
      itemW = itemH * videoAsp;

      // center grid horizontally
      y += outerMargin;
      x += (parentFrame.w - (numCols*itemW + innerMargin*(numCols - 1))) / 2;  
    }

    const col = index % numCols;
    const row = Math.floor(index / numCols);

    x += col * itemW;
    x += col * innerMargin;

    y += row * itemH;
    y += row * innerMargin;

    w = itemW;
    h = itemH;

    //console.log("computing grid %d / %d, rows/cols %d, %d: ", index, total, numRows, numCols, x, y);

    return {x, y, w, h};
  },
};

function cornerBugSize(params, layoutCtx) {
  // 'size' param is in proportion to viewport height
  const h = layoutCtx.viewport.h * params.size;
  const w = h;
  return {w, h};
}

function cornerBugMargin(layoutCtx) {
  return layoutCtx.viewport.h * 0.05;
}
