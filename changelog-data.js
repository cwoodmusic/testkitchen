/* Release notes bundled with the game; no remote feed or tracking. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaChangelog=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const entries=[
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
