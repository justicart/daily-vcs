import * as React from 'react';
import {Box, Image, Label, Video} from '#vcs-react/components';
import {useParams, useMode, useVideoTime, useVideoCall} from '#vcs-react/hooks';


// -- the control interface exposed by this composition --
export const compositionInterface = {
  displayMeta: {
    name: "Daily Baseline",
    description: "Composition with Daily's baseline features",
  },
  modes: [
    "single",
    "split",
    "grid",
    "dominant",
  ],
  params: [
    {
      id: "showParticipantLabels",
      type: "boolean",
      defaultValue: false,
    },
    {
      id: "roundedCorners",
      type: "boolean",
      defaultValue: false,
    },
    {
      id: "dominantOnLeft",
      type: "boolean",
      defaultValue: false,
    },
    {
      id: "showTextOverlay",
      type: "boolean",
      defaultValue: false,
    },
    {
      id: "textContent",
      type: "text",
      defaultValue: "An example text overlay",
    },
    {
      id: "textPos_x",
      type: "text",
      defaultValue: 100,
    },
    {
      id: "textPos_y",
      type: "text",
      defaultValue: 100,
    },
    {
      id: "textColor",
      type: "text",
      defaultValue: "rgba(255, 250, 200, 0.95)",
    },
  ]
};


// -- the root component of this composition --
export default function DailyBaselineVCS() {
  const params = useParams();
  
  const mode = useMode();

  const videoProps = {
    roundedCorners: params.roundedCorners,
    showLabels: params.showParticipantLabels,
  };
  let video;
  switch (mode) {
    default:
    case 'single':
      video = <VideoSingle {...videoProps} />;
      break;
    case 'grid':
      video = <VideoGrid {...videoProps} />;
      break;
    case 'split':
    case 'dominant':
      console.log(`mode ${mode} not implemented yet`);
      break;
  }

  let graphics;
  if (params.showTextOverlay) {
    const overlayProps = {
      content: params.textContent,
      x: parseInt(params.textPos_x, 10),
      y: parseInt(params.textPos_y, 10),
      color: params.textColor,
    };
    graphics = <TextOverlay {...overlayProps} />;
  }
  
  return (
    <Box id="main">
      <Box id="videoBox">
        {video}
      </Box>
      <Box id="graphicsBox">
        {graphics}
      </Box>
    </Box>
  )
}


// --- components ---

const DEFAULT_CORNER_RADIUS_PX = 25;

function VideoSingle({
  roundedCorners
}) {
  const {activeParticipants} = useVideoCall();

  let activeIdx = -1;
  for (let i = 0; i < activeParticipants.length; i++) {
    if (activeParticipants[i]) {
      activeIdx = i;
      break;
    }
  }

  if (activeIdx < 0) {
    // if nobody is active, show a placeholder
    return <Box style={{fillColor: '#008'}} />;
  }

  const videoStyle = {
    cornerRadius_px: roundedCorners ? DEFAULT_CORNER_RADIUS_PX : 0
  };
  return <Video src={activeIdx} style={videoStyle} />;  
}

function VideoGrid({
  showLabels,
  roundedCorners
}) {
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

  const labelStyle = {
    textColor: 'white',
    fontFamily: 'Roboto',
    fontWeight: '600',
    fontSize_px: 16
  };
  const videoStyle = {
    cornerRadius_px: roundedCorners ? DEFAULT_CORNER_RADIUS_PX : 0
  };

  const items = activeIndexes.map((srcIdx, i) => {
    const key = 'videogrid_item'+i;

    let participantLabel;
    if (showLabels && n > 1) {
      participantLabel =
        <Label style={labelStyle} layout={[layoutFuncs.offset, {y: -18}]}>
          {`Participant ${srcIdx + 1}`}
        </Label>;
    }

    return (
      <Box
        key={key} id={key}
        layout={[layoutFuncs.grid, {index: i, total: n}]}
      >
        <Video src={srcIdx} style={videoStyle} />
        {participantLabel}
      </Box>
    );
  });

  return (
    <Box id="videogrid">
      {items}
    </Box>
  );
}

function TextOverlay({
  content, x, y, color
}) {
  const textStyle = {
    textColor: color || 'rgba(255, 250, 200, 0.95)',
    fontFamily: 'Roboto',
    fontWeight: '500',
    fontSize_vh: 0.07,
    strokeColor: 'rgba(0, 0, 0, 0.8)',
    strokeWidth_px: 12,
  };

  const layoutFn = layoutFuncs.offset;
  const layoutParams = {x, y};

  return <Label
    style={textStyle}
    layout={[layoutFn, layoutParams]}
  >{content || ''}</Label>;
}


function TimedExampleGraphics({
  onSide,
  layout: baseLayout,
  demoText,
  roundedCorners
}) {
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
    textColor: 'rgba(255, 250, 200, 0.95)',
    fontFamily: 'Roboto',
    fontWeight: '300',
    fontSize_vh: onSide ? 0.05 : 0.07,
    //strokeColor: 'rgba(0, 0, 0, 0.95)',
    //strokeWidth_px: 12,
  };
  const textLayoutFn = layoutFuncs.pad;
  const textPad_px = 20;

  const boxStyle = {
    fillColor: 'rgba(50, 70, 255, 0.7)',
    //strokeColor: 'rgba(255, 255, 255, 0.8)',
    //strokeWidth_px: 4,
  };
  let boxOuterPad = 0;
  if (roundedCorners) {
    boxStyle.cornerRadius_px = DEFAULT_CORNER_RADIUS_PX;
    boxOuterPad = 20;
  }

  return (
    <Box layout={[layoutFuncs.pad, {pad: boxOuterPad}]}>
      <Box id="graphicsBox" style={boxStyle} layout={baseLayout}>
        <Label style={textStyle} layout={[textLayoutFn, {pad: textPad_px}]}>{demoText}</Label>
        <Image src="test_square" layout={[imageLayoutFn, {size: imageSize}]} />
      </Box>
    </Box>
  );
}


// --- layout functions and utils ---

const layoutFuncs = {

  pad: (parentFrame, params) => {
    let {x, y, w, h} = parentFrame;
    const pad = params.pad || 0;

    x += pad;
    y += pad;
    w -= 2*pad;
    h -= 2*pad;

    return {x, y, w, h};
  },

  offset: (parentFrame, params) => {
    let {x, y, w, h} = parentFrame;
    
    x += params.x || 0;
    y += params.y || 0;

    return {x, y, w, h};
  },


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