// Original miniature sword illustrations. Shared materials, distinct silhouettes.
export const ENAMEL_HEX=['#b7544f','#c98045','#dbc15b','#6c9b6e','#668fac','#9475ad','#e3ddcc','#4d4950'];
const blades={
 foil:'M31 12 34 22 34 86 30 86 30 22Z',
 'short-sword':'M32 28 37 38 36 86 28 86 27 38Z',
 'long-sword':'M32 6 39 20 37 85 27 85 25 20Z',
 rapier:'M32 7 35 19 34 88 30 88 29 19Z',
 dirk:'M32 23 39 37 36 86 28 86 25 37Z',
 scimitar:'M20 10Q48 35 37 86L28 86Q36 41 20 10Z',
 cutlass:'M26 17Q45 31 39 87L28 87Q33 47 26 17Z',
 poniard:'M32 13 38 35 36 75 43 68 41 86 23 86 21 68 28 75 26 35Z',
 saber:'M25 8Q44 30 37 87L29 87Q36 35 25 8Z',
 stiletto:'M32 19 35 32 34 87 30 87 29 32Z',
 'skull-dagger':'M32 29 40 43 37 85 27 85 24 43Z',
 falchion:'M25 16Q43 23 43 38L37 86 26 86 29 45Z',
 cleaver:'M22 28 47 28 47 72 34 78 22 78Z',
 backsword:'M30 13 37 24 36 86 29 86Z',
 katana:'M28 10Q40 33 35 88L30 88Q34 36 28 10Z',
 dadao:'M23 15 43 34 37 86 26 86 31 40Z',
 stick:'M30 14 36 12 35 49 39 57 35 62 35 111 28 111 29 67 25 61 30 58Z',
 custom:'M32 14 41 29 37 84 27 84 23 29Z'
};
const guards={
 foil:'M20 90Q20 76 32 77Q44 77 44 90Z',
 rapier:'M22 86Q49 80 46 101Q42 111 33 107L34 102Q43 105 42 95Q40 86 23 91Z',
 cutlass:'M23 85 47 85 46 105Q40 113 33 109L34 104Q41 106 41 92L23 92Z',
 saber:'M21 86 44 85Q53 108 34 111L34 106Q45 105 40 91L21 92Z',
 poniard:'M19 84 24 80 28 87 36 87 41 80 45 84 40 93 24 93Z',
 'skull-dagger':'M20 83 26 87 38 87 44 83 45 89 36 93 28 93 19 89Z',
 falchion:'M21 81 25 86 39 86 43 81 43 92 21 92Z',
 backsword:'M22 88Q18 99 30 103L34 111Q48 102 44 89L39 85 35 91 38 102 32 99 27 94 28 88Z',
 dadao:'M22 83 42 83 46 89 40 92 36 89 27 89 22 95 17 91Z'
};
export function swordIcon(id,primary=0,secondary=0){
 const family=id==='sinners-saber'?'saber':id==='forgotten-falchion'?'falchion':id;
 const type=blades[family]?family:'custom',legacy=id!==family;
 const metal=legacy?'url(#sk-steel-legacy) #b5a9ca':'url(#sk-steel) #c5cfce',edge=legacy?'#e5d8ed':'#ffffff';
 const guard=ENAMEL_HEX[primary]??ENAMEL_HEX[0],grip=ENAMEL_HEX[secondary]??ENAMEL_HEX[0];
 return `<svg class="sword-icon" data-sword="${id}" data-enamel="${primary},${secondary}" viewBox="0 0 64 128" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g stroke="#17121a" stroke-width="2" stroke-linejoin="round"><path d="${blades[type]}" fill="${type==='stick'?'#a98460':metal}"/>${type==='stick'?'<path d="M32 24 31 54M32 74 31 103" stroke="#d0ac7d"/>':`<path d="M32 ${type==='short-sword'||type==='skull-dagger'?40:30} 32 80" stroke="${edge}" stroke-width="1.5"/><path d="M28 90H36V114H28Z" fill="${grip}"/><path d="M28 98H36M28 104H36M28 110H36" stroke="#25252b" stroke-width="1"/><path d="${guards[type]??'M19 85H45V91H19Z'}" fill="${guard}"/><path d="${guards[type]??'M19 85H45V91H19Z'}" fill="url(#sk-sheen) transparent" stroke="none"/><path d="M27 114H37L35 119H29Z" fill="url(#sk-gold) #c4a66c"/>${type==='skull-dagger'?'<path d="M27 112Q23 100 32 100Q41 100 37 112L35 116H29Z" fill="#e3ddcf"/><path d="M27 106H30M34 106H37M31 113V110M34 113V110"/>':''}${type==='cleaver'?'<circle cx="27" cy="34" r="2" fill="#28272c"/>':''}${type==='dadao'?'<path d="M25 87Q9 91 17 104L27 110 24 99 31 94Z" fill="#78916e"/>':''}${type==='custom'?'<path d="M32 47 37 53 32 59 27 53Z" fill="#c4a66c"/>':''}${legacy?'<path d="M27 98 37 102M27 105 37 109" stroke="#c4a66c"/>':''}`}</g></svg>`;
}
