/* Objects baked into the approved room PNG, without foreground-atlas entries.
 * World-coordinate silhouettes avoid bringing neighboring floor pixels along.
 * The cleaned background reconstructs complete cabinet fronts; painted customers
 * have been removed from the room and no longer need silhouette cutouts.
 */
window.CodaWorldObjectCatalog = [
  {
    name:'rhythm_fishing_trapdoor',label:'Trapdoor · Rhythm Fishing cave',group:'Doorways & activities',source:'world',
    bounds:[880,728,96,64],layer:'back',sortY:792,procedural:'fishing-trapdoor',anchor:[928,760]
  },
  {
    name: 'disco_ball_arcade', label: 'Disco ball · Arcade', group: 'Disco balls', source: 'world',
    bounds: [848, 89, 61, 71], layer: 'front', sortY: 971, ballIndex: 0,
    anchor: [878, 130], radius: 28, spin: .55,
    polygon: [[875,90],[881,90],[881,103],[888,105],[898,111],[905,121],[908,131],[905,143],[896,153],[884,158],[871,158],[860,151],[852,141],[849,129],[852,118],[859,109],[869,104],[875,103]]
  },
  {
    name: 'disco_ball_dance', label: 'Disco ball · Dance floor', group: 'Disco balls', source: 'world',
    bounds: [360, 501, 65, 81], layer: 'front', sortY: 971, ballIndex: 1,
    anchor: [392, 548], radius: 29, spin: .82,
    polygon: [[389,502],[395,502],[395,518],[403,521],[413,527],[420,537],[423,549],[419,562],[410,571],[397,576],[383,575],[373,569],[365,560],[361,548],[365,535],[375,525],[386,520],[389,519]]
  },
  {
    name: 'cabinet_pitch_race', label: 'Cabinet · Pitch Race', group: 'Arcade cabinets', source: 'world',
    bounds: [682, 166, 95, 138], layer: 'world', sortY: 303, gameIndex: 0,
    collision: [676,177,90,104], screen: [696,207,52,45],
    cleanup: {kind:'arcade-cabinet-floor',reflectionBottom:375},
    polygon: [[691,168],[763,168],[772,173],[775,182],[775,286],[771,300],[764,302],[759,295],[702,295],[698,302],[688,302],[684,292],[683,180],[686,172]]
  },
  {
    name: 'cabinet_music_triad', label: 'Cabinet · Music Triad', group: 'Arcade cabinets', source: 'world',
    bounds: [791, 166, 104, 138], layer: 'world', sortY: 303, gameIndex: 1,
    collision: [781,174,100,104], screen: [802,208,59,44],
    cleanup: {kind:'arcade-cabinet-floor',reflectionBottom:375},
    polygon: [[802,168],[884,168],[892,174],[894,285],[889,300],[881,302],[877,295],[811,295],[807,302],[798,302],[794,292],[792,181],[795,173]]
  },
  {
    name: 'cabinet_rhythm_room', label: 'Cabinet · Rhythm Room', group: 'Arcade cabinets', source: 'world',
    bounds: [912, 166, 104, 138], layer: 'world', sortY: 303, gameIndex: 2,
    collision: [900,174,104,107], screen: [916,208,59,44],
    cleanup: {kind:'arcade-cabinet-floor',reflectionBottom:375},
    polygon: [[923,168],[1005,168],[1013,174],[1015,285],[1010,300],[1002,302],[998,295],[932,295],[928,302],[919,302],[915,292],[913,181],[916,173]]
  },
  {
    name: 'cabinet_song_machine', label: 'Cabinet · Song Machine', group: 'Arcade cabinets', source: 'world',
    bounds: [1028, 166, 107, 138], layer: 'world', sortY: 303, gameIndex: 3,
    collision: [1011,171,108,109], screen: [1033,205,63,42],
    cleanup: {kind:'arcade-cabinet-floor',reflectionBottom:375},
    polygon: [[1040,168],[1123,168],[1132,174],[1134,285],[1128,300],[1120,302],[1116,295],[1049,295],[1045,302],[1035,302],[1031,292],[1029,181],[1033,173]]
  },
  {
    name: 'dance_passage_plant_leaves', label: 'Plant · Dance passage (leaves and pot)', group: 'Plants', source: 'world',
    bounds: [754,609,70,95], legacyBounds: [[754,609,65,72]], layer: 'world', sortY: 704, permanentlyRemoved: true,
    // Include the pot and its shadow, not just the former foreground foliage.
    polygon: [[779,609],[799,609],[799,621],[823,621],[823,673],[812,673],[812,704],[769,704],[769,674],[754,674],[754,623],[779,623]],
    sample: [818,609],
    cleanup: {kind:'dance-passage', floorWidth:12, floorOffsetX:4, left:[754,590,47,24], leftOffsetY:-19}
  }
];
