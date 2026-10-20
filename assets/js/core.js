/* orbt core: data, formatting, the status bar, the drifting ambient orbits, reveals */
(function () {
  const O = window.OB = {};
  const RM = O.RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  O.$ = s => document.querySelector(s); O.$$ = s => [...document.querySelectorAll(s)];
  O.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  O.api = async (path, body) => {
    const r = await fetch('/api/' + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({ ok: false, error: 'No answer from the server.' }));
    if (j.ok === false) { const e = new Error(j.error || 'Request failed'); e.j = j; throw e; }
    return j;
  };
  O.usd = n => n == null || isNaN(n) ? '—' : n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + Math.round(n);
  O.num = n => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US');
  O.ago = t => { if (!t) return '—'; const s = Math.max(1, (Date.now() - new Date(t).getTime()) / 1000); return s < 60 ? Math.round(s) + 's ago' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? (s / 3600).toFixed(s < 36000 ? 1 : 0) + 'h ago' : Math.round(s / 86400) + 'd ago'; };
  O.dur = ms => { ms = Math.max(0, ms); const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(ss).padStart(2, '0')}s`; };
  O.ll = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  O.short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
  O.toast = m => { let t = O.$('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); };
  O.TAGS = { station: ['stations', '#c2470e'], starlink: ['starlink', '#8f9d98'], oneweb: ['oneweb', '#6a55c9'], gnss: ['navigation', '#966000'], weather: ['weather', '#2f8f6e'],
    earth: ['earth imaging', '#164296'], science: ['science', '#c0392b'], comms: ['comms', '#286ed6'], other: ['other', '#1d3934'] };

  // ---------- the catalogue: every active satellite, loaded once, shared by every part of the page ----------
  let CATP = null;
  O.catalog = () => CATP || (CATP = (window.__cat ? window.__cat.then(r => r && r.ok ? r.json() : fetch('/api/sky?op=catalog').then(r2 => r2.json())) : fetch('/api/sky?op=catalog').then(r => r.json())).then(j => { window.__cat = null;
    if (!j.ok) throw new Error(j.error || 'catalogue offline');
    const sats = j.sats.map((s, i) => ({ i, norad: s[0], name: s[1], tag: s[2], l1: s[3], l2: s[4], bright: !!s[5] }));
    const by = new Map(sats.map(s => [s.norad, s]));
    return { at: j.at, count: j.count, sats, by };
  }).catch(e => { CATP = null; throw e; }));
  O.rec = s => s.rec || (s.rec = ORB.rec(s.l1, s.l2));
  O.coins = () => O._coins || (O._coins = O.api('coins').then(j => { const m = new Map(); (j.taken || []).forEach(t => m.set(t[0], { symbol: t[1], state: t[2], mint: t[3] })); return { list: (j.coins || []).filter(c => c.state !== 'waiting'), taken: m }; }).catch(() => ({ list: [], taken: new Map(), offline: true })));

  // ---------- the decode effect: a line resolves out of random glyphs ----------
  const GL = '#@*+=-:./\\|01<>';
  O.decode = (el, ms = 900) => {
    if (!el || RM) return; const html = el.innerHTML; const text = el.textContent; if (!text.trim()) return;
    const nodes = []; const walk = n => n.childNodes.forEach(c => c.nodeType === 3 ? nodes.push([c, c.textContent]) : walk(c)); walk(el);
    const t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / ms); let done = true;
      nodes.forEach(([n, s]) => { let o = ''; for (let i = 0; i < s.length; i++) { const at = (i / Math.max(1, s.length)) * .7; if (s[i] === ' ' || k > at + .3) o += s[i]; else { o += GL[(Math.random() * GL.length) | 0]; done = false; } } n.textContent = o; });
      if (!done && k < 1) requestAnimationFrame(step); else el.innerHTML = html;
    };
    requestAnimationFrame(step);
  };

  // ---------- reveals ----------
  O.reveals = () => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; e.target.classList.add('in'); io.unobserve(e.target); if (e.target.matches('h2.t')) O.decode(e.target, 1000); }), { rootMargin: '0px 0px -8% 0px' });
    O.$$('.rv:not(.in)').forEach(e => io.observe(e));
  };
  // the rail and bar follow the scroll
  O.spy = () => {
    const links = O.$$('.rail a[href^="#"], .bar .nav a[href^="#"]'); if (!links.length) return;
    const secs = [...new Set(links.map(a => a.getAttribute('href')))].map(h => O.$(h)).filter(Boolean);
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => io.observe(s));
  };

  // ---------- the status bar: UTC, objects tracked, the station overhead ----------
  O.bar = async () => {
    const clk = O.$('#utc'); const tick = () => { if (clk) clk.textContent = new Date().toISOString().slice(11, 19); };
    tick(); setInterval(tick, 1000);
    try {
      const c = await O.catalog();
      const n = O.$('#nobj'); if (n) n.textContent = O.num(c.count);
      const age = O.$('#catage'); if (age) age.textContent = O.ago(c.at);
      const iss = c.by.get(25544), el = O.$('#issnow');
      if (iss && el) { const up = () => { const p = ORB.at(O.rec(iss), new Date()); if (p) el.innerHTML = `ISS <b>${O.ll(p.lat, p.lon)}</b> · ${Math.round(p.alt)} km`; }; up(); setInterval(up, 1000); }
    } catch (e) { const n = O.$('#nobj'); if (n) n.textContent = 'offline'; }
  };

  // ---------- the living background: a dot grid that wakes up under the pointer, orbits that carry real satellites,
  //            passes that cross the page with their real names, warp streaks when you scroll fast ----------
  O.ambient = () => {
    const c = O.$('#amb'); if (!c) return; const x = c.getContext('2d'); let w, h, d;
    const fit = () => { d = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; c.width = w * d; c.height = h * d; x.setTransform(d, 0, 0, d, 0, 0); };
    fit(); addEventListener('resize', fit);
    let mx = -999, my = -999, sy = scrollY, vy = 0, lastSy = scrollY; const rip = [];
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
    addEventListener('pointerdown', e => { rip.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (rip.length > 6) rip.shift(); }, { passive: true });
    addEventListener('scroll', () => { sy = scrollY; }, { passive: true });
    let names = ['ISS (ZARYA)', 'HST', 'NOAA 19', 'TIANHE', 'LANDSAT 9', 'GOES 16', 'SENTINEL-2A', 'TERRA', 'AQUA', 'METOP-C'];
    O.catalog().then(cat => { const pick = cat.sats.filter(s => s.tag !== 'starlink' && s.tag !== 'other'); if (pick.length > 20) names = Array.from({ length: 40 }, () => pick[(Math.random() * pick.length) | 0]).map(s => s.name + ' · ' + s.norad); }).catch(() => {});
    const orbits = [{ cx: .82, cy: .2, rx: .62, ry: .13, rot: -.22, n: 3, v: .045 }, { cx: .08, cy: .86, rx: .45, ry: .11, rot: .3, n: 2, v: .06 }, { cx: .55, cy: .6, rx: .95, ry: .17, rot: -.08, n: 4, v: .028 }, { cx: .3, cy: .3, rx: .7, ry: .09, rot: .15, n: 2, v: -.035 }];
    orbits.forEach((o, k) => o.lab = Array.from({ length: o.n }, (_, i) => (k * 7 + i * 3) % 10));
    const passes = []; let nextPass = performance.now() + 1500;
    const G = 32;
    const draw = t => {
      requestAnimationFrame(draw); if (document.hidden) return; const k = t / 1000; x.clearRect(0, 0, w, h);
      vy += ((sy - lastSy) - vy) * .2; lastSy = sy; const warp = Math.min(1, Math.abs(vy) / 60);
      // the grid: drifts with the scroll, wakes up near the pointer, ripples where you click
      const oy = -(sy * .25) % G, ox = (k * 2) % G;
      for (let yy = oy - G; yy < h + G; yy += G) for (let xx = ox - G; xx < w + G; xx += G) {
        let px = xx, py = yy, a = .5, s = 1.4, col = 'rgba(208,200,185,';
        const dx = px - mx, dy = py - my, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < 170) { const f = 1 - dd / 170; px += dx / (dd || 1) * f * 10; py += dy / (dd || 1) * f * 10; s = 1.4 + f * 2.6; col = 'rgba(40,110,214,'; a = .25 + f * .7; }
        for (const r of rip) { const age = (t - r.t) / 1000; if (age > 1.6) continue; const rd = Math.hypot(xx - r.x, yy - r.y), wave = Math.abs(rd - age * 520); if (wave < 40) { const f = (1 - wave / 40) * (1 - age / 1.6); s += f * 3; col = 'rgba(40,110,214,'; a = Math.max(a, f); py -= f * 6; } }
        x.fillStyle = col + a + ')';
        if (warp > .05) x.fillRect(px - .6, py - warp * 14, 1.2, warp * 28 + s); else x.fillRect(px - s / 2, py - s / 2, s, s);
      }
      // orbits with satellites on them
      x.font = '10.5px JBM, monospace';
      for (const o of orbits) {
        const cx = o.cx * w, cy = o.cy * h - (sy * .06) % (h * .3), rx = o.rx * w, ry = o.ry * h;
        x.save(); x.translate(cx, cy); x.rotate(o.rot + Math.sin(k * .05) * .02);
        x.strokeStyle = 'rgba(29,57,52,.075)'; x.setLineDash([2, 8]); x.lineWidth = 1; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
        for (let i = 0; i < o.n; i++) { const an = k * o.v * (RM ? 0 : 1) + i * Math.PI * 2 / o.n, px = Math.cos(an) * rx, py = Math.sin(an) * ry;
          for (let j = 1; j < 22; j++) { const b = an - j * .01 * Math.sign(o.v), qx = Math.cos(b) * rx, qy = Math.sin(b) * ry; x.fillStyle = `rgba(40,110,214,${.3 * (1 - j / 22)})`; x.fillRect(qx - 1, qy - 1, 2, 2); }
          x.rotate(-(o.rot)); const gx = px * Math.cos(o.rot) - py * Math.sin(o.rot), gy = px * Math.sin(o.rot) + py * Math.cos(o.rot); x.rotate(o.rot);
          x.fillStyle = 'rgba(29,57,52,.5)'; x.fillText('=[]=', px - 13, py + 4);
          x.save(); x.rotate(-o.rot); x.fillStyle = 'rgba(29,57,52,.3)'; x.fillText(String(names[o.lab[i] % names.length]).slice(0, 26), gx + 18, gy - 8); x.restore(); }
        x.restore();
      }
      // a pass: a real satellite name crossing the page every few seconds
      if (t > nextPass && !RM) { const L2R = Math.random() < .5, y0 = h * (.15 + Math.random() * .7); passes.push({ t0: t, dur: 9000 + Math.random() * 5000, y0, y1: y0 + (Math.random() - .5) * h * .4, L2R, nm: names[(Math.random() * names.length) | 0] }); nextPass = t + 5000 + Math.random() * 4000; }
      for (let i = passes.length - 1; i >= 0; i--) { const p = passes[i], f = (t - p.t0) / p.dur; if (f > 1) { passes.splice(i, 1); continue; }
        const X = (p.L2R ? -60 + f * (w + 120) : w + 60 - f * (w + 120)), Y = p.y0 + (p.y1 - p.y0) * f + Math.sin(f * Math.PI) * -40;
        for (let j = 1; j < 30; j++) { const g2 = f - j * .004; if (g2 < 0) break; const tx = (p.L2R ? -60 + g2 * (w + 120) : w + 60 - g2 * (w + 120)), ty = p.y0 + (p.y1 - p.y0) * g2 + Math.sin(g2 * Math.PI) * -40; x.fillStyle = `rgba(40,110,214,${.4 * (1 - j / 30)})`; x.fillRect(tx - 1, ty - 1, 2, 2); }
        x.fillStyle = 'rgba(29,57,52,.55)'; x.font = '700 11px JBM, monospace'; x.fillText('=[]=', X - 13, Y + 4); x.font = '10.5px JBM, monospace'; x.fillStyle = 'rgba(29,57,52,.35)'; x.fillText(p.nm, X + 18, Y - 8); }
    };
    requestAnimationFrame(draw);
  };

  // consoles light up under the pointer
  document.addEventListener('pointermove', e => { const c = e.target.closest && e.target.closest('.con:not(.dark)'); if (O._lit && O._lit !== c) O._lit.classList.remove('lit'); if (!c) { O._lit = null; return; } const b = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - b.left) + 'px'); c.style.setProperty('--my', (e.clientY - b.top) + 'px'); c.classList.add('lit'); O._lit = c; }, { passive: true });
  document.addEventListener('DOMContentLoaded', () => { O.reveals(); O.spy(); O.bar(); O.ambient(); });
})();
