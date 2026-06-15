// Module-level cache — persists across warm Lambda invocations
let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const now = Date.now();
  const cacheAge = now - cache.fetchedAt;
  const cacheValid = cache.data && cacheAge < CACHE_TTL_MS;

  if (cacheValid) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        events: cache.data,
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
        cached: true,
        cacheAgeSeconds: Math.round(cacheAge / 1000)
      })
    };
  }

  try {
    const res = await fetch("https://www.thesoccerworldcups.com/world_cups/2026_results.php", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WorldCupProxy/1.0)" }
    });
    if (!res.ok) throw new Error("Upstream HTTP " + res.status);
    const html = await res.text();

    const monthMap = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
    const dateRx = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s*2026/g;
    const htmlDates = [];
    let dr;
    while ((dr = dateRx.exec(html)) !== null) {
      const m = monthMap[dr[1]];
      const d = parseInt(dr[2]);
      htmlDates.push({
        pos: dr.index,
        iso: `2026-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      });
    }

    const gameRx = /([A-Za-z\s]+?)\s*\[\s*(\d+)\s*-\s*(\d+)\s*\]\s*([A-Za-z\s]+?)(?=\[H2H\]|<)/g;
    const events = [];
    let gm;
    while ((gm = gameRx.exec(html)) !== null) {
      const pos = gm.index;
      let matchDate = "2026-06-11";
      for (const hd of htmlDates) {
        if (hd.pos < pos) matchDate = hd.iso;
        else break;
      }
      const home = gm[1].trim().replace(/\s+/g, ' ');
      const away = gm[4].trim().replace(/\s+/g, ' ');
      if (home && away && home.length > 1 && away.length > 1) {
        events.push({
          home,
          away,
          date: matchDate,
          homeScore: parseInt(gm[2]),
          awayScore: parseInt(gm[3]),
          status: "FT"
        });
      }
    }

    // Deduplicate
    const seen = new Set();
    const unique = events.filter(e => {
      const k = `${e.home}|${e.away}|${e.date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Store in cache
    cache = { data: unique, fetchedAt: now };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        events: unique,
        fetchedAt: new Date(now).toISOString(),
        cached: false,
        source: "thesoccerworldcups.com"
      })
    };
  } catch (err) {
    // On error, return stale cache if we have it rather than failing completely
    if (cache.data) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          events: cache.data,
          fetchedAt: new Date(cache.fetchedAt).toISOString(),
          cached: true,
          stale: true,
          error: err.message
        })
      };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
