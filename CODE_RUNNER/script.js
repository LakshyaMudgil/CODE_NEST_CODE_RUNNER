/* ==========================================================
   Typing Racer — standalone game script
   No dependencies. No build step. Pure canvas + vanilla JS.
   ========================================================== */
(function(){
  'use strict';

  // ---------- DOM refs ----------
  const stage       = document.getElementById('stage');
  const canvas      = document.getElementById('game');
  const ctx         = canvas.getContext('2d');
  const input       = document.getElementById('typeInput');
  const dangerZone  = document.getElementById('dangerZone');
  const flashEl     = document.getElementById('flash');
  const toastEl     = document.getElementById('toast');
  const emptyHint   = document.getElementById('emptyHint');
  const overlay     = document.getElementById('overlay');
  const modalBody   = document.getElementById('modalBody');
  const pauseBtn    = document.getElementById('pauseBtn');
  const pauseIcon   = document.getElementById('pauseIcon');
  const pauseLabel  = document.getElementById('pauseLabel');
  const soundBtn    = document.getElementById('soundBtn');
  const countdownOverlay = document.getElementById('countdownOverlay');
  const countdownNum     = document.getElementById('countdownNum');
  const comboFireEl      = document.getElementById('comboFire');
  const powerupIndicator = document.getElementById('powerupIndicator');

  const inputCharOverlay = document.getElementById('inputCharOverlay');

  const pillScore=document.getElementById('pillScore'), valScore=document.getElementById('valScore');
  const pillLevel=document.getElementById('pillLevel'), valLevel=document.getElementById('valLevel');
  const pillLives=document.getElementById('pillLives'), valLives=document.getElementById('valLives');
  const pillWpm=document.getElementById('pillWpm'), valWpm=document.getElementById('valWpm');
  const pillAcc=document.getElementById('pillAcc'), valAcc=document.getElementById('valAcc');
  const pillCombo=document.getElementById('pillCombo'), valCombo=document.getElementById('valCombo');
  const pillBest=document.getElementById('pillBest'), valBest=document.getElementById('valBest');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Word bank (programming-flavored, bucketed by length) ----------
  const WORD_BANK = {
    '2': ['if','or','in','is','do','go','on','to','an','be','as','at'],
    '3': ['for','let','var','int','new','try','get','set','key','tag','sum','map','run','dev','api','log','git','bit'],
    '4': ['enum','void','byte','bool','hash','heap','node','loop','list','dict','char','true','null','code','func','sync','port','host','view','push','pull','exit','echo','grep','fork','repo'],
    '5': ['array','class','const','break','catch','throw','async','await','yield','super','print','input','index','table','query','cache','stack','queue','event','param','scope','debug','build','merge','clone','patch','token','route'],
    '6': ['string','method','object','module','import','export','switch','return','static','public','global','socket','header','cookie','cursor','buffer','thread','kernel','syntax','python','docker','github','mobile','deploy','plugin','widget','vector','matrix','format'],
    '7': ['boolean','integer','compile','runtime','backend','closure','package','library','gateway','cluster','session','request','promise','variant','keyword','pointer','android','desktop','browser'],
    '8': ['response','callback','database','function','variable','iterator','protocol','endpoint','frontend','encoding','abstract','template','compiler','debugger','hardware','software','terminal'],
    '9': ['algorithm','interface','framework','container','namespace','attribute','reference','developer','component','exception','parameter','singleton','recursion','dictionary','javascript','typescript','repository','production','middleware','constructor','programming','application']
  };
  const LENGTH_KEYS = ['2','3','4','5','6','7','8','9'];

  // ---------- Language / snippet word packs ----------
  // Each pack is a flat word list, auto-bucketed into the same length
  // keys as WORD_BANK so the existing spawn/filter logic works unchanged.
  function bucketWords(list){
    const buckets = {'2':[],'3':[],'4':[],'5':[],'6':[],'7':[],'8':[],'9':[]};
    list.forEach(w=>{
      const key = String(Math.min(9, Math.max(2, w.length)));
      if(buckets[key].indexOf(w)===-1) buckets[key].push(w);
    });
    return buckets;
  }
  const LANGUAGE_WORD_LISTS = {
    javascript: ['let','var','map','new','for','const','await','async','yield','class','throw','catch','super','array','object','export','import','switch','return','static','module','string','method','promise','closure','keyword','callback','function','variable','prototype','component'],
    python: ['def','set','try','list','dict','pass','self','yield','lambda','print','input','tuple','range','class','import','except','module','package','iterator','generator','decorator','comprehension'],
    css: ['flex','grid','hover','color','width','height','margin','border','padding','float','cursor','opacity','display','gradient','position','absolute','relative','selector','keyframes','animation','transition','transform'],
    sql: ['key','sum','select','insert','update','delete','where','join','inner','outer','group','order','table','index','schema','commit','rollback','distinct','database','procedure'],
    html: ['div','nav','img','form','span','input','label','button','header','footer','section','article','anchor','fragment','attribute','component'],
    git: ['tag','add','log','diff','push','pull','fetch','stash','clone','merge','rebase','commit','branch','remote','origin','revert','conflict','checkout','gitignore']
  };
  const LANGUAGE_BANKS = { all: WORD_BANK };
  Object.keys(LANGUAGE_WORD_LISTS).forEach(k=>{ LANGUAGE_BANKS[k] = bucketWords(LANGUAGE_WORD_LISTS[k]); });
  const LANGUAGE_LABELS = { all:'All', javascript:'JavaScript', python:'Python', css:'CSS', sql:'SQL', html:'HTML/JSX', git:'Git' };
  const LANGUAGE_ORDER = ['all','javascript','python','css','sql','html','git'];

  // ---------- Boss words / code blocks ----------
  // Multi-token snippets that drift in slowly and pay out a big bonus.
  // These are real code transcription: what you type must match the
  // punctuation, digits, and spacing shown on screen exactly (case-
  // insensitive). No characters get silently stripped anymore.
  const BOSS_SNIPPETS = [
    'async function fetchData()',
    'const users = await api.get()',
    'for (let i = 0; i < n; i++)',
    'if (response.ok) return data',
    'export default function App()',
    'try { await save() } catch (e)',
    'const [state, setState] = useState()',
    'git commit -m "fix bug"',
    'select * from users where id',
    'docker run -p 8080:80 app'
  ];

  // ---------- Special word-type weighting ----------
  // One place to tune how often each ring type shows up; add a new type
  // by adding a row here plus a case in hitWord()/specialColor()/specialLabel().
  const SPECIAL_WEIGHTS = [
    ['bonus',  0.28],
    ['life',   0.18],
    ['bomb',   0.16],
    ['slow',   0.16],
    ['shield', 0.12],
    ['freeze', 0.10]
  ];
  function rollSpecial(){
    const r = Math.random();
    let acc = 0;
    for(let i=0;i<SPECIAL_WEIGHTS.length;i++){
      acc += SPECIAL_WEIGHTS[i][1];
      if(r<acc) return SPECIAL_WEIGHTS[i][0];
    }
    return SPECIAL_WEIGHTS[0][0];
  }

  // ---------- Themes ----------
  // Unlocked by lifetime best score (checked live against `best`, nothing
  // extra to persist). Applied via a data-theme attribute on <html>, with
  // the actual colors defined in styles.css.
  const THEMES = [
    { key:'default',   label:'CodeNest',      unlockScore:0,     swatch:['#6c5ce7','#ff3b5c','#10b981'] },
    { key:'nord',       label:'Nord',          unlockScore:2000,  swatch:['#88C0D0','#BF616A','#A3BE8C'] },
    { key:'monokai',    label:'Monokai',       unlockScore:5000,  swatch:['#AE81FF','#F92672','#A6E22E'] },
    { key:'dracula',    label:'Dracula',       unlockScore:10000, swatch:['#BD93F9','#FF5555','#50FA7B'] },
    { key:'cyberpunk',  label:'Cyberpunk Neon',unlockScore:20000, swatch:['#d000ff','#ff003c','#00ff9f'] }
  ];

  // ---------- Persisted prefs ----------
  let best = 0, soundOn = true, difficulty = 'normal', activeLanguage = 'all';
  try{ best = parseInt(localStorage.getItem('cn_typing_best')||'0',10) || 0; }catch(e){}
  try{ soundOn = localStorage.getItem('cn_typing_sound') !== 'off'; }catch(e){}
  try{
    const d = localStorage.getItem('cn_typing_difficulty');
    if(d==='easy' || d==='hard') difficulty = d;
  }catch(e){}
  try{
    const l = localStorage.getItem('cn_typing_language');
    if(l && LANGUAGE_BANKS[l]) activeLanguage = l;
  }catch(e){}

  // Mechanical keyboard sound style for keypress feedback while typing.
  let keySoundStyle = 'blue';
  try{
    const ks = localStorage.getItem('cn_typing_keysound');
    if(ks==='blue' || ks==='thocky' || ks==='synth') keySoundStyle = ks;
  }catch(e){}
  const KEY_SOUND_STYLES = [
    { key:'blue',   label:'Cherry MX Blue',  desc:'Sharp & clicky' },
    { key:'thocky', label:'Thocky Linear',   desc:'Deep & rounded' },
    { key:'synth',  label:'Cyber Synth',     desc:'Digital blip' }
  ];
  function setKeySoundStyle(k){
    if(keySoundStyle===k) return;
    keySoundStyle = k;
    try{ localStorage.setItem('cn_typing_keysound', k); }catch(e){}
    ensureAudio();
    playSound('key');
    openModal(currentModalKind);
  }

  let activeTheme = 'default';
  try{
    const t = localStorage.getItem('cn_typing_theme');
    if(t && THEMES.some(th=>th.key===t)) activeTheme = t;
  }catch(e){}
  let lbPeriod = 'all', lbSort = 'score';
  try{
    const p = localStorage.getItem('cn_typing_lbperiod');
    if(p==='all'||p==='weekly'||p==='daily') lbPeriod = p;
  }catch(e){}
  try{
    const sMetric = localStorage.getItem('cn_typing_lbsort');
    if(sMetric==='score'||sMetric==='wpm') lbSort = sMetric;
  }catch(e){}

  // ---------- Lifetime stats dashboard ----------
  let statsBestWpm = 0, statsTotalRaces = 0, statsTotalAttempts = 0, statsTotalCorrect = 0;
  try{ statsBestWpm      = parseInt(localStorage.getItem('cn_typing_bestwpm')||'0',10) || 0; }catch(e){}
  try{ statsTotalRaces   = parseInt(localStorage.getItem('cn_typing_races')||'0',10) || 0; }catch(e){}
  try{ statsTotalAttempts= parseInt(localStorage.getItem('cn_typing_totalattempts')||'0',10) || 0; }catch(e){}
  try{ statsTotalCorrect = parseInt(localStorage.getItem('cn_typing_totalcorrect')||'0',10) || 0; }catch(e){}
  function statsLifetimeAccuracy(){ return statsTotalAttempts ? Math.round((statsTotalCorrect/statsTotalAttempts)*100) : 100; }

  // Keep a larger local history (50 runs) than we ever *show* at once (5),
  // so daily/weekly slices still have something in them. This is a
  // per-device history only — see the note rendered in leaderboardHTML()
  // about why there's no cross-device/global board here.
  function loadLeaderboard(){
    try{
      const raw = localStorage.getItem('cn_typing_leaderboard');
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    }catch(e){ return []; }
  }
  function addToLeaderboard(entry){
    const list = loadLeaderboard();
    list.push(entry);
    list.sort((a,b)=>b.score-a.score);
    const top = list.slice(0,50);
    try{ localStorage.setItem('cn_typing_leaderboard', JSON.stringify(top)); }catch(e){}
    return top;
  }
  function leaderboardPeriodFilter(list, period){
    if(period==='all') return list;
    const now = Date.now();
    const span = period==='daily' ? 24*60*60*1000 : 7*24*60*60*1000;
    return list.filter(e => (now-(e.ts||0)) <= span);
  }
  function leaderboardSorted(list, metric){
    const copy = list.slice();
    copy.sort((a,b)=> metric==='wpm' ? ((b.wpm||0)-(a.wpm||0)) : (b.score-a.score));
    return copy;
  }

  // ---------- Themes ----------
  function isThemeUnlocked(theme){ return best >= theme.unlockScore; }
  function applyTheme(){
    document.documentElement.setAttribute('data-theme', activeTheme);
  }
  function setTheme(key){
    const theme = THEMES.find(t=>t.key===key);
    if(!theme || !isThemeUnlocked(theme)){
      showToast(theme ? ('Reach '+theme.unlockScore+' score to unlock') : 'Locked');
      return;
    }
    activeTheme = key;
    try{ localStorage.setItem('cn_typing_theme', key); }catch(e){}
    applyTheme();
    openModal(currentModalKind);
  }

  // ---------- Difficulty helpers ----------
  function difficultyLives(){ return difficulty==='easy' ? 6 : difficulty==='hard' ? 4 : 5; }
  function difficultyScoreMult(){ return difficulty==='easy' ? 0.85 : difficulty==='hard' ? 1.25 : 1; }
  function difficultySpeedAdj(){ return difficulty==='easy' ? -1 : difficulty==='hard' ? 1 : 0; }

  // ---------- Game state ----------
  let state = 'start'; // start | countdown | playing | paused | gameover
  let score=0, level=1, lives=5;
  let words=[], particles=[], floaters=[];
  let activeFilters = new Set(LENGTH_KEYS);
  let attempts=0, correctHits=0, correctChars=0, combo=0;
  let elapsedPlayMs=0, typed='';
  let laneUsed = {};
  let currentModalKind = 'start';
  let uiThrottle = 0;
  let lastRunScore = null;
  let lastRunTs = null;
  let lastRunWasNewBest = false;
  let lastRunUnlockedThemes = [];
  let slowUntil = 0;
  let freezeUntil = 0;
  let shieldCharges = 0;

  // Continuous spawn pacing (replaces the old "drop the whole level at
  // once" approach — see spawnOneWord()/currentSpawnInterval()).
  let spawnedThisLevel = 0;
  let totalThisLevel = 0;
  let spawnTimer = 0;
  let lastSpawnLane = -1;

  let STAGE_W=0, STAGE_H=0;
  const DANGER_X = 66;
  const SPEED_UNIT = 58; // px/sec per speed level
  const SLOW_FACTOR = 0.42;
  const SLOW_DURATION = 6000; // ms
  const FREEZE_DURATION = 3000; // ms

  // ---------- Canvas sizing ----------
  function resize(){
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    STAGE_W = rect.width; STAGE_H = rect.height;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    initStreaks();
    initMatrix();
  }
  window.addEventListener('resize', resize);

  function wordFontSize(){
    if(STAGE_W < 480) return 15;
    if(STAGE_W < 700) return 17;
    if(STAGE_W < 1000) return 20;
    return 22;
  }
  function setWordFont(){ ctx.font = '700 ' + wordFontSize() + 'px "JetBrains Mono", monospace'; }
  function wordWidth(text){ setWordFont(); return ctx.measureText(text).width; }

  function roundRectPath(c,x,y,w,h,r){
    if(c.roundRect){ c.beginPath(); c.roundRect(x,y,w,h,r); return; }
    c.beginPath();
    c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
  }

  // ═══════════════════════════════════════════════════════════
  //  VISUAL SYSTEMS
  // ═══════════════════════════════════════════════════════════

  // 1. Dynamic Speed Lines (intensity scales with combo)
  let streaks = [];
  function initStreaks(){
    streaks = [];
    if(STAGE_W<=0||STAGE_H<=0) return;
    const count = Math.max(22, Math.floor(STAGE_W/55));
    for(let i=0;i<count;i++){
      streaks.push({
        x: Math.random()*STAGE_W,
        y: Math.random()*STAGE_H,
        len: 30+Math.random()*80,
        baseSpeed: 30+Math.random()*70,
        alpha: 0.018+Math.random()*0.038
      });
    }
  }
  function updateStreaks(dt){
    if(reduceMotion) return;
    const speedMult = 1 + Math.min(combo,20)/20*2.2;
    streaks.forEach(s=>{
      s.x -= s.baseSpeed * speedMult * dt;
      if(s.x + s.len < 0){
        s.x = STAGE_W + Math.random()*120;
        s.y = Math.random()*STAGE_H;
      }
    });
  }
  function drawStreaks(){
    if(reduceMotion) return;
    ctx.save();
    const speedMult = 1 + Math.min(combo,20)/20*2.2;
    streaks.forEach(s=>{
      const visLen = s.len * (0.7 + speedMult*0.3);
      const alpha  = s.alpha * Math.min(speedMult,2.5);
      const grad = ctx.createLinearGradient(s.x, s.y, s.x+visLen, s.y);
      grad.addColorStop(0,    'rgba(255,255,255,0)');
      grad.addColorStop(0.45, 'rgba(160,180,255,'+alpha.toFixed(3)+')');
      grad.addColorStop(0.75, 'rgba(108,92,231,'+(alpha*0.6).toFixed(3)+')');
      grad.addColorStop(1,    'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x+visLen, s.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  // 2. Synthwave Perspective Grid (bottom portion of stage)
  let gridOffset = 0;
  function updateGrid(dt){
    if(reduceMotion) return;
    const speedMult = 1 + Math.min(combo,20)/20*2.5;
    gridOffset = (gridOffset + 38*speedMult*dt) % 60;
  }
  function drawGrid(){
    if(reduceMotion) return;
    ctx.save();
    const horizon  = STAGE_H*0.60;
    const rows     = 12;
    const rowSpacing = 60;
    // horizontal lines
    for(let r=0; r<=rows; r++){
      const rawY = horizon + (r*rowSpacing) - gridOffset;
      if(rawY > STAGE_H+4 || rawY < horizon) continue;
      const t     = (rawY-horizon)/(STAGE_H-horizon);
      const alpha = 0.04 + t*0.18;
      const grad  = ctx.createLinearGradient(0, rawY, STAGE_W, rawY);
      grad.addColorStop(0,   'rgba(108,92,231,0)');
      grad.addColorStop(0.3, 'rgba(108,92,231,'+alpha.toFixed(3)+')');
      grad.addColorStop(0.7, 'rgba(255,59,92,'+(alpha*0.6).toFixed(3)+')');
      grad.addColorStop(1,   'rgba(255,59,92,0)');
      ctx.strokeStyle = grad; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0,rawY); ctx.lineTo(STAGE_W,rawY); ctx.stroke();
    }
    // vertical lines converge at center horizon
    const vpx = STAGE_W/2;
    const cols = 14;
    for(let c=0; c<=cols; c++){
      const bx   = (c/cols)*STAGE_W;
      const grad = ctx.createLinearGradient(vpx, horizon, bx, STAGE_H);
      grad.addColorStop(0, 'rgba(108,92,231,0)');
      grad.addColorStop(1, 'rgba(108,92,231,0.13)');
      ctx.strokeStyle = grad; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(vpx, horizon); ctx.lineTo(bx, STAGE_H+10); ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Ambient Mesh Gradient Orbs
  const orbs = [
    { x:0.82, y:0.05, r:0.55, color:'108,92,231',  phase:0.0 },
    { x:0.04, y:0.92, r:0.48, color:'255,59,92',   phase:1.8 },
    { x:0.50, y:0.52, r:0.42, color:'160,80,220',  phase:3.1 },
    { x:0.12, y:0.28, r:0.32, color:'22,211,238',  phase:4.2 },
  ];
  function drawOrbs(now){
    if(reduceMotion) return;
    ctx.save();
    orbs.forEach(o=>{
      const pulse = 0.5+0.5*Math.sin(now/4200+o.phase);
      const cx    = o.x*STAGE_W + Math.sin(now/7000+o.phase)*STAGE_W*0.04;
      const cy    = o.y*STAGE_H + Math.cos(now/8200+o.phase)*STAGE_H*0.04;
      const rad   = o.r*Math.max(STAGE_W,STAGE_H)*(0.88+0.12*pulse);
      const alpha = (0.055+0.022*pulse).toFixed(3);
      const grad  = ctx.createRadialGradient(cx,cy,0,cx,cy,rad);
      grad.addColorStop(0, 'rgba('+o.color+','+alpha+')');
      grad.addColorStop(1, 'rgba('+o.color+',0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad, rad*0.72, 0, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // 4. Matrix / Code Rain
  const MATRIX_CHARS = '01アイウエオカサシスセソタチツテトナニヌネノif{}[];=>async'.split('');
  let matrixCols = [];
  function initMatrix(){
    matrixCols = [];
    if(STAGE_W<=0) return;
    const colW  = 18;
    const count = Math.floor(STAGE_W/colW);
    for(let i=0;i<count;i++){
      matrixCols.push({
        x:     i*colW + colW/2,
        y:     Math.random()*-500,
        speed: 28+Math.random()*38,
        chars: Array.from({length:18},()=>({ c:MATRIX_CHARS[Math.floor(Math.random()*MATRIX_CHARS.length)], age:Math.random() })),
        opacity: 0.033+Math.random()*0.028,
      });
    }
  }
  function updateMatrix(dt){
    if(reduceMotion) return;
    matrixCols.forEach(col=>{
      col.y += col.speed*dt;
      if(col.y > STAGE_H+200){
        col.y = -Math.random()*400;
        col.speed = 28+Math.random()*38;
      }
      col.chars.forEach(ch=>{
        ch.age += dt;
        if(ch.age > 0.4+Math.random()*0.6){
          ch.c = MATRIX_CHARS[Math.floor(Math.random()*MATRIX_CHARS.length)];
          ch.age = 0;
        }
      });
    });
  }
  function drawMatrix(){
    if(reduceMotion) return;
    ctx.save();
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    matrixCols.forEach(col=>{
      col.chars.forEach((ch,i)=>{
        const cy = col.y + i*14;
        if(cy < -14 || cy > STAGE_H) return;
        const fadeTop = Math.max(0, Math.min(1, cy/60));
        const alpha   = col.opacity * fadeTop;
        ctx.fillStyle = i===0
          ? 'rgba(180,240,255,'+(alpha*3.5).toFixed(3)+')'
          : 'rgba(108,185,231,'+alpha.toFixed(3)+')';
        ctx.fillText(ch.c, col.x, cy);
      });
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // 5. Spawn Telegraph (right-edge pulse before a word enters)
  let telegraphs = [];
  function spawnTelegraph(y, colorStr){
    telegraphs.push({ y, color:colorStr, life:0.65, maxLife:0.65 });
  }
  function updateTelegraphs(dt){
    for(let i=telegraphs.length-1;i>=0;i--){
      telegraphs[i].life -= dt;
      if(telegraphs[i].life<=0) telegraphs.splice(i,1);
    }
  }
  function drawTelegraphs(){
    if(reduceMotion||!telegraphs.length) return;
    ctx.save();
    telegraphs.forEach(t=>{
      const ratio = t.life/t.maxLife;
      const h     = 28+ratio*20;
      const grad  = ctx.createLinearGradient(STAGE_W-100, t.y, STAGE_W, t.y);
      grad.addColorStop(0, 'rgba('+t.color+',0)');
      grad.addColorStop(1, 'rgba('+t.color+','+(ratio*0.55).toFixed(3)+')');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.rect(STAGE_W-100, t.y-h/2, 100, h); ctx.fill();
    });
    ctx.restore();
  }

  // 6. Neon Danger Laser Line (replaces the old CSS-only danger zone line)
  function drawDangerLine(now){
    const pulse    = 0.65+0.35*Math.sin(now/320);
    let   critical = words.some(w => w.x - DANGER_X < 140);
    const baseA    = critical ? 0.75*pulse : 0.28*pulse;
    ctx.save();
    ctx.shadowColor = critical ? 'rgba(255,59,92,0.9)' : 'rgba(255,59,92,0.4)';
    ctx.shadowBlur  = critical ? 22 : 10;
    ctx.strokeStyle = 'rgba(255,59,92,'+baseA.toFixed(3)+')';
    ctx.lineWidth   = critical ? 2.5 : 1.5;
    ctx.setLineDash(critical ? [] : [8,6]);
    ctx.beginPath(); ctx.moveTo(DANGER_X,0); ctx.lineTo(DANGER_X,STAGE_H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // initialise one-time systems
  initMatrix();

  // ---------- Audio (synthesized, no external files) ----------
  let audioCtx=null;
  function ensureAudio(){
    if(!audioCtx){
      try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
    }
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function beep(o){
    if(!soundOn || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if(o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(o.glideTo,20), t0 + o.duration);
    g.gain.setValueAtTime(Math.max(o.gain,0.0001), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.duration);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + o.duration + 0.02);
  }
  // Short filtered-noise burst — used for the clicky/thocky keyboard
  // styles, which need a percussive transient rather than a pure tone.
  function noiseBurst(o){
    if(!soundOn || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const dur = o.duration || .02;
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1) * (1 - i/bufferSize); }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filt = audioCtx.createBiquadFilter();
    filt.type = o.filterType || 'bandpass';
    filt.frequency.value = o.freq || 2200;
    filt.Q.value = o.q || 1.1;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(Math.max(o.gain,0.0001), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    src.connect(filt); filt.connect(g); g.connect(audioCtx.destination);
    src.start(t0);
  }

  function playKeySound(){
    if(!soundOn || !audioCtx) return;
    if(keySoundStyle==='thocky'){
      // Deep, rounded "thock" — low filtered noise body + a soft low tone.
      noiseBurst({freq:420, q:0.9, duration:.045, gain:.05, filterType:'lowpass'});
      beep({freq:150,duration:.05,type:'sine',gain:.02,glideTo:90});
    } else if(keySoundStyle==='synth'){
      // Cyber synth blip — quick upward-glided square pulse.
      beep({freq:900,duration:.028,type:'square',gain:.02,glideTo:1500});
    } else {
      // Cherry MX Blue — sharp, high, double-transient click.
      noiseBurst({freq:3200, q:1.4, duration:.012, gain:.045, filterType:'bandpass'});
      beep({freq:1800,duration:.014,type:'square',gain:.01});
    }
  }

  function playSound(kind){
    if(!soundOn) return;
    ensureAudio();
    if(!audioCtx) return;
    if(kind==='key')    { playKeySound(); return; }
    if(kind==='hit')    beep({freq:480,duration:.13,type:'triangle',gain:.07,glideTo:980});
    if(kind==='miss')   beep({freq:200,duration:.16,type:'sawtooth',gain:.05,glideTo:90});
    if(kind==='life')   beep({freq:240,duration:.26,type:'square',gain:.07,glideTo:70});
    if(kind==='level'){ beep({freq:660,duration:.1,type:'sine',gain:.05}); setTimeout(()=>beep({freq:880,duration:.16,type:'sine',gain:.05}),90); }
    if(kind==='over')   beep({freq:300,duration:.4,type:'sawtooth',gain:.06,glideTo:60});
    if(kind==='tick')   beep({freq:440,duration:.08,type:'sine',gain:.05});
    if(kind==='go')     beep({freq:880,duration:.22,type:'sine',gain:.07,glideTo:1200});
    if(kind==='bonus'){ beep({freq:520,duration:.08,type:'sine',gain:.06}); setTimeout(()=>beep({freq:780,duration:.08,type:'sine',gain:.06}),70); setTimeout(()=>beep({freq:1040,duration:.12,type:'sine',gain:.06}),140); }
    if(kind==='lifeUp'){ beep({freq:440,duration:.12,type:'sine',gain:.06}); setTimeout(()=>beep({freq:660,duration:.18,type:'sine',gain:.06}),100); }
    if(kind==='bomb'){ beep({freq:150,duration:.3,type:'square',gain:.08,glideTo:40}); setTimeout(()=>beep({freq:900,duration:.15,type:'triangle',gain:.05}),60); }
    if(kind==='slow'){ beep({freq:700,duration:.18,type:'sine',gain:.06,glideTo:260}); setTimeout(()=>beep({freq:500,duration:.22,type:'sine',gain:.05,glideTo:180}),80); }
    if(kind==='shield'){ beep({freq:520,duration:.14,type:'sine',gain:.06}); setTimeout(()=>beep({freq:660,duration:.1,type:'sine',gain:.05}),60); }
    if(kind==='freeze'){ beep({freq:1200,duration:.06,type:'square',gain:.05}); setTimeout(()=>beep({freq:300,duration:.3,type:'sine',gain:.06,glideTo:120}),50); }
  }

  // ---------- Dynamic synthwave background music ----------
  // A tiny arpeggio sequencer (no audio files) that plays a four-chord
  // minor progression under the run. Tempo isn't fixed: it rises with
  // level, nudges with difficulty, and spikes when lives are critical,
  // so the music itself telegraphs rising danger.
  const BGM_PROGRESSION = [
    { bass: 110.00, chord: [220.00, 261.63, 329.63, 392.00] }, // Am
    { bass: 87.31,  chord: [174.61, 220.00, 261.63, 349.23] }, // F
    { bass: 130.81, chord: [261.63, 329.63, 392.00, 493.88] }, // C
    { bass: 98.00,  chord: [196.00, 246.94, 293.66, 392.00] }  // G
  ];
  let bgmEnabled = false, bgmTimer = null, bgmStep = 0;
  function bgmBPM(){
    const levelBoost = Math.min(level-1, 10) * 2.2;
    const urgency = (state==='playing' && lives>0 && lives<=2) ? 26 : 0;
    const diffAdj = difficulty==='hard' ? 8 : difficulty==='easy' ? -6 : 0;
    return Math.min(150, 92 + levelBoost + urgency + diffAdj);
  }
  function bgmNote(freq, dur, gain, type){
    if(!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type||'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0+dur+0.02);
  }
  function bgmTick(){
    if(!bgmEnabled || !soundOn || !audioCtx){ bgmTimer=null; return; }
    const barIndex = Math.floor(bgmStep/8) % BGM_PROGRESSION.length;
    const beatInBar = bgmStep % 8;
    const chordDef = BGM_PROGRESSION[barIndex];
    if(beatInBar===0) bgmNote(chordDef.bass, 0.5, 0.045, 'triangle');
    const tone = chordDef.chord[beatInBar % chordDef.chord.length];
    bgmNote(tone, 0.22, 0.016, 'sine');
    bgmStep++;
    const stepMs = (60000/bgmBPM())/2; // eighth notes
    bgmTimer = setTimeout(bgmTick, stepMs);
  }
  function startBGM(){
    if(bgmEnabled || !soundOn) return;
    ensureAudio();
    if(!audioCtx) return;
    bgmEnabled = true;
    bgmStep = 0;
    if(!bgmTimer) bgmTick();
  }
  function stopBGM(){
    bgmEnabled = false;
    if(bgmTimer){ clearTimeout(bgmTimer); bgmTimer=null; }
  }

  function updateSoundIcon(){
    soundBtn.innerHTML = soundOn
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16.2 8.8a5 5 0 0 1 0 6.4"/><path d="M18.8 6.2a9 9 0 0 1 0 11.6"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
    soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Unmute sound');
  }
  soundBtn.addEventListener('click', ()=>{
    soundOn = !soundOn;
    try{ localStorage.setItem('cn_typing_sound', soundOn ? 'on':'off'); }catch(e){}
    updateSoundIcon();
    if(soundOn){
      ensureAudio(); playSound('key');
      if(state==='playing') startBGM();
    } else {
      stopBGM();
    }
  });
  updateSoundIcon();

  // ---------- Small helpers ----------
  function retrigger(el, cls){
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function pulsePill(el){ if(!reduceMotion) retrigger(el,'pulse'); }

  let toastTimer=null;
  function showToast(text, variant){
    toastEl.textContent = text;
    toastEl.classList.remove('combo-toast');
    if(variant) toastEl.classList.add(variant);
    retrigger(toastEl,'show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>toastEl.classList.remove('show'), 1400);
  }

  // ---------- Word bank helpers ----------
  function pickWordText(excludeSet){
    const bankSet = LANGUAGE_BANKS[activeLanguage] || WORD_BANK;
    let keys = LENGTH_KEYS.filter(k=>activeFilters.has(k) && bankSet[k] && bankSet[k].length);
    if(!keys.length) keys = LENGTH_KEYS.filter(k=>bankSet[k] && bankSet[k].length);
    const pool = keys.length ? keys : ['4'];
    let text, tries=0;
    do{
      const k = pool[Math.floor(Math.random()*pool.length)];
      const bank = (bankSet[k] && bankSet[k].length) ? bankSet[k] : WORD_BANK[k];
      text = bank[Math.floor(Math.random()*bank.length)];
      tries++;
    } while(excludeSet.has(text) && tries<8);
    return text;
  }

  function setLanguage(l){
    if(activeLanguage===l) return;
    activeLanguage = l;
    try{ localStorage.setItem('cn_typing_language', l); }catch(e){}
    openModal(currentModalKind);
  }

  // ---------- Continuous spawn pacing ----------
  // Words now trickle in one at a time on a shrinking timer instead of a
  // whole level dropping in at once. The interval shrinks smoothly with
  // both elapsed play time (the run as a whole gets busier) and how far
  // through the current level you are (each level ramps up toward its
  // own end too), rather than jumping in flat per-level steps.
  function currentSpawnInterval(){
    const minutesIn = elapsedPlayMs/60000;
    const globalRamp = Math.max(0.32, 1.25 - minutesIn*0.10);
    const levelFrac = totalThisLevel>0 ? spawnedThisLevel/totalThisLevel : 0;
    const levelRamp = Math.max(0.5, 1 - levelFrac*0.35);
    const adj = difficulty==='hard' ? 0.85 : difficulty==='easy' ? 1.15 : 1;
    return Math.max(0.28, globalRamp*levelRamp*adj) + Math.random()*0.12;
  }

  function pickSpawnLane(laneCount){
    if(laneCount<=1) return 0;
    let lane = Math.floor(Math.random()*laneCount);
    if(lane===lastSpawnLane && Math.random()<0.7){
      lane = (lane+1+Math.floor(Math.random()*(laneCount-1))) % laneCount;
    }
    lastSpawnLane = lane;
    return lane;
  }

  function spawnOneWord(){
    const laneCount = Math.max(1, Math.min(level, Math.floor((STAGE_H-40)/54)) || 1);
    const laneH = (STAGE_H-40)/laneCount;
    const lane = pickSpawnLane(laneCount);
    const speedCap = Math.max(1, Math.min(level + difficultySpeedAdj(), 5));
    const speed = 1 + Math.floor(Math.random()*speedCap);
    const active = new Set(words.map(w=>w.text));
    const text = pickWordText(active);
    const y = 26 + lane*laneH + Math.random()*Math.max(laneH-32,4) + 14;
    const x = STAGE_W + 40 + Math.random()*80;
    const word = {text, renderText:text, speed, x, y, special:null, isBoss:false};

    const hasBossOnScreen = words.some(w=>w.isBoss);
    if(level>=3 && !hasBossOnScreen && Math.random()<0.16){
      const snippet = BOSS_SNIPPETS[Math.floor(Math.random()*BOSS_SNIPPETS.length)];
      word.text = snippet.toLowerCase();
      word.renderText = snippet;
      word.isBoss = true;
      word.speed = 0.55;
    } else if(level>=2 && Math.random()<0.30){
      word.special = rollSpecial();
    }

    const tColor = word.isBoss ? '176,132,255'
      : word.speed<=1 ? '16,185,129' : word.speed===2 ? '252,211,77' : '255,59,92';
    spawnTelegraph(word.y, tColor);

    words.push(word);
    spawnedThisLevel++;
  }

  function beginLevel(){
    laneUsed = {};
    totalThisLevel = level;
    spawnedThisLevel = 0;
    spawnTimer = 0.2;
    emptyHint.classList.add('hidden');
  }

  // ---------- Particles / floaters ----------
  function spawnParticles(x,y,big){
    if(reduceMotion) return;
    const n = big ? 22 : 13;
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const sp = (big?90:55) + Math.random()*(big?200:150);
      // Roughly a third of the burst renders as small glowing shard
      // rectangles (a "word breaking apart" look); the rest stay as
      // soft spark dots so the explosion doesn't feel uniform.
      const isShard = Math.random() < 0.35;
      particles.push({
        x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-30,
        life:.45+Math.random()*.35, maxLife:.8,
        size:(big?3:2)+Math.random()*3,
        color: big ? '252,211,77' : (Math.random()<.5?'16,185,129':'108,92,231'),
        shape: isShard ? 'shard' : 'dot',
        rot: Math.random()*Math.PI*2,
        vrot: (Math.random()-0.5)*14
      });
    }
  }
  function spawnFloat(x,y,text,color){
    floaters.push({x,y,text,color,life:.9,maxLife:.9});
  }

  // ---------- Scoring ----------
  function currentWPM(){
    const minutes = elapsedPlayMs/60000;
    if(minutes<=0) return 0;
    return Math.round((correctChars/5)/minutes);
  }
  function currentAccuracy(){
    return attempts ? Math.round((correctHits/attempts)*100) : 100;
  }

  function basePoints(w){
    return Math.round(w.speed * w.text.length * 10 * (w.text.length/4) * (1 + Math.min(combo,10)*0.05) * difficultyScoreMult());
  }

  function hitWord(w){
    const tw = wordWidth(w.renderText||w.text);
    const prevCombo = combo;
    combo++;
    correctChars += w.text.length;
    correctHits++;

    if(w.isBoss){
      const pts = Math.round((500 + w.text.length*12) * difficultyScoreMult());
      score += pts;
      spawnParticles(w.x+tw/2, w.y, true);
      spawnFloat(w.x+tw/2, w.y, 'BOSS CLEARED +'+pts, '#fcd34d');
      playSound('bonus');
      if(!reduceMotion) retrigger(flashEl,'hit-green');
      updateComboFx(prevCombo);
      return;
    }

    let pts = basePoints(w);
    if(w.special === 'bonus'){
      pts += 250;
      score += pts;
      spawnParticles(w.x+tw/2, w.y, true);
      spawnFloat(w.x+tw/2, w.y, 'BONUS +'+pts, '#fcd34d');
      playSound('bonus');
    } else if(w.special === 'life'){
      score += pts;
      spawnParticles(w.x+tw/2, w.y, true);
      if(lives<9){
        lives++;
        spawnFloat(w.x+tw/2, w.y, '+1 LIFE', '#ff6b8a');
        playSound('lifeUp');
        pulsePill(pillLives);
      } else {
        score += 250;
        spawnFloat(w.x+tw/2, w.y, 'BONUS +'+(pts+250), '#fcd34d');
        playSound('bonus');
      }
    } else if(w.special === 'slow'){
      score += pts;
      spawnParticles(w.x+tw/2, w.y, true);
      slowUntil = performance.now() + SLOW_DURATION;
      spawnFloat(w.x+tw/2, w.y, 'SLOW-MO', '#22d3ee');
      playSound('slow');
    } else if(w.special === 'shield'){
      score += pts;
      spawnParticles(w.x+tw/2, w.y, true);
      shieldCharges = Math.min(3, shieldCharges+1);
      spawnFloat(w.x+tw/2, w.y, 'SHIELD +1', '#10b981');
      playSound('shield');
      updateStatsUI();
    } else if(w.special === 'freeze'){
      score += pts;
      spawnParticles(w.x+tw/2, w.y, true);
      freezeUntil = performance.now() + FREEZE_DURATION;
      spawnFloat(w.x+tw/2, w.y, 'TIME FREEZE', '#a78bfa');
      playSound('freeze');
      if(!reduceMotion) retrigger(stage,'shake');
    } else {
      score += pts;
      spawnParticles(w.x+tw/2, w.y, false);
      const label = combo>=3 ? ('+'+pts+'  '+combo+'\u00d7') : ('+'+pts);
      spawnFloat(w.x+tw/2, w.y, label, combo>=3?'#fcd34d':'#10b981');
    }
    updateComboFx(prevCombo);
  }

  function triggerBomb(bombWords){
    bombWords.forEach(hitWord);
    const rest = words.filter(w=>bombWords.indexOf(w)===-1);
    rest.forEach(w=>{
      const tw = wordWidth(w.renderText||w.text);
      score += Math.round(w.speed*w.text.length*6*difficultyScoreMult());
      spawnParticles(w.x+tw/2, w.y, true);
    });
    words = [];
    playSound('bomb');
    spawnFloat(STAGE_W/2, STAGE_H/2, 'BOARD CLEARED', '#ff3b5c');
    if(!reduceMotion) retrigger(stage,'shake');
  }

  function submitTyped(){
    const t = typed.trim();
    if(!t) return;
    attempts++;
    const matches = words.filter(w=>w.text===t);
    if(matches.length){
      const bombs = matches.filter(w=>w.special==='bomb');
      if(bombs.length){
        triggerBomb(bombs);
      } else {
        matches.forEach(hitWord);
        words = words.filter(w=>w.text!==t);
        playSound('hit');
      }
    } else {
      const prevCombo = combo;
      combo = 0;
      updateComboFx(prevCombo);
      playSound('miss');
      retrigger(input,'shake');
    }
    typed=''; input.value='';
    updateInputOverlay();
    updateStatsUI();
  }

  // ---------- Combo visual feedback ----------
  function comboBurst(el){
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    for(let i=0;i<8;i++){
      const s = document.createElement('span');
      s.className = 'combo-spark';
      const ang = (Math.PI*2/8)*i + Math.random()*0.4;
      const dist = 28 + Math.random()*22;
      s.style.left = cx+'px'; s.style.top = cy+'px';
      s.style.setProperty('--dx', Math.cos(ang)*dist+'px');
      s.style.setProperty('--dy', Math.sin(ang)*dist+'px');
      document.body.appendChild(s);
      setTimeout(()=>s.remove(), 650);
    }
  }

  function updateComboFx(prevCombo){
    valCombo.textContent = combo + '\u00d7';
    if(combo > prevCombo) pulsePill(pillCombo);
    const h = Math.min(combo,20)/20*100;
    comboFireEl.style.height = combo>0 ? h+'%' : '0%';
    if(combo>=3) input.classList.add('combo-glow'); else input.classList.remove('combo-glow');
    if(combo>0 && combo%5===0 && combo>prevCombo){
      showToast(combo+'\u00d7 COMBO!', 'combo-toast');
    }
    // Bigger celebration at the headline thresholds
    if(combo>prevCombo && (combo===5 || combo===10 || combo===20) && !reduceMotion){
      retrigger(pillCombo,'milestone');
      comboBurst(pillCombo);
    }
  }

  function loseLife(){
    lives--;
    playSound('life');
    if(!reduceMotion){ retrigger(stage,'shake'); retrigger(flashEl,'hit-red'); }
    pulsePill(pillLives);
    updateStatsUI();
    if(lives<=0){ lives=0; updateStatsUI(); endGame(); }
  }

  // ---------- Update / Draw ----------
  function update(dt){
    elapsedPlayMs += dt*1000;
    const now = performance.now();
    const frozen = now < freezeUntil;
    const speedMult = frozen ? 0 : (now < slowUntil ? SLOW_FACTOR : 1);

    if(!frozen){
      spawnTimer -= dt;
      if(spawnTimer<=0 && spawnedThisLevel<totalThisLevel){
        spawnOneWord();
        spawnTimer = currentSpawnInterval();
      }
    }

    for(let i=words.length-1;i>=0;i--){
      const w = words[i];
      w.x -= w.speed * SPEED_UNIT * speedMult * dt;
      const tw = wordWidth(w.renderText||w.text);
      if(w.x + tw < DANGER_X){
        words.splice(i,1);
        if(shieldCharges>0){
          shieldCharges--;
          spawnFloat(DANGER_X+50, w.y, 'SHIELD BLOCKED', '#10b981');
          playSound('shield');
          if(!reduceMotion) retrigger(flashEl,'hit-green');
          updateStatsUI();
        } else {
          loseLife();
        }
        if(state!=='playing') return;
      }
    }
    if(words.length===0 && spawnedThisLevel>=totalThisLevel){
      level++;
      beginLevel();
      showToast('LEVEL ' + level);
      playSound('level');
      pulsePill(pillLevel);
      if(!reduceMotion) retrigger(flashEl,'hit-green');
    }
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=240*dt; p.life-=dt;
      if(p.vrot) p.rot += p.vrot*dt;
      if(p.life<=0) particles.splice(i,1);
    }
    for(let i=floaters.length-1;i>=0;i--){
      const f=floaters[i];
      f.y -= 34*dt; f.life -= dt;
      if(f.life<=0) floaters.splice(i,1);
    }
    uiThrottle += dt;
    if(uiThrottle > 0.2){ uiThrottle = 0; updateStatsUI(); }
    updateTelegraphs(dt);
  }

  function speedColor(s){
    if(s<=1) return '#d7ddff';
    if(s===2) return '#8ecbff';
    if(s===3) return '#fcd34d';
    return '#ff3b5c';
  }
  function speedDot(s){
    if(s<=1) return '#10b981';
    if(s===2) return '#fcd34d';
    return '#ff3b5c';
  }
  function specialColor(type){
    if(type==='bonus') return '#fcd34d';
    if(type==='life') return '#ff6b8a';
    if(type==='bomb') return '#ff3b5c';
    if(type==='slow') return '#22d3ee';
    if(type==='shield') return '#10b981';
    if(type==='freeze') return '#a78bfa';
    return null;
  }
  function specialLabel(type){
    if(type==='bonus') return 'BONUS';
    if(type==='life') return '+LIFE';
    if(type==='bomb') return 'BOMB';
    if(type==='slow') return 'SLOW';
    if(type==='shield') return 'SHIELD';
    if(type==='freeze') return 'FREEZE';
    return '';
  }

  // Boss/code-block words now require exact symbol-for-symbol typing, so
  // w.text (what's matched) and w.renderText (what's drawn) share the
  // same characters — just case may differ. That means we can highlight
  // the matched prefix directly on the real punctuated text, the same
  // clip-highlight trick used for normal words, instead of a separate
  // fraction bar that didn't show you which character was next.
  function drawBossWord(w){
    setWordFont();
    const tw = ctx.measureText(w.renderText).width;
    const tint = '#b084ff';
    const boxX = w.x-14, boxY = w.y-19, boxW = tw+28, boxH = 38;

    const trailLen = 26;
    const grad = ctx.createLinearGradient(w.x+tw, w.y, w.x+tw+trailLen, w.y);
    grad.addColorStop(0, tint+'55'); grad.addColorStop(1, tint+'00');
    ctx.fillStyle = grad;
    ctx.fillRect(boxX, boxY, boxW+trailLen, boxH);

    ctx.fillStyle = 'rgba(176,132,255,0.10)';
    roundRectPath(ctx, boxX, boxY, boxW, boxH, 10);
    ctx.fill();
    ctx.save();
    const pulse = 0.5+0.5*Math.sin(performance.now()/260);
    ctx.strokeStyle = tint;
    ctx.globalAlpha = 0.6+pulse*0.35;
    ctx.lineWidth = 1.8;
    roundRectPath(ctx, boxX, boxY, boxW, boxH, 10);
    ctx.stroke();
    ctx.restore();

    // little "code editor" dots for flavor
    ['#ff5f56','#ffbd2e','#27c93f'].forEach((c,i)=>{
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(boxX+10+i*9, boxY+8, 2.6, 0, Math.PI*2); ctx.fill();
    });

    setWordFont();
    ctx.fillStyle = tint;
    ctx.fillText(w.renderText, w.x, w.y+4);

    ctx.save();
    ctx.font = '800 10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = tint;
    ctx.textAlign = 'center';
    ctx.fillText('BOSS BLOCK', w.x+tw/2, boxY-9);
    ctx.textAlign = 'left';
    ctx.restore();

    const matchLen = (typed && w.text.indexOf(typed)===0) ? typed.length : 0;
    if(matchLen>0){
      const matchedText = w.renderText.slice(0, matchLen);
      const mw = ctx.measureText(matchedText).width;
      ctx.save();
      ctx.beginPath();
      ctx.rect(w.x-2, w.y-17, mw+4, 34);
      ctx.clip();
      ctx.shadowColor = '#50fa7b';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#50fa7b';
      setWordFont();
      ctx.fillText(w.renderText, w.x, w.y+4);
      ctx.restore();
    }

    const frac = w.text.length ? matchLen/w.text.length : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(boxX, boxY+boxH-4, boxW, 3);
    if(frac>0){
      ctx.fillStyle = '#50fa7b';
      ctx.fillRect(boxX, boxY+boxH-4, boxW*frac, 3);
    }
  }

  function draw(){
    const now = performance.now();
    ctx.clearRect(0,0,STAGE_W,STAGE_H);
    if(STAGE_W<=0||STAGE_H<=0) return;

    // Layer order: matrix → orbs → grid → streaks → lane lines → telegraphs → words → danger line
    drawMatrix();
    drawOrbs(now);
    drawGrid();
    drawStreaks();

    // Subtle lane lines (softer than before, grid takes visual priority)
    ctx.strokeStyle = 'rgba(255,255,255,0.028)';
    ctx.lineWidth = 1;
    for(let y=44; y<STAGE_H; y+=54){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(STAGE_W,y); ctx.stroke();
    }

    drawTelegraphs();

    words.forEach(w=>{
      if(w.isBoss){ drawBossWord(w); return; }

      setWordFont();
      const tw = ctx.measureText(w.renderText).width;
      const tint = w.special ? specialColor(w.special) : speedColor(w.speed);

      const trailLen = 16 + w.speed*18;
      const grad = ctx.createLinearGradient(w.x+tw, w.y, w.x+tw+trailLen, w.y);
      grad.addColorStop(0, tint+'66');
      grad.addColorStop(1, tint+'00');
      ctx.fillStyle = grad;
      ctx.fillRect(w.x, w.y-13, tw+trailLen, 26);

      ctx.fillStyle = 'rgba(255,255,255,0.055)';
      roundRectPath(ctx, w.x-10, w.y-17, tw+22, 34, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      roundRectPath(ctx, w.x-10, w.y-17, tw+22, 34, 9);
      ctx.stroke();

      setWordFont();
      ctx.fillStyle = tint;
      ctx.fillText(w.renderText, w.x, w.y);

      if(typed && w.text.indexOf(typed)===0){
        const mw = ctx.measureText(typed).width;
        ctx.save();
        ctx.beginPath();
        ctx.rect(w.x-2, w.y-17, mw+4, 34);
        ctx.clip();
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#10b981';
        setWordFont();
        ctx.fillText(w.renderText, w.x, w.y);
        ctx.restore();
      }

      ctx.fillStyle = speedDot(w.speed);
      ctx.beginPath();
      ctx.arc(w.x-19, w.y, 3.6, 0, Math.PI*2);
      ctx.fill();

      if(w.special){
        const sc = specialColor(w.special);
        const pulse = 0.5+0.5*Math.sin(performance.now()/220);
        ctx.save();
        ctx.strokeStyle = sc;
        ctx.globalAlpha = 0.5+pulse*0.4;
        ctx.lineWidth = 1.6;
        roundRectPath(ctx, w.x-13, w.y-20, tw+28, 40, 11);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.font = '800 10.5px "JetBrains Mono", monospace';
        ctx.fillStyle = sc;
        ctx.textAlign='center';
        ctx.fillText(specialLabel(w.special), w.x+tw/2, w.y-27);
        ctx.textAlign='left';
        ctx.restore();
      }
    });

    ctx.textBaseline = 'middle';
    particles.forEach(p=>{
      ctx.globalAlpha = Math.max(p.life/p.maxLife,0);
      if(p.shape==='shard'){
        ctx.save();
        ctx.translate(p.x,p.y);
        ctx.rotate(p.rot||0);
        ctx.shadowColor = 'rgb('+p.color+')';
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgb('+p.color+')';
        const w = p.size*2.4, h = p.size*0.9;
        ctx.fillRect(-w/2,-h/2,w,h);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgb('+p.color+')';
        ctx.beginPath();
        ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    floaters.forEach(f=>{
      ctx.globalAlpha = Math.max(f.life/f.maxLife,0);
      ctx.font = '700 14px "JetBrains Mono", monospace';
      ctx.fillStyle = f.color;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.textAlign = 'left';
    });
    ctx.globalAlpha = 1;

    // CodeNest </> watermark — faint, centered
    ctx.save();
    ctx.font = '900 128px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(108,92,231,0.028)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('</>', STAGE_W/2, STAGE_H/2);
    ctx.restore();

    // Neon danger laser line drawn on top of everything
    if(state==='playing' || state==='paused') drawDangerLine(now);
  }

  function updateDangerGlow(){
    let minDist = Infinity;
    words.forEach(w=>{ const d = w.x - DANGER_X; if(d<minDist) minDist=d; });
    const t = Math.max(0, Math.min(1, 1 - minDist/300));
    dangerZone.style.opacity = state==='playing' ? (0.15 + t*0.7).toFixed(2) : 0.12;
    if(state==='playing' && t>0.62) dangerZone.classList.add('critical');
    else dangerZone.classList.remove('critical');
  }

  function updatePowerupIndicator(now){
    const slowActive = now < slowUntil;
    const freezeActive = now < freezeUntil;
    const anyActive = slowActive || freezeActive || shieldCharges>0;

    if(!anyActive){
      if(powerupIndicator.firstElementChild) powerupIndicator.innerHTML = '';
      return;
    }

    let html = '';
    if(freezeActive) html += '<div class="powerup-active pu-freeze"><span>\u2744 FREEZE</span><div class="pu-bar"><div class="pu-fill" id="puFillFreeze"></div></div></div>';
    if(slowActive)   html += '<div class="powerup-active"><span>\u23F1 SLOW-MO</span><div class="pu-bar"><div class="pu-fill" id="puFillSlow"></div></div></div>';
    if(shieldCharges>0) html += '<div class="powerup-active pu-shield"><span>\u{1F6E1} SHIELD \u00d7'+shieldCharges+'</span></div>';

    if(powerupIndicator.dataset.sig !== html.length+':'+freezeActive+':'+slowActive+':'+shieldCharges){
      powerupIndicator.innerHTML = html;
      powerupIndicator.dataset.sig = html.length+':'+freezeActive+':'+slowActive+':'+shieldCharges;
    }
    const freezeFill = document.getElementById('puFillFreeze');
    if(freezeFill) freezeFill.style.width = (Math.max(0,Math.min(1,(freezeUntil-now)/FREEZE_DURATION))*100)+'%';
    const slowFill = document.getElementById('puFillSlow');
    if(slowFill) slowFill.style.width = (Math.max(0,Math.min(1,(slowUntil-now)/SLOW_DURATION))*100)+'%';
  }

  // ---------- Main loop ----------
  let lastTs = null;
  function loop(ts){
    requestAnimationFrame(loop);
    if(lastTs==null) lastTs = ts;
    let dt = (ts-lastTs)/1000;
    lastTs = ts;
    dt = Math.min(dt, 0.05);
    updateStreaks(dt);
    updateGrid(dt);
    updateMatrix(dt);
    if(state==='playing') update(dt);
    draw();
    updateDangerGlow();
    updatePowerupIndicator(performance.now());
  }
  requestAnimationFrame(loop);

  // ---------- Stats UI ----------
  function updateStatsUI(){
    if(valScore.textContent !== String(score)){ valScore.textContent = score; pulsePill(pillScore); }
    valLevel.textContent = level;
    valLives.textContent = lives>0 ? '\u2665'.repeat(lives) : '\u2014';
    valWpm.textContent = currentWPM();
    const accNow = currentAccuracy();
    const accText = accNow + '%';
    if(valAcc.textContent !== accText){ valAcc.textContent = accText; pulsePill(pillAcc); }
    valCombo.textContent = combo + '\u00d7';
    valBest.textContent = best;

    if(state==='playing' && lives>0 && lives<=2) stage.classList.add('low-health');
    else stage.classList.remove('low-health');
  }

  // ---------- Countdown ----------
  function runCountdown(cb){
    const seq = ['3','2','1','GO!'];
    let i=0;
    countdownOverlay.classList.add('show');
    function step(){
      countdownNum.textContent = seq[i];
      if(!reduceMotion) retrigger(countdownNum,'pop');
      playSound(i<3 ? 'tick' : 'go');
      i++;
      if(i<seq.length){ setTimeout(step, 550); }
      else { setTimeout(()=>{ countdownOverlay.classList.remove('show'); cb(); }, 500); }
    }
    step();
  }

  // ---------- Game flow ----------
  function resetStats(){
    score=0; level=1; lives=difficultyLives(); words=[]; particles=[]; floaters=[];
    attempts=0; correctHits=0; correctChars=0; combo=0; elapsedPlayMs=0;
    typed=''; input.value=''; slowUntil=0; freezeUntil=0; shieldCharges=0;
    spawnedThisLevel=0; totalThisLevel=0; spawnTimer=0; lastSpawnLane=-1;
    updateComboFx(0);
  }
  function beginRace(){
    ensureAudio();
    resetStats();
    closeModal();
    resize();
    updateStatsUI();
    state='countdown';
    input.disabled=true;
    setPauseButton();
    runCountdown(()=>{
      state='playing';
      input.disabled=false;
      beginLevel();
      updateStatsUI();
      startBGM();
      setTimeout(()=>input.focus(), 60);
    });
  }
  function pauseGame(){
    if(state!=='playing') return;
    state='paused';
    input.disabled=true;
    setPauseButton();
    stopBGM();
    openModal('paused');
  }
  function resumeGame(){
    if(state!=='paused') return;
    state='playing';
    input.disabled=false;
    setPauseButton();
    closeModal();
    startBGM();
    setTimeout(()=>input.focus(), 60);
  }
  function endGame(){
    state='gameover';
    input.disabled=true;
    stopBGM();
    const wpmThisRun = currentWPM();
    const runTs = Date.now();
    lastRunScore = score;
    lastRunTs = runTs;
    const prevBest = best;
    lastRunWasNewBest = score>0 && score>best;
    if(lastRunWasNewBest){
      best=score;
      try{ localStorage.setItem('cn_typing_best', String(best)); }catch(e){}
    }
    if(score>0) addToLeaderboard({score, level, wpm:wpmThisRun, accuracy:currentAccuracy(), ts:runTs});

    // A theme may have just become reachable with this run's score —
    // no action needed since unlock state is checked live against `best`,
    // but flag it so the gameover modal can call it out.
    lastRunUnlockedThemes = THEMES.filter(t=>t.unlockScore>prevBest && t.unlockScore<=best);

    statsTotalRaces += 1;
    statsTotalAttempts += attempts;
    statsTotalCorrect += correctHits;
    if(wpmThisRun > statsBestWpm) statsBestWpm = wpmThisRun;
    try{
      localStorage.setItem('cn_typing_races', String(statsTotalRaces));
      localStorage.setItem('cn_typing_totalattempts', String(statsTotalAttempts));
      localStorage.setItem('cn_typing_totalcorrect', String(statsTotalCorrect));
      localStorage.setItem('cn_typing_bestwpm', String(statsBestWpm));
    }catch(e){}

    stage.classList.remove('low-health');
    updateStatsUI();
    playSound('over');
    if(lastRunWasNewBest) setTimeout(()=>playSound('bonus'), 350);
    openModal('gameover');
  }
  function setPauseButton(){
    if(state==='playing'){
      pauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
      pauseLabel.textContent = 'Pause';
    } else {
      pauseIcon.innerHTML = '<path d="M7 4l13 8-13 8z"/>';
      pauseLabel.textContent = 'Play';
    }
  }

  // ---------- Modal ----------
  function filterSection(){
    const chips = LENGTH_KEYS.map(k=>{
      const on = activeFilters.has(k);
      const label = k==='9' ? '9+' : k;
      return '<button type="button" class="chip'+(on?' active':'')+'" data-action="toggle-filter" data-len="'+k+'">'+label+'</button>';
    }).join('');
    return '<div class="filter-section"><div class="filter-label">Word length</div><div class="chip-row">'+chips+'</div></div>';
  }

  function languageSection(){
    const chips = LANGUAGE_ORDER.map(k=>{
      const on = activeLanguage===k;
      return '<button type="button" class="chip'+(on?' active':'')+'" data-action="set-language" data-lang="'+k+'">'+LANGUAGE_LABELS[k]+'</button>';
    }).join('');
    return '<div class="filter-section"><div class="filter-label">Snippet language</div><div class="chip-row">'+chips+'</div></div>';
  }

  function statsDashboard(){
    if(!statsTotalRaces) return '';
    return '<div class="modal-stats-grid">'
      + '<div><span>Best WPM</span><strong>'+statsBestWpm+'</strong></div>'
      + '<div><span>Accuracy</span><strong>'+statsLifetimeAccuracy()+'%</strong></div>'
      + '<div><span>Races run</span><strong>'+statsTotalRaces+'</strong></div>'
      + '<div><span>Best score</span><strong>'+best+'</strong></div>'
      + '</div>';
  }

  // ---------- Tutorial demo (start screen only) ----------
  const TUTORIAL_WORDS = ['async','fetch','const','print','commit','render'];
  let tutorialWordText = TUTORIAL_WORDS[Math.floor(Math.random()*TUTORIAL_WORDS.length)];
  function tutorialSection(){
    return '<div class="tutorial-box">'
      + '<div class="filter-label">Try it — type the word below</div>'
      + '<div class="tutorial-row">'
      +   '<span class="tutorial-word" id="tutorialWord">'+tutorialWordText+'</span>'
      +   '<input type="text" id="tutorialInput" class="tutorial-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="type here…" aria-label="Practice word — no pressure, this does not count toward your score">'
      +   '<span class="tutorial-check" id="tutorialCheck"></span>'
      + '</div>'
      + '</div>';
  }
  function handleTutorialInput(el){
    const v = el.value.toLowerCase().replace(/[^a-z]/g,'');
    el.value = v;
    const wordEl  = document.getElementById('tutorialWord');
    const checkEl = document.getElementById('tutorialCheck');
    if(!wordEl) return;
    let html = '';
    for(let i=0;i<tutorialWordText.length;i++){
      let cls = 'tw-pending';
      if(i<v.length) cls = (v[i]===tutorialWordText[i]) ? 'tw-correct' : 'tw-wrong';
      html += '<span class="'+cls+'">'+tutorialWordText[i]+'</span>';
    }
    wordEl.innerHTML = html;
    if(v===tutorialWordText){
      if(checkEl) checkEl.textContent = 'Nice — that\u2019s exactly how it works!';
      el.value = '';
      setTimeout(()=>{
        tutorialWordText = TUTORIAL_WORDS[Math.floor(Math.random()*TUTORIAL_WORDS.length)];
        const freshWordEl = document.getElementById('tutorialWord');
        if(freshWordEl) freshWordEl.textContent = tutorialWordText;
        if(checkEl) checkEl.textContent = '';
      }, 900);
    } else if(checkEl){
      checkEl.textContent = '';
    }
  }

  function difficultySection(){
    const diffs = [
      {k:'easy',   label:'Easy',   desc:'Slower · +1 life'},
      {k:'normal', label:'Normal', desc:'Standard pace'},
      {k:'hard',   label:'Hard',   desc:'Faster · fewer lives'}
    ];
    const chips = diffs.map(d=>{
      const on = difficulty===d.k;
      return '<button type="button" class="diff-chip'+(on?' active '+d.k:'')+'" data-action="set-difficulty" data-diff="'+d.k+'">'
        + '<span class="diff-label">'+d.label+'</span><span class="diff-desc">'+d.desc+'</span></button>';
    }).join('');
    return '<div class="difficulty-section"><div class="filter-label">Difficulty</div><div class="difficulty-row">'+chips+'</div></div>';
  }

  function keySoundSection(){
    const chips = KEY_SOUND_STYLES.map(s=>{
      const on = keySoundStyle===s.key;
      return '<button type="button" class="diff-chip'+(on?' active normal':'')+'" data-action="set-keysound" data-keysound="'+s.key+'">'
        + '<span class="diff-label">'+s.label+'</span><span class="diff-desc">'+s.desc+'</span></button>';
    }).join('');
    return '<div class="difficulty-section"><div class="filter-label">Keyboard sound</div><div class="difficulty-row">'+chips+'</div></div>';
  }

  function powerupLegend(){
    const rows = [
      ['#fcd34d','Gold ring','bonus points'],
      ['#ff6b8a','Pink ring','an extra life'],
      ['#ff3b5c','Red ring','clears every word on screen'],
      ['#22d3ee','Cyan ring','slows every word down for a few seconds'],
      ['#10b981','Green ring','a shield — blocks the next word that reaches the line'],
      ['#a78bfa','Violet ring','freezes every word in place for 3 seconds'],
      ['#b084ff','Purple code block','a slow-moving boss snippet — type it exactly, symbols included, for a big bonus']
    ];
    const html = rows.map(r=>
      '<div class="pl-row"><span class="pl-dot" style="background:'+r[0]+';color:'+r[0]+';"></span><b>'+r[1]+'</b>&nbsp;— '+r[2]+'</div>'
    ).join('');
    return '<div class="powerup-legend">'+html+'</div>';
  }

  function themeSection(){
    const chips = THEMES.map(t=>{
      const unlocked = isThemeUnlocked(t);
      const on = activeTheme===t.key;
      const dots = t.swatch.map(c=>'<span class="theme-dot" style="background:'+c+'"></span>').join('');
      const lock = unlocked ? '' : '<span class="theme-lock">\u{1F512} '+t.unlockScore+'</span>';
      return '<button type="button" class="theme-chip'+(on?' active':'')+(unlocked?'':' locked')+'" data-action="set-theme" data-theme="'+t.key+'">'
        + '<span class="theme-dots">'+dots+'</span><span class="theme-name">'+t.label+'</span>'+lock
        + '</button>';
    }).join('');
    return '<div class="filter-section"><div class="filter-label">Theme</div><div class="theme-row">'+chips+'</div></div>';
  }

  function leaderboardHTML(){
    const all = loadLeaderboard();
    if(!all.length) return '';
    const filtered = leaderboardPeriodFilter(all, lbPeriod);
    const rows5 = leaderboardSorted(filtered, lbSort).slice(0,5);

    const periods = [['all','All-time'],['weekly','Weekly'],['daily','Daily']];
    const periodChips = periods.map(([k,label])=>
      '<button type="button" class="chip mini'+(lbPeriod===k?' active':'')+'" data-action="lb-period" data-period="'+k+'">'+label+'</button>'
    ).join('');
    const metrics = [['score','Score'],['wpm','WPM']];
    const metricChips = metrics.map(([k,label])=>
      '<button type="button" class="chip mini'+(lbSort===k?' active':'')+'" data-action="lb-sort" data-metric="'+k+'">'+label+'</button>'
    ).join('');

    const rowsHtml = rows5.length ? rows5.map((e,i)=>{
      const isThis = lastRunTs!==null && e.ts===lastRunTs;
      return '<div class="lb-row'+(isThis?' lb-current':'')+'">'
        + '<span class="lb-rank">#'+(i+1)+'</span>'
        + '<span class="lb-score">'+e.score+'</span>'
        + '<span class="lb-wpm">'+(e.wpm||0)+' wpm</span>'
        + '<span class="lb-level">Lv '+e.level+'</span>'
        + '</div>';
    }).join('') : '<div class="lb-empty">No runs in this period yet</div>';

    return '<div class="leaderboard"><div class="filter-label">Your top runs</div>'
      + '<div class="lb-toggle-row"><div class="chip-row">'+periodChips+'</div><div class="chip-row">'+metricChips+'</div></div>'
      + rowsHtml
      + '<p class="lb-note">Stored on this device only \u2014 there\u2019s no cross-device/global board yet.</p>'
      + '</div>';
  }

  function modalTemplate(kind){
    if(kind==='start'){
      return ''
        + '<div class="modal-eyebrow">Typing Racer</div>'
        + '<h2>Ready to race?</h2>'
        + '<p class="modal-copy">Words fly in from the right. Type each one exactly, then hit <strong>Enter</strong> or <strong>Space</strong> before it crosses the red line.</p>'
        + statsDashboard()
        + tutorialSection()
        + powerupLegend()
        + difficultySection()
        + languageSection()
        + themeSection()
        + keySoundSection()
        + filterSection()
        + leaderboardHTML()
        + '<div class="modal-actions"><button type="button" class="btn btn-primary" data-action="play">&#9654; Start Race</button></div>'
        + '<p class="modal-hint">Esc pauses anytime &middot; Best score: <strong>'+best+'</strong></p>';
    }
    if(kind==='paused'){
      return ''
        + '<div class="modal-eyebrow">Paused</div>'
        + '<h2>Take a breath</h2>'
        + '<div class="modal-stats-row">'
        +   '<div><span>Score</span><strong>'+score+'</strong></div>'
        +   '<div><span>Level</span><strong>'+level+'</strong></div>'
        +   '<div><span>Lives</span><strong>'+(lives>0?'\u2665'.repeat(lives):'\u2014')+'</strong></div>'
        + '</div>'
        + difficultySection()
        + languageSection()
        + themeSection()
        + keySoundSection()
        + filterSection()
        + '<div class="modal-actions">'
        +   '<button type="button" class="btn btn-primary" data-action="resume">&#9654; Resume</button>'
        +   '<button type="button" class="btn btn-ghost" data-action="play">&#8635; Restart</button>'
        + '</div>'
        + '<p class="modal-hint">Esc resumes &middot; Enter or Space submits a word</p>';
    }
    // gameover
    return ''
      + '<div class="modal-eyebrow">Race over</div>'
      + (lastRunWasNewBest ? '<div class="new-best-badge">\uD83C\uDFC6 New personal best</div>' : '')
      + '<h2>'+(lastRunWasNewBest?'New best!':'Good run')+'</h2>'
      + '<div class="modal-stats-grid">'
      +   '<div><span>Score</span><strong>'+score+'</strong></div>'
      +   '<div><span>Level reached</span><strong>'+level+'</strong></div>'
      +   '<div><span>WPM</span><strong>'+currentWPM()+'</strong></div>'
      +   '<div><span>Accuracy</span><strong>'+currentAccuracy()+'%</strong></div>'
      + '</div>'
      + (lastRunUnlockedThemes.length
          ? '<div class="new-best-badge theme-unlock-badge">\u{1F3A8} New theme'+(lastRunUnlockedThemes.length>1?'s':'')+' unlocked: '+lastRunUnlockedThemes.map(t=>t.label).join(', ')+'</div>'
          : '')
      + themeSection()
      + leaderboardHTML()
      + '<div class="modal-actions"><button type="button" class="btn btn-primary" data-action="play">&#8635; Race Again</button></div>'
      + '<p class="modal-hint">Best score: <strong>'+best+'</strong></p>';
  }

  function openModal(kind){
    currentModalKind = kind;
    modalBody.innerHTML = modalTemplate(kind);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    const primary = modalBody.querySelector('.btn-primary');
    if(primary) setTimeout(()=>primary.focus(), 50);
  }
  function closeModal(){
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
  }

  function toggleFilter(key){
    if(activeFilters.has(key)){
      if(activeFilters.size>1) activeFilters.delete(key);
    } else {
      activeFilters.add(key);
    }
    openModal(currentModalKind);
  }

  function setDifficulty(d){
    if(difficulty===d) return;
    difficulty = d;
    try{ localStorage.setItem('cn_typing_difficulty', d); }catch(e){}
    openModal(currentModalKind);
  }

  modalBody.addEventListener('click', e=>{
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    const action = btn.dataset.action;
    if(action==='play') beginRace();
    else if(action==='resume') resumeGame();
    else if(action==='toggle-filter') toggleFilter(btn.dataset.len);
    else if(action==='set-difficulty') setDifficulty(btn.dataset.diff);
    else if(action==='set-keysound') setKeySoundStyle(btn.dataset.keysound);
    else if(action==='set-language') setLanguage(btn.dataset.lang);
    else if(action==='set-theme') setTheme(btn.dataset.theme);
    else if(action==='lb-period'){
      lbPeriod = btn.dataset.period;
      try{ localStorage.setItem('cn_typing_lbperiod', lbPeriod); }catch(e){}
      openModal(currentModalKind);
    }
    else if(action==='lb-sort'){
      lbSort = btn.dataset.metric;
      try{ localStorage.setItem('cn_typing_lbsort', lbSort); }catch(e){}
      openModal(currentModalKind);
    }
  });

  // Live color-coded feedback for the tutorial demo's own input,
  // delegated so it keeps working after the modal re-renders.
  modalBody.addEventListener('input', e=>{
    if(e.target && e.target.id==='tutorialInput') handleTutorialInput(e.target);
  });

  // ---------- Real-time input character coloring ----------
  function updateInputOverlay(){
    if(!inputCharOverlay) return;
    const v = typed;
    if(!v){ inputCharOverlay.innerHTML=''; return; }

    // Find the best matching word for context
    const match = words.find(w => w.text.startsWith(v));
    let html = '';
    for(let i=0;i<v.length;i++){
      const correct = match && match.text[i]===v[i];
      const cls     = correct ? 'ch-correct' : 'ch-wrong';
      const ch      = v[i] === ' ' ? '&nbsp;' : v[i];
      html += '<span class="'+cls+'">'+ch+'</span>';
    }
    // blinking cursor char
    html += '<span class="ch-active">|</span>';
    inputCharOverlay.innerHTML = html;
  }

  // ---------- Input handling ----------
  // Boss words are multi-token, punctuated code snippets ("async function
  // fetchdata()"), so unlike the plain word bank, input here isn't
  // restricted to a-z anymore — digits and symbols (parens, dots, equals
  // signs, quotes...) all need to be typeable, since boss text must match
  // the on-screen snippet exactly. Space still submits by default; it only
  // becomes a literal character when it would continue an in-flight boss
  // word's text.
  input.addEventListener('input', ()=>{
    const v = input.value.toLowerCase().replace(/\s+/g,' ').replace(/^\s/,'');
    input.value = v;
    typed = v;
    updateInputOverlay();
  });
  input.addEventListener('keydown', e=>{
    if(state!=='playing') return;
    if(e.key===' '){
      const exact = words.some(w => w.text===typed);
      if(!exact){
        const withSpace = typed + ' ';
        const continuesBoss = words.some(w => w.isBoss && w.text.indexOf(withSpace)===0 && w.text!==typed);
        if(continuesBoss){
          playSound('key');
          return; // let the space itself be typed
        }
      }
      e.preventDefault();
      submitTyped();
    } else if(e.key==='Enter'){
      e.preventDefault();
      submitTyped();
    } else if(e.key.length===1){
      // Any single printable character (letter, digit, or symbol).
      playSound('key');
    }
  });
  input.addEventListener('blur', ()=>{
    // Keep the caret in the field during play so keystrokes never get lost
    if(state==='playing'){
      setTimeout(()=>{ if(state==='playing') input.focus(); }, 10);
    }
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      if(state==='playing') pauseGame();
      else if(state==='paused') resumeGame();
    }
  });
  pauseBtn.addEventListener('click', ()=>{
    if(state==='playing') pauseGame();
    else if(state==='paused') resumeGame();
  });
  stage.addEventListener('mousedown', ()=>{ if(state==='playing') input.focus(); });

  // Auto-pause when the tab or window loses focus, so words don't
  // silently run out the clock while the player is away.
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden && state==='playing') pauseGame();
  });
  window.addEventListener('blur', ()=>{
    if(state==='playing') pauseGame();
  });

  // ---------- Init ----------
  resize();
  updateStatsUI();
  openModal('start');
})(); 
