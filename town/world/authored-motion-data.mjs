// Native glass polygons audited across all 252 authored arcade/lava views.
// The six corrections preserve native art, world dimensions and ground anchors.
export const AUTHORED_MOTION_CORRECTIONS=[
 {
  "id": "collection-bach-lava-lamp",
  "facing": "south",
  "world": {
   "w": 52,
   "h": 110
  },
  "motionGeometry": {
   "mask": [
    [
     0.4627849002849003,
     0.2799999999999999
    ],
    [
     0.5372150997150997,
     0.2799999999999999
    ],
    [
     0.5930377492877492,
     0.55
    ],
    [
     0.40696225071225073,
     0.55
    ]
   ],
   "bounds": [
    0.40696225071225073,
    0.2799999999999999,
    0.1860754985754985,
    0.27000000000000013
   ]
  },
  "source": {
   "file": "town/assets/apartment-collections/bach-south-cardinal-7b8b1298d752.webp",
   "crop": {
    "x": 350,
    "y": 1790,
    "w": 95,
    "h": 216
   },
   "draw": {
    "x": 1.8101851851851833,
    "y": -1.4210854715202004e-14,
    "w": 48.37962962962963,
    "h": 110.00000000000001
   },
   "sha256": "498b47c335cd9f62f8d4e2fbee50eec20d94411030ac1c3a1c8622c56ca002c6"
  },
  "reason": "Source glass ends near v=.59; old v=.65 reaches the ornate brass collar. Shorten lower glass vertices conservatively to .55."
 },
 {
  "id": "collection-showroom-art-deco-lounge-lava-lamp",
  "facing": "east",
  "world": {
   "w": 52,
   "h": 110
  },
  "motionGeometry": {
   "mask": [
    [
     0.4652859960552268,
     0.3
    ],
    [
     0.5347140039447732,
     0.3
    ],
    [
     0.5867850098619329,
     0.56
    ],
    [
     0.4132149901380671,
     0.56
    ]
   ],
   "bounds": [
    0.4132149901380671,
    0.3,
    0.17357001972386582,
    0.26000000000000006
   ]
  },
  "source": {
   "file": "town/assets/apartment-collections/showroom-art-deco-lounge-east-cardinal-a7b1f99f7f56.webp",
   "crop": {
    "x": 1135,
    "y": 701,
    "w": 80,
    "h": 195
   },
   "draw": {
    "x": 3.435897435897438,
    "y": 0.0,
    "w": 45.128205128205124,
    "h": 110.0
   },
   "sha256": "239713a6634dc39b71586660c1533ba1c3fcbe3424a31c0c5a33e9c8053eb638"
  },
  "reason": "Source glass ends near v=.59; old v=.62 reaches the upper brass collar. Shorten lower vertices to .56, above collar and rim."
 },
 {
  "id": "apartment-lava-lamp",
  "facing": "south",
  "world": {
   "w": 52,
   "h": 110
  },
  "motionGeometry": {
   "mask": [
    [
     0.44,
     0.3496969696969698
    ],
    [
     0.56,
     0.3496969696969698
    ],
    [
     0.6799999999999999,
     0.6133333333333334
    ],
    [
     0.32,
     0.6133333333333334
    ]
   ],
   "bounds": [
    0.32,
    0.3496969696969698,
    0.35999999999999993,
    0.2636363636363636
   ]
  },
  "source": {
   "file": "town/assets/apartments/lava-lamp.png",
   "crop": {
    "x": 0,
    "y": 0,
    "w": 156,
    "h": 290
   },
   "draw": {
    "x": 0.0,
    "y": 13.333333333333343,
    "w": 52.0,
    "h": 96.66666666666666
   },
   "sha256": "2bfaa8e70b6e9bce215467ea619d27d4a999f02705bcd368b6c7a97eb6cda08e"
  },
  "reason": "Authored native glass is visible in this facing, but legacy asset/view has no motion metadata. Polygon stays in central glass, clear of silver cap/base and highlights.",
  "identity": {
   "kind": "lava",
   "seed": "apartment-lava-lamp",
   "game": "periwinkle",
   "palette": [
    "#5e438b",
    "#fa7297",
    "#ffcb7d",
    "#8468bd"
   ]
  }
 },
 {
  "id": "apartment-lava-lamp",
  "facing": "north",
  "world": {
   "w": 52,
   "h": 110
  },
  "motionGeometry": {
   "mask": [
    [
     0.44,
     0.2969340463458111
    ],
    [
     0.56,
     0.2969340463458111
    ],
    [
     0.6799999999999999,
     0.5819607843137257
    ],
    [
     0.32,
     0.5819607843137257
    ]
   ],
   "bounds": [
    0.32,
    0.2969340463458111,
    0.35999999999999993,
    0.28502673796791456
   ]
  },
  "source": {
   "file": "town/assets/furniture-facings/legacy-02-north-cardinal-5e72272cc60c.webp",
   "crop": {
    "x": 217,
    "y": 910,
    "w": 102,
    "h": 205
   },
   "draw": {
    "x": 0.0,
    "y": 5.4901960784313815,
    "w": 52.0,
    "h": 104.50980392156862
   },
   "sha256": "620b96eac419544e0121a3195ae57b003d96e88590266009ad7451964fea6866"
  },
  "reason": "Authored native glass is visible in this facing, but legacy asset/view has no motion metadata. Polygon stays in central glass, clear of silver cap/base and highlights.",
  "identity": {
   "kind": "lava",
   "seed": "apartment-lava-lamp",
   "game": "periwinkle",
   "palette": [
    "#5e438b",
    "#fa7297",
    "#ffcb7d",
    "#8468bd"
   ]
  }
 },
 {
  "id": "apartment-lava-lamp",
  "facing": "west",
  "world": {
   "w": 52,
   "h": 110
  },
  "motionGeometry": {
   "mask": [
    [
     0.44487179487179485,
     0.26
    ],
    [
     0.5551282051282052,
     0.26
    ],
    [
     0.6653846153846156,
     0.56
    ],
    [
     0.3346153846153846,
     0.56
    ]
   ],
   "bounds": [
    0.3346153846153846,
    0.26,
    0.330769230769231,
    0.30000000000000004
   ]
  },
  "source": {
   "file": "town/assets/furniture-facings/legacy-02-west-cardinal-40301250eb32.webp",
   "crop": {
    "x": 1676,
    "y": 4,
    "w": 86,
    "h": 198
   },
   "draw": {
    "x": 2.1111111111111107,
    "y": 0.0,
    "w": 47.77777777777778,
    "h": 110.0
   },
   "sha256": "30f298b7dc08a5e590e3a3f1e3688ebdfec5230deb41207690fa064472dfa501"
  },
  "reason": "Authored native glass is visible in this facing, but legacy asset/view has no motion metadata. Polygon stays in central glass, clear of silver cap/base and highlights.",
  "identity": {
   "kind": "lava",
   "seed": "apartment-lava-lamp",
   "game": "periwinkle",
   "palette": [
    "#5e438b",
    "#fa7297",
    "#ffcb7d",
    "#8468bd"
   ]
  }
 },
 {
  "id": "apartment-lava-lamp",
  "facing": "east",
  "world": {
   "w": 52,
   "h": 110
  },
  "motionGeometry": {
   "mask": [
    [
     0.44201483795392427,
     0.26
    ],
    [
     0.5579851620460758,
     0.26
    ],
    [
     0.6739554861382273,
     0.56
    ],
    [
     0.32604451386177274,
     0.56
    ]
   ],
   "bounds": [
    0.32604451386177274,
    0.26,
    0.34791097227645457,
    0.30000000000000004
   ]
  },
  "source": {
   "file": "town/assets/furniture-facings/legacy-02-east-cardinal-5d0756a8b4c4.webp",
   "crop": {
    "x": 515,
    "y": 455,
    "w": 90,
    "h": 197
   },
   "draw": {
    "x": 0.873096446700508,
    "y": 0.0,
    "w": 50.253807106598984,
    "h": 110.0
   },
   "sha256": "31128e859d4d24ec5d3d92fc47e193f1555025bd47dbd606d30c20b1412b284c"
  },
  "reason": "Authored native glass is visible in this facing, but legacy asset/view has no motion metadata. Polygon stays in central glass, clear of silver cap/base and highlights.",
  "identity": {
   "kind": "lava",
   "seed": "apartment-lava-lamp",
   "game": "periwinkle",
   "palette": [
    "#5e438b",
    "#fa7297",
    "#ffcb7d",
    "#8468bd"
   ]
  }
 }
];
