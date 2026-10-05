// ============================================================
// ЗВУК — эффекты
// ============================================================
function initAudio(){
  if(AC)return;
  try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return}
  const len=AC.sampleRate*.7,imp=AC.createBuffer(2,len,AC.sampleRate);
  for(let c=0;c<2;c++){const d=imp.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3)}
  reverb=AC.createConvolver();reverb.buffer=imp;
  const rg=AC.createGain();rg.gain.value=.35;
  reverb.connect(rg);rg.connect(AC.destination);
  const nl=AC.sampleRate*.3;noiseBuf=AC.createBuffer(1,nl,AC.sampleRate);
  const nd=noiseBuf.getChannelData(0);for(let i=0;i<nl;i++)nd[i]=(Math.random()*2-1)*Math.pow(1-i/nl,1.5);
}
function tone(type,f0,f1,peak,dur,t,stopAt){
  const o=AC.createOscillator(),g=AC.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t);
  if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+(stopAt||.2));
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.008);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(AC.destination);if(reverb)g.connect(reverb);
  o.start(t);o.stop(t+dur+.02);
}
function noiseHit(ft,freq,Q,peak,dur,t){
  const n=AC.createBufferSource();n.buffer=noiseBuf;
  const f=AC.createBiquadFilter();f.type=ft;f.frequency.value=freq;f.Q.value=Q;
  const g=AC.createGain();
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.004);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  n.connect(f);f.connect(g);g.connect(AC.destination);if(reverb)g.connect(reverb);
  n.start(t);n.stop(t+dur+.02);
}
function playBlaster(){
  if(!AC)return;const t=AC.currentTime,pv=.92+Math.random()*.16;
  tone('sine',160*pv,35,.55,.45,t,.35);
  tone('sawtooth',480*pv,70,.28,.28,t,.22);
  noiseHit('bandpass',3200*pv,1.8,.22,.14,t);
}
function playSplat(){
  if(!AC)return;const t=AC.currentTime;
  tone('sine',120,30,.5,.25,t,.2);
  noiseHit('bandpass',1200,1.2,.35,.18,t);
}
function playHurt(){if(!AC)return;tone('sawtooth',300,80,.4,.3,AC.currentTime,.25)}
function playWave(){
  if(!AC)return;const t=AC.currentTime;
  const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();
  o.type='sawtooth';o.frequency.setValueAtTime(80,t);o.frequency.exponentialRampToValueAtTime(800,t+.35);
  f.type='lowpass';f.frequency.setValueAtTime(400,t);f.frequency.exponentialRampToValueAtTime(4000,t+.35);f.Q.value=8;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.5,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.5);
  o.connect(f);f.connect(g);g.connect(AC.destination);g.connect(reverb);o.start(t);o.stop(t+.55);
  noiseHit('bandpass',600,.8,.4,.35,t);
}
