/* orbt intro, 5 s on every visit to the home page (longer if you play with it).
   A swarm of glyphs assembles the real planet (today's coastlines, today's day and night), every satellite lifts off
   to its own altitude, and the planet glides into place under the page, where the live globe takes over.
   Drag to spin the planet. Move the pointer and the glyphs swell under it. Click to launch a satellite: it climbs,
   then stays in orbit around the planet. Scroll, a key or "skip" goes straight in. */
(() => {
  const el = document.getElementById('intro'), html = document.documentElement; if (!el) return;
  const q = new URLSearchParams(location.search);
  const finish = () => { html.classList.remove('booting'); html.classList.add('booted'); document.body.classList.remove('lock'); window.dispatchEvent(new Event('orbt:enter')); };
  if (q.has('skip') || OB.RM) { el.remove(); finish(); return; }
  html.classList.add('booting'); document.body.classList.add('lock');
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), bar = el.querySelector('.bbar i'), hint = el.querySelector('.hint');
  const DPR = Math.min(2, devicePixelRatio || 1);
  const TL = { power: .5, spawn0: .15, spawn1: 1.25, fly: .8, rise0: 1.6, ring0: 2.1, ring1: 3.1, hand: 4.0, handDur: 1.0 };
  const cl = x => Math.min(1, Math.max(0, x)), eo = x => 1 - Math.pow(1 - cl(x), 3), io = x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const back = x => { x = cl(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const rnd = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const NOISE = '#@%*+=:./\\|01';
  let W, H, sprites = new Map(), F = 12;
  function sprite(ch, col, wt, fs) {
    const k = ch + col + wt + fs; let s = sprites.get(k); if (s) return s;
    const box = fs * 1.4; s = document.createElement('canvas'); s.width = s.height = Math.ceil(box * DPR); s.box = box;
    const c = s.getContext('2d'); c.scale(DPR, DPR); c.font = `${wt} ${fs}px JBM, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(ch, box / 2, box / 2); sprites.set(k, s); return s;
  }
  const glyph = (ch, col, x, y, a = 1, sc = 1, wt = 400, fs = F) => { if (a <= .01 || sc <= .01) return; const s = sprite(ch, col, wt, fs), z = s.box * sc; g.globalAlpha = Math.min(1, a); g.drawImage(s, x - z / 2, y - z / 2, z, z); };
  const split = col => [col.replace(/,\s*[\d.]+\)$/, ',1)'), +(col.match(/,\s*([\d.]+)\)$/) || [0, 1])[1]];
  let P = [], globe = null, view = null, t0 = 0, done = false, handAt = null, lastTouch = 0, engaged = false;
  let mx = -9999, my = -9999, drag = null, rockets = [], sparks = [], mine = [];
  function layout() { W = innerWidth; H = innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0); }
  function build() {
    globe = window.__globe; if (!globe) return false;
    globe.paused = true; globe.fit(); F = globe.f;
    const groups = globe.landGroups(new Date()); P = []; let i = 0;
    for (const k in groups) { const G = groups[k], [col, al] = split(G.col);
      for (let n = 0; n < G.p.length; n += 2) { const j = i++; P.push({ x: G.p[n], y: G.p[n + 1], ch: G.g, col, al, born: TL.spawn0 + rnd(j, 3) * (TL.spawn1 - TL.spawn0), sx: rnd(j, 1), sy: rnd(j, 2), w: rnd(j, 5) * 6.28, dir: rnd(j, 6) > .5 ? 1 : -1 }); } }
    view = { s: Math.min(W, H) * .31 / globe.R, cx: W / 2, cy: H * .52 };
    return true;
  }
  // where things sit: scaled about the screen centre in the intro, gliding to the hero's spot during the hand-off
  let hk = 0;
  const map = (x, y) => { const s = 1 + (view.s - 1) * (1 - hk), cx = globe.X + (view.cx - globe.X) * (1 - hk), cy = globe.Y + (view.cy - globe.Y) * (1 - hk); return [cx + (x - globe.X) * s, cy + (y - globe.Y) * s, s]; };
  const unmap = (x, y) => { const s = 1 + (view.s - 1) * (1 - hk), cx = globe.X + (view.cx - globe.X) * (1 - hk), cy = globe.Y + (view.cy - globe.Y) * (1 - hk); return [(x - cx) / s + globe.X, (y - cy) / s + globe.Y]; };
  // the lens: glyphs swell and turn blue under the pointer
  const lens = (x, y) => { const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy; if (d2 > 130 * 130) return [x, y, 1, 0]; const d = Math.sqrt(d2), f = 1 - d / 130; return [x + dx / (d || 1) * f * 14, y + dy / (d || 1) * f * 14, 1 + f * .9, f]; };
  const touch = () => { lastTouch = performance.now(); if (!engaged) { engaged = true; el.classList.add('engaged'); el.querySelector('.bskip').textContent = 'enter ›'; } };
  el.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY;
    if (drag && globe) { const k = 90 / (globe.R * (map(0, 0)[2])), dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy)); globe.lon0 = drag.lon - dx * k; globe.lat0 = Math.max(-60, Math.min(60, drag.lat + dy * k)); if (drag.moved > 4) touch(); } });
  el.addEventListener('pointerleave', () => { mx = my = -9999; drag = null; });
  el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; if (globe) drag = { x: e.clientX, y: e.clientY, lon: globe.lon0, lat: globe.lat0, moved: 0 }; el.setPointerCapture && el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointerup', e => { if (e.target.closest('button')) return; if (drag && drag.moved < 5) launch(e.clientX, e.clientY); drag = null; });
  addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); launch(W / 2 + (Math.random() - .5) * 200, H * .6); return; } enter(); });
  addEventListener('wheel', () => enter(), { passive: true });
  el.querySelector('.bskip').addEventListener('click', () => enter());
  // a click launches a satellite: it climbs from that spot, then joins its own orbit around the planet
  function launch(x, y) {
    touch(); if (!globe) return; const [cx, cy, s] = map(globe.X, globe.Y), R = globe.R * s;
    const a = Math.atan2(y - cy, x - cx), d = Math.min(Math.hypot(x - cx, y - cy), R * .98);
    rockets.push({ x0: cx + Math.cos(a) * d, y0: cy + Math.sin(a) * d, a, t: performance.now(), tilt: (Math.random() - .5) * 1.4, rr: 1.25 + Math.random() * .5, ph: Math.random() * 6.28 });
  }
  function frame(now) {
    if (done) return; requestAnimationFrame(frame);
    const t = (now - t0) / 1000; g.clearRect(0, 0, W, H);
    if (!globe && !build()) return;
    // the auto hand-off at 4 s, unless you're playing: then 5 s after you stop, or when you press enter
    if (handAt == null) { const auto = !engaged ? TL.hand : Math.max(TL.hand, (lastTouch - t0) / 1000 + 5); if (t >= auto) handAt = t; }
    hk = handAt == null ? 0 : io((t - handAt) / TL.handDur);
    if (bar) bar.style.transform = `scaleX(${engaged ? 1 : cl(t / TL.hand)})`;
    if (handAt != null && t - handAt > TL.handDur - .35 && !el.classList.contains('out')) { el.classList.add('out'); finish(); globe.paused = false; }
    if (handAt != null && t - handAt > TL.handDur + .2) return end();
    // power on
    if (t < TL.power + .3) { const k = eo(t / TL.power), a = 1 - cl((t - TL.power) / .3); g.globalAlpha = a; g.fillStyle = '#1d3934'; g.fillRect(W / 2 - k * W * .3, H * .52, k * W * .6, 1); g.globalAlpha = 1; }
    const assembled = t > TL.spawn1 + TL.fly + .25;
    if (!drag && assembled) globe.lon0 += .03;
    if (!assembled) {
      // the swarm assembles the planet
      for (const p of P) {
        const k = io((t - p.born - .15) / TL.fly), pop = back((t - p.born) / .22); if (pop <= 0) continue;
        const [tx, ty, sc] = map(p.x, p.y); let x = tx, y = ty, ch = p.ch, a = p.al;
        if (k < 1) { const sx = p.sx * W, sy = p.sy * H + Math.sin(t * 3 + p.w) * 6, dx = sx - tx, dy = sy - ty, sw = (1 - k) * 1.4 * p.dir, cs = Math.cos(sw), sn = Math.sin(sw);
          x = tx + (dx * cs - dy * sn) * (1 - k); y = ty + (dx * sn + dy * cs) * (1 - k); if (k < .8 && Math.random() < .35) ch = NOISE[(Math.random() * NOISE.length) | 0]; a = Math.max(.25, p.al) * (.4 + .6 * k); }
        const [lx, ly, ls, lf] = lens(x, y); glyph(ch, lf > .35 ? '#286ed6' : p.col, lx, ly, Math.max(a, lf), sc * Math.min(1, pop) * ls, 400, F);
      }
    } else {
      // assembled: the planet is live now; it turns when you drag it and swells under the pointer
      const groups = globe.landGroups(new Date());
      for (const k in groups) { const G = groups[k], [col, al] = split(G.col); for (let n = 0; n < G.p.length; n += 2) { const [x, y, sc] = map(G.p[n], G.p[n + 1]), [lx, ly, ls, lf] = lens(x, y); glyph(G.g, lf > .35 ? '#286ed6' : col, lx, ly, Math.max(al, lf * .9), sc * ls, 400, F); } }
    }
    g.globalAlpha = 1;
    const [cx, cy, sc] = map(globe.X, globe.Y), R = globe.R * sc;
    const lk = eo((t - 1.0) / 1.0); if (lk > 0) { g.strokeStyle = 'rgba(29,57,52,.5)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + lk * Math.PI * 2); g.stroke(); }
    // every satellite: lifting off its spot on the surface, then flying live
    const buf = SKY.last();
    if (buf && globe.sats && t > TL.rise0 - .2) {
      const S = globe.sats, n = Math.min(S.length, buf.length / 4);
      for (let i = 0; i < n; i++) {
        const o = i * 4; if (buf[o] !== buf[o]) continue; const d = rnd(i, 9) * .8, k = eo((t - TL.rise0 - d) / .8); if (k <= 0) continue;
        const r = 1 + (SKY.altR(buf[o + 2]) - 1) * k, p = globe.proj(buf[o], buf[o + 1], r); if (p[2] < 0 && p[0] * p[0] + p[1] * p[1] < 1) continue;
        const [x, y] = map(globe.X + p[0] * globe.R, globe.Y - p[1] * globe.R), tag = S[i].tag, z = tag === 'starlink' ? 1.5 : tag === 'station' ? 3.6 : 2.3;
        g.fillStyle = OB.TAGS[tag][1]; g.globalAlpha = buf[o + 3] > .5 ? (tag === 'starlink' ? .55 : .9) : .3; g.fillRect(x - z / 2, y - z / 2, z, z);
      }
      g.globalAlpha = 1;
    }
    // an orbit draws itself, and a satellite rides it
    const rk = io((t - TL.ring0) / (TL.ring1 - TL.ring0)), fade = 1 - hk;
    if (rk > 0 && fade > 0) ring(cx, cy, R, 1.55, -.32, rk, fade, t * .8 + rk * 6.28, '#286ed6');
    // your launches: climbing, then orbiting for good
    const pn = performance.now();
    for (let i = rockets.length - 1; i >= 0; i--) { const L = rockets[i], k = (pn - L.t) / 1300;
      if (k >= 1) { mine.push({ tilt: L.tilt, rr: L.rr, ph: L.ph, t: pn }); if (mine.length > 6) mine.shift(); rockets.splice(i, 1); continue; }
      const e = eo(k), [ox, oy] = [L.x0, L.y0], dist = e * R * (L.rr - .8), cur = L.a - e * .8, x = ox + Math.cos(cur) * dist, y = oy + Math.sin(cur) * dist - e * 30;
      for (let j = 0; j < 3; j++) sparks.push({ x, y, vx: (Math.random() - .5) * 50 - Math.cos(cur) * 40, vy: (Math.random() - .5) * 50 - Math.sin(cur) * 40, life: 1, c: '*+.'[(Math.random() * 3) | 0] });
      glyph('/\\', '#1d3934', x, y - 6, 1, 1, 800, 14); glyph('[]', '#286ed6', x, y + 6, 1, 1, 800, 12); }
    sparks = sparks.filter(s => (s.life -= .028) > 0); for (const s of sparks) { s.x += s.vx * .016; s.y += s.vy * .016; glyph(s.c, s.life > .5 ? '#c2470e' : '#966000', s.x, s.y, s.life, 1, 700, 12); }
    for (const m of mine) ring(cx, cy, R, m.rr, m.tilt, Math.min(1, (pn - m.t) / 600), fade, m.ph + (pn - m.t) / 1000 * (2.2 / m.rr), '#1d3934');
    if (mine.length && hint) hint.textContent = `${mine.length} launched · drag to spin · click to launch · enter when ready`;
    g.globalAlpha = 1;
  }
  function ring(cx, cy, R, rr, tilt, k, fade, an, col) {
    const rx = R * rr, ry = R * rr * .28;
    for (let a = 0; a < k; a += .005) { const t2 = a * Math.PI * 2, ex = Math.cos(t2) * rx, ey = Math.sin(t2) * ry, x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
      if (Math.sin(t2) < 0 && Math.hypot(x - cx, y - cy) < R) continue; g.globalAlpha = fade * (Math.sin(t2) >= 0 ? .75 : .35); g.fillStyle = col; g.fillRect(x - 1.1, y - 1.1, 2.2, 2.2); }
    const ex = Math.cos(an) * rx, ey = Math.sin(an) * ry, x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
    if (!(Math.sin(an) < 0 && Math.hypot(x - cx, y - cy) < R)) glyph('=[]=', '#1d3934', x, y, fade, 1, 800, 15);
  }
  function enter() { if (done || !globe) { if (!globe) end(); return; } if (handAt == null) handAt = (performance.now() - t0) / 1000; }
  function end() { if (done) return; done = true; if (globe) globe.paused = false; if (!el.classList.contains('out')) { el.classList.add('out'); finish(); } setTimeout(() => el.remove(), 900); }
  layout(); addEventListener('resize', () => { layout(); if (globe) build(); });
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 700))]).then(() => { t0 = performance.now(); requestAnimationFrame(frame); });
})();
