import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,track,event,validateProject,History,locateStep,arrangementSteps,stepSeconds,stepTime,eventsAt,audibleTracks,melodic,INSTRUMENTS,MELODIC,PERCUSSION,PATTERNS,SCALE_IDS} from '../dist/model.js';
import {drumPCM,AudioGraph,Transport,renderAudio} from '../dist/audio.js';
import {encodeWav,crc32,zip,packProject,unpackProject} from '../dist/files.js';
import * as easy from '../dist/easy.js';
import * as play from '../dist/play.js';

const buffer=(channels,rate=48000)=>({numberOfChannels:channels.length,length:channels[0].length,sampleRate:rate,getChannelData:i=>Float32Array.from(channels[i])});

test('starter sessions contain valid musical data and survive the project schema round-trip',()=>{for(const style of ['midnight','house','trap','blank']){const p=createProject(style),v=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(v.title,p.title);assert.equal(v.bpm,p.bpm);assert.equal(v.tracks.length,8);assert.deepEqual(v.tracks,p.tracks);assert.equal(arrangementSteps(v),arrangementSteps(p));for(const pattern of PATTERNS)for(let s=0;s<v.patternLengths[pattern];s++)for(const hit of eventsAt(v,s,'pattern',pattern)){assert.ok(Number.isFinite(hit.duration)&&hit.duration>0);assert.ok(hit.offset>=0);}}});

test('song positions cross repeats and variable-length sections without losing steps',()=>{const p=createProject('blank');p.patternLengths.B=32;p.arrangement=[{pattern:'A',repeats:2},{pattern:'B',repeats:3}];assert.equal(arrangementSteps(p),128);assert.deepEqual(locateStep(p,31,'song'),{pattern:'A',step:15,clip:0});assert.deepEqual(locateStep(p,32,'song'),{pattern:'B',step:0,clip:1});assert.deepEqual(locateStep(p,127,'song'),{pattern:'B',step:31,clip:1});assert.equal(locateStep(p,128,'song'),null);});

test('swing preserves bar duration and all supported step times increase',()=>{for(const bpm of [40,92,142,240])for(const swing of [0,0.14,0.65]){const p={bpm,swing};assert.equal(stepTime(16,p),240/bpm);for(let i=0;i<2048;i++)assert.ok(stepTime(i+1,p)>stepTime(i,p));assert.equal(stepTime(1,p),stepSeconds(p)*(1+swing));}});

test('mute, solo, probability, microtiming, and ratchets agree for live and export event selection',()=>{const p=createProject('blank'),t=p.tracks[0],n=event(0);n.offset=.2;n.ratchet=4;n.length=2;t.patterns.A=[n];let hits=eventsAt(p,0);assert.equal(hits.length,4);assert.ok(Math.abs(hits[3].offset-.95*stepSeconds(p))<1e-12);assert.equal(hits[0].duration,stepSeconds(p)/2);n.chance=0;assert.equal(eventsAt(p,0).length,0);n.chance=1;t.mute=true;assert.equal(eventsAt(p,0).length,0);t.mute=false;p.tracks[1].solo=true;assert.equal(eventsAt(p,0).length,0);t.solo=true;assert.equal(eventsAt(p,0).length,4);assert.equal(eventsAt(p,0,'pattern','A',p.tracks[1].id).length,0);assert.deepEqual(eventsAt(p,0),eventsAt(p,0));assert.equal(audibleTracks(p).length,2);});

test('untrusted project input is bounded and identifiers cannot become markup',()=>{const p=createProject('blank');p.tracks[0].id='bad" onclick="alert(1)';p.tracks[0].patterns.A=[{...event(900,400,-4,-2),id:'bad><',ratchet:500,offset:-10}];p.bpm=Infinity;p.swing=Infinity;const clean=validateProject(p);assert.match(clean.tracks[0].id,/^[a-zA-Z0-9_-]+$/);const n=clean.tracks[0].patterns.A[0];assert.match(n.id,/^[a-zA-Z0-9_-]+$/);assert.equal(n.step,15);assert.equal(n.note,108);assert.equal(n.ratchet,4);assert.equal(n.offset,0);assert.equal(n.velocity,.01);assert.equal(n.length,.25);assert.equal(clean.bpm,92);assert.throws(()=>validateProject({...p,tracks:Array.from({length:17},()=>track('kick'))}));assert.throws(()=>validateProject({...p,arrangement:[]}));p.tracks[0].patterns.A=Array.from({length:513},()=>event(0));assert.throws(()=>validateProject(p));});

test('undo and redo preserve chords, mixer settings, and arrangement and clear alternate futures',()=>{const p=createProject(),h=new History(3);const before=JSON.stringify(p);h.push(p);p.tracks[6].patterns.A.splice(0,3);p.tracks[0].volume=-30;p.arrangement.reverse();const after=JSON.stringify(p);const undone=h.undo(p);assert.equal(JSON.stringify(undone),before);assert.equal(JSON.stringify(h.redo(undone)),after);h.push(p);assert.equal(h.future.length,0);});

