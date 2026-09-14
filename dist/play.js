import {NOTE_NAMES,midiName,clamp,stepSeconds,stepTime} from './model.js';

// The playable face of the studio: a drum kit you hit, a keyboard you play, and a
// timing challenge scored against the beat you already wrote. Pure logic and markup —
// no document, no audio context — so every rule here is testable outside a browser.

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ── The kit ──────────────────────────────────────────────────────────────────
// Laid out on a 1000×420 stage in audience view: hats and snare left, kick centre,
// ride and auxiliary percussion right. x/y are the centre of each piece.
export const STAGE_W=1000,STAGE_H=420,FLOOR=404;
// Keys run left to right in two rows: the top row is the cymbals, the bottom row the drums,
// in the same order they sit on the stage. The letter is printed on the piece it plays.
export const KIT=[
 {instrument:'crash',label:'Crash',kind:'cymbal',key:'Q',x:130,y:70,w:150,h:38},
 {instrument:'openhat',label:'Open hat',kind:'cymbal',key:'W',x:300,y:78,w:150,h:30},
 {instrument:'hat',label:'Hi-hat',kind:'cymbal',key:'E',x:300,y:120,w:150,h:30},
 {instrument:'cowbell',label:'Cowbell',kind:'bell',key:'R',x:610,y:116,w:108,h:56},
 {instrument:'ride',label:'Ride',kind:'cymbal',key:'T',x:830,y:100,w:230,h:48},
 {instrument:'clap',label:'Clap',kind:'plate',key:'A',x:78,y:150,w:116,h:70},
 {instrument:'rim',label:'Rim',kind:'plate',key:'S',x:78,y:250,w:116,h:70},
 {instrument:'snare',label:'Snare',kind:'drum',key:'D',x:250,y:280,w:168,h:168},
 {instrument:'tom',label:'Tom',kind:'drum',key:'F',x:415,y:215,w:146,h:146},
 {instrument:'kick',label:'Kick',kind:'drum',key:'G',x:640,y:292,w:250,h:250},
 {instrument:'conga',label:'Conga',kind:'drum',key:'H',x:900,y:255,w:130,h:130},
 {instrument:'shaker',label:'Shaker',kind:'plate',key:'J',x:900,y:372,w:130,h:58}];
export const KIT_KEYS=Object.fromEntries(KIT.map(p=>[p.key.toLowerCase(),p.instrument]));
export const kitPiece=instrument=>KIT.find(p=>p.instrument===instrument)||null;
export const box=p=>({left:(p.x-p.w/2)/STAGE_W*100,top:(p.y-p.h/2)/STAGE_H*100,width:p.w/STAGE_W*100,height:p.h/STAGE_H*100});

