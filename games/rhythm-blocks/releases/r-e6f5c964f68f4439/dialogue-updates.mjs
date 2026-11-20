/** Exact stock-line repairs; authored timing and custom dialogue remain intact. */
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const STOCK_GAG_DIALOGUE_UPDATES=freeze([
 {
  "roomId": "depot",
  "clipId": "depot-arrival-2",
  "speaker": "pip",
  "previousText": "My courier heard something! Is it behind us? Ah! No, only my feet. I am up. Please do not let the letter bite.",
  "text": "My courier keeps turning toward the dark route. Something is listening back, isn’t it? Please do not let the letter bite."
 },
 {
  "roomId": "garden-porch",
  "clipId": "garden-porch-arrival-2",
  "speaker": "pip",
  "previousText": "The seed jars conquered a survey plate! That root moved! Whoa! I am fine. Does it know I am not a vegetable?",
  "text": "The seed jars conquered a survey plate! That root moves when the pipe sounds. Does it know I am not a vegetable?"
 },
 {
  "roomId": "workshop-porch",
  "clipId": "workshop-porch-arrival-2",
  "speaker": "pip",
  "previousText": "My repaired wing! It moved by itself! Ah! I meant to look underneath it. Briefly. Are we certain it likes me?",
  "text": "My repaired wing is moving! I did not wind it. Are we certain it likes me? I would prefer a warning before any flapping."
 },
 {
  "roomId": "workshop-porch",
  "clipId": "workshop-porch-arrival-3",
  "speaker": "mira",
  "previousText": "Your reputation has feathers; it will recover. Why does a room full of metal birds need a bowl of seed?",
  "text": "A feathered mystery, then. Why does a room full of metal birds need a bowl of seed?"
 },
 {
  "roomId": "canal-porch",
  "clipId": "canal-porch-arrival-2",
  "speaker": "pip",
  "previousText": "That bell knows my courier! Did it ring? Whoops! Only me. Please tell the water I have no intention of visiting.",
  "text": "Why is the small bell so quiet? My courier keeps listening to it. Please tell the water I have no intention of visiting."
 },
 {
  "roomId": "garden-fork",
  "clipId": "garden-fork-arrival-2",
  "speaker": "pip",
  "previousText": "The cups are singing! Or whispering? At me? Oh! Just the breeze. I am all right. Is that definitely a breeze?",
  "text": "The cups are singing! Or whispering? At me? That empty place sounds different. Is it definitely only the breeze?"
 },
 {
  "roomId": "garden-fork",
  "clipId": "garden-fork-arrival-3",
  "speaker": "mira",
  "previousText": "Good. The ground is famously difficult to lose. Nell, that watering can has had more adventures than our parcel.",
  "text": "A ceramic choir with a vacancy. Nell, that watering can has had more adventures than our parcel."
 },
 {
  "roomId": "workshop-fork",
  "clipId": "workshop-fork-arrival-2",
  "speaker": "pip",
  "previousText": "Tiny feet polished the rail! Something tiny is behind me! Ow! My own bird. I knew that. Mostly. I am getting up.",
  "text": "Tiny feet polished the rail. My bird keeps looking along it. Is something waiting in that passage? Please let it be small."
 },
 {
  "roomId": "workshop-fork",
  "clipId": "workshop-fork-arrival-3",
  "speaker": "mira",
  "previousText": "We will omit that from your biography. Iris, does the screen always pause as if somebody else is supposed to speak?",
  "text": "A rail with a secret audience. Iris, does the screen always pause as if somebody else is supposed to speak?"
 },
 {
  "roomId": "canal-fork",
  "clipId": "canal-fork-arrival-2",
  "speaker": "pip",
  "previousText": "He fixed my favourite footrest! What if the drop falls on me? Whoa! I fell first. I would like that recorded.",
  "text": "He fixed my favourite footrest! But who is keeping that drop up there? I would prefer to admire it from beside Nell."
 },
 {
  "roomId": "canal-fork",
  "clipId": "canal-fork-arrival-3",
  "speaker": "mira",
  "previousText": "Recorded with distinction. That drop has been hanging there long enough to develop opinions. Iris, can you interrogate it?",
  "text": "That drop has been hanging there long enough to develop opinions. Iris, can you interrogate it?"
 },
 {
  "roomId": "garden-final",
  "clipId": "garden-final-arrival-2",
  "speaker": "pip",
  "previousText": "That giant switch keeps supper warm! Is the pot hissing at me? Oof! Pot safe. Pip safe. Please do not lift its hat.",
  "text": "That giant switch keeps supper warm! Is the pot hissing at me? Please tell it I appreciate its work and will not touch its hat."
 },
 {
  "roomId": "workshop-final",
  "clipId": "workshop-final-arrival-2",
  "speaker": "pip",
  "previousText": "My old stool! The lever reaches it! Did the machine growl? Ah! No, that was me. I can still stand. Watch. Carefully.",
  "text": "My old stool fits the lever now! Does the machine know I am its pupil? I would like to begin with something very quiet."
 },
 {
  "roomId": "workshop-final",
  "clipId": "workshop-final-arrival-3",
  "speaker": "mira",
  "previousText": "An ambitious curriculum. Nell, someone turned the chairs around. That is a quiet sort of revolution, and I approve.",
  "text": "A machine that makes room for Pip. Nell, someone turned the chairs around. A quiet sort of revolution, and I approve."
 },
 {
  "roomId": "canal-final",
  "clipId": "canal-final-arrival-2",
  "speaker": "pip",
  "previousText": "Oren keeps tea up here! Is that wind or a giant bird? Whoop! Not over the edge! Very local landing. Please stay close.",
  "text": "Oren keeps tea up here! Is that wind or a giant bird? Please stay close. I would rather not be mistaken for a parcel."
 },
 {
  "roomId": "canal-final",
  "clipId": "canal-final-arrival-3",
  "speaker": "mira",
  "previousText": "Excellent choice of direction. Iris, this tower seems proud of its voice. Does it ever let anyone else speak?",
  "text": "A tower with a tea shelf. Iris, it seems proud of its voice. Does it ever let anyone else speak?"
 },
 {
  "roomId": "garden-alcove",
  "clipId": "garden-alcove-arrival-2",
  "speaker": "pip",
  "previousText": "A stone flower! Does it open? What if it opens at me? Ah! Fine. No flowers squashed. I shall look from standing up.",
  "text": "A stone flower! Does it open? What if it opens at me? It has rather convincing petals. I shall admire it without touching."
 },
 {
  "roomId": "garden-alcove",
  "clipId": "garden-alcove-arrival-3",
  "speaker": "mira",
  "previousText": "A rare ground-blooming Pip. Iris, the roots curve around that little box as if it were invited to stay.",
  "text": "A stone flower with an excellent poker face. Iris, the roots curve around that little box as if it were invited to stay."
 },
 {
  "roomId": "workshop-alcove",
  "clipId": "workshop-alcove-arrival-2",
  "speaker": "pip",
  "previousText": "My couriers slept here! Is one still in the dark? Oof! I volunteer to greet it after I get up. With all of you.",
  "text": "My couriers slept here. Is one still in the dark? I volunteer to greet it, provided all of you are part of the greeting."
 },
 {
  "roomId": "garden-secret-final",
  "clipId": "garden-secret-final-arrival-2",
  "speaker": "pip",
  "previousText": "The window is listening! Is something listening back? Whoa! I contributed a thump. A friendly thump. No need to answer it.",
  "text": "The window is listening! Is something listening back? If it is, I hope it knows we are friendly and not especially loud."
 },
 {
  "roomId": "garden-secret-final",
  "clipId": "garden-secret-final-arrival-3",
  "speaker": "mira",
  "previousText": "A stirring opening statement. Nell, those controls meet in the middle without either one surrendering its shape.",
  "text": "An open window in an enormous listening machine. Nell, those controls meet without either one surrendering its shape."
 },
 {
  "roomId": "workshop-secret-final",
  "clipId": "workshop-secret-final-arrival-2",
  "speaker": "pip",
  "previousText": "That horn is courier-sized! What if it shouts? Eep! Only a step. I am up. A step should announce itself, Nell.",
  "text": "That horn is courier-sized! What if it shouts? I would like to hear what the birds say, preferably in a small voice."
 },
 {
  "roomId": "workshop-secret-final",
  "clipId": "workshop-secret-final-arrival-3",
  "speaker": "mira",
  "previousText": "It did put itself on the floor. Iris, someone changed a mighty machine to fit one small visitor. My sort of engineering.",
  "text": "A courier-sized horn in a giant machine. Iris, someone changed this place to fit one small visitor. My sort of engineering."
 },
 {
  "roomId": "workshop-secret-final",
  "clipId": "workshop-secret-final-arrival-5",
  "speaker": "nell",
  "previousText": "A useful adaptation need not look grand. Pip, listen before demonstrating anything else. There is another voice here.",
  "text": "A useful adaptation need not look grand. Pip, keep listening. There is another voice here."
 },
 {
  "roomId": "ending-home",
  "clipId": "ending-home-arrival-2",
  "speaker": "pip",
  "previousText": "Room for our letter! Does that bell know we are here? Oof! It does now. I shall choose a chair for my next landing.",
  "text": "Room for our letter! Does that bell know we are here? I hope it likes couriers. And visitors who ask before ringing."
 },
 {
  "roomId": "ending-school",
  "clipId": "ending-school-arrival-2",
  "speaker": "pip",
  "previousText": "My lever reaches! My stool sits flat! That scrape was not a monster, was it? Ah! Just me again. A useful lesson.",
  "text": "My lever reaches! My stool sits flat! Does that scraping sound belong to the machine? I would prefer a lesson without monsters."
 },
 {
  "roomId": "ending-school",
  "clipId": "ending-school-arrival-3",
  "speaker": "mira",
  "previousText": "We should charge admission to your demonstrations. Nell, a gap in the circle! An invitation disguised as furniture.",
  "text": "Pip, the lever finally meets you halfway. Nell, a gap in the circle! An invitation disguised as furniture."
 },
 {
  "roomId": "ending-public",
  "clipId": "ending-public-arrival-2",
  "speaker": "pip",
  "previousText": "A light came back! Was that thunder? Whoop! I am fine! If it was thunder, please tell it I liked the light very much.",
  "text": "A light came back! Was that thunder? If it was, please tell it I liked the light very much. From a respectful distance."
 },
 {
  "roomId": "ending-public",
  "clipId": "ending-public-arrival-3",
  "speaker": "mira",
  "previousText": "One reply from the islands, one from Pip. A flourishing postal service. Iris, tell me that silver thread is real.",
  "text": "An island answering with its own light! A flourishing postal service. Iris, tell me that silver thread is real."
 },
 {
  "roomId": "ending-secret-quiet",
  "clipId": "ending-secret-quiet-arrival-2",
  "speaker": "pip",
  "previousText": "The window is open! What if something—oof. A quiet thump. Very apologetic. I am standing, and nothing need come in.",
  "text": "The window is open. What if something answers? I shall listen very carefully, provided nothing expects me to speak first."
 },
 {
  "roomId": "ending-secret-quiet",
  "clipId": "ending-secret-quiet-arrival-3",
  "speaker": "mira",
  "previousText": "An eloquent thump. Nell, nobody abandoned that chair. They simply refused to tell it whom to wait for.",
  "text": "An open window without a demand. Nell, nobody abandoned that chair. They simply refused to tell it whom to wait for."
 },
 {
  "roomId": "ending-secret-birds",
  "clipId": "ending-secret-birds-arrival-2",
  "speaker": "pip",
  "previousText": "Their own voices! Such loud voices! Whoa! Fine! Please continue your historic conversation at whatever volume you require.",
  "text": "Their own voices! Such loud voices. Are we sure the old board is ready to hear them? I would rather the birds explained it."
 },
 {
  "roomId": "ending-secret-birds",
  "clipId": "ending-secret-birds-arrival-3",
  "speaker": "mira",
  "previousText": "Even falling over cannot interrupt his manners today. Iris, those lines part after the pause. They kept their own minds.",
  "text": "A historic conversation, and he still remembers his manners. Iris, those lines part after the pause. They kept their own minds."
 },
 {
  "roomId": "dead-brambles",
  "clipId": "dead-brambles-arrival-2",
  "speaker": "pip",
  "previousText": "A clean bench! Did the roots rustle at me? Oof! Technically seated. I would prefer somewhere less close to their toes.",
  "text": "A clean bench beside those roots. Are they listening to us? Please tell them I am only borrowing their shade."
 },
 {
  "roomId": "dead-brambles",
  "clipId": "dead-brambles-arrival-3",
  "speaker": "mira",
  "previousText": "The bench appreciates being considered. Nell, the roots and the wall seem to have become business partners.",
  "text": "A hospitable bench in an uncooperative garden. Nell, the roots and the wall seem to have become business partners."
 },
 {
  "roomId": "dead-aviary",
  "clipId": "dead-aviary-arrival-2",
  "speaker": "pip",
  "previousText": "A sunny resting place! Is that courier asleep or staring? Ah! I brought it a wrap. It may have the less frightening spot.",
  "text": "A sunny resting place! Is that courier asleep or staring? I brought it a wrap. It may have the less frightening spot."
 },
 {
  "roomId": "dead-aviary",
  "clipId": "dead-aviary-arrival-3",
  "speaker": "mira",
  "previousText": "Selfless, if poorly staged. Iris, fresh felt but no open way onward. Someone kept this room for a different reason.",
  "text": "A good sunny spot for a courier. Iris, fresh felt but no open way onward. Someone kept this room for a different reason."
 },
 {
  "roomId": "dead-ferry",
  "clipId": "dead-ferry-arrival-2",
  "speaker": "pip",
  "previousText": "The rope is mended! Is that a wave coming here? Whoa! Staying here! I have tested this end of the landing thoroughly.",
  "text": "The rope is mended! Is that a wave coming here? Please tell me the rail is as reliable as Oren’s repairs."
 },
 {
  "roomId": "dead-ferry",
  "clipId": "dead-ferry-arrival-3",
  "speaker": "mira",
  "previousText": "A convincing review. Iris, our light is in the water, but no answering lamp. Even my optimism needs a boat.",
  "text": "A perfectly good rope with no boat attached. Iris, our light is in the water, but no answering lamp. Even my optimism needs a boat."
 },
 {
  "roomId": "dead-echo",
  "clipId": "dead-echo-arrival-2",
  "speaker": "pip",
  "previousText": "My courier's voice! Is somebody copying us? Oof! It copied that too. I would prefer the stranger forgot my landing.",
  "text": "My courier’s voice is coming back! Is somebody copying us? I hope they are friendly. They sound alarmingly familiar."
 },
 {
  "roomId": "dead-echo",
  "clipId": "dead-echo-arrival-3",
  "speaker": "mira",
  "previousText": "An echo with no discretion. Iris, every scratch returns in exactly the same place. Our mysterious stranger is suspiciously us.",
  "text": "A remarkably familiar stranger. Iris, every scratch returns in exactly the same place. Our mysterious visitor is suspiciously us."
 }
]);

/** Copy JSON authoring data and update only the exact old published wording. */
export function upgradeStockGagDialogue(value){
 const project=structuredClone(value),content=project?.content;
 if(!content||typeof content!=='object'||Array.isArray(content))return project;
 for(const update of STOCK_GAG_DIALOGUE_UPDATES){
  const clips=content[update.roomId]?.cutscene;
  if(!Array.isArray(clips))continue;
  for(const clip of clips){
   if(!clip||typeof clip!=='object'||Array.isArray(clip)||clip.kind!==undefined&&clip.kind!=='dialogue')continue;
   if(clip.id===update.clipId&&clip.speaker===update.speaker&&clip.text===update.previousText)clip.text=update.text;
  }
 }
 return project;
}
