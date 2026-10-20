// GET /api/sky?op=catalog      every active satellite: [norad, name, tag, line1, line2, bright] (CelesTrak element sets)
// GET /api/sky?op=sat&n=25544  one satellite, with its CelesTrak catalogue record when it answers
// GET /api/sky?op=low          the lowest satellites right now: the ones closest to coming down
// GET /api/sky?op=refresh      refresh the catalogue when it is older than 3 hours (called by the cron)
const L = require('./_lib');
const SK = require('./_sky');
module.exports = async (req, res) => {
  const qy = L.query(req), op = String(qy.op || 'catalog');
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'the records are offline' });
  try {
    if (op === 'catalog') { const c = await SK.catalog(); return L.send(res, 200, { ok: true, at: c.at, count: c.sats.length, src: 'celestrak.org', sats: c.sats }, L.CACHE(900, 86400)); }
    if (op === 'sat') {
      const s = await SK.sat(qy.n); if (!s) return L.send(res, 200, { ok: false, error: 'No active satellite with that number.' }, L.CACHE(60));
      const sc = await Promise.race([SK.satcat(s.norad).catch(() => null), new Promise(r => setTimeout(() => r(null), 6000))]);
      return L.send(res, 200, { ok: true, sat: s, satcat: sc }, L.CACHE(600));
    }
    if (op === 'low') return L.send(res, 200, { ok: true, low: await SK.lowest(40) }, L.CACHE(600));
    if (op === 'refresh') return L.send(res, 200, await SK.fresh());
    if (op === 'stats') { const c = await SK.catalog(); const by = {}; for (const s of c.sats) by[s[2]] = (by[s[2]] || 0) + 1; return L.send(res, 200, { ok: true, at: c.at, count: c.sats.length, by }, L.CACHE(300)); }
    L.send(res, 200, { ok: false, error: 'unknown op' });
  } catch (e) { L.send(res, 200, { ok: false, error: 'The sky didn’t answer: ' + String(e && e.message).slice(0, 120) }); }
};
