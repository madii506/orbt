/* orbt sky: an ASCII Earth (real coastlines, today's real day and night) with every active satellite on it, live.
   Land and sea are characters on a grid; satellites are points computed by SGP4 in a worker, once a second.
   Altitude is compressed so low orbits, the navigation shells and the geostationary ring all fit on one screen. */
(function () {
  const D = Math.PI / 180;
  const altR = a => 1 + .36 * Math.sqrt(Math.max(0, a) / 35786);   // 400 km -> 1.04, GPS -> 1.27, GEO -> 1.36
  class Globe {
    constructor(canvas, o = {}) {
      this.c = canvas; this.x = canvas.getContext('2d'); this.o = o;
      this.lon0 = o.lon != null ? o.lon : -30; this.lat0 = o.lat != null ? o.lat : 18; this.spin = o.spin != null ? o.spin : 2.2;   // degrees per second
      this.zoom = 1; this.font = o.font || 12; this.sats = null; this.pos = null; this.filter = null; this.focus = null; this.hover = null; this.trail = null;
      this.cx = o.cx || .5; this.cy = o.cy || .5; this.rk = o.r || .34; this.fps = o.fps || 30; this.labels = o.labels !== false; this.drawn = 0;
      this.fit(); addEventListener('resize', () => this.fit());
      this.vis = true; new IntersectionObserver(es => { this.vis = es[0].isIntersecting; }).observe(canvas);
      this.input(); this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    }
    fit() {
      const d = Math.min(2, devicePixelRatio || 1), b = this.c.getBoundingClientRect(); this.w = b.width; this.h = b.height; this.d = d;
      this.c.width = Math.round(this.w * d); this.c.height = Math.round(this.h * d); this.x.setTransform(d, 0, 0, d, 0, 0);
      const f = this.w < 700 ? this.font - 2 : this.font; this.x.font = `${f}px JBM, monospace`; this.cw = this.x.measureText('M').width; this.ch = f * 1.08; this.f = f;
      this.R = Math.min(this.w, this.h) * this.rk * this.zoom; this.X = this.w * this.cx; this.Y = this.h * this.cy;
    }
    setSats(sats) { this.sats = sats; }
    setPos(buf) { this.pos = buf; }
    input() {
      const c = this.c; let drag = null, vx = 0, vy = 0, last = 0;
      c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, lon: this.lon0, lat: this.lat0, moved: 0 }; c.setPointerCapture(e.pointerId); c.classList.add('drag'); this.held = true; });
      c.addEventListener('pointermove', e => {
        const b = c.getBoundingClientRect(); this.mx = e.clientX - b.left; this.my = e.clientY - b.top;
        if (!drag) return; const k = 90 / this.R; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
        const nl = drag.lon - dx * k, nt = Math.max(-70, Math.min(70, drag.lat + dy * k)); const now = performance.now(); if (last) { vx = (nl - this.lon0) / Math.max(8, now - last) * 1000; vy = 0; } last = now;
        this.lon0 = nl; this.lat0 = nt;
      });
      const up = e => { if (drag && drag.moved < 5 && this.hover != null && this.o.onPick) this.o.onPick(this.hover); if (drag && drag.moved >= 5) this.inertia = Math.max(-60, Math.min(60, vx)); drag = null; last = 0; c.classList.remove('drag'); this.held = false; };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('pointerleave', () => { this.mx = null; this.hover = null; if (this.o.onHover) this.o.onHover(null); });
    }
    // the view: where the camera looks
    proj(lat, lon, r) {
      const la = lat * D, dl = (lon - this.lon0) * D, l0 = this.lat0 * D, cl = Math.cos(la);
      return [r * cl * Math.sin(dl), r * (Math.cos(l0) * Math.sin(la) - Math.sin(l0) * cl * Math.cos(dl)), r * (Math.sin(l0) * Math.sin(la) + Math.cos(l0) * cl * Math.cos(dl))];
    }
    lookAt(lat, lon, ms = 1400) { const f = { lon: this.lon0, lat: this.lat0 }, t0 = performance.now(); let dl = ((lon - f.lon + 540) % 360) - 180; this.anim = { f, t0, ms, dl, dt: Math.max(-60, Math.min(60, lat)) - f.lat }; }
    loop(t) {
      requestAnimationFrame(this.loop); if (!this.vis || document.hidden) { this.lt = t; return; }
      if (t - this.drawn < 1000 / this.fps - 2) return; const dt = this.lt ? Math.min(.1, (t - this.lt) / 1000) : 0; this.lt = t; this.drawn = t;
      if (this.anim) { const k = Math.min(1, (t - this.anim.t0) / this.anim.ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; this.lon0 = this.anim.f.lon + this.anim.dl * e; this.lat0 = this.anim.f.lat + this.anim.dt * e; if (k >= 1) this.anim = null; }
      else if (!this.held) { if (this.inertia) { this.lon0 -= this.inertia * dt; this.inertia *= Math.pow(.05, dt); if (Math.abs(this.inertia) < .2) this.inertia = 0; } if (!OB.RM && !this.focusLock) this.lon0 += this.spin * dt; }
      this.draw(t);
    }
    draw(t) {
      const x = this.x, w = this.w, h = this.h, R = this.R, X = this.X, Y = this.Y, cw = this.cw, ch = this.ch; x.clearRect(0, 0, w, h);
      const now = new Date(), ss = ORB.subsolar(now), sv = this.proj(ss.lat, ss.lon, 1);
      // the disk
      x.fillStyle = 'rgba(246,243,236,.86)'; x.beginPath(); x.arc(X, Y, R, 0, Math.PI * 2); x.fill();
      // land and sea, one character per cell
      const l0 = this.lat0 * D, s0 = Math.sin(l0), c0 = Math.cos(l0);
      const cols = Math.ceil(2 * R / cw) + 2, rows = Math.ceil(2 * R / ch) + 2, x0 = X - (cols / 2) * cw, y0 = Y - (rows / 2) * ch;
      const groups = {};
      const put = (g, col, px, py) => { const k = g + col; (groups[k] || (groups[k] = { g, col, p: [] })).p.push(px, py); };
      for (let j = 0; j < rows; j++) {
        const py = y0 + (j + .5) * ch, yy = -(py - Y) / R;
        for (let i = 0; i < cols; i++) {
          const px = x0 + (i + .5) * cw, xx = (px - X) / R, rr = xx * xx + yy * yy; if (rr > 1) continue;
          const z = Math.sqrt(1 - rr);
          const lat = Math.asin(z * s0 + yy * c0) / D, lon = this.lon0 + Math.atan2(xx, z * c0 - yy * s0) / D;
          const day = xx * sv[0] + yy * sv[1] + z * sv[2];   // >0 in sunlight
          const land = LAND.at(lat, ((lon + 540) % 360) - 180);
          const edge = rr > .955;
          if (land) { if (day > .04) put(day > .18 ? '#' : '%', day > .18 ? 'rgba(29,57,52,.8)' : 'rgba(29,57,52,.55)', px, py); else put(':', 'rgba(40,110,214,.55)', px, py); }
          else if (day < -.04) put('.', 'rgba(29,57,52,.2)', px, py);
          else if (day < .04) put('~', 'rgba(150,96,0,.45)', px, py);             // the terminator: dawn and dusk
          else if (edge) put('.', 'rgba(29,57,52,.18)', px, py);
          else if ((Math.round(lat) % 30 === 0 && i % 2 === 0) || (Math.round(((lon % 30) + 30) % 30) === 0 && j % 2 === 0)) put('.', 'rgba(29,57,52,.09)', px, py);
        }
      }
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${this.f}px JBM, monospace`;
      for (const k in groups) { const G = groups[k]; x.fillStyle = G.col; const p = G.p; for (let n = 0; n < p.length; n += 2) x.fillText(G.g, p[n], p[n + 1]); }
      x.strokeStyle = 'rgba(29,57,52,.5)'; x.lineWidth = 1; x.beginPath(); x.arc(X, Y, R, 0, Math.PI * 2); x.stroke();
      // the satellites
      this.hover = null; let best = 12 * 12;
      if (this.sats && this.pos) {
        const P = this.pos, S = this.sats, n = Math.min(S.length, P.length / 4), fl = this.filter, mx = this.mx, my = this.my, cols = {};
        const shells = [];
        for (let i = 0; i < n; i++) {
          const o = i * 4, lat = P[o]; if (lat !== lat) continue;
          const s = S[i]; const p = this.proj(lat, P[o + 1], altR(P[o + 2]));
          const sx = X + p[0] * R, sy = Y - p[1] * R;
          if (p[2] < 0 && p[0] * p[0] + p[1] * p[1] < 1) continue;   // behind the planet
          if (sx < -4 || sy < -4 || sx > w + 4 || sy > h + 4) continue;
          const on = !fl || fl.has(s.tag), lit = P[o + 3] > .5;
          const key = (on ? s.tag : 'off') + (lit ? '' : 'd');
          (cols[key] || (cols[key] = [])).push(sx, sy);
          if (on && mx != null) { const dx = sx - mx, dy = sy - my, d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; this.hover = i; } }
          if (s.tag === 'station' && on && this.labels && i !== this.focus && !/DEB|R\/B/.test(s.name)) shells.push([s, sx, sy]);
        }
        for (const k in cols) {
          const tag = k.replace(/d$/, ''), dark = k.endsWith('d'), c = tag === 'off' ? 'rgba(29,57,52,.08)' : OB.TAGS[tag][1];
          x.fillStyle = c; x.globalAlpha = tag === 'off' ? 1 : dark ? .32 : tag === 'starlink' ? .55 : .95;
          const sz = tag === 'starlink' ? 1.5 : tag === 'station' ? 3.4 : 2.2, a = cols[k];
          for (let n2 = 0; n2 < a.length; n2 += 2) x.fillRect(a[n2] - sz / 2, a[n2 + 1] - sz / 2, sz, sz);
        }
        x.globalAlpha = 1; x.textAlign = 'left'; x.font = `700 ${Math.max(10, this.f - 1)}px JBM, monospace`;
        const said = new Set(); for (const [s, sx, sy] of shells) { const nm = s.name.replace(/\s*\(.*\)/, ''); if (said.has(nm) || said.size > 5) continue; said.add(nm); x.fillStyle = 'rgba(194,71,14,.9)'; x.fillText(nm, sx + 7, sy - 6); }
        // the focused satellite: its orbit ahead and behind, and its glyph
        if (this.focus != null && S[this.focus]) this.drawFocus(S[this.focus], now);
      }
      if (this.o.onHover) this.o.onHover(this.hover, this.mx, this.my);
      if (this.o.after) this.o.after(x, this);
    }
    drawFocus(s, now) {
      const x = this.x, R = this.R, X = this.X, Y = this.Y, r = OB.rec(s);
      if (!this.trail || this.trail.k !== s.norad || now - this.trail.at > 20000) {
        const per = ORB.periodMin(r), span = Math.min(per, 24 * 60), pts = [];
        for (let m = -span * .5; m <= span * .5; m += Math.max(.5, span / 240)) { const p = ORB.at(r, new Date(now.getTime() + m * 6e4)); if (p) pts.push([p.lat, p.lon, p.alt, m]); }
        this.trail = { k: s.norad, at: now.getTime(), pts, t0: now.getTime() };
      }
      const sh = (now.getTime() - this.trail.t0) / 6e4;
      for (const [lat, lon, alt, m] of this.trail.pts) {
        const p = this.proj(lat, lon, altR(alt)); if (p[2] < 0 && p[0] * p[0] + p[1] * p[1] < 1) continue;
        const ahead = m - sh > 0; x.fillStyle = ahead ? 'rgba(40,110,214,.85)' : 'rgba(40,110,214,.28)'; x.fillRect(X + p[0] * R - 1, Y - p[1] * R - 1, 2, 2);
      }
      const p0 = ORB.at(r, now); if (!p0) return; const p = this.proj(p0.lat, p0.lon, altR(p0.alt));
      const sx = X + p[0] * R, sy = Y - p[1] * R, hidden = p[2] < 0 && p[0] * p[0] + p[1] * p[1] < 1;
      x.font = `800 ${this.f + 3}px JBM, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = hidden ? 'rgba(29,57,52,.35)' : '#1d3934'; x.fillText('=[]=', sx, sy);
      x.strokeStyle = 'rgba(40,110,214,.7)'; x.lineWidth = 1; const pulse = (performance.now() / 1000) % 1.6 / 1.6; x.globalAlpha = 1 - pulse; x.beginPath(); x.arc(sx, sy, 10 + pulse * 22, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
      x.textAlign = 'left'; x.font = `700 ${this.f}px JBM, monospace`; x.fillStyle = '#1d3934'; x.fillText(s.name, sx + 26, sy - 12);
    }
  }
  // the sky engine: one worker, one catalogue, any number of globes
  let worker = null, ready = null; const subs = new Set();
  function start(sats) {
    if (ready) return ready;
    ready = new Promise(res => {
      worker = new Worker('/assets/js/sky-worker.js');
      worker.onmessage = e => { if (e.data.type === 'ready') { res(); tick(); setInterval(tick, 1000); } else if (e.data.type === 'pos') subs.forEach(f => f(e.data.buf, e.data.t)); };
      worker.postMessage({ type: 'init', tle: sats.map(s => [s.l1, s.l2]) });
    });
    const tick = () => { if (!document.hidden) worker.postMessage({ type: 'tick', t: Date.now() }); };
    return ready;
  }
  window.SKY = { Globe, start, on: f => { subs.add(f); return () => subs.delete(f); }, altR };
})();
