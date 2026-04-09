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

/** El LLM a menudo devuelve null en opcionales; JSON no tiene undefined. */
function nullishOptional<S extends z.ZodTypeAny>(schema: S) {
  return z.preprocess((val) => (val === null ? undefined : val), schema);
}

const IntentSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  budget: z.enum(["low", "medium", "high"]).nullable().default(null),
  currency: z.string().default("ARS"),
  interests: z.array(z.string()).default([]),
  departureDate: nullishOptional(z.string().optional()),
  durationDays: nullishOptional(
    z.preprocess(
      (val) => {
        if (val === null || val === undefined || val === "") return undefined;
        if (typeof val === "string") return Number(val);
        return val;
      },
      z.number().optional(),
    ),
  ),
  dep_iata: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((s) => {
      if (s == null) return undefined;
      const raw = String(s).trim().toUpperCase();
      return raw.length === 3 ? raw : undefined;
    }),
  arr_iata: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((s) => {
      if (s == null) return undefined;
      const raw = String(s).trim().toUpperCase();
      return raw.length === 3 ? raw : undefined;
    }),
});

const PARSE_SYSTEM = `Eres el parser de intención de CouchChain.
Extrae del mensaje del usuario y devuelve UN objeto JSON. No inventes lugares que el usuario no dijo.

Salida: SOLO el JSON, una sola pieza. Prohibido: texto antes/después, markdown, triple backtick (\`\`\`), bloques \`\`\`json.

Incluye SIEMPRE estas claves (obligatorias): origin, destination, budget, currency, interests.
- budget: "low" | "medium" | "high" o null si no hay pistas de presupuesto.
- currency: código o nombre de moneda si el usuario lo dice; si no, "ARS".
- interests: array (vacío [] si no hay intereses).

origin y destination son texto libre para geocodificar: da igual el “nivel” geográfico; trátalos igual de válidos.
Ejemplos de formato aceptable en un mismo campo:
- Barrio + ciudad: "Palermo, Ciudad de Buenos Aires" o "Recoleta, CABA" (ordena de lo más específico a lo general si el usuario dio ambos).
- Solo capital: "París", "Lisboa".
- Solo provincia/estado/región: "Mendoza", "La Pampa", "Toscana".
- Solo país: "Portugal", "Italia".
- Ciudad ambigua: deja lo que dijo el usuario; no sustituyas por otra ciudad.
Si el usuario nombra varios lugares claros de partida y llegada, origin = salida, destination = llegada.

Opcionales (omite la clave, o usa null):
- departureDate: fecha o expresión ("en julio", "próximo finde").
- durationDays: número de días si hay duración.
- dep_iata / arr_iata: solo si menciona código IATA de aeropuerto (3 letras).`;

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
      dep_iata: undefined,
      arr_iata: undefined,
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
5. Si hay vuelos programados (Aviationstack), menciona brevemente 1-2 opciones sin inventar precios.
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
    flights: plan.flightAlternatives?.map(
      (f) =>
        [f.airline, f.flightNumber, f.scheduledDeparture].filter(Boolean).join(" "),
    ),
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
