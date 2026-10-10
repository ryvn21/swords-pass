// Mantid reference captured 2026-10-06. Raw rows run top to bottom; engine rows run bottom to top.
export const ENAMELS=["Red","Orange","Yellow","Green","Blue","Purple","White","Black"];
const COLOUR_MAP=[[["g","b","y","r"],["r","b","y","g"],["r","g","y","b"],["r","g","b","y"],["b","g","y","r"],["b","r","y","g"],["g","r","y","b"],["g","r","b","y"]],[["y","g","b","r"],["y","r","b","g"],["y","r","g","b"],["b","r","g","y"],["g","y","b","r"],["r","y","b","g"],["r","y","g","b"],["r","b","g","y"]],[["b","y","g","r"],["b","y","r","g"],["g","y","r","b"],["g","b","r","y"],["y","b","g","r"],["y","b","r","g"],["y","g","r","b"],["b","g","r","y"]],[["g","b","y","r"],["r","b","y","g"],["r","g","y","b"],["r","g","b","y"],["b","g","y","r"],["b","r","y","g"],["g","r","y","b"],["g","r","b","y"]],[["y","g","b","r"],["y","r","b","g"],["y","r","g","b"],["b","r","g","y"],["g","y","b","r"],["r","y","b","g"],["r","y","g","b"],["r","b","g","y"]],[["b","y","g","r"],["b","y","r","g"],["g","y","r","b"],["g","b","r","y"],["y","b","g","r"],["y","b","r","g"],["y","g","r","b"],["b","g","r","y"]],[["g","b","y","r"],["r","b","y","g"],["r","g","y","b"],["r","g","b","y"],["b","g","y","r"],["b","r","y","g"],["g","r","y","b"],["g","r","b","y"]],[["y","g","b","r"],["y","r","b","g"],["y","r","g","b"],["b","r","g","y"],["g","y","b","r"],["r","y","b","g"],["r","y","g","b"],["r","b","g","y"]]];
export const REFERENCE_SWORDS=[{"id":0,"name":"Foil","pattern":[1,1,2,2,3,3,1,1,2,2,3,3,4,4,1,1,2,2,4,4,1,1,2,2]},{"id":1,"name":"Short sword","pattern":[1,1,2,2,3,3,1,1,2,2,3,3,4,4,1,1,2,2,4,2,1,1,3,2]},{"id":2,"name":"Long sword","pattern":[2,2,4,4,3,3,2,1,1,1,1,3,3,2,4,4,3,2,3,2,4,4,3,2,2,2,1,1,3,3,2,2,4,4,3,3]},{"id":3,"name":"Rapier","pattern":[3,1,4,3,2,4,4,1,2,1,2,3,4,4,2,1,3,3,1,1,1,2,2,2,4,1,1,2,2,3,4,4,1,2,3,3]},{"id":4,"name":"Dirk","pattern":[2,2,1,1,3,3,2,2,1,1,3,3,2,1,1,4,4,3,2,2,4,4,3,3,4,4,4,4,4,3]},{"id":5,"name":"Scimitar","pattern":[1,4,4,4,4,3,1,1,1,3,3,3,2,4,1,3,4,2,2,2,1,3,2,2]},{"id":6,"name":"Cutlass","pattern":[4,4,1,1,3,3,2,2,2,3,1,1,1,1,2,2,4,4,1,1,2,2,4,4,3,3,1,2,2,4,3,3,1,1,2,2]},{"id":7,"name":"Poniard","pattern":[3,3,4,2,1,1,1,3,4,2,1,3,1,1,4,2,3,3,1,1,4,2,3,3,1,4,4,2,2,3,4,1,4,2,3,2]},{"id":8,"name":"Saber","pattern":[1,2,2,4,4,3,1,1,1,3,3,3,1,1,1,3,3,3,1,4,4,2,2,3,2,4,4,2,2,2,2,2,2,4,4,2]},{"id":9,"name":"Stiletto","pattern":[2,2,3,4,1,1,2,4,1,2,3,1,2,4,2,1,3,1,2,2,4,3,1,1]},{"id":10,"name":"Skull dagger","pattern":[1,1,3,4,1,1,1,2,3,4,2,1,1,2,3,4,2,1,2,2,3,4,2,2,2,3,1,1,4,2]},{"id":11,"name":"Falchion","pattern":[3,3,1,1,4,4,3,2,2,1,2,4,4,2,1,2,2,3,4,4,1,1,3,3]},{"id":12,"name":"Cleaver","pattern":[1,1,3,2,3,3,1,3,3,3,2,3,1,1,2,3,3,2,4,2,2,4,3,3,4,4,1,3,4,3,4,1,1,3,3,4]},{"id":13,"name":"Backsword","pattern":[1,1,4,2,3,3,1,4,4,2,2,3,1,4,1,3,2,3,4,1,1,3,3,2]},{"id":18,"name":"Katana","pattern":[1,4,4,1,1,4,4,1,1,4,4,1,3,2,2,3,3,2,2,3,3,2,2,3,4,4,1,1,4,4,4,4,1,1,4,4]},{"id":19,"name":"Dadao","pattern":[1,4,1,4,1,4,4,1,1,4,4,1,3,2,3,2,3,2,2,3,3,2,2,3,4,4,1,1,1,1,4,4,4,4,1,1]},{"id":127,"name":"Stick","pattern":[3,4,2,2,1,3,4,4,2,2,1,1,4,4,2,2,1,1]}];
const legacy=[{"id":"sinners-saber","name":"Sinner’s Saber","note":"Your reference: mirrored, with the requested colour swaps.","rows":[[1,1,1,2,2,1],[1,2,2,1,1,1],[3,2,2,1,1,3],[3,3,0,0,3,3],[3,3,0,0,3,3],[3,1,1,2,2,3]]},{"id":"forgotten-falchion","name":"Forgotten Falchion","note":"Your reference pattern, mirrored left to right.","rows":[[1,1,2,2,0,0],[1,0,2,3,3,0],[3,0,0,1,3,2],[3,3,1,1,2,2]]}];
const colourIndex={r:0,y:1,g:2,b:3};
export function swordRows(referenceId,primary=0,secondary=0){
 const sword=REFERENCE_SWORDS.find(s=>s.id===referenceId);if(!sword)throw Error('Unknown reference sword.');
 if(!Number.isInteger(primary)||primary<0||primary>7||!Number.isInteger(secondary)||secondary<0||secondary>7)throw Error('Invalid enamel colour.');
 if(referenceId===127)primary=secondary=0;
 const map=COLOUR_MAP[primary][secondary],rows=[];
 for(let i=0;i<sword.pattern.length;i+=6){const row=sword.pattern.slice(i,i+6).map(slot=>colourIndex[map[slot-1]]);rows.unshift([3,4,5].includes(primary)?row.reverse():row);}
 return rows;
}
export const PATTERNS=[...legacy,...REFERENCE_SWORDS.map(s=>({id:s.name.toLowerCase().replaceAll(' ','-'),name:s.name,referenceId:s.id,note:s.id===127?'A simple stick. Its attack colours stay fixed.':'Mantid reference pattern · choose your guard and grip colours.',rows:swordRows(s.id)})),{id:'custom',name:'Custom',note:'Your own pattern. Start with Foil, then edit any colour.',rows:swordRows(0)}];
export const THEMED=[
 {id:'emberbrand',name:'Emberbrand',theme:'Fire',note:'A blade that never cools. Mostly red and gold.',rows:[[0,0,1,1,0,0],[1,0,0,1,1,0],[1,1,0,0,3,3],[2,2,3,3,0,0]]},
 {id:'frostfang',name:'Frostfang',theme:'Ice',note:'Cut from a glacier. Mostly blue.',rows:[[3,3,1,1,3,3],[3,1,1,3,3,1],[2,2,3,3,0,0],[3,3,0,0,2,2]]},
 {id:'thornroot',name:'Thornroot',theme:'Verdant',note:'Still growing. Mostly green.',rows:[[2,2,2,0,0,2],[2,1,1,0,2,2],[1,1,2,2,3,3],[2,2,3,3,1,1]]},
 {id:'stormcaller',name:'Stormcaller',theme:'Storm',note:'Sends blue and gold in a crackling weave.',rows:[[3,1,3,1,3,1],[1,3,1,3,1,3],[3,3,2,2,0,0],[0,0,3,3,2,2]]},
 {id:'bloodmoon',name:'Bloodmoon',theme:'Blood',note:'Red under a blue moon.',rows:[[0,0,3,3,0,0],[0,3,3,0,0,3],[3,0,0,1,1,2],[2,2,1,1,0,0]]},
 {id:'gilded-oath',name:'Gilded Oath',theme:'Gilt',note:'A knight\u2019s promise. A wall of gold.',rows:[[1,1,1,1,1,1],[0,1,1,1,1,0],[2,2,0,0,3,3],[3,3,0,0,2,2]]},
 {id:'voidglass',name:'Voidglass',theme:'Arcane',note:'A checkerboard from the dark between stars.',rows:[[3,0,3,0,3,0],[0,3,0,3,0,3],[1,1,2,2,1,1],[2,2,1,1,2,2]]},
 {id:'bonereaver',name:'Bonereaver',theme:'Bone',note:'Gold and green, old as the barrow.',rows:[[1,1,2,2,1,1],[1,2,2,1,1,2],[0,0,3,3,1,1],[3,3,0,0,1,1]]},
 {id:'tidecutter',name:'Tidecutter',theme:'Sea',note:'Waves of blue and green.',rows:[[3,2,3,2,3,2],[2,3,2,3,2,3],[3,3,0,0,1,1],[1,1,3,3,0,0]]},
 {id:'duskwhisper',name:'Duskwhisper',theme:'Shadow',note:'Quiet blues and greens.',rows:[[3,3,2,2,3,3],[2,3,3,2,2,3],[0,0,1,1,3,3],[1,1,0,0,2,2]]},
 {id:'sunspire',name:'Sunspire',theme:'Radiant',note:'Noon on a blade. Floods them with gold.',rows:[[1,1,1,1,1,1],[1,1,0,0,1,1],[3,3,1,1,2,2],[0,0,2,2,3,3]]},
 {id:'hearthkeeper',name:'Hearthkeeper\u2019s Cleaver',theme:'Tavern',note:'From the tavern kitchen. Red and green.',rows:[[0,0,2,2,0,0],[2,0,0,2,2,0],[1,1,3,3,1,1],[3,3,1,1,3,3]]}
];
export function equippedSword(id,{custom=null,primary=0,secondary=0}={}){
 const base=PATTERNS.find(p=>p.id===id)??THEMED.find(p=>p.id===id)??PATTERNS[1];
 if(base.id==='custom'&&custom)return {...custom,id:'custom'};
 return base.referenceId===undefined?base:{...base,rows:swordRows(base.referenceId,primary,secondary)};
}
