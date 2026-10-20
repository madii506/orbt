/* orbt intro, ~7 s, once per tab. Click, scroll or any key skips.
   A line powers on, a swarm of glyphs flies in and assembles the real planet (today's coastlines and day/night),
   every satellite lifts off the surface to its own altitude, an orbit draws itself around it, the wordmark decodes
   out of noise, and the planet glides into place under the page: the live globe takes over from the same cells. */
(() => {
  const el = document.getElementById('intro'), html = document.documentElement; if (!el) return;
  const q = new URLSearchParams(location.search); let seen = false; try { seen = sessionStorage.getItem('orbt_intro') === '1'; } catch (e) {}
  const finish = () => { html.classList.remove('booting'); html.classList.add('booted'); document.body.classList.remove('lock'); window.dispatchEvent(new Event('orbt:enter')); };
  if ((seen && !q.has('intro')) || q.has('skip') || OB.RM) { el.remove(); finish(); return; }
  html.classList.add('booting'); document.body.classList.add('lock');
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), bar = el.querySelector('.bbar i');
  const DPR = Math.min(2, devicePixelRatio || 1);
  const TL = { power: .7, spawn0: .35, spawn1: 2.0, fly: 1.05, rise0: 2.3, rise1: 3.6, ring0: 3.4, ring1: 4.6, word: 4.2, hand0: 5.5, hand1: 6.6, END: 7.0 };
  const cl = x => Math.min(1, Math.max(0, x)), eo = x => 1 - Math.pow(1 - cl(x), 3), io = x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const back = x => { x = cl(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const rnd = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const NOISE = '#@%*+=:./\\|01';
  const FIG = ['                    ##\\        ##\\     ', '                    ## |       ## |    ', ' ######\\   ######\\  #######\\ ######\\   ', '##  __##\\ ##  __##\\ ##  __##\\\\_##  _|  ',
    '## /  ## |## |  \\__|## |  ## | ## |    ', '## |  ## |## |      ## |  ## | ## |##\\ ', '\\######  |## |      #######  | \\####  |', ' \\______/ \\__|      \\_______/   \\____/ '];
  let W, H, sprites = new Map(), F = 12;
  function sprite(ch, col, wt, fs) {
    const k = ch + col + wt + fs; let s = sprites.get(k); if (s) return s;
    const box = fs * 1.4; s = document.createElement('canvas'); s.width = s.height = Math.ceil(box * DPR); s.box = box;
    const c = s.getContext('2d'); c.scale(DPR, DPR); c.font = `${wt} ${fs}px JBM, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(ch, box / 2, box / 2); sprites.set(k, s); return s;
  }
  const glyph = (ch, col, x, y, a = 1, sc = 1, wt = 400, fs = F) => { if (a <= .01 || sc <= .01) return; const s = sprite(ch, col, wt, fs), z = s.box * sc; g.globalAlpha = Math.min(1, a); g.drawImage(s, x - z / 2, y - z / 2, z, z); };
  let P = [], SATS = [], globe = null, view = null, t0 = 0, done = false, skipping = false;
  function layout() { W = innerWidth; H = innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0); }
  // the planet's cells, exactly as the live globe will draw them; shown scaled about the screen centre until the hand-off
  function build() {
    globe = window.__globe; if (!globe) return false;
    globe.paused = true; globe.fit(); F = globe.f;
    const groups = globe.landGroups(new Date()); P = []; let i = 0;
    for (const k in groups) { const G = groups[k]; const base = G.col.replace(/,\s*[\d.]+\)$/, ',1)'), al = +(G.col.match(/,\s*([\d.]+)\)$/) || [0, 1])[1];
      for (let n = 0; n < G.p.length; n += 2) { const j = i++; P.push({ x: G.p[n], y: G.p[n + 1], ch: G.g, col: base, al, born: TL.spawn0 + rnd(j, 3) * (TL.spawn1 - TL.spawn0), sx: rnd(j, 1), sy: rnd(j, 2), w: rnd(j, 5) * 6.28, dir: rnd(j, 6) > .5 ? 1 : -1 }); } }
    const tR = Math.min(W, H) * .3; view = { s: tR / globe.R, cx: W / 2, cy: H * .56 };
    return true;
  }
  function sats() {   // every satellite, lifting off the surface below it to its own altitude
    const buf = SKY.last(); if (!buf || !globe || !globe.sats) return;
    const S = globe.sats, n = Math.min(S.length, buf.length / 4), out = [];
    for (let i = 0; i < n; i++) {
      const o = i * 4; if (buf[o] !== buf[o]) continue; const pa = globe.proj(buf[o], buf[o + 1], SKY.altR(buf[o + 2])), pg = globe.proj(buf[o], buf[o + 1], 1);
      if (pa[2] < 0 && pa[0] * pa[0] + pa[1] * pa[1] < 1) continue;
      out.push({ ax: globe.X + pa[0] * globe.R, ay: globe.Y - pa[1] * globe.R, gx: globe.X + pg[0] * globe.R, gy: globe.Y - pg[1] * globe.R, col: OB.TAGS[S[i].tag][1], sz: S[i].tag === 'starlink' ? 1.5 : S[i].tag === 'station' ? 3.4 : 2.2, d: rnd(i, 9) * .9 });
    }
    SATS = out;
  }
  const map = (x, y, k) => { const s = 1 + (view.s - 1) * (1 - k), cx = globe.X + (view.cx - globe.X) * (1 - k), cy = globe.Y + (view.cy - globe.Y) * (1 - k); return [cx + (x - globe.X) * s, cy + (y - globe.Y) * s, s]; };
  function frame(now) {
    if (done) return; requestAnimationFrame(frame);
    const t = (now - t0) / 1000; g.clearRect(0, 0, W, H);
    if (bar) bar.style.transform = `scaleX(${cl(t / TL.hand0)})`;
    if (t < TL.power + .3) { const k = eo(t / TL.power), a = 1 - cl((t - TL.power) / .3); g.globalAlpha = a; g.fillStyle = '#1d3934'; g.fillRect(W / 2 - k * W * .3, H * .56, k * W * .6, 1); g.globalAlpha = 1; }
    if (!globe && !build()) return;
    const hk = io((t - TL.hand0) / (TL.hand1 - TL.hand0));
    // the planet assembles out of a swarm of glyphs
    for (const p of P) {
      const k = io((t - p.born - .18) / TL.fly), pop = back((t - p.born) / .24); if (pop <= 0) continue;
      const [tx, ty, sc] = map(p.x, p.y, hk); let x = tx, y = ty, ch = p.ch, a = p.al;
      if (k < 1) { const sx = p.sx * W, sy = p.sy * H + Math.sin(t * 3 + p.w) * 6, dx = sx - tx, dy = sy - ty, sw = (1 - k) * 1.4 * p.dir, cs = Math.cos(sw), sn = Math.sin(sw);
        x = tx + (dx * cs - dy * sn) * (1 - k); y = ty + (dx * sn + dy * cs) * (1 - k); if (k < .8 && Math.random() < .35) ch = NOISE[(Math.random() * NOISE.length) | 0]; a = Math.max(.25, p.al) * (.4 + .6 * k); }
      glyph(ch, p.col, x, y, a, sc * Math.min(1, pop), 400, F);
    }
    g.globalAlpha = 1;
    const lk = eo((t - 1.4) / 1.2); if (lk > 0) { const [cx, cy, sc] = map(globe.X, globe.Y, hk); g.strokeStyle = 'rgba(29,57,52,.5)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, globe.R * sc, -Math.PI / 2, -Math.PI / 2 + lk * Math.PI * 2); g.stroke(); }
    // satellites lift off to their orbits
    if (t > TL.rise0 - .2 && !SATS.length) sats();
    for (const s of SATS) { const k = eo((t - TL.rise0 - s.d) / .9); if (k <= 0) continue; const [x, y] = map(s.gx + (s.ax - s.gx) * k, s.gy + (s.ay - s.gy) * k, hk);
      g.fillStyle = s.col; g.globalAlpha = .85; g.fillRect(x - s.sz / 2, y - s.sz / 2, s.sz, s.sz);
      if (k < 1 && s.sz > 2) { const [gx, gy] = map(s.gx + (s.ax - s.gx) * k * .5, s.gy + (s.ay - s.gy) * k * .5, hk); g.globalAlpha = .3; g.strokeStyle = s.col; g.beginPath(); g.moveTo(gx, gy); g.lineTo(x, y); g.stroke(); } }
    g.globalAlpha = 1;
    // an orbit draws itself, and a satellite rides it
    const rk = io((t - TL.ring0) / (TL.ring1 - TL.ring0)), fade = 1 - hk;
    if (rk > 0 && fade > 0) { const [cx, cy, sc] = map(globe.X, globe.Y, hk), rx = globe.R * sc * 1.55, ry = globe.R * sc * .42, tilt = -.32;
      for (let a = 0; a < rk; a += .004) { const an = a * Math.PI * 2, ex = Math.cos(an) * rx, ey = Math.sin(an) * ry, x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        if (Math.sin(an) < 0 && Math.hypot(x - cx, y - cy) < globe.R * sc) continue; g.globalAlpha = fade * (Math.sin(an) >= 0 ? .85 : .4); g.fillStyle = '#286ed6'; g.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); }
      const an = rk * Math.PI * 2 + t * .8, ex = Math.cos(an) * rx, ey = Math.sin(an) * ry; glyph('=[]=', '#1d3934', cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), cy + ex * Math.sin(tilt) + ey * Math.cos(tilt), fade, 1, 800, 16); g.globalAlpha = 1; }
    // the wordmark decodes out of noise, above the planet
    if (t > TL.word - .4) { const fs = Math.max(8, Math.min(16, W / 70)), cw = fs * .6, lh = fs * 1.05, fw = FIG[0].length * cw, fx = W / 2 - fw / 2 + cw / 2, fy = Math.max(30, H * .56 - Math.min(W, H) * .3 * 1.0 - FIG.length * lh - 40), a = (1 - hk) * cl((t - TL.word + .4) / .5);
      for (let r = 0; r < FIG.length; r++) for (let c = 0; c < FIG[r].length; c++) { let ch = FIG[r][c]; if (ch === ' ') continue; const settle = TL.word + (c / FIG[r].length) * .7 + r * .02; if (t < settle) ch = NOISE[(Math.random() * NOISE.length) | 0];
        glyph(ch, ch === '#' && t >= settle ? '#286ed6' : '#1d3934', fx + c * cw, fy - hk * 40 + r * lh, a * (t >= settle ? 1 : .45), 1, 700, fs); } g.globalAlpha = 1; }
    // the hand-off: the live globe wakes up under us and the intro dissolves
    if (t >= TL.hand0 && globe.paused) { globe.paused = false; globe.lt = 0; }
    if (t >= TL.hand1 - .3 && !el.classList.contains('out')) { el.classList.add('out'); finish(); }
    if (t >= TL.END) end();
  }
  function end() { if (done) return; done = true; try { sessionStorage.setItem('orbt_intro', '1'); } catch (e) {} if (globe) globe.paused = false; if (!el.classList.contains('out')) { el.classList.add('out'); finish(); } setTimeout(() => el.remove(), 900); }
  const skip = () => { if (skipping || done) return; skipping = true; end(); };
  addEventListener('keydown', skip, { once: true }); el.addEventListener('pointerdown', skip); addEventListener('wheel', skip, { once: true, passive: true }); addEventListener('touchmove', skip, { once: true, passive: true });
  layout(); addEventListener('resize', () => { layout(); if (globe) build(); });
  // wait for the font (so the cells line up with the live globe) and briefly for the catalogue, then go
  Promise.race([Promise.all([document.fonts ? document.fonts.ready : null, OB.catalog().catch(() => null)]), new Promise(r => setTimeout(r, 2500))]).then(() => { setTimeout(() => { t0 = performance.now(); requestAnimationFrame(frame); }, 120); });
})();
