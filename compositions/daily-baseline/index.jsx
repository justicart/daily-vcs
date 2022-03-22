import * as React from 'react';
import { Box } from '#vcs-react/components';
import { useParams } from '#vcs-react/hooks';

import {
  DEFAULT_FONT,
  DEFAULT_LABEL_FONT_SIZE_PX,
  DEFAULT_CORNER_RADIUS_PX,
  PositionEdge,
  PositionCorner,
} from './constants';

import CustomOverlay from './components/CustomOverlay';
import TextOverlay from './components/TextOverlay';
import VideoDominant from './components/VideoDominant';
import VideoGrid from './components/VideoGrid';
import VideoPip from './components/VideoPip';
import VideoSingle from './components/VideoSingle';
import VideoSplit from './components/VideoSplit';

// request all standard fonts
const fontFamilies = [
  'Roboto',
  'RobotoCondensed',
  'Anton',
  'Bangers',
  'Bitter',
  'Exo',
  'Magra',
  'PermanentMarker',
  'SuezOne',
  'Teko',
];
// fonts that are legible at a small size (for participant labels)
const fontFamilies_smallSizeFriendly = [
  'Roboto',
  'RobotoCondensed',
  'Bitter',
  'Exo',
  'Magra',
  'SuezOne',
  'Teko',
];
// not all fonts have every weight,
// but we can't currently filter the UI based on the font name
const fontWeights = [
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
];

// -- the control interface exposed by this composition --
export const compositionInterface = {
  displayMeta: {
    name: 'Daily Baseline',
    description: "Composition with Daily's baseline features",
  },
  fontFamilies,
  params: [
    // -- composition's video layout mode --
    {
      id: 'mode',
      type: 'enum',
      defaultValue: 'grid',
      values: ['single', 'split', 'grid', 'dominant', 'pip'],
    },
    {
      id: 'showTextOverlay',
      type: 'boolean',
      defaultValue: false,
    },
    // -- video layout params --
    {
      id: 'videoSettings.showParticipantLabels',
      type: 'boolean',
      defaultValue: false,
    },
    {
      id: 'videoSettings.roundedCorners',
      type: 'boolean',
      defaultValue: false,
    },
    {
      id: 'videoSettings.scaleMode',
      type: 'enum',
      defaultValue: 'fill',
      values: ['fill', 'fit'],
    },
    {
      id: 'videoSettings.placeholder.bgColor',
      type: 'text',
      defaultValue: 'rgb(0, 50, 80)',
    },
    {
      id: 'videoSettings.dominant.position',
      type: 'enum',
      defaultValue: PositionEdge.LEFT,
      values: Object.values(PositionEdge),
    },
    {
      id: 'videoSettings.dominant.splitPos',
      type: 'number',
      defaultValue: 0.8,
      step: 0.1,
    },
    {
      id: 'videoSettings.dominant.numChiclets',
      type: 'number',
      defaultValue: 5,
    },
    {
      id: 'videoSettings.pip.position',
      type: 'enum',
      defaultValue: PositionCorner.TOP_RIGHT,
      values: Object.values(PositionCorner),
    },
    {
      id: 'videoSettings.pip.aspectRatio',
      type: 'number',
      defaultValue: 1,
      step: 0.1,
    },
    {
      id: 'videoSettings.pip.height_vh',
      type: 'number',
      defaultValue: 0.3,
      step: 0.1,
    },
    {
      id: 'videoSettings.pip.margin_vh',
      type: 'number',
      defaultValue: 0.04,
      step: 0.01,
    },
    {
      id: 'videoSettings.labels.fontFamily',
      type: 'enum',
      defaultValue: fontFamilies_smallSizeFriendly[0],
      values: fontFamilies_smallSizeFriendly,
    },
    {
      id: 'videoSettings.labels.fontWeight',
      type: 'enum',
      defaultValue: '600',
      values: fontWeights,
    },
    {
      id: 'videoSettings.labels.fontSize_pct',
      type: 'number',
      defaultValue: 100,
    },
    {
      id: 'videoSettings.labels.offset_x',
      type: 'number',
      defaultValue: 0,
    },
    {
      id: 'videoSettings.labels.offset_y',
      type: 'number',
      defaultValue: 0,
    },
    {
      id: 'videoSettings.labels.color',
      type: 'text',
      defaultValue: 'white',
    },
    {
      id: 'videoSettings.labels.strokeColor',
      type: 'text',
      defaultValue: 'rgba(0, 0, 0, 0.9)',
    },

    // -- text overlay params --
    {
      id: 'text.content',
      type: 'text',
      defaultValue: 'An example text overlay',
      //'An example text overlay\nwith line breaks\nThis third line is very long dolor sit amet lorem ipsum, and the line ends here.',
    },
    {
      id: 'text.align_horizontal',
      type: 'enum',
      defaultValue: 'center',
      values: ['left', 'right', 'center'],
    },
    {
      id: 'text.align_vertical',
      type: 'enum',
      defaultValue: 'center',
      values: ['top', 'bottom', 'center'],
    },
    {
      id: 'text.offset_x',
      type: 'number',
      defaultValue: 0,
    },
    {
      id: 'text.offset_y',
      type: 'number',
      defaultValue: 0,
    },
    {
      id: 'text.rotationInDegrees',
      type: 'number',
      defaultValue: 0,
    },
    {
      id: 'text.fontFamily',
      type: 'enum',
      defaultValue: fontFamilies[0],
      values: fontFamilies,
    },
    {
      id: 'text.fontWeight',
      type: 'enum',
      defaultValue: '400',
      values: fontWeights,
    },
    {
      id: 'text.fontStyle',
      type: 'enum',
      defaultValue: '',
      values: ['normal', 'italic'],
    },
    {
      id: 'text.fontSize_percentageOfViewH',
      type: 'number',
      defaultValue: 7,
    },
    {
      id: 'text.color',
      type: 'text',
      defaultValue: 'rgba(255, 250, 200, 0.95)',
    },
    {
      id: 'text.strokeColor',
      type: 'text',
      defaultValue: 'rgba(0, 0, 0, 0.8)',
    },
  ],
};

