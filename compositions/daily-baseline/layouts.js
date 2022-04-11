import { PositionEdge, PositionCorner } from './constants.js';

// --- layout functions and utils ---

export function pad(parentFrame, params, layoutCtx) {
  let { x, y, w, h } = parentFrame;

  let padL = 0,
    padR = 0,
    padT = 0,
    padB = 0;

  // padding can be specified as either a value or an object with l/r/t/b
  if (Number.isFinite(params.pad)) {
    padL = padR = padT = padB = params.pad;
  } else if (typeof params.pad_viewportRelative === 'object') {
    const { viewport } = layoutCtx;
    let { l, r, t, b } = params.pad_viewportRelative;

    if (Number.isFinite(l)) padL = l * viewport.w;
    if (Number.isFinite(r)) padR = r * viewport.w;
    if (Number.isFinite(t)) padT = t * viewport.h;
    if (Number.isFinite(b)) padB = b * viewport.h;
  }

  x += padL;
  y += padT;
  w -= padL + padR;
  h -= padT + padB;

  return { x, y, w, h };
}

export function offset(parentFrame, params) {
  let { x, y, w, h } = parentFrame;

  x += params.x || 0;
  y += params.y || 0;

  return { x, y, w, h };
}

export function fit(parentFrame, params) {
  let contentAsp = params.contentAspectRatio;
  if (!Number.isFinite(contentAsp)) {
    // we can't fit without knowing the aspect ratio
    return { ...parentFrame };
  }

  let { x, y, w, h } = parentFrame;
  const parentAsp = w / h;

  if (contentAsp >= parentAsp) {
    // content is wider than frame
    h = w / contentAsp;

    y += (parentFrame.h - h) / 2;
  } else {
    // content is narrower than frame
    w = h * contentAsp;

    x += (parentFrame.w - w) / 2;
  }

  return { x, y, w, h };
}

export function placeText(parentFrame, params, layoutCtx) {
  let { x, y, w, h } = parentFrame;
  const textSize = layoutCtx.useIntrinsicSize();

  w = textSize.w;
  h = textSize.h;

  let xOff = params.xOffset || 0;
  let yOff = params.yOffset || 0;

  switch (params.vAlign) {
    default:
    case 'top':
      break;

    case 'bottom':
      y += parentFrame.h - h;
      yOff = -yOff; // flip offset direction
      break;

    case 'center':
      y += (parentFrame.h - h) / 2;
      break;
  }

  x += xOff;
  y += yOff;
  return { x, y, w, h };
}

export function splitVertical(parentFrame, params) {
  let { index, pos = 0.5 } = params;
  let { x, y, w, h } = parentFrame;

  if (index === 0) {
    w *= pos;
  } else {
    w *= 1 - pos;
    x += parentFrame.w * pos;
  }

  return { x, y, w, h };
}

export function splitHorizontal(parentFrame, params) {
  let { index, pos = 0.5 } = params;
  let { x, y, w, h } = parentFrame;

  if (index === 0) {
    h *= pos;
  } else {
    h *= 1 - pos;
    y += parentFrame.h * pos;
  }

  return { x, y, w, h };
}

export function splitAcrossLongerDimension(parentFrame, params, layoutCtx) {
  const { viewport } = layoutCtx;
  const asp = viewport.w / viewport.h;
  if (asp >= 1) {
    return splitVertical(parentFrame, params);
  } else {
    return splitHorizontal(parentFrame, params);
  }
}

export function column(parentFrame, params, layoutCtx) {
  const { index, total, makeRow = false } = params;
  const { viewport } = layoutCtx;
  const outputAsp = viewport.w / viewport.h;

  let outerMargins = { x: 0, y: 0 },
    innerMargins = { x: 0, y: 0 };
  if (total > 1) {
    let marginRel; // a relative margin depending on aspect ratio
    if (outputAsp > 1) {
      marginRel = Math.round(viewport.h * 0.02);
    } else if (outputAsp <= 1) {
      marginRel = viewport.w * 0.04;
    }
    innerMargins.x = innerMargins.y = marginRel;
    outerMargins.x = outerMargins.y = marginRel * 0.75;
  }

  const numCols = makeRow ? total : 1;
  const numRows = makeRow ? 1 : total;

  // assume video item aspect ratio is same as output
  const videoAsp = outputAsp;

  // apply outer margins by insetting frame
  parentFrame = { ...parentFrame };
  parentFrame.x += outerMargins.x;
  parentFrame.y += outerMargins.y;
  parentFrame.w -= outerMargins.x * 2;
  parentFrame.h -= outerMargins.y * 2;

  return computeGridItem({
    parentFrame,
    index,
    numCols,
    numRows,
    videoAsp,
    innerMargins,
  });
}

export function grid(parentFrame, params, layoutCtx) {
  const { index, total } = params;
  const { viewport } = layoutCtx;
  const outputAsp = viewport.w / viewport.h;

  if (total < 1 || !isFinite(total)) {
    return { ...parentFrame };
  }

  const numCols =
    total > 16 ? 5 : total > 9 ? 4 : total > 4 ? 3 : total > 1 ? 2 : 1;
  const numRows = Math.ceil(total / numCols);

  let outerMargins = { x: 0, y: 0 },
    innerMargins = { x: 0, y: 0 };
  if (total > 1) {
    let marginRel; // a relative margin depending on aspect ratio
    if (outputAsp > 1) {
      marginRel = Math.round(viewport.h * 0.05);
    } else if (outputAsp <= 1) {
      marginRel = viewport.w * 0.04;
    }
    innerMargins.x = innerMargins.y = marginRel;

    if (numCols === numRows) {
      // when layout is tight, leave space in vertical margins for participant labels
      if (outputAsp > 1) {
        outerMargins.y = Math.round(marginRel * 0.7);
      } else {
        outerMargins.y = Math.round(marginRel * 1);
      }
    }
  }

  // assume video item aspect ratio is same as output
  const videoAsp = outputAsp;

  // apply outer margins by insetting frame
  parentFrame = { ...parentFrame };
  parentFrame.x += outerMargins.x;
  parentFrame.y += outerMargins.y;
  parentFrame.w -= outerMargins.x * 2;
  parentFrame.h -= outerMargins.y * 2;

  return computeGridItem({
    parentFrame,
    index,
    numCols,
    numRows,
    videoAsp,
    innerMargins,
  });
}

