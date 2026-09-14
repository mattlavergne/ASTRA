import {NOTE_NAMES,midiName,clamp,stepSeconds,stepTime} from './model.js';

// The playable face of the studio: a drum kit you hit, a keyboard you play, and a
// timing challenge scored against the beat you already wrote. Pure logic and markup —
// no document, no audio context — so every rule here is testable outside a browser.

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ── The kit ──────────────────────────────────────────────────────────────────
// Laid out on a 1000×420 stage in audience view: hats and snare left, kick centre,
// ride and auxiliary percussion right. x/y are the centre of each piece.
export const STAGE_W=1000,STAGE_H=420;
export const KIT=[
 {instrument:'crash',label:'Crash',kind:'cymbal',x:130,y:70,w:150,h:38},
 {instrument:'openhat',label:'Open hat',kind:'cymbal',x:300,y:78,w:150,h:30},
 {instrument:'hat',label:'Hi-hat',kind:'cymbal',x:300,y:120,w:150,h:30},
 {instrument:'ride',label:'Ride',kind:'cymbal',x:830,y:100,w:230,h:48},
 {instrument:'cowbell',label:'Cowbell',kind:'bell',x:610,y:120,w:84,h:58},
 {instrument:'clap',label:'Clap',kind:'plate',x:78,y:150,w:116,h:70},
 {instrument:'rim',label:'Rim',kind:'plate',x:78,y:250,w:116,h:70},
 {instrument:'tom',label:'Tom',kind:'drum',x:415,y:215,w:146,h:146},
 {instrument:'snare',label:'Snare',kind:'drum',x:250,y:280,w:168,h:168},
 {instrument:'kick',label:'Kick',kind:'drum',x:640,y:292,w:250,h:250},
 {instrument:'conga',label:'Conga',kind:'drum',x:900,y:255,w:130,h:130},
 {instrument:'shaker',label:'Shaker',kind:'plate',x:900,y:385,w:130,h:62}];
export const kitPiece=instrument=>KIT.find(p=>p.instrument===instrument)||null;
export const box=p=>({left:(p.x-p.w/2)/STAGE_W*100,top:(p.y-p.h/2)/STAGE_H*100,width:p.w/STAGE_W*100,height:p.h/STAGE_H*100});