// The hardware behind the pieces — stands, legs and the floor — drawn as one SVG layer from the
// same coordinates the pieces use, so it stays in step with the layout instead of being traced by hand.
const bottom=p=>p.y+p.h/2, side=p=>p.w/2;
export function kitRig(){
 const at=i=>KIT.find(p=>p.instrument===i),parts=[];
 const rod=(x,y1,y2,w=3)=>`<rect class="rod" x="${(x-w/2).toFixed(1)}" y="${y1.toFixed(1)}" width="${w}" height="${Math.max(0,y2-y1).toFixed(1)}" rx="${(w/2).toFixed(1)}"/>`;
 const tripod=(x,y,spread=26)=>`<path class="rod-leg" d="M${x} ${y}L${x-spread} ${FLOOR}M${x} ${y}L${x+spread} ${FLOOR}M${x} ${y}L${x} ${FLOOR}"/>`;
 parts.push(`<ellipse class="floor" cx="${STAGE_W/2}" cy="${FLOOR+6}" rx="${STAGE_W*0.47}" ry="26"/>`);
 // Straight stands for the crash and the ride.
 for(const piece of [at('crash'),at('ride')]){
  parts.push(rod(piece.x,bottom(piece),FLOOR-54),tripod(piece.x,FLOOR-54));
 }
 // The hi-hat is one stand carrying both cymbals, with a pedal at the foot.
 const open=at('openhat'),closed=at('hat');
 parts.push(rod(open.x,open.y,FLOOR-46,4),tripod(open.x,FLOOR-46,22),
  `<path class="pedal" d="M${open.x-34} ${FLOOR-4}h56l10 10h-66z"/>`,
  `<rect class="rod" x="${open.x-side(closed)-4}" y="${closed.y-2}" width="${closed.w+8}" height="4" rx="2"/>`);
 // The cowbell and the rack tom are mounted on the kick.
 const bell=at('cowbell'),tom=at('tom'),kick=at('kick');
 parts.push(rod(bell.x,bottom(bell),kick.y-kick.h/2+16),
  `<path class="arm" d="M${tom.x+10} ${bottom(tom)-8}q26 26 ${kick.x-tom.x-50} 30"/>`);
 // Kick spurs, snare stand, conga stand.
 parts.push(`<path class="rod-leg" d="M${kick.x-side(kick)+18} ${bottom(kick)-44}L${kick.x-side(kick)-16} ${FLOOR}M${kick.x+side(kick)-18} ${bottom(kick)-44}L${kick.x+side(kick)+16} ${FLOOR}"/>`);
 const snare=at('snare'),conga=at('conga');
 parts.push(tripod(snare.x,bottom(snare)-16,34),tripod(conga.x,bottom(conga)-10,24));
 return `<svg class="kit-rig" viewBox="0 0 ${STAGE_W} ${STAGE_H}" preserveAspectRatio="none" aria-hidden="true">${parts.join('')}</svg>`;
}

// Line art laid over each piece's face: lugs and a hoop on a drum, grooves and a bell on a cymbal.
const LUGS=8;
export function pieceArt(kind){
 if(kind==='drum'){
  const lugs=Array.from({length:LUGS},(_,i)=>{const a=(i/LUGS)*Math.PI*2-Math.PI/2,x=50+Math.cos(a)*43,y=50+Math.sin(a)*43;
   return `<circle class="lug" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.4"/>`;}).join('');
  return `<svg class="art" viewBox="0 0 100 100" aria-hidden="true"><circle class="hoop" cx="50" cy="50" r="46.5"/><circle class="hoop thin" cx="50" cy="50" r="38"/>${lugs}<path class="sheen" d="M22 34a34 34 0 0 1 44-12"/></svg>`;
 }
 if(kind==='cymbal'){
  const rings=[0.86,0.68,0.5,0.32].map(r=>`<ellipse class="groove" cx="50" cy="50" rx="${(49*r).toFixed(1)}" ry="${(46*r).toFixed(1)}"/>`).join('');
  return `<svg class="art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${rings}<ellipse class="bell" cx="50" cy="50" rx="9" ry="13"/><circle class="hole" cx="50" cy="50" r="2.4"/></svg>`;
 }
 if(kind==='bell')return '<svg class="art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="sheen" d="M30 10L24 90"/><path class="sheen thin" d="M70 10l6 80"/></svg>';
 return '<svg class="art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect class="inset" x="7" y="9" width="86" height="82" rx="8"/></svg>';
}

// A piece with no track behind it is still drawn — tapping it adds that sound to the kit.
export function kitMarkup(tracks,{removable=false}={}){
 const owner=new Map();for(const t of tracks)if(!owner.has(t.instrument))owner.set(t.instrument,t);
 return kitRig()+KIT.map(p=>{
  const t=owner.get(p.instrument),r=box(p);
  const style=`left:${r.left.toFixed(3)}%;top:${r.top.toFixed(3)}%;width:${r.width.toFixed(3)}%;height:${r.height.toFixed(3)}%${t?`;--track:${esc(t.color)}`:''}`;
  const label=t?`Play ${esc(t.name)} — key ${p.key}`:`Add a ${esc(p.label.toLowerCase())} to the kit`;
  const drop=t&&removable?`<span class="piece-drop" data-kit-remove="${esc(t.id)}" role="button" tabindex="0" aria-label="Remove ${esc(t.name)} from the kit" title="Remove ${esc(t.name)}">✕</span>`:'';
  return `<button class="piece ${p.kind} ${t?'live':'empty'}" style="${style}" ${t?`data-kit="${esc(t.id)}"`:`data-kit-add="${p.instrument}"`} aria-label="${label}" title="${label}">`+
   `<span class="piece-face">${pieceArt(p.kind)}</span><span class="piece-label">${esc(p.label)}${t?`<kbd>${p.key}</kbd>`:'<i>+</i>'}</span></button>${drop}`;
 }).join('');
}