test('every percussion voice produces finite, bounded, non-silent PCM with a quiet release',()=>{assert.equal(PERCUSSION.length,12);for(const kind of PERCUSSION)for(const rate of [44100,48000])for(const tune of [-24,0,24]){const pcm=drumPCM(kind,rate,tune);let peak=0,energy=0;for(const s of pcm){assert.ok(Number.isFinite(s));peak=Math.max(peak,Math.abs(s));energy+=s*s;}assert.ok(peak>.1&&peak<=1,kind);assert.ok(energy/pcm.length>.0001,kind);assert.ok(Math.abs(pcm.at(-1))<.001,kind);assert.equal(pcm[0],0);}});

test('stereo 24-bit WAV is correctly interleaved and preserves signed PCM',()=>{const r=encodeWav(buffer([[-1,0,1],[.5,-.5,0]]),{bits:24,dither:false}),v=new DataView(r.bytes.buffer);assert.equal(new TextDecoder().decode(r.bytes.slice(0,4)),'RIFF');assert.equal(v.getUint32(4,true),r.bytes.length-8);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint16(34,true),24);assert.equal(v.getUint32(40,true),18);function int24(at){let n=v.getUint8(at)|(v.getUint8(at+1)<<8)|(v.getUint8(at+2)<<16);if(n&0x800000)n-=0x1000000;return n;}assert.equal(int24(44),-8388608);assert.equal(int24(47),4194304);assert.equal(int24(50),0);assert.equal(int24(53),-4194304);assert.equal(int24(56),8388607);assert.equal(r.clipped,0);});

test('WAV exports report clipping, normalize to -1 dBFS, sanitize non-finite samples and handle silence',()=>{const b=buffer([[2,-2,NaN,Infinity],[0,0,0,0]],44100);assert.equal(encodeWav(b,{bits:16}).clipped,2);const r=encodeWav(b,{bits:16,normalize:true,dither:false});assert.equal(r.clipped,0);assert.equal(r.peak,2);const peak=new DataView(r.bytes.buffer).getInt16(44,true)/32767;assert.ok(Math.abs(20*Math.log10(peak)+1)<.002);const silent=encodeWav(buffer([[0,0],[0,0]]),{bits:24,normalize:true});assert.ok(silent.bytes.slice(44).every(n=>n===0));assert.throws(()=>encodeWav(buffer([[0]]),{bits:32}));});

test('ZIP stem archive uses correct CRC and directory offsets',async()=>{const data=new TextEncoder().encode('123456789');assert.equal(crc32(data),0xcbf43926);const blob=zip([{name:'01-Kick.wav',bytes:data},{name:'02-Snare.wav',bytes:new Uint8Array([1,2,3])}]);const raw=new Uint8Array(await blob.arrayBuffer()),v=new DataView(raw.buffer);assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint32(14,true),0xcbf43926);const end=raw.length-22;assert.equal(v.getUint32(end,true),0x06054b50);assert.equal(v.getUint16(end+10,true),2);const central=v.getUint32(end+16,true);assert.equal(v.getUint32(central,true),0x02014b50);assert.equal(v.getUint32(central+42,true),0);});

test('portable project embeds only referenced samples and rejects missing or corrupt audio',async()=>{const p=createProject('blank');p.tracks[0].instrument='sample';p.tracks[0].sampleId='sample-1';const blob=new Blob([new Uint8Array([1,2,3,4])],{type:'audio/wav'});const samples=new Map([['sample-1',{name:'sample.wav',blob}],['unused',{name:'unused.wav',blob}]]);const packed=await packProject(p,samples);assert.equal(JSON.parse(packed).assets.length,1);let received;const decoded=await unpackProject(packed,{decodeAudioData:async b=>{received=new Uint8Array(b);return {duration:1,length:48000,numberOfChannels:1};}});assert.deepEqual(received,new Uint8Array([1,2,3,4]));assert.equal(decoded.samples.get('sample-1').name,'sample.wav');assert.equal(decoded.project.tracks[0].sampleId,'sample-1');await assert.rejects(()=>packProject(p,new Map()),/missing/);const raw=JSON.parse(packed);raw.assets=[];await assert.rejects(()=>unpackProject(JSON.stringify(raw),{}),/missing/);await assert.rejects(()=>unpackProject('{',{}));});