// A piece with no track behind it is still drawn — tapping it adds that sound to the kit.
export function kitMarkup(tracks,{hint=()=>''}={}){
 const owner=new Map();for(const t of tracks)if(!owner.has(t.instrument))owner.set(t.instrument,t);
 return KIT.map(p=>{
  const t=owner.get(p.instrument),r=box(p),key=t?hint(t):'';
  const style=`left:${r.left.toFixed(3)}%;top:${r.top.toFixed(3)}%;width:${r.width.toFixed(3)}%;height:${r.height.toFixed(3)}%${t?`;--track:${esc(t.color)}`:''}`;
  const label=t?`Play ${esc(t.name)}`:`Add a ${esc(p.label.toLowerCase())} to the kit`;
  return `<button class="piece ${p.kind} ${t?'live':'empty'}" style="${style}" ${t?`data-kit="${esc(t.id)}"`:`data-kit-add="${p.instrument}"`} aria-label="${label}" title="${label}">`+
   `<span class="piece-face"></span><span class="piece-label">${esc(p.label)}${key?`<kbd>${esc(key)}</kbd>`:''}${t?'':'<i>+</i>'}</span></button>`;
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
export const verdictFor=delta=>JUDGE.find(j=>Math.abs(delta)<=j.window)||null;

// Lanes are what the player aims at: one per drum voice, or one per pitch for a melody.
export function lanesFor(tracks,pattern,{max=7}={}){
 const lanes=[];
 for(const t of tracks){
  const notes=t.patterns[pattern]||[];if(!notes.length)continue;
  const at=KIT.findIndex(p=>p.instrument===t.instrument);
  lanes.push({id:t.id,trackId:t.id,note:null,label:t.name,color:t.color,at:at<0?KIT.length:KIT[at].x});
 }
 // Lanes run left to right in the same order as the pieces on the stage below them.
 return lanes.sort((a,b)=>a.at-b.at).slice(0,max);
}
export function pitchLanes(t,pattern,{max=7}={}){
 const notes=t?.patterns?.[pattern]||[],pitches=[...new Set(notes.map(n=>n.note))].sort((a,b)=>a-b);
 const kept=pitches.length>max?pitches.slice(0,max):pitches;
 return kept.map(note=>({id:`${t.id}:${note}`,trackId:t.id,note,label:midiName(note),color:t.color}));
}
// Every target the player has to hit, expanded across the passes the challenge runs for.
export function buildTargets(project,pattern,lanes,{loops=4}={}){
 const byTrack=new Map(project.tracks.map(t=>[t.id,t])),span=stepSeconds(project),loopSeconds=project.patternLengths[pattern]*span;
 const single=[];
 for(const lane of lanes){
  const t=byTrack.get(lane.trackId);if(!t)continue;
  for(const n of t.patterns[pattern]||[]){
   if(lane.note!==null&&n.note!==lane.note)continue;
   single.push({lane:lane.id,step:n.step,velocity:n.velocity,time:stepTime(n.step,project)+n.offset*span});
  }
 }
 single.sort((a,b)=>a.time-b.time||String(a.lane).localeCompare(String(b.lane)));
 const out=[];
 for(let pass=0;pass<loops;pass++)for(const target of single)out.push({...target,pass,time:target.time+pass*loopSeconds});
 return out;
}
export class Scorer{
 constructor(targets){this.targets=targets.map(t=>({...t,verdict:null,delta:0}));this.combo=0;this.best=0;this.score=0;this.strays=0;
  this.counts={perfect:0,great:0,okay:0,miss:0};this.last=null;this.end=(targets.at(-1)?.time??0)+MISS_WINDOW;}
 get max(){return this.targets.length*JUDGE[0].score;}
 get accuracy(){return this.max?clamp(this.score/this.max,0,1):0;}
 get rank(){return rankFor(this.accuracy);}
 get remaining(){return this.targets.filter(t=>!t.verdict).length;}
 // A hit resolves the nearest unjudged target in its lane; anything else is a stray.
 hit(lane,at){
  let found=null,delta=0;
  for(const t of this.targets){if(t.verdict||t.lane!==lane)continue;const d=at-t.time;if(Math.abs(d)>MISS_WINDOW)continue;if(!found||Math.abs(d)<Math.abs(delta)){found=t;delta=d;}}
  if(!found){this.strays++;this.combo=0;this.last={id:'stray',label:'—',lane,at};return this.last;}
  const judge=verdictFor(delta);
  found.verdict=judge.id;found.delta=delta;this.score+=judge.score;this.counts[judge.id]++;this.combo++;this.best=Math.max(this.best,this.combo);
  this.last={id:judge.id,label:judge.label,lane,at,delta};
  return this.last;
 }
 sweep(at){for(const t of this.targets)if(!t.verdict&&t.time<at-MISS_WINDOW){t.verdict='miss';this.counts.miss++;this.combo=0;}}
 done(at){return at>this.end;}
 get summary(){return {score:this.score,max:this.max,accuracy:this.accuracy,rank:this.rank,combo:this.best,strays:this.strays,...this.counts};}
}

// ── The falling-note canvas ──────────────────────────────────────────────────
export const LEAD=1.75;
export const laneLabel=(text,width)=>{const room=Math.max(3,Math.floor(width/7.4));return text.length>room?text.slice(0,room-1)+'…':text;};
export function drawChallenge(ctx,{width,height,lanes,targets,elapsed,flashes=new Map(),lead=LEAD,now=0,ground='#0d0f0c'}){
 ctx.clearRect(0,0,width,height);
 if(!lanes.length)return;
 const laneW=width/lanes.length,hitY=height-38;
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
 // The name band is painted last, so a note that has passed the line is hidden behind it.
 ctx.fillStyle=ground;ctx.fillRect(0,hitY+4,width,height-hitY-4);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='12px Inter,system-ui,sans-serif';
 lanes.forEach((lane,i)=>{
  const x=i*laneW,flash=flashes.get(lane.id)||0,glow=clamp((flash-now+0.22)/0.22,0,1);
  ctx.fillStyle=`rgba(213,247,130,${(0.06+glow*0.3).toFixed(3)})`;ctx.fillRect(x,hitY-10,laneW,14);
  ctx.fillStyle=lane.color||'#d5f782';ctx.globalAlpha=0.5+glow*0.5;ctx.fillRect(x+3,hitY,laneW-6,4);ctx.globalAlpha=1;
  ctx.fillStyle=glow>0.05?'#d5f782':'rgba(231,234,225,0.7)';
  ctx.fillText(laneLabel(lane.label||'',laneW-10),x+laneW/2,height-16);
 });
}
