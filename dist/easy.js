import {event,clamp,NOTE_NAMES} from './model.js';

// Beginner-mode music engine. Pure logic: no DOM, no audio, no project mutation.
// It turns plain-language choices — a vibe, a mood, "how busy" — into notes that
// stay in key and in time, so someone who knows no theory still cannot play a wrong note.

export const SCALES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],lydian:[0,2,4,6,7,9,11],mixolydian:[0,2,4,5,7,9,10]};
export const MOODS=[
 {id:'bright',name:'Bright and happy',scale:'major',hint:'Feel-good and open.'},
 {id:'dreamy',name:'Dreamy and floating',scale:'lydian',hint:'Weightless, cinematic.'},
 {id:'soulful',name:'Warm and soulful',scale:'mixolydian',hint:'Bluesy, laid back.'},
 {id:'chill',name:'Cool and chill',scale:'dorian',hint:'Moody without being sad.'},
 {id:'sad',name:'Sad and emotional',scale:'minor',hint:'The classic minor key.'},
 {id:'dark',name:'Dark and tense',scale:'phrygian',hint:'Heavy and dramatic.'}];
export const ROOTS=NOTE_NAMES.map((name,pitch)=>({pitch,name}));
export const scaleOfMood=id=>(MOODS.find(m=>m.id===id)||MOODS[4]).scale;
export const moodOfScale=scale=>MOODS.find(m=>m.scale===scale)||MOODS[4];
export const minorish=scale=>['minor','dorian','phrygian'].includes(scale);
export const keyName=(root,scale)=>`${NOTE_NAMES[((root%12)+12)%12]} ${moodOfScale(scale).name.toLowerCase()}`;

// Chord movements written as scale degrees, so they stay diatonic in whichever mood is chosen.
const MAJOR_MOVES=[[0,4,5,3],[0,5,3,4],[5,3,0,4],[0,3,0,4],[3,4,5,0],[0,2,3,4]];
const MINOR_MOVES=[[0,5,2,6],[0,6,5,6],[0,3,5,4],[5,2,6,0],[0,2,5,6],[0,4,5,3]];
// Beginner melodies only land on the five degrees that sound good over any chord in the key.
const SAFE_MAJOR=[0,1,2,4,5],SAFE_MINOR=[0,2,3,4,6];

