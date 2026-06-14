exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const url = "https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Upstream HTTP " + res.status);
    const data = await res.json();

    const events = (data.events || []).map(ev => ({
      home: ev.strHomeTeam,
      away: ev.strAwayTeam,
      date: ev.dateEvent,
      homeScore: ev.intHomeScore,
      awayScore: ev.intAwayScore,
      status: ev.strStatus,
      progress: ev.strProgress || null
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ events, fetchedAt: new Date().toISOString() })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
