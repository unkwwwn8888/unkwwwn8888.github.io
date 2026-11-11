/* Bienvenida animada de Sonora: partículas de dígitos que forman "Welcome" y se transforman en cada idioma,
   hasta llegar a "Bienvenido" con "Sonora" debajo; luego un círculo abre la tienda.
   Requiere sonora-fx.js antes de este archivo. Sale una vez por sesión; con ?intro en la URL se fuerza.
   Se salta con clic, toque o cualquier tecla. Se omite con "reducir movimiento". */
(function () {
  var KEY = "sonora-intro";
  var FX = window.SonoraFX;
  if (!FX) return;
  var force = /[?&]intro(=|&|$)/.test(location.search);
  var seen = false;
  try { seen = !!sessionStorage.getItem(KEY); } catch (e) {}
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;
  if ((seen && !force) || reduce) return;
  try { sessionStorage.setItem(KEY, "1"); } catch (e) {}

  /* Los alfabetos no latinos usan la fuente del sistema (Windows, Mac, Android e iOS ya traen una). */
  var LATIN = "Outfit,Sora,Inter,Arial,sans-serif";
  var WORDS = [
    { t: "Welcome",     f: LATIN, w: 800 },
    { t: "Bienvenido",  f: LATIN, w: 800 },
    { t: "Bem-vindo",   f: LATIN, w: 800 },
    { t: "Bienvenue",   f: LATIN, w: 800 },
    { t: "ようこそ",      f: "'Hiragino Sans','Yu Gothic UI','Yu Gothic','Meiryo','Noto Sans JP','Noto Sans CJK JP',sans-serif", w: 700 },
    { t: "Bienvenido",  f: LATIN, w: 800 }   /* cierre: vuelve al español y aparece "Sonora" */
  ];
  var FIRST = 1250, STEP = 700, HOLD_END = 900;

  var root = document.documentElement;
  var css = document.createElement("style");
  css.textContent =
    "@property --r{syntax:'<length>';inherits:false;initial-value:-20vmax}" +
    "@font-face{font-family:'Outfit';font-weight:600 900;font-display:block;src:url(fonts/outfit-latin.woff2) format('woff2')}" +
    ".sw-ov{position:fixed;inset:0;z-index:99999;background:#000;overflow:hidden;cursor:pointer;--fs:clamp(48px,14vw,160px);" +
      "-webkit-mask-image:radial-gradient(circle at 50% 50%,transparent var(--r),#000 calc(var(--r) + 18vmax));" +
      "mask-image:radial-gradient(circle at 50% 50%,transparent var(--r),#000 calc(var(--r) + 18vmax))}" +
    ".sw-ov.out{animation:sw-iris 1.05s cubic-bezier(.65,0,.25,1) forwards}" +
    "@keyframes sw-iris{0%{--r:-20vmax;opacity:1}88%{opacity:1}100%{--r:95vmax;opacity:0}}" +
    ".sw-ov canvas{position:absolute;left:0;top:0}" +
    ".sw-wave{opacity:0;transition:opacity 1.4s ease}" +
    ".sw-wave.on{opacity:1}" +
    ".sw-scrim{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 46% 22% at 50% 50%,rgba(0,0,0,.62),rgba(0,0,0,.3) 60%,rgba(0,0,0,0) 100%)}" +
    ".sw-ov.out canvas,.sw-ov.out .sw-sub,.sw-ov.out .sw-scrim{animation:sw-lift 1s cubic-bezier(.65,0,.25,1) forwards}" +
    "@keyframes sw-lift{to{transform:scale(1.1);opacity:0}}" +
    ".sw-sub{position:absolute;left:0;right:0;top:calc(50% + var(--fs)*.6);text-align:center;font:500 clamp(11px,2.6vw,14px)/1 Inter,-apple-system,sans-serif;letter-spacing:.42em;text-transform:uppercase;color:#9ccfec;text-shadow:0 1px 10px rgba(0,0,0,.55);opacity:0;padding-left:.42em}" +
    ".sw-sub.on{animation:sw-subin .8s ease .35s forwards}" +
    "@keyframes sw-subin{from{opacity:0;transform:translateY(8px)}to{opacity:.9;transform:none}}" +
    "html.sw-lock,html.sw-lock body{overflow:hidden!important}";
  (document.head || root).appendChild(css);

  var ov = document.createElement("div");
  ov.className = "sw-ov";
  ov.setAttribute("role", "presentation");
  var cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true");
  var sub = document.createElement("div");
  sub.className = "sw-sub"; sub.textContent = "Sonora · Audífonos";
  var wv = document.createElement("canvas");
  wv.className = "sw-wave"; wv.setAttribute("aria-hidden", "true");
  var scrim = document.createElement("div"); scrim.className = "sw-scrim";
  ov.appendChild(wv); ov.appendChild(scrim); ov.appendChild(cv); ov.appendChild(sub);
  root.appendChild(ov);
  root.classList.add("sw-lock");

  var sw = null, W = 0, H = 0, fs = 100, cur = 0, raf = 0, last = 0, done = false, timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  /* fondo: malla de puntos 3D que forma una onda de sonido (SonoraFX.wave) */
  var wctx = wv.getContext("2d"), wdpr = Math.min(window.devicePixelRatio || 1, 1.5), NX = 300, NZ = 30;
  function waveSize() {
    NX = W < 700 ? 140 : 300; NZ = W < 700 ? 22 : 30;
    wv.width = Math.round(W * wdpr); wv.height = Math.round(H * wdpr);
    wv.style.cssText = "position:absolute;left:0;top:0;width:" + W + "px;height:" + H + "px";
  }
  var STYLE = /[?&]fondo=puntos/.test(location.search) ? "puntos" : "hebras";
  function drawWave(t) {
    if (STYLE === "puntos") FX.wave(wctx, wv.width, wv.height, t, { nx: NX, nz: NZ, dpr: wdpr, alpha: 0.9, color: "#f3f5fa" });
    else FX.hairWave(wctx, wv.width, wv.height, t, { dpr: wdpr, count: W < 700 ? 3600 : 11000, color: "185,218,243" });
  }

  function layout() {
    W = innerWidth; H = innerHeight;
    fs = Math.max(48, Math.min(160, W * 0.14));
    var fpx = Math.max(6, Math.round(fs * 0.056)), n = W < 700 ? 1500 : 2800;
    if (!sw || sw.fpx !== fpx || sw.n !== n) sw = new FX.Swarm(cv, { count: n, palette: ["#f3f2ee"], fontPx: fpx, k: 260, damp: 20, jitter: 1.0, swirl: 260 });
    sw.resize(W, H);
    waveSize();
  }
  function target(i, burst) {
    var w = WORDS[i];
    sw.setTargets(FX.sampleText(w.t, { W: W, H: H, font: w.w + " " + fs + "px " + w.f, dir: w.rtl ? "rtl" : "ltr", step: fs > 100 ? 2 : 1 }), burst ? 0.2 : 0.5);
    if (burst) sw.burst(240);
  }

  function frame(now) {
    if (done) return;
    var dt = (now - last) / 1000; last = now;
    sw.step(dt); sw.draw(false);
    drawWave(now / 1000);
    raf = requestAnimationFrame(frame);
  }

  function exit() {
    if (done) return; done = true;
    timers.forEach(clearTimeout); cancelAnimationFrame(raf);
    ov.classList.add("out");
    document.dispatchEvent(new Event("sonora-intro-exit"));
    setTimeout(function () { ov.remove(); root.classList.remove("sw-lock"); }, 1150);
  }
  ov.addEventListener("click", exit);
  addEventListener("keydown", exit, { once: true });

  function show(i) {
    if (done) return;
    cur = i;
    target(i, i > 0);
    if (i === WORDS.length - 1) later(function () { sw.jit = 0.15; }, 650);   /* al cerrar, las partículas se aquietan */
    if (i < WORDS.length - 1) later(function () { show(i + 1); }, i === 0 ? FIRST : STEP);
    else later(exit, STEP + HOLD_END);
  }

  var rz = 0;
  addEventListener("resize", function () {
    clearTimeout(rz);
    rz = setTimeout(function () { if (done) return; layout(); target(cur, false); }, 150);
  });

  var started = false;
  function go() {
    if (started || done) return; started = true;
    layout(); sw.cloud();
    last = performance.now(); raf = requestAnimationFrame(frame);
    wv.classList.add("on");
    sub.classList.add("on");
    show(0);
  }
  try {
    Promise.race([
      Promise.all([document.fonts.load("800 80px Outfit"), document.fonts.load("600 12px Inter")]),
      new Promise(function (r) { setTimeout(r, 800); })
    ]).then(go, go);
  } catch (e) { go(); }
})();
