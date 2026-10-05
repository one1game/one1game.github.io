// ============================================================
// ПЕРСОНАЖ — главный герой
// ============================================================
function drawChar(px,py){
  const t=P.walk,br=Math.sin(P.breath)*1.2,rx=-Math.cos(P.angle)*P.recoil*4,ry=-Math.sin(P.angle)*P.recoil*4;
  ctx.save();ctx.translate(px+rx,py+ry);
  ctx.rotate(P.angle-Math.PI/2);
  const ls=P.moving?Math.sin(t*2)*5:Math.sin(t)*1.2;
  ctx.fillStyle='#16344d';ctx.strokeStyle='rgba(110,193,255,.35)';ctx.lineWidth=1;
  ctx.beginPath();ctx.ellipse(-8,20+ls,5.5,11,0,0,7);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(8,20-ls,5.5,11,0,0,7);ctx.fill();ctx.stroke();
  const as=P.moving?Math.sin(t*2+Math.PI)*4.5:Math.sin(t)*1;
  ctx.fillStyle='#1e4a68';ctx.strokeStyle='rgba(110,193,255,.4)';
  ctx.beginPath();ctx.ellipse(-22,2+as,4.5,12,.25,0,7);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(22,2-as,4.5,12,-.25,0,7);ctx.fill();ctx.stroke();
  const bw=20+br*.4,bh=26+br;
  const bg=cachedGrad('pBg',()=>{const g=ctx.createRadialGradient(-6,-10,2,0,4,30);g.addColorStop(0,'#5aa9d6');g.addColorStop(.55,'#2f6f96');g.addColorStop(1,'#173b56');return g});
  ctx.beginPath();ctx.ellipse(0,4,bw,bh,0,0,7);ctx.fillStyle=bg;ctx.fill();
  ctx.strokeStyle='rgba(130,210,255,.55)';ctx.lineWidth=1.4;ctx.stroke();
  const pg=cachedGrad('pPlate',()=>{const g=ctx.createLinearGradient(0,-18,0,4);g.addColorStop(0,'rgba(140,220,255,.35)');g.addColorStop(1,'rgba(60,140,200,.15)');return g});
  ctx.beginPath();ctx.ellipse(0,-8+br*.3,14,10,0,0,7);ctx.fillStyle=pg;ctx.fill();
  ctx.strokeStyle='rgba(170,230,255,.7)';ctx.lineWidth=1;ctx.stroke();
  const pu=.55+Math.sin(P.breath*2.4)*.2;
  const cg=cachedGrad('pCore',()=>{const g=ctx.createRadialGradient(0,2,0,0,2,12);g.addColorStop(0,'rgba(190,245,255,.75)');g.addColorStop(.4,'rgba(110,200,255,.45)');g.addColorStop(1,'rgba(110,200,255,0)');return g});
  ctx.globalAlpha=pu/.75;
  ctx.beginPath();ctx.arc(0,2,12,0,7);ctx.fillStyle=cg;ctx.fill();
  ctx.globalAlpha=1;
  const hg=cachedGrad('pHead',()=>{const g=ctx.createRadialGradient(-4,-26,2,0,-22,16);g.addColorStop(0,'#6fb8e0');g.addColorStop(.6,'#2f6f96');g.addColorStop(1,'#173b56');return g});
  ctx.beginPath();ctx.arc(0,-22+br*.4,12,0,7);ctx.fillStyle=hg;ctx.fill();
  ctx.strokeStyle='rgba(130,210,255,.6)';ctx.lineWidth=1.3;ctx.stroke();
  ctx.beginPath();ctx.ellipse(0,-22+br*.4,9,4.5,0,0,7);ctx.fillStyle='rgba(8,20,34,.85)';ctx.fill();
  const eg=.75+Math.sin(P.breath*1.7)*.25;
  ctx.shadowBlur=10;ctx.shadowColor=`rgba(120,230,255,${eg})`;ctx.fillStyle=`rgba(210,250,255,${eg})`;
  ctx.beginPath();ctx.arc(-4,-22+br*.4,2.2,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(4,-22+br*.4,2.2,0,7);ctx.fill();ctx.shadowBlur=0;
  const mp=.6+Math.sin(P.breath*3)*.25;
  ctx.beginPath();ctx.ellipse(0,20,10,6,0,0,7);ctx.fillStyle='#1c2a38';ctx.fill();
  ctx.strokeStyle='rgba(140,200,255,.5)';ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(-7,22,14,18,4);else ctx.rect(-7,22,14,18);
  ctx.fillStyle='#243545';ctx.fill();ctx.strokeStyle='rgba(140,200,255,.65)';ctx.lineWidth=1.2;ctx.stroke();
  if(P.recoil>.3){
    const fr=16+P.recoil*22,fg=cachedGrad('pFlash',()=>{const g=ctx.createRadialGradient(0,46,0,0,46,40);g.addColorStop(0,'rgba(255,250,200,1)');g.addColorStop(.4,'rgba(255,200,80,.8)');g.addColorStop(.75,'rgba(255,120,40,.4)');g.addColorStop(1,'rgba(255,80,20,0)');return g});
    ctx.globalAlpha=P.recoil;
    ctx.beginPath();ctx.arc(0,46,fr,0,7);ctx.fillStyle=fg;ctx.fill();
    ctx.globalAlpha=1;
  }
  if(P.hurtFlash>0){
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=P.hurtFlash*.6;
    ctx.fillStyle='#ff3030';ctx.beginPath();ctx.arc(0,0,40,0,7);ctx.fill();
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  ctx.restore();
}
