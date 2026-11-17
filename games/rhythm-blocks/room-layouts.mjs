/** Upgrade untouched published layouts while retaining every authored scene or path edit. */
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {ROOM_CUTSCENES} from './cutscene-content.mjs';
import {ROOM_LAYOUTS,ROOM_LAYOUT_REVISION} from './room-layout-config.mjs';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const stable=value=>Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')}}`:JSON.stringify(value);
const same=(left,right)=>stable(left)===stable(right);
const jsonClone=value=>JSON.parse(JSON.stringify(value));
export const VARIED_ROOM_IDS=Object.freeze(Object.keys(ROOM_LAYOUTS));
export {ROOM_LAYOUT_REVISION};

// These exact prior defaults make a custom art, geometry, actor, mask or path edit
// an opt-out. Dialogue wording and its placement are independent authoring data.
export const PREVIOUS_ROOM_LAYOUT_SCENES=freeze({
 "garden-fork": {
  "id": "garden-fork",
  "title": "The Two Garden Paths",
  "kind": "room",
  "image": "assets/rooms/garden-fork.webp",
  "actors": [
   {
    "id": "nell",
    "character": "nell",
    "feet": {
     "x": 470,
     "y": 650
    },
    "worldSize": 160
   },
   {
    "id": "iris",
    "character": "iris",
    "feet": {
     "x": 790,
     "y": 550
    },
    "worldSize": 160
   },
   {
    "id": "pip",
    "character": "pip",
    "feet": {
     "x": 1090,
     "y": 680
    },
    "worldSize": 160
   }
  ],
  "geometry": {
   "width": 1536,
   "height": 1024,
   "gridSize": 32,
   "radius": 18,
   "speed": 260,
   "maxDeltaMs": 50,
   "bounds": {
    "x": 48,
    "y": 300,
    "width": 1440,
    "height": 678
   },
   "start": {
    "x": 768,
    "y": 920,
    "facing": "up"
   },
   "obstacles": [
    {
     "id": "nell",
     "x": 435,
     "y": 624,
     "width": 70,
     "height": 26
    },
    {
     "id": "iris",
     "x": 755,
     "y": 524,
     "width": 70,
     "height": 26
    },
    {
     "id": "pip",
     "x": 1055,
     "y": 654,
     "width": 70,
     "height": 26
    },
    {
     "id": "garden-fork-shared-can-base",
     "x": 85,
     "y": 870,
     "width": 195,
     "height": 35
    },
    {
     "id": "garden-fork-wind-cups-base",
     "x": 1250,
     "y": 865,
     "width": 215,
     "height": 35
    }
   ],
   "targets": [
    {
     "id": "garden-normal",
     "type": "door",
     "label": "Inspect the hearth path",
     "x": 490,
     "y": 300,
     "approach": {
      "x": 490,
      "y": 360
     },
     "range": 100
    },
    {
     "id": "garden-secret-branch",
     "type": "door",
     "label": "Inspect the old stone path",
     "x": 1045,
     "y": 300,
     "approach": {
      "x": 1045,
      "y": 360
     },
     "range": 100
    },
    {
     "id": "nell",
     "type": "person",
     "label": "Talk to Nell",
     "x": 470,
     "y": 650,
     "approach": {
      "x": 470,
      "y": 715
     },
     "range": 100
    },
    {
     "id": "iris",
     "type": "person",
     "label": "Talk to Iris",
     "x": 790,
     "y": 550,
     "approach": {
      "x": 790,
      "y": 615
     },
     "range": 100
    },
    {
     "id": "pip",
     "type": "person",
     "label": "Talk to Pip",
     "x": 1090,
     "y": 680,
     "approach": {
      "x": 1090,
      "y": 745
     },
     "range": 100
    },
    {
     "id": "garden-fork-shared-can",
     "type": "inspect",
     "label": "Inspect the shared watering can",
     "x": 180,
     "y": 905,
     "approach": {
      "x": 355,
      "y": 905
     },
     "range": 195
    },
    {
     "id": "garden-fork-buried-ring",
     "type": "inspect",
     "label": "Inspect the buried paving ring",
     "x": 1380,
     "y": 300,
     "approach": {
      "x": 1380,
      "y": 375
     },
     "range": 105
    },
    {
     "id": "garden-fork-wind-cups",
     "type": "inspect",
     "label": "Inspect the listening cups",
     "x": 1365,
     "y": 900,
     "approach": {
      "x": 1180,
      "y": 900
     },
     "range": 205
    },
    {
     "id": "return-previous",
     "type": "return",
     "label": "Revisit the previous room",
     "x": 768,
     "y": 960,
     "approach": {
      "x": 768,
      "y": 910
     },
     "range": 85
    }
   ]
  },
  "objects": [
   {
    "id": "garden-normal",
    "type": "door",
    "label": "The hearth path",
    "rect": {
     "x": 400,
     "y": 45,
     "width": 180,
     "height": 255
    },
    "doorId": "garden-normal",
    "actionLabel": "Inspect the hearth path"
   },
   {
    "id": "garden-secret-branch",
    "type": "door",
    "label": "The old stone path",
    "rect": {
     "x": 955,
     "y": 45,
     "width": 180,
     "height": 255
    },
    "doorId": "garden-secret-branch",
    "actionLabel": "Inspect the old stone path"
   },
   {
    "id": "nell",
    "type": "person",
    "label": "Nell",
    "rect": {
     "x": 406,
     "y": 490,
     "width": 128,
     "height": 166
    },
    "personId": "nell",
    "actionLabel": "Talk to Nell"
   },
   {
    "id": "iris",
    "type": "person",
    "label": "Iris",
    "rect": {
     "x": 726,
     "y": 390,
     "width": 128,
     "height": 166
    },
    "personId": "iris",
    "actionLabel": "Talk to Iris"
   },
   {
    "id": "pip",
    "type": "person",
    "label": "Pip",
    "rect": {
     "x": 1026,
     "y": 520,
     "width": 128,
     "height": 166
    },
    "personId": "pip",
    "actionLabel": "Talk to Pip"
   },
   {
    "id": "garden-fork-shared-can",
    "type": "inspect",
    "label": "The shared watering can",
    "rect": {
     "x": 45,
     "y": 700,
     "width": 255,
     "height": 215
    },
    "actionLabel": "Inspect the shared watering can"
   },
   {
    "id": "garden-fork-buried-ring",
    "type": "inspect",
    "label": "The buried paving ring",
    "rect": {
     "x": 1280,
     "y": 180,
     "width": 205,
     "height": 125
    },
    "actionLabel": "Inspect the buried paving ring"
   },
   {
    "id": "garden-fork-wind-cups",
    "type": "inspect",
    "label": "The listening cups",
    "rect": {
     "x": 1225,
     "y": 685,
     "width": 270,
     "height": 225
    },
    "actionLabel": "Inspect the listening cups"
   },
   {
    "id": "return-previous",
    "type": "return",
    "label": "Revisit the previous room",
    "rect": {
     "x": 680,
     "y": 920,
     "width": 176,
     "height": 90
    },
    "actionLabel": "Revisit the previous room"
   }
  ],
  "occluders": [
   {
    "id": "watering-cart",
    "depth": 908,
    "clipPath": "path(evenodd,'M174,712 L204,712 L220,730 L239,746 L256,726 L274,735 L276,750 L241,778 L241,790 L281,789 L287,898 L273,906 L109,906 L100,896 L100,814 L69,813 L52,797 L60,749 L85,730 L119,739 L140,732 L146,721Z M157,735 L164,729 L189,725 L203,734 L205,741 L185,737 L168,741Z')"
   },
   {
    "id": "cup-table",
    "depth": 907,
    "clipPath": "path(evenodd,'M1358,697 L1376,691 L1391,696 L1410,690 L1427,701 L1448,703 L1459,722 L1476,746 L1470,774 L1490,796 L1486,812 L1494,854 L1477,863 L1483,895 L1455,907 L1254,905 L1236,897 L1246,861 L1243,837 L1238,811 L1257,799 L1258,779 L1271,772 L1293,771 L1303,779 L1337,779 L1345,770 L1358,751Z')"
   }
  ]
 },
 "workshop-fork": {
  "id": "workshop-fork",
  "title": "The Workshop Crossroads",
  "kind": "room",
  "image": "assets/rooms/workshop-fork.webp",
  "actors": [
   {
    "id": "nell",
    "character": "nell",
    "feet": {
     "x": 470,
     "y": 650
    },
    "worldSize": 160
   },
   {
    "id": "iris",
    "character": "iris",
    "feet": {
     "x": 790,
     "y": 550
    },
    "worldSize": 160
   },
   {
    "id": "pip",
    "character": "pip",
    "feet": {
     "x": 1090,
     "y": 680
    },
    "worldSize": 160
   }
  ],
  "geometry": {
   "width": 1536,
   "height": 1024,
   "gridSize": 32,
   "radius": 18,
   "speed": 260,
   "maxDeltaMs": 50,
   "bounds": {
    "x": 48,
    "y": 315,
    "width": 1440,
    "height": 663
   },
   "start": {
    "x": 768,
    "y": 920,
    "facing": "up"
   },
   "obstacles": [
    {
     "id": "nell",
     "x": 435,
     "y": 624,
     "width": 70,
     "height": 26
    },
    {
     "id": "iris",
     "x": 755,
     "y": 524,
     "width": 70,
     "height": 26
    },
    {
     "id": "pip",
     "x": 1055,
     "y": 654,
     "width": 70,
     "height": 26
    },
    {
     "id": "workshop-fork-help-shelf-base",
     "x": 85,
     "y": 835,
     "width": 190,
     "height": 40
    },
    {
     "id": "workshop-fork-worn-rail-base",
     "x": 1235,
     "y": 835,
     "width": 240,
     "height": 40
    }
   ],
   "targets": [
    {
     "id": "workshop-normal",
     "type": "door",
     "label": "Inspect the schoolroom stair",
     "x": 490,
     "y": 315,
     "approach": {
      "x": 490,
      "y": 375
     },
     "range": 100
    },
    {
     "id": "workshop-secret-branch",
     "type": "door",
     "label": "Inspect the birds’ back passage",
     "x": 1045,
     "y": 315,
     "approach": {
      "x": 1045,
      "y": 375
     },
     "range": 100
    },
    {
     "id": "nell",
     "type": "person",
     "label": "Talk to Nell",
     "x": 470,
     "y": 650,
     "approach": {
      "x": 470,
      "y": 715
     },
     "range": 100
    },
    {
     "id": "iris",
     "type": "person",
     "label": "Talk to Iris",
     "x": 790,
     "y": 550,
     "approach": {
      "x": 790,
      "y": 615
     },
     "range": 100
    },
    {
     "id": "pip",
     "type": "person",
     "label": "Talk to Pip",
     "x": 1090,
     "y": 680,
     "approach": {
      "x": 1090,
      "y": 745
     },
     "range": 100
    },
    {
     "id": "workshop-fork-help-shelf",
     "type": "inspect",
     "label": "Inspect the help shelf",
     "x": 170,
     "y": 875,
     "approach": {
      "x": 355,
      "y": 875
     },
     "range": 205
    },
    {
     "id": "workshop-fork-worn-rail",
     "type": "inspect",
     "label": "Inspect the back rail",
     "x": 1360,
     "y": 875,
     "approach": {
      "x": 1160,
      "y": 875
     },
     "range": 220
    },
    {
     "id": "workshop-fork-sound-screen",
     "type": "inspect",
     "label": "Inspect the silent sound screen",
     "x": 1365,
     "y": 315,
     "approach": {
      "x": 1365,
      "y": 390
     },
     "range": 105
    },
    {
     "id": "return-previous",
     "type": "return",
     "label": "Revisit the previous room",
     "x": 768,
     "y": 960,
     "approach": {
      "x": 768,
      "y": 910
     },
     "range": 85
    }
   ]
  },
  "objects": [
   {
    "id": "workshop-normal",
    "type": "door",
    "label": "The schoolroom stair",
    "rect": {
     "x": 400,
     "y": 45,
     "width": 180,
     "height": 270
    },
    "doorId": "workshop-normal",
    "actionLabel": "Inspect the schoolroom stair"
   },
   {
    "id": "workshop-secret-branch",
    "type": "door",
    "label": "The birds’ back passage",
    "rect": {
     "x": 955,
     "y": 45,
     "width": 180,
     "height": 270
    },
    "doorId": "workshop-secret-branch",
    "actionLabel": "Inspect the birds’ back passage"
   },
   {
    "id": "nell",
    "type": "person",
    "label": "Nell",
    "rect": {
     "x": 406,
     "y": 490,
     "width": 128,
     "height": 166
    },
    "personId": "nell",
    "actionLabel": "Talk to Nell"
   },
   {
    "id": "iris",
    "type": "person",
    "label": "Iris",
    "rect": {
     "x": 726,
     "y": 390,
     "width": 128,
     "height": 166
    },
    "personId": "iris",
    "actionLabel": "Talk to Iris"
   },
   {
    "id": "pip",
    "type": "person",
    "label": "Pip",
    "rect": {
     "x": 1026,
     "y": 520,
     "width": 128,
     "height": 166
    },
    "personId": "pip",
    "actionLabel": "Talk to Pip"
   },
   {
    "id": "workshop-fork-help-shelf",
    "type": "inspect",
    "label": "The help shelf",
    "rect": {
     "x": 40,
     "y": 640,
     "width": 260,
     "height": 245
    },
    "actionLabel": "Inspect the help shelf"
   },
   {
    "id": "workshop-fork-worn-rail",
    "type": "inspect",
    "label": "The back rail",
    "rect": {
     "x": 1195,
     "y": 650,
     "width": 310,
     "height": 235
    },
    "actionLabel": "Inspect the back rail"
   },
   {
    "id": "workshop-fork-sound-screen",
    "type": "inspect",
    "label": "The silent sound screen",
    "rect": {
     "x": 1240,
     "y": 165,
     "width": 245,
     "height": 140
    },
    "actionLabel": "Inspect the silent sound screen"
   },
   {
    "id": "return-previous",
    "type": "return",
    "label": "Revisit the previous room",
    "rect": {
     "x": 680,
     "y": 920,
     "width": 176,
     "height": 90
    },
    "actionLabel": "Revisit the previous room"
   }
  ],
  "occluders": [
   {
    "id": "help-shelf",
    "depth": 879,
    "clipPath": "path(evenodd,'M132,649 L150,649 L155,663 L172,667 L191,685 L193,756 L203,747 L215,730 L228,726 L230,743 L273,746 L290,761 L292,813 L280,818 L280,847 L265,849 L265,865 L249,879 L221,876 L219,851 L211,839 L199,836 L200,862 L184,874 L108,878 L69,864 L62,846 L45,850 L41,831 L49,804 L67,790 L77,789 L78,698 L90,677 L111,663Z M103,696 L104,752 L114,762 L115,690Z M166,697 L169,744 L180,743 L180,695Z')"
   },
   {
    "id": "worn-rail",
    "depth": 879,
    "clipPath": "path(evenodd,'M1456,666 L1474,666 L1489,679 L1481,693 L1454,696 L1444,715 L1446,746 L1474,752 L1489,766 L1488,813 L1500,833 L1492,858 L1480,864 L1480,877 L1242,879 L1224,875 L1212,862 L1204,839 L1208,815 L1227,802 L1226,764 L1243,750 L1247,725 L1236,716 L1237,703 L1310,677 L1325,687 L1324,698 L1317,709 L1316,748 L1345,747 L1347,714 L1331,706 L1336,691 L1385,676 L1403,682 L1406,698 L1393,708 L1393,748 L1427,747 L1426,721 L1439,688Z M1265,721 L1265,746 L1300,747 L1300,709Z M1361,714 L1361,747 L1378,747 L1378,710Z')"
   }
  ]
 },
 "canal-fork": {
  "id": "canal-fork",
  "title": "The Water Clock",
  "kind": "room",
  "image": "assets/rooms/canal-fork.webp",
  "actors": [
   {
    "id": "nell",
    "character": "nell",
    "feet": {
     "x": 470,
     "y": 650
    },
    "worldSize": 160
   },
   {
    "id": "iris",
    "character": "iris",
    "feet": {
     "x": 790,
     "y": 550
    },
    "worldSize": 160
   },
   {
    "id": "pip",
    "character": "pip",
    "feet": {
     "x": 1090,
     "y": 680
    },
    "worldSize": 160
   }
  ],
  "geometry": {
   "width": 1536,
   "height": 1024,
   "gridSize": 32,
   "radius": 18,
   "speed": 260,
   "maxDeltaMs": 50,
   "bounds": {
    "x": 48,
    "y": 355,
    "width": 1440,
    "height": 623
   },
   "start": {
    "x": 768,
    "y": 920,
    "facing": "up"
   },
   "obstacles": [
    {
     "id": "nell",
     "x": 435,
     "y": 624,
     "width": 70,
     "height": 26
    },
    {
     "id": "iris",
     "x": 755,
     "y": 524,
     "width": 70,
     "height": 26
    },
    {
     "id": "pip",
     "x": 1055,
     "y": 654,
     "width": 70,
     "height": 26
    },
    {
     "id": "canal-fork-waiting-drop-base",
     "x": 80,
     "y": 865,
     "width": 190,
     "height": 40
    },
    {
     "id": "rope-winch-base",
     "x": 1285,
     "y": 860,
     "width": 195,
     "height": 45
    }
   ],
   "targets": [
    {
     "id": "canal-normal",
     "type": "door",
     "label": "Inspect the town-bell stair",
     "x": 430,
     "y": 355,
     "approach": {
      "x": 430,
      "y": 415
     },
     "range": 100
    },
    {
     "id": "canal-dead",
     "type": "door",
     "label": "Inspect the copied waterway",
     "x": 1110,
     "y": 355,
     "approach": {
      "x": 1110,
      "y": 415
     },
     "range": 100
    },
    {
     "id": "nell",
     "type": "person",
     "label": "Talk to Nell",
     "x": 470,
     "y": 650,
     "approach": {
      "x": 470,
      "y": 715
     },
     "range": 100
    },
    {
     "id": "iris",
     "type": "person",
     "label": "Talk to Iris",
     "x": 790,
     "y": 550,
     "approach": {
      "x": 790,
      "y": 615
     },
     "range": 100
    },
    {
     "id": "pip",
     "type": "person",
     "label": "Talk to Pip",
     "x": 1090,
     "y": 680,
     "approach": {
      "x": 1090,
      "y": 745
     },
     "range": 100
    },
    {
     "id": "canal-fork-waiting-drop",
     "type": "inspect",
     "label": "Inspect the waiting drop",
     "x": 160,
     "y": 905,
     "approach": {
      "x": 340,
      "y": 905
     },
     "range": 200
    },
    {
     "id": "canal-fork-service-stool",
     "type": "inspect",
     "label": "Inspect the keeper’s stool",
     "x": 1365,
     "y": 355,
     "approach": {
      "x": 1365,
      "y": 430
     },
     "range": 105
    },
    {
     "id": "canal-fork-maintenance-map",
     "type": "inspect",
     "label": "Inspect the practical maintenance map",
     "x": 1390,
     "y": 355,
     "approach": {
      "x": 1390,
      "y": 430
     },
     "range": 105
    },
    {
     "id": "return-previous",
     "type": "return",
     "label": "Revisit the previous room",
     "x": 768,
     "y": 960,
     "approach": {
      "x": 768,
      "y": 910
     },
     "range": 85
    }
   ]
  },
  "objects": [
   {
    "id": "canal-normal",
    "type": "door",
    "label": "The town-bell stair",
    "rect": {
     "x": 340,
     "y": 45,
     "width": 180,
     "height": 310
    },
    "doorId": "canal-normal",
    "actionLabel": "Inspect the town-bell stair"
   },
   {
    "id": "canal-dead",
    "type": "door",
    "label": "The copied waterway",
    "rect": {
     "x": 1020,
     "y": 45,
     "width": 180,
     "height": 310
    },
    "doorId": "canal-dead",
    "actionLabel": "Inspect the copied waterway"
   },
   {
    "id": "nell",
    "type": "person",
    "label": "Nell",
    "rect": {
     "x": 406,
     "y": 490,
     "width": 128,
     "height": 166
    },
    "personId": "nell",
    "actionLabel": "Talk to Nell"
   },
   {
    "id": "iris",
    "type": "person",
    "label": "Iris",
    "rect": {
     "x": 726,
     "y": 390,
     "width": 128,
     "height": 166
    },
    "personId": "iris",
    "actionLabel": "Talk to Iris"
   },
   {
    "id": "pip",
    "type": "person",
    "label": "Pip",
    "rect": {
     "x": 1026,
     "y": 520,
     "width": 128,
     "height": 166
    },
    "personId": "pip",
    "actionLabel": "Talk to Pip"
   },
   {
    "id": "canal-fork-waiting-drop",
    "type": "inspect",
    "label": "The waiting drop",
    "rect": {
     "x": 40,
     "y": 650,
     "width": 240,
     "height": 265
    },
    "actionLabel": "Inspect the waiting drop"
   },
   {
    "id": "canal-fork-service-stool",
    "type": "inspect",
    "label": "The keeper’s stool",
    "rect": {
     "x": 1265,
     "y": 275,
     "width": 195,
     "height": 85
    },
    "actionLabel": "Inspect the keeper’s stool"
   },
   {
    "id": "canal-fork-maintenance-map",
    "type": "inspect",
    "label": "The practical maintenance map",
    "rect": {
     "x": 1270,
     "y": 90,
     "width": 220,
     "height": 180
    },
    "actionLabel": "Inspect the practical maintenance map"
   },
   {
    "id": "return-previous",
    "type": "return",
    "label": "Revisit the previous room",
    "rect": {
     "x": 680,
     "y": 920,
     "width": 176,
     "height": 90
    },
    "actionLabel": "Revisit the previous room"
   }
  ],
  "occluders": [
   {
    "id": "waiting-drop",
    "depth": 907,
    "clipPath": "path(evenodd,'M108,657 L122,657 L131,671 L132,690 L123,702 L126,713 L144,725 L159,744 L167,760 L166,779 L154,798 L144,807 L147,814 L171,816 L176,760 L187,752 L246,754 L260,771 L260,809 L270,830 L274,890 L269,904 L181,906 L170,899 L83,900 L63,890 L65,866 L53,860 L43,842 L43,823 L54,810 L71,813 L93,809 L92,803 L77,792 L69,773 L68,752 L81,730 L99,717 L101,702 L97,689 L100,669Z')"
   },
   {
    "id": "rope-winch",
    "depth": 911,
    "clipPath": "path(evenodd,'M1301,690 L1315,684 L1331,690 L1335,703 L1361,698 L1393,699 L1394,684 L1408,680 L1421,688 L1423,717 L1444,726 L1457,725 L1468,735 L1468,749 L1458,760 L1451,760 L1451,769 L1466,771 L1473,782 L1469,794 L1455,798 L1450,809 L1460,819 L1475,817 L1489,829 L1488,892 L1477,902 L1447,902 L1426,911 L1371,911 L1354,901 L1290,898 L1280,884 L1276,854 L1264,842 L1247,858 L1251,836 L1262,819 L1278,817 L1280,795 L1283,766 L1276,753 L1281,721 L1297,716Z')"
   }
  ]
 },
 "garden-alcove": {
  "id": "garden-alcove",
  "title": "The Overgrown Music Box",
  "kind": "room",
  "image": "assets/rooms/garden-alcove.webp",
  "actors": [
   {
    "id": "nell",
    "character": "nell",
    "feet": {
     "x": 470,
     "y": 650
    },
    "worldSize": 160
   },
   {
    "id": "iris",
    "character": "iris",
    "feet": {
     "x": 790,
     "y": 550
    },
    "worldSize": 160
   },
   {
    "id": "pip",
    "character": "pip",
    "feet": {
     "x": 1090,
     "y": 680
    },
    "worldSize": 160
   }
  ],
  "geometry": {
   "width": 1536,
   "height": 1024,
   "gridSize": 32,
   "radius": 18,
   "speed": 260,
   "maxDeltaMs": 50,
   "bounds": {
    "x": 48,
    "y": 285,
    "width": 1440,
    "height": 693
   },
   "start": {
    "x": 768,
    "y": 920,
    "facing": "up"
   },
   "obstacles": [
    {
     "id": "nell",
     "x": 435,
     "y": 624,
     "width": 70,
     "height": 26
    },
    {
     "id": "iris",
     "x": 755,
     "y": 524,
     "width": 70,
     "height": 26
    },
    {
     "id": "pip",
     "x": 1055,
     "y": 654,
     "width": 70,
     "height": 26
    },
    {
     "id": "garden-alcove-cleared-patch-base",
     "x": 1260,
     "y": 870,
     "width": 210,
     "height": 35
    },
    {
     "id": "garden-alcove-flower-stone-base",
     "x": 80,
     "y": 870,
     "width": 195,
     "height": 40
    }
   ],
   "targets": [
    {
     "id": "garden-hidden-exit",
     "type": "door",
     "label": "Inspect the hidden flower gate",
     "x": 768,
     "y": 285,
     "approach": {
      "x": 768,
      "y": 345
     },
     "range": 100,
     "revealAfter": "garden-hidden-notes"
    },
    {
     "id": "nell",
     "type": "person",
     "label": "Talk to Nell",
     "x": 470,
     "y": 650,
     "approach": {
      "x": 470,
      "y": 715
     },
     "range": 100
    },
    {
     "id": "iris",
     "type": "person",
     "label": "Talk to Iris",
     "x": 790,
     "y": 550,
     "approach": {
      "x": 790,
      "y": 615
     },
     "range": 100
    },
    {
     "id": "pip",
     "type": "person",
     "label": "Talk to Pip",
     "x": 1090,
     "y": 680,
     "approach": {
      "x": 1090,
      "y": 745
     },
     "range": 100
    },
    {
     "id": "garden-alcove-cleared-patch",
     "type": "inspect",
     "label": "Inspect the cleared patch",
     "x": 1360,
     "y": 910,
     "approach": {
      "x": 1180,
      "y": 910
     },
     "range": 200
    },
    {
     "id": "garden-alcove-root-cradle",
     "type": "inspect",
     "label": "Inspect the root cradle",
     "x": 1340,
     "y": 285,
     "approach": {
      "x": 1340,
      "y": 360
     },
     "range": 105
    },
    {
     "id": "garden-alcove-flower-stone",
     "type": "inspect",
     "label": "Search beneath the flower stone",
     "x": 175,
     "y": 915,
     "approach": {
      "x": 360,
      "y": 915
     },
     "range": 205,
     "sourceId": "garden-hidden-notes",
     "sourceLabel": "Search beneath the flower stone"
    },
    {
     "id": "return-previous",
     "type": "return",
     "label": "Revisit the previous room",
     "x": 768,
     "y": 960,
     "approach": {
      "x": 768,
      "y": 910
     },
     "range": 85
    }
   ]
  },
  "objects": [
   {
    "id": "garden-hidden-exit",
    "type": "door",
    "label": "The hidden flower gate",
    "rect": {
     "x": 678,
     "y": 45,
     "width": 180,
     "height": 240
    },
    "doorId": "garden-hidden-exit",
    "actionLabel": "Inspect the hidden flower gate",
    "revealAfter": "garden-hidden-notes"
   },
   {
    "id": "nell",
    "type": "person",
    "label": "Nell",
    "rect": {
     "x": 406,
     "y": 490,
     "width": 128,
     "height": 166
    },
    "personId": "nell",
    "actionLabel": "Talk to Nell"
   },
   {
    "id": "iris",
    "type": "person",
    "label": "Iris",
    "rect": {
     "x": 726,
     "y": 390,
     "width": 128,
     "height": 166
    },
    "personId": "iris",
    "actionLabel": "Talk to Iris"
   },
   {
    "id": "pip",
    "type": "person",
    "label": "Pip",
    "rect": {
     "x": 1026,
     "y": 520,
     "width": 128,
     "height": 166
    },
    "personId": "pip",
    "actionLabel": "Talk to Pip"
   },
   {
    "id": "garden-alcove-cleared-patch",
    "type": "inspect",
    "label": "The cleared patch",
    "rect": {
     "x": 1230,
     "y": 680,
     "width": 270,
     "height": 240
    },
    "actionLabel": "Inspect the cleared patch"
   },
   {
    "id": "garden-alcove-root-cradle",
    "type": "inspect",
    "label": "The root cradle",
    "rect": {
     "x": 1225,
     "y": 110,
     "width": 210,
     "height": 160
    },
    "actionLabel": "Inspect the root cradle"
   },
   {
    "id": "garden-alcove-flower-stone",
    "type": "inspect",
    "label": "The flower stone",
    "rect": {
     "x": 35,
     "y": 660,
     "width": 270,
     "height": 265
    },
    "actionLabel": "Search beneath the flower stone",
    "sourceId": "garden-hidden-notes",
    "sourceLabel": "Search beneath the flower stone"
   },
   {
    "id": "return-previous",
    "type": "return",
    "label": "Revisit the previous room",
    "rect": {
     "x": 680,
     "y": 920,
     "width": 176,
     "height": 90
    },
    "actionLabel": "Revisit the previous room"
   }
  ],
  "occluders": [
   {
    "id": "flower-stone",
    "depth": 919,
    "clipPath": "path(evenodd,'M111,678 L129,671 L153,678 L172,671 L203,677 L215,687 L244,692 L260,711 L273,732 L273,748 L257,773 L271,788 L282,817 L295,815 L294,830 L275,838 L284,863 L295,880 L294,910 L258,918 L100,917 L78,907 L53,905 L43,891 L55,863 L48,844 L44,813 L35,799 L50,783 L72,763 L80,738 L83,706Z')"
   },
   {
    "id": "cleared-patch",
    "depth": 917,
    "clipPath": "path(evenodd,'M1401,690 L1417,683 L1433,700 L1450,704 L1460,728 L1477,754 L1494,779 L1494,864 L1481,891 L1477,908 L1437,917 L1280,915 L1254,906 L1241,889 L1255,869 L1242,848 L1255,817 L1246,804 L1261,780 L1275,773 L1281,746 L1302,742 L1320,724 L1352,735 L1368,712 L1392,711Z')"
   }
  ]
 },
 "workshop-alcove": {
  "id": "workshop-alcove",
  "title": "The Birds’ Dusty Attic",
  "kind": "room",
  "image": "assets/rooms/workshop-alcove.webp",
  "actors": [
   {
    "id": "nell",
    "character": "nell",
    "feet": {
     "x": 470,
     "y": 650
    },
    "worldSize": 160
   },
   {
    "id": "iris",
    "character": "iris",
    "feet": {
     "x": 790,
     "y": 550
    },
    "worldSize": 160
   },
   {
    "id": "pip",
    "character": "pip",
    "feet": {
     "x": 1090,
     "y": 680
    },
    "worldSize": 160
   }
  ],
  "geometry": {
   "width": 1536,
   "height": 1024,
   "gridSize": 32,
   "radius": 18,
   "speed": 260,
   "maxDeltaMs": 50,
   "bounds": {
    "x": 48,
    "y": 280,
    "width": 1440,
    "height": 698
   },
   "start": {
    "x": 768,
    "y": 920,
    "facing": "up"
   },
   "obstacles": [
    {
     "id": "nell",
     "x": 435,
     "y": 624,
     "width": 70,
     "height": 26
    },
    {
     "id": "iris",
     "x": 755,
     "y": 524,
     "width": 70,
     "height": 26
    },
    {
     "id": "pip",
     "x": 1055,
     "y": 654,
     "width": 70,
     "height": 26
    },
    {
     "id": "workshop-alcove-roost-marks-base",
     "x": 1185,
     "y": 845,
     "width": 290,
     "height": 35
    },
    {
     "id": "workshop-alcove-hollow-perch-base",
     "x": 90,
     "y": 855,
     "width": 225,
     "height": 40
    }
   ],
   "targets": [
    {
     "id": "workshop-hidden-exit",
     "type": "door",
     "label": "Inspect the hidden brass gate",
     "x": 768,
     "y": 280,
     "approach": {
      "x": 768,
      "y": 340
     },
     "range": 100,
     "revealAfter": "workshop-hidden-notes"
    },
    {
     "id": "nell",
     "type": "person",
     "label": "Talk to Nell",
     "x": 470,
     "y": 650,
     "approach": {
      "x": 470,
      "y": 715
     },
     "range": 100
    },
    {
     "id": "iris",
     "type": "person",
     "label": "Talk to Iris",
     "x": 790,
     "y": 550,
     "approach": {
      "x": 790,
      "y": 615
     },
     "range": 100
    },
    {
     "id": "pip",
     "type": "person",
     "label": "Talk to Pip",
     "x": 1090,
     "y": 680,
     "approach": {
      "x": 1090,
      "y": 745
     },
     "range": 100
    },
    {
     "id": "workshop-alcove-wing-wraps",
     "type": "inspect",
     "label": "Inspect the folded wing wraps",
     "x": 1360,
     "y": 280,
     "approach": {
      "x": 1360,
      "y": 355
     },
     "range": 105
    },
    {
     "id": "workshop-alcove-roost-marks",
     "type": "inspect",
     "label": "Inspect the old roost marks",
     "x": 1340,
     "y": 885,
     "approach": {
      "x": 1140,
      "y": 885
     },
     "range": 220
    },
    {
     "id": "workshop-alcove-hollow-perch",
     "type": "inspect",
     "label": "Search the hollow perch",
     "x": 180,
     "y": 895,
     "approach": {
      "x": 380,
      "y": 895
     },
     "range": 220,
     "sourceId": "workshop-hidden-notes",
     "sourceLabel": "Search the hollow perch"
    },
    {
     "id": "return-previous",
     "type": "return",
     "label": "Revisit the previous room",
     "x": 768,
     "y": 960,
     "approach": {
      "x": 768,
      "y": 910
     },
     "range": 85
    }
   ]
  },
  "objects": [
   {
    "id": "workshop-hidden-exit",
    "type": "door",
    "label": "The hidden brass gate",
    "rect": {
     "x": 678,
     "y": 45,
     "width": 180,
     "height": 235
    },
    "doorId": "workshop-hidden-exit",
    "actionLabel": "Inspect the hidden brass gate",
    "revealAfter": "workshop-hidden-notes"
   },
   {
    "id": "nell",
    "type": "person",
    "label": "Nell",
    "rect": {
     "x": 406,
     "y": 490,
     "width": 128,
     "height": 166
    },
    "personId": "nell",
    "actionLabel": "Talk to Nell"
   },
   {
    "id": "iris",
    "type": "person",
    "label": "Iris",
    "rect": {
     "x": 726,
     "y": 390,
     "width": 128,
     "height": 166
    },
    "personId": "iris",
    "actionLabel": "Talk to Iris"
   },
   {
    "id": "pip",
    "type": "person",
    "label": "Pip",
    "rect": {
     "x": 1026,
     "y": 520,
     "width": 128,
     "height": 166
    },
    "personId": "pip",
    "actionLabel": "Talk to Pip"
   },
   {
    "id": "workshop-alcove-wing-wraps",
    "type": "inspect",
    "label": "The folded wing wraps",
    "rect": {
     "x": 1225,
     "y": 140,
     "width": 255,
     "height": 115
    },
    "actionLabel": "Inspect the folded wing wraps"
   },
   {
    "id": "workshop-alcove-roost-marks",
    "type": "inspect",
    "label": "The old roost marks",
    "rect": {
     "x": 1165,
     "y": 655,
     "width": 335,
     "height": 240
    },
    "actionLabel": "Inspect the old roost marks"
   },
   {
    "id": "workshop-alcove-hollow-perch",
    "type": "inspect",
    "label": "The two-sided perch",
    "rect": {
     "x": 30,
     "y": 620,
     "width": 305,
     "height": 285
    },
    "actionLabel": "Search the hollow perch",
    "sourceId": "workshop-hidden-notes",
    "sourceLabel": "Search the hollow perch"
   },
   {
    "id": "return-previous",
    "type": "return",
    "label": "Revisit the previous room",
    "rect": {
     "x": 680,
     "y": 920,
     "width": 176,
     "height": 90
    },
    "actionLabel": "Revisit the previous room"
   }
  ],
  "occluders": [
   {
    "id": "hollow-perch",
    "depth": 903,
    "clipPath": "path(evenodd,'M124,635 L142,632 L151,645 L154,657 L188,646 L202,628 L216,626 L226,642 L248,653 L267,672 L286,663 L301,680 L308,697 L320,708 L324,745 L322,784 L305,799 L293,815 L314,824 L319,847 L316,883 L331,889 L324,899 L102,903 L69,893 L28,883 L29,837 L38,820 L58,818 L76,830 L95,816 L102,807 L83,800 L76,784 L78,717 L89,683 L111,664Z M172,674 L173,784 L187,791 L190,675Z M230,690 L229,787 L245,793 L270,789 L297,779 L301,715 L287,697 L273,691Z')"
   },
   {
    "id": "roost-rail",
    "depth": 883,
    "clipPath": "path(evenodd,'M1203,674 L1215,667 L1228,677 L1231,687 L1268,685 L1274,670 L1289,671 L1301,686 L1297,713 L1283,733 L1260,740 L1256,754 L1313,754 L1324,706 L1337,698 L1347,711 L1367,716 L1373,702 L1387,705 L1389,723 L1373,745 L1363,749 L1362,758 L1427,756 L1426,746 L1413,734 L1412,717 L1423,710 L1438,725 L1447,722 L1452,707 L1464,709 L1468,728 L1455,750 L1454,759 L1473,758 L1474,740 L1488,740 L1498,754 L1498,862 L1482,878 L1400,881 L1375,883 L1332,881 L1321,874 L1314,863 L1210,875 L1180,873 L1172,859 L1175,752 L1183,735 L1199,732 L1209,745 L1235,752 L1237,740 L1213,725 L1202,706Z M1195,798 L1193,850 L1211,850 L1210,798Z M1230,798 L1230,851 L1250,852 L1250,799Z M1268,800 L1268,832 L1289,833 L1290,800Z M1340,802 L1340,847 L1382,848 L1382,802Z M1400,799 L1400,815 L1467,816 L1466,800Z')"
   }
  ]
 },
 "canal-final": {
  "id": "canal-final",
  "title": "The Evening Tower",
  "kind": "room",
  "image": "assets/rooms/canal-final.webp",
  "actors": [
   {
    "id": "nell",
    "character": "nell",
    "feet": {
     "x": 470,
     "y": 650
    },
    "worldSize": 160
   },
   {
    "id": "iris",
    "character": "iris",
    "feet": {
     "x": 790,
     "y": 550
    },
    "worldSize": 160
   },
   {
    "id": "pip",
    "character": "pip",
    "feet": {
     "x": 1090,
     "y": 680
    },
    "worldSize": 160
   }
  ],
  "geometry": {
   "width": 1536,
   "height": 1024,
   "gridSize": 32,
   "radius": 18,
   "speed": 260,
   "maxDeltaMs": 50,
   "bounds": {
    "x": 48,
    "y": 350,
    "width": 1440,
    "height": 628
   },
   "start": {
    "x": 768,
    "y": 920,
    "facing": "up"
   },
   "obstacles": [
    {
     "id": "nell",
     "x": 435,
     "y": 624,
     "width": 70,
     "height": 26
    },
    {
     "id": "iris",
     "x": 755,
     "y": 524,
     "width": 70,
     "height": 26
    },
    {
     "id": "pip",
     "x": 1055,
     "y": 654,
     "width": 70,
     "height": 26
    },
    {
     "id": "route-orrery-base",
     "x": 80,
     "y": 835,
     "width": 210,
     "height": 45
    },
    {
     "id": "reply-winch-base",
     "x": 1280,
     "y": 840,
     "width": 170,
     "height": 40
    }
   ],
   "targets": [
    {
     "id": "canal-ending",
     "type": "door",
     "label": "Inspect the town door",
     "x": 768,
     "y": 350,
     "approach": {
      "x": 768,
      "y": 410
     },
     "range": 100
    },
    {
     "id": "nell",
     "type": "person",
     "label": "Talk to Nell",
     "x": 470,
     "y": 650,
     "approach": {
      "x": 470,
      "y": 715
     },
     "range": 100
    },
    {
     "id": "iris",
     "type": "person",
     "label": "Talk to Iris",
     "x": 790,
     "y": 550,
     "approach": {
      "x": 790,
      "y": 615
     },
     "range": 100
    },
    {
     "id": "pip",
     "type": "person",
     "label": "Talk to Pip",
     "x": 1090,
     "y": 680,
     "approach": {
      "x": 1090,
      "y": 745
     },
     "range": 100
    },
    {
     "id": "canal-final-route-lamps",
     "type": "inspect",
     "label": "Inspect the waiting lamps",
     "x": 1430,
     "y": 350,
     "approach": {
      "x": 1430,
      "y": 425
     },
     "range": 105
    },
    {
     "id": "canal-final-keeper-flask",
     "type": "inspect",
     "label": "Inspect the keeper’s flask",
     "x": 245,
     "y": 350,
     "approach": {
      "x": 245,
      "y": 425
     },
     "range": 105
    },
    {
     "id": "canal-final-reply-dish",
     "type": "inspect",
     "label": "Inspect the reply dish",
     "x": 1275,
     "y": 350,
     "approach": {
      "x": 1275,
      "y": 425
     },
     "range": 105
    },
    {
     "id": "return-previous",
     "type": "return",
     "label": "Revisit the previous room",
     "x": 768,
     "y": 960,
     "approach": {
      "x": 768,
      "y": 910
     },
     "range": 85
    }
   ]
  },
  "objects": [
   {
    "id": "canal-ending",
    "type": "door",
    "label": "The town door",
    "rect": {
     "x": 678,
     "y": 45,
     "width": 180,
     "height": 305
    },
    "doorId": "canal-ending",
    "actionLabel": "Inspect the town door"
   },
   {
    "id": "nell",
    "type": "person",
    "label": "Nell",
    "rect": {
     "x": 406,
     "y": 490,
     "width": 128,
     "height": 166
    },
    "personId": "nell",
    "actionLabel": "Talk to Nell"
   },
   {
    "id": "iris",
    "type": "person",
    "label": "Iris",
    "rect": {
     "x": 726,
     "y": 390,
     "width": 128,
     "height": 166
    },
    "personId": "iris",
    "actionLabel": "Talk to Iris"
   },
   {
    "id": "pip",
    "type": "person",
    "label": "Pip",
    "rect": {
     "x": 1026,
     "y": 520,
     "width": 128,
     "height": 166
    },
    "personId": "pip",
    "actionLabel": "Talk to Pip"
   },
   {
    "id": "canal-final-route-lamps",
    "type": "inspect",
    "label": "The waiting lamps",
    "rect": {
     "x": 1355,
     "y": 70,
     "width": 160,
     "height": 135
    },
    "actionLabel": "Inspect the waiting lamps"
   },
   {
    "id": "canal-final-keeper-flask",
    "type": "inspect",
    "label": "The keeper’s flask",
    "rect": {
     "x": 145,
     "y": 245,
     "width": 200,
     "height": 100
    },
    "actionLabel": "Inspect the keeper’s flask"
   },
   {
    "id": "canal-final-reply-dish",
    "type": "inspect",
    "label": "The reply dish",
    "rect": {
     "x": 1170,
     "y": 115,
     "width": 210,
     "height": 235
    },
    "actionLabel": "Inspect the reply dish"
   },
   {
    "id": "return-previous",
    "type": "return",
    "label": "Revisit the previous room",
    "rect": {
     "x": 680,
     "y": 920,
     "width": 176,
     "height": 90
    },
    "actionLabel": "Revisit the previous room"
   }
  ],
  "occluders": [
   {
    "id": "route-orrery",
    "depth": 882,
    "clipPath": "path(evenodd,'M119,664 L136,664 L145,681 L169,685 L191,704 L200,727 L210,731 L212,746 L203,760 L195,776 L181,793 L167,802 L163,813 L179,815 L190,831 L199,848 L198,869 L186,880 L96,882 L79,870 L76,852 L80,837 L91,828 L106,823 L106,812 L91,804 L80,791 L79,775 L60,757 L53,744 L57,733 L70,729 L74,710 L94,690 L117,680Z M105,704 L91,718 L91,732 L110,721Z M163,703 L174,718 L179,730 L190,719Z M94,763 L103,780 L118,787 L119,774Z M171,766 L160,783 L182,777 L192,756Z')"
   },
   {
    "id": "map-chest",
    "depth": 879,
    "clipPath": "path(evenodd,'M209,790 L232,776 L255,770 L272,780 L281,779 L295,790 L300,806 L294,823 L300,836 L296,867 L283,878 L211,878 L202,864 L205,826 L203,813Z')"
   },
   {
    "id": "reply-winch",
    "depth": 884,
    "clipPath": "path(evenodd,'M1409,693 L1427,697 L1438,710 L1438,730 L1447,727 L1450,744 L1442,758 L1449,771 L1488,782 L1498,794 L1493,804 L1458,805 L1446,818 L1452,836 L1448,871 L1434,882 L1294,883 L1273,871 L1274,846 L1283,838 L1282,816 L1289,800 L1284,779 L1284,744 L1291,718 L1302,704 L1318,702 L1333,710 L1342,706 L1371,704 L1382,710 L1390,704 L1396,706 L1402,698Z')"
   }
  ]
 }
});
export const PREVIOUS_ROOM_LAYOUT_PHYSICAL_CLIPS=freeze({
 "garden-fork": [
  {
   "id": "garden-fork-nell-investigate",
   "kind": "walk",
   "actor": "nell",
   "target": "garden-fork-shared-can",
   "action": "examine",
   "startTile": 0,
   "durationTiles": 12
  },
  {
   "id": "garden-fork-iris-investigate",
   "kind": "walk",
   "actor": "iris",
   "target": "garden-fork-buried-ring",
   "action": "search",
   "startTile": 0,
   "durationTiles": 24
  },
  {
   "id": "garden-fork-pip-rush",
   "kind": "walk",
   "actor": "pip",
   "action": "listen",
   "startTile": 1,
   "durationTiles": 4,
   "destination": {
    "x": 1180,
    "y": 791.5
   },
   "gait": "run"
  },
  {
   "id": "garden-fork-mira-observe",
   "kind": "walk",
   "actor": "mira",
   "action": "look",
   "destination": {
    "x": 704,
    "y": 792
   },
   "startTile": 1,
   "durationTiles": 6
  },
  {
   "id": "garden-fork-pip-trip",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "trip",
   "startTile": 5,
   "durationTiles": 4
  },
  {
   "id": "garden-fork-pip-fallen",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "fallen",
   "startTile": 9,
   "durationTiles": 5
  },
  {
   "id": "garden-fork-pip-recover",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "recover",
   "startTile": 14,
   "durationTiles": 6
  },
  {
   "id": "garden-fork-pip-arrive",
   "kind": "walk",
   "actor": "pip",
   "target": "garden-fork-wind-cups",
   "action": "listen",
   "startTile": 20,
   "durationTiles": 2,
   "gait": "run"
  },
  {
   "id": "garden-fork-iris-magnify",
   "kind": "gesture",
   "actor": "iris",
   "gesture": "magnify",
   "startTile": 24,
   "durationTiles": 119
  },
  {
   "id": "garden-fork-nell-emote-thinking",
   "kind": "emote",
   "actor": "nell",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "garden-fork-iris-emote-thinking",
   "kind": "emote",
   "actor": "iris",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "garden-fork-pip-emote-happy",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 0,
   "durationTiles": 5
  },
  {
   "id": "garden-fork-mira-emote-idea",
   "kind": "emote",
   "actor": "mira",
   "emote": "idea",
   "startTile": 0,
   "durationTiles": 18
  },
  {
   "id": "garden-fork-pip-emote-surprise",
   "kind": "emote",
   "actor": "pip",
   "emote": "surprise",
   "startTile": 5,
   "durationTiles": 4
  },
  {
   "id": "garden-fork-pip-emote-question",
   "kind": "emote",
   "actor": "pip",
   "emote": "question",
   "startTile": 9,
   "durationTiles": 5
  },
  {
   "id": "garden-fork-pip-emote-recovered",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 14,
   "durationTiles": 6
  },
  {
   "id": "garden-fork-iris-emote-idea",
   "kind": "emote",
   "actor": "iris",
   "emote": "idea",
   "startTile": 24,
   "durationTiles": 12
  }
 ],
 "workshop-fork": [
  {
   "id": "workshop-fork-nell-investigate",
   "kind": "walk",
   "actor": "nell",
   "target": "workshop-fork-help-shelf",
   "action": "examine",
   "startTile": 0,
   "durationTiles": 11
  },
  {
   "id": "workshop-fork-iris-investigate",
   "kind": "walk",
   "actor": "iris",
   "target": "workshop-fork-sound-screen",
   "action": "listen",
   "startTile": 0,
   "durationTiles": 23
  },
  {
   "id": "workshop-fork-pip-rush",
   "kind": "walk",
   "actor": "pip",
   "action": "search",
   "startTile": 1,
   "durationTiles": 3,
   "destination": {
    "x": 1160,
    "y": 782.25
   },
   "gait": "run"
  },
  {
   "id": "workshop-fork-mira-observe",
   "kind": "walk",
   "actor": "mira",
   "action": "look",
   "destination": {
    "x": 704,
    "y": 792
   },
   "startTile": 1,
   "durationTiles": 6
  },
  {
   "id": "workshop-fork-pip-trip",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "trip",
   "startTile": 4,
   "durationTiles": 4
  },
  {
   "id": "workshop-fork-pip-fallen",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "fallen",
   "startTile": 8,
   "durationTiles": 5
  },
  {
   "id": "workshop-fork-pip-recover",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "recover",
   "startTile": 13,
   "durationTiles": 6
  },
  {
   "id": "workshop-fork-pip-arrive",
   "kind": "walk",
   "actor": "pip",
   "target": "workshop-fork-worn-rail",
   "action": "search",
   "startTile": 19,
   "durationTiles": 2,
   "gait": "run"
  },
  {
   "id": "workshop-fork-iris-magnify",
   "kind": "gesture",
   "actor": "iris",
   "gesture": "magnify",
   "startTile": 23,
   "durationTiles": 127
  },
  {
   "id": "workshop-fork-nell-emote-thinking",
   "kind": "emote",
   "actor": "nell",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "workshop-fork-iris-emote-thinking",
   "kind": "emote",
   "actor": "iris",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "workshop-fork-pip-emote-happy",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 0,
   "durationTiles": 4
  },
  {
   "id": "workshop-fork-mira-emote-idea",
   "kind": "emote",
   "actor": "mira",
   "emote": "idea",
   "startTile": 0,
   "durationTiles": 18
  },
  {
   "id": "workshop-fork-pip-emote-surprise",
   "kind": "emote",
   "actor": "pip",
   "emote": "surprise",
   "startTile": 4,
   "durationTiles": 4
  },
  {
   "id": "workshop-fork-pip-emote-question",
   "kind": "emote",
   "actor": "pip",
   "emote": "question",
   "startTile": 8,
   "durationTiles": 5
  },
  {
   "id": "workshop-fork-pip-emote-recovered",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 13,
   "durationTiles": 6
  },
  {
   "id": "workshop-fork-iris-emote-idea",
   "kind": "emote",
   "actor": "iris",
   "emote": "idea",
   "startTile": 23,
   "durationTiles": 12
  }
 ],
 "canal-fork": [
  {
   "id": "canal-fork-nell-investigate",
   "kind": "walk",
   "actor": "nell",
   "target": "canal-fork-maintenance-map",
   "action": "examine",
   "startTile": 0,
   "durationTiles": 36
  },
  {
   "id": "canal-fork-iris-investigate",
   "kind": "walk",
   "actor": "iris",
   "target": "canal-fork-waiting-drop",
   "action": "listen",
   "startTile": 0,
   "durationTiles": 26
  },
  {
   "id": "canal-fork-pip-rush",
   "kind": "walk",
   "actor": "pip",
   "action": "search",
   "startTile": 1,
   "durationTiles": 6,
   "destination": {
    "x": 1365,
    "y": 626.425
   },
   "gait": "run"
  },
  {
   "id": "canal-fork-mira-observe",
   "kind": "walk",
   "actor": "mira",
   "action": "look",
   "destination": {
    "x": 704,
    "y": 792
   },
   "startTile": 1,
   "durationTiles": 6
  },
  {
   "id": "canal-fork-pip-trip",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "trip",
   "startTile": 7,
   "durationTiles": 4
  },
  {
   "id": "canal-fork-pip-fallen",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "fallen",
   "startTile": 11,
   "durationTiles": 5
  },
  {
   "id": "canal-fork-pip-recover",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "recover",
   "startTile": 16,
   "durationTiles": 6
  },
  {
   "id": "canal-fork-pip-arrive",
   "kind": "walk",
   "actor": "pip",
   "target": "canal-fork-service-stool",
   "action": "search",
   "startTile": 22,
   "durationTiles": 3,
   "gait": "run"
  },
  {
   "id": "canal-fork-iris-magnify",
   "kind": "gesture",
   "actor": "iris",
   "gesture": "magnify",
   "startTile": 26,
   "durationTiles": 120
  },
  {
   "id": "canal-fork-nell-emote-thinking",
   "kind": "emote",
   "actor": "nell",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "canal-fork-iris-emote-thinking",
   "kind": "emote",
   "actor": "iris",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "canal-fork-pip-emote-happy",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 0,
   "durationTiles": 7
  },
  {
   "id": "canal-fork-mira-emote-idea",
   "kind": "emote",
   "actor": "mira",
   "emote": "idea",
   "startTile": 0,
   "durationTiles": 18
  },
  {
   "id": "canal-fork-pip-emote-surprise",
   "kind": "emote",
   "actor": "pip",
   "emote": "surprise",
   "startTile": 7,
   "durationTiles": 4
  },
  {
   "id": "canal-fork-pip-emote-question",
   "kind": "emote",
   "actor": "pip",
   "emote": "question",
   "startTile": 11,
   "durationTiles": 5
  },
  {
   "id": "canal-fork-pip-emote-recovered",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 16,
   "durationTiles": 6
  },
  {
   "id": "canal-fork-iris-emote-idea",
   "kind": "emote",
   "actor": "iris",
   "emote": "idea",
   "startTile": 26,
   "durationTiles": 12
  }
 ],
 "garden-alcove": [
  {
   "id": "garden-alcove-nell-investigate",
   "kind": "walk",
   "actor": "nell",
   "target": "garden-alcove-cleared-patch",
   "action": "search",
   "startTile": 0,
   "durationTiles": 31
  },
  {
   "id": "garden-alcove-iris-investigate",
   "kind": "walk",
   "actor": "iris",
   "target": "garden-alcove-root-cradle",
   "action": "examine",
   "startTile": 0,
   "durationTiles": 24
  },
  {
   "id": "garden-alcove-pip-rush",
   "kind": "walk",
   "actor": "pip",
   "action": "look",
   "startTile": 1,
   "durationTiles": 10,
   "destination": {
    "x": 462.75,
    "y": 680
   },
   "gait": "run"
  },
  {
   "id": "garden-alcove-mira-observe",
   "kind": "walk",
   "actor": "mira",
   "action": "look",
   "destination": {
    "x": 704,
    "y": 792
   },
   "startTile": 1,
   "durationTiles": 6
  },
  {
   "id": "garden-alcove-pip-trip",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "trip",
   "startTile": 11,
   "durationTiles": 4
  },
  {
   "id": "garden-alcove-pip-fallen",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "fallen",
   "startTile": 15,
   "durationTiles": 5
  },
  {
   "id": "garden-alcove-pip-recover",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "recover",
   "startTile": 20,
   "durationTiles": 6
  },
  {
   "id": "garden-alcove-pip-arrive",
   "kind": "walk",
   "actor": "pip",
   "target": "garden-alcove-flower-stone",
   "action": "look",
   "startTile": 26,
   "durationTiles": 6,
   "gait": "run"
  },
  {
   "id": "garden-alcove-iris-magnify",
   "kind": "gesture",
   "actor": "iris",
   "gesture": "magnify",
   "startTile": 24,
   "durationTiles": 131
  },
  {
   "id": "garden-alcove-nell-emote-thinking",
   "kind": "emote",
   "actor": "nell",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "garden-alcove-iris-emote-thinking",
   "kind": "emote",
   "actor": "iris",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "garden-alcove-pip-emote-happy",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 0,
   "durationTiles": 11
  },
  {
   "id": "garden-alcove-mira-emote-idea",
   "kind": "emote",
   "actor": "mira",
   "emote": "idea",
   "startTile": 0,
   "durationTiles": 18
  },
  {
   "id": "garden-alcove-pip-emote-surprise",
   "kind": "emote",
   "actor": "pip",
   "emote": "surprise",
   "startTile": 11,
   "durationTiles": 4
  },
  {
   "id": "garden-alcove-pip-emote-question",
   "kind": "emote",
   "actor": "pip",
   "emote": "question",
   "startTile": 15,
   "durationTiles": 5
  },
  {
   "id": "garden-alcove-pip-emote-recovered",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 20,
   "durationTiles": 6
  },
  {
   "id": "garden-alcove-iris-emote-idea",
   "kind": "emote",
   "actor": "iris",
   "emote": "idea",
   "startTile": 24,
   "durationTiles": 12
  }
 ],
 "workshop-alcove": [
  {
   "id": "workshop-alcove-nell-investigate",
   "kind": "walk",
   "actor": "nell",
   "target": "workshop-alcove-wing-wraps",
   "action": "examine",
   "startTile": 0,
   "durationTiles": 38
  },
  {
   "id": "workshop-alcove-iris-investigate",
   "kind": "walk",
   "actor": "iris",
   "target": "workshop-alcove-roost-marks",
   "action": "search",
   "startTile": 0,
   "durationTiles": 22
  },
  {
   "id": "workshop-alcove-pip-rush",
   "kind": "walk",
   "actor": "pip",
   "action": "look",
   "startTile": 1,
   "durationTiles": 10,
   "destination": {
    "x": 488.75,
    "y": 680
   },
   "gait": "run"
  },
  {
   "id": "workshop-alcove-mira-observe",
   "kind": "walk",
   "actor": "mira",
   "action": "look",
   "destination": {
    "x": 704,
    "y": 792
   },
   "startTile": 1,
   "durationTiles": 6
  },
  {
   "id": "workshop-alcove-pip-trip",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "trip",
   "startTile": 11,
   "durationTiles": 4
  },
  {
   "id": "workshop-alcove-pip-fallen",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "fallen",
   "startTile": 15,
   "durationTiles": 5
  },
  {
   "id": "workshop-alcove-pip-recover",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "recover",
   "startTile": 20,
   "durationTiles": 6
  },
  {
   "id": "workshop-alcove-pip-arrive",
   "kind": "walk",
   "actor": "pip",
   "target": "workshop-alcove-hollow-perch",
   "action": "look",
   "startTile": 26,
   "durationTiles": 6,
   "gait": "run"
  },
  {
   "id": "workshop-alcove-iris-magnify",
   "kind": "gesture",
   "actor": "iris",
   "gesture": "magnify",
   "startTile": 22,
   "durationTiles": 125
  },
  {
   "id": "workshop-alcove-nell-emote-thinking",
   "kind": "emote",
   "actor": "nell",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "workshop-alcove-iris-emote-thinking",
   "kind": "emote",
   "actor": "iris",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "workshop-alcove-pip-emote-happy",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 0,
   "durationTiles": 11
  },
  {
   "id": "workshop-alcove-mira-emote-idea",
   "kind": "emote",
   "actor": "mira",
   "emote": "idea",
   "startTile": 0,
   "durationTiles": 18
  },
  {
   "id": "workshop-alcove-pip-emote-surprise",
   "kind": "emote",
   "actor": "pip",
   "emote": "surprise",
   "startTile": 11,
   "durationTiles": 4
  },
  {
   "id": "workshop-alcove-pip-emote-question",
   "kind": "emote",
   "actor": "pip",
   "emote": "question",
   "startTile": 15,
   "durationTiles": 5
  },
  {
   "id": "workshop-alcove-pip-emote-recovered",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 20,
   "durationTiles": 6
  },
  {
   "id": "workshop-alcove-iris-emote-idea",
   "kind": "emote",
   "actor": "iris",
   "emote": "idea",
   "startTile": 22,
   "durationTiles": 12
  }
 ],
 "canal-final": [
  {
   "id": "canal-final-nell-investigate",
   "kind": "walk",
   "actor": "nell",
   "target": "canal-final-route-lamps",
   "action": "examine",
   "startTile": 0,
   "durationTiles": 38
  },
  {
   "id": "canal-final-iris-investigate",
   "kind": "walk",
   "actor": "iris",
   "target": "canal-final-reply-dish",
   "action": "listen",
   "startTile": 0,
   "durationTiles": 20
  },
  {
   "id": "canal-final-pip-rush",
   "kind": "walk",
   "actor": "pip",
   "action": "search",
   "startTile": 1,
   "durationTiles": 12,
   "destination": {
    "x": 375,
    "y": 680
   },
   "gait": "run"
  },
  {
   "id": "canal-final-mira-observe",
   "kind": "walk",
   "actor": "mira",
   "action": "look",
   "destination": {
    "x": 704,
    "y": 792
   },
   "startTile": 1,
   "durationTiles": 6
  },
  {
   "id": "canal-final-pip-trip",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "trip",
   "startTile": 13,
   "durationTiles": 4
  },
  {
   "id": "canal-final-pip-fallen",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "fallen",
   "startTile": 17,
   "durationTiles": 5
  },
  {
   "id": "canal-final-pip-recover",
   "kind": "gesture",
   "actor": "pip",
   "gesture": "recover",
   "startTile": 22,
   "durationTiles": 6
  },
  {
   "id": "canal-final-pip-arrive",
   "kind": "walk",
   "actor": "pip",
   "target": "canal-final-keeper-flask",
   "action": "search",
   "startTile": 28,
   "durationTiles": 7,
   "gait": "run"
  },
  {
   "id": "canal-final-iris-magnify",
   "kind": "gesture",
   "actor": "iris",
   "gesture": "magnify",
   "startTile": 20,
   "durationTiles": 127
  },
  {
   "id": "canal-final-nell-emote-thinking",
   "kind": "emote",
   "actor": "nell",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "canal-final-iris-emote-thinking",
   "kind": "emote",
   "actor": "iris",
   "emote": "thinking",
   "startTile": 0,
   "durationTiles": 16
  },
  {
   "id": "canal-final-pip-emote-happy",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 0,
   "durationTiles": 13
  },
  {
   "id": "canal-final-mira-emote-idea",
   "kind": "emote",
   "actor": "mira",
   "emote": "idea",
   "startTile": 0,
   "durationTiles": 18
  },
  {
   "id": "canal-final-pip-emote-surprise",
   "kind": "emote",
   "actor": "pip",
   "emote": "surprise",
   "startTile": 13,
   "durationTiles": 4
  },
  {
   "id": "canal-final-pip-emote-question",
   "kind": "emote",
   "actor": "pip",
   "emote": "question",
   "startTile": 17,
   "durationTiles": 5
  },
  {
   "id": "canal-final-pip-emote-recovered",
   "kind": "emote",
   "actor": "pip",
   "emote": "happy",
   "startTile": 22,
   "durationTiles": 6
  },
  {
   "id": "canal-final-iris-emote-idea",
   "kind": "emote",
   "actor": "iris",
   "emote": "idea",
   "startTile": 20,
   "durationTiles": 12
  }
 ]
});