// An audio API contract double validates graph wiring and scheduling without a browser.
// Signal tests above exercise real generated PCM; this is not an audible browser test.
class Param {constructor(){this.value=0;this.events=[];}setValueAtTime(v,t){assert.ok(Number.isFinite(v)&&Number.isFinite(t)&&t>=0);this.events.push([v,t]);this.value=v;}linearRampToValueAtTime(v,t){this.setValueAtTime(v,t);}exponentialRampToValueAtTime(v,t){assert.ok(v>0);this.setValueAtTime(v,t);}setTargetAtTime(v,t){this.setValueAtTime(v,t);}cancelScheduledValues(){}cancelAndHoldAtTime(){}}
class Node {constructor(ctx,kind){this.ctx=ctx;this.kind=kind;this.connections=[];for(const n of ['gain','frequency','Q','pan','delayTime','threshold','knee','ratio','attack','release','playbackRate'])this[n]=new Param();}connect(n){this.connections.push(n);return n;}disconnect(){this.connections=[];}start(time,offset,duration){assert.ok(Number.isFinite(time)&&time>=0);if(offset!==undefined)assert.ok(offset>=0);if(duration!==undefined)assert.ok(duration>0);this.ctx.starts.push({time,kind:this.kind,offset,duration,source:this});}stop(time){assert.ok(time>=0);this.end=time;}getFloatTimeDomainData(data){data.fill(0);}}
class Context {constructor(ch=2,len=48000,rate=48000){this.sampleRate=rate;this.currentTime=0;this.state='running';this.length=len;this.nodes=[];this.starts=[];this.destination=new Node(this,'destination');}node(kind){const n=new Node(this,kind);this.nodes.push(n);return n;}createGain(){return this.node('gain');}createOscillator(){return this.node('oscillator');}createBufferSource(){return this.node('buffer-source');}createBiquadFilter(){return this.node('filter');}createStereoPanner(){return this.node('pan');}createAnalyser(){return this.node('analyser');}createDynamicsCompressor(){return this.node('compressor');}createConvolver(){return this.node('convolver');}createDelay(){return this.node('delay');}createBuffer(ch,len,rate){const data=Array.from({length:ch},()=>new Float32Array(len));return {numberOfChannels:ch,length:len,sampleRate:rate,duration:len/rate,getChannelData:i=>data[i],copyToChannel:(a,i)=>data[i].set(a)};}async resume(){}async startRendering(){return this.createBuffer(2,this.length,this.sampleRate);}}

test('audio graph wires every channel, updates mute/solo and releases sources',()=>{const p=createProject(),ctx=new Context(),g=new AudioGraph(ctx,p);assert.equal(g.channels.size,8);assert.ok(g.master.connections.includes(g.compressor));assert.ok(g.compressor.connections.includes(g.analyser));for(const c of g.channels.values()){assert.ok(c.meter.connections.includes(g.master));assert.ok(c.verb.connections.includes(g.reverb));assert.ok(c.echo.connections.includes(g.delay));}p.tracks[0].solo=true;g.update(p);assert.equal(g.channels.get(p.tracks[1].id).gain.value,undefined);assert.equal(g.channels.get(p.tracks[1].id).gain.gain.value,0);for(const t of p.tracks){const n=event(0,60);g.trigger(t,n,.1,.25);}assert.ok(ctx.starts.length>=8);g.stop();assert.equal(g.voices.size,0);assert.ok(ctx.starts.every(s=>s.source.end>=0));g.dispose();});

test('sampler applies original-pitch playback, trim offsets and reversed trim mapping',()=>{const p=createProject('blank'),t=p.tracks[0];t.instrument='sample';t.sampleId='s';t.trimStart=.2;t.trimEnd=.8;const ctx=new Context(),sample=ctx.createBuffer(2,48000,48000),g=new AudioGraph(ctx,p,new Map([['s',{buffer:sample}]]));g.trigger(t,event(0,72),.1,.15);let source=ctx.starts.at(-1);assert.equal(source.offset,.2);assert.equal(source.source.playbackRate.value,2);assert.ok(source.duration<=.6);t.reverse=true;t.trimStart=.1;t.trimEnd=.6;g.trigger(t,event(0,60),.5,.15);source=ctx.starts.at(-1);assert.equal(source.offset,.4);assert.notEqual(source.source.buffer,sample);g.dispose();});

test('transport schedules beyond UI timer ticks, repeats on the grid, and does not burst after a stall',async()=>{const p=createProject('blank');p.tracks[0].patterns.A=[event(0),event(4),event(8),event(12)];const ctx=new Context();let steps=[];const t=new Transport(()=>p,()=>new Map(),e=>steps.push(e));t.ctx=ctx;await t.start();clearInterval(t.timer);t.timer=null;assert.ok(t.graph.voices.size>0);for(let i=0;i<110;i++){ctx.currentTime=i*.025;t.tick();t.consume();}assert.ok(t.cycle>=1);assert.ok(steps.some(e=>e.absolute===15));const starts=ctx.starts.filter(s=>s.kind==='buffer-source');for(let i=1;i<starts.length;i++)assert.ok(Math.abs((starts[i].time-starts[i-1].time)-60/p.bpm)<1e-8);ctx.currentTime=120;t.tick();assert.ok(t.next<128);t.stop();assert.equal(t.playing,false);assert.equal(t.queue.length,0);});