export const VIBES=[
 {id:'lofi',name:'Lo-fi chill',blurb:'Dusty drums, warm keys, late-night calm.',bpm:84,swing:.2,mood:'chill',humanize:.06,bass:'walk',chords:'pad',melody:'sparse',seventh:.7,
  drums:{kick:'x...--o---x.--.-',snare:'----x--.----x-..',hat:'x.o.x.o.x.o.x.o+',openhat:'------o-------.-',clap:'----.-------.---',perc:'--.---.--.----.-'},
  mix:{hat:{cutoff:7000,volume:-19},keys:{reverb:.34,cutoff:3600,volume:-14},bass:{cutoff:900,volume:-10},lead:{reverb:.3,delay:.24,volume:-21},kick:{drive:.2}}},
 {id:'boombap',name:'Boom bap',blurb:'Hard swung drums with a head-nod bounce.',bpm:90,swing:.24,mood:'soulful',humanize:.05,bass:'walk',chords:'stab',melody:'call',seventh:.6,
  drums:{kick:'x--.--o---x--.--',snare:'----x-----.-x--.',hat:'x.o.x.o.x.o.x.o.',openhat:'----------o-----',clap:'----.-------.---',perc:'--.--.--.---.-.-'},
  mix:{snare:{drive:.3,volume:-10},hat:{cutoff:9000},keys:{reverb:.2,volume:-15},bass:{cutoff:1100}}},
 {id:'house',name:'House',blurb:'Four on the floor, made for moving.',bpm:124,swing:0,mood:'chill',humanize:.02,bass:'pump',chords:'stab',melody:'hook',seventh:.5,
  drums:{kick:'x---x---x---x---',snare:'----x-------x--.',hat:'--x---x---x---x-',openhat:'--o---o---o---o.',clap:'----x-------x---',perc:'-.--.--.---.-.-o'},
  mix:{kick:{drive:.3,volume:-5},clap:{reverb:.2},hat:{cutoff:12000},bass:{cutoff:1600,volume:-9},keys:{reverb:.22,volume:-15}}},
 {id:'trap',name:'Trap',blurb:'Booming 808s and rolling hi-hats.',bpm:142,swing:0,rolls:true,humanize:.02,mood:'dark',bass:'808',chords:'stab',melody:'hook',seventh:.2,
  drums:{kick:'x-----o--+----.-',snare:'--------x------.',hat:'xoxoxoxoxoxoxoxo',openhat:'--------------.-',clap:'--------x-------',perc:'--.----.--.----.'},
  mix:{kick:{drive:.35,volume:-4},hat:{cutoff:13000,volume:-20},bass:{cutoff:700,volume:-7,decay:1.4,release:.5},lead:{reverb:.28,delay:.2}}},
 {id:'dnb',name:'Drum & bass',blurb:'Fast breakbeats over a deep sub.',bpm:174,swing:0,humanize:.03,mood:'dark',bass:'root',chords:'pad',melody:'sparse',seventh:.4,
  drums:{kick:'x---------x-----',snare:'----x---.---x--.',hat:'x-o-x-o-x-o-x-oo',openhat:'--------------o-',clap:'----.-------.---',perc:'-.-.--.--.-.--.-'},
  mix:{bass:{cutoff:800,volume:-8,decay:1.2},hat:{cutoff:12000,volume:-21},pad:{reverb:.4},lead:{delay:.26}}},
 {id:'afro',name:'Afro groove',blurb:'Rolling percussion and bright chords.',bpm:112,swing:.08,humanize:.05,mood:'soulful',bass:'pump',chords:'arp',melody:'call',seventh:.5,
  drums:{kick:'x--o--x---x--o--',snare:'------.-----x--.',hat:'x.x.x.x.x.x.x.xo',openhat:'---.-------.----',clap:'----x-------x---',perc:'.-o-.-o.-o-.o-.o'},
  mix:{perc:{reverb:.2},keys:{cutoff:6000,reverb:.26,volume:-14},bass:{cutoff:1400}}},
 {id:'pop',name:'Pop',blurb:'Clean, catchy and radio-ready.',bpm:104,swing:.06,humanize:.03,mood:'bright',bass:'pump',chords:'stab',melody:'hook',seventh:.25,
  drums:{kick:'x-----.-x-----.-',snare:'----x-------x---',hat:'x.x.x.x.x.x.x.x.',openhat:'------o-------.-',clap:'----x-------x--.',perc:'--.----.--.---.-'},
  mix:{clap:{reverb:.22},keys:{cutoff:7000,volume:-14},lead:{reverb:.24,delay:.18},bass:{cutoff:1500}}},
 {id:'ambient',name:'Ambient',blurb:'Slow, spacious and barely there.',bpm:72,swing:0,humanize:.08,mood:'dreamy',bass:'root',chords:'swell',melody:'sparse',seventh:.8,
  drums:{kick:'x-----------.---',snare:'--------.-------',hat:'----.-------.--.',openhat:'--------------.-',clap:'----------------',perc:'--.-----.----.--'},
  mix:{kick:{volume:-13},hat:{volume:-25,reverb:.3},pad:{reverb:.6,cutoff:3200},keys:{reverb:.5,cutoff:3000},bass:{cutoff:600,volume:-13},lead:{reverb:.55,delay:.3,volume:-22}}}];
export const vibeById=id=>VIBES.find(v=>v.id===id)||VIBES[0];

// Named song sections. Beginners arrange "Breakdown, Main groove, Big drop", not "C A D".
export const SECTIONS={A:{name:'Main groove',short:'Groove',energy:.62},B:{name:'Lift',short:'Lift',energy:.8},C:{name:'Breakdown',short:'Break',energy:.24},D:{name:'Big drop',short:'Drop',energy:1},
 E:{name:'Extra idea 1',short:'Idea 1',energy:.6},F:{name:'Extra idea 2',short:'Idea 2',energy:.6},G:{name:'Extra idea 3',short:'Idea 3',energy:.6},H:{name:'Extra idea 4',short:'Idea 4',energy:.6}};
export const sectionName=letter=>SECTIONS[letter]?.name||`Section ${letter}`;
export const SONG_SHAPES=[
 {id:'short',name:'Short loop',blurb:'About 30 seconds. Good for a quick idea.',plan:[['A',2],['B',1],['A',2],['D',1]]},
 {id:'standard',name:'Full track',blurb:'Intro, groove, drop, outro. The usual shape.',plan:[['C',1],['A',2],['B',1],['D',2],['C',1],['A',2],['B',1],['D',2]]},
 {id:'builder',name:'Slow build',blurb:'Starts quiet and keeps growing.',plan:[['C',2],['A',2],['A',2],['B',2],['D',2],['D',2],['C',1]]}];

