// ============================================================
// РАСТЕНИЯ
// ============================================================
const OBJ_CHUNK=400,destroyed=new Set();
function getObjData(cx,cy,i){
  const key=`${cx},${cy},${i}`;
  if(destroyed.has(key))return null;
  const s=i*137+cx*7919+cy*104729;
  return{key,x:cx*OBJ_CHUNK+hash(cx,cy,s+1)*OBJ_CHUNK,y:cy*OBJ_CHUNK+hash(cx,cy,s+2)*OBJ_CHUNK,
    type:Math.floor(hash(cx,cy,s+3)*4),size:.7+hash(cx,cy,s+4)*.7,
    angle:hash(cx,cy,s+5)*Math.PI*2,phase:hash(cx,cy,s+1)*10,hp:1};
}
function getObjsIn(minX,minY,maxX,maxY){
  const ox1=Math.floor(minX/OBJ_CHUNK)-1,ox2=Math.floor(maxX/OBJ_CHUNK)+1;
  const oy1=Math.floor(minY/OBJ_CHUNK)-1,oy2=Math.floor(maxY/OBJ_CHUNK)+1;
  const list=[];
  for(let ox=ox1;ox<=ox2;ox++)for(let oy=oy1;oy<=oy2;oy++){
    const n=1+Math.floor(hash(ox,oy,999)*2);
    for(let i=0;i<n;i++){const d=getObjData(ox,oy,i);if(d)list.push(d)}
  }
  return list;
}
const objState=new Map();
function getState(k){let s=objState.get(k);if(!s){s={flash:0,kbx:0,kby:0};objState.set(k,s)}return s}