// ── The keyboard ─────────────────────────────────────────────────────────────
const WHITE=[0,2,4,5,7,9,11],BLACK=[[0,1],[1,3],[3,6],[4,8],[5,10]];
// Computer keys for C4–C5, matching the studio's existing chromatic row.
export const TYPING_KEYS={60:'Q',61:'2',62:'W',63:'3',64:'E',65:'T',66:'6',67:'Y',68:'7',69:'U',70:'8',71:'I',72:'O'};
export function keyboardKeys(low=48,octaves=2,scalePitches=null){
 const whites=octaves*7,unit=100/whites,keys=[];
 for(let o=0;o<octaves;o++)for(let i=0;i<7;i++){const note=low+o*12+WHITE[i];keys.push({note,type:'white',x:(o*7+i)*unit,w:unit,inKey:!scalePitches||scalePitches.has(note%12)});}
 for(let o=0;o<octaves;o++)for(const [i,offset] of BLACK){const note=low+o*12+offset,w=unit*0.62;
  keys.push({note,type:'black',x:(o*7+i+1)*unit-w/2,w,inKey:!scalePitches||scalePitches.has(note%12)});}
 return keys;
}
export function keyboardMarkup(keys,{stayInKey=false}={}){
 return keys.map(k=>{
  const off=stayInKey&&!k.inKey,typed=TYPING_KEYS[k.note];
  return `<button class="key ${k.type}${k.inKey?' in-key':''}${off?' muted':''}" style="left:${k.x.toFixed(3)}%;width:${k.w.toFixed(3)}%" data-key-note="${k.note}" ${off?'disabled aria-disabled="true"':''} aria-label="${midiName(k.note)}${k.inKey?', in key':''}">`+
   `<span class="key-name">${k.type==='white'?midiName(k.note):NOTE_NAMES[k.note%12]}</span>${typed&&!off?`<kbd>${typed}</kbd>`:''}</button>`;
 }).join('');
}

// ── The challenge ────────────────────────────────────────────────────────────
// Timing windows are measured against the audio clock, so a hit is judged on when it
// was heard, not on which animation frame it landed in.
export const JUDGE=[{id:'perfect',label:'Perfect',window:0.055,score:100},{id:'great',label:'Great',window:0.1,score:70},{id:'okay',label:'Okay',window:0.16,score:35}];
export const MISS_WINDOW=JUDGE.at(-1).window;
export const RANKS=[[0.95,'S'],[0.85,'A'],[0.7,'B'],[0.5,'C'],[0,'D']];
export const rankFor=accuracy=>(RANKS.find(([floor])=>accuracy>=floor)||RANKS.at(-1))[1];
export const verdictFor=(delta,tolerance=1)=>JUDGE.find(j=>Math.abs(delta)<=j.window*tolerance)||null;

// Difficulty is three knobs at once: how many parts fall at you, how close together their notes
// are allowed to be, and how forgiving the timing windows are.
export const DIFFICULTY=[
 {id:'easy',name:'Easy',blurb:'Three parts, on the beat, one key at a time.',lanes:3,gap:4,solo:true,tolerance:1.45},
 {id:'medium',name:'Medium',blurb:'Five parts, eighth notes.',lanes:5,gap:2,solo:false,tolerance:1.15},
 {id:'hard',name:'Hard',blurb:'Every part, every note.',lanes:7,gap:0,solo:false,tolerance:1}];
export const difficultyById=id=>DIFFICULTY.find(d=>d.id===id)||DIFFICULTY[0];
// When the challenge cannot show every part, it keeps the ones a drummer would miss first.
export const LANE_PRIORITY=['kick','snare','hat','clap','openhat','ride','crash','cowbell','rim','tom','conga','shaker'];