test('offline exporter requests correct duration and excludes metronome',async()=>{let ctx;const Original=globalThis.OfflineAudioContext;globalThis.OfflineAudioContext=class extends Context{constructor(...args){super(...args);ctx=this;}};try{const p=createProject('blank');p.tracks[0].patterns.A=[event(0)];const result=await renderAudio(p,new Map(),{mode:'pattern',sampleRate:44100,tail:2});assert.equal(result.length,Math.ceil((16*stepSeconds(p)+2)*44100));assert.equal(ctx.starts.length,1);assert.equal(ctx.starts[0].time,0);assert.equal(ctx.starts[0].kind,'buffer-source');}finally{globalThis.OfflineAudioContext=Original;}});

// ── Easy mode ────────────────────────────────────────────────────────────────
const SCALE_NAMES=['major','minor','dorian','phrygian','lydian','mixolydian'];

test('vibe drum templates are well formed and the scale table matches the project schema',()=>{
 assert.deepEqual(Object.keys(easy.SCALES).sort(),[...SCALE_IDS].sort());
 for(const id of SCALE_IDS)assert.equal(easy.SCALES[id].length,7,id);
 assert.equal(new Set(easy.VIBES.map(v=>v.id)).size,easy.VIBES.length);
 for(const vibe of easy.VIBES){
  assert.ok(vibe.bpm>=40&&vibe.bpm<=240,vibe.id);
  assert.ok(vibe.swing>=0&&vibe.swing<=.65,vibe.id);
  assert.deepEqual(Object.keys(vibe.drums),['kick','snare','hat','openhat','clap','perc','crash','ride','shaker'],vibe.id);
  for(const instrument of PERCUSSION)assert.ok(vibe.drums[easy.roleOf(instrument)],`${vibe.id} has no row for ${instrument}`);
  for(const [role,row] of Object.entries(vibe.drums)){
   assert.equal(row.length,16,`${vibe.id} ${role} must cover one 16-step bar`);
   assert.match(row,/^[xo+.-]{16}$/,`${vibe.id} ${role}`);
  }
  assert.ok(easy.parseRow(vibe.drums.kick).some(w=>w===1),`${vibe.id} needs a downbeat`);
 }
 for(const mood of easy.MOODS)assert.ok(SCALE_IDS.includes(mood.scale),mood.id);
 assert.equal(easy.ROOTS.length,12);
});

test('generated parts are always in key, inside the loop, and survive project validation',()=>{
 const project=createProject('blank');
 project.tracks=['kick','snare','hat','openhat','clap','bass','keys','lead'].map(track);
 for(const vibe of easy.VIBES)for(let seed=1;seed<=12;seed++){
  const root=(seed*5)%12,scale=SCALE_NAMES[seed%6],steps=[16,32,64][seed%3];
  const parts=easy.generateParts({vibe:vibe.id,root,scale,seed,steps,energy:(seed%5)/4});
  assert.ok(parts.progression.length>=2&&parts.progression.every(d=>Number.isInteger(d)&&d>=0&&d<=6),'chords must stay diatonic');
  for(const t of project.tracks){
   const role=easy.roleOf(t.instrument);
   t.patterns.A=(parts[role]||[]).map(n=>({...n}));
   for(const n of t.patterns.A){
    assert.ok(Number.isInteger(n.step)&&n.step>=0&&n.step<steps,`${vibe.id} ${role} step ${n.step}`);
    assert.ok(n.velocity>0&&n.velocity<=1,`${vibe.id} ${role} velocity`);
    assert.ok(n.length>0&&n.length<=steps,`${vibe.id} ${role} length`);
    assert.ok(n.offset>=0&&n.offset<=.49&&n.ratchet>=1&&n.ratchet<=4,`${vibe.id} ${role} feel`);
    if(['bass','chords','melody'].includes(role)){
     assert.ok(easy.SCALES[scale].includes(((n.note-root)%12+12)%12),`${vibe.id} ${role} played out of key`);
     assert.ok(n.note>=24&&n.note<=100,`${vibe.id} ${role} octave ${n.note}`);
    }
   }
  }
  project.patternLengths.A=steps;
  const clean=validateProject(JSON.parse(JSON.stringify(project)));
  // Nothing the generator writes may be clamped, dropped or renumbered by the schema.
  assert.deepEqual(clean.tracks.map(t=>t.patterns.A.map(n=>[n.step,n.note,n.velocity,n.length,n.offset,n.ratchet])),
   project.tracks.map(t=>t.patterns.A.map(n=>[n.step,n.note,n.velocity,n.length,n.offset,n.ratchet])),vibe.id);
 }
});