export function gridLabel(parentFrame, params) {
  const { textH = 0, offsets = {} } = params;
  let { x, y, w, h } = parentFrame;

  y += h + Math.round(textH * 0.1);

  if (Number.isFinite(offsets.x)) x += offsets.x;
  if (Number.isFinite(offsets.y)) y += offsets.y;

  return { x, y, w, h };
}

export function pip(parentFrame, params, layoutCtx) {
  let { x, y, w, h } = parentFrame;
  const {
    positionCorner = PositionCorner.TOP_LEFT,
    aspectRatio = 1,
    height_vh = 0.2,
    margin_vh = 0,
  } = params;
  const { viewport } = layoutCtx;
  const margin = margin_vh * viewport.h;

  h = Math.round(height_vh * viewport.h);
  w = Math.round(aspectRatio * h);

  if (
    positionCorner === PositionCorner.TOP_LEFT ||
    positionCorner === PositionCorner.TOP_RIGHT
  ) {
    y += margin;
  } else {
    y += parentFrame.h - h - margin;
  }

  if (
    positionCorner === PositionCorner.TOP_LEFT ||
    positionCorner === PositionCorner.BOTTOM_LEFT
  ) {
    x += margin;
  } else {
    x += parentFrame.w - w - margin;
  }

  return { x, y, w, h };
}

export function pausedPlaceholderIcon(parentFrame) {
  let { x, y, w, h } = parentFrame;
  w = h = 32;
  x += (parentFrame.w - w) / 2;
  y += (parentFrame.h - h) / 2;
  return { x, y, w, h };
}

// -- utils --

function computeGridItem({
  parentFrame,
  index,
  numCols,
  numRows,
  videoAsp,
  innerMargins,
}) {
  const parentAsp = parentFrame.w / parentFrame.h;
  const contentAsp = (numCols * videoAsp) / numRows;

  let { x, y, w, h } = parentFrame;
  let itemW, itemH;

  // item size depends on whether our content is wider or narrower than the parent frame
  if (contentAsp >= parentAsp) {
    itemW = (parentFrame.w - (numCols - 1) * innerMargins.x) / numCols;
    itemH = itemW / videoAsp;

    // center grid vertically
    y +=
      (parentFrame.h - (numRows * itemH + innerMargins.y * (numRows - 1))) / 2;
  } else {
    itemH = (parentFrame.h - (numRows - 1) * innerMargins.y) / numRows;
    itemW = itemH * videoAsp;

    // center grid horizontally
    x +=
      (parentFrame.w - (numCols * itemW + innerMargins.x * (numCols - 1))) / 2;
  }

  const col = index % numCols;
  const row = Math.floor(index / numCols);

  x += col * itemW;
  x += col * innerMargins.x;

  y += row * itemH;
  y += row * innerMargins.y;

  w = itemW;
  h = itemH;

  x = Math.round(x);
  y = Math.round(y);
  w = Math.ceil(w);
  h = Math.ceil(h);

  //console.log("computing grid %d / %d, rows/cols %d, %d: ", index, total, numRows, numCols, x, y);

  return { x, y, w, h };
}

function getLineH(params, layoutCtx) {
  if (params.fontSize_px) {
    return params.fontSize_px;
  }
  const { viewport } = layoutCtx;
  const { fontSize_vh = 0.05 } = params;

  return fontSize_vh * viewport.h;
}

export function toast(parentFrame, params, layoutCtx) {
  const lineH = getLineH(params, layoutCtx);
  let { x, y, w, h } = parentFrame;

  const { textLength = 20, maxLinesOfText = 2 } = params;
  const { viewport } = layoutCtx;
  const asp = viewport.w / viewport.h;

  let relW;
  if (asp > 1) {
    // very basic adaptation to text length.
    // this will be replaced with real text measurement when two-pass layout is available.
    relW = textLength > 32 ? 0.7 : textLength > 16 ? 0.45 : 0.33;
  } else {
    relW = asp < 0.8 ? 0.9 : 0.8;
  }

  w = Math.round(parentFrame.w * relW);
  h = lineH * (2 + Math.max(maxLinesOfText, 1));

  const margin = lineH * 1;

  x += parentFrame.w - w - margin;
  y += margin;

  const pad = lineH * 0.5;

  return { x, y, w, h, pad };
}

export function toastIcon(parentFrame, params) {
  let { x, y, w, h } = parentFrame;

  const iconSize = h;
  w = iconSize;

  const lMargin = 8;
  x += lMargin;

  return { x, y, w, h };
}

export function toastText(parentFrame, params, layoutCtx) {
  const lineH = getLineH(params, layoutCtx);
  const { actualLinesOfText = 1, showIcon = true } = params;
  let { x, y, w, h } = parentFrame;

  if (showIcon) {
    const iconSize = h;
    const iconMargin = 20;
    x += iconSize + iconMargin;
    w -= iconSize + iconMargin;
  }

  // add default margin
  const lMargin = 8;
  x += lMargin;
  w -= lMargin;

  const textH = Math.max(actualLinesOfText, 1) * lineH;
  y += (parentFrame.h - textH) / 2;

  return { x, y, w, h };
}
