// Module-level cache — persists across warm Lambda invocations
let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes — max 3 real API calls per game

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

  const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "FOOTBALL_DATA_API_KEY not set in Netlify environment variables" })
    };
  }

  try {
    // football-data.org: WC = FIFA World Cup, free tier supports this
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches?season=2026", {
      headers: { "X-Auth-Token": API_KEY }
    });

    if (!res.ok) throw new Error("API HTTP " + res.status);
    const data = await res.json();

    const events = (data.matches || []).map(m => {
      const statusMap = {
        "FINISHED": "FT",
        "IN_PLAY": "LIVE",
        "HALFTIME": "HT",
        "PAUSED": "HT",
        "SCHEDULED": "scheduled",
        "TIMED": "scheduled"
      };
      return {
        home: m.homeTeam.name,
        away: m.awayTeam.name,
        date: m.utcDate.slice(0, 10),
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        homeScoreHT: m.score.halfTime.home,
        awayScoreHT: m.score.halfTime.away,
        status: statusMap[m.status] || m.status,
        minute: m.minute || null
      };
    });

    cache = { data: events, fetchedAt: now };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        events,
        fetchedAt: new Date(now).toISOString(),
        cached: false,
        source: "football-data.org"
      })
    };
  } catch (err) {
    // Return stale cache on error rather than failing
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