test('the same seed always writes the same music and different seeds do not',()=>{
 const options={vibe:'house',root:2,scale:'dorian',steps:32,energy:.7};
 const a=easy.generateParts({...options,seed:4242}),b=easy.generateParts({...options,seed:4242});
 assert.deepEqual(a.kick.map(n=>n.step),b.kick.map(n=>n.step));
 assert.deepEqual(a.melody.map(n=>[n.step,n.note]),b.melody.map(n=>[n.step,n.note]));
 let different=0;
 for(let seed=1;seed<=25;seed++){const other=easy.generateParts({...options,seed});
  if(JSON.stringify(other.kick.map(n=>n.step))!==JSON.stringify(a.kick.map(n=>n.step))||JSON.stringify(other.melody.map(n=>n.note))!==JSON.stringify(a.melody.map(n=>n.note)))different++;}
 assert.ok(different>=23,`rolling again should give something new (${different}/25)`);
 // Busier settings write more, quieter ones write less.
 const sparse=easy.generateParts({...options,seed:7,energy:.1}),dense=easy.generateParts({...options,seed:7,energy:1});
 assert.ok(dense.hat.length+dense.kick.length>sparse.hat.length+sparse.kick.length);
});

test('plain-language macros map onto real mixer values and read back where they were set',()=>{
 for(const key of Object.keys(easy.MACROS)){
  const t=track('keys');
  for(let value=0;value<=100;value+=5){
   easy.setMacro(t,key,value);
   assert.ok(Math.abs(easy.readMacro(t,key)-value)<=1,`${key} at ${value}`);
   for(const [prop,low,high] of [['volume',-60,6],['cutoff',40,20000],['high',-18,18],['reverb',0,.8],['delay',0,.8],['attack',.001,2],['decay',.02,3],['release',.01,3],['drive',0,1]])
    assert.ok(t[prop]>=low&&t[prop]<=high,`${key} pushed ${prop} out of range: ${t[prop]}`);
  }
  assert.equal(typeof easy.macroWord(key,50),'string');
 }
 const quiet=track('kick'),loud=track('kick');
 easy.setMacro(quiet,'loudness',10);easy.setMacro(loud,'loudness',90);
 assert.ok(loud.volume>quiet.volume);
 const dark=track('pad'),bright=track('pad');
 easy.setMacro(dark,'brightness',5);easy.setMacro(bright,'brightness',95);
 assert.ok(bright.cutoff>dark.cutoff*4);
 assert.equal(easy.groupMacro([quiet,loud],'loudness'),50);
});

test('changing key or mood moves existing notes without letting one fall out of the new key',()=>{
 for(const fromScale of SCALE_NAMES)for(const toScale of SCALE_NAMES)for(const fromRoot of [0,4,9])for(const toRoot of [1,7,11]){
  for(let note=24;note<=96;note++){
   const moved=easy.retuneNote(note,fromRoot,fromScale,toRoot,toScale);
   assert.ok(easy.SCALES[toScale].includes(((moved-toRoot)%12+12)%12),`${note} ${fromScale}->${toScale}`);
   assert.ok(Math.abs(moved-note)<=12,`${note} jumped to ${moved}`);
  }
 }
 // A minor triad keeps its shape when it becomes C major: root, third, fifth.
 assert.deepEqual([57,60,64].map(n=>easy.retuneNote(n,9,'minor',0,'major')),[48,52,55]);
 // A note already in the old key round-trips exactly; one that is not snaps into the key and stays there.
 for(let note=36;note<=84;note++)if(easy.SCALES.minor.includes(((note-9)%12+12)%12))
  assert.equal(easy.retuneNote(easy.retuneNote(note,9,'minor',2,'lydian'),2,'lydian',9,'minor'),note);
 const snapped=easy.retuneNote(37,9,'minor',9,'minor');
 assert.ok(easy.SCALES.minor.includes(((snapped-9)%12+12)%12));
});

test('easy-mode note grids only offer pitches that are in key, and song shapes stay inside the project limits',()=>{
 for(const scale of SCALE_NAMES)for(const root of [0,6,11])for(const group of ['bass','chords','melody']){
  const ladder=easy.scaleLadder(root,scale,group);
  assert.ok(ladder.length>=12&&ladder.length<=20,`${group} ${ladder.length} rows`);
  assert.deepEqual(ladder,[...ladder].sort((a,b)=>b-a),'the grid reads high note first');
  for(const pitch of ladder){
   assert.ok(easy.SCALES[scale].includes(((pitch-root)%12+12)%12),`${group} offered an out-of-key row`);
   assert.ok(pitch>=12&&pitch<=108);
  }
 }
 const project=createProject('blank');
 for(const shape of easy.SONG_SHAPES){
  assert.ok(shape.plan.length>=1&&shape.plan.length<=64,shape.id);
  for(const [letter,repeats] of shape.plan){
   assert.ok(PATTERNS.includes(letter)&&Number.isInteger(repeats)&&repeats>=1&&repeats<=8,shape.id);
   assert.equal(typeof easy.sectionName(letter),'string');
  }
  for(const steps of [16,32,64]){
   project.patternLengths=Object.fromEntries(PATTERNS.map(p=>[p,steps]));
   project.arrangement=shape.plan.map(([pattern,repeats])=>({id:'x',pattern,repeats}));
   assert.ok(arrangementSteps(project)<=2048,`${shape.id} at ${steps} steps exceeds 128 bars`);
   assert.doesNotThrow(()=>validateProject(JSON.parse(JSON.stringify(project))));
  }
 }
 assert.equal(typeof easy.coachTip(createProject(),{easyStep:0}),'string');
});

