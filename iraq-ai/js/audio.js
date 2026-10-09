/* =====================================================================
   العراق AI — محرك الصوت
   تطوير: مصطفى حسين — Mustafa Hussein

   الأولوية:
     1) ملف موسيقى حقيقي (MP3/OGG) من IRAQ_CONFIG.AUDIO.sources
     2) إن لم يوجد: صوت احتياطي مولَّد برمجياً بـ Web Audio (قلب، طبول، سنطور
        مُحاكى، Drop...). هذا بديل مؤقت وليس موسيقى نهائية مُنتَجة.
     3) إن لم يُدعم الصوت إطلاقاً: تعمل التجربة صامتة.
   لا يبدأ أي صوت قبل ضغط المستخدم على «ابدأ التجربة».
   ===================================================================== */
(function (global) {
  'use strict';

  var C = global.IRAQ_CONFIG;
  var ctx = null, master = null, session = null, el = null;
  var mode = 'none', muted = false, synthT0 = 0, noiseBuf = null;

  function ACtor() { return global.AudioContext || global.webkitAudioContext; }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = ACtor();
    if (!AC) return null;
    try {
      ctx = new AC();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5;
      comp.attack.value = 0.004; comp.release.value = 0.22;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : C.AUDIO.volume;
      master.connect(comp);
      comp.connect(ctx.destination);
    } catch (e) { ctx = null; master = null; }
    return ctx;
  }

  function stop() {
    if (el) {
      try { el.pause(); } catch (e) {}
      try { el.removeAttribute('src'); el.load(); } catch (e2) {}
      el = null;
    }
    if (session && ctx) {
      var s = session;
      try { s.gain.cancelScheduledValues(ctx.currentTime); s.gain.setTargetAtTime(0, ctx.currentTime, 0.05); } catch (e3) {}
      setTimeout(function () { try { s.disconnect(); } catch (e4) {} }, 500);
    }
    session = null;
    mode = 'none';
  }

  /* يُستدعى داخل معالج النقر (لفتح قفل الصوت في iOS/Chrome). يعيد Promise
     يُحَل بـ {mode:'file'|'synth'|'none', reason?} فور بدء الصوت فعلياً. */
  function start() {
    stop();
    return new Promise(function (resolve) {
      var done = false;
      ensureCtx();
      if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }

      function finish(info) { if (done) return; done = true; resolve(info); }

      function fallback(reason) {
        if (done) return;
        if (el) { try { el.pause(); el.removeAttribute('src'); } catch (e) {} el = null; }
        if (!ctx || !master) { mode = 'none'; finish({ mode: 'none', reason: 'unsupported' }); return; }
        try { startSynth(); mode = 'synth'; finish({ mode: 'synth', reason: reason }); }
        catch (err) { mode = 'none'; finish({ mode: 'none', reason: 'unsupported' }); }
      }

      if (!C.AUDIO.enabled) { fallback('disabled'); return; }
      var srcs = (C.AUDIO.sources || []).slice();

      function tryNext() {
        if (done) return;
        var s = srcs.shift();
        if (!s) { fallback('missing'); return; }
        var a = new Audio();
        a.preload = 'auto';
        a.muted = muted;
        a.volume = C.AUDIO.volume;
        a.src = s;
        el = a;
        var to = setTimeout(function () { if (el === a && !done) { try { a.pause(); } catch (e) {} tryNext(); } }, C.AUDIO.loadTimeoutMs);
        a.addEventListener('error', function () { clearTimeout(to); if (el === a && !done) tryNext(); }, { once: true });
        a.addEventListener('playing', function () {
          clearTimeout(to);
          if (el === a && !done) { mode = 'file'; finish({ mode: 'file', src: s }); }
        }, { once: true });
        var p;
        try { p = a.play(); } catch (e2) { p = null; }
        if (p && p.catch) p.catch(function () { clearTimeout(to); if (el === a && !done) tryNext(); });
      }
      tryNext();
    });
  }

  function setMuted(m) {
    muted = !!m;
    if (el) el.muted = muted;
    if (ctx && master) {
      try { master.gain.setTargetAtTime(muted ? 0 : C.AUDIO.volume, ctx.currentTime, 0.03); } catch (e) {}
    }
  }
  function isMuted() { return muted; }
  function getMode() { return mode; }

  /* الساعة المرجعية للمشاهد (ms) أو null إن لم تتوفر */
  function clockMs() {
    if (mode === 'file' && el && !el.paused && !el.ended) return el.currentTime * 1000;
    if (mode === 'synth' && ctx && ctx.state === 'running') return (ctx.currentTime - synthT0) * 1000;
    return null;
  }

  function pause() {
    try { if (el && !el.paused) el.pause(); } catch (e) {}
    try { if (ctx && mode === 'synth' && ctx.state === 'running') ctx.suspend(); } catch (e2) {}
  }
  function resume() {
    try { if (el && mode === 'file' && el.paused && !el.ended) { var p = el.play(); if (p && p.catch) p.catch(function () {}); } } catch (e) {}
    try { if (ctx && mode === 'synth' && ctx.state === 'suspended') ctx.resume(); } catch (e2) {}
  }

  /* ===================== الصوت الاحتياطي المولَّد ===================== */
  var N = { D3: 146.83, A3: 220.0, D4: 293.66, Eb4: 311.13, Fs4: 369.99, G4: 392.0, A4: 440.0, Bb4: 466.16,
            C5: 523.25, D5: 587.33, Eb5: 622.25, Fs5: 739.99, G5: 783.99, A5: 880.0, D6: 1174.66 };

  function getNoise() {
    if (noiseBuf) return noiseBuf;
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function startSynth() {
    var T = C.t;
    var T0 = ctx.currentTime + 0.15;
    synthT0 = T0;
    function S(sec) { return T0 + sec; }
    function ms(v) { return v / 1000; }

    session = ctx.createGain(); session.gain.value = 1; session.connect(master);
    var music = ctx.createGain(); music.connect(session);   // يُخفَض لحظة الصمت
    var fx = ctx.createGain(); fx.connect(session);         // لا يُخفَض

    /* صدى مشترك */
    var send = ctx.createGain(); send.gain.value = 0.5;
    var dly = ctx.createDelay(1.0); dly.delayTime.value = 0.34;
    var fb = ctx.createGain(); fb.gain.value = 0.38;
    var dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    var wet = ctx.createGain(); wet.gain.value = 0.55;
    send.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(wet); wet.connect(session);

    function env(g, t0, a, peak, d) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    }
    function tone(o) {
      var os = ctx.createOscillator();
      os.type = o.type || 'sine';
      os.frequency.setValueAtTime(o.f0, o.t);
      if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, o.t + (o.fd || o.d));
      if (o.detune) os.detune.value = o.detune;
      var a = o.a || 0.005;
      var g = ctx.createGain(); env(g, o.t, a, o.peak, o.d);
      os.connect(g); g.connect(o.dest);
      if (o.send) { var sg = ctx.createGain(); sg.gain.value = o.send; g.connect(sg); sg.connect(send); }
      os.start(o.t); os.stop(o.t + a + o.d + 0.05);
    }
    function burst(o) {
      var src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = o.ftype || 'bandpass'; f.Q.value = o.q || 0.8;
      f.frequency.setValueAtTime(o.f0, o.t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, o.t + (o.fd || o.dur));
      var a = o.a || 0.003;
      var g = ctx.createGain(); env(g, o.t, a, o.peak, o.dur);
      src.connect(f); f.connect(g); g.connect(o.dest);
      src.start(o.t, Math.random() * 1.5); src.stop(o.t + a + o.dur + 0.05);
    }
    function pluck(f, t, v) {          // سنطور مُحاكى
      v = v || 1;
      tone({ type: 'triangle', f0: f, t: t, a: 0.004, d: 1.3, peak: 0.22 * v, dest: music, send: 0.55 });
      tone({ type: 'triangle', f0: f, t: t, a: 0.004, d: 1.0, peak: 0.12 * v, dest: music, detune: 6 });
      tone({ type: 'sine', f0: f * 2, t: t, a: 0.003, d: 0.5, peak: 0.06 * v, dest: music });
      burst({ t: t, dur: 0.02, peak: 0.05 * v, ftype: 'highpass', f0: 3000, dest: music });
    }
    function kick(t, peak, dest) {
      tone({ f0: 160, f1: 44, fd: 0.11, t: t, a: 0.003, d: 0.3, peak: peak, dest: dest });
      tone({ f0: 48, t: t, a: 0.005, d: 0.35, peak: peak * 0.3, dest: dest });
    }
    function tom(t, vel, pitch) {
      tone({ f0: pitch * 2.2, f1: pitch, fd: 0.16, t: t, a: 0.003, d: 0.28, peak: 0.5 * vel, dest: music });
      burst({ t: t, dur: 0.08, peak: 0.12 * vel, f0: 500, dest: music });
    }
    var i, k;

    /* ---- 1) درون سفلي ---- */
    var droneG = ctx.createGain();
    droneG.gain.setValueAtTime(0.0001, T0);
    droneG.gain.linearRampToValueAtTime(0.28, S(6));
    droneG.gain.linearRampToValueAtTime(0.38, S(15));
    droneG.gain.linearRampToValueAtTime(0.55, S(23.9));
    droneG.gain.setValueAtTime(0.55, S(ms(T.impact)));
    droneG.gain.linearRampToValueAtTime(0.0001, S(ms(T.impact) + 0.3));
    var dF = ctx.createBiquadFilter(); dF.type = 'lowpass';
    dF.frequency.setValueAtTime(140, T0);
    dF.frequency.linearRampToValueAtTime(420, S(15));
    dF.frequency.linearRampToValueAtTime(1500, S(23.9));
    dF.connect(droneG); droneG.connect(music);
    [['sawtooth', 73.42, 0], ['sawtooth', 73.42, 9], ['sine', 36.71, 0]].forEach(function (d) {
      var os = ctx.createOscillator(); os.type = d[0]; os.frequency.value = d[1]; os.detune.value = d[2];
      os.connect(dF); os.start(T0); os.stop(S(ms(T.impact) + 0.5));
    });

    /* ---- 2) رنّات معدنية متفرقة + طقطقة جمر ---- */
    [1.2, 3.8, 5.5, 8.1, 11.7, 13.9, 17.2, 19.6].forEach(function (t) {
      var base = 1200 + Math.random() * 900;
      tone({ type: 'sine', f0: base, t: S(t), a: 0.003, d: 1.6, peak: 0.035, dest: music, send: 0.8 });
      tone({ type: 'sine', f0: base * 1.5, t: S(t), a: 0.003, d: 1.2, peak: 0.02, dest: music, send: 0.8 });
    });
    var span = ms(T.deepBeat) - 1.4;
    for (i = 0; i < 150; i++) {
      var ct = Math.pow(Math.random(), 0.7) * span;
      burst({ t: S(ct), dur: 0.015 + Math.random() * 0.02, peak: 0.02 + Math.random() * 0.05 * (ct / span),
              ftype: 'highpass', f0: 3500, dest: music });
    }

    /* ---- 3) نبضات القلب ---- */
    C.beats.forEach(function (b) {
      var t = S(ms(b.t));
      if (b.deep) {
        tone({ f0: 70, f1: 32, fd: 0.6, t: t, a: 0.004, d: 1.0, peak: 1.0, dest: fx });
        burst({ t: t, dur: 0.3, peak: 0.15, ftype: 'lowpass', f0: 400, dest: fx });
      } else {
        tone({ f0: 110 + 30 * (b.s < 0.6 ? 1 : 0), f1: 45, fd: 0.15, t: t, a: 0.003, d: 0.3, peak: 0.85 * b.s, dest: music });
      }
    });

    /* ---- 4) طبول قبلية متصاعدة ---- */
    var step = 0;
    for (var tt = 8.5; tt < 23.4; tt += 0.25, step++) {
      var s8 = step % 8, hit = false, vel = 0.7;
      if (tt < 15) { hit = (s8 === 0 || s8 === 3 || s8 === 6); }
      else if (tt < 20) { hit = [0, 2, 3, 5, 6, 7].indexOf(s8) >= 0; vel = 0.85; if (s8 === 4) burst({ t: S(tt), dur: 0.12, peak: 0.2, f0: 1800, q: 1.2, dest: music }); }
      else { hit = true; vel = 0.6 + (tt - 20) / 3.4 * 0.5; }
      if (hit) tom(S(tt), vel * (s8 === 0 ? 1.15 : 1), s8 % 2 ? 80 : 68);
    }

    /* ---- 5) سنطور مُحاكى (مقام حجاز على الرّي) ---- */
    var motif = [[0, 'D4'], [0.5, 'Eb4'], [1, 'Fs4'], [1.5, 'G4'], [2, 'Fs4'], [2.5, 'Eb4'], [3, 'D4']];
    for (var b = 6; b <= 22; b += 4) {
      motif.forEach(function (m) {
        pluck(N[m[1]], S(b + m[0]), 0.9);
        if (b >= 14) pluck(N[m[1]] * 2, S(b + m[0] + 0.02), 0.45);
      });
    }

    /* ---- 6) رايزر التوتر ---- */
    burst({ t: S(14), a: 9.6, dur: 0.3, fd: 9.9, peak: 0.3, f0: 300, f1: 7000, q: 1.5, dest: music });
    tone({ f0: 200, f1: 1800, fd: 9.5, t: S(14), a: 9.4, d: 0.4, peak: 0.08, dest: music });

    /* ---- 7) لحظة الصمت (إخفاض ناعم بدون فرقعة) ---- */
    var silA = ms(T.silenceStart) - 0.2, silB = ms(T.impact);
    music.gain.setValueAtTime(1, S(silA));
    music.gain.linearRampToValueAtTime(0.0001, S(silA + 0.2));
    music.gain.setValueAtTime(1, S(silB));

    /* ---- 8) لحظة الكشف: انفجار + Drop ---- */
    var I = ms(T.impact);
    tone({ f0: 70, f1: 28, fd: 1.4, t: S(I), a: 0.004, d: 1.6, peak: 1.0, dest: fx });
    burst({ t: S(I), dur: 1.6, fd: 1.6, peak: 0.55, ftype: 'lowpass', f0: 9000, f1: 300, dest: fx });
    burst({ t: S(I), dur: 2.5, peak: 0.22, ftype: 'highpass', f0: 3000, dest: fx });
    for (i = 0; i < 90; i++) {
      var ft = Math.pow(Math.random(), 1.6) * 4.8;
      burst({ t: S(I + ft), dur: 0.02 + Math.random() * 0.03, peak: 0.04 + Math.random() * 0.08,
              ftype: 'highpass', f0: 2500 + Math.random() * 2000, dest: music });
    }
    var DROP_END = ms(T.ctaIn) - 0.7;      // ≈ 33.8
    var bassG = ctx.createGain();
    bassG.gain.setValueAtTime(0.0001, S(I));
    var bassF = ctx.createBiquadFilter(); bassF.type = 'lowpass'; bassF.Q.value = 6; bassF.frequency.value = 380;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 2; var lfoG = ctx.createGain(); lfoG.gain.value = 220;
    lfo.connect(lfoG); lfoG.connect(bassF.frequency);
    var bassOsc = ctx.createOscillator(); bassOsc.type = 'sawtooth';
    var bassSub = ctx.createOscillator(); bassSub.type = 'sine';
    var bf = [73.42, 77.78, 73.42, 98.0, 73.42];
    for (k = 0; k < bf.length; k++) {
      bassOsc.frequency.setValueAtTime(bf[k], S(I + 2 * k));
      bassSub.frequency.setValueAtTime(bf[k] / 2, S(I + 2 * k));
    }
    bassOsc.connect(bassF); bassSub.connect(bassF); bassF.connect(bassG); bassG.connect(music);
    for (k = 0; k <= 16; k++) {          // كيك + ضغط جانبي للباس
      var kt = I + k * 0.5;
      kick(S(kt), 0.95, music);
      bassG.gain.setValueAtTime(0.08, S(kt));
      bassG.gain.linearRampToValueAtTime(0.45, S(kt + 0.28));
    }
    bassG.gain.setValueAtTime(0.45, S(DROP_END - 0.1));
    bassG.gain.linearRampToValueAtTime(0.0001, S(DROP_END + 0.2));
    lfo.start(S(I)); bassOsc.start(S(I)); bassSub.start(S(I));
    lfo.stop(S(DROP_END + 0.4)); bassOsc.stop(S(DROP_END + 0.4)); bassSub.stop(S(DROP_END + 0.4));

    for (k = 0; k < 17; k++) {           // هاي-هات وتصفيق
      burst({ t: S(I + 0.25 + k * 0.5), dur: 0.05, peak: 0.09, ftype: 'highpass', f0: 8000, dest: music });
      burst({ t: S(I + k * 0.5), dur: 0.04, peak: 0.03, ftype: 'highpass', f0: 8000, dest: music });
    }
    for (k = 0; k < 8; k++) {
      burst({ t: S(I + 0.5 + k), dur: 0.13, peak: 0.22, f0: 1700, q: 1.2, dest: music });
    }
    var leadF = ctx.createBiquadFilter(); leadF.type = 'lowpass'; leadF.frequency.value = 3200; leadF.connect(music);
    var P0 = ['D4', 'Fs4', 'A4', 'D5', 'A4', 'Fs4', 'A4', 'Fs4'];
    var P1 = ['Eb4', 'G4', 'Bb4', 'D5', 'Bb4', 'G4', 'Bb4', 'G4'];
    var P2 = ['G4', 'Bb4', 'D5', 'G5', 'D5', 'Bb4', 'D5', 'Bb4'];
    var bars = [P0, P1, P0, P2];
    for (var bar = 0; bar < 4; bar++) {
      for (k = 0; k < 8; k++) {
        var f = N[bars[bar][k]], nt = S(I + bar * 2 + k * 0.25);
        tone({ type: 'sawtooth', f0: f, t: nt, a: 0.004, d: 0.22, peak: 0.055, dest: leadF, send: 0.35 });
        tone({ type: 'sawtooth', f0: f, t: nt, a: 0.004, d: 0.22, peak: 0.04, dest: leadF, detune: 9 });
      }
    }
    var motif2 = [[0, 'D5'], [0.5, 'Eb5'], [1, 'Fs5'], [1.5, 'G5'], [2, 'A5'], [2.5, 'G5'], [3, 'Fs5'], [3.5, 'Eb5']];
    [0, 4].forEach(function (off) {
      motif2.forEach(function (m) { pluck(N[m[1]], S(I + off + m[0]), 0.85); });
    });

    /* ---- 9) الخاتمة المهيبة ---- */
    var F = ms(T.ctaIn) - 0.5;            // ≈ 34.0
    tone({ f0: 80, f1: 30, fd: 0.8, t: S(F), a: 0.004, d: 1.6, peak: 0.9, dest: fx });
    burst({ t: S(F), dur: 1.2, fd: 1.2, peak: 0.25, ftype: 'lowpass', f0: 6000, f1: 400, dest: fx });
    [N.D3, N.A3, N.D4, N.Fs4].forEach(function (f, idx) {
      tone({ type: 'sawtooth', f0: f, t: S(F), a: 0.2, d: 3.8, peak: 0.07, dest: fx, detune: idx * 4 });
    });
    [N.D5, N.Fs5, N.A5, N.D6, N.A5].forEach(function (f, idx) { pluck(f, S(F + idx * 0.12), 0.8); });
    pluck(N.D5, S(F + 0.9), 1);
    session.gain.setValueAtTime(1, S(F + 2.4));
    session.gain.linearRampToValueAtTime(0, S(F + 5.0));
  }

  global.IraqAudio = {
    start: start, stop: stop, setMuted: setMuted, isMuted: isMuted,
    clockMs: clockMs, pause: pause, resume: resume, getMode: getMode
  };
})(window);