// -- the root component of this composition --
export default function DailyBaselineVCS() {
  const params = useParams();

  // style applied to video elements.
  // placeholder is used if no video is available.
  const videoStyle = {
    cornerRadius_px: params['videoSettings.roundedCorners']
      ? DEFAULT_CORNER_RADIUS_PX
      : 0,
  };
  const placeholderStyle = {
    fillColor: params['videoSettings.placeholder.bgColor'] || '#008',
    cornerRadius_px: videoStyle.cornerRadius_px,
  };
  const videoLabelStyle = {
    textColor: params['videoSettings.labels.color'] || 'white',
    fontFamily: params['videoSettings.labels.fontFamily'] || DEFAULT_FONT,
    fontWeight: params['videoSettings.labels.fontWeight'] || '600',
    fontSize_px: params['videoSettings.labels.fontSize_pct']
      ? (params['videoSettings.labels.fontSize_pct'] / 100) *
        DEFAULT_LABEL_FONT_SIZE_PX
      : DEFAULT_LABEL_FONT_SIZE_PX,
    strokeColor:
      params['videoSettings.labels.strokeColor'] || 'rgba(0, 0, 0, 0.9)',
    strokeWidth_px: 4,
  };

  // props passed to the video layout component
  const videoProps = {
    videoStyle,
    placeholderStyle,
    videoLabelStyle,
    showLabels: params['videoSettings.showParticipantLabels'],
    scaleMode: params['videoSettings.scaleMode'],
    labelsOffset_px: {
      x: params['videoSettings.labels.offset_x']
        ? parseInt(params['videoSettings.labels.offset_x'], 10)
        : 0,
      y: params['videoSettings.labels.offset_y']
        ? parseInt(params['videoSettings.labels.offset_y'], 10)
        : 0,
    },
  };
  let video;
  switch (params.mode) {
    default:
    case 'single':
      video = <VideoSingle {...videoProps} />;
      break;
    case 'grid':
      video = <VideoGrid {...videoProps} />;
      break;
    case 'split':
      video = <VideoSplit {...videoProps} />;
      break;
    case 'pip':
      video = (
        <VideoPip
          {...videoProps}
          positionCorner={params['videoSettings.pip.position']}
          aspectRatio={params['videoSettings.pip.aspectRatio']}
          height_vh={params['videoSettings.pip.height_vh']}
          margin_vh={params['videoSettings.pip.margin_vh']}
        />
      );
      break;
    case 'dominant':
      video = (
        <VideoDominant
          {...videoProps}
          positionEdge={params['videoSettings.dominant.position']}
          splitPos={params['videoSettings.dominant.splitPos']}
          maxItems={params['videoSettings.dominant.numChiclets']}
        />
      );
      break;
  }

  let graphics = [];
  if (params.showTextOverlay) {
    // copy params to props and ensure types are what the component expects
    let overlayProps = params.text ? { ...params.text } : {};
    overlayProps.offset_x = parseInt(overlayProps.offset_x, 10);
    overlayProps.offset_y = parseInt(overlayProps.offset_y, 10);
    overlayProps.rotationInDegrees = parseFloat(overlayProps.rotationInDegrees);

    const fontSize_vh_pct = parseFloat(overlayProps.fontSize_percentageOfViewH);
    overlayProps.fontSize_vh =
      fontSize_vh_pct > 0 ? fontSize_vh_pct / 100 : null;

    overlayProps.color = overlayProps.color ? overlayProps.color.trim() : null;

    overlayProps.strokeColor = overlayProps.strokeColor
      ? overlayProps.strokeColor.trim()
      : null;
    overlayProps.useStroke =
      overlayProps.strokeColor && overlayProps.strokeColor.length > 0;

    graphics.push(<TextOverlay key={0} {...overlayProps} />);
  }
  graphics.push(<CustomOverlay key={1} />);

  return (
    <Box id="main">
      <Box id="videoBox">{video}</Box>
      <Box id="graphicsBox">{graphics}</Box>
    </Box>
  );
}
