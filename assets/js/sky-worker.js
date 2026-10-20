/* orbt sky worker: runs SGP4 for every active satellite, once a second, off the main thread.
   in:  {type:'init', tle:[[l1,l2],...]}   {type:'tick', t}
   out: {type:'pos', t, buf: Float32Array(n*4) = lat, lon, alt(km), lit(0|1)} (NaN when an orbit can't be computed) */
importScripts('/assets/js/satellite.min.js');
const S = self.satellite; let recs = [];
const D = 180 / Math.PI;
function sunVec(t) {
  const n = (t / 864e5 + 2440587.5) - 2451545.0, L = (280.460 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) / D;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) / D, eps = (23.439 - 0.0000004 * n) / D;
  return [Math.cos(lam), Math.cos(eps) * Math.sin(lam), Math.sin(eps) * Math.sin(lam)];
}
onmessage = e => {
  const m = e.data;
  if (m.type === 'init') { recs = m.tle.map(([a, b]) => { try { return S.twoline2satrec(a, b); } catch (er) { return null; } }); postMessage({ type: 'ready', n: recs.length }); return; }
  if (m.type === 'tick') {
    const t = m.t || Date.now(), d = new Date(t), gmst = S.gstime(d), sv = sunVec(t), n = recs.length, buf = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const r = recs[i], o = i * 4;
      if (!r) { buf[o] = NaN; continue; }
      let pv; try { pv = S.propagate(r, d); } catch (er) { pv = null; }
      if (!pv || !pv.position || r.error) { buf[o] = NaN; continue; }
      const p = pv.position, g = S.eciToGeodetic(p, gmst);
      buf[o] = g.latitude * D; buf[o + 1] = g.longitude * D; buf[o + 2] = g.height;
      const dd = p.x * sv[0] + p.y * sv[1] + p.z * sv[2];
      let lit = 1; if (dd < 0) { const px = p.x - dd * sv[0], py = p.y - dd * sv[1], pz = p.z - dd * sv[2]; if (Math.hypot(px, py, pz) < 6378.137) lit = 0; }
      buf[o + 3] = lit;
    }
    postMessage({ type: 'pos', t, buf }, [buf.buffer]);
  }
};
