/**
 * Netlify Function — exposed as /api/weather via netlify.toml redirect.
 */
const OM = "https://api.open-meteo.com/v1/forecast";

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const lat = qs.latitude || "41.1579";
  const lon = qs.longitude || "-8.6291";
  const tz = qs.timezone || "Europe/Lisbon";
  const mode = qs.mode || "";

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: String(tz),
  });
  if (mode === "full") {
    params.set(
      "current",
      "temperature_2m,weather_code,precipitation,rain,showers"
    );
  } else {
    params.set("current_weather", "true");
  }

  try {
    const r = await fetch(`${OM}?${params}`, {
      headers: { Accept: "application/json" },
    });
    const body = await r.text();
    return {
      statusCode: r.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
      body,
    };
  } catch {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "upstream" }),
    };
  }
};
