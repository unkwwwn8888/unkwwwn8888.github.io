/* Sonora FX — efecto de partículas hechas de dígitos que forman letras, se dispersan y se vuelven a juntar.
   Lo usan la bienvenida (intro.js) y el logo de la barra (cualquier <a data-logo-fx> con un <svg> o <img> dentro).
   Sin dependencias. Se omite con "reducir movimiento" (el logo queda estático). */
(function () {
  "use strict";
  var rand = Math.random;

  /* ================= motor ================= */
  function Swarm(canvas, o) {
    this.cv = canvas; this.ctx = canvas.getContext("2d");
    this.n = o.count; this.pal = o.palette || ["#fff"]; this.fpx = o.fontPx || 8;
    this.k = o.k || 170; this.damp = o.damp || 15; this.jit = o.jitter || 0; this.swirl = o.swirl || 0; this.idleSwirl = o.idleSwirl !== false; this.turb = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    var n = this.n;
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.tx = new Float32Array(n); this.ty = new Float32Array(n);
    this.ph = new Float32Array(n); this.ch = new Uint8Array(n); this.col = new Uint8Array(n);
    this.kv = new Float32Array(n); this.due = new Float32Array(n); this.sz = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      this.ph[i] = rand() * 6.2832; this.ch[i] = (rand() * 10) | 0;
      this.kv[i] = 0.55 + rand() * 1.0;            /* cada partícula tiene su propia rigidez */
      var q = rand(); this.sz[i] = q < 0.25 ? 0 : q < 0.8 ? 1 : 2;   /* tres tamaños de dígito */
    }
    this.t = 0; this.W = 0; this.H = 0;
    this.px = -1e5; this.py = -1e5; this.pr = o.pointerRadius || 40; this.pf = o.pointerForce || 900;
    this._atlas();
  }
  Swarm.prototype._atlas = function () {
    var d = this.dpr, SZ = [0.75, 1, 1.35], cell = Math.ceil(this.fpx * d * 1.35 * 1.5);
    this.cell = cell;
    var a = document.createElement("canvas");
    a.width = cell * 10; a.height = cell * this.pal.length * 3;
    var g = a.getContext("2d");
    g.textAlign = "center"; g.textBaseline = "middle";
    for (var k = 0; k < this.pal.length; k++) for (var z = 0; z < 3; z++) {
      g.font = "600 " + (this.fpx * d * SZ[z]) + "px Inter,Arial,sans-serif";
      g.fillStyle = this.pal[k];
      for (var c = 0; c < 10; c++) g.fillText(String(c), c * cell + cell / 2, (k * 3 + z) * cell + cell / 2 + d * 0.3);
    }
    this.atlas = a;
  };
  Swarm.prototype.resize = function (W, H) {
    this.W = W; this.H = H;
    this.cv.width = Math.round(W * this.dpr); this.cv.height = Math.round(H * this.dpr);
    this.cv.style.width = W + "px"; this.cv.style.height = H + "px";
  };
  /* reparte todas las partículas al azar por el lienzo (la "nube" inicial) */
  Swarm.prototype.cloud = function () {
    for (var i = 0; i < this.n; i++) {
      this.x[i] = rand() * this.W; this.y[i] = rand() * this.H;
      this.vx[i] = (rand() - .5) * 60; this.vy[i] = (rand() - .5) * 60;
    }
  };
  /* pts: [{x,y,c}] en px CSS del lienzo. Cada partícula toma un punto al azar (mezcla) */
  Swarm.prototype.setTargets = function (pts, delay) {
    var m = pts.length, n = this.n, i, j, t;
    if (!m) return;
    var idx = new Array(m);
    for (i = 0; i < m; i++) idx[i] = i;
    for (i = m - 1; i > 0; i--) { j = (rand() * (i + 1)) | 0; t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    for (i = 0; i < n; i++) {
      var p = pts[idx[i % m]], dup = i >= m ? 0.7 : 0;
      this.tx[i] = p.x + (dup ? (rand() - .5) * dup * 2 : 0);
      this.ty[i] = p.y + (dup ? (rand() - .5) * dup * 2 : 0);
      this.col[i] = p.c || 0;
      this.due[i] = this.t + (delay ? rand() * delay : 0);
    }
  };
  Swarm.prototype.burst = function (power) {
    for (var i = 0; i < this.n; i++) {
      var a = rand() * 6.2832, s = power * (.35 + rand());
      this.vx[i] += Math.cos(a) * s; this.vy[i] += Math.sin(a) * s;
    }
    this.turb = 1;
  };
  Swarm.prototype.pointer = function (x, y) { this.px = x; this.py = y; };
  /* avanza dt segundos y devuelve la energía restante (px de error medio) */
  Swarm.prototype.step = function (dt) {
    if (dt > 0.033) dt = 0.033;
    this.t += dt;
    var n = this.n, k = this.k, c = this.damp, e = 0, pr = this.pr, pr2 = pr * pr, pf = this.pf, t = this.t;
    var px = this.px, py = this.py;
    var sw = this.swirl * ((this.idleSwirl ? 1 : 0) + this.turb * 5);
    this.turb *= Math.exp(-dt / 0.6);
    for (var i = 0; i < n; i++) {
      var x = this.x[i], y = this.y[i], vx = this.vx[i], vy = this.vy[i], ph = this.ph[i];
      var dx = this.tx[i] - x, dy = this.ty[i] - y;
      var free = t < this.due[i];                     /* aún no le toca llegar: deriva casi libre */
      var ks = free ? 0.07 : this.kv[i], cc = free ? c * 0.3 : c;
      vx += (dx * k * ks - vx * cc) * dt; vy += (dy * k * ks - vy * cc) * dt;
      if (sw) {                                       /* campo de remolinos */
        vx += sw * Math.sin(y * 0.07 + t * 1.7 + ph) * dt;
        vy += sw * Math.cos(x * 0.07 + t * 1.3 + ph * 1.4) * dt;
      }
      var ex = x - px, ey = y - py, d2 = ex * ex + ey * ey;
      if (d2 < pr2 && d2 > 0.01) {
        var d = Math.sqrt(d2), f = (1 - d / pr) * pf * dt;
        vx += ex / d * f; vy += ey / d * f;
      }
      this.vx[i] = vx; this.vy[i] = vy;
      this.x[i] = x + vx * dt; this.y[i] = y + vy * dt;
      e += Math.abs(vx) + Math.abs(vy) + Math.abs(dx) + Math.abs(dy);
      if (rand() < 0.012) this.ch[i] = (rand() * 10) | 0;
    }
    return e / n;
  };
  Swarm.prototype.draw = function (still) {
    var g = this.ctx, d = this.dpr, cell = this.cell, half = cell / 2, n = this.n, j = still ? 0 : this.jit, t = this.t;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    for (var i = 0; i < n; i++) {
      var x = this.x[i], y = this.y[i];
      if (j) { var p = this.ph[i]; x += Math.sin(t * (1.6 + p * 0.25) + p) * j; y += Math.cos(t * (1.3 + p * 0.3) + p * 1.3) * j; }
      g.drawImage(this.atlas, this.ch[i] * cell, (this.col[i] * 3 + this.sz[i]) * cell, cell, cell, x * d - half, y * d - half, cell, cell);
    }
  };

  /* ================= muestreo ================= */
  function sampleText(text, o) {
    var W = o.W, H = o.H, c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.font = o.font; g.textAlign = "center"; g.textBaseline = "middle";
    try { g.direction = o.dir || "ltr"; } catch (e) {}
    g.fillStyle = "#000";
    g.fillText(text, W / 2, H / 2 + (o.dy || 0));
    var data = g.getImageData(0, 0, W, H).data, pts = [], s = o.step || 2;
    for (var y = 0; y < H; y += s) for (var x = 0; x < W; x += s) {
      if (data[(y * W + x) * 4 + 3] > 120) pts.push({ x: x + s / 2, y: y + s / 2, c: 0 });
    }
    return pts;
  }

  /* ================= onda de puntos 3D (fondo de la bienvenida) =================
     Malla de puntos (x: largo, z: profundidad) levantada por ondas que viajan; vista con perspectiva. */
  function wave(g, w, h, t, o) {
    o = o || {};
    var NX = o.nx || 240, NZ = o.nz || 30, cx = w / 2, cy = h * 0.5, S = Math.max(w * 0.5, h * 0.78), d = o.dpr || 1;
    var tilt = 0.3, ct = Math.cos(tilt), st = Math.sin(tilt), bk = [[], [], []];
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    for (var j = 0; j < NZ; j++) {
      var z = (j / (NZ - 1)) * 2 - 1, zf = 0.3 + 0.7 * (1 - z * z);
      for (var i = 0; i < NX; i++) {
        var x = (i / (NX - 1)) * 2 - 1;
        var env = 0.42 + 0.58 * (x * 0.5 + 0.5);                       /* crece hacia la derecha */
        env *= 1 + 0.35 * Math.sin(t * 0.37 + x * 2.1);                /* respira */
        var m1 = 0.5 + 0.5 * Math.sin(x * 3.1 - t * 0.5);              /* modula qué picos crecen */
        var hh = env * (
          (0.55 + 0.45 * m1) * Math.sin(x * 21 + t * 1.2 + z * 1.6) +
          0.5 * Math.sin(x * 11.5 - t * 0.8 + z * 0.9 + 1.9) * (1 - m1) +
          0.22 * Math.sin(x * 33 + t * 1.7 + z * 2.4)
        ) * zf;
        var X = x * 1.12, Y = hh * 0.5, Z = z * 0.5;
        var Yr = Y * ct - Z * st, Zr = Y * st + Z * ct;
        var sc = 1 / (1 + (Zr + 0.1) * 0.28);
        var px = cx + X * S * sc, py = cy - Yr * S * sc;
        if (px < -4 || px > w + 4 || py < -4 || py > h + 4) continue;
        bk[sc > 1.03 ? 2 : sc > 0.97 ? 1 : 0].push(px, py);
      }
    }
    var sizes = [1.4, 1.9, 2.5], alphas = [0.62, 0.86, 1];
    for (var b = 0; b < 3; b++) {
      var arr = bk[b], sz = sizes[b] * d;
      g.globalAlpha = (o.alpha || 1) * alphas[b]; g.fillStyle = o.color || "#ffffff"; g.beginPath();
      for (var k = 0; k < arr.length; k += 2) g.rect(arr[k] - sz / 2, arr[k + 1] - sz / 2, sz, sz);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  /* ================= onda de hebras (fondo alternativo de la bienvenida) =================
     Miles de líneas verticales finas que nacen de una línea central y llegan hasta la envolvente de una onda
     suave que cambia con el tiempo: masa densa al centro y bordes "peludos". */
  function hairWave(g, w, h, t, o) {
    o = o || {};
    var cv = g.canvas, d = o.dpr || 1, N = o.count || 6500, hs = cv._hair;
    if (!hs || hs.n !== N || hs.w !== w) {
      hs = cv._hair = { n: N, w: w, s: new Float32Array(N), x: new Float32Array(N), u: new Float32Array(N), l: new Float32Array(N), p: new Float32Array(N), m: new Uint8Array(N) };
      for (var i = 0; i < N; i++) {
        hs.x[i] = rand() * w;
        hs.u[i] = 0.5 + 0.7 * Math.pow(rand(), 1.4);        /* largo relativo: casi todas llegan lejos, pocas más allá */
        hs.l[i] = (rand() - 0.5) * 9 * d;                    /* inclinación de la punta */
        hs.p[i] = rand() * 6.283;
        hs.m[i] = rand() < 0.12 ? 1 : 0; hs.s[i] = Math.pow(rand(), 1.6);                     /* algunas hebras salen hacia el lado contrario, cortas */
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    var cy = h * 0.52, A = h * 0.27, lw = Math.max(0.7, 0.8 * d), col = o.color || "243,245,250", al = o.alpha || 1;
    g.lineWidth = lw; g.lineCap = "round";
    var tiers = [0.3, 0.18, 0.1];
    for (var tr = 0; tr < 3; tr++) {
      g.strokeStyle = "rgba(" + col + "," + (tiers[tr] * al) + ")";
      g.beginPath();
      for (var i = tr; i < N; i += 3) {
        var x = hs.x[i], X = x / w, p = hs.p[i];
        var E = A * (0.58 * Math.sin(X * 9.2 + t * 0.5) + 0.34 * Math.sin(X * 4.6 - t * 0.33 + 1.3) + 0.18 * Math.sin(X * 16 + t * 0.85 + 0.6));
        var mag = Math.sqrt(E * E + A * A * 0.012), up = E > 0 ? -1 : 1;                  /* E>0: la masa sube */
        var len = mag * hs.u[i] * (1 + 0.05 * Math.sin(t * 1.4 + p));
        if (hs.m[i]) { len *= 0.3; up = -up; }
        var y0 = cy - up * mag * 0.2 * hs.s[i];                      /* la base es difusa: algunas hebras nacen del otro lado */
        var y1 = cy + up * len, dy = y1 - y0, ax = hs.l[i], wp = p + t * 0.7;
        var ww = (0.8 + 0.6 * hs.u[i]) * d;
        g.moveTo(x + Math.sin(wp) * ww * 0.5, y0);
        g.lineTo(x + Math.sin(wp + 1.3) * ww + ax * 0.33, y0 + dy * 0.33);
        g.lineTo(x + Math.sin(wp + 2.7) * ww * 1.2 + ax * 0.66, y0 + dy * 0.66);
        g.lineTo(x + Math.sin(wp + 4.1) * ww * 1.4 + ax, y1);
      }
      g.stroke();
    }
  }

  window.SonoraFX = { Swarm: Swarm, sampleText: sampleText, wave: wave, hairWave: hairWave, logos: [] };

  /* ================= logo de la barra ================= */
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;
  if (reduce) return;

  var PAD = 24, SCALE = 4, LOGOS = window.SonoraFX.logos;

  function setupLogo(a) {
    var el = a.querySelector("svg,img");
    if (!el || a._fx) return;
    var st = { a: a, el: el, sw: null, cv: null, raf: 0, awake: 0, last: 0, calm: 0, ready: false, started: false, gone: false };
    a._fx = st;
    st.vis = el.style.visibility;
    build(st);
    a.addEventListener("pointerenter", function () { if (st.sw && st.started) { st.sw.burst(230); wake(st, 1800); } });
    a.addEventListener("focus", function () { if (st.sw && st.started) { st.sw.burst(160); wake(st, 1500); } }, true);
    LOGOS.push(st);
  }

  function colorOf(el) { try { return getComputedStyle(el).color || "#00002A"; } catch (e) { return "#00002A"; } }

  function source(st, w, h, cb, fail) {
    var el = st.el, img = new Image(), src;
    if (el.tagName.toLowerCase() === "img") src = el.currentSrc || el.src;
    else {
      var cl = el.cloneNode(true);
      cl.setAttribute("width", w); cl.setAttribute("height", h);
      if (!cl.getAttribute("xmlns")) cl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      var xml = new XMLSerializer().serializeToString(cl).replace(/currentColor/g, colorOf(el));
      src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    }
    img.onload = function () { cb(img); };
    img.onerror = fail;
    img.src = src;
  }

  function build(st) {
    var r = st.el.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) { st.el.style.visibility = st.vis; return; }
    source(st, w * SCALE, h * SCALE, function (img) {
      try {
        var c = document.createElement("canvas");
        c.width = w * SCALE; c.height = h * SCALE;
        var g = c.getContext("2d");
        g.drawImage(img, 0, 0, c.width, c.height);
        var d = g.getImageData(0, 0, c.width, c.height).data, pts = [];
        for (var y = 0; y < c.height; y += 2) for (var x = 0; x < c.width; x += 2) {
          var i = (y * c.width + x) * 4;
          if (d[i + 3] > 128) pts.push({ x: x / SCALE + PAD, y: y / SCALE + PAD, c: d[i + 1] > 90 ? 1 : 0 });
        }
        if (pts.length < 40) throw new Error("vacío");
        finish(st, w, h, pts);
      } catch (e) { st.el.style.visibility = st.vis; }
    }, function () { st.el.style.visibility = st.vis; });
  }

  function finish(st, w, h, pts) {
    var a = st.a, cs = getComputedStyle(a);
    if (cs.position === "static") a.style.position = "relative";
    var cv = document.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    var er = st.el.getBoundingClientRect(), ar = a.getBoundingClientRect();
    cv.style.cssText = "position:absolute;pointer-events:none;left:" + (er.left - ar.left - PAD) + "px;top:" + (er.top - ar.top - PAD) + "px";
    var n = Math.min(1500, Math.max(600, Math.round(pts.length / 3)));
    var navy = "#00002A", sky = "#4EA4CC";
    var sw = new Swarm(cv, { count: n, palette: [navy, sky], fontPx: 3.4, k: 160, damp: 14, jitter: 0.4, swirl: 150, idleSwirl: false, pointerRadius: 34, pointerForce: 900 });
    sw.resize(w + PAD * 2, h + PAD * 2);
    sw.cloud();
    sw.setTargets(pts);
    a.appendChild(cv);
    st.el.style.visibility = "hidden";
    cv.style.opacity = "1";
    st.sw = sw; st.cv = cv; st.w = w; st.h = h; st.ready = true;
    if (st.pendingStart || !document.documentElement.classList.contains("sw-lock")) start(st);
  }

  function start(st) {
    if (!st.ready || st.started) { st.pendingStart = true; return; }
    st.started = true; wake(st, 2200);
    schedule(st, 5200);
  }

  /* latido: de vez en cuando el logo se deshace un poco, "respira" y vuelve a armarse */
  function pulse(st) {
    if (!st.sw || !st.started) return;
    var big = rand() < 0.35;
    st.sw.burst(big ? 190 : 105);
    if (st.cv.animate) st.cv.animate(
      [{ transform: "scale(1)" }, { transform: "scale(" + (big ? 1.09 : 1.055) + ")", offset: 0.35 }, { transform: "scale(1)" }],
      { duration: big ? 1100 : 850, easing: "ease-in-out" });
    wake(st, 1300);
  }
  function schedule(st, ms) {
    clearTimeout(st.pt);
    st.pt = setTimeout(function () {
      if (!st.sw) return;
      if (document.hidden || st.raf) { schedule(st, 1500); return; }   /* si está en pantalla oculta o ya se mueve, espera */
      pulse(st);
      schedule(st, 4200 + rand() * 4800);
    }, ms === undefined ? 4200 + rand() * 4800 : ms);
  }
  window.SonoraFX.pulseLogo = pulse;

  /* mientras se mueve se ven las partículas; en reposo se muestra el logo original, nítido */
  function showParticles(st) { st.el.style.visibility = "hidden"; st.cv.style.transition = "none"; st.cv.style.opacity = "1"; }
  function showCrisp(st) { st.el.style.visibility = st.vis; st.cv.style.transition = "opacity .5s ease"; st.cv.style.opacity = "0"; }

  function wake(st, ms) {
    st.awake = Math.max(st.awake, performance.now() + ms);
    if (st.raf) return;
    st.last = performance.now(); st.calm = 0;
    showParticles(st);
    var loop = function (now) {
      var dt = (now - st.last) / 1000; st.last = now;
      var e = st.sw.step(dt);
      st.sw.draw(false);
      if (now > st.awake && e < 0.2) st.calm++; else st.calm = 0;
      if (st.calm > 12) { st.sw.draw(true); st.raf = 0; showCrisp(st); return; }
      st.raf = requestAnimationFrame(loop);
    };
    st.raf = requestAnimationFrame(loop);
  }

  document.addEventListener("pointermove", function (e) {
    for (var i = 0; i < LOGOS.length; i++) {
      var st = LOGOS[i]; if (!st.sw || !st.started) continue;
      var r = st.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x > -12 && y > -12 && x < r.width + 12 && y < r.height + 12) { st.sw.pointer(x, y); wake(st, 700); }
      else if (st.sw.px > -1e4) { st.sw.pointer(-1e5, -1e5); wake(st, 500); }
    }
  }, { passive: true });

  document.addEventListener("sonora-intro-exit", function () { LOGOS.forEach(start); });

  var rz = 0;
  addEventListener("resize", function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      LOGOS.forEach(function (st) {
        if (st.raf) cancelAnimationFrame(st.raf);
        clearTimeout(st.pt);
        if (st.cv) st.cv.remove();
        st.el.style.visibility = st.vis;
        var started = st.started;
        st.sw = null; st.cv = null; st.raf = 0; st.ready = false; st.started = false; st.pendingStart = started;
        build(st);
      });
    }, 250);
  });

  function init() { document.querySelectorAll("[data-logo-fx]").forEach(setupLogo); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
