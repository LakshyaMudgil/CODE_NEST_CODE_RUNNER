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

  const pillScore=document.getElementById('pillScore'), valScore=document.getElementById('valScore');
  const pillLevel=document.getElementById('pillLevel'), valLevel=document.getElementById('valLevel');
  const pillLives=document.getElementById('pillLives'), valLives=document.getElementById('valLives');
  const pillWpm=document.getElementById('pillWpm'), valWpm=document.getElementById('valWpm');
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

  // ---------- Persisted prefs ----------
  let best = 0, soundOn = true, difficulty = 'normal';
  try{ best = parseInt(localStorage.getItem('cn_typing_best')||'0',10) || 0; }catch(e){}
  try{ soundOn = localStorage.getItem('cn_typing_sound') !== 'off'; }catch(e){}
  try{
    const d = localStorage.getItem('cn_typing_difficulty');
    if(d==='easy' || d==='hard') difficulty = d;
  }catch(e){}

  function loadLeaderboard(){
    try{
      const raw = localStorage.getItem('cn_typing_leaderboard');
      return raw ? JSON.parse(raw) : [];
    }catch(e){ return []; }
  }
  function addToLeaderboard(finalScore, finalLevel){
    const list = loadLeaderboard();
    list.push({score:finalScore, level:finalLevel});
    list.sort((a,b)=>b.score-a.score);
    const top = list.slice(0,5);
    try{ localStorage.setItem('cn_typing_leaderboard', JSON.stringify(top)); }catch(e){}
    return top;
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
  let lastRunWasNewBest = false;
  let slowUntil = 0;

  let STAGE_W=0, STAGE_H=0;
  const DANGER_X = 66;
  const SPEED_UNIT = 58; // px/sec per speed level
  const SLOW_FACTOR = 0.42;
  const SLOW_DURATION = 6000; // ms

  // ---------- Canvas sizing ----------
  function resize(){
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    STAGE_W = rect.width; STAGE_H = rect.height;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    initStreaks();
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

  // ---------- Ambient speed-line background ----------
  let streaks = [];
  function initStreaks(){
    streaks = [];
    if(STAGE_W<=0||STAGE_H<=0) return;
    const count = Math.max(14, Math.floor(STAGE_W/70));
    for(let i=0;i<count;i++){
      streaks.push({
        x: Math.random()*STAGE_W,
        y: Math.random()*STAGE_H,
        len: 40+Math.random()*90,
        speed: 35+Math.random()*85,
        alpha: 0.025+Math.random()*0.05
      });
    }
  }
  function updateStreaks(dt){
    if(reduceMotion) return;
    streaks.forEach(s=>{
      s.x -= s.speed*dt;
      if(s.x + s.len < 0){
        s.x = STAGE_W + Math.random()*120;
        s.y = Math.random()*STAGE_H;
      }
    });
  }
  function drawStreaks(){
    ctx.save();
    streaks.forEach(s=>{
      const grad = ctx.createLinearGradient(s.x, s.y, s.x+s.len, s.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(180,190,255,'+s.alpha+')');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x+s.len, s.y);
      ctx.stroke();
    });
    ctx.restore();
  }

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
  function playSound(kind){
    if(!soundOn) return;
    ensureAudio();
    if(!audioCtx) return;
    if(kind==='key')    beep({freq:720,duration:.02,type:'square',gain:.012});
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
    if(soundOn){ ensureAudio(); playSound('key'); }
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
    const keys = LENGTH_KEYS.filter(k=>activeFilters.has(k));
    const pool = keys.length ? keys : ['4'];
    let text, tries=0;
    do{
      const k = pool[Math.floor(Math.random()*pool.length)];
      const bank = WORD_BANK[k];
      text = bank[Math.floor(Math.random()*bank.length)];
      tries++;
    } while(excludeSet.has(text) && tries<8);
    return text;
  }

  function spawnLevel(){
    const levelWords = [];
    laneUsed = {};
    const laneCount = Math.max(1, Math.min(level, Math.floor((STAGE_H-40)/54)) || 1);
    const laneH = (STAGE_H-40)/laneCount;
    const active = new Set();
    const speedCap = Math.max(1, Math.min(level + difficultySpeedAdj(), 5));
    for(let i=0;i<level;i++){
      const lane = i % laneCount;
      laneUsed[lane] = (laneUsed[lane]||0)+1;
      const speed = 1 + Math.floor(Math.random()*speedCap);
      const text = pickWordText(active);
      active.add(text);
      const y = 26 + lane*laneH + Math.random()*Math.max(laneH-32,4) + 14;
      const x = STAGE_W + 50 + Math.random()*260 + (laneUsed[lane]-1)*280;
      levelWords.push({text, speed, x, y, special:null});
    }
    // occasionally bless one word with a power-up (never on level 1 — keep the intro clean)
    if(level >= 2 && Math.random() < 0.42){
      const idx = Math.floor(Math.random()*levelWords.length);
      const r = Math.random();
      levelWords[idx].special = r<0.35 ? 'bonus' : (r<0.6 ? 'life' : (r<0.8 ? 'bomb' : 'slow'));
    }
    words = levelWords;
    emptyHint.classList.add('hidden');
  }

  // ---------- Particles / floaters ----------
  function spawnParticles(x,y,big){
    if(reduceMotion) return;
    const n = big ? 22 : 13;
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const sp = (big?90:55) + Math.random()*(big?200:150);
      particles.push({
        x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-30,
        life:.45+Math.random()*.35, maxLife:.8,
        size:(big?3:2)+Math.random()*3,
        color: big ? '252,211,77' : (Math.random()<.5?'16,185,129':'108,92,231')
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
    const tw = wordWidth(w.text);
    let pts = basePoints(w);
    const prevCombo = combo;
    combo++;
    correctChars += w.text.length;
    correctHits++;

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
      const tw = wordWidth(w.text);
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
    updateStatsUI();
  }

  // ---------- Combo visual feedback ----------
  function updateComboFx(prevCombo){
    valCombo.textContent = combo + '\u00d7';
    if(combo > prevCombo) pulsePill(pillCombo);
    const h = Math.min(combo,20)/20*100;
    comboFireEl.style.height = combo>0 ? h+'%' : '0%';
    if(combo>=3) input.classList.add('combo-glow'); else input.classList.remove('combo-glow');
    if(combo>0 && combo%5===0 && combo>prevCombo){
      showToast(combo+'\u00d7 COMBO!', 'combo-toast');
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
    const speedMult = now < slowUntil ? SLOW_FACTOR : 1;
    for(let i=words.length-1;i>=0;i--){
      const w = words[i];
      w.x -= w.speed * SPEED_UNIT * speedMult * dt;
      const tw = wordWidth(w.text);
      if(w.x + tw < DANGER_X){
        words.splice(i,1);
        loseLife();
        if(state!=='playing') return;
      }
    }
    if(words.length===0){
      level++;
      spawnLevel();
      showToast('LEVEL ' + level);
      playSound('level');
      pulsePill(pillLevel);
      if(!reduceMotion) retrigger(flashEl,'hit-green');
    }
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=240*dt; p.life-=dt;
      if(p.life<=0) particles.splice(i,1);
    }
    for(let i=floaters.length-1;i>=0;i--){
      const f=floaters[i];
      f.y -= 34*dt; f.life -= dt;
      if(f.life<=0) floaters.splice(i,1);
    }
    uiThrottle += dt;
    if(uiThrottle > 0.2){ uiThrottle = 0; updateStatsUI(); }
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
    return null;
  }
  function specialLabel(type){
    if(type==='bonus') return 'BONUS';
    if(type==='life') return '+LIFE';
    if(type==='bomb') return 'BOMB';
    if(type==='slow') return 'SLOW';
    return '';
  }

  function draw(){
    ctx.clearRect(0,0,STAGE_W,STAGE_H);
    if(STAGE_W<=0||STAGE_H<=0) return;

    drawStreaks();

    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for(let y=44; y<STAGE_H; y+=54){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(STAGE_W,y); ctx.stroke();
    }

    words.forEach(w=>{
      setWordFont();
      const tw = ctx.measureText(w.text).width;
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
      ctx.fillText(w.text, w.x, w.y);

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
        ctx.fillText(w.text, w.x, w.y);
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
      ctx.fillStyle = 'rgb('+p.color+')';
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fill();
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
    const active = now < slowUntil;
    if(active){
      if(!powerupIndicator.firstElementChild){
        powerupIndicator.innerHTML = '<div class="powerup-active"><span>\u23F1 SLOW-MO</span><div class="pu-bar"><div class="pu-fill" id="puFill"></div></div></div>';
      }
      const fillEl = document.getElementById('puFill');
      if(fillEl){
        const remain = Math.max(0, Math.min(1, (slowUntil-now)/SLOW_DURATION));
        fillEl.style.width = (remain*100)+'%';
      }
    } else if(powerupIndicator.firstElementChild){
      powerupIndicator.innerHTML = '';
    }
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
    valCombo.textContent = combo + '\u00d7';
    valBest.textContent = best;
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
    typed=''; input.value=''; slowUntil=0;
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
      spawnLevel();
      updateStatsUI();
      setTimeout(()=>input.focus(), 60);
    });
  }
  function pauseGame(){
    if(state!=='playing') return;
    state='paused';
    input.disabled=true;
    setPauseButton();
    openModal('paused');
  }
  function resumeGame(){
    if(state!=='paused') return;
    state='playing';
    input.disabled=false;
    setPauseButton();
    closeModal();
    setTimeout(()=>input.focus(), 60);
  }
  function endGame(){
    state='gameover';
    input.disabled=true;
    lastRunScore = score;
    lastRunWasNewBest = score>0 && score>best;
    if(lastRunWasNewBest){
      best=score;
      try{ localStorage.setItem('cn_typing_best', String(best)); }catch(e){}
    }
    if(score>0) addToLeaderboard(score, level);
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

  function powerupLegend(){
    const rows = [
      ['#fcd34d','Gold ring','bonus points'],
      ['#ff6b8a','Pink ring','an extra life'],
      ['#ff3b5c','Red ring','clears every word on screen'],
      ['#22d3ee','Cyan ring','slows every word down for a few seconds']
    ];
    const html = rows.map(r=>
      '<div class="pl-row"><span class="pl-dot" style="background:'+r[0]+';color:'+r[0]+';"></span><b>'+r[1]+'</b>&nbsp;— '+r[2]+'</div>'
    ).join('');
    return '<div class="powerup-legend">'+html+'</div>';
  }

  function leaderboardHTML(){
    const list = loadLeaderboard();
    if(!list.length) return '';
    const rows = list.map((e,i)=>{
      const isThis = lastRunScore!==null && e.score===lastRunScore;
      return '<div class="lb-row'+(isThis?' lb-current':'')+'"><span class="lb-rank">#'+(i+1)+'</span><span class="lb-score">'+e.score+'</span><span class="lb-level">Lv '+e.level+'</span></div>';
    }).join('');
    return '<div class="leaderboard"><div class="filter-label">Your top runs</div>'+rows+'</div>';
  }

  function modalTemplate(kind){
    if(kind==='start'){
      return ''
        + '<div class="modal-eyebrow">Typing Racer</div>'
        + '<h2>Ready to race?</h2>'
        + '<p class="modal-copy">Words fly in from the right. Type each one exactly, then hit <strong>Enter</strong> or <strong>Space</strong> before it crosses the red line.</p>'
        + powerupLegend()
        + difficultySection()
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
  });

  // ---------- Input handling ----------
  input.addEventListener('input', ()=>{
    const v = input.value.toLowerCase().replace(/[^a-z]/g,'');
    input.value = v;
    typed = v;
  });
  input.addEventListener('keydown', e=>{
    if(state!=='playing') return;
    if(e.key===' ' || e.key==='Enter'){
      e.preventDefault();
      submitTyped();
    } else if(/^[a-zA-Z]$/.test(e.key)){
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
// Add this inside script.js right after drawStreaks(); in the draw() function:
ctx.save();
ctx.font = '900 120px "JetBrains Mono", monospace';
ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'; // Subdued watermark opacity
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('</>', STAGE_W / 2, STAGE_H / 2);
ctx.restore();