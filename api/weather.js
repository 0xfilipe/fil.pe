/**
 * Vercel Serverless — GET /api/weather
 * Proxies Open-Meteo so the browser never calls api.open-meteo.com directly.
 */
export default async function handler(req, res) {
  const lat = req.query?.latitude || "41.1579";
  const lon = req.query?.longitude || "-8.6291";
  const tz = req.query?.timezone || "Europe/Lisbon";
  const mode = req.query?.mode || "";

  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: String(tz),
  });
  if (mode === "full") {
    q.set(
      "current",
      "temperature_2m,weather_code,precipitation,rain,showers"
    );
  } else {
    q.set("current_weather", "true");
  }

  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, {
      headers: { Accept: "application/json" },
    });
    const text = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    res.send(text);
  } catch {
    res.status(502).json({ error: "upstream" });
  }
}
