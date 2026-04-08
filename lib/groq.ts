import Groq from "groq-sdk";
import { z } from "zod";
import { ParsedIntent, RoutePlan } from "./types/route";

let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

const MODEL = "llama-3.3-70b-versatile";

// ─── Parsing schema ───────────────────────────────────────────────────────────

const IntentSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  budget: z.enum(["low", "medium", "high"]).nullable().default(null),
  currency: z.string().default("ARS"),
  interests: z.array(z.string()).default([]),
  departureDate: z.string().optional(),
  durationDays: z.number().optional(),
});

const PARSE_SYSTEM = `Eres el parser de intención de CouchChain.
Extrae del mensaje del usuario los siguientes campos en JSON.
Devuelve SOLO JSON válido, sin texto adicional, sin markdown.
Campos:
- origin: ciudad o lugar de partida (string)
- destination: ciudad o lugar de destino (string)
- budget: "low" | "medium" | "high" | null
- currency: moneda mencionada (default "ARS")
- interests: array de intereses o actividades
- departureDate: fecha o descripción de fecha (string opcional)
- durationDays: duración en días (número opcional)`;

export async function parseIntent(userMessage: string): Promise<ParsedIntent> {
  const completion = await getGroq().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: PARSE_SYSTEM },
      { role: "user", content: userMessage },
    ],
    temperature: 0.1,
    max_tokens: 512,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    // Strip possible markdown code fences
    const clean = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    parsed = {};
  }

  const result = IntentSchema.safeParse(parsed);
  if (!result.success) {
    // Fallback: try to extract at minimum origin/destination
    return {
      origin: "origen desconocido",
      destination: "destino desconocido",
      budget: null,
      currency: "ARS",
      interests: [],
      rawQuery: userMessage,
    };
  }

  return { ...result.data, rawQuery: userMessage };
}

// ─── Synthesis ────────────────────────────────────────────────────────────────

const SYNTH_SYSTEM = `Eres el Gatito de CouchChain, un asistente de rutas amigable y conciso.
Tienes los datos de una ruta (JSON). Genera una respuesta conversacional en español:
1. Resumen de la ruta en 2-3 oraciones.
2. Recomendación de clima si está disponible.
3. Opciones de transporte encontradas.
4. Un consejo relacionado a los intereses del viajero.
Máximo 150 palabras. Tono cálido y directo. No uses listas largas.`;

export async function synthesizeRoute(plan: Partial<RoutePlan>): Promise<string> {
  const planSummary = JSON.stringify({
    origin: plan.origin?.name,
    destination: plan.destination?.name,
    segments: plan.transportSegments?.map((s) => ({
      mode: s.mode,
      duration: s.durationMinutes + " min",
      distance: s.distanceKm ? s.distanceKm + " km" : undefined,
    })),
    weather: plan.weather
      ? `${plan.weather.temperatureC}°C, ${plan.weather.condition}`
      : null,
    transitFeeds: plan.transitFeeds?.map((f) => f.operatorName),
    interests: plan.parsedIntent?.interests,
    budget: plan.parsedIntent?.budget,
  });

  try {
    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYNTH_SYSTEM },
        { role: "user", content: planSummary },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });
    return completion.choices[0]?.message?.content ?? "¡Ruta lista!";
  } catch {
    return `Ruta de ${plan.origin?.name} a ${plan.destination?.name} calculada. ¡Todo listo para planificar!`;
  }
}
