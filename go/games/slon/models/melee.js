// ============================================================
// БЛИЖНИКИ — контактная атака в упор
// ============================================================
const MELEE={RANGE:26,DMG:8,COOL:1,PUSH:80,VIB:40};

function meleeAttack(e,dt,nx,ny){
  e.attackCool-=dt;
  if(e.attackCool>0)return;
  P.hp-=MELEE.DMG;P.hurtFlash=1;P.regenDelay=3;trauma.add(.35);playHurt();
  navigator.vibrate?.(MELEE.VIB);e.attackCool=MELEE.COOL;P.vx-=nx*MELEE.PUSH;P.vy-=ny*MELEE.PUSH;
  if(P.hp<=0)respawn();
}
