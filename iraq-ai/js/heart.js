/* =====================================================================
   العراق AI — القلب الناري والجسيمات (Canvas 2D)
   تطوير: مصطفى حسين — Mustafa Hussein

   قلب حممي: قشرة بركانية، شقوق متوهجة، نواة نابضة، لهب على الحواف، جمر،
   دخان، موجات طاقة، شرارات، وتشكيل الرقم 1 من الجسيمات.
   تفاعل: ماوس/لمس (ميلان منظوري، إضاءة، جذب جسيمات، آثار، نقر = موجة).
   ثلاث مستويات جودة تتبدّل تلقائياً عند ضعف الأداء.
   ===================================================================== */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }

  function sprite(r, g, b) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d');
    var gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    gr.addColorStop(0.25, 'rgba(' + r + ',' + g + ',' + b + ',0.55)');
    gr.addColorStop(0.6, 'rgba(' + r + ',' + g + ',' + b + ',0.12)');
    gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return c;
  }
  function smokeSprite() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d');
    var gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(78,52,42,0.55)');
    gr.addColorStop(0.5, 'rgba(60,40,34,0.22)');
    gr.addColorStop(1, 'rgba(40,26,22,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return c;
  }

  /* محيط القلب (وحدات ≈ 16 نصف العرض، مُمركَز عند 0,0) */
  var HEART_PTS = (function () {
    var pts = [], n = 160;
    for (var i = 0; i < n; i++) {
      var t = i / n * TAU;
      var x = 16 * Math.pow(Math.sin(t), 3);
      var y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 2.5;
      pts.push([x, y]);
    }
    return pts;
  })();

  var PRESETS = [
    { embers: 95, flame: 140, smoke: 24, spark: 700, num: 950, cracks: 16, blobs: 9, dpr: 2,   flameRate: 90 },
    { embers: 60, flame: 90,  smoke: 10, spark: 420, num: 600, cracks: 12, blobs: 6, dpr: 1.5, flameRate: 55 },
    { embers: 30, flame: 50,  smoke: 0,  spark: 220, num: 340, cracks: 9,  blobs: 4, dpr: 1,   flameRate: 30 }
  ];

  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var q = clamp(opts.quality || 0, 0, 2);
    var reduced = !!opts.reducedMotion;
    var P = PRESETS[q];

    var W = 1, H = 1, dpr = 1, baseS = 10;
    var st = { appear: 0, intensity: 0.12, beat: 0, timeScale: 1, heartAlpha: 1, cx: 0.5, cy: 0.45, scale: 1, shake: 0 };
    var ptr = { x: -1e4, y: -1e4, vx: 0, vy: 0, active: false, nx: 0, ny: 0, sx: 0, sy: 0, touch: false, lastT: 0 };
    var prox = 0, time = 0, lastNow = 0, frames = 0, emaDt = 16, slowFrames = 0;
    var heartPath = null, cracks = [], crackGroups = [[], [], []], blobs = [];
    var embers = [], flames = [], smokes = [], sparks = [], waves = [], conv = [], numP = [];
    var flameAcc = 0, smokeAcc = 0, convAcc = 0, numGlow = 0, numCenter = { x: 0, y: 0 };
    var g = { hx: 0, hy: 0, k: 1, halfW: 100, halfH: 90, ox: 0, oy: 0, rotX: 0, rotY: 0, ieff: 0.12 };

    var spr = { orange: sprite(255, 125, 35), red: sprite(255, 55, 20), gold: sprite(255, 214, 130), white: sprite(255, 244, 220) };
    var smokeSpr = smokeSprite();

    /* ---------- بناء الهندسة ---------- */
    function buildHeart() {
      heartPath = new Path2D();
      for (var i = 0; i < HEART_PTS.length; i++) {
        var p = HEART_PTS[i];
        if (i === 0) heartPath.moveTo(p[0] * baseS, p[1] * baseS); else heartPath.lineTo(p[0] * baseS, p[1] * baseS);
      }
      heartPath.closePath();
    }
    function genCracks() {
      cracks = []; crackGroups = [[], [], []];
      var n = P.cracks;
      function walk(x, y, ang, steps, grp, depth) {
        var pts = [[x, y]];
        for (var s = 0; s < steps; s++) {
          ang += rnd(-0.7, 0.7);
          var l = rnd(1.4, 2.8) * baseS;
          x += Math.cos(ang) * l; y += Math.sin(ang) * l;
          pts.push([x, y]);
          if (depth < 1 && Math.random() < 0.28) walk(x, y, ang + rnd(-1.2, 1.2), Math.floor(rnd(2, 4)), grp, depth + 1);
        }
        var c = { pts: pts }; cracks.push(c); crackGroups[grp].push(c);
      }
      for (var i = 0; i < n; i++) {
        walk(rnd(-3, 3) * baseS, rnd(-3, 3) * baseS, i / n * TAU + rnd(-0.3, 0.3), Math.floor(rnd(5, 9)), i % 3, 0);
      }
    }
    function genBlobs() {
      blobs = [];
      for (var i = 0; i < P.blobs; i++) {
        blobs.push({ a: rnd(0, TAU), sp: rnd(0.15, 0.5), rx: rnd(2, 9) * baseS, ry: rnd(2, 8) * baseS,
                     r: rnd(4, 9) * baseS, k: rnd(0.6, 1), s: i % 3 === 0 ? spr.red : spr.orange });
      }
    }
    function initEmbers() {
      embers = [];
      var cnt = Math.round(P.embers * (reduced ? 0.6 : 1));
      for (var i = 0; i < cnt; i++) embers.push(newEmber(true));
    }
    function newEmber(anywhere) {
      return { x: rnd(0, W), y: anywhere ? rnd(0, H) : H + rnd(0, 30), vx: rnd(-6, 6), vy: -rnd(12, 46),
               r: rnd(0.8, 2.4), a: rnd(0.45, 1), ph: rnd(0, TAU), fs: rnd(0.8, 2.2), wob: rnd(4, 18),
               avx: 0, avy: 0, vis: 0, gold: Math.random() < 0.4 };
    }

    function resize() {
      W = Math.max(1, canvas.clientWidth || global.innerWidth || 1);
      H = Math.max(1, canvas.clientHeight || global.innerHeight || 1);
      dpr = Math.min(global.devicePixelRatio || 1, P.dpr);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      baseS = Math.min(W * 0.30, H * 0.23) / 16;
      buildHeart(); genCracks(); genBlobs(); initEmbers();
    }

    function setQuality(n) {
      q = clamp(n, 0, 2); P = PRESETS[q];
      flames.length = Math.min(flames.length, P.flame);
      smokes.length = Math.min(smokes.length, P.smoke);
      sparks.length = Math.min(sparks.length, P.spark);
      resize();
      if (opts.onQuality) opts.onQuality(q);
    }

    /* ---------- تفاعل ---------- */
    function setPointer(x, y, active, touch) {
      var now = global.performance ? performance.now() : Date.now();
      var dtp = Math.max(1, now - ptr.lastT);
      if (active && ptr.active) { ptr.vx = (x - ptr.x) / dtp * 1000; ptr.vy = (y - ptr.y) / dtp * 1000; }
      ptr.x = x; ptr.y = y; ptr.active = !!active; ptr.touch = !!touch; ptr.lastT = now;
      if (active) { ptr.nx = clamp((x / W - 0.5) * 2, -1, 1); ptr.ny = clamp((y / H - 0.5) * 2, -1, 1); }
      else { ptr.nx = 0; ptr.ny = 0; }
      if (active && st.appear > 0.6) {
        var d = Math.hypot(x - g.hx, y - g.hy);
        if (d < g.halfW * 1.8) {
          var sp = Math.hypot(ptr.vx, ptr.vy);
          if (sp > 40 && Math.random() < 0.7) spawnSpark(x, y, rnd(0, TAU), rnd(15, 60), rnd(0.3, 0.7), 1.3, -20, 0);
        }
      }
    }
    function tap(x, y) {
      var d = Math.hypot(x - g.hx, y - g.hy);
      var near = st.appear > 0.5 && st.heartAlpha > 0.5 && d < g.halfW * 1.15;
      if (near) {
        addWave(g.hx, g.hy, 420, Math.max(W, H) * 0.45, 6, 0.8);
        burst(x, y, Math.round(P.spark / 18), 120, 380, 1.8);
        st.beat = Math.max(st.beat, 0.8);
      } else {
        burst(x, y, Math.round(P.spark / 45), 60, 220, 1.4);
      }
    }
    function reveal() {
      addWave(g.hx, g.hy, 900, Math.hypot(W, H), 9, 0.9);
      addWave(g.hx, g.hy, 620, Math.hypot(W, H) * 0.8, 5, 0.6);
      burst(g.hx, g.hy, Math.round(P.spark / 5), 300, 1100, 2.2);
      st.shake = reduced ? 0 : 1; st.beat = Math.max(st.beat, 1.4);
    }

    /* ---------- جسيمات ---------- */
    function spawnSpark(x, y, ang, speed, life, size, grav, gold) {
      if (sparks.length >= P.spark) return;
      sparks.push({ x: x, y: y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: life, max: life, size: size, g: grav, gold: gold || (Math.random() < 0.45 ? 1 : 0) });
    }
    function burst(x, y, n, smin, smax, size) {
      for (var i = 0; i < n; i++) spawnSpark(x, y, rnd(0, TAU), rnd(smin, smax), rnd(1.0, 2.4), size * rnd(0.7, 1.3), 150, 0);
    }
    function addWave(x, y, speed, max, w, a) { waves.push({ x: x, y: y, r: 8, speed: speed, max: max, w: w, a: a }); }

    /* الرقم 1 */
    function sampleOne() {
      var nh = Math.min(H * 0.46, W * 0.95, 520), nw = Math.ceil(nh * 0.62); nh = Math.ceil(nh);
      var c = document.createElement('canvas'); c.width = nw; c.height = nh;
      var x = c.getContext('2d');
      x.fillStyle = '#fff'; x.beginPath();
      var poly = [[0.50, 0], [0.74, 0], [0.74, 1], [0.50, 1], [0.50, 0.21], [0.24, 0.34], [0.24, 0.15]];
      for (var i = 0; i < poly.length; i++) { var px = poly[i][0] * nw, py = poly[i][1] * nh; if (i === 0) x.moveTo(px, py); else x.lineTo(px, py); }
      x.closePath(); x.fill();
      var step = Math.max(2, Math.round(Math.sqrt(0.32 * nw * nh / P.num)));
      var data = x.getImageData(0, 0, nw, nh).data, pts = [];
      for (var yy = 0; yy < nh; yy += step) {
        for (var xx = 0; xx < nw; xx += step) {
          var jx = Math.min(nw - 1, Math.floor(xx + Math.random() * step)), jy = Math.min(nh - 1, Math.floor(yy + Math.random() * step));
          if (data[(jy * nw + jx) * 4 + 3] > 128) pts.push([jx - nw / 2, jy - nh / 2]);
        }
      }
      return pts;
    }
    function formNumber() {
      var pts = sampleOne();
      numCenter.x = W * st.cx; numCenter.y = H * st.cy;
      numP = [];
      for (var i = 0; i < pts.length; i++) {
        var ang = rnd(0, TAU), sp = rnd(120, 700);
        numP.push({ x: numCenter.x + rnd(-8, 8), y: numCenter.y + rnd(-8, 8), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                    tx: numCenter.x + pts[i][0], ty: numCenter.y + pts[i][1], d: rnd(0, 0.35), s: rnd(0.9, 1.9), ph: rnd(0, TAU),
                    rel: false, life: 0, gold: Math.random() < 0.6 });
      }
      numGlow = 0.0001;
    }
    function releaseNumber() {
      for (var i = 0; i < numP.length; i++) { var p = numP[i]; p.rel = true; p.life = rnd(1.6, 3.2); p.vx = rnd(-40, 40); p.vy = -rnd(40, 130); }
      numGlow = -1;
    }

    function reset() {
      flames.length = 0; smokes.length = 0; sparks.length = 0; waves.length = 0; conv.length = 0; numP = []; numGlow = 0;
      st.appear = 0; st.intensity = 0.12; st.beat = 0; st.timeScale = 1; st.heartAlpha = 1; st.shake = 0; time = 0;
    }
    function clearTransient() { sparks.length = 0; waves.length = 0; conv.length = 0; numP = []; numGlow = 0; st.shake = 0; st.beat = 0; }

    /* ---------- الرسم ---------- */
    function computeGeom() {
      var pul = 1 + st.beat * 0.06 + Math.sin(time * 1.4) * 0.008;
      var ap = easeOut(st.appear), m = reduced ? 0 : 1;
      g.k = st.scale * (0.55 + 0.45 * ap) * pul;
      g.ox = ptr.sx * baseS * 1.2 * m; g.oy = ptr.sy * baseS * 0.9 * m;
      g.hx = W * st.cx + g.ox; g.hy = H * st.cy + g.oy;
      g.halfW = 16 * baseS * g.k; g.halfH = 14.5 * baseS * g.k;
      g.rotY = ptr.sx * 0.5 * m; g.rotX = ptr.sy * 0.3 * m;
      g.ieff = clamp(st.intensity + prox * 0.35, 0, 2);
    }

    function drawFloor() {
      var a = easeOut(st.appear) * st.heartAlpha; if (a < 0.01) return;
      var rw = g.halfW * 1.9, rh = g.halfH * 0.3, cy = g.hy + g.halfH * 1.4;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(0.5 * a * (0.4 + g.ieff * 0.5) * (1 + st.beat * 0.5), 0, 0.9);
      ctx.drawImage(spr.orange, g.hx - rw, cy - rh, rw * 2, rh * 2);
      ctx.globalAlpha *= 0.55;
      ctx.drawImage(spr.gold, g.hx - rw * 0.55, cy - rh * 0.35, rw * 1.1, rh * 0.7);
      ctx.restore();
    }
    function drawGlow() {
      var a = easeOut(st.appear) * st.heartAlpha; if (a < 0.01) return;
      var r = g.halfW * 3.2 * (1 + st.beat * 0.08);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(0.55 * a * (0.45 + 0.45 * g.ieff) * (1 + st.beat * 0.3), 0, 1);
      ctx.drawImage(spr.orange, g.hx - r, g.hy - r, r * 2, r * 2);
      ctx.globalAlpha *= 0.55;
      var r2 = r * 1.6; ctx.drawImage(spr.red, g.hx - r2, g.hy - r2, r2 * 2, r2 * 2);
      ctx.restore();
    }

    function strokeGroup(i) {
      var grp = crackGroups[i]; ctx.beginPath();
      for (var a = 0; a < grp.length; a++) {
        var pts = grp[a].pts; ctx.moveTo(pts[0][0], pts[0][1]);
        for (var b = 1; b < pts.length; b++) ctx.lineTo(pts[b][0], pts[b][1]);
      }
      ctx.stroke();
    }
    function drawHeart() {
      var a = easeOut(st.appear) * st.heartAlpha; if (a < 0.01) return;
      var I = g.ieff, i;
      ctx.save();
      ctx.translate(g.hx, g.hy);
      ctx.transform(g.k * (1 - Math.abs(g.rotY) * 0.08), 0, g.k * g.rotY * 0.14, g.k * (1 - Math.abs(g.rotX) * 0.05), 0, 0);
      ctx.globalAlpha = a;
      var lx = ptr.sx * baseS * 4, ly = ptr.sy * baseS * 4 - baseS * 3;
      var gr = ctx.createRadialGradient(lx, ly, baseS, 0, 0, baseS * 20);
      gr.addColorStop(0, '#8a1c0a'); gr.addColorStop(0.45, '#4a0e07'); gr.addColorStop(0.8, '#1d0604'); gr.addColorStop(1, '#0d0303');
      ctx.fillStyle = gr; ctx.fill(heartPath);

      ctx.save(); ctx.clip(heartPath);
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < blobs.length; i++) {
        var bl = blobs[i], ang = time * bl.sp + bl.a;
        ctx.globalAlpha = a * clamp((0.22 + 0.28 * I + st.beat * 0.25) * bl.k, 0, 0.75);
        ctx.drawImage(bl.s, Math.cos(ang) * bl.rx - bl.r, Math.sin(ang * 1.3) * bl.ry - bl.r, bl.r * 2, bl.r * 2);
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var gi = 0; gi < 3; gi++) {
        var fl = 0.6 + 0.4 * Math.sin(time * (2.1 + gi * 0.9) + gi * 2.0);
        var base = clamp((0.45 + 0.45 * I) * fl + st.beat * 0.4, 0, 1.2);
        ctx.globalAlpha = a * clamp(base * 0.35, 0, 1); ctx.strokeStyle = '#ff4d14'; ctx.lineWidth = baseS * 0.75; strokeGroup(gi);
        ctx.globalAlpha = a * clamp(base, 0, 1); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = baseS * 0.22; strokeGroup(gi);
      }
      var coreA = clamp(0.5 + 0.4 * I + st.beat * 0.7, 0, 1);
      ctx.globalAlpha = a * coreA;
      var cr = baseS * 11 * (1 + st.beat * 0.12), cyy = -baseS * 1.5;
      ctx.drawImage(spr.orange, -cr * 1.5, cyy - cr * 1.5, cr * 3, cr * 3);
      ctx.drawImage(spr.gold, -cr, cyy - cr, cr * 2, cr * 2);
      ctx.drawImage(spr.white, -cr * 0.55, cyy - cr * 0.55, cr * 1.1, cr * 1.1);
      ctx.restore();

      ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
      ctx.globalAlpha = a * 0.18 * (0.6 + I * 0.5); ctx.lineWidth = baseS * 1.1; ctx.strokeStyle = '#ff6a1f'; ctx.stroke(heartPath);
      ctx.globalAlpha = a * clamp(0.55 + 0.3 * I, 0, 1); ctx.lineWidth = baseS * 0.28; ctx.strokeStyle = '#ffb04a'; ctx.stroke(heartPath);
      ctx.restore();
    }

    function updEmbers(sdt, dt) {
      var active = Math.floor(embers.length * clamp(0.18 + g.ieff * 0.7, 0.12, 1));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < embers.length; i++) {
        var e = embers[i];
        e.vis += ((i < active ? 1 : 0) - e.vis) * Math.min(1, dt * 3);
        if (e.vis < 0.02) continue;
        e.ph += sdt * e.fs;
        if (ptr.active) {
          var dx = ptr.x - e.x, dy = ptr.y - e.y, d2 = dx * dx + dy * dy;
          if (d2 < 28900 && d2 > 4) {
            var d = Math.sqrt(d2), f = 1 - d / 170;
            e.avx += dx / d * f * 900 * dt; e.avy += dy / d * f * 900 * dt;
          }
        }
        var dmp = Math.pow(0.12, dt); e.avx *= dmp; e.avy *= dmp;
        e.x += (e.vx + Math.sin(e.ph) * e.wob + e.avx) * sdt;
        e.y += (e.vy + e.avy) * sdt;
        if (e.y < -12 || e.x < -20 || e.x > W + 20) { var n = newEmber(false); e.x = n.x; e.y = n.y; e.vx = n.vx; e.vy = n.vy; e.avx = e.avy = 0; }
        var s = e.r * (1 + st.beat * 0.3) * 3.2;
        ctx.globalAlpha = e.a * e.vis * (0.55 + 0.45 * Math.sin(e.ph * 2.1));
        ctx.drawImage(e.gold ? spr.gold : spr.orange, e.x - s, e.y - s, s * 2, s * 2);
      }
      ctx.restore();
    }

    function updSmoke(sdt) {
      if (P.smoke <= 0) return;
      var a = easeOut(st.appear) * st.heartAlpha;
      if (a > 0.3) {
        smokeAcc += sdt * 2.5 * g.ieff;
        while (smokeAcc > 1 && smokes.length < P.smoke) {
          smokeAcc -= 1;
          smokes.push({ x: g.hx + rnd(-g.halfW * 0.7, g.halfW * 0.7), y: g.hy - g.halfH * rnd(0.2, 0.9), vx: rnd(-10, 10), vy: -rnd(18, 40), life: rnd(3, 5), age: 0, r: g.halfW * rnd(0.3, 0.5) });
        }
        if (smokeAcc > 1) smokeAcc = 0;
      }
      for (var i = smokes.length - 1; i >= 0; i--) {
        var s = smokes[i]; s.age += sdt;
        if (s.age >= s.life) { smokes.splice(i, 1); continue; }
        s.x += s.vx * sdt; s.y += s.vy * sdt;
        var p = s.age / s.life, r = s.r * (0.7 + p * 1.2);
        ctx.globalAlpha = 0.35 * Math.min(1, p * 4) * (1 - p);
        ctx.drawImage(smokeSpr, s.x - r, s.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }

    function updFlames(sdt) {
      var a = easeOut(st.appear) * st.heartAlpha;
      if (a > 0.2) {
        flameAcc += sdt * P.flameRate * (reduced ? 0.5 : 1) * g.ieff * a;
        while (flameAcc >= 1) {
          flameAcc -= 1;
          if (flames.length >= P.flame) { flameAcc = 0; break; }
          var pt = HEART_PTS[(Math.random() * HEART_PTS.length) | 0], px = pt[0], py = pt[1];
          var len = Math.hypot(px, py) || 1;
          flames.push({ x: g.hx + px * baseS * g.k, y: g.hy + py * baseS * g.k, vx: px / len * rnd(5, 35) + rnd(-12, 12), vy: -rnd(35, 110) + py / len * 10,
                        life: rnd(0.5, 1.2), age: 0, size: rnd(0.9, 2.2) * baseS * g.k, ph: rnd(0, TAU) });
        }
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (var i = flames.length - 1; i >= 0; i--) {
        var f = flames[i]; f.age += sdt;
        if (f.age >= f.life) { flames.splice(i, 1); continue; }
        f.x += (f.vx + Math.sin(time * 8 + f.ph) * 8) * sdt; f.y += f.vy * sdt;
        var p = f.age / f.life, r = f.size * (1 - p * 0.5) * 1.6;
        ctx.globalAlpha = clamp((1 - p) * 0.75, 0, 1);
        ctx.drawImage(p < 0.35 ? spr.gold : (p < 0.7 ? spr.orange : spr.red), f.x - r, f.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }

    function updConv(sdt) {
      if (st.appear > 0.02 && st.appear < 0.97) {
        convAcc += sdt * 70 * (1 - st.appear * 0.3) * (reduced ? 0.4 : 1) * (q === 2 ? 0.5 : 1);
        while (convAcc >= 1) {
          convAcc -= 1;
          if (conv.length >= 60) { convAcc = 0; break; }
          var d0 = rnd(0.25, 0.6) * Math.max(W, H);
          conv.push({ ang: rnd(0, TAU), d: d0, d0: d0, len: rnd(40, 120) });
        }
      }
      if (!conv.length) return;
      var cx = W * st.cx, cy = H * st.cy;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (var i = conv.length - 1; i >= 0; i--) {
        var c = conv[i];
        c.d -= (200 + (1 - c.d / c.d0) * 900) * sdt;
        if (c.d < 8) { conv.splice(i, 1); continue; }
        var x1 = cx + Math.cos(c.ang) * c.d, y1 = cy + Math.sin(c.ang) * c.d;
        var x2 = cx + Math.cos(c.ang) * (c.d + c.len * (c.d / c.d0)), y2 = cy + Math.sin(c.ang) * (c.d + c.len * (c.d / c.d0));
        ctx.globalAlpha = 0.5 * (1 - c.d / c.d0 * 0.5); ctx.strokeStyle = '#ff2d12'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.restore();
    }

    function updWaves(sdt) {
      if (!waves.length) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (var i = waves.length - 1; i >= 0; i--) {
        var w = waves[i]; w.r += w.speed * sdt;
        var p = w.r / w.max; if (p >= 1) { waves.splice(i, 1); continue; }
        var al = Math.pow(1 - p, 1.5) * w.a;
        ctx.globalAlpha = al * 0.55; ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 2 + (1 - p) * w.w * 2;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = al; ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1 + (1 - p) * w.w * 0.5;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }

    function updSparks(sdt) {
      if (!sparks.length) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,160,60,0.55)';
      ctx.beginPath();
      var drag = Math.pow(0.985, sdt * 60), i, s;
      for (i = sparks.length - 1; i >= 0; i--) {
        s = sparks[i]; s.life -= sdt;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        s.vx *= drag; s.vy *= drag; s.vy += s.g * sdt;
        s.x += s.vx * sdt; s.y += s.vy * sdt;
        ctx.moveTo(s.x - s.vx * 0.025, s.y - s.vy * 0.025); ctx.lineTo(s.x, s.y);
      }
      ctx.lineWidth = 1.4; ctx.stroke();
      for (i = 0; i < sparks.length; i++) {
        s = sparks[i]; var p = s.life / s.max, r = s.size * 3.2 * (0.5 + p * 0.5);
        ctx.globalAlpha = clamp(p * 1.2, 0, 1);
        ctx.drawImage(s.gold ? spr.gold : spr.orange, s.x - r, s.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }

    function updNumber(sdt) {
      if (!numP.length) return;
      if (numGlow > 0) numGlow = Math.min(1, numGlow + sdt * 1.6); else if (numGlow < 0) numGlow = Math.min(0, numGlow + sdt * 0.6);
      var sdtc = Math.min(sdt, 0.05), i, p;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var ga = numGlow > 0 ? numGlow : (numGlow < 0 ? -numGlow : 0);
      if (ga > 0.01) {
        var gr = Math.min(H * 0.42, W * 0.7);
        ctx.globalAlpha = 0.28 * ga; ctx.drawImage(spr.orange, numCenter.x - gr, numCenter.y - gr, gr * 2, gr * 2);
      }
      var sm = (q === 2 ? 0.8 : 1);
      for (i = numP.length - 1; i >= 0; i--) {
        p = numP[i];
        if (!p.rel) {
          if (p.d > 0) { p.d -= sdtc; p.vx *= 0.985; p.vy *= 0.985; }
          else {
            p.vx += ((p.tx - p.x) * 34 - p.vx * 7.5) * sdtc; p.vy += ((p.ty - p.y) * 34 - p.vy * 7.5) * sdtc;
          }
          p.x += p.vx * sdtc; p.y += p.vy * sdtc;
          var jx = Math.sin(time * 6 + p.ph) * 0.9, jy = Math.cos(time * 5 + p.ph) * 0.9;
          var r = p.s * 3.4 * sm;
          ctx.globalAlpha = 0.85 * (0.75 + 0.25 * Math.sin(time * 7 + p.ph));
          ctx.drawImage(p.gold ? spr.gold : spr.orange, p.x + jx - r, p.y + jy - r, r * 2, r * 2);
        } else {
          p.life -= sdtc; if (p.life <= 0) { numP.splice(i, 1); continue; }
          p.vy -= 20 * sdtc; p.x += (p.vx + Math.sin(time * 3 + p.ph) * 12) * sdtc; p.y += p.vy * sdtc;
          var r2 = p.s * 3.2 * sm;
          ctx.globalAlpha = clamp(p.life / 1.6, 0, 0.85);
          ctx.drawImage(p.gold ? spr.gold : spr.orange, p.x - r2, p.y - r2, r2 * 2, r2 * 2);
        }
      }
      ctx.restore();
      if (!numP.length) numGlow = 0;
    }

    function adaptQuality(rawDt) {
      if (rawDt > 0.15) return;
      frames++;
      if (frames < 40) return;
      emaDt = emaDt * 0.95 + rawDt * 1000 * 0.05;
      if (emaDt > 27 && q < 2) { slowFrames++; } else { slowFrames = 0; }
      if (slowFrames > 90) { slowFrames = 0; emaDt = 16; frames = 0; setQuality(q + 1); }
    }

    function render(now) {
      var raw = lastNow ? (now - lastNow) / 1000 : 0.016; lastNow = now;
      var dt = Math.min(Math.max(raw, 0), 0.05);
      adaptQuality(raw);
      var sdt = dt * st.timeScale; time += sdt;

      var sm = Math.min(1, dt * 6);
      ptr.sx += (ptr.nx - ptr.sx) * sm; ptr.sy += (ptr.ny - ptr.sy) * sm;
      computeGeom();
      var target = 0;
      if (ptr.active && st.appear > 0.3) target = clamp(1 - Math.hypot(ptr.x - g.hx, ptr.y - g.hy) / (g.halfW * 2.2), 0, 1);
      prox += (target - prox) * Math.min(1, dt * 5);
      st.beat *= Math.pow(0.04, sdt); if (st.beat < 0.001) st.beat = 0;
      st.shake *= Math.pow(0.02, dt);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (st.shake > 0.01) ctx.translate(rnd(-1, 1) * st.shake * 6, rnd(-1, 1) * st.shake * 6);

      drawFloor(); drawGlow(); updSmoke(sdt);
      updEmbers(sdt, dt);
      drawHeart(); updFlames(sdt); updConv(sdt); updWaves(sdt); updSparks(sdt); updNumber(sdt);
    }

    resize();

    return {
      st: st, ptr: ptr,
      resize: resize, render: render, setQuality: setQuality, getQuality: function () { return q; },
      setPointer: setPointer, tap: tap, reveal: reveal,
      formNumber: formNumber, releaseNumber: releaseNumber,
      reset: reset, clearTransient: clearTransient,
      metrics: function () { return { baseS: baseS, W: W, H: H }; },
      info: function () { return { flames: flames.length, embers: embers.length, sparks: sparks.length, number: numP.length, waves: waves.length, quality: q }; }
    };
  }

  global.IraqHeart = { create: create };
})(window);
