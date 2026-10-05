// ============================================================
// ВРАГИ — бесконечный поток
// ============================================================
const enemies=[],MAX_E=30;
let spawnTimer=0;

function updateEnemySpawn(dt){
  spawnTimer-=dt;
  if(spawnTimer>0||enemies.length>=MAX_E)return;

  const density=enemies.length/MAX_E;
  spawnTimer=.35+density*.55;

  // спавн только за краем кадра: враг приходит из-за экрана, а не возникает на глазах
  const viewR=Math.hypot(W,H)/2;
  const a=Math.random()*Math.PI*2;
  const r=viewR+60+Math.random()*200;
  const sx=P.x+Math.cos(a)*r;
  const sy=P.y+Math.sin(a)*r;

  const group=1+Math.floor(Math.random()*2.5);
  for(let i=0;i<group&&enemies.length<MAX_E;i++){
    const ox=(Math.random()-.5)*60,oy=(Math.random()-.5)*60;
    enemies.push({
      x:sx+ox,y:sy+oy,vx:0,vy:0,angle:0,hp:2,
      phase:Math.random()*10,hitFlash:0,alert:true,attackCool:0,
      bob:Math.random()*10,chaseRange:viewR+300,attackRange:MELEE.RANGE,speed:130
    });
  }
}

function drawEnemy(e,sx,sy){
  const size=.5,pulse=Math.sin(P.breath*3+e.phase)*.15+1,bob=Math.sin(P.breath*4+e.bob)*2;
  ctx.save();ctx.translate(sx,sy+bob);ctx.rotate(e.angle+Math.PI/2);ctx.scale(size*pulse,size*pulse);
  for(let i=0;i<4;i++){
    const a=i/4*Math.PI*2+Math.PI/4,len=14,wob=Math.sin(P.breath*6+e.bob+i)*3;
    ctx.beginPath();ctx.moveTo(0,0);
    ctx.quadraticCurveTo(Math.cos(a)*(len*.5)+wob,Math.sin(a)*(len*.5)+wob,Math.cos(a)*len,Math.sin(a)*len);
    ctx.strokeStyle='#802020';ctx.lineWidth=4;ctx.lineCap='round';ctx.stroke();
    ctx.strokeStyle='#c04040';ctx.lineWidth=2;ctx.stroke();
  }
  const bg=cachedGrad('eBg',()=>{const g=ctx.createRadialGradient(-3,-3,0,0,0,16);g.addColorStop(0,'#e06060');g.addColorStop(.5,'#a03030');g.addColorStop(1,'#401010');return g});
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2,wob=1+Math.sin(P.breath*5+e.phase+i*1.5)*.18,r=13*wob;
    if(i===0)ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
  }
  ctx.closePath();ctx.fillStyle=bg;ctx.fill();ctx.strokeStyle='#ff8080';ctx.lineWidth=1.2;ctx.stroke();
  ctx.beginPath();ctx.arc(0,-2,7,0,7);ctx.fillStyle='#0a0a0a';ctx.fill();
  ctx.beginPath();ctx.arc(0,-2,4.5,0,7);ctx.fillStyle=e.alert?'#ff2020':'#ff8020';ctx.fill();
  ctx.beginPath();ctx.arc(-1.5,-3.5,1.8,0,7);ctx.fillStyle='#fff';ctx.fill();
  ctx.fillStyle='#1a0505';ctx.beginPath();ctx.arc(0,8,5,0,Math.PI);ctx.fill();
  ctx.fillStyle='#f0f0f0';
  for(let i=0;i<4;i++){
    const a=-Math.PI*.75+i*(Math.PI/2)/3;
    ctx.beginPath();ctx.moveTo(Math.cos(a)*5,8+Math.sin(a)*5);
    ctx.lineTo(Math.cos(a)*5+1.2,8+Math.sin(a)*5+2.5);
    ctx.lineTo(Math.cos(a)*5-1.2,8+Math.sin(a)*5+2.5);ctx.closePath();ctx.fill();
  }
  if(e.hitFlash>0){
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=e.hitFlash;
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,18,0,7);ctx.fill();
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  ctx.restore();
}
function updateEnemies(dt){
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i],dx=P.x-e.x,dy=P.y-e.y,d=Math.hypot(dx,dy);
    if(d<e.chaseRange)e.alert=true;
    if(d>e.chaseRange*1.5)e.alert=false;
    if(e.alert&&d>1){
      const nx=dx/d,ny=dy/d;
      if(d>e.attackRange){e.vx=nx*e.speed;e.vy=ny*e.speed}
      else{
        e.vx=e.vy=0;
        meleeAttack(e,dt,nx,ny);
      }
      let tA=Math.atan2(e.vy,e.vx);
      if(e.vx===0&&e.vy===0)tA=Math.atan2(dy,dx);
      let dd=tA-e.angle;
      while(dd>Math.PI)dd-=Math.PI*2;while(dd<-Math.PI)dd+=Math.PI*2;
      e.angle+=dd*Math.min(1,dt*8);
    }else{e.vx*=Math.pow(.5,dt);e.vy*=Math.pow(.5,dt)}
    e.x+=e.vx*dt;e.y+=e.vy*dt;
    if(e.hitFlash>0)e.hitFlash=Math.max(0,e.hitFlash-dt*5);
    if(d>1600&&!e.alert)enemies.splice(i,1);
  }
}