// The five things a beginner actually thinks about, each mapped onto real mixer parameters.
export const MACROS={
 loudness:{name:'Loudness',low:'Quiet',high:'Loud',
  apply:(t,v)=>{t.volume=Math.round((-30+v/100*30)*10)/10;},
  read:t=>clamp((t.volume+30)/30*100,0,100)},
 brightness:{name:'Brightness',low:'Warm',high:'Bright',
  apply:(t,v)=>{t.cutoff=Math.round(300*60**(v/100));t.high=Math.round((-4+v/100*8)*10)/10;},
  read:t=>clamp(Math.log(clamp(t.cutoff,300,18000)/300)/Math.log(60)*100,0,100)},
 space:{name:'Space',low:'Close',high:'Roomy',
  apply:(t,v)=>{t.reverb=Math.round(v/100*.55*100)/100;t.delay=Math.round(Math.max(0,(v-45)/55)*.35*100)/100;},
  read:t=>clamp(t.reverb/.55*100,0,100)},
 punch:{name:'Punch',low:'Soft',high:'Punchy',
  apply:(t,v)=>{t.attack=Math.round((.001+(1-v/100)*.04)*1000)/1000;t.drive=Math.round(v/100*.7*100)/100;t.decay=Math.round(clamp(.5-v/100*.3,.08,3)*100)/100;},
  read:t=>clamp(t.drive/.7*100,0,100)},
 shape:{name:'Shape',low:'Plucky',high:'Smooth',
  apply:(t,v)=>{t.attack=Math.round((.002+v/100*.3)*1000)/1000;t.release=Math.round((.05+v/100*1.1)*100)/100;t.decay=Math.round((.15+v/100*1.2)*100)/100;},
  read:t=>clamp((t.release-.05)/1.1*100,0,100)}};
export const macroWords=['Very low','Low','Medium','High','Very high'];
export const macroWord=(key,value)=>value<12?MACROS[key].low:value>88?MACROS[key].high:macroWords[clamp(Math.floor(value/20),0,4)];
export const describeMacro=(key,value)=>`${MACROS[key].name}: ${macroWord(key,value)}`;
export function setMacro(t,key,value){MACROS[key].apply(t,clamp(value,0,100));return t;}
export const readMacro=(t,key)=>Math.round(MACROS[key].read(t));
export const groupMacro=(tracks,key)=>tracks.length?Math.round(tracks.reduce((s,t)=>s+MACROS[key].read(t),0)/tracks.length):50;

export const GROUPS=[
 {id:'drums',name:'Drums',blurb:'The heartbeat. Kick, snare, hats and percussion.',instruments:['kick','snare','hat','openhat','clap','rim','tom'],macros:['loudness','punch','brightness','space'],lane:'steps'},
 {id:'bass',name:'Bass',blurb:'The low end that ties the beat to the chords.',instruments:['bass'],macros:['loudness','brightness','shape','space'],lane:'notes'},
 {id:'chords',name:'Chords',blurb:'The harmony everything else sits on.',instruments:['keys','pad'],macros:['loudness','brightness','shape','space'],lane:'notes'},
 {id:'melody',name:'Melody',blurb:'The part people hum afterwards.',instruments:['lead'],macros:['loudness','brightness','shape','space'],lane:'notes'},
 {id:'extras',name:'Your samples',blurb:'Anything you imported yourself.',instruments:['sample'],macros:['loudness','brightness','space','shape'],lane:'steps'}];
export const groupOf=instrument=>GROUPS.find(g=>g.instruments.includes(instrument))?.id||'extras';
export const ROLES={kick:'kick',snare:'snare',hat:'hat',openhat:'openhat',clap:'clap',rim:'perc',tom:'perc',bass:'bass',keys:'chords',pad:'chords',lead:'melody',sample:'perc'};
export const roleOf=instrument=>ROLES[instrument]||'perc';

