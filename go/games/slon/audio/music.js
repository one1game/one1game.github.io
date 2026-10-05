// ============================================================
// МУЗЫКА — чистая, с частотным разделением
// ============================================================
const M={
  playing:false,next:0,step:0,bpm:120,tBpm:120,en:0,tEn:0,
  master:null,bassG:null,leadG:null,drumG:null,padG:null,
  kick:[1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
  snr:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
  hat:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,1],
  bass:[0,-1,-1,7, -1,-1,5,-1, 0,-1,-1,3, -1,5,-1,-1],
  arp:[12,-1,-1,19, -1,15,-1,-1, 17,-1,-1,22, -1,19,-1,-1]
};
const midi=n=>440*Math.pow(2,(n-69)/12);

function initMusic(){
  if(!AC||M.playing)return;
  M.playing=true;M.next=AC.currentTime+.1;M.step=0;

  M.master=AC.createGain();M.master.gain.value=.5;

  // Компрессор на мастере
  const comp=AC.createDynamicsCompressor();
  comp.threshold.value=-18;comp.knee.value=12;comp.ratio.value=4;
  comp.attack.value=.003;comp.release.value=.25;
  M.master.connect(comp);comp.connect(AC.destination);

  M.bassG=AC.createGain();M.bassG.gain.value=.65;M.bassG.connect(M.master);

  M.leadG=AC.createGain();M.leadG.gain.value=.18;M.leadG.connect(M.master);
  const leadRev=AC.createGain();leadRev.gain.value=.4;
  M.leadG.connect(leadRev);leadRev.connect(reverb);

  M.drumG=AC.createGain();M.drumG.gain.value=.55;M.drumG.connect(M.master);

  M.padG=AC.createGain();M.padG.gain.value=.08;M.padG.connect(M.master);
  M.padG.connect(reverb);

  scheduleMusic();
}

function playKick(t){
  const o=AC.createOscillator(),g=AC.createGain();
  o.type='sine';o.frequency.setValueAtTime(150,t);
  o.frequency.exponentialRampToValueAtTime(45,t+.08);
  g.gain.setValueAtTime(.95,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);
  o.connect(g);g.connect(M.drumG);o.start(t);o.stop(t+.18);
}
function playSnare(t){
  const s=AC.createBufferSource();s.buffer=noiseBuf;
  const f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=1500;
  const g=AC.createGain();
  g.gain.setValueAtTime(.35,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);
  s.connect(f);f.connect(g);g.connect(M.drumG);s.start(t);s.stop(t+.14);
  const o=AC.createOscillator(),og=AC.createGain();
  o.type='triangle';o.frequency.setValueAtTime(190,t);
  o.frequency.exponentialRampToValueAtTime(90,t+.08);
  og.gain.setValueAtTime(.2,t);og.gain.exponentialRampToValueAtTime(.001,t+.08);
  o.connect(og);og.connect(M.drumG);o.start(t);o.stop(t+.09);
}
function playHat(t,open){
  const s=AC.createBufferSource();s.buffer=noiseBuf;
  const f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=9000;
  const g=AC.createGain();
  const d=open?.1:.03;
  g.gain.setValueAtTime(open?.12:.08,t);
  g.gain.exponentialRampToValueAtTime(.001,t+d);
  s.connect(f);f.connect(g);g.connect(M.drumG);
  s.start(t);s.stop(t+d+.02);
}
function playBass(t,mn,d){
  const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();
  o.type='sawtooth';o.frequency.value=midi(mn-12);
  f.type='lowpass';
  f.frequency.setValueAtTime(180,t);
  f.frequency.exponentialRampToValueAtTime(600,t+.05);
  f.frequency.exponentialRampToValueAtTime(180,t+d);
  f.Q.value=4;
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.35,t+.01);
  g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(f);f.connect(g);g.connect(M.bassG);
  o.start(t);o.stop(t+d+.02);
}
function playLead(t,mn,d){
  const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();
  o.type='triangle';o.frequency.value=midi(mn);
  f.type='bandpass';f.frequency.value=midi(mn)*1.2;f.Q.value=2;
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.1,t+.01);
  g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(f);f.connect(g);g.connect(M.leadG);
  o.start(t);o.stop(t+d+.02);
}
function playPad(t,mn,d){
  const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();
  o.type='sine';o.frequency.value=midi(mn);
  f.type='lowpass';f.frequency.value=1200;
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.06,t+.5);
  g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(f);f.connect(g);g.connect(M.padG);
  o.start(t);o.stop(t+d+.02);
}

function scheduleMusic(){
  if(!M.playing)return;
  if(paused){setTimeout(scheduleMusic,500);return}
  while(M.next<AC.currentTime+.15){
    stepMusic(M.step,M.next);
    M.next+=60/M.bpm/4;
    M.step=(M.step+1)%16;
  }
  setTimeout(scheduleMusic,60);
}
function stepMusic(s,t){
  M.bpm+=(M.tBpm-M.bpm)*.05;
  M.en+=(M.tEn-M.en)*.05;
  const e=M.en;

  if(M.kick[s])playKick(t);
  if(M.snr[s]&&e>.25)playSnare(t);
  if(M.hat[s])playHat(t,s%8===7);

  const bassNote=M.bass[s];
  if(bassNote>=0)playBass(t,36+bassNote,.22);

  const leadNote=M.arp[s];
  if(leadNote>=0&&e>.45)playLead(t,48+leadNote,.18);

  if(s%4===0&&e<.4)playPad(t,48+M.bass[s%8],1.8);

  if(M.bassG)M.bassG.gain.setTargetAtTime(.55+e*.25,t,.1);
  if(M.leadG)M.leadG.gain.setTargetAtTime(.08+e*.2,t,.1);
  if(M.drumG)M.drumG.gain.setTargetAtTime(.4+e*.3,t,.1);
  if(M.padG)M.padG.gain.setTargetAtTime(.12*(1-e*.8),t,.2);
}
function updateMusic(){
  if(!M.playing)return;
  let tb=110,te=.2;
  if(P.moving){tb=135;te=.55}
  if(P.recoil>.5){tb=155;te=.9}
  if(input.firing){tb=150;te=.85}
  if(enemies.some(e=>e.alert)){tb=160;te=1}
  M.tBpm=tb;M.tEn=te;
}
