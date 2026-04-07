/**
 * Cloudflare Pages Function — route /api/weather
 * @see https://developers.cloudflare.com/pages/functions/routing/
 */
export async function onRequestGet({ request }) {
  const src = new URL(request.url);
  const lat = src.searchParams.get("latitude") || "41.1579";
  const lon = src.searchParams.get("longitude") || "-8.6291";
  const tz = src.searchParams.get("timezone") || "Europe/Lisbon";
  const mode = src.searchParams.get("mode") || "";

  const q = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: tz,
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
    return new Response(await r.text(), {
      status: r.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
