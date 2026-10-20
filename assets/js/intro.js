/* orbt intro: a launch sequence. The terminal lines are real: the catalogue count, its age, where the ISS is, where the
   sun is overhead. Then T-3, liftoff, the climb, and the planet's limb rising under you. [ enter orbit ] opens the site. */
(function () {
  const el = document.getElementById('intro'); if (!el) return;
  const q = new URLSearchParams(location.search);
  let seen = false; try { seen = sessionStorage.getItem('orbt_intro') === '1'; } catch (e) {}
  if ((seen && !q.has('intro')) || q.has('skip')) { el.remove(); document.body.classList.remove('lock'); window.dispatchEvent(new Event('orbt:enter')); return; }
  document.body.classList.add('lock');
  const cv = el.querySelector('canvas'), x = cv.getContext('2d'), term = el.querySelector('.term'), btn = el.querySelector('.enter'), cnt = el.querySelector('.cnt');
  let w, h, d; const fit = () => { d = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; cv.width = w * d; cv.height = h * d; x.setTransform(d, 0, 0, d, 0, 0); };
  fit(); addEventListener('resize', fit);
  const FIG = [
    '                    ##\\        ##\\     ',
    '                    ## |       ## |    ',
    ' ######\\   ######\\  #######\\ ######\\   ',
    '##  __##\\ ##  __##\\ ##  __##\\\\_##  _|  ',
    '## /  ## |## |  \\__|## |  ## | ## |    ',
    '## |  ## |## |      ## |  ## | ## |##\\ ',
    '\\######  |## |      #######  | \\####  |',
    ' \\______/ \\__|      \\_______/   \\____/ '];
  const ROCKET = ['   /\\   ', '  /  \\  ', '  |  |  ', ' | [] | ', ' | [] | ', ' |    | ', '/| OB |\\', '/_|__|_\\', '  /__\\  '];
  const stars = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), z: .2 + Math.random() * .8, c: '.*+'[(Math.random() * 3.2) | 0] || '.', p: Math.random() * 6 }));
  const parts = [];
  const GL = '#@*+=-:./\\|01';
  let phase = 'boot', T0 = performance.now(), tLift = 0, tOrbit = 0, done = false, catalog = null, issLL = null;
  // the real lines
  const lines = [];
  const say = (html, cls) => { const dv = document.createElement('div'); if (cls) dv.className = cls; dv.innerHTML = html; term.appendChild(dv); while (term.children.length > 8) term.firstChild.remove(); };
  const typeLine = (txt, cls) => new Promise(res => { const dv = document.createElement('div'); if (cls) dv.className = cls; term.appendChild(dv); while (term.children.length > 8) term.firstChild.remove(); let i = 0; const go = () => { dv.innerHTML = txt.slice(0, i) + '<span style="opacity:.7">_</span>'; i += 2; if (i <= txt.length + 1) setTimeout(go, 12); else { dv.innerHTML = txt; res(); } }; go(); });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  (async () => {
    await wait(350); await typeLine('&gt; <b>orbt</b> ground station · cold start');
    await wait(150); await typeLine('&gt; requesting orbital elements · celestrak.org');
    const cat = await Promise.race([OB.catalog().catch(() => null), wait(7000).then(() => null)]); catalog = cat;
    if (cat) {
      await typeLine(`<span class="ok">  ok</span> <b>${OB.num(cat.count)}</b> active objects · elements ${OB.ago(cat.at)}`);
      const iss = cat.by.get(25544); if (iss) { const p = ORB.at(OB.rec(iss), new Date()); if (p) { issLL = p; await typeLine(`&gt; sgp4 · ISS (ZARYA) at <b>${OB.ll(p.lat, p.lon)}</b>, ${Math.round(p.alt)} km, ${p.speed.toFixed(2)} km/s`); } }
      const ss = ORB.subsolar(new Date()); await typeLine(`&gt; sun overhead at ${OB.ll(ss.lat, ss.lon)} · day/night line computed`);
      cnt.innerHTML = `<b>${OB.num(cat.count)}</b>objects in orbit right now`;
    } else await typeLine('<span style="color:#ffb38a">  the catalogue is slow to answer; the sky will fill in when it does</span>');
    await typeLine('&gt; launch window · <b>open</b>');
    phase = 'count'; T0 = performance.now();
  })();
  const enter = () => {
    if (done) return; done = true; try { sessionStorage.setItem('orbt_intro', '1'); } catch (e) {}
    el.classList.add('gone'); document.body.classList.remove('lock'); window.dispatchEvent(new Event('orbt:enter'));
    setTimeout(() => el.remove(), 1500);
  };
  btn.onclick = enter; el.querySelector('.skip').onclick = enter;
  addEventListener('keydown', e => { if (!done && (e.key === 'Enter' || e.key === 'Escape') && (phase === 'orbit' || e.key === 'Escape')) enter(); });
  const ink = a => `rgba(207,224,218,${a})`;
  function frame(t) {
    if (done && !el.isConnected) return; requestAnimationFrame(frame);
    const k = (t - T0) / 1000; x.clearRect(0, 0, w, h);
    let speed = .02, shake = 0;
    if (phase === 'lift') { const lk = (t - tLift) / 1000; speed = .02 + Math.min(2.2, lk * lk * .5); shake = Math.max(0, 3 - lk) * 1.2; if (lk > 3.4) { phase = 'orbit'; tOrbit = t; } }
    if (phase === 'orbit') { const ok = (t - tOrbit) / 1000; speed = Math.max(.02, 2.2 * Math.exp(-ok * 2.2)); }
    const sx = (Math.random() - .5) * shake, sy = (Math.random() - .5) * shake; x.save(); x.translate(sx, sy);
    // stars (streaks at speed)
    x.font = '12px JBM, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const s of stars) {
      s.y += speed * s.z * .012; if (s.y > 1.05) { s.y = -.05; s.x = Math.random(); }
      const a = .25 + .55 * s.z * (.6 + .4 * Math.sin(k * 2 + s.p));
      if (speed > .4) { x.fillStyle = ink(a * .8); const L = Math.min(60, speed * 26 * s.z); x.fillRect(s.x * w, s.y * h - L, 1, L); }
      else { x.fillStyle = ink(a); x.fillText(s.c, s.x * w, s.y * h); }
    }
    // the wordmark, assembling out of noise
    if (phase === 'boot' || phase === 'count' || phase === 'orbit') {
      const fs = Math.max(9, Math.min(22, w / 48)); if (phase === 'orbit') x.globalAlpha = Math.min(1, (t - tOrbit) / 1200); x.font = `${fs}px JBM, monospace`; const cw = x.measureText('M').width, lh = fs * 1.05;
      const fw = FIG[0].length * cw, fx = w / 2 - fw / 2, fy = (phase === 'orbit' ? h * .24 : h * .34) - FIG.length * lh / 2; const kk = Math.min(1, ((t - (phase === 'boot' ? T0 : 0)) / 1000) / 1.6);
      FIG.forEach((ln, r) => { for (let c = 0; c < ln.length; c++) { let ch = ln[c]; if (ch === ' ') continue; const settle = (c / ln.length) * .6 + r * .02; const show = phase !== 'boot' || k > settle + .35; if (!show) ch = GL[(Math.random() * GL.length) | 0]; x.fillStyle = ch === '#' ? (show ? '#7fb0ff' : 'rgba(127,176,255,.35)') : ink(show ? .85 : .25); x.fillText(ch, fx + c * cw + cw / 2, fy + r * lh); } });
      x.font = '12px JBM, monospace'; x.fillStyle = ink(.6); x.fillText('every satellite in orbit is a coin', w / 2, fy + FIG.length * lh + 26); x.globalAlpha = 1;
    }
    if (phase === 'count') {
      const ck = (t - T0) / 1000, n = 3 - Math.floor(ck);
      x.font = `800 ${Math.min(120, w / 7)}px JBM, monospace`; x.fillStyle = ink(.9 - (ck % 1) * .6);
      x.fillText(n > 0 ? 'T-' + n : 'LIFTOFF', w / 2, h * .66);
      if (ck >= 3.6) { phase = 'lift'; tLift = t; }
    }
    // the rocket and its exhaust
    if (phase === 'lift') {
      const lk = (t - tLift) / 1000, fs = Math.max(12, Math.min(20, w / 50)); x.font = `700 ${fs}px JBM, monospace`; const cw = x.measureText('M').width, lh = fs * 1.05;
      const ry = h * .78 - Math.pow(lk, 2.2) * h * .32, rx = w / 2;
      for (let i = 0; i < 9; i++) parts.push({ x: rx + (Math.random() - .5) * cw * 3, y: ry + ROCKET.length * lh * .5 + 4, vx: (Math.random() - .5) * 60, vy: 120 + Math.random() * 220, life: 1, c: '*o.+#'[(Math.random() * 5) | 0] });
      ROCKET.forEach((ln, r) => { for (let c = 0; c < ln.length; c++) { if (ln[c] === ' ') continue; x.fillStyle = ln[c] === '[' || ln[c] === ']' ? '#7fb0ff' : '#e8f1ed'; x.fillText(ln[c], rx + (c - ln.length / 2) * cw, ry + (r - ROCKET.length / 2) * lh); } });
    }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * .016; p.y += p.vy * .016; p.life -= .022; if (p.life <= 0) { parts.splice(i, 1); continue; } x.fillStyle = `rgba(255,${Math.round(150 + 90 * p.life)},${Math.round(80 * p.life)},${p.life})`; x.font = '13px JBM, monospace'; x.fillText(p.c, p.x, p.y); }
    // the limb of the planet rising under you (real coastlines, centred under the ISS when we know where it is)
    if (phase === 'orbit') {
      const ok = (t - tOrbit) / 1000, rise = 1 - Math.pow(1 - Math.min(1, ok / 2.2), 3);
      const R = Math.max(w, h) * 1.1, cx = w / 2, cy = h + R - h * .3 * rise;
      const fs = Math.max(10, Math.min(14, w / 90)); x.font = `${fs}px JBM, monospace`; const cw = x.measureText('M').width, lh = fs * 1.1;
      const lat0 = (issLL ? issLL.lat : 20) * Math.PI / 180, lon0 = issLL ? issLL.lon : -30, s0 = Math.sin(lat0 - .9), c0 = Math.cos(lat0 - .9);
      const ss = ORB.subsolar(new Date());
      for (let py = Math.max(0, cy - R); py < h; py += lh) for (let px = 0; px < w; px += cw) {
        const xx = (px - cx) / R, yy = -(py - cy) / R, rr = xx * xx + yy * yy; if (rr > 1) continue;
        const z = Math.sqrt(1 - rr), lat = Math.asin(z * s0 + yy * c0) * 180 / Math.PI, lon = lon0 + Math.atan2(xx, z * c0 - yy * s0) * 180 / Math.PI;
        const L = ((lon + 540) % 360) - 180, land = LAND.at(lat, L);
        const dayv = Math.sin(lat * Math.PI / 180) * Math.sin(ss.lat * Math.PI / 180) + Math.cos(lat * Math.PI / 180) * Math.cos(ss.lat * Math.PI / 180) * Math.cos((L - ss.lon) * Math.PI / 180);
        const edge = rr > .985;
        x.fillStyle = edge ? 'rgba(127,176,255,.8)' : land ? (dayv > 0 ? 'rgba(127,176,255,.55)' : 'rgba(255,214,140,.38)') : 'rgba(127,176,255,.12)';
        x.fillText(edge ? '~' : land ? (dayv > 0 ? '#' : ':') : '.', px, py);
      }
      // atmosphere glow line and your satellite gliding over
      const gx = (ok * 90) % (w + 200) - 100, gy = cy - R - 30 + Math.sin(ok) * 4;
      x.font = `800 ${fs + 4}px JBM, monospace`; x.fillStyle = '#e8f1ed'; if (rise > .6) x.fillText('=[]=', gx, gy);
      if (ok > 1.6 && !btn.classList.contains('on')) { btn.classList.add('on'); term.style.transition = 'opacity .8s'; term.style.opacity = '.35'; }
    }
    x.restore();
  }
  requestAnimationFrame(frame);
})();