function drawMutant(o,sx,sy){
  const st=getState(o.key),size=o.size;
  const pulse=Math.sin(P.breath*1.5+o.phase)*.12+1;
  ctx.save();
  ctx.translate(sx+st.kbx,sy+st.kby);
  ctx.rotate(o.angle);ctx.scale(size*pulse,size);
  ctx.save();ctx.scale(1,.4);
  const shg=cachedGrad('mSh',()=>{const g=ctx.createRadialGradient(0,10,0,0,10,28);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');return g});
  ctx.beginPath();ctx.arc(0,10,28,0,7);ctx.fillStyle=shg;ctx.fill();ctx.restore();
  const glow=cachedGrad('mGlow',()=>{const g=ctx.createRadialGradient(0,0,0,0,0,40);g.addColorStop(0,'rgba(120,255,80,.15)');g.addColorStop(1,'rgba(120,255,80,0)');return g});
  ctx.beginPath();ctx.arc(0,0,40,0,7);ctx.fillStyle=glow;ctx.fill();
  drawMutantBody(o);
  if(st.flash>0){
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=st.flash;
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,26,0,7);ctx.fill();
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  ctx.restore();
}
function drawMutantBody(o){
  const P_=P.breath;
  if(o.type===0){
    const n=5+Math.floor(hash(1,1,o.phase*10)*4);
    ctx.fillStyle='#4a8b2c';ctx.beginPath();
    for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2;
      ctx.lineTo(Math.cos(a)*14,Math.sin(a)*14);
      ctx.lineTo(Math.cos(a+.15)*22,Math.sin(a+.15)*22);
    }
    ctx.closePath();ctx.fill();ctx.strokeStyle='#8ed860';ctx.lineWidth=1.5;ctx.stroke();
    const cg=cachedGrad('mT0c',()=>{const g=ctx.createRadialGradient(0,0,0,0,0,12);g.addColorStop(0,'#d0ff80');g.addColorStop(.6,'#6ba832');g.addColorStop(1,'#2a5010');return g});
    ctx.beginPath();ctx.arc(0,0,12,0,7);ctx.fillStyle=cg;ctx.fill();
    ctx.fillStyle='#ff3030';ctx.beginPath();ctx.arc(-4,-3,2,0,7);ctx.arc(4,-3,2,0,7);ctx.fill();
  }else if(o.type===1){
    const n=4+Math.floor(hash(2,2,o.phase*10)*3);
    for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2+Math.sin(P_*2+o.phase+i)*.1;
      const len=18+Math.sin(P_*3+o.phase+i)*4;
      ctx.beginPath();ctx.moveTo(0,0);
      ctx.quadraticCurveTo(Math.cos(a)*len*.5,Math.sin(a)*len*.5,Math.cos(a)*len,Math.sin(a)*len);
      ctx.strokeStyle='#5cae3a';ctx.lineWidth=6;ctx.lineCap='round';ctx.stroke();
      ctx.strokeStyle='#a8e870';ctx.lineWidth=2.5;ctx.stroke();
      ctx.beginPath();ctx.arc(Math.cos(a)*len,Math.sin(a)*len,3.5,0,7);ctx.fillStyle='#d0ff80';ctx.fill();
    }
    const bg=cachedGrad('mT1b',()=>{const g=ctx.createRadialGradient(-3,-3,0,0,0,14);g.addColorStop(0,'#a0e050');g.addColorStop(.6,'#4a8b2c');g.addColorStop(1,'#1e3a10');return g});
    ctx.beginPath();ctx.arc(0,0,14,0,7);ctx.fillStyle=bg;ctx.fill();
    ctx.strokeStyle='#c8ffa0';ctx.lineWidth=1.2;ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,7,0,7);ctx.fillStyle='#0a0a0a';ctx.fill();
    ctx.beginPath();ctx.arc(0,0,4,0,7);ctx.fillStyle='#ff8020';ctx.fill();
    ctx.beginPath();ctx.arc(-1.5,-1.5,1.5,0,7);ctx.fillStyle='#fff';ctx.fill();
  }else if(o.type===2){
    ctx.beginPath();ctx.ellipse(0,8,6,14,0,0,7);ctx.fillStyle='#7a5a3a';ctx.fill();
    ctx.strokeStyle='#a88a60';ctx.lineWidth=1;ctx.stroke();
    const cg=cachedGrad('mT2c',()=>{const g=ctx.createRadialGradient(-4,-8,0,0,-8,20);g.addColorStop(0,'#c850ff');g.addColorStop(.6,'#8010c0');g.addColorStop(1,'#3a0050');return g});
    ctx.beginPath();ctx.ellipse(0,-8,20,12,0,0,Math.PI,0);ctx.fillStyle=cg;ctx.fill();ctx.closePath();
    ctx.strokeStyle='#e0a0ff';ctx.lineWidth=1.2;ctx.stroke();
    ctx.fillStyle='#e0a0ff';
    ctx.beginPath();ctx.arc(-6,-12,3,0,7);ctx.fill();
    ctx.beginPath();ctx.arc(4,-10,2.5,0,7);ctx.fill();
    ctx.beginPath();ctx.arc(-1,-6,2,0,7);ctx.fill();
    for(let i=0;i<4;i++){
      const sa=P_*2+i*1.5+o.phase,sr=18+Math.sin(sa)*4;
      ctx.beginPath();ctx.arc(Math.cos(sa)*sr,Math.sin(sa)*sr-15,2,0,7);
      ctx.fillStyle='rgba(220,150,255,.6)';ctx.fill();
    }
  }else{
    const bg=cachedGrad('mT3b',()=>{const g=ctx.createRadialGradient(-4,-4,0,0,0,20);g.addColorStop(0,'#7affb0');g.addColorStop(.5,'#20a860');g.addColorStop(1,'#0a4020');return g});
    ctx.beginPath();
    for(let i=0;i<10;i++){
      const a=i/10*Math.PI*2,wob=1+Math.sin(P_*3+o.phase+i*1.3)*.15,r=16*wob;
      if(i===0)ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
    }
    ctx.closePath();ctx.fillStyle=bg;ctx.fill();
    ctx.strokeStyle='#b0ffd0';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='rgba(180,255,220,.5)';
    for(let i=0;i<3;i++){
      const ba=P_*.5+i*2+o.phase,br=8+Math.sin(ba)*4;
      ctx.beginPath();ctx.arc(Math.cos(ba)*3,Math.sin(ba)*3,br,0,7);ctx.fill();
    }
    ctx.fillStyle='rgba(40,200,120,.6)';
    ctx.beginPath();ctx.arc(-4,18,2.5,0,7);ctx.fill();
    ctx.beginPath();ctx.arc(5,20,2,0,7);ctx.fill();
  }
}