test('every instrument in the library has a synthesis path, a mixer start point and a part generator',()=>{
 const names=Object.keys(INSTRUMENTS);
 assert.equal(names.length,20);
 assert.deepEqual([...PERCUSSION,...MELODIC].sort(),[...names].sort());
 for(const instrument of names){
  assert.equal(melodic({instrument}),MELODIC.includes(instrument),instrument);
  assert.ok(easy.roleOf(instrument),instrument);
  const t=easy.applyVibeMix(track(instrument),easy.VIBES[0]);
  assert.equal(validateProject({...createProject('blank'),tracks:[t]}).tracks[0].instrument,instrument);
  assert.ok(t.volume>=-60&&t.volume<=6,instrument);
  if(instrument==='sample')continue;
  assert.ok(easy.GROUPS.some(g=>g.instruments.includes(instrument)),`${instrument} belongs to no easy-mode group`);
 }
});

test('the new melodic voices are oscillator based, layered and distinct from one another',()=>{
 const p=createProject('blank');
 p.tracks=['pluck','bell','organ','keys'].map((instrument,i)=>({...track(instrument,i),decay:.4,release:.2}));
 const ctx=new Context(),g=new AudioGraph(ctx,p);
 const shapes=new Map();
 for(const t of p.tracks){const before=ctx.starts.length;g.trigger(t,event(0,60),.1,.5);
  const made=ctx.starts.slice(before);
  assert.ok(made.length>=2,`${t.instrument} should layer oscillators`);
  assert.ok(made.every(m=>m.kind==='oscillator'),t.instrument);
  shapes.set(t.instrument,made.map(m=>m.source.frequency.value.toFixed(2)).join('/'));
 }
 assert.equal(new Set(shapes.values()).size,shapes.size,'each voice needs its own partials');
 g.dispose();
});

