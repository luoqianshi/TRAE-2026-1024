/* ============================================================
   TRAE 1024 · 互动落地页
   状态机 LOADING→OPENING→TYPING→ASSEMBLING→HERO + 五风格切换
   ============================================================ */
(function () {
  'use strict';

  var SEQUENCE = ['T', 'R', 'A', 'E', '1', '0', '2', '4'];
  var GROUP_AFTER = 3;                 // E 与 1 之间停顿
  var T_OPENING = 2500, T_ASSEMBLE = 2500;
  var KEY_GAP = 800, KEY_JITTER = 90, GROUP_GAP = 320;
  var HOLD_AFTER_TYPED = 2600;       // 敲完 TRAE1024 后停留 2~3 秒再汇聚展示祝福
  var PHASES = ['LOADING', 'OPENING', 'TYPING', 'ASSEMBLING', 'HERO'];

  var STYLES = [
    { id: 'pixel', no: '01', cn: '像素风', en: 'Pixel art',
      desc: '低分辨率渲染 → 调色板量化 → 4×4 Bayer 抖动 → 深度描边。<span class="en2">Low-res render, palette quantization, ordered dither.</span>' },
    { id: 'lowpoly', no: '02', cn: '低多边形', en: 'Low poly',
      desc: '三角折面替代曲面，棱线硬朗、块状明暗，暖金与品牌绿交织。<span class="en2">Faceted geometry with flat shading.</span>' },
    { id: 'toon', no: '03', cn: '卡通渲染', en: 'Toon shading',
      desc: 'N·L 阶梯化为三档，阴影偏冷；物体带手绘墨线轮廓。<span class="en2">Three-tone cel shading with inked edges.</span>' },
    { id: 'oil', no: '04', cn: '油画', en: 'Oil painting',
      desc: '保边笔触把细节抹成块面，整体叠加画布编织纹理，暖调柔和。<span class="en2">Brush strokes over a woven canvas texture.</span>' },
    { id: 'ink', no: '05', cn: '水墨', en: 'Ink wash',
      desc: '宣纸底上墨分五色，干笔飞白扰动边缘，朱砂只作点睛。<span class="en2">Ink density, dry-brush edges, cinnabar accent.</span>' }
  ];

  var body = document.body;
  var $ = function (s) { return document.querySelector(s); };

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) body.classList.add('motion-reduce');

  var state = { phase: 'LOADING', style: 0, pointer: 0, timer: null, started: false };

  function updateBodyClasses() {
    body.className = 'style-' + STYLES[state.style].id + ' phase-' + state.phase.toLowerCase() + (reduce ? ' motion-reduce' : '');
  }
  function setPhase(p) { state.phase = p; updateBodyClasses(); }
  function clearTimer() { if (state.timer) { clearTimeout(state.timer); state.timer = null; } }
  function later(fn, ms) { clearTimer(); state.timer = setTimeout(fn, ms); }

  /* ---------------- 键盘模型（75% 布局） ---------------- */
  var G = { g: 1 };
  var ROWS = [
    [['Esc', 1], G, ['F1'], ['F2'], ['F3'], ['F4'], G, ['F5'], ['F6'], ['F7'], ['F8'], G, ['F9'], ['F10'], ['F11'], ['F12'], G, ['Del', 1.25]],
    [['`'], ['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9'], ['0'], ['-'], ['='], ['⌫', 2]],
    [['Tab', 1.5], ['Q'], ['W'], ['E'], ['R'], ['T'], ['Y'], ['U'], ['I'], ['O'], ['P'], ['['], [']'], ['\\', 1.5]],
    [['Caps', 1.75], ['A'], ['S'], ['D'], ['F', 1, 'novel'], ['G'], ['H'], ['J'], ['K'], ['L'], [';'], ["'"], ['Enter', 2.25, 'enter']],
    [['⇧', 2.25], ['Z'], ['X'], ['C'], ['V'], ['B'], ['N'], ['M'], [','], ['.'], ['/'], ['⇧', 2.25], ['↑']],
    [['Ctrl', 1.25], ['Win'], ['Alt'], ['', 6.25, 'space'], ['Alt'], ['Fn'], ['Ctrl', 1.25], ['←'], ['↓'], ['→']]
  ];
  var SUBS = { '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')', '-': '_', '=': '+', '`': '~' };

  var keyEls = {};
  function buildKeyboard() {
    var wrap = $('#keys');
    ROWS.forEach(function (row) {
      var r = document.createElement('div');
      r.className = 'kbd-row';
      row.forEach(function (k) {
        if (k.g) { var sp = document.createElement('span'); sp.style.width = 'calc(var(--u)*.45)'; sp.style.flex = '0 0 auto'; r.appendChild(sp); return; }
        var label = k[0], span = k[1] || 1, cls = k[2] || '';
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'key' + (span > 1 ? ' w' + String(span * 100).replace(/0+$/, '') : '') + (cls ? ' ' + cls : '');
        if (span > 1) b.style.flexBasis = 'auto';
        var up = label.toUpperCase();
        if (SEQUENCE.indexOf(up) >= 0) { b.dataset.key = up; keyEls[up] = b; }
        var cap = document.createElement('span'); cap.className = 'cap';
        var face = document.createElement('i'); face.className = 'face';
        if (SUBS[label]) { var sm = document.createElement('small'); sm.textContent = SUBS[label]; face.appendChild(sm); }
        face.appendChild(document.createTextNode(label === 'space' ? '' : label));
        cap.appendChild(face); b.appendChild(cap);
        b.addEventListener('click', function () { onHeroKey(up); });
        r.appendChild(b);
      });
      wrap.appendChild(r);
    });
  }

  /* ---------------- HERO 字槽 ---------------- */
  var slots = [];
  function buildSlots() {
    var word = $('#word');
    SEQUENCE.forEach(function (k, i) {
      var s = document.createElement('div');
      s.className = 'slot' + (k === '2' ? ' purple' : '');
      s.dataset.i = i;
      word.appendChild(s); slots.push(s);
    });
  }

  /* ---------------- 粒子背景（五风格） ---------------- */
  var Fx = (function () {
    var cv = $('#fx'), ctx = cv.getContext('2d');
    if (!ctx) return null;
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), parts = [], mode = 'pixel', raf = null;
    var PAL = {
      pixel: ['#10B981', '#3DE8A4', 'rgba(255,255,255,.55)', 'rgba(16,185,129,.8)'],
      lowpoly: ['#10B981', '#E8A94B', '#7ED0C2', 'rgba(255,220,160,.7)'],
      toon: ['#10B981', '#3DE8A4', 'rgba(255,255,255,.6)'],
      oil: ['rgba(16,185,129,.7)', 'rgba(255,196,120,.55)', 'rgba(255,236,200,.4)'],
      ink: ['rgba(40,38,32,.55)', 'rgba(70,64,52,.5)', 'rgba(20,20,18,.4)', 'rgba(190,60,35,.75)']
    };
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }
    function seed() {
      var n = Math.round(Math.min(110, W * H / 16000));
      parts = [];
      for (var i = 0; i < n; i++) parts.push(mk(Math.random() * W, Math.random() * H));
    }
    function mk(x, y) {
      var red = mode === 'ink' && Math.random() < 0.05;
      return {
        x: x, y: y,
        vx: (Math.random() - .5) * .14, vy: -(0.06 + Math.random() * .22),
        s: mode === 'oil' ? 5 + Math.random() * 13 : mode === 'lowpoly' ? 6 + Math.random() * 12 : 1.4 + Math.random() * 2.6,
        c: red ? PAL.ink[3] : PAL[mode][(Math.random() * PAL[mode].length) | 0],
        rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .006,
        sq: Math.max(2, Math.random() * 10) | 0
      };
    }
    function drawDot(p) {
      if (mode === 'pixel') {
        var q = 4, x = (p.x / q | 0) * q, y = (p.y / q | 0) * q;
        ctx.fillStyle = p.c; ctx.fillRect(x, y, q, q);
      } else if (mode === 'lowpoly') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        ctx.beginPath(); var s = p.s;
        ctx.moveTo(0, -s); ctx.lineTo(s * .9, s * .7); ctx.lineTo(-s * .9, s * .7); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = .16; ctx.strokeStyle = '#FFE6B0'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      } else if (mode === 'toon') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s + .8, 0, 7); ctx.lineWidth = 1.4;
        ctx.strokeStyle = mode === 'toon' ? 'rgba(8,14,22,.85)' : 'rgba(0,0,0,.4)'; ctx.stroke();
        ctx.fillStyle = p.c; ctx.fill();
      } else if (mode === 'oil') {
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 1.8);
        g.addColorStop(0, p.c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 1.8, 0, 7); ctx.fill();
      } else { /* ink：粗糙墨点 */
        ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = p.c; ctx.beginPath();
        var r = p.s * 1.4, seg = 7;
        for (var a = 0; a <= seg; a++) {
          var ang = a / seg * Math.PI * 2, rr = r * (0.75 + ((a * 13 % 7) / 10));
          var px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
          a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    function rain() {
      if (mode === 'ink' || mode === 'oil') return;
      ctx.fillStyle = mode === 'lowpoly' ? 'rgba(232,169,75,.22)' : 'rgba(16,185,129,.20)';
      var n = W < 700 ? 2 : 4, t = performance.now() / 1000;
      for (var i = 0; i < n; i++) {
        var x = ((i * 220 + (t * 26 * (i % 2 ? 1 : 1.7))) % (W + 40)) - 20;
        var y = ((t * 90 + i * 340) % (H + 120)) - 60;
        ctx.fillRect(x, y, mode === 'pixel' ? 3 : 1.5, mode === 'pixel' ? 26 : 42);
      }
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      rain();
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
        if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
        drawDot(p);
      }
      raf = requestAnimationFrame(frame);
    }
    function setMode(m) {
      mode = m; if (W) seed();
      if (reduce) { if (raf) cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); rain(); parts.forEach(drawDot); return; }
      if (!raf) raf = requestAnimationFrame(frame);
    }
    window.addEventListener('resize', resize);
    resize();
    return { setMode: setMode };
  })();

  /* ---------------- Web Audio 合成音效 ---------------- */
  var Snd = (function () {
    var ac = null, master = null, muted = localStorage.getItem('trae1024-muted') === '1';
    function ensure() {
      if (muted) return null;
      if (!ac) {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createDynamicsCompressor();
          master.threshold.value = -20; master.knee.value = 18; master.ratio.value = 5;
          master.attack.value = .003; master.release.value = .12;
          var mg = ac.createGain(); mg.gain.value = .9;
          master.connect(mg).connect(ac.destination);
        } catch (e) { ac = null; master = null; }
      }
      if (ac && ac.state === 'suspended') ac.resume();
      return ac;
    }
    function bus() { return master || (ac && ac.destination); }

    /* 高端客制化机械键盘「麻将音」（thock）：
       帽壁高频瞬态 + 非谐波腔体共鸣 + 低频触底闷响，逐键随机力度与音高 */
    function click(n) {
      var a = ensure(); if (!a) return;
      var dest = bus(), t = a.currentTime, sr = a.sampleRate;
      var vel = .75 + Math.random() * .5;                              // 每次敲击的力度差异
      var base = 208 + (n % 8 - 3.5) * 6 + (Math.random() * 16 - 8);  // 基频微抖

      /* 1) 帽壁撞击瞬态：带通白噪声，30ms 内快速衰减 */
      var tlen = Math.max(1, Math.floor(sr * .04));
      var tbuf = a.createBuffer(1, tlen, sr), td = tbuf.getChannelData(0);
      for (var i = 0; i < tlen; i++) td[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / tlen, 2.6);
      var tsrc = a.createBufferSource(); tsrc.buffer = tbuf;
      var hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2800;
      var bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4800; bp.Q.value = .7;
      var tg = a.createGain();
      tg.gain.setValueAtTime(.16 * vel, t);
      tg.gain.exponentialRampToValueAtTime(.0001, t + .03);
      tsrc.connect(hp).connect(bp).connect(tg).connect(dest);
      tsrc.start(t); tsrc.stop(t + .045);

      /* 2) 腔体共鸣：非谐波分音，密实而不歌唱，如麻将牌碰撞 */
      var partials = [
        { r: 1,    g: .26,  o: 'sine' },
        { r: 1.52, g: .12,  o: 'sine' },
        { r: 2.24, g: .07,  o: 'triangle' },
        { r: 3.09, g: .035, o: 'sine' }
      ];
      partials.forEach(function (p) {
        var osc = a.createOscillator(), og = a.createGain();
        var f0 = base * p.r * (1 + (Math.random() - .5) * .006);
        osc.type = p.o; osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(f0 * .92, t + .12);
        og.gain.setValueAtTime(.0001, t);
        og.gain.exponentialRampToValueAtTime(p.g * vel, t + .0045);
        og.gain.exponentialRampToValueAtTime(.0001, t + .12);
        osc.connect(og).connect(dest);
        osc.start(t); osc.stop(t + .14);
      });

      /* 3) 低频触底：极短闷响，提供键程到底的分量感 */
      var sub = a.createOscillator(), sg = a.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(108 + Math.random() * 12, t);
      sub.frequency.exponentialRampToValueAtTime(78, t + .08);
      sg.gain.setValueAtTime(.0001, t);
      sg.gain.exponentialRampToValueAtTime(.14 * vel, t + .005);
      sg.gain.exponentialRampToValueAtTime(.0001, t + .09);
      sub.connect(sg).connect(dest);
      sub.start(t); sub.stop(t + .1);
    }
    function whoosh() {
      var a = ensure(); if (!a) return;
      var dest = bus(), t = a.currentTime, dur = 1.1;
      var buf = a.createBuffer(1, dur * a.sampleRate, a.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      var src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
      bp.type = 'bandpass'; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2400, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .25);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.buffer = buf; src.connect(bp).connect(g).connect(dest); src.start(t);
    }
    function chime() {
      var a = ensure(); if (!a) return;
      var dest = bus();
      [523.25, 659.25, 783.99].forEach(function (f, i) {
        var t = a.currentTime + i * .09, osc = a.createOscillator(), g = a.createGain();
        osc.type = 'sine'; osc.frequency.value = f;
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.14, t + .02);
        g.gain.exponentialRampToValueAtTime(.0001, t + .45);
        osc.connect(g).connect(dest); osc.start(t); osc.stop(t + .5);
      });
    }
    return {
      click: click, whoosh: whoosh, chime: chime,
      unlock: ensure,
      get muted() { return muted; },
      toggle: function () { muted = !muted; localStorage.setItem('trae1024-muted', muted ? '1' : '0'); if (!muted) ensure(); return muted; }
    };
  })();

  /* ---------------- 提示 ---------------- */
  var hintEl = $('#hint'), hintTimer = null;
  function hint(html, ms) {
    hintEl.innerHTML = html; hintEl.classList.add('show');
    clearTimeout(hintTimer);
    if (ms) hintTimer = setTimeout(function () { hintEl.classList.remove('show'); }, ms);
  }
  function hideHint() { hintEl.classList.remove('show'); }

  /* ---------------- 演出编排 ---------------- */
  function markNext() {
    Object.keys(keyEls).forEach(function (k) { keyEls[k].classList.remove('next'); });
    if (state.pointer < SEQUENCE.length) keyEls[SEQUENCE[state.pointer]].classList.add('next');
  }
  function resetKeys() {
    SEQUENCE.forEach(function (k) {
      keyEls[k].classList.remove('next', 'lit', 'pressed', 'lifting', 'tickled', 'purple');
    });
  }

  function enterOpening() {
    state.started = true;
    state.pointer = 0;
    setPhase('OPENING');
    markNext();
    hint('按 <b>T</b> 抢先开演，也可等待自动敲击 · 试试 <b>1–5 / ← →</b> 切换画风');
    if (reduce) { enterHero(true); return; }
    later(function () { startTyping(); }, T_OPENING);
  }

  function startTyping() {
    if (state.phase !== 'OPENING') return;
    setPhase('TYPING');
    hint('依次敲入 <b>T R A E 1 0 2 4</b>，用你的键盘接力', 6000);
    scheduleStrike(KEY_GAP - KEY_JITTER);
  }
  function scheduleStrike(delay) { later(function () { strike(state.pointer, true); }, delay); }

  function strike(i, auto) {
    if (state.phase !== 'TYPING' || i < 0 || i >= SEQUENCE.length) return;
    var k = SEQUENCE[i], el = keyEls[k];
    el.classList.remove('next');
    el.classList.add('pressed');
    if (k === '2') el.classList.add('purple');
    Snd.click(i);
    setTimeout(function () {
      el.classList.remove('pressed');
      el.classList.add('lit');
    }, 110);
    state.pointer = i + 1;
    if (state.pointer >= SEQUENCE.length) { later(enterAssembling, HOLD_AFTER_TYPED); return; }
    markNext();
    var gap = KEY_GAP + (Math.random() * 2 - 1) * KEY_JITTER;
    if (i === GROUP_AFTER) gap += GROUP_GAP;
    if (auto !== false) scheduleStrike(gap);
  }

  function onHeroKey(k) {
    Snd.unlock();
    if (state.phase === 'OPENING' && k === 'T') { clearTimer(); setPhase('TYPING'); hint('依次敲入 <b>T R A E 1 0 2 4</b>，用你的键盘接力', 6000); strike(0, false); scheduleStrike(KEY_GAP); return; }
    if (state.phase !== 'TYPING') return;
    var target = SEQUENCE[state.pointer];
    if (k === target) { clearTimer(); strike(state.pointer, false); if (state.phase === 'TYPING' && state.pointer < SEQUENCE.length) scheduleStrike(KEY_GAP); return; }
    if (SEQUENCE.indexOf(k) > state.pointer) {
      var el = keyEls[k]; el.classList.add('tickled');
      setTimeout(function () { el.classList.remove('tickled'); }, 200);
    }
  }

  function enterAssembling() {
    clearTimer(); hideHint();
    setPhase('ASSEMBLING');
    resetSlots();
    Snd.whoosh();
    SEQUENCE.forEach(function (k) { keyEls[k].classList.add('lifting'); keyEls[k].classList.remove('next'); });
    var layer = $('#fly-layer');
    SEQUENCE.forEach(function (k, i) {
      var src = keyEls[k], sr = src.getBoundingClientRect();
      var slot = slots[i], tr = slot.getBoundingClientRect();
      var size = Math.max(28, Math.min(sr.width, tr.width));
      var fly = document.createElement('div');
      fly.className = 'flyer' + (k === '2' ? ' purple' : '');
      fly.textContent = k;
      fly.style.width = size + 'px'; fly.style.height = size + 'px';
      fly.style.fontSize = size * .46 + 'px';
      layer.appendChild(fly);
      var sx = sr.left + sr.width / 2, sy = sr.top + sr.height / 2;
      var tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
      var fx = tx - sx, fy = ty - sy, fs = tr.width / sr.width;
      var delay = i * 85, dur = reduce ? 1 : 1050;
      var mx = sx + fx * .35, my = sy + fy * .35 - 130;
      var anim = fly.animate([
        { transform: 'translate(-50%,-50%) translate(' + sx + 'px,' + sy + 'px) scale(1) rotateZ(0deg)', opacity: 1, offset: 0 },
        { transform: 'translate(-50%,-50%) translate(' + mx + 'px,' + my + 'px) scale(1.18) rotateZ(' + (i % 2 ? 9 : -9) + 'deg)', opacity: 1, offset: .42 },
        { transform: 'translate(-50%,-50%) translate(' + tx + 'px,' + ty + 'px) scale(' + fs + ') rotateZ(0deg)', opacity: .96, offset: 1 }
      ], { duration: dur, delay: delay, easing: 'cubic-bezier(.45,0,.15,1)', fill: 'forwards' });
      anim.onfinish = function () { fly.remove(); };
    });
    later(function () { enterHero(false); }, reduce ? 60 : T_ASSEMBLE);
  }

  function resetSlots() {
    slots.forEach(function (s) { s.textContent = ''; s.style.opacity = ''; });
    $('#fly-layer').innerHTML = '';
  }

  function enterHero(immediate) {
    setPhase('HERO');
    state.pointer = SEQUENCE.length;
    /* 确定性填充字槽，不依赖飞行动画回调（节流/后台标签下 WA onfinish 可能不触发） */
    $('#fly-layer').innerHTML = '';
    slots.forEach(function (s, i) {
      if (s.textContent !== SEQUENCE[i]) {
        s.textContent = SEQUENCE[i];
        if (!immediate && !reduce) s.classList.add('pop');
      }
    });
    if (!immediate && !reduce) setTimeout(function () {
      slots.forEach(function (s) { s.classList.remove('pop'); });
    }, 700);
    hint('拖拽转动 <b>TRAE1024</b>，滚轮缩放 · <b>Tab</b> 重播 · <b>1–5</b> 切换画风', 5200);
    if (!immediate) Snd.chime();
  }

  function replay() {
    clearTimer();
    hideHint();
    resetSlots(); resetKeys();
    $('#fly-layer').innerHTML = '';
    setPhase('LOADING');
    later(enterOpening, reduce ? 80 : 420);
  }

  /* ---------------- HERO 视角拖拽/缩放 ---------------- */
  (function () {
    var word = $('#word'), dragging = false, sx = 0, base = 0, rot = 0, scale = 1;
    word.addEventListener('pointerdown', function (e) {
      if (state.phase !== 'HERO') return;
      dragging = true; sx = e.clientX; base = rot; word.classList.add('grabbing');
      word.setPointerCapture(e.pointerId);
    });
    word.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      rot = Math.max(-26, Math.min(26, base + (e.clientX - sx) * .12));
      word.style.transform = 'rotateY(' + rot + 'deg) scale(' + scale + ')';
    });
    function up() { dragging = false; word.classList.remove('grabbing'); }
    word.addEventListener('pointerup', up); word.addEventListener('pointercancel', up);
    window.addEventListener('wheel', function (e) {
      if (state.phase !== 'HERO') return;
      scale = Math.max(.9, Math.min(1.12, scale - e.deltaY * .0006));
      word.style.transform = 'rotateY(' + rot + 'deg) scale(' + scale + ')';
    }, { passive: true });
  })();

  /* ---------------- 五风格切换 ---------------- */
  var segEl = $('#sc-seg');
  STYLES.forEach(function (s, i) {
    var b = document.createElement('i');
    b.setAttribute('role', 'tab'); b.setAttribute('aria-label', 'STYLE ' + s.no + ' ' + s.cn);
    b.addEventListener('click', function () { setStyle(i); });
    segEl.appendChild(b);
  });
  function setStyle(i) {
    i = (i + STYLES.length) % STYLES.length;
    var changed = i !== state.style;
    state.style = i; updateBodyClasses();
    var s = STYLES[i];
    $('#sc-pill').textContent = 'STYLE ' + s.no + ' / 05';
    $('#sc-cn').textContent = s.cn; $('#sc-en').textContent = s.en;
    $('#sc-desc').innerHTML = s.desc;
    Array.prototype.forEach.call(segEl.children, function (b, k) {
      b.className = k < i ? 'done' : (k === i ? 'cur' : '');
      b.setAttribute('aria-selected', k === i ? 'true' : 'false');
    });
    if (Fx) Fx.setMode(s.id);
    /* 切换到不同风格：从按键开始重新播放（初始化 setStyle(0) 不触发） */
    if (changed && state.started) replay();
  }
  $('#sc-prev').addEventListener('click', function () { setStyle(state.style - 1); });
  $('#sc-next').addEventListener('click', function () { setStyle(state.style + 1); });

  /* ---------------- 全局输入 ---------------- */
  document.addEventListener('keydown', function (e) {
    /* Tab 重播：始终拦截默认焦点跳转，长按自动重复时只拦截不重播 */
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.repeat) return;
      Snd.unlock();
      replay();
      return;
    }
    if (e.repeat) return;
    Snd.unlock();
    var k = e.key.toUpperCase();
    if (k === 'M') { syncMute(Snd.toggle()); return; }
    if (k === 'ARROWLEFT' || k === '[') { setStyle(state.style - 1); return; }
    if (k === 'ARROWRIGHT' || k === ']') { setStyle(state.style + 1); return; }
    if (e.key >= '1' && e.key <= '5') {
      if (state.phase === 'HERO' || state.phase === 'ASSEMBLING' || state.phase === 'OPENING') setStyle(parseInt(e.key, 10) - 1);
      return;
    }
    if (SEQUENCE.indexOf(k) >= 0 && (state.phase === 'OPENING' || state.phase === 'TYPING')) {
      e.preventDefault(); onHeroKey(k);
    }
  });

  var muteBtn = $('#btn-mute');
  function syncMute(m) { muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false'); }
  muteBtn.addEventListener('click', function () { Snd.unlock(); syncMute(Snd.toggle()); });
  $('#btn-replay').addEventListener('click', replay);
  $('#fb-retry').addEventListener('click', function () { location.reload(); });

  /* 首次任意交互解锁音频（浏览器自动播放策略） */
  ['pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function once() { Snd.unlock(); window.removeEventListener(ev, once); });
  });

  /* ---------------- 后台挂起 / 恢复 ---------------- */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { clearTimer(); return; }
    if (state.phase === 'OPENING') later(function () { setPhase('TYPING'); markNext(); scheduleStrike(KEY_GAP - KEY_JITTER); }, 600);
    else if (state.phase === 'TYPING') {
      if (state.pointer >= SEQUENCE.length) later(enterAssembling, 400);
      else scheduleStrike(KEY_GAP);
    }
  });

  /* ---------------- 启动 / 降级 ---------------- */
  function boot() {
    buildKeyboard(); buildSlots();
    syncMute(Snd.muted);
    setStyle(0);
    if (!Fx) { $('#fallback').classList.add('show'); return; }
    setPhase('LOADING');
    var codes = ['// loading scene', '// compiling 5 styles', '// ready'];
    var i = 0, ld = $('#ld-code');
    var tick = setInterval(function () {
      i++; if (i < codes.length) { ld.textContent = codes[i]; return; }
      clearInterval(tick);
      $('#loader').classList.add('gone');
      enterOpening();
    }, reduce ? 180 : 420);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
