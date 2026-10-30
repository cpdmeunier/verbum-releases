// The orb of a live session: a sphere drawn as a 16 × 16 halftone of squares that breathes with the
// voice. A square's size says how much light it gets. Silent, it is white and small; the louder the
// voice, the bigger it grows and the more of its brightest squares take the logo's paint.
// Kept light: 256 squares, 30 frames a second while you speak and 10 in silence (it never looks
// frozen), nothing drawn while the window or the orb is hidden, a single frame when the Mac asks for less motion.
// Mic off: it fades to grey and freezes, nothing drawn until the mic is on again; on again, it fades back.
(() => {
  const N = 16, LEVELS = 3, RELIEF = 0.85, SOFT = 0.1, HALO = 0.4, REACH = 0.14, GRAIN = 0.3, DEPTH = 0.7;
  /** Radius in silence, and how much the voice adds (a full voice: 0.80). */
  const RADIUS = 0.62, BREATH = 0.18;
  const FPS = 30, QUIET_FPS = 10, FILL = 0.82;
  const INK = [246, 245, 242], OFF = [122, 115, 114];
  /** How much of the way from grey to white (or back) each frame goes: about half a second. */
  const FADE = 0.12;
  // The four patches of paint of the logo, drifting slowly; a bright square takes the one under it.
  const PAINT = [
    { c: [249, 233, 76], x: -0.55, y: 0.6, sx: 0.31, sy: 0.23 },
    { c: [92, 210, 122], x: 0.45, y: 0.4, sx: 0.27, sy: 0.37 },
    { c: [255, 45, 101], x: -0.25, y: -0.3, sx: 0.21, sy: 0.29 },
    { c: [224, 107, 195], x: 0.35, y: -0.7, sx: 0.37, sy: 0.19 },
  ];

  const smooth = (a, b, x) => { const v = Math.min(1, Math.max(0, (x - a) / (b - a))); return v * v * (3 - 2 * v); };
  const noise = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
  const field = new Float32Array(N * N), h = 2 / N;

  /** The squares of one frame: [column, row, size 1/3 | 2/3 | 1]. `p` is the voice level, 0 to 1. */
  function frame(t, p) {
    // A slow breath of its own, so it lives in silence too; the voice makes it grow.
    const r = RADIUS + 0.015 * Math.sin(t * 1.3) + BREATH * p;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) field[j * N + i] = Math.hypot((i + 0.5) * h - 1, 1 - (j + 0.5) * h) - r;
    // Light from the upper left, drifting a little.
    let lx = -0.45 + 0.25 * Math.cos(t * 0.6), ly = 0.55, lz = 0.7;
    const ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; lz /= ln;
    const seed = Math.floor(t * 10), cells = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const d = field[j * N + i];
      if (d >= REACH * 4 + SOFT) continue;
      let k = 0;
      const m = 1 - smooth(-SOFT, SOFT, d);
      if (m > 0) {
        const gx = field[j * N + Math.min(i + 1, N - 1)] - field[j * N + Math.max(i - 1, 0)];
        const gy = field[Math.max(j - 1, 0) * N + i] - field[Math.min(j + 1, N - 1) * N + i];
        const gl = Math.hypot(gx, gy) || 1;
        const u = 1 - Math.min(1, Math.max(0, -d) / DEPTH), z = Math.sqrt(1 - u * u);
        const l = Math.min(1, Math.max(0, (gx / gl) * u * lx + (gy / gl) * u * ly + z * lz));
        k = m * (1 - RELIEF * (1 - Math.pow(l, 1.6)));
      }
      if (m < 1) k += (1 - m) * HALO * 0.8 * Math.exp(-Math.max(0, d) / REACH);
      k += (noise(i, j, seed) - 0.5) * GRAIN * Math.exp(-Math.abs(d) / (REACH * 0.7 + SOFT));
      const q = Math.round(Math.min(1, Math.max(0, k)) * LEVELS);
      if (q) cells.push([i, j, q / LEVELS]);
    }
    return cells;
  }

  function paint(i, j, t) {
    const x = (i + 0.5) * h - 1, y = 1 - (j + 0.5) * h;
    let r = 0, g = 0, b = 0, sum = 0;
    for (const p of PAINT) {
      const px = p.x + 0.18 * Math.sin(t * p.sx * 2), py = p.y + 0.18 * Math.cos(t * p.sy * 2);
      const w = 1 / (0.002 + ((x - px) ** 2 + (y - py) ** 2) ** 3); // sharp falloff: patches, not mud
      r += p.c[0] * w; g += p.c[1] * w; b += p.c[2] * w; sum += w;
    }
    return `rgb(${Math.round(r / sum)},${Math.round(g / sum)},${Math.round(b / sum)})`;
  }

  // Off until the panel says the mic is on: it starts grey, never flashing white first.
  let canvas = null, ctx = null, target = 0, level = 0, last = 0, running = false, off = true, shown = 0;
  /** 0 greyed (mic off), 1 lit (mic on); in between while it fades. */
  let lit = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  function draw(t) {
    // The canvas follows its size on screen (large orb, or small beside the instructions).
    const ratio = window.devicePixelRatio || 1, size = Math.round(canvas.clientWidth * ratio);
    if (!size) return;
    if (canvas.width !== size) canvas.width = canvas.height = size;
    const cell = size / N;
    ctx.clearRect(0, 0, size, size);
    // The louder the voice, the more of the brightest squares take the paint; none in silence.
    const painted = lit * Math.min(1, Math.max(0, (level - 0.06) * 2.2));
    const ink = `rgb(${INK.map((c, n) => Math.round(OFF[n] + (c - OFF[n]) * lit)).join(',')})`;
    for (const [i, j, k] of frame(t, level)) {
      const w = Math.round(k * cell * FILL), cx = (i + 0.5) * cell, cy = (j + 0.5) * cell;
      ctx.fillStyle = k === 1 && noise(i, j, 0) < painted ? paint(i, j, t) : ink;
      ctx.fillRect(Math.round(cx - w / 2), Math.round(cy - w / 2), w, w);
    }
  }

  function tick(ms) {
    // Hidden window, or orb not on screen (setup, a message shown): stop; the observers wake it again.
    if (!canvas || document.hidden || !canvas.clientWidth) { running = false; return; }
    const fading = lit !== (off ? 0 : 1);
    if (ms - last < 1000 / (fading || level > 0.02 || target > 0.02 ? FPS : QUIET_FPS) - 2) return void requestAnimationFrame(tick);
    // Its own clock, which stops while it is frozen: on again, it goes on from the frame it stopped on.
    shown += Math.min(0.1, (ms - last) / 1000);
    last = ms;
    level += (target - level) * 0.35; // eased, so the orb breathes instead of flickering
    lit = off ? Math.max(0, lit - FADE) : Math.min(1, lit + FADE);
    // Mic off: it goes on breathing while it greys, then stops on that frame.
    draw(shown);
    if (off && lit === 0) { running = false; return; }
    requestAnimationFrame(tick);
  }

  function wake() {
    if (!canvas || !canvas.clientWidth) return;
    // Less motion asked: no fade, no breath, one frame.
    if (still.matches) { lit = off ? 0 : 1; return draw(0); }
    // Mic off and already grey: the frame it stopped on.
    if (off && lit === 0) return draw(shown);
    if (!running && !document.hidden) { running = true; requestAnimationFrame(tick); }
  }

  window.Orb = {
    /** Starts drawing in this canvas. */
    mount(el) { canvas = el; ctx = el.getContext('2d'); new ResizeObserver(wake).observe(el); wake(); },
    /** The voice level, 0 (silence) to 1. */
    level(v) { if (off) return; target = Math.min(1, Math.max(0, Number(v) || 0)); if (target >= 0.02) wake(); },
    /** Mic off (true): greyed and frozen; on again (false): it breathes again. */
    off(v) { if (off === !!v) return; off = !!v; if (off) target = 0; wake(); },
  };
  document.addEventListener('visibilitychange', wake);
})();