test('the drum kit covers every percussion voice exactly once and no two pieces overlap',()=>{
 assert.deepEqual(play.KIT.map(p=>p.instrument).sort(),[...PERCUSSION].sort());
 for(const piece of play.KIT){
  assert.ok(piece.x-piece.w/2>=0&&piece.x+piece.w/2<=play.STAGE_W,piece.instrument);
  assert.ok(piece.y-piece.h/2>=0&&piece.y+piece.h/2<=play.STAGE_H,piece.instrument);
  const r=play.box(piece);
  for(const key of ['left','top','width','height'])assert.ok(r[key]>=0&&r[key]<=100,`${piece.instrument} ${key}`);
 }
 for(const a of play.KIT)for(const b of play.KIT){
  if(a===b)continue;
  const apart=Math.abs(a.x-b.x)>=(a.w+b.w)/2||Math.abs(a.y-b.y)>=(a.h+b.h)/2;
  assert.ok(apart,`${a.instrument} overlaps ${b.instrument}`);
 }
 assert.equal(new Set(play.KIT.map(p=>p.key)).size,play.KIT.length,'every piece needs its own key');
 assert.deepEqual(Object.keys(play.KIT_KEYS).sort(),play.KIT.map(p=>p.key.toLowerCase()).sort());
 for(const [key,instrument] of Object.entries(play.KIT_KEYS))assert.equal(play.kitPiece(instrument).key,key.toUpperCase());
 const markup=play.kitMarkup(createProject().tracks);
 assert.equal([...markup.matchAll(/data-kit="/g)].length,5,'only the kit pieces that have a track are playable');
 assert.equal([...markup.matchAll(/data-kit-add="/g)].length,7,'the rest offer to add themselves');
 assert.equal([...markup.matchAll(/<kbd>/g)].length,5,'each playable piece prints its key');
 assert.equal([...markup.matchAll(/data-kit-remove=/g)].length,0,'removal is off unless asked for');
 assert.equal([...play.kitMarkup(createProject().tracks,{removable:true}).matchAll(/data-kit-remove=/g)].length,5);
 assert.ok(play.kitRig().includes('kit-rig')&&!/NaN|undefined/.test(play.kitRig()),'the drawn hardware has real coordinates');
 for(const kind of ['drum','cymbal','plate','bell'])assert.ok(/^<svg class="art"/.test(play.pieceArt(kind)),kind);
 assert.ok(!play.kitMarkup([{...track('kick'),name:'<img src=x>',id:'a"b'}]).includes('<img'));
});

test('the keyboard lays out two real octaves and marks the notes that are in key',()=>{
 const pitches=new Set(easy.SCALES.minor.map(s=>(s+9)%12));
 const keys=play.keyboardKeys(48,2,pitches);
 assert.equal(keys.length,24);
 const whites=keys.filter(k=>k.type==='white'),blacks=keys.filter(k=>k.type==='black');
 assert.equal(whites.length,14);assert.equal(blacks.length,10);
 assert.deepEqual(whites.map(k=>k.note),[48,50,52,53,55,57,59,60,62,64,65,67,69,71]);
 assert.deepEqual(blacks.map(k=>k.note),[49,51,54,56,58,61,63,66,68,70]);
 for(let i=1;i<whites.length;i++)assert.ok(whites[i].x>whites[i-1].x);
 assert.ok(Math.abs(whites.at(-1).x+whites.at(-1).w-100)<1e-9,'white keys fill the keyboard');
 for(const k of blacks)assert.ok(k.x>0&&k.x+k.w<100,'black keys sit inside the span');
 for(const k of keys)assert.equal(k.inKey,pitches.has(k.note%12),k.note);
 const guarded=play.keyboardMarkup(keys,{stayInKey:true});
 assert.equal([...guarded.matchAll(/aria-disabled="true"/g)].length,keys.filter(k=>!k.inKey).length);
 assert.ok(!play.keyboardMarkup(keys,{stayInKey:false}).includes('disabled'));
});

test('challenge targets follow the pattern, swing and every repeat of the loop',()=>{
 const p=createProject('blank');p.bpm=120;p.swing=.2;p.patternLengths.A=16;
 const drum=p.tracks[0],keysTrack=p.tracks[6];
 drum.patterns.A=[event(0),event(5),event(8)];drum.patterns.A[1].offset=.25;
 keysTrack.patterns.A=[event(2,60),event(4,64),event(6,60)];
 const lanes=play.lanesFor([drum],'A');
 assert.deepEqual(lanes.map(l=>l.id),[drum.id]);
 assert.deepEqual(play.lanesFor([p.tracks[5]],'A'),[],'a silent track is not a lane');
 const targets=play.buildTargets(p,'A',lanes,{loops:3});
 assert.equal(targets.length,9);
 const loop=16*stepSeconds(p);
 assert.equal(targets[0].time,stepTime(0,p));
 assert.equal(targets[1].time,stepTime(5,p)+.25*stepSeconds(p));
 assert.equal(targets[3].time,stepTime(0,p)+loop);
 assert.equal(targets.at(-1).time,stepTime(8,p)+2*loop);
 for(let i=1;i<targets.length;i++)assert.ok(targets[i].time>=targets[i-1].time);
 const pitch=play.pitchLanes(keysTrack,'A');
 assert.deepEqual(pitch.map(l=>l.note),[60,64]);
 const melody=play.buildTargets(p,'A',pitch,{loops:1});
 assert.deepEqual(melody.map(t=>t.lane),[`${keysTrack.id}:60`,`${keysTrack.id}:64`,`${keysTrack.id}:60`]);
});

test('timing windows, combos, misses and ranks are scored from the audio clock',()=>{
 const targets=[{lane:'a',time:1},{lane:'a',time:2},{lane:'b',time:2}];
 const s=new play.Scorer(targets);
 assert.equal(s.max,300);
 assert.equal(s.hit('a',1.01).id,'perfect');
 assert.equal(s.hit('b',2-play.JUDGE[1].window+1e-9).id,'great');
 assert.equal(s.combo,2);
 assert.equal(s.hit('a',9).id,'stray','a hit with no target in range breaks the run');
 assert.equal(s.combo,0);
 assert.equal(s.hit('a',2+play.MISS_WINDOW-1e-9).id,'okay');
 assert.equal(new play.Scorer([{lane:'a',time:1}]).hit('a',1+play.MISS_WINDOW+.01).id,'stray','outside the last window nothing can be claimed');
 assert.equal(s.remaining,0);
 assert.equal(s.score,205);
 assert.equal(s.summary.combo,2);
 assert.equal(s.summary.strays,1);
 assert.ok(Math.abs(s.accuracy-205/300)<1e-12);
 const missed=new play.Scorer(targets);
 missed.sweep(1+play.MISS_WINDOW+1e-6);
 assert.equal(missed.counts.miss,1);
 missed.sweep(50);
 assert.equal(missed.counts.miss,3);
 assert.equal(missed.accuracy,0);
 assert.equal(missed.rank,'D');
 assert.ok(missed.done(missed.end+.001)&&!missed.done(missed.end-.001));
 const perfect=new play.Scorer(targets);
 for(const t of targets)perfect.hit(t.lane,t.time);
 assert.equal(perfect.rank,'S');
 assert.deepEqual([.95,.86,.7,.5,0].map(play.rankFor),['S','A','B','C','D']);
 assert.equal(play.verdictFor(play.MISS_WINDOW+.001),null);
});

test('the falling-note canvas draws only finite geometry inside its frame',()=>{
 const calls=[];const record=name=>(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${name} got ${a}`);calls.push(name);};
 const ctx2d={clearRect:record('clearRect'),fillRect:record('fillRect'),rect:record('rect'),roundRect:record('roundRect'),beginPath:record('beginPath'),fill:record('fill'),fillText:record('fillText'),globalAlpha:1,fillStyle:'',font:'',textAlign:'',textBaseline:''};
 const lanes=[{id:'a',color:'#fff'},{id:'b',color:'#0f0'}];
 const targets=[{lane:'a',time:.6,velocity:.9,verdict:null},{lane:'b',time:1,velocity:.4,verdict:'miss'},{lane:'a',time:9,velocity:.5,verdict:null}];
 play.drawChallenge(ctx2d,{width:640,height:230,lanes,targets,elapsed:.5,now:1,flashes:new Map([['a',1]])});
 assert.ok(calls.includes('clearRect')&&calls.includes('roundRect'));
 assert.equal(calls.filter(c=>c==='fill').length,2,'only the notes inside the lead window are drawn');
 assert.equal(calls.filter(c=>c==='fillText').length,lanes.length,'each lane is named under its hit line');
 assert.equal(play.laneLabel('Closed hat',40),'Close…');
 assert.equal(play.laneLabel('Kick',200),'Kick');
 assert.doesNotThrow(()=>play.drawChallenge(ctx2d,{width:640,height:230,lanes:[],targets,elapsed:0}));
});

test('difficulty picks fewer parts, thins dense rows and widens the timing windows',()=>{
 assert.deepEqual(play.DIFFICULTY.map(d=>d.id),['easy','medium','hard']);
 assert.equal(play.difficultyById('nonsense').id,'easy','an unknown level falls back to the gentlest');
 for(let i=1;i<play.DIFFICULTY.length;i++){const a=play.DIFFICULTY[i-1],b=play.DIFFICULTY[i];
  assert.ok(b.lanes>a.lanes&&b.gap<a.gap&&b.tolerance<=a.tolerance,`${b.id} must be harder than ${a.id}`);}

 // A full kit: the challenge must drop the least important parts first, then show what is left
 // in the order the pieces sit on the stage.
 const p=createProject('blank');
 p.tracks=['shaker','kick','conga','snare','hat','cowbell','clap','ride'].map((instrument,i)=>{
  const t=track(instrument,i);t.name=instrument;t.patterns.A=[event(0),event(4),event(8),event(12)];return t;});
 assert.deepEqual(play.lanesFor(p.tracks,'A',{max:3}).map(l=>l.label),['snare','hat','kick']);
 assert.deepEqual(play.lanesFor(p.tracks,'A',{max:5}).map(l=>l.label),['clap','snare','hat','kick','ride']);
 assert.equal(play.lanesFor(p.tracks,'A',{max:7}).length,7);
 for(const lane of play.lanesFor(p.tracks,'A',{max:7}))assert.equal(lane.key,play.kitPiece(lane.label).key,lane.label);

 // Thinning keeps the first hit of a run so a sixteenth-note hat stays playable instead of vanishing.
 const hat=p.tracks.find(t=>t.instrument==='hat');
 hat.patterns.A=[0,2,4,6,8,10,12,14].map(step=>event(step));
 const lane=play.lanesFor([hat],'A');
 const steps=gap=>play.buildTargets(p,'A',lane,{loops:1,gap}).map(t=>t.step);
 assert.deepEqual(steps(0),[0,2,4,6,8,10,12,14]);
 assert.deepEqual(steps(2),[0,2,4,6,8,10,12,14]);
 assert.deepEqual(steps(4),[0,4,8,12]);
 assert.ok(steps(4).length&&steps(0).length>steps(4).length,'thinning never empties a lane that had notes');

 // Easy never asks for two keys at once: the more important part keeps the beat.
 const both=play.lanesFor(p.tracks,'A',{max:3});
 const together=play.buildTargets(p,'A',both,{loops:1,gap:4});
 assert.ok(together.length>new Set(together.map(t=>t.step)).size,'the parts do collide before solo is applied');
 const alone=play.buildTargets(p,'A',both,{loops:1,gap:4,solo:true});
 assert.equal(alone.length,new Set(alone.map(t=>t.step)).size,'solo leaves one target per step');
 assert.ok(alone.every(t=>t.lane===both.find(l=>l.label==='kick').id),'and it keeps the most important part');

 // A wider tolerance turns a hit that Hard would only call Okay into a Great.
 const targets=[{lane:'a',time:1}];
 assert.equal(new play.Scorer(targets).hit('a',1.12).id,'okay');
 assert.equal(new play.Scorer(targets,{tolerance:1.45}).hit('a',1.12).id,'great');
 assert.equal(new play.Scorer(targets).hit('a',1.2).id,'stray');
 assert.equal(new play.Scorer(targets,{tolerance:1.45}).hit('a',1.2).id,'okay');
 assert.ok(new play.Scorer(targets,{tolerance:1.45}).end>new play.Scorer(targets).end,'a gentler level waits longer before calling a miss');
});
