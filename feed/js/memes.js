/* memes.js — смысловой слой: форматы подачи, хуки, надписи, «смысл» видео */
window.FG = window.FG || {};
(function (FG) {
  'use strict';
  const M = Math;

  /* ---------- Банки контента ---------- */
  const HOOKS = [
    'nobody knows why this is so satisfying',
    'wait for it…',
    'i can\'t stop watching this',
    'how is this so smooth',
    'you\'re not ready for this',
    'this loops forever',
    'trust the process',
    'don\'t blink',
    'watch it again',
    'why does this feel illegal',
    'this hits different at 3am',
    'certified brainrot',
    'do not scroll, stare',
    'your brain will buffer',
    'loop it. i dare you.',
  ];
  const HOOKS_RU = [
    'не проматывай…',
    'досмотри до конца',
    'это зациклится и ты не заметишь',
    'никто не знает почему это так залипательно',
    'поверь, будет красиво',
    'ты не оторвёшься',
  ];
  const DAY_GOALS = ['until it goes viral', 'until i hit 1M', 'until this blows up', 'of posting loops', 'of brainrot', 'until you subscribe'];
  const SUBJECTS = [
    'your brain', 'my sleep schedule', 'ads in 2026', 'monday mornings', 'the wifi',
    'my last 3 brain cells', 'this economy', 'group chats', 'ai in 2026', 'the algorithm',
    'my life choices', 'school wifi', 'the weekend', 'my battery', 'every meeting',
  ];
  const TAKES = [
    'doomscrolling is a personality now', 'we all live in the backrooms', 'sleep is optional',
    'the loop never ends', 'it\'s not a phase, it\'s a state', 'silence is louder',
    'nobody is okay and that\'s fine', 'we peak at 3am', 'the vibe is the message',
  ];
  const VS_A = ['this', 'silence', 'the loop', 'chaos', 'neon', '2am', 'the void'];
  const VS_B = ['that', 'noise', 'break', 'order', 'mono', '3am', 'reality'];
  const CTAS = ['follow for more loops', 'save this', 'send to someone who needs it', 'tap if it looped forever', 'drop a 🔁', 'comment your vibe'];
  const US = ['generative', 'code', 'pixel', 'synth', 'wave', 'loop', 'glitch', 'cyber', 'noise', 'fractal'];
  const UF = ['_lab', '_forge', '_core', '_vision', '_motion', '_dream', '_trap', '_zone'];
  const PA = ['Neon', 'Void', 'Chrome', 'Lunar', 'Binary', 'Glass', 'Hyper', 'Dead', 'Solar', 'Ultra'];
  const PB = ['Drift', 'Pulse', 'Echo', 'Horizon', 'Cascade', 'Signal', 'Mirage', 'Engine', 'Rain', 'Orbit'];

  /* ---------- Форматы подачи (то, что делает видео разными по смыслу) ---------- */
  // каждый: build(r,S) => { hook, captions:[{at,text,style}], cta }
  const FORMATS = [
    { name: 'loop', w: 8, build: () => ({ hook: '', captions: [], cta: '' }) },
    { name: 'nobody', w: 9, build: r => ({ hook: 'nobody knows why this is so satisfying', captions: [{ at: .15, text: 'nobody knows why', style: 'top' }, { at: .5, text: 'this is so satisfying', style: 'top' }], cta: r() < .5 ? 'follow for more' : '' }) },
    { name: 'wait', w: 9, build: () => ({ hook: 'wait for it…', captions: [{ at: .1, text: 'wait for it…', style: 'big' }, { at: .8, text: 'see? 🔁', style: 'big' }], cta: '' }) },
    { name: 'cantsop', w: 7, build: () => ({ hook: 'i can\'t stop watching this', captions: [{ at: .15, text: "i can't stop", style: 'center' }, { at: .55, text: 'watching this', style: 'center' }], cta: 'save this' }) },
    { name: 'smooth', w: 6, build: () => ({ hook: 'how is this so smooth', captions: [{ at: .2, text: 'how is this', style: 'top' }, { at: .55, text: 'so smooth', style: 'top' }], cta: '' }) },
    { name: 'dayN', w: 8, build: r => { const n = 1 + (r() * 400 | 0), g = DAY_GOALS[r() * DAY_GOALS.length | 0]; return { hook: `day ${n} ${g}`, captions: [{ at: .05, text: `day ${n}`, style: 'top' }, { at: .4, text: g, style: 'top' }], cta: 'day ' + (n + 1) + ' tomorrow' } } },
    { name: 'trust', w: 5, build: () => ({ hook: 'trust the process', captions: [{ at: .1, text: 'trust', style: 'center' }, { at: .5, text: 'the process', style: 'center' }], cta: '' }) },
    { name: 'loopdare', w: 6, build: () => ({ hook: 'loop it. i dare you.', captions: [{ at: .15, text: 'loop it.', style: 'big' }, { at: .7, text: 'i dare you.', style: 'big' }], cta: 'drop a 🔁' }) },
    { name: 'pov', w: 8, build: r => { const s = SUBJECTS[r() * SUBJECTS.length | 0]; return { hook: 'POV: ' + s, captions: [{ at: .1, text: 'POV:', style: 'top' }, { at: .35, text: s, style: 'top' }], cta: '' } } },
    { name: 'vs', w: 5, build: r => { const a = VS_A[r() * VS_A.length | 0], b = VS_B[r() * VS_B.length | 0]; return { hook: a + ' vs ' + b, captions: [{ at: .1, text: a, style: 'left' }, { at: .1, text: b, style: 'right' }], cta: 'pick one' } } },
    { name: 'take', w: 6, build: r => { const t = TAKES[r() * TAKES.length | 0]; return { hook: t, captions: [{ at: .15, text: t, style: 'bottom' }], cta: r() < .5 ? 'agree?' : '' } } },
    { name: 'brainrot', w: 7, build: r => { const s = SUBJECTS[r() * SUBJECTS.length | 0]; return { hook: 'certified brainrot', captions: [{ at: .1, text: s + ' rn', style: 'center' }, { at: .6, text: 'certified brainrot', style: 'bottom' }], cta: '' } } },
    { name: 'dontscroll', w: 5, build: () => ({ hook: 'do not scroll, stare', captions: [{ at: .1, text: 'do not scroll', style: 'top' }, { at: .5, text: 'just stare', style: 'top' }], cta: '' }) },
    { name: '3am', w: 5, build: () => ({ hook: 'this hits different at 3am', captions: [{ at: .15, text: 'this hits different', style: 'center' }, { at: .6, text: 'at 3am', style: 'center' }], cta: '' }) },
    { name: 'ru_hook', w: 5, build: r => { const h = HOOKS_RU[r() * HOOKS_RU.length | 0]; return { hook: h, captions: [{ at: .15, text: h, style: 'bottom' }], cta: '' } } },
    { name: 'save', w: 4, build: () => ({ hook: 'save this for later', captions: [{ at: .2, text: 'save this', style: 'bottom' }], cta: 'save this' }) },
  ];

  function build(S, r) {
    // взвешенный выбор формата
    let sum = 0; for (const f of FORMATS) sum += f.w;
    let x = r() * sum, fmt = FORMATS[FORMATS.length - 1];
    for (const f of FORMATS) { x -= f.w; if (x <= 0) { fmt = f; break } }
    const out = fmt.build(r, S);
    out.format = fmt.name;
    // время жизни надписей
    out.captions = (out.captions || []).map(c => ({ at: c.at * (S.dur / 1), text: c.text, style: c.style, life: 3.5 }));
    // мем-звуки на биты
    const beats = M.max(1, M.floor(S.dur / 2));
    const sfx = [];
    if (r() < .5) { const pool = ['boom', 'bruh', 'airhorn']; for (let i = 0; i < 1 + (r() * 3 | 0); i++) sfx.push({ at: (1 + (r() * (beats - 1)) | 0) * 2, name: pool[r() * pool.length | 0], v: .35 + r() * .25 }) }
    out.sfx = sfx.sort((a, b) => a.at - b.at);
    out.user = '@' + US[r() * US.length | 0] + UF[r() * UF.length | 0] + (10 + r() * 989 | 0);
    out.song = PA[r() * PA.length | 0] + ' ' + PB[r() * PB.length | 0];
    return out;
  }

  FG.memes = { HOOKS, HOOKS_RU, SUBJECTS, TAKES, CTAS, FORMATS, build };
})(window.FG);
