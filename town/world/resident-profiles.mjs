// Shared resident identities and apartments. City movement and interiors use one roster.
const rows=[
 ['bach','Bach',2,'A','The Organ Loft','#526d63','#b08e60',['decor-03-06','decor-05-05','decor-04-10']],
 ['mozart','Mozart',2,'B','Rosewood Salon','#a06b6d','#e0c695',['decor-03-01','decor-08-03','decor-02-10']],
 ['beethoven','Beethoven',3,'A','Stormlight Studio','#536580','#b1a18a',['decor-03-01','decor-02-03','decor-05-08']],
 ['clara','Clara Schumann',3,'B','Fern & Ivory','#5b9160','#d1bea2',['decor-03-02','decor-05-05','decor-08-13']],
 ['chopin','Chopin',4,'A','Nocturne Apartment','#75617d','#c8aa77',['decor-03-01','decor-08-04','decor-05-08']],
 ['haydn','Haydn',4,'B','Sunflower Suite','#a5783d','#ebc679',['decor-02-10','decor-08-05','decor-05-05']],
 ['handel','Handel',5,'A','Laurel Rooms','#758879','#c8aa77',['decor-03-06','decor-04-01','decor-05-08']],
 ['vivaldi','Vivaldi',5,'B','Four Seasons','#94754f','#c38a83',['decor-02-10','decor-08-06','decor-08-08']],
 ['joplin','Scott Joplin',6,'A','Maple Ragtime','#a5783d','#e0c695',['decor-03-02','decor-05-16','decor-04-01']],
 ['ellington','Duke Ellington',6,'B','Bluebird Jazz Suite','#3c8190','#b1a18a',['decor-03-01','decor-04-06','decor-05-16']],
 ['ella','Ella Fitzgerald',7,'A','Honeysuckle Lounge','#a06b6d','#dbaa94',['decor-05-10','decor-03-01','decor-05-16']],
 ['nina','Nina Simone',8,'A','Cedar Sanctuary','#526d63','#b08e60',['decor-03-02','decor-05-09','decor-08-09']],
 ['miles','Miles Davis',9,'A','Midnight Brass','#3b4a61','#cda056',['decor-04-01','decor-05-16','decor-03-07']],
 ['dj','DJ Coda',10,'A','Nightjar Studio','#584765','#99a6b5',['decor-05-15','decor-05-13','decor-03-04']],
 ['vee-jay','Vee Jay',11,'A','Prism Video Loft','#2b6371','#97819b',['decor-03-04','decor-05-14','decor-05-13']],
 ['zizi','Zizi',12,'A','Orbit Garden','#75617d','#94b965',['decor-03-10','decor-08-15','decor-08-09']],
 ['metronome','Metronome',13,'A','Clockwork Rooms','#94754f','#cda056',['decor-03-13','decor-05-03','decor-05-06']],
 ['schoenberg','Schoenberg',14,'A','Twelve-Tone Atelier','#776966','#c1c9c5',['decor-03-01','decor-05-08','decor-02-10']]
];
export const residents=Object.freeze(rows.map(([id,name,floor,unit,theme,color,trim,instruments],index)=>Object.freeze({id,name,floor,unit,number:`${floor}${unit}`,theme,color,trim,instruments:Object.freeze(instruments),index})));