// Lanes are what the player aims at: one per drum voice, or one per pitch for a melody.
export function lanesFor(tracks,pattern,{max=7}={}){
 const lanes=[];
 for(const t of tracks){
  if(!(t.patterns[pattern]||[]).length)continue;
  const piece=kitPiece(t.instrument),rank=LANE_PRIORITY.indexOf(t.instrument);
  lanes.push({id:t.id,trackId:t.id,note:null,label:t.name,color:t.color,key:piece?.key||'',
   at:piece?piece.x:STAGE_W,rank:rank<0?LANE_PRIORITY.length:rank});
 }
 // Chosen by musical importance, then shown left to right in the order the pieces sit on the stage.
 return lanes.sort((a,b)=>a.rank-b.rank).slice(0,max).sort((a,b)=>a.at-b.at);
}
export function pitchLanes(t,pattern,{max=7}={}){
 const notes=t?.patterns?.[pattern]||[],pitches=[...new Set(notes.map(n=>n.note))].sort((a,b)=>a-b);
 const kept=pitches.length>max?pitches.slice(0,max):pitches;
 return kept.map(note=>({id:`${t.id}:${note}`,trackId:t.id,note,label:midiName(note),color:t.color,key:''}));
}
// Every target the player has to hit, expanded across the passes the challenge runs for.
export function keepOnePerStep(targets,lanes){
 const rank=new Map(lanes.map((l,i)=>[l.id,l.rank??i])),best=new Map();
 for(const t of targets){const held=best.get(t.step);
  if(!held||(rank.get(t.lane)??Infinity)<(rank.get(held.lane)??Infinity))best.set(t.step,t);}
 return [...best.values()].sort((a,b)=>a.time-b.time||String(a.lane).localeCompare(String(b.lane)));
}
export function buildTargets(project,pattern,lanes,{loops=4,gap=0,solo=false}={}){
 const byTrack=new Map(project.tracks.map(t=>[t.id,t])),span=stepSeconds(project),loopSeconds=project.patternLengths[pattern]*span;
 const single=[];
 for(const lane of lanes){
  const t=byTrack.get(lane.trackId);if(!t)continue;
  const notes=(t.patterns[pattern]||[]).filter(n=>lane.note===null||n.note===lane.note).sort((a,b)=>a.step-b.step);
  // Thinning keeps the first note of a run and drops what falls inside the gap, so a sixteenth-note
  // hat becomes something a beginner can actually hit instead of vanishing from the challenge.
  let last=-Infinity;
  for(const n of notes){
   if(n.step-last<gap)continue;
   last=n.step;
   single.push({lane:lane.id,step:n.step,velocity:n.velocity,time:stepTime(n.step,project)+n.offset*span});
  }
 }
 single.sort((a,b)=>a.time-b.time||String(a.lane).localeCompare(String(b.lane)));
 // On the gentlest level two parts never land together: the beat keeps only the more important
 // of the two, so the player is asked for one key at a time rather than a chord of them.
 const kept=solo?keepOnePerStep(single,lanes):single;
 const out=[];
 for(let pass=0;pass<loops;pass++)for(const target of kept)out.push({...target,pass,time:target.time+pass*loopSeconds});
 return out;
}
export class Scorer{
 constructor(targets,{tolerance=1}={}){this.targets=targets.map(t=>({...t,verdict:null,delta:0}));this.combo=0;this.best=0;this.score=0;this.strays=0;
  this.tolerance=tolerance;this.window=MISS_WINDOW*tolerance;
  this.counts={perfect:0,great:0,okay:0,miss:0};this.last=null;this.end=(targets.at(-1)?.time??0)+this.window;}
 get max(){return this.targets.length*JUDGE[0].score;}
 get accuracy(){return this.max?clamp(this.score/this.max,0,1):0;}
 get rank(){return rankFor(this.accuracy);}
 get remaining(){return this.targets.filter(t=>!t.verdict).length;}
 // A hit resolves the nearest unjudged target in its lane; anything else is a stray.
 hit(lane,at){
  let found=null,delta=0;
  for(const t of this.targets){if(t.verdict||t.lane!==lane)continue;const d=at-t.time;if(Math.abs(d)>this.window)continue;if(!found||Math.abs(d)<Math.abs(delta)){found=t;delta=d;}}
  if(!found){this.strays++;this.combo=0;this.last={id:'stray',label:'—',lane,at};return this.last;}
  const judge=verdictFor(delta,this.tolerance);
  found.verdict=judge.id;found.delta=delta;this.score+=judge.score;this.counts[judge.id]++;this.combo++;this.best=Math.max(this.best,this.combo);
  this.last={id:judge.id,label:judge.label,lane,at,delta};
  return this.last;
 }
 sweep(at){for(const t of this.targets)if(!t.verdict&&t.time<at-this.window){t.verdict='miss';this.counts.miss++;this.combo=0;}}
 done(at){return at>this.end;}
 get summary(){return {score:this.score,max:this.max,accuracy:this.accuracy,rank:this.rank,combo:this.best,strays:this.strays,...this.counts};}
}

