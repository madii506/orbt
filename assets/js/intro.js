/* orbt intro, 10 s on every visit to the home page (longer if you play with it).
   1  a line powers on and a swarm of glyphs assembles the real planet
   2  the limb draws itself and sunlight sweeps across: today's real day and night
   3  every satellite lifts off to its own altitude, low orbit first, the geostationary ring last
   4  the planet turns to the International Space Station and draws its real orbit, one lap ahead and one behind
   5  the constellations light up one after another: stations, navigation, weather, the internet swarm
   6  the planet glides into place under the page and the live globe takes over from the same cells
   Drag to spin it, move the pointer to make the glyphs swell, click (or press space) to launch a satellite of your
   own. Scroll, any other key, or "skip" goes straight in. */
(() => {
  const el = document.getElementById('intro'), html = document.documentElement; if (!el) return;
  const q = new URLSearchParams(location.search);
  const finish = () => { html.classList.remove('booting'); html.classList.add('booted'); document.body.classList.remove('lock'); window.dispatchEvent(new Event('orbt:enter')); };
  if (q.has('skip') || OB.RM) { el.remove(); finish(); return; }
  html.classList.add('booting'); document.body.classList.add('lock');
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), bar = el.querySelector('.bbar i'), hint = el.querySelector('.hint');
  const DPR = Math.min(2, devicePixelRatio || 1);
  const TL = { power: .6, spawn0: .2, spawn1: 2.0, fly: 1.0, limb0: 1.9, limb1: 2.9, sweep0: 2.6, sweep1: 3.8, rise0: 3.6, rise1: 5.0, tour0: 5.0, tour1: 6.4, track1: 7.4, pulse0: 7.2, pulse1: 8.8, hand: 8.9, handDur: 1.1 };
  const cl = x => Math.min(1, Math.max(0, x)), eo = x => 1 - Math.pow(1 - cl(x), 3), io = x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const back = x => { x = cl(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const rnd = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const NOISE = '#@%*+=:./\\|01', PULSE = ['station', 'gnss', 'weather', 'earth', 'starlink'];
  let W, H, sprites = new Map(), F = 12;
  function sprite(ch, col, wt, fs) {
    const k = ch + col + wt + fs; let s = sprites.get(k); if (s) return s;
    const box = fs * 1.4; s = document.createElement('canvas'); s.width = s.height = Math.ceil(box * DPR); s.box = box;
    const c = s.getContext('2d'); c.scale(DPR, DPR); c.font = `${wt} ${fs}px JBM, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(ch, box / 2, box / 2); sprites.set(k, s); return s;
  }
  const glyph = (ch, col, x, y, a = 1, sc = 1, wt = 400, fs = F) => { if (a <= .01 || sc <= .01) return; const s = sprite(ch, col, wt, fs), z = s.box * sc; g.globalAlpha = Math.min(1, a); g.drawImage(s, x - z / 2, y - z / 2, z, z); };
  const split = col => [col.replace(/,\s*[\d.]+\)$/, ',1)'), +(col.match(/,\s*([\d.]+)\)$/) || [0, 1])[1]];
  let P = [], globe = null, view = null, t0 = 0, done = false, handAt = null, lastTouch = 0, engaged = false;
  let mx = -9999, my = -9999, drag = null, rockets = [], sparks = [], mine = [], tour = null, track = null;
  function layout() { W = innerWidth; H = innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0); }
  function build() {
    globe = window.__globe; if (!globe) return false;
    globe.paused = true; globe.fit(); F = globe.f;
    const groups = globe.landGroups(new Date()); P = []; let i = 0;
    for (const k in groups) { const G = groups[k], [col, al] = split(G.col);
      for (let n = 0; n < G.p.length; n += 2) { const j = i++; P.push({ x: G.p[n], y: G.p[n + 1], ch: G.g, col, al, born: TL.spawn0 + rnd(j, 3) * (TL.spawn1 - TL.spawn0), sx: rnd(j, 1), sy: rnd(j, 2), w: rnd(j, 5) * 6.28, dir: rnd(j, 6) > .5 ? 1 : -1 }); } }
    view = { s: Math.min(W, H) * .31 / globe.R, cx: W / 2, cy: H * .5 };
    return true;
  }
  let hk = 0;
  const map = (x, y) => { const s = 1 + (view.s - 1) * (1 - hk), cx = globe.X + (view.cx - globe.X) * (1 - hk), cy = globe.Y + (view.cy - globe.Y) * (1 - hk); return [cx + (x - globe.X) * s, cy + (y - globe.Y) * s, s]; };
  const lens = (x, y) => { const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy; if (d2 > 130 * 130) return [x, y, 1, 0]; const d = Math.sqrt(d2), f = 1 - d / 130; return [x + dx / (d || 1) * f * 14, y + dy / (d || 1) * f * 14, 1 + f * .9, f]; };
  const touch = () => { lastTouch = performance.now(); if (!engaged) { engaged = true; el.classList.add('engaged'); el.querySelector('.bskip').textContent = 'enter ›'; } };
  el.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY;
    if (drag && globe) { const k = 90 / (globe.R * map(0, 0)[2]), dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy)); globe.lon0 = drag.lon - dx * k; globe.lat0 = Math.max(-60, Math.min(60, drag.lat + dy * k)); if (drag.moved > 4) { touch(); tour = null; } } });
  el.addEventListener('pointerleave', () => { mx = my = -9999; drag = null; });
  el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; if (globe) drag = { x: e.clientX, y: e.clientY, lon: globe.lon0, lat: globe.lat0, moved: 0 }; });
  el.addEventListener('pointerup', e => { if (e.target.closest('button')) return; if (drag && drag.moved < 5) launch(e.clientX, e.clientY); drag = null; });
  addEventListener('keydown', e => { if (done) return; if (e.key === ' ') { e.preventDefault(); launch(W / 2 + (Math.random() - .5) * 240, H * .55 + (Math.random() - .5) * 120); return; } enter(); });
  addEventListener('wheel', () => enter(), { passive: true });
  el.querySelector('.bskip').addEventListener('click', () => enter());
  function launch(x, y) {
    touch(); if (!globe) return; const [cx, cy, s] = map(globe.X, globe.Y), R = globe.R * s;
    const a = Math.atan2(y - cy, x - cx), d = Math.min(Math.hypot(x - cx, y - cy), R * .98);
    rockets.push({ x0: cx + Math.cos(a) * d, y0: cy + Math.sin(a) * d, a, t: performance.now(), tilt: (Math.random() - .5) * 1.4, rr: 1.25 + Math.random() * .5, ph: Math.random() * 6.28 });
  }
  const iss = () => globe && globe.sats && globe.sats.find(s => s.norad === 25544);
  function frame(now) {
    if (done) return; requestAnimationFrame(frame);
    const t = (now - t0) / 1000; g.clearRect(0, 0, W, H);
    if (!globe && !build()) return;
    if (handAt == null) { const auto = !engaged ? TL.hand : Math.max(TL.hand, (lastTouch - t0) / 1000 + 5); if (t >= auto) handAt = t; }
    hk = handAt == null ? 0 : io((t - handAt) / TL.handDur);
    if (bar) bar.style.transform = `scaleX(${engaged ? 1 : cl(t / TL.hand)})`;
    if (handAt != null && t - handAt > TL.handDur - .35 && !el.classList.contains('out')) { el.classList.add('out'); finish(); globe.paused = false; }
    if (handAt != null && t - handAt > TL.handDur + .2) return end();
    // 1 · power on
    if (t < TL.power + .3) { const k = eo(t / TL.power), a = 1 - cl((t - TL.power) / .3); g.globalAlpha = a; g.fillStyle = '#1d3934'; g.fillRect(W / 2 - k * W * .3, H * .5, k * W * .6, 1); g.globalAlpha = 1; }
    const assembled = t > TL.spawn1 + TL.fly + .2;
    // 4 · the tour: the planet turns to the space station
    const st = iss();
    if (st && !tour && t >= TL.tour0 && !engaged) { const p = ORB.at(OB.rec(st), new Date()); if (p) { const tl = p.lon - 62, tt = Math.max(-35, Math.min(35, p.lat * .4 + 12)); tour = { f: { lon: globe.lon0, lat: globe.lat0 }, dl: ((tl - globe.lon0 + 540) % 360) - 180, dt: tt - globe.lat0 }; } }
    if (tour && !drag) { const k = io((t - TL.tour0) / (TL.tour1 - TL.tour0)); globe.lon0 = tour.f.lon + tour.dl * k; globe.lat0 = tour.f.lat + tour.dt * k; if (k >= 1) tour.done = true; }
    if (!drag && assembled && (!tour || tour.done)) globe.lon0 += .025;
    const [cx, cy, sc] = map(globe.X, globe.Y), R = globe.R * sc;
    // 2 · sunlight sweeps across: until it passes, every cell waits in the dark
    const sweep = io((t - TL.sweep0) / (TL.sweep1 - TL.sweep0)), sx0 = cx - R * 1.2 + sweep * R * 2.6;
    if (!assembled) {
      for (const p of P) {
        const k = io((t - p.born - .15) / TL.fly), pop = back((t - p.born) / .22); if (pop <= 0) continue;
        const [tx, ty, s2] = map(p.x, p.y); let x = tx, y = ty, ch = p.ch, a = p.al;
        if (k < 1) { const sx = p.sx * W, sy = p.sy * H + Math.sin(t * 3 + p.w) * 6, dx = sx - tx, dy = sy - ty, sw = (1 - k) * 1.4 * p.dir, cs = Math.cos(sw), sn = Math.sin(sw);
          x = tx + (dx * cs - dy * sn) * (1 - k); y = ty + (dx * sn + dy * cs) * (1 - k); if (k < .8 && Math.random() < .35) ch = NOISE[(Math.random() * NOISE.length) | 0]; a = Math.max(.25, p.al) * (.4 + .6 * k); }
        const [lx, ly, ls, lf] = lens(x, y); glyph(ch, lf > .35 ? '#286ed6' : '#1d3934', lx, ly, Math.max(a * .55, lf), s2 * Math.min(1, pop) * ls, 400, F);
      }
    } else {
      const groups = globe.landGroups(new Date());
      for (const k in groups) { const G = groups[k], [col, al] = split(G.col); for (let n = 0; n < G.p.length; n += 2) { const [x, y, s2] = map(G.p[n], G.p[n + 1]), [lx, ly, ls, lf] = lens(x, y);
        const lit = x < sx0, edge = Math.abs(x - sx0) < 16; glyph(edge ? '|' : G.g, lf > .35 || edge ? '#286ed6' : lit ? col : '#1d3934', lx, ly, edge ? .9 : Math.max(lit ? al : .3, lf * .9), s2 * ls, 400, F); } }
    }
    g.globalAlpha = 1;
    const lk = eo((t - TL.limb0) / (TL.limb1 - TL.limb0)); if (lk > 0) { g.strokeStyle = 'rgba(29,57,52,.5)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + lk * Math.PI * 2); g.stroke(); }
    // 3 · every satellite lifts off, low orbit first; 5 · the constellations light up in turn
    const buf = SKY.last(), pk = (t - TL.pulse0) / (TL.pulse1 - TL.pulse0), ptag = pk >= 0 && pk < 1 ? PULSE[Math.floor(pk * PULSE.length)] : null, pph = pk >= 0 && pk < 1 ? (pk * PULSE.length) % 1 : 0;
    if (buf && globe.sats && t > TL.rise0 - .2) {
      const S = globe.sats, n = Math.min(S.length, buf.length / 4);
      for (let i = 0; i < n; i++) {
        const o = i * 4; if (buf[o] !== buf[o]) continue; const alt = buf[o + 2], d = Math.min(1, Math.sqrt(Math.max(0, alt) / 36000)) * .9 + rnd(i, 9) * .3, k = eo((t - TL.rise0 - d) / .7); if (k <= 0) continue;
        const r = 1 + (SKY.altR(alt) - 1) * k, p = globe.proj(buf[o], buf[o + 1], r); if (p[2] < 0 && p[0] * p[0] + p[1] * p[1] < 1) continue;
        const [x, y] = map(globe.X + p[0] * globe.R, globe.Y - p[1] * globe.R), tag = S[i].tag, on = tag === ptag;
        const z = (tag === 'starlink' ? 1.5 : tag === 'station' ? 3.6 : 2.3) * (on ? 1.8 + Math.sin(pph * Math.PI) * 1.2 : 1);
        g.fillStyle = OB.TAGS[tag][1]; g.globalAlpha = ptag && !on ? .18 : buf[o + 3] > .5 ? (tag === 'starlink' && !on ? .55 : .95) : .3; g.fillRect(x - z / 2, y - z / 2, z, z);
      }
      g.globalAlpha = 1;
    }
    // 4 · the station's real orbit, one lap behind and one ahead, drawing itself
    if (st && t > TL.tour1 - .4) {
      if (!track) { const r = OB.rec(st), per = ORB.periodMin(r), n0 = new Date(); track = []; for (let m = -per / 2; m <= per; m += .5) { const p = ORB.at(r, new Date(n0.getTime() + m * 6e4)); if (p) track.push([p.lat, p.lon, p.alt, m]); } }
      const k = eo((t - TL.tour1 + .4) / (TL.track1 - TL.tour1 + .4)), fade = 1 - hk, n2 = Math.floor(track.length * k);
      for (let i = 0; i < n2; i++) { const [la, lo, al, m] = track[i], p = globe.proj(la, lo, SKY.altR(al)); if (p[2] < 0 && p[0] * p[0] + p[1] * p[1] < 1) continue; const [x, y] = map(globe.X + p[0] * globe.R, globe.Y - p[1] * globe.R); g.globalAlpha = fade * (m > 0 ? .9 : .35); g.fillStyle = '#286ed6'; g.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); }
      const p0 = ORB.at(OB.rec(st), new Date()); if (p0) { const p = globe.proj(p0.lat, p0.lon, SKY.altR(p0.alt)), [x, y] = map(globe.X + p[0] * globe.R, globe.Y - p[1] * globe.R), pu = (t * .7) % 1;
        glyph('=[]=', '#1d3934', x, y, fade, 1.1, 800, 15); g.globalAlpha = fade * (1 - pu); g.strokeStyle = '#286ed6'; g.beginPath(); g.arc(x, y, 12 + pu * 30, 0, Math.PI * 2); g.stroke(); }
      g.globalAlpha = 1;
    }
    // your launches: climbing, then orbiting for good
    const pn = performance.now(), fade = 1 - hk;
    for (let i = rockets.length - 1; i >= 0; i--) { const L = rockets[i], k = (pn - L.t) / 1300;
      if (k >= 1) { mine.push({ tilt: L.tilt, rr: L.rr, ph: L.ph, t: pn }); if (mine.length > 6) mine.shift(); rockets.splice(i, 1); continue; }
      const e = eo(k), dist = e * R * (L.rr - .8), cur = L.a - e * .8, x = L.x0 + Math.cos(cur) * dist, y = L.y0 + Math.sin(cur) * dist - e * 30;
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
  function enter() { if (done) return; if (!globe) return end(); if (handAt == null) handAt = (performance.now() - t0) / 1000; }
  function end() { if (done) return; done = true; if (globe) globe.paused = false; if (!el.classList.contains('out')) { el.classList.add('out'); finish(); } setTimeout(() => el.remove(), 900); }
  layout(); addEventListener('resize', () => { layout(); if (globe) build(); });
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 700))]).then(() => { t0 = performance.now(); requestAnimationFrame(frame); });
})();
