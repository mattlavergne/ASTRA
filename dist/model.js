export const VERSION = 2;
export const COLORS = ['#e9a76e','#e6cd7b','#b9d985','#77c6b4','#78b8d7','#a5a0ed','#d499ce','#df8e94','#a5bec6','#cec098','#95baa0','#9faacc'];
export const INSTRUMENTS = {kick:'Analog kick',snare:'Snare',hat:'Closed hat',openhat:'Open hat',clap:'Clap',rim:'Rimshot',tom:'Tom',conga:'Conga',shaker:'Shaker',cowbell:'Cowbell',ride:'Ride cymbal',crash:'Crash cymbal',bass:'Sub bass',keys:'Electric keys',lead:'Analog lead',pad:'Soft pad',pluck:'Pluck',bell:'Bell',organ:'Organ',sample:'Sampler'};
export const PERCUSSION = ['kick','snare','hat','openhat','clap','rim','tom','conga','shaker','cowbell','ride','crash'];
export const PATTERNS = 'ABCDEFGH'.split('');
export const SCALE_IDS=['major','minor','dorian','phrygian','lydian','mixolydian'];
export const NOTE_NAMES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
export const uid = ()=>globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
export const MELODIC = ['bass','keys','lead','pad','pluck','bell','organ','sample'];
export const melodic = t=>MELODIC.includes(t.instrument);
export const midiName = n=>NOTE_NAMES[n%12]+(Math.floor(n/12)-1);
export const hz = n=>440*2**((n-69)/12);
export const dbGain = d=>d<=-60?0:10**(d/20);
export function track(instrument,index=0){return {id:uid(),name:INSTRUMENTS[instrument],instrument,color:COLORS[index%COLORS.length],volume:-9,pan:0,mute:false,solo:false,low:0,mid:0,high:0,cutoff:18000,resonance:0.7,reverb:0.08,delay:0,attack:0.005,decay:0.35,release:0.15,tune:0,drive:0,sampleId:null,trimStart:0,trimEnd:1,reverse:false,patterns:Object.fromEntries(PATTERNS.map(p=>[p,[]]))};}
export function event(step,note=60,velocity=0.8,length=1){return {id:uid(),step,note,velocity,length,chance:1,offset:0,ratchet:1};}
export function createProject(style='midnight'){
 const p={version:VERSION,title:style==='blank'?'Untitled session':({midnight:'After hours',house:'Concrete rhythm',trap:'Low frequency'}[style]||'After hours'),bpm:style==='house'?124:style==='trap'?142:92,swing:style==='midnight'?0.14:0,master:-3,limiter:true,seed:2718,root:9,scale:'minor',vibe:({midnight:'lofi',house:'house',trap:'trap'}[style]||'lofi'),patternLengths:Object.fromEntries(PATTERNS.map(x=>[x,16])),tracks:['kick','snare','hat','openhat','clap','bass','keys','lead'].map(track),arrangement:['A','A','B','A','C','C','B','D'].map(pattern=>({id:uid(),pattern,repeats:2}))};
 p.tracks.forEach((t,i)=>{t.name=['Deep kick','Dust snare','Closed hat','Open hat','Clap / perc','Round bass','Velvet keys','Glass lead'][i];t.volume=[-6,-12,-18,-21,-20,-11,-16,-20][i];t.pan=[0,0,-0.16,0.22,0.1,0,-0.15,0.2][i];t.reverb=[0,0.13,0.05,0.12,0.16,0,0.32,0.28][i];t.delay=i===7?0.23:0;t.cutoff=i===5?1400:i===6?4200:18000;});
 if(style==='blank'){p.arrangement=[{id:uid(),pattern:'A',repeats:1}];return p;}
 for(const pat of PATTERNS){const k=PATTERNS.indexOf(pat); const rows=style==='house'?[[0,4,8,12],[4,12],[0,2,4,6,8,10,12,14],[2,6,10,14],[4,12]]:style==='trap'?[[0,6,9,14],[8],[0,2,4,6,8,10,12,14,15],[7,15],[8]]:[[0,6,8,11],[4,12],[0,2,4,6,8,10,12,14],[10],[12]];
 rows.forEach((steps,i)=>{p.tracks[i].patterns[pat]=steps.map((s,j)=>event(s,60,i===2?(j%2?0.48:0.7):0.82));});
 if(k%2){p.tracks[0].patterns[pat].push(event(15,60,0.58));p.tracks[1].patterns[pat].push(event(14,60,0.35));}
 if(style==='trap')p.tracks[2].patterns[pat].filter(n=>n.step>=12).forEach(n=>n.ratchet=2);
 const root=[33,33,29,36,33,29,36,31][k];
 p.tracks[5].patterns[pat]=[event(0,root,0.86,3),event(6,root,0.67,2),event(8,root+7,0.78,3),event(14,root+12,0.65,1)];
 p.tracks[6].patterns[pat]=[0,10].flatMap(s=>[0,3,7,10].map((n,i)=>event(s,root+24+n,0.5+i*0.03,s===0?7:5)));
 p.tracks[7].patterns[pat]=[event(3,root+48,0.52,1),event(7,root+46,0.45,2),event(14,root+43,0.6,1)];
 if(pat==='C')p.tracks.slice(0,5).forEach((t,i)=>{if(i!==2)t.patterns[pat]=[];});
 if(pat==='D'){p.tracks[1].patterns[pat].push(event(15,60,0.5));p.tracks[7].patterns[pat]=[];}
 }return p;
}
export function arrangementSteps(p){return p.arrangement.reduce((s,c)=>s+p.patternLengths[c.pattern]*c.repeats,0);}
export function locateStep(p,step,mode='pattern',pattern='A'){
 if(mode==='pattern')return {pattern,step:step%p.patternLengths[pattern],clip:-1};
 let cursor=0;for(let i=0;i<p.arrangement.length;i++){const c=p.arrangement[i],size=p.patternLengths[c.pattern]*c.repeats;if(step<cursor+size)return {pattern:c.pattern,step:(step-cursor)%p.patternLengths[c.pattern],clip:i};cursor+=size;}return null;
}
export const stepSeconds=p=>60/p.bpm/4;
export const stepTime=(step,p)=>stepSeconds(p)*(step+(step%2?p.swing:0));
export function audibleTracks(p,only=null){const solo=p.tracks.some(t=>t.solo);return p.tracks.filter(t=>!t.mute&&(!solo||t.solo)&&(!only||t.id===only));}
export function chancePass(seed,step,trackIndex,noteIndex,chance){let h=(seed+Math.imul(step+1,374761393)+Math.imul(trackIndex+1,668265263)+Math.imul(noteIndex+1,1274126177))|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296<chance;}
export function eventsAt(p,absolute,mode='pattern',pattern='A',only=null){const loc=locateStep(p,absolute,mode,pattern);if(!loc)return[];const allowed=new Set(audibleTracks(p,only).map(t=>t.id));return p.tracks.flatMap((t,ti)=>allowed.has(t.id)?t.patterns[loc.pattern].flatMap((n,ni)=>n.step===loc.step&&chancePass(p.seed,absolute,ti,ni,n.chance)?Array.from({length:n.ratchet},(_,r)=>({track:t,event:n,offset:(n.offset+r/n.ratchet)*stepSeconds(p),duration:n.length*stepSeconds(p)/n.ratchet})):[]):[]);}
const num=(v,a,b,f)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,a,b):f;
export function validateProject(raw){
 if(!raw||raw.version!==VERSION||!Array.isArray(raw.tracks)||raw.tracks.length<1||raw.tracks.length>16)throw new Error('This is not a supported ASTRA Studio project.');
 const p=createProject('blank');p.title=String(raw.title||'Untitled session').slice(0,80);p.bpm=num(raw.bpm,40,240,92);p.swing=num(raw.swing,0,0.65,0);p.master=num(raw.master,-60,6,-3);p.limiter=raw.limiter!==false;p.seed=num(raw.seed,0,2147483647,2718)|0;p.root=Math.round(num(raw.root,0,11,9));p.scale=SCALE_IDS.includes(raw.scale)?raw.scale:'minor';p.vibe=typeof raw.vibe==='string'&&/^[a-z0-9-]{1,24}$/.test(raw.vibe)?raw.vibe:'lofi';
 PATTERNS.forEach(k=>p.patternLengths[k]=[16,32,64].includes(raw.patternLengths?.[k])?raw.patternLengths[k]:16);
 const ids=new Set();p.tracks=raw.tracks.map((r,i)=>{if(!r||!Object.hasOwn(INSTRUMENTS,r.instrument))throw new Error('Project contains an unsupported instrument.');const t=track(r.instrument,i);t.id=typeof r.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(r.id)?r.id:uid();if(ids.has(t.id))throw new Error('Duplicate track identifier.');ids.add(t.id);t.name=String(r.name||INSTRUMENTS[t.instrument]).slice(0,40);t.color=/^#[0-9a-f]{6}$/i.test(r.color)?r.color:t.color;
 for(const [k,a,b] of [['volume',-60,6],['pan',-1,1],['low',-18,18],['mid',-18,18],['high',-18,18],['cutoff',40,20000],['resonance',0.1,12],['reverb',0,0.8],['delay',0,0.8],['attack',0.001,2],['decay',0.02,3],['release',0.01,3],['tune',-24,24],['drive',0,1],['trimStart',0,0.999],['trimEnd',0.001,1]])t[k]=num(r[k],a,b,t[k]);
 if(t.trimEnd<=t.trimStart){t.trimStart=0;t.trimEnd=1;}for(const k of ['mute','solo','reverse'])t[k]=r[k]===true;t.sampleId=typeof r.sampleId==='string'?r.sampleId.slice(0,80):null;
 for(const pat of PATTERNS){if(!Array.isArray(r.patterns?.[pat]))continue;if(r.patterns[pat].length>512)throw new Error('A pattern exceeds the 512-note limit per track.');const noteIds=new Set();t.patterns[pat]=r.patterns[pat].map(e=>{if(!e||!Number.isFinite(e.step))throw new Error('Invalid note data.');const n=event(Math.floor(num(e.step,0,p.patternLengths[pat]-1,0)));n.id=typeof e.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(e.id)?e.id:uid();if(noteIds.has(n.id))n.id=uid();noteIds.add(n.id);n.note=Math.round(num(e.note,12,108,60));n.velocity=num(e.velocity,0.01,1,0.8);n.length=num(e.length,0.25,p.patternLengths[pat],1);n.chance=num(e.chance,0,1,1);n.offset=num(e.offset,0,0.49,0);n.ratchet=Math.round(num(e.ratchet,1,4,1));return n;});}return t;});
 if(!Array.isArray(raw.arrangement)||!raw.arrangement.length||raw.arrangement.length>64)throw new Error('Arrangement must contain 1–64 sections.');p.arrangement=raw.arrangement.map(c=>{if(!c||!PATTERNS.includes(c.pattern))throw new Error('Invalid arrangement pattern.');return {id:uid(),pattern:c.pattern,repeats:Math.round(num(c.repeats,1,8,1))};});if(arrangementSteps(p)>2048)throw new Error('The song exceeds 128 bars.');return p;
}
export class History{constructor(limit=60){this.limit=limit;this.past=[];this.future=[];}push(p){this.past.push(JSON.stringify(p));if(this.past.length>this.limit)this.past.shift();this.future=[];}undo(p){if(!this.past.length)return null;this.future.push(JSON.stringify(p));return JSON.parse(this.past.pop());}redo(p){if(!this.future.length)return null;this.past.push(JSON.stringify(p));return JSON.parse(this.future.pop());}clear(){this.past=[];this.future=[];}}
