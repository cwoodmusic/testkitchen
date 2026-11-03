/* Release notes bundled with the game; no remote feed or tracking. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaChangelog=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const entries=[
  {date:'2026-10-29',title:'Full-screen developer console',changes:[
   'Choose Fullscreen in the developer console to fill the browser window, including the Music facts editor.',
   'Restore window or Escape returns to the floating console. Your selected tab and unsaved drafts stay in place.'
  ]},
  {date:'2026-10-29',title:'Ten easy music-history facts per musician',changes:[
   'Each musician now has ten selected facts, written with simple words for students around fourth grade.',
   'The matching quiz covers those ten facts. Learn and record all ten to unlock it.',
   'Existing discoveries, completed collections, and quiz passes carry over without repeating old prizes.'
  ]},
  {date:'2026-10-29',title:'Edit every music-history fact',changes:[
   'Developer → Music facts shows all 540 facts, including locked discoveries, with musician filters and catalog search.',
   'Apply edited facts and their linked quiz questions. Changes save and export with the world project.',
   'Existing discoveries, friendship points, and rewards carry over.'
  ]},
  {date:'2026-10-29',title:'Friendship points',changes:[
   'Music-history progression now uses Friendship points and Friendship quests, including in the developer console.'
  ]},
  {date:'2026-10-29',title:'More room in the Pixel editor',changes:[
   'Controls use a compact scrolling sidebar. Hide them to give the artwork the full screen.',
   'Phone portrait controls start hidden and open as a drawer. Zoom, selection, and edits stay in place.'
  ]},
  {date:'2026-10-29',title:'Updated arcade graphics and layout',changes:[
   'Published the latest background pixel edits and trimmed the dance-room wall corner.',
   'Included the latest world layout, walking areas, foreground layers, and fishing-room edits.'
  ]},
  {date:'2026-10-29',title:'Selection masks the outside',changes:[
   'Select a rectangle or manual shape to protect everything outside it automatically.',
   'Paint, fill, smooth, paste, and stamp inside the selected shape. Clear selection removes the outside mask.'
  ]},
  {date:'2026-10-29',title:'Larger dialogue and adjustable text speed',changes:[
   'Read larger dialogue and response buttons when chatting with musicians, Chopin, the historian, and Captain Cadence.',
   'Dialogue appears letter by letter. Choose Slow, Normal, Fast, or Instant in Settings → Text speed.',
   'Click the dialogue to reveal the full line. In the arcade, press E once to reveal it and again to close.',
   'Long conversations scroll within the screen on desktop and phones.'
  ]},
  {date:'2026-10-29',title:'Smoothing brushes, masks, and custom selections',changes:[
   'Smooth gradients with a soft round brush and adjustable radius and strength.',
   'Protect details with a paintable mask, unmask areas, and undo mask edits.',
   'Use Select → Manual shape to outline precise areas for smoothing, protection, copying, or stamps.'
  ]},
  {date:'2026-10-29',title:'The Scholar and earned music history',changes:[
   'Meet the Scholar seated on the lounge couch. Bring discoveries to the historian’s record and collect Notes.',
   'Complete friendship quests to earn new facts. An exclamation mark shows when a musician has one ready; repeated clicks do not reveal more.',
   'Record all 30 facts from a musician to unlock their history quiz. Collection milestones and a first quiz pass earn larger prizes.',
   'Inspect friendships and test progression with F2 → History progression in the isolated developer preview.'
  ]},
  {date:'2026-10-28',title:'Music history journal and visiting composers',changes:[
   'Meet Arnold Schoenberg, George Frideric Handel, and Antonio Vivaldi alongside the existing musicians.',
   'At most six visitors share the arcade. New visitors enter after someone walks out through the exit.',
   'Talk to musicians to discover 540 short history facts across 18 collections, with 30 facts per character.',
   'Open Settings → Music History Journal to revisit discoveries. Undiscovered entries remain locked; discoveries save on this device.'
  ]},
  {date:'2026-10-28',title:'Pitch Race mistake freezes',changes:[
   'Every three mistakes freezes your notes and locks answers for three seconds in every Pitch Race mode.',
   'Race timers and opponents keep going during the freeze.',
   'Endless resumes after each freeze. Select Finish run to collect your result.'
  ]},
  {date:'2026-10-28',title:'Background preview and pixel tools',changes:[
   'Show or hide placed assets as a guide while editing a background.',
   'The eyedropper returns to your previous tool after picking a color.',
   'Capture selected pixels with Ctrl/Command-click, resize the stamp, and click to place repeated copies.'
  ]},
  {date:'2026-10-28',title:'Updated classroom lessons',changes:[
   'Published updated teaching text and practice questions for the musical alphabet, piano landmarks, treble staff, steps and skips, and ledger lines.',
   'Updated the bass introduction and Middle C note illustrations.'
  ]},
  {date:'2026-10-28',title:'Lesson authoring controls',changes:[
   'Developer mode opens the lesson-card editor with editable teaching text, examples, answers, hints, and follow-up checks.',
   'Rename lessons and sections, edit introductions, and add, remove, reorder, or move teaching cards.',
   'Add notes, clefs, and piano keyboards to lessons and practice checks, including multiple pictures on one step.',
   'Lesson settings, checks, and visuals are included in content JSON export and import.'
  ]},
  {date:'2026-10-28',title:'Reliable guest button',changes:[
   'Play as guest stays in the same position while the title screen loads, including when a login is remembered.',
   'Guest play skips saved-login restoration. Guest and saved profile progress stay separate.'
  ]},
  {date:'2026-10-28',title:'Piano keyboards in pitch lessons',changes:[
   'Pitch lessons show a labeled piano keyboard with black keys in groups of two and three.',
   'Piano-key practice keeps the keyboard visible. Half-step, sharp, and flat examples show the keys being compared.'
  ]},
  {date:'2026-10-28',title:'Guest entry fix',changes:[
   'Play as guest opens the arcade even when another tab or a leftover profile marker is present.',
   'Guest play alongside a saved profile keeps separate progress for that tab, including refreshes. The saved profile stays untouched.'
  ]},
  {date:'2026-10-27',title:'Play notes, classroom practice, and dance controls',changes:[
   'Press P to open your play notes. Notes save in this browser and can be downloaded as a text file.',
   'DJ Line Dance arrows use a directional pad, with Up above Left and Right and Down below.',
   'Hard dance mode is now 88 BPM.',
   'Dance rhythms shuffle across all eight bars, including the opening. Sixteenth-note runs keep one arrow direction.',
   'Built-in classroom teaching steps now have three targeted check questions.',
   'Lesson quizzes draw fresh questions from targeted pools and shuffle the questions and choices. Unfinished quizzes resume the same attempt in this browser.',
   'Staff lessons use clean Line 1–5 and Space 1–4 numbering, counted from bottom to top.'
  ]},
  {date:'2026-10-27',title:'DJ achievements and circling disco reflections',changes:[
   'Six DJ Line Dance achievements award saved XP and unlock two new DJ tracks: First Steps and Midnight Headliner.',
   'Dance milestones can unlock shutter shades, roller skates, and a boombox. Previous gear purchases remain available.',
   'Disco reflections follow elapsed time and have small moving trails. Reduced motion and effects settings still apply.'
  ]}
 ];
 for(const entry of entries){Object.freeze(entry.changes);Object.freeze(entry);}return Object.freeze({entries:Object.freeze(entries)});
});
