/* =====================================================================
   العراق AI — مخرج التسلسل السينمائي
   تطوير: مصطفى حسين — Mustafa Hussein

   يربط: الساعة (من الصوت إن وُجد) ← المشاهد ← القلب والجسيمات ← النصوص.
   كل التوقيتات والنصوص من js/config.js.
   ===================================================================== */
(function (global) {
  'use strict';

  var doc = global.document, body = doc.body;
  var C = global.IRAQ_CONFIG, A = global.IraqAudio, HR = global.IraqHeart;
  var T = C.t, K = C.keys, TX = C.texts;

  function $(id) { return doc.getElementById(id); }
  var els = {
    stage: $('stage'), canvas: $('fx'), flash: $('flash'),
    intro: $('intro'), startBtn: $('startBtn'),
    question: $('question'), questionText: $('questionText'),
    reveal: $('reveal'), revealText: $('revealText'),
    final: $('final'), logo: $('logo'), sub: $('sub'), divider: $('divider'), kicker: $('kicker'),
    finalLine: $('finalLine'), ctaWrap: $('ctaWrap'), cta: $('ctaBtn'), replay: $('replayBtn'),
    devNote: $('devNote'), signature: $('signature'),
    mute: $('muteBtn'), skip: $('skipBtn'), toast: $('toast')
  };

  var mq = function (q) { return global.matchMedia ? global.matchMedia(q) : { matches: false }; };
  var reduced = mq('(prefers-reduced-motion: reduce)').matches;
  var coarse = mq('(pointer: coarse)').matches;

  /* ---------- النصوص ---------- */
  function applyTexts() {
    var nodes = doc.querySelectorAll('[data-text]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], key = n.getAttribute('data-text'), val = TX[key];
      if (val == null) continue;
      if (n.getAttribute('data-words')) setWords(n, val); else n.textContent = val;
    }
  }
  function setWords(node, text) {
    node.textContent = '';
    var words = text.split(/\s+/).filter(Boolean);
    for (var i = 0; i < words.length; i++) {
      var s = doc.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i); s.textContent = words[i];
      node.appendChild(s);
      if (i < words.length - 1) node.appendChild(doc.createTextNode(' '));
    }
  }

  /* ---------- الجودة ---------- */
  function initialQuality() {
    var m = /[?&]quality=(high|medium|low)/.exec(global.location.search || '');
    if (m) return { high: 0, medium: 1, low: 2 }[m[1]];
    var mem = global.navigator.deviceMemory || 4, cores = global.navigator.hardwareConcurrency || 4;
    var small = Math.min(global.innerWidth, global.innerHeight) < 500, score = 0;
    if (mem <= 2) score += 2; else if (mem <= 4) score += 1;
    if (cores <= 2) score += 2; else if (cores <= 4) score += 1;
    if (coarse && small) score += 1;
    return score >= 4 ? 2 : (score >= 2 ? 1 : 0);
  }
  var heart = HR.create(els.canvas, {
    quality: initialQuality(), reducedMotion: reduced,
    onQuality: function (q) { body.setAttribute('data-q', q); }
  });
  body.setAttribute('data-q', heart.getQuality());

  /* ---------- مساعدات ---------- */
  function sample(arr, t) {
    var n = arr.length;
    if (t <= arr[0][0]) return arr[0][1];
    if (t >= arr[n - 1][0]) return arr[n - 1][1];
    for (var i = 1; i < n; i++) {
      if (t <= arr[i][0]) {
        var a = arr[i - 1], b = arr[i], u = (t - a[0]) / (b[0] - a[0]);
        u = u * u * (3 - 2 * u);
        return a[1] + (b[1] - a[1]) * u;
      }
    }
    return arr[n - 1][1];
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function show(el) { el.classList.add('on'); }
  function hide(el) { el.classList.remove('on'); }
  function shortLandscape() { return global.innerHeight <= 520 && global.innerWidth > global.innerHeight; }
  function layoutMain() {
    if (shortLandscape()) return { cx: 0.5, cy: 0.46, scale: 1 };
    return { cx: 0.5, cy: global.innerWidth < global.innerHeight ? 0.42 : 0.45, scale: 1 };
  }
  function layoutFinal() {
    if (shortLandscape()) return { cx: 0.77, cy: 0.5, scale: 0.85 };
    var port = global.innerWidth < global.innerHeight;
    return { cx: 0.5, cy: port ? 0.2 : 0.24, scale: port ? 0.52 : 0.5 };
  }
  function updateFinalTop() {
    if (shortLandscape()) { els.final.style.setProperty('--final-top', '16px'); return; }
    var L = layoutFinal(), m = heart.metrics();
    var bottom = global.innerHeight * L.cy + 14.5 * m.baseS * L.scale * 1.05;
    els.final.style.setProperty('--final-top', Math.round(bottom + 10) + 'px');
  }

  /* ---------- الرابط ---------- */
  function resolveUrl() {
    var raw = String(C.IRAQ_AI_URL || '').trim();
    if (!raw) return null;
    try {
      var u = new global.URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.href;
    } catch (e) { return null; }
  }
  function setupCta() {
    var url = resolveUrl(), cta = els.cta;
    if (url) {
      cta.setAttribute('href', url);
      if (C.OPEN_IN_NEW_TAB) { cta.setAttribute('target', '_blank'); cta.setAttribute('rel', 'noopener noreferrer'); }
      else { cta.removeAttribute('target'); cta.removeAttribute('rel'); }
      cta.removeAttribute('aria-disabled'); cta.removeAttribute('tabindex');
      cta.classList.remove('is-disabled'); els.devNote.hidden = true;
    } else {
      cta.removeAttribute('href'); cta.removeAttribute('target'); cta.removeAttribute('rel');
      cta.setAttribute('aria-disabled', 'true'); cta.setAttribute('tabindex', '0');
      cta.classList.add('is-disabled'); els.devNote.hidden = false; els.devNote.textContent = TX.devWarn;
    }
  }
  els.cta.addEventListener('click', function (e) {
    if (!resolveUrl()) { e.preventDefault(); toast(TX.ctaDisabledToast); }
  });
  els.cta.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && els.cta.getAttribute('aria-disabled') === 'true') { e.preventDefault(); toast(TX.ctaDisabledToast); }
  });

  /* ---------- تنبيه ---------- */
  var toastTimer = 0;
  function toast(msg, actionLabel, action, ms) {
    var t = els.toast; t.textContent = ''; t.hidden = false;
    var s = doc.createElement('span'); s.textContent = msg; t.appendChild(s);
    if (actionLabel) {
      var b = doc.createElement('button'); b.type = 'button'; b.textContent = actionLabel;
      b.addEventListener('click', function () { t.hidden = true; if (action) action(); });
      t.appendChild(b);
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 7000);
  }

  /* ---------- الحالة ---------- */
  var phase = 'intro';          // intro | loading | playing
  var tm = 0, evIdx = 0, beatIdx = 0, skipped = false, idleAcc = 0, lastFrame = 0;
  var par = { x: 0, y: 0, tx: 0, ty: 0 };

  function impact(silent) {
    body.classList.add('lit');
    if (silent) return;
    heart.reveal(); heart.formNumber();
    els.flash.classList.remove('go'); void els.flash.offsetWidth; els.flash.classList.add('go');
    try { if (!reduced && global.navigator.vibrate) global.navigator.vibrate(35); } catch (e) {}
  }

  var events = [
    { t: T.questionIn, fn: function (s) { if (s) return; show(els.question); body.classList.add('s-question'); } },
    { t: T.slowStart, fn: function (s) { if (!s) body.classList.add('s-slow'); } },
    { t: T.questionOut, fn: function () { hide(els.question); } },
    { t: T.impact, fn: impact },
    { t: T.revealText, fn: function (s) { if (s) return; show(els.reveal); } },
    { t: T.numberRelease, fn: function (s) { if (!s) heart.releaseNumber(); } },
    { t: T.revealTextOut, fn: function () { hide(els.reveal); } },
    { t: T.logoIn, fn: function () { body.classList.remove('s-slow'); body.classList.add('s-final'); show(els.final); show(els.logo); } },
    { t: T.subIn, fn: function () { show(els.sub); } },
    { t: T.kickerIn, fn: function () { show(els.divider); show(els.kicker); } },
    { t: T.lineIn, fn: function () { show(els.finalLine); } },
    { t: T.ctaIn, fn: function () { show(els.ctaWrap); els.skip.hidden = true; } },
    { t: T.signatureIn, fn: function () { show(els.signature); } }
  ];

  function resetVisuals() {
    var i, list = [els.question, els.reveal, els.final, els.logo, els.sub, els.divider, els.kicker, els.finalLine, els.ctaWrap, els.signature];
    for (i = 0; i < list.length; i++) hide(list[i]);
    body.classList.remove('s-question', 's-slow', 'lit', 's-final', 'playing');
    heart.reset();
    tm = 0; evIdx = 0; beatIdx = 0; skipped = false; idleAcc = 0;
    els.flash.classList.remove('go');
  }

  function startExperience() {
    if (phase === 'loading') return;
    phase = 'loading';
    resetVisuals();
    hide(els.intro);
    body.classList.remove('s-intro');
    els.skip.hidden = true;
    A.start().then(function (info) {
      tm = 0; evIdx = 0; beatIdx = 0; phase = 'playing';
      body.classList.add('playing');
      els.skip.hidden = false;
      if (info.mode === 'synth' && info.reason === 'missing') toast(TX.audioMissing, TX.retry, startExperience, 9000);
      else if (info.mode === 'none') toast(TX.audioUnsupported, null, null, 6000);
    });
  }
  function skipExperience() {
    if (phase !== 'playing' || skipped) return;
    skipped = true; A.stop(); heart.clearTransient();
    hide(els.question); hide(els.reveal); els.skip.hidden = true;
  }

  els.startBtn.addEventListener('click', startExperience);
  els.replay.addEventListener('click', function () { A.stop(); phase = 'intro'; startExperience(); });
  els.skip.addEventListener('click', skipExperience);
  els.mute.addEventListener('click', function () {
    var m = !A.isMuted(); A.setMuted(m);
    els.mute.setAttribute('aria-pressed', m ? 'true' : 'false');
    var label = m ? TX.muteOff : TX.muteOn;
    els.mute.setAttribute('aria-label', label); els.mute.setAttribute('title', label);
  });

  /* ---------- الإدخال: ماوس + لمس ---------- */
  function isUi(target) { return !!(target && target.closest && target.closest('button, a, .controls, .toast')); }
  global.addEventListener('pointermove', function (e) {
    heart.setPointer(e.clientX, e.clientY, true, e.pointerType === 'touch');
    par.tx = (e.clientX / global.innerWidth - 0.5) * 2; par.ty = (e.clientY / global.innerHeight - 0.5) * 2;
  }, { passive: true });
  global.addEventListener('pointerdown', function (e) {
    heart.setPointer(e.clientX, e.clientY, true, e.pointerType === 'touch');
    if (!isUi(e.target)) heart.tap(e.clientX, e.clientY);
  }, { passive: true });
  function pointerEnd(e) {
    if (e.pointerType === 'touch' || e.type === 'pointercancel') { heart.setPointer(0, 0, false, true); par.tx = 0; par.ty = 0; }
  }
  global.addEventListener('pointerup', pointerEnd, { passive: true });
  global.addEventListener('pointercancel', pointerEnd, { passive: true });
  doc.documentElement.addEventListener('pointerleave', function () { heart.setPointer(0, 0, false, false); par.tx = 0; par.ty = 0; });

  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) A.pause(); else if (phase === 'playing') A.resume();
  });
  function onResize() { heart.resize(); updateFinalTop(); }
  global.addEventListener('resize', onResize);
  global.addEventListener('orientationchange', function () { setTimeout(onResize, 250); });

  /* ---------- الحلقة الرئيسية ---------- */
  function tick(now) {
    var dtMs = lastFrame ? Math.min(now - lastFrame, 100) : 16; lastFrame = now;
    var st = heart.st;

    if (phase === 'playing') {
      if (skipped) tm = Math.max(tm, T.signatureIn + 600);
      else {
        var ac = A.clockMs();
        if (ac != null && isFinite(ac)) tm = ac; else tm += dtMs;
      }
      st.appear = sample(K.appear, tm);
      st.intensity = sample(K.intensity, tm);
      st.timeScale = sample(K.timeScale, tm);
      st.heartAlpha = sample(K.heartAlpha, tm);
      var f = sample(K.layout, tm), a = layoutMain(), b = layoutFinal();
      st.cx = lerp(a.cx, b.cx, f); st.cy = lerp(a.cy, b.cy, f); st.scale = lerp(a.scale, b.scale, f);

      var beats = C.beats;
      while (beatIdx < beats.length && beats[beatIdx].t <= tm) {
        var be = beats[beatIdx++];
        if (!skipped) st.beat = Math.max(st.beat, be.s);
      }
      while (evIdx < events.length && events[evIdx].t <= tm) events[evIdx++].fn(skipped);

      if (tm > T.idleStart) { idleAcc += dtMs; if (idleAcc > 1600) { idleAcc = 0; st.beat = Math.max(st.beat, 0.4); } }
    } else {
      var m0 = layoutMain(); st.cx = m0.cx; st.cy = m0.cy; st.scale = m0.scale;
    }

    par.x += (par.tx - par.x) * 0.08; par.y += (par.ty - par.y) * 0.08;
    if (!reduced) { els.stage.style.setProperty('--px', par.x.toFixed(3)); els.stage.style.setProperty('--py', par.y.toFixed(3)); }

    heart.render(now);
    global.requestAnimationFrame(tick);
  }

  /* ---------- تشغيل ---------- */
  applyTexts();
  setupCta();
  updateFinalTop();
  global.requestAnimationFrame(tick);

  /* واجهة صغيرة للاختبار والتشخيص */
  global.IraqAIDebug = {
    resolveUrl: resolveUrl, setupCta: setupCta,
    phase: function () { return phase; }, time: function () { return tm; },
    heart: heart, startExperience: startExperience, skip: skipExperience
  };
})(window);
