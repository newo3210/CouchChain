import { Coordinates, Weather } from "./types/route";

const BASE = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 5000;

interface OpenMeteoResponse {
  current?: {
    temperature_2m: number;
    precipitation: number;
    wind_speed_10m: number;
    weather_code: number;
  };
}

const WMO_CODES: Record<number, string> = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla con escarcha",
  51: "Llovizna leve",
  53: "Llovizna moderada",
  55: "Llovizna intensa",
  61: "Lluvia leve",
  63: "Lluvia moderada",
  65: "Lluvia intensa",
  71: "Nieve leve",
  73: "Nieve moderada",
  75: "Nieve intensa",
  80: "Chubascos leves",
  81: "Chubascos moderados",
  82: "Chubascos intensos",
  95: "Tormenta",
};

export async function getWeather(coords: Coordinates): Promise<Weather | null> {
  const url =
    `${BASE}?latitude=${coords.lat}&longitude=${coords.lng}` +
    `&current=temperature_2m,precipitation,wind_speed_10m,weather_code` +
    `&timezone=auto`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const data: OpenMeteoResponse = await res.json();
    if (!data.current) return null;
    const c = data.current;
    return {
      temperatureC: c.temperature_2m,
      condition: WMO_CODES[c.weather_code] ?? "Desconocido",
      precipitationMm: c.precipitation,
      windKmh: c.wind_speed_10m,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
