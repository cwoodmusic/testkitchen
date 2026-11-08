const NPC_KEY='codaTownBuilderNPCsV1';
export function readNPCPreference(){try{return localStorage.getItem(NPC_KEY)!=='off';}catch{return true;}}
export function saveNPCPreference(visible){try{localStorage.setItem(NPC_KEY,visible?'on':'off');}catch{}}
