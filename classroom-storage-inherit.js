/* Same-origin Song Machine uses its parent classroom's guarded player stores. */
(function(win){try{if(win.parent!==win){const storage=win.parent.localStorage;if(storage?.__codaClassroomScoped===true)Object.defineProperty(win,'localStorage',{configurable:true,get:()=>storage});}}catch{}})(window);