// ── The falling-note canvas ──────────────────────────────────────────────────
export const LEAD=1.9;
export const GUTTER=48;
export const laneLabel=(text,width)=>{const room=Math.max(3,Math.floor(width/6.6));return text.length>room?text.slice(0,room-1)+'…':text;};
export function drawChallenge(ctx,{width,height,lanes,targets,elapsed,flashes=new Map(),lead=LEAD,now=0,ground='#0d0f0c'}){
 ctx.clearRect(0,0,width,height);
 if(!lanes.length)return;
 const laneW=width/lanes.length,hitY=height-GUTTER;
 lanes.forEach((lane,i)=>{
  ctx.fillStyle=i%2?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.012)';ctx.fillRect(i*laneW,0,laneW,hitY);
 });
 const index=new Map(lanes.map((l,i)=>[l.id,i]));
 for(const t of targets){
  const ahead=t.time-elapsed;if(ahead>lead||ahead<-0.3)continue;
  const i=index.get(t.lane);if(i===undefined)continue;
  const y=hitY-ahead/lead*hitY,w=laneW-14,x=i*laneW+7,h=Math.max(9,12+t.velocity*10);
  ctx.globalAlpha=t.verdict==='miss'?0.18:t.verdict?0.3:1;
  ctx.fillStyle=t.verdict&&t.verdict!=='miss'?'#d5f782':lanes[i].color||'#d5f782';
  ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y-h/2,w,h,5);else ctx.rect(x,y-h/2,w,h);ctx.fill();
  ctx.globalAlpha=1;
 }
 // The key band is painted last: it hides notes that have passed the line, and it puts the letter
 // you have to press directly under the lane it belongs to.
 ctx.fillStyle=ground;ctx.fillRect(0,hitY+4,width,height-hitY-4);
 ctx.textAlign='center';ctx.textBaseline='middle';
 lanes.forEach((lane,i)=>{
  const x=i*laneW,flash=flashes.get(lane.id)||0,glow=clamp((flash-now+0.22)/0.22,0,1);
  ctx.fillStyle=`rgba(213,247,130,${(0.06+glow*0.3).toFixed(3)})`;ctx.fillRect(x,hitY-10,laneW,14);
  ctx.fillStyle=lane.color||'#d5f782';ctx.globalAlpha=0.5+glow*0.5;ctx.fillRect(x+3,hitY,laneW-6,4);ctx.globalAlpha=1;
  if(lane.key){
   const w=22,h=20,bx=x+laneW/2-w/2,by=hitY+10;
   ctx.fillStyle=glow>0.05?'#d5f782':'rgba(231,234,225,0.16)';
   ctx.beginPath();if(ctx.roundRect)ctx.roundRect(bx,by,w,h,5);else ctx.rect(bx,by,w,h);ctx.fill();
   ctx.fillStyle=glow>0.05?'#12160e':'#e7eae1';ctx.font='600 13px Inter,system-ui,sans-serif';
   ctx.fillText(lane.key,x+laneW/2,by+h/2+1);
  }
  ctx.fillStyle=glow>0.05?'#d5f782':'rgba(231,234,225,0.6)';ctx.font='11px Inter,system-ui,sans-serif';
  ctx.fillText(laneLabel(lane.label||'',laneW-8),x+laneW/2,height-9);
 });
}
