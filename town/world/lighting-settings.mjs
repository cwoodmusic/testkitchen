const KEY='codaTownBuilderNightV1';
export function readNightPreference(){try{return localStorage.getItem(KEY)!=='day';}catch{return true;}}
export function saveNightPreference(night){try{localStorage.setItem(KEY,night?'night':'day');}catch{}}