// Mixer starting points that keep a generated beat balanced before any knob is touched.
const MIX={kick:{volume:-6,pan:0,reverb:0,cutoff:18000,attack:.002,decay:.35,drive:.1},snare:{volume:-11,pan:0,reverb:.14,cutoff:16000,drive:.1},
 hat:{volume:-19,pan:-.16,reverb:.06,cutoff:14000},openhat:{volume:-21,pan:.2,reverb:.14,cutoff:14000},clap:{volume:-14,pan:.08,reverb:.18,cutoff:15000},
 rim:{volume:-18,pan:-.22,reverb:.12,cutoff:15000},tom:{volume:-15,pan:.14,reverb:.16,cutoff:12000},
 bass:{volume:-9,pan:0,reverb:0,cutoff:1200,attack:.004,decay:.6,release:.2,drive:.1},
 keys:{volume:-15,pan:-.12,reverb:.28,cutoff:4200,attack:.01,decay:1,release:.5},
 pad:{volume:-18,pan:.1,reverb:.42,cutoff:3200,attack:.25,decay:1.6,release:1.1},
 lead:{volume:-20,pan:.16,reverb:.26,delay:.2,cutoff:9000,attack:.006,decay:.5,release:.3},
 sample:{volume:-14,pan:0,reverb:.12,cutoff:16000}};
export function applyVibeMix(t,vibe){Object.assign(t,MIX[t.instrument]||{},vibe?.mix?.[t.instrument]||{});return t;}

