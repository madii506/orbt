/* orbt orbital helpers, shared by the browser and the engine. Positions come from SGP4 (satellite.js) run on
   public CelesTrak element sets; the sun is a low-precision almanac formula, good to a fraction of a degree. */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make(require('satellite.js'));
  else root.ORB = make(root.satellite);
})(this, function (S) {
  const RE = 6378.137, D2R = Math.PI / 180, R2D = 180 / Math.PI, TAU = Math.PI * 2;
  const recs = new Map();
  // a satellite record from its two lines (cached)
  function rec(l1, l2) {
    const k = l1 + l2; let r = recs.get(k); if (r) return r;
    r = S.twoline2satrec(l1, l2); r.revAtEpoch = parseInt(l2.slice(63, 68), 10) || 0;
    r.epochMs = (r.jdsatepoch - 2440587.5) * 864e5 + (r.jdsatepochF ? r.jdsatepochF * 864e5 : 0);
    if (recs.size > 30000) recs.clear(); recs.set(k, r); return r;
  }
  // where it is: lat/lon in degrees, altitude km, speed km/s, eci km
  function at(r, date) {
    const pv = S.propagate(r, date); if (!pv || !pv.position || r.error) return null;
    const gmst = S.gstime(date), g = S.eciToGeodetic(pv.position, gmst), v = pv.velocity;
    return { lat: g.latitude * R2D, lon: ((g.longitude * R2D + 540) % 360) - 180, alt: g.height, speed: Math.hypot(v.x, v.y, v.z), eci: pv.position, gmst };
  }
  // the sun's direction in ECI (unit vector), from the astronomical almanac's low-precision formula
  function sun(date) {
    const n = (date.getTime() / 864e5 + 2440587.5) - 2451545.0;
    const L = (280.460 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * D2R;
    const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R, eps = (23.439 - 0.0000004 * n) * D2R;
    return { x: Math.cos(lam), y: Math.cos(eps) * Math.sin(lam), z: Math.sin(eps) * Math.sin(lam) };
  }
  // the point on Earth with the sun straight overhead (for the day/night line)
  function subsolar(date) {
    const s = sun(date), gmst = S.gstime(date);
    const ra = Math.atan2(s.y, s.x), dec = Math.asin(s.z);
    return { lat: dec * R2D, lon: (((ra - gmst) * R2D + 540) % 360) - 180 };
  }
  // in Earth's shadow? (cylindrical shadow: good enough for low orbits, a few seconds off at the edges)
  function lit(eci, date) {
    const s = sun(date), d = eci.x * s.x + eci.y * s.y + eci.z * s.z;
    if (d > 0) return true;
    const px = eci.x - d * s.x, py = eci.y - d * s.y, pz = eci.z - d * s.z;
    return Math.hypot(px, py, pz) > RE;
  }
  // which orbit it is on: the revolution count at epoch plus the turns of the argument of latitude since then
  const mm = r => r.no / TAU;                         // revolutions per minute
  function orbitNo(r, date) { const dt = (date.getTime() - r.epochMs) / 6e4; return r.revAtEpoch + Math.floor(((r.argpo + r.mo) / TAU) + dt * mm(r)); }
  function orbitPhase(r, date) { const dt = (date.getTime() - r.epochMs) / 6e4; const x = ((r.argpo + r.mo) / TAU) + dt * mm(r); return x - Math.floor(x); }
  function nextOrbit(r, date) { const ph = orbitPhase(r, date); return new Date(date.getTime() + (1 - ph) / mm(r) * 6e4); }
  const periodMin = r => 1 / mm(r);
  function shape(r) {   // apogee/perigee in km from the mean elements
    const a = Math.pow(398600.4418 / Math.pow(r.no / 60, 2), 1 / 3);
    return { a, apogee: a * (1 + r.ecco) - RE, perigee: a * (1 - r.ecco) - RE, inc: r.inclo * R2D, period: periodMin(r) };
  }
  // look angles from a place on the ground
  function look(r, date, obs) {
    const pv = S.propagate(r, date); if (!pv || !pv.position) return null;
    const gmst = S.gstime(date), ecf = S.eciToEcf(pv.position, gmst);
    const la = S.ecfToLookAngles({ latitude: obs.lat * D2R, longitude: obs.lon * D2R, height: (obs.h || 0) / 1000 }, ecf);
    return { az: la.azimuth * R2D, el: la.elevation * R2D, range: la.rangeSat };
  }
  // passes over a place: rise, highest point, set (coarse steps, then refined)
  function passes(r, obs, from, hours, minEl = 10, max = 12) {
    const out = []; const end = from.getTime() + hours * 36e5; const step = periodMin(r) > 200 ? 300e3 : 30e3;
    let t = from.getTime(), prev = look(r, new Date(t), obs); if (!prev) return out;
    let cur = null;
    while (t < end && out.length < max) {
      t += step; const l = look(r, new Date(t), obs); if (!l) break;
      if (!cur && l.el > 0 && prev.el <= 0) cur = { rise: new Date(refine(r, obs, t - step, t, true)), maxEl: l.el, maxAt: new Date(t), maxAz: l.az, riseAz: l.az };
      else if (!cur && l.el > 0 && t - step === from.getTime()) cur = { rise: new Date(from), maxEl: l.el, maxAt: new Date(t), riseAz: l.az, maxAz: l.az, inProgress: true };
      if (cur && l.el > cur.maxEl) { cur.maxEl = l.el; cur.maxAt = new Date(t); cur.maxAz = l.az; }
      if (cur && l.el <= 0) { cur.set = new Date(refine(r, obs, t - step, t, false)); cur.setAz = l.az; if (cur.maxEl >= minEl) out.push(cur); cur = null; }
      prev = l;
    }
    return out;
  }
  function refine(r, obs, a, b, rising) {
    for (let i = 0; i < 14; i++) { const m = (a + b) / 2, l = look(r, new Date(m), obs); if (!l) break; if ((l.el > 0) === rising) b = m; else a = m; }
    return (a + b) / 2;
  }
  // shadow crossings in a window: [{t, rise:true|false}]
  function crossings(r, from, to, step = 20e3) {
    const out = []; let t = from.getTime(), p = at(r, new Date(t)); if (!p) return out; let was = lit(p.eci, new Date(t));
    while (t < to.getTime()) {
      t = Math.min(to.getTime(), t + step); const q = at(r, new Date(t)); if (!q) break; const now = lit(q.eci, new Date(t));
      if (now !== was) { let a = t - step, b = t; for (let i = 0; i < 10; i++) { const m = (a + b) / 2, z = at(r, new Date(m)); if (z && lit(z.eci, new Date(m)) === now) b = m; else a = m; } out.push({ t: new Date(b), rise: now }); }
      was = now;
    }
    return out;
  }
  function nextCrossing(r, date, rise, hours = 4) { const c = crossings(r, date, new Date(date.getTime() + hours * 36e5), 30e3).find(x => x.rise === rise); return c ? c.t : null; }
  // the ground track: points over a span of minutes
  function track(r, date, fromMin, toMin, stepMin = 1) {
    const out = []; for (let m = fromMin; m <= toMin; m += stepMin) { const p = at(r, new Date(date.getTime() + m * 6e4)); if (p) out.push([p.lat, p.lon, p.alt]); } return out;
  }
  // what kind of thing it is, from the groups and the name
  const TAGS = ['station', 'starlink', 'oneweb', 'gnss', 'weather', 'earth', 'science', 'comms', 'other'];
  function tagOf(name, groups) {
    const n = String(name).toUpperCase();
    if (groups && groups.station) return 'station';
    if (/^STARLINK/.test(n)) return 'starlink';
    if (/^ONEWEB/.test(n)) return 'oneweb';
    if ((groups && groups.gnss) || /NAVSTAR|GPS |GLONASS|GALILEO|BEIDOU|QZS|IRNSS|NAVIC/.test(n)) return 'gnss';
    if ((groups && groups.weather) || /^NOAA|GOES|METEOSAT|METOP|FENGYUN|HIMAWARI|DMSP|ELEKTRO|METEOR|JPSS|SUOMI/.test(n)) return 'weather';
    if (groups && groups.science) return 'science';
    if (/LANDSAT|SENTINEL|WORLDVIEW|PLEIADES|SPOT|TERRA|AQUA|FLOCK|SKYSAT|LEMUR|ICEYE|CAPELLA|RADARSAT|KOMPSAT|CARTOSAT|RESURS|KANOPUS|GAOFEN|JILIN|SUPERVIEW|PLANETSCOPE|DOVE|SATELLOGIC|NUSAT|BLACKSKY|UMBRA|HJ-|ZIYUAN|YAOGAN/.test(n)) return 'earth';
    if (/HST|HUBBLE|CHANDRA|SWIFT|FERMI|NUSTAR|TESS|XMM|INTEGRAL|GAIA|NEOWISE|AGILE|CALET|ASTROSAT|HXMT|XRISM|EINSTEIN PROBE|SVOM|IXPE/.test(n)) return 'science';
    if (/IRIDIUM|GLOBALSTAR|ORBCOMM|INTELSAT|SES|EUTELSAT|INMARSAT|VIASAT|TELESAT|O3B|KUIPER|ECHOSTAR|DIRECTV|SIRIUS|XM-|TDRS|AMAZONAS|HISPASAT|ARABSAT|ASIASAT|APSTAR|CHINASAT|TURKSAT|THURAYA|YAHSAT|NILESAT|ASTRA|HOTBIRD|GALAXY|SKYNET|MUOS|WGS|AEHF|LUCH|EXPRESS|YAMAL|GONETS|QIANFAN|GUOWANG|SPACEBEE|BLUEBIRD|LYNK/.test(n)) return 'comms';
    return 'other';
  }
  return { RE, D2R, R2D, rec, at, sun, subsolar, lit, orbitNo, orbitPhase, nextOrbit, periodMin, shape, look, passes, crossings, nextCrossing, track, TAGS, tagOf };
});
