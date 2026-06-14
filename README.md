# World Cup 2026 Scores Proxy

A tiny Netlify serverless function that proxies TheSportsDB World Cup 2026 data with CORS headers, so browser-based apps can fetch live scores.

## Endpoint

```
GET /.netlify/functions/scores
```

Returns JSON:
```json
{
  "events": [
    {
      "home": "Mexico",
      "away": "South Africa",
      "date": "2026-06-11",
      "homeScore": "2",
      "awayScore": "0",
      "status": "Match Finished",
      "progress": null
    }
  ],
  "fetchedAt": "2026-06-13T02:00:00.000Z"
}
```

## Deploy

1. Push this repo to GitHub
2. Connect to Netlify — it will auto-detect `netlify.toml`
3. Deploy — function is live at `https://your-site.netlify.app/.netlify/functions/scores`