export function upgradeStockRoomLayouts(value){
 const project=structuredClone(value);
 if(!project?.scenes||!project?.content)return project;
 for(const roomId of VARIED_ROOM_IDS){
  const content=project.content[roomId],clips=content?.cutscene;
  if(!content||!same(project.scenes[roomId],PREVIOUS_ROOM_LAYOUT_SCENES[roomId]))continue;
  // Earlier projects without authored tracks receive their new default scene
  // before the ordinary room-introduction upgrade supplies matching tracks.
  if(!Object.hasOwn(content,'cutscene')){project.scenes[roomId]=jsonClone(CAMPAIGN_SCENES[roomId]);continue;}
  if(!Array.isArray(clips))continue;
  const physical=clips.filter(clip=>clip?.kind!=='dialogue');
  if(!same(physical,PREVIOUS_ROOM_LAYOUT_PHYSICAL_CLIPS[roomId]))continue;
  const current=new Map(ROOM_CUTSCENES[roomId].filter(clip=>clip.kind!=='dialogue').map(clip=>[clip.id,clip]));
  if(physical.some(clip=>!current.has(clip.id))||physical.length!==current.size)continue;
  project.scenes[roomId]=jsonClone(CAMPAIGN_SCENES[roomId]);
  project.content[roomId].cutscene=clips.map(clip=>clip.kind==='dialogue'?clip:jsonClone(current.get(clip.id)));
 }
 return project;
}