export const randomSeed=()=>Math.floor(Math.random()*2147483647)+1;
export function rng(seed){let a=(seed>>>0)||1;return()=>{a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const pick=(random,list)=>list[Math.floor(random()*list.length)%list.length];

export function progressionFor(scale,random=Math.random){return pick(random,minorish(scale)?MINOR_MOVES:MAJOR_MOVES).slice();}
export function degreeToMidi(root,scale,degree,base=48){const steps=SCALES[scale]||SCALES.minor,n=steps.length,oct=Math.floor(degree/n);return base+root+oct*12+steps[((degree%n)+n)%n];}
export function safeDegree(scale,degree){const safe=minorish(scale)?SAFE_MINOR:SAFE_MAJOR,n=7,oct=Math.floor(degree/n),d=((degree%n)+n)%n;let best=safe[0];for(const s of safe)if(Math.abs(s-d)<Math.abs(best-d))best=s;return oct*n+best;}
export function fitOctave(note,low,high){let n=note;while(n<low)n+=12;while(n>high)n-=12;return clamp(n,low,high);}
export function anchor(root,low,high){let n=low-(low%12)+root;while(n<low)n+=12;while(n>high)n-=12;return n;}
export function chordDegrees(degree,seventh=false){return seventh?[degree,degree+2,degree+4,degree+6]:[degree,degree+2,degree+4];}

// Changing key or mood moves the music you already wrote instead of throwing it away:
// each note keeps its position in the old scale and lands on the same position in the new one.
export function retuneNote(note,fromRoot,fromScale,toRoot,toScale){
 const steps=SCALES[fromScale]||SCALES.minor,rel=note-fromRoot,oct=Math.floor(rel/12),pc=((rel%12)+12)%12;
 let index=steps.indexOf(pc);
 if(index<0)index=steps.reduce((best,s,i)=>Math.abs(s-pc)<Math.abs(steps[best]-pc)?i:best,0);
 return degreeToMidi(toRoot,toScale,oct*steps.length+index,0);
}

const LEVELS={x:1,o:.62,'+':.4,'.':.22,'-':0};
export const parseRow=row=>[...row].map(c=>LEVELS[c]??0);
export function rowSteps(random,row,energy){const weights=parseRow(row),out=[];
 for(let i=0;i<weights.length;i++){const w=weights[i];if(!w)continue;const chance=w>=1?(energy<.3?.55+energy:1):clamp(w*(.4+energy*1.25),0,.94);if(random()<chance)out.push(i);}
 return out;}
const byStep=notes=>{const seen=new Set();return notes.filter(n=>seen.has(n.step)?false:(seen.add(n.step),true)).sort((a,b)=>a.step-b.step);};

export function generateDrums(random,vibe,{steps=32,energy=.62}={}){
 const bars=Math.max(1,Math.round(steps/16)),out={};
 for(const [role,row] of Object.entries(vibe.drums||{})){
  const notes=[];
  for(let bar=0;bar<bars;bar++)for(const s of rowSteps(random,row,clamp(energy+(bar===bars-1?.05:0),0,1))){
   const step=bar*16+s;if(step>=steps)continue;
   const accent=s%4===0?.14:s%2===0?.05:0,base={kick:.95,snare:.9,clap:.82,hat:.55,openhat:.62,perc:.6}[role]??.75;
   const n=event(step,60,clamp(base+accent-random()*.18,.15,1),role==='openhat'?2:1);
   if(vibe.humanize&&role!=='kick'&&random()<.6)n.offset=Math.round(random()*vibe.humanize*100)/100;
   if(vibe.rolls&&role==='hat'&&s%4===3&&random()<.15+.3*energy)n.ratchet=random()<.35?3:2;
   notes.push(n);
  }
  // A short fill at the end of the loop stops a repeating pattern sounding like a machine.
  if(['snare','perc','tom'].includes(role)&&energy>.35&&random()<.3+energy*.45){
   const start=steps-Math.round(2+random()*2);
   for(let s=start;s<steps;s++)if(random()<.65)notes.push(event(s,60,clamp(.45+ (s-start)*.12,.2,1),1));
  }
  out[role]=byStep(notes);
 }
 return out;
}

export function generateBass(random,vibe,{steps=32,energy=.62,root=9,scale='minor',progression=[0],chordStart=0,kick=[]}={}){
 const bars=Math.max(1,Math.round(steps/16)),base=anchor(root,31,38)-root,style=vibe.bass||'root',notes=[];
 const kickSteps=new Set(kick.map(n=>n.step));
 for(let bar=0;bar<bars;bar++){
  const degree=progression[(chordStart+bar)%progression.length],low=degreeToMidi(root,scale,degree,base),starts=new Set([bar*16]);
  if(style==='808'){if(random()<.5+energy*.3)starts.add(bar*16+(random()<.5?6:10));}
  else if(style==='pump'){for(const s of [4,8,12])if(random()<.55+energy*.4)starts.add(bar*16+s);if(random()<energy*.5)starts.add(bar*16+14);}
  else if(style==='follow'||style==='walk'){for(let s=1;s<16;s++)if(kickSteps.has(bar*16+s)&&random()<.55+energy*.4)starts.add(bar*16+s);
   if(style==='walk')for(const s of [6,11,14])if(random()<.2+energy*.45)starts.add(bar*16+s);}
  else if(random()<energy*.4)starts.add(bar*16+8);
  const list=[...starts].filter(s=>s<steps).sort((a,b)=>a-b);
  list.forEach((step,i)=>{
   const next=list[i+1]??bar*16+16,span=clamp(next-step,1,16);
   let pitch=low;
   if(i>0){const move=random();pitch=move<.6?low:move<.8?low+12:degreeToMidi(root,scale,safeDegree(scale,degree+(random()<.5?4:2)),base);}
   const long=style==='808'?clamp(span*(random()<.5?1:.75),1,16):style==='pump'?Math.min(span,random()<.5?1:2):style==='root'?span:Math.min(span,i===0?clamp(span,1,8):2);
   notes.push(event(step,fitOctave(pitch,28,55),clamp(.72+(step%16===0?.14:0)-random()*.12,.3,1),Math.max(.5,Math.round(long*2)/2)));
  });
 }
 return byStep(notes);
}

export function generateChords(random,vibe,{steps=32,energy=.62,root=9,scale='minor',progression=[0],chordStart=0}={}){
 const bars=Math.max(1,Math.round(steps/16)),base=anchor(root,48,59)-root,style=vibe.chords||'pad',notes=[];
 const seventh=random()<(vibe.seventh??.4);
 for(let bar=0;bar<bars;bar++){
  const degree=progression[(chordStart+bar)%progression.length],voice=chordDegrees(degree,seventh).map(d=>fitOctave(degreeToMidi(root,scale,d,base),36,84));
  if(style==='arp'){
   const order=random()<.5?voice:[...voice].reverse(),grid=energy>.5?2:4;
   for(let s=0;s<16;s+=grid){const step=bar*16+s;if(step>=steps)continue;if(s&&random()>.55+energy*.4)continue;
    notes.push(event(step,order[(s/grid)%order.length],clamp(.62-random()*.14,.25,1),grid));}
  }else if(style==='stab'){
   const hits=[0,...(random()<.55+energy*.35?[6]:[]),...(random()<.4+energy*.4?[10]:[]),...(random()<energy*.5?[14]:[])];
   for(const s of hits){const step=bar*16+s;if(step>=steps)continue;
    for(const p of voice)notes.push(event(step,p,clamp(.58+(s?0:.1)-random()*.12,.25,1),s===0?4:2));}
  }else if(style==='swell'){
   for(const p of voice)notes.push(event(bar*16,p,clamp(.5-random()*.1,.2,1),16));
  }else{
   for(const p of voice)notes.push(event(bar*16,p,clamp(.58-random()*.12,.25,1),random()<.35?8:16));
   if(random()<.3+energy*.3){const step=bar*16+12;if(step<steps)for(const p of voice)notes.push(event(step,p+ (random()<.5?0:12),.42,4));}
  }
 }
 return notes.sort((a,b)=>a.step-b.step);
}

// Melodies repeat and vary one small idea. That, not randomness, is what makes them sound written.
export function generateMotif(random,{energy=.62,style='hook'}={}){
 const size=style==='sparse'?2+Math.floor(random()*2):3+Math.floor(random()*3),grid=style==='sparse'?4:2,motif=[];
 let at=0,degree=0;
 for(let i=0;i<size;i++){
  const len=style==='sparse'?(random()<.5?4:2):(random()<.35?2:1)*grid/2;
  motif.push({at,degree,length:Math.max(1,len)});
  at+=Math.max(1,Math.round(len))+ (random()<.35+energy*.3?0:grid/2);
  if(at>=8)break;
  degree+=[-2,-1,1,1,2,3][Math.floor(random()*6)];
  degree=clamp(degree,-4,7);
 }
 return motif;
}

export function generateMelody(random,vibe,{steps=32,energy=.62,root=9,scale='minor',progression=[0],chordStart=0,motif=null}={}){
 const bars=Math.max(1,Math.round(steps/16)),base=anchor(root,60,71)-root,style=vibe.melody||'hook',notes=[];
 const idea=motif||generateMotif(random,{energy,style});
 for(let bar=0;bar<bars;bar++){
  const degree=progression[(chordStart+bar)%progression.length];
  const slots=style==='call'?(bar%2?[8]:[0]):style==='sparse'?[0]:[0,...(random()<.35+energy*.5?[8]:[])];
  if(style!=='sparse'&&bar%4===2&&random()<.4)continue; // leave a bar of air
  for(const slot of slots){
   const lift=bar===bars-1&&random()<.5?(random()<.5?1:-1):0;
   for(const step of idea){
    const at=bar*16+slot+step.at;if(at>=steps)continue;
    const pitch=degreeToMidi(root,scale,safeDegree(scale,degree+step.degree+lift),base);
    notes.push(event(at,fitOctave(pitch,52,96),clamp(.6+(step.at===0?.12:0)-random()*.14,.25,1),step.length));
   }
  }
 }
 return byStep(notes);
}

export function generateParts({vibe='lofi',root=9,scale='minor',seed=1,energy=.62,steps=32,progression=null,chordStart=0,motif=null}={}){
 const v=vibeById(vibe),random=rng(seed),moves=progression||progressionFor(scale,random);
 const drums=generateDrums(random,v,{steps,energy});
 return {...drums,
  bass:generateBass(random,v,{steps,energy,root,scale,progression:moves,chordStart,kick:drums.kick||[]}),
  chords:generateChords(random,v,{steps,energy,root,scale,progression:moves,chordStart}),
  melody:generateMelody(random,v,{steps,energy,root,scale,progression:moves,chordStart,motif}),
  progression:moves};
}

// Pitches a beginner is allowed to click in the simple note grid: in key, in a sensible octave.
export function scaleLadder(root,scale,group){
 const [low,high]=group==='bass'?[31,55]:group==='chords'?[48,72]:[60,84];
 const steps=SCALES[scale]||SCALES.minor,out=[];
 for(let n=low;n<=high;n++)if(steps.includes(((n-root)%12+12)%12))out.push(n);
 return out.reverse();
}

export function coachTip(project,{easyStep=0}={}){
 const has=role=>project.tracks.some(t=>roleOf(t.instrument)===role&&t.patterns[project.arrangement[0]?.pattern||'A']?.length);
 if(!project.tracks.length)return 'Add an instrument to get started.';
 if(easyStep===0)return 'Pick a vibe, then press "Make me a beat" — press it as many times as you like. Nothing here can be broken: Undo is always one click away.';
 if(!has('kick'))return 'Your drums are empty. Hit "New idea" on the Drums card to get a groove going.';
 if(!has('bass'))return 'Add a bassline — it is what makes a loop feel finished.';
 if(!has('melody'))return 'Roll a melody. Every note in the grid is already in your key, so nothing can sound wrong.';
 if(project.arrangement.length<4)return 'Happy with the loop? Build a song to turn it into a full track.';
 return 'Sounding good. Tweak the feel sliders, then export your audio.';
}
