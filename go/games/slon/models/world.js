// ============================================================
// МИР — фон, сетка, вены
// ============================================================
function drawBg(){
  ctx.fillStyle='#1a0033';ctx.fillRect(0,0,W,H);
  const g=cachedGrad('bg',()=>{const gr=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.75);gr.addColorStop(0,'#3a0070');gr.addColorStop(.5,'#2a0050');gr.addColorStop(1,'#0f0025');return gr});
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
function drawGrid(ox,oy){
  const g=100,sx=Math.floor(-ox/g)*g,sy=Math.floor(-oy/g)*g,ex=sx+W+g,ey=sy+H+g;
  ctx.strokeStyle='rgba(200,100,255,.05)';ctx.lineWidth=1;ctx.beginPath();
  for(let x=sx;x<ex;x+=g){const s=x+ox;if(s<0||s>W)continue;ctx.moveTo(s,0);ctx.lineTo(s,H)}
  for(let y=sy;y<ey;y+=g){const s=y+oy;if(s<0||s>H)continue;ctx.moveTo(0,s);ctx.lineTo(W,s)}
  ctx.stroke();
}
function drawVines(ox,oy){
  const VC=600;
  const x1=Math.floor((-ox-W/2)/VC)-1,x2=Math.floor((-ox+W+W/2)/VC)+1;
  const y1=Math.floor((-oy-H/2)/VC)-1,y2=Math.floor((-oy+H+H/2)/VC)+1;
  for(let cx=x1;cx<=x2;cx++)for(let cy=y1;cy<=y2;cy++){
    const n=2+Math.floor(hash(cx,cy,3)*2);
    for(let v=0;v<n;v++){
      const sx=cx*VC+hash(cx,cy,10+v*7)*VC,sy=cy*VC+hash(cx,cy,11+v*7)*VC;
      drawVine(sx+ox,sy+oy,hash(cx,cy,12+v*7)*Math.PI*2,180+hash(cx,cy,13+v*7)*380,3+hash(cx,cy,14+v*7)*2,4,cx,cy,v);
    }
  }
}
function drawVine(x,y,angle,len,width,depth,cx,cy,vs){
  if(depth<=0||len<8)return;
  ctx.beginPath();ctx.moveTo(x,y);
  let px=x,py=y,a=angle;
  for(let i=0;i<4;i++){
    a+=(hash(cx*13+vs*31+depth*7,cy+i,i)-.5)*.9;
    const step=len/4;
    px+=Math.cos(a)*step;py+=Math.sin(a)*step;ctx.lineTo(px,py);
  }
  ctx.strokeStyle=`rgba(60,255,120,${.15+depth*.06})`;ctx.lineWidth=width+6;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
  ctx.strokeStyle=`rgba(40,220,90,${.5+depth*.1})`;ctx.lineWidth=width;ctx.stroke();
  ctx.strokeStyle=`rgba(180,255,180,${.35+depth*.08})`;ctx.lineWidth=Math.max(1,width*.35);ctx.stroke();
  if(depth>1&&hash(cx,cy,depth*7+vs)>.35){
    drawVine(x+Math.cos(a)*len*.5,y+Math.sin(a)*len*.5,a+(hash(cx,cy,depth*11+vs)-.5)*2,len*.55,width*.6,depth-1,cx,cy,vs+1);
  }
}
