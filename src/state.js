window.dmState = {

  current: {
    world: null,
    campaign: null,
    location: null,
    region: null,

    partyLevels: [3,3,3]
  },


  // populated from SQLite
  worlds: [],

  locations: [],

  regions: [],

  themes: [],


  campaigns: []

};



window.dmState.getTier =
function(avgLevel){

if(avgLevel <=4)
return "Lv 1-4";

if(avgLevel <=8)
return "Lv 5-8";

if(avgLevel <=12)
return "Lv 9-12";

if(avgLevel <=16)
return "Lv 13-16";


return "Lv 17-20";

};



window.dmState.getAverageLevel =
function(){

const levels =
window.dmState.current.partyLevels;


if(!levels.length)
return 0;


const avg =
levels.reduce(
(a,b)=>a+b,
0
)
/levels.length;


return Math.round(avg*10)/10;

};
