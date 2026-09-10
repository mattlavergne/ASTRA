import {dbGain,hz,stepSeconds,stepTime,eventsAt,arrangementSteps,locateStep} from './model.js';

// All note start times use the audio clock. The worker only fills the scheduling queue.
export function drumPCM(kind,rate=48000,tune=0){
 const duration={kick:0.85,snare:0.32,hat:0.11,openhat:0.65,clap:0.3,rim:0.12,tom:0.6}[kind]||0.3;
 const out=new Float32Array(Math.ceil(duration*rate));let seed=951,phase=0,prev=0,low=0;const pitch=2**(tune/12);
 for(let i=0;i<out.length;i++){const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)|0;const noise=(seed>>>0)/2147483648-1;low+=0.15*(noise-low);const high=noise-low;let v=0;
 if(kind==='kick'){phase+=2*Math.PI*(46+125*Math.exp(-t*38))*pitch/rate;v=Math.sin(phase)*Math.exp(-t*7.5)+noise*Math.exp(-t*190)*0.19;}
 if(kind==='snare')v=high*Math.exp(-t*18)*0.68+Math.sin(2*Math.PI*180*pitch*t)*Math.exp(-t*30)*0.32;
 if(kind==='hat'||kind==='openhat'){const metal=[4000,5270,6310].reduce((s,f)=>s+Math.sin(2*Math.PI*f*pitch*t),0)/3;v=(high*0.67+metal*0.22)*Math.exp(-t*(kind==='hat'?65:9));}
 if(kind==='clap'){const env=[0,0.012,0.026].reduce((s,x)=>s+(t>=x?Math.exp(-(t-x)*(x===0.026?22:170)):0),0);v=high*env*0.65;}
 if(kind==='rim')v=(Math.sin(2*Math.PI*820*pitch*t)+0.6*Math.sin(2*Math.PI*1780*pitch*t))*Math.exp(-t*65)*0.55;
 if(kind==='tom'){phase+=2*Math.PI*(110+90*Math.exp(-t*30))*pitch/rate;v=Math.sin(phase)*Math.exp(-t*9)*0.8;}
 const fade=Math.min(1,t/0.0007,(duration-t)/0.008);out[i]=Math.tanh(v*1.25)*fade;prev=noise;
 }return out;
}
function makeBuffer(ctx,data){const b=ctx.createBuffer(1,data.length,ctx.sampleRate);b.copyToChannel(data,0);return b;}
function impulse(ctx){const b=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*1.9),ctx.sampleRate);let seed=381;for(let ch=0;ch<2;ch++){const a=b.getChannelData(ch);for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;a[i]=((seed>>>0)/2147483648-1)*Math.pow(1-i/a.length,3)*0.5;}}return b;}
const smooth=(param,value,ctx)=>{param.cancelScheduledValues(ctx.currentTime);param.setTargetAtTime(value,ctx.currentTime,0.012);};
export class AudioGraph{
 constructor(ctx,project,samples=new Map(),only=null){this.ctx=ctx;this.project=project;this.samples=samples;this.voices=new Set();this.cache=new Map();this.channels=new Map();this.only=only;
 this.master=ctx.createGain();this.compressor=ctx.createDynamicsCompressor();this.compressor.threshold.value=-2;this.compressor.knee.value=0;this.compressor.ratio.value=20;this.compressor.attack.value=0.003;this.compressor.release.value=0.15;
 this.analyser=ctx.createAnalyser();this.analyser.fftSize=512;this.analyser.smoothingTimeConstant=0.7;this.master.connect(project.limiter?this.compressor:this.analyser);if(project.limiter)this.compressor.connect(this.analyser);this.analyser.connect(ctx.destination);
 this.reverb=ctx.createConvolver();this.reverb.buffer=impulse(ctx);this.reverb.connect(this.master);this.delay=ctx.createDelay(2);this.feedback=ctx.createGain();this.feedback.gain.value=0.32;this.delay.connect(this.feedback);this.feedback.connect(this.delay);this.delay.connect(this.master);
 project.tracks.forEach(t=>{const input=ctx.createGain(),low=ctx.createBiquadFilter(),mid=ctx.createBiquadFilter(),high=ctx.createBiquadFilter(),filter=ctx.createBiquadFilter(),pan=ctx.createStereoPanner(),gain=ctx.createGain(),verb=ctx.createGain(),echo=ctx.createGain(),meter=ctx.createAnalyser();low.type='lowshelf';low.frequency.value=180;mid.type='peaking';mid.frequency.value=1200;mid.Q.value=0.7;high.type='highshelf';high.frequency.value=5500;filter.type='lowpass';meter.fftSize=256;input.connect(low);low.connect(mid);mid.connect(high);high.connect(filter);filter.connect(pan);pan.connect(gain);gain.connect(meter);meter.connect(this.master);gain.connect(verb);verb.connect(this.reverb);gain.connect(echo);echo.connect(this.delay);this.channels.set(t.id,{input,low,mid,high,filter,pan,gain,verb,echo,meter});});this.update(project,true);
 }
 update(p,initial=false){this.project=p;const set=(a,v)=>initial?a.value=v:smooth(a,v,this.ctx);set(this.master.gain,dbGain(p.master));set(this.delay.delayTime,60/p.bpm*0.75);const solo=p.tracks.some(t=>t.solo);for(const t of p.tracks){const c=this.channels.get(t.id);if(!c)continue;set(c.gain.gain,t.mute||(solo&&!t.solo)||(this.only&&t.id!==this.only)?0:dbGain(t.volume));set(c.pan.pan,t.pan);set(c.low.gain,t.low);set(c.mid.gain,t.mid);set(c.high.gain,t.high);set(c.filter.frequency,Math.min(t.cutoff,this.ctx.sampleRate/2-100));set(c.filter.Q,t.resonance);set(c.verb.gain,t.reverb);set(c.echo.gain,t.delay);}}
 getSample(t){const s=this.samples.get(t.sampleId);if(!s)return null;if(!t.reverse)return s.buffer;const key='reverse:'+t.sampleId;if(!this.cache.has(key)){const b=this.ctx.createBuffer(s.buffer.numberOfChannels,s.buffer.length,s.buffer.sampleRate);for(let c=0;c<b.numberOfChannels;c++)b.copyToChannel(s.buffer.getChannelData(c).slice().reverse(),c);this.cache.set(key,b);}return this.cache.get(key);}
 trigger(t,n,time,duration){const ctx=this.ctx,c=this.channels.get(t.id);if(!c)return;time=Math.max(ctx.currentTime,time);const gain=ctx.createGain();gain.connect(c.input);const v=Math.max(0.001,n.velocity);let end=time+duration+t.release+0.02;const sources=[];const f=hz(n.note+t.tune);
 if(!['bass','keys','lead','pad','sample'].includes(t.instrument)){
 const key=t.instrument+':'+t.tune;let b=this.cache.get(key);if(!b){b=makeBuffer(ctx,drumPCM(t.instrument,ctx.sampleRate,t.tune));this.cache.set(key,b);}const s=ctx.createBufferSource();s.buffer=b;s.connect(gain);gain.gain.value=v;end=time+b.duration;s.start(time);sources.push(s);
 }else if(t.instrument==='sample'){
 const b=this.getSample(t);if(!b){gain.disconnect();return;}const s=ctx.createBufferSource();s.buffer=b;const rate=2**((n.note-60+t.tune)/12);s.playbackRate.value=rate;const start=(t.reverse?1-t.trimEnd:t.trimStart)*b.duration;const len=(t.trimEnd-t.trimStart)*b.duration;const span=Math.min(len/rate,duration+t.release);if(span<0.001){gain.disconnect();return;}end=time+span;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(v,time+Math.min(t.attack,span*0.2));gain.gain.setValueAtTime(v,Math.max(time+Math.min(t.attack,span*0.2),end-Math.min(t.release,span*0.3)));gain.gain.linearRampToValueAtTime(0,end);s.connect(gain);s.start(time,start,Math.min(len,span*rate));sources.push(s);
 }else{
 const attack=Math.min(t.attack,duration*0.5);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(v*0.48,time+attack);gain.gain.exponentialRampToValueAtTime(Math.max(0.001,v*(t.instrument==='keys'?0.1:0.3)),time+Math.max(attack+0.002,Math.min(duration,t.decay)));gain.gain.setValueAtTime(Math.max(0.001,v*(t.instrument==='keys'?0.1:0.3)),time+duration);gain.gain.exponentialRampToValueAtTime(0.0001,end);
 const layers=t.instrument==='keys'?[[1,'sine',0.7],[2,'sine',0.2],[3.01,'sine',0.12]]:t.instrument==='pad'?[[1,'sawtooth',0.4],[1.004,'sawtooth',0.4],[0.5,'sine',0.2]]:t.instrument==='bass'?[[1,'sine',0.85],[2,'triangle',0.18]]:[[1,'sawtooth',0.42],[1.003,'triangle',0.48]];
 for(const [ratio,type,level]of layers){const s=ctx.createOscillator(),g=ctx.createGain();s.type=type;s.frequency.value=f*ratio;g.gain.value=level;s.connect(g);g.connect(gain);s.start(time);s.stop(end);s.onended=()=>g.disconnect();sources.push(s);}
 }
 const voice={sources,gain,end,release:()=>{const now=Math.max(ctx.currentTime,time+0.002);const done=now+Math.max(0.015,t.release);if(gain.gain.cancelAndHoldAtTime)gain.gain.cancelAndHoldAtTime(now);else{gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(Math.max(0.001,gain.gain.value),now);}gain.gain.linearRampToValueAtTime(0,done);for(const source of sources){try{source.stop(done+0.01);}catch{}}}};this.voices.add(voice);const last=sources.at(-1),prev=last?.onended;if(last)last.onended=()=>{prev?.();gain.disconnect();this.voices.delete(voice);};return voice;
 }
 stop(){const now=this.ctx.currentTime;for(const v of this.voices){v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(0,now,0.004);for(const s of v.sources){try{s.stop(now+0.025);}catch{}}}this.voices.clear();}
 dispose(){this.stop();const cleanup=()=>{this.master.disconnect();this.compressor.disconnect();this.analyser.disconnect();this.reverb.disconnect();this.delay.disconnect();this.feedback.disconnect();for(const c of this.channels.values())Object.values(c).forEach(n=>n.disconnect());this.channels.clear();this.cache.clear();};if(typeof this.ctx.startRendering==='function'||this.ctx.state==='closed'){cleanup();return;}this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setTargetAtTime(0,this.ctx.currentTime,0.004);setTimeout(cleanup,40);}
}
export class Transport{
 constructor(getProject,getSamples,onStep,onStop){this.getProject=getProject;this.getSamples=getSamples;this.onStep=onStep;this.onStop=onStop;this.ctx=null;this.graph=null;this.playing=false;this.queue=[];this.mode='pattern';this.pattern='A';this.loop=true;this.metronome=false;this.worker=null;this.next=0;this.position=0;this.startAt=0;this.cycle=0;this.timer=null;}
 async init(){if(!this.ctx){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw new Error('This browser does not support Web Audio.');this.ctx=new C({latencyHint:'interactive'});this.ctx.onstatechange=()=>{if(this.ctx.state!=='running'&&this.playing){this.stop();this.onStop?.('Audio was interrupted. Press Play to resume.');}};}await this.ctx.resume();return this.ctx;}
 async start(){await this.init();this.stop(false);const p=this.getProject();this.graph=new AudioGraph(this.ctx,p,this.getSamples());this.next=0;this.position=0;this.cycle=0;this.queue=[];this.startAt=this.ctx.currentTime+0.075;this.playing=true;
 try{this.worker??=new Worker(new URL('./clock.js',import.meta.url));this.worker.onmessage=()=>this.tick();this.worker.postMessage('start');}catch{this.timer=setInterval(()=>this.tick(),25);}this.tick();}
 tick(){if(!this.playing)return;const p=this.getProject(),count=this.mode==='song'?arrangementSteps(p):p.patternLengths[this.pattern],step=stepSeconds(p);let loops=0;
 while(this.startAt+stepTime(this.next,p)<this.ctx.currentTime+0.14&&loops++<128){if(this.next>=count){if(!this.loop){this.endAt=this.startAt+count*step;break;}this.startAt+=count*step;this.next=0;this.cycle++;}
 const time=this.startAt+stepTime(this.next,p);if(time>=this.ctx.currentTime-0.025){const at=this.next;for(const e of eventsAt(p,at,this.mode,this.pattern))this.graph.trigger(e.track,e.event,time+e.offset,e.duration);if(this.metronome&&at%4===0)this.click(time,at%16===0);this.queue.push({time,absolute:at,...locateStep(p,at,this.mode,this.pattern)});}this.next++;}
 // A heavily throttled tab resumes on the grid instead of emitting a burst of late notes.
 if(loops>=128){this.startAt=this.ctx.currentTime+0.05;this.next=0;this.queue=[];}
 }
 consume(){if(!this.ctx)return;const output=this.ctx.currentTime-(this.ctx.outputLatency||0);while(this.queue.length&&this.queue[0].time<=output){const e=this.queue.shift();this.position=e.absolute;this.onStep?.(e);}if(this.endAt&&output>=this.endAt){this.stop();this.onStop?.();}}
 click(time,strong){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.value=strong?1400:1000;g.gain.setValueAtTime(0.07,time);g.gain.exponentialRampToValueAtTime(0.0001,time+0.035);o.connect(g);g.connect(this.ctx.destination);o.start(time);o.stop(time+0.04);o.onended=()=>g.disconnect();}
 stop(notify=true){this.playing=false;this.worker?.postMessage('stop');clearInterval(this.timer);this.timer=null;this.graph?.dispose();this.graph=null;this.queue=[];this.endAt=0;this.next=0;this.position=0;if(notify)this.onStop?.();}
 async preview(t,n,hold=false){await this.init();if(!this.graph)this.graph=new AudioGraph(this.ctx,this.getProject(),this.getSamples());return this.graph.trigger(t,n,this.ctx.currentTime+0.006,hold?30:n.length*stepSeconds(this.getProject()));}
 update(){if(this.graph)this.graph.update(this.getProject());}
}
export async function renderAudio(p,samples,{mode='song',pattern='A',sampleRate=48000,tail=2,only=null}={}){
 const count=mode==='song'?arrangementSteps(p):p.patternLengths[pattern];const duration=count*stepSeconds(p)+tail;if(duration>360)throw new Error('Export is limited to six minutes. Shorten the arrangement.');const C=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;if(!C)throw new Error('Offline rendering is unavailable in this browser.');const ctx=new C(2,Math.ceil(duration*sampleRate),sampleRate);const graph=new AudioGraph(ctx,p,samples,only);
 for(let i=0;i<count;i++)for(const e of eventsAt(p,i,mode,pattern,only))graph.trigger(e.track,e.event,stepTime(i,p)+e.offset,e.duration);
 const rendered=await ctx.startRendering();graph.dispose();return rendered;
}
