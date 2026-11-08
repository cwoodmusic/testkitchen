/* One-time décor unlocks for Coda Town. Furniture ownership uses the Notes wallet. */
(function(root,factory){
 const catalog=factory();
 if(typeof module==='object'&&module.exports)module.exports=catalog;
 if(root)root.CodaFurnitureCatalog=catalog;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 return Object.freeze([
  ['sofa','Velvet sofa',70,'furniture-1-180','furniture'],
  ['bed','Carved wooden bed',80,'furniture-2-180','furniture'],
  ['kitchen-counter','Kitchen counter',65,'furniture-3-180','furniture'],
  ['stove','Enamel stove',55,'furniture-4-180','furniture'],
  ['dining-table','Dining table',60,'furniture-5-180','furniture'],
  ['vanity','Bathroom vanity',40,'furniture-8-180','furniture'],
  ['piano','Grand piano',300,'furniture-0-180','instruments'],
  ['cello','Concert cello',90,'decor-02-01','instruments'],
  ['double-bass','Upright double bass',100,'decor-02-03','instruments'],
  ['acoustic-guitar','Acoustic guitar',60,'decor-02-05','instruments'],
  ['electric-guitar','Red electric guitar',75,'decor-02-08','instruments'],
  ['harp','Concert harp',140,'decor-02-14','instruments'],
  ['upright-piano','Walnut upright piano',180,'decor-03-02','instruments'],
  ['synthesizer','Teal synthesizer',120,'decor-03-04','instruments'],
  ['jazz-drums','Blue jazz drum kit',140,'decor-03-07','instruments'],
  ['congas','Pair of congas',65,'decor-03-10','instruments'],
  ['saxophone','Gold tenor saxophone',90,'decor-04-06','instruments'],
  ['turntable','Turntable console',100,'decor-05-15','instruments'],
  ['vinyl-bin','Vinyl record collection',45,'decor-05-16','instruments'],
  ['oak-bench','Carved oak bench',55,'decor-06-01','furniture'],
  ['wicker-chair','Wicker chair',35,'decor-06-04','furniture'],
  ['cafe-table','Round café table',45,'decor-06-06','furniture'],
  ['chess-table','Chess table',60,'decor-06-07','furniture'],
  ['geranium','Terracotta geranium',20,'decor-08-01','plants'],
  ['hydrangea','Blue hydrangea pot',25,'decor-08-02','plants'],
  ['rose-planter','White rose planter',25,'decor-08-03','plants'],
  ['olive-tree','Potted olive tree',40,'decor-08-09','plants'],
  ['lemon-tree','Potted lemon tree',45,'decor-08-10','plants'],
  ['fern','Hanging fern',20,'decor-08-13','plants'],
  ['succulents','Succulent collection',18,'decor-08-15','plants'],
  ['oak-barrel','Oak storage barrel',25,'decor-01-01','storage'],
  ['travel-trunk','Leather traveling trunk',35,'decor-01-12','storage'],
  ['wicker-hamper','Wicker hamper',20,'decor-01-13','storage'],
  ['streetlamp','Bronze standing lamp',55,'decor-14-01','lighting'],
  ['garden-lantern','Small garden lantern',20,'decor-14-04','lighting'],
  ['wind-chimes','Copper wind chimes',30,'decor-09-08','lighting']
 ].map(([id,name,price,asset,category])=>Object.freeze({id:'furniture-'+id,name,price,asset,category,scale:({sofa:1.75,bed:1.5,'kitchen-counter':1.75,stove:.8,'dining-table':1.5,vanity:.9,piano:1.83,'upright-piano':1.5,'jazz-drums':1.5,turntable:1.5,'olive-tree':1.3,'lemon-tree':1.3})[id]||1})));
});
