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

const BUDGET_ALIASES: Record<string, "low" | "medium" | "high"> = {
  low: "low",
  medium: "medium",
  high: "high",
  bajo: "low",
  economico: "low",
  economica: "low",
  barato: "low",
  barata: "low",
  "low budget": "low",
  medio: "medium",
  moderado: "medium",
  moderada: "medium",
  alto: "high",
  caro: "high",
  cara: "high",
  lujo: "high",
};

/** Normaliza respuestas del modelo antes de Zod (tipos sueltos, presupuesto en texto, etc.). */
function coerceIntentPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };

  const asTrimmedString = (v: unknown): string => {
    if (typeof v === "string") return v.trim();
    if (v == null) return "";
    return String(v).trim();
  };

  o.origin = asTrimmedString(o.origin);
  o.destination = asTrimmedString(o.destination);

  const b = o.budget;
  if (b === "" || b === undefined) o.budget = null;
  else if (b === null) o.budget = null;
  else if (typeof b === "number" && b >= 1 && b <= 3 && Number.isInteger(b)) {
    o.budget = b === 1 ? "low" : b === 2 ? "medium" : "high";
  } else if (typeof b === "string") {
    const k = b
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    o.budget = BUDGET_ALIASES[k] ?? null;
  } else {
    o.budget = null;
  }

  if (typeof o.interests === "string") {
    const t = o.interests.trim();
    o.interests = t ? [t] : [];
  } else if (!Array.isArray(o.interests)) {
    o.interests = [];
  } else {
    o.interests = (o.interests as unknown[])
      .map((x) => (typeof x === "string" ? x.trim() : x != null ? String(x).trim() : ""))
      .filter(Boolean);
  }

  if (o.currency == null || o.currency === "") o.currency = "ARS";
  else o.currency = String(o.currency).trim() || "ARS";

  return o;
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

Salida: SOLO un objeto JSON (una sola pieza; no array raíz). Prohibido: texto antes/después, markdown, triple backtick (\`\`\`), bloques \`\`\`json.

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
Si hay dos topónimos claros y verbos como "ir", "viajar", "ruta" pero sin "de/a", asigná el lugar de partida a origin y el de llegada a destination en el orden del mensaje.

Opcionales (omite la clave, o usa null):
- departureDate: fecha o expresión ("en julio", "próximo finde").
- durationDays: número de días si hay duración.
- dep_iata / arr_iata: solo si menciona código IATA de aeropuerto (3 letras).`;

/** Si el modelo devuelve JSON inválido, intentar extraer origen/destino del texto. */
function heuristicExtractPlaces(msg: string): { origin: string; destination: string } | null {
  const t = msg.replace(/\s+/g, " ").trim();
  if (t.length < 5) return null;

  const strip = (s: string) => s.trim().replace(/[.,;]+$/, "");

  // "ir / viajar / voy a DESTINO desde ORIGEN"
  const irADesde = /\b(?:quiero\s+)?(?:ir|viajar|viajo|voy)\s+(?:a|hacia)\s+(.+)\s+\b(?:desde|de)\s+(.+)$/i.exec(
    t,
  );
  if (irADesde) {
    const destination = strip(irADesde[1]);
    const origin = strip(irADesde[2]);
    if (
      origin.length >= 2 &&
      destination.length >= 2 &&
      origin.toLowerCase() !== destination.toLowerCase()
    ) {
      return { origin, destination };
    }
  }

  // "desde ORIGEN hasta DESTINO"
  const salgoLlego =
    /\bsalgo\s+de\s+(.+?)\s+y\s+llego\s+(?:a|en)\s+(.+)$/i.exec(t);
  if (salgoLlego) {
    const origin = strip(salgoLlego[1]);
    const destination = strip(salgoLlego[2]);
    if (
      origin.length >= 2 &&
      destination.length >= 2 &&
      origin.toLowerCase() !== destination.toLowerCase()
    ) {
      return { origin, destination };
    }
  }

  const hasta = /\bdesde\s+(.+)\s+hasta\s+(.+)$/i.exec(t);
  if (hasta) {
    const origin = strip(hasta[1]);
    const destination = strip(hasta[2]);
    if (
      origin.length >= 2 &&
      destination.length >= 2 &&
      origin.toLowerCase() !== destination.toLowerCase()
    ) {
      return { origin, destination };
    }
  }

  // "ruta|viaje de|entre X a|y|hasta Y"
  const ruta = /\b(?:ruta|viaje)\s+(?:de|entre)\s+(.+)\s+(?:a|hasta|y)\s+(.+)$/i.exec(
    t,
  );
  if (ruta) {
    const origin = strip(ruta[1]);
    const destination = strip(ruta[2]);
    if (
      origin.length >= 2 &&
      destination.length >= 2 &&
      origin.toLowerCase() !== destination.toLowerCase()
    ) {
      return { origin, destination };
    }
  }

  // "entre X y Y" → orden habitual primero origen
  const entre = /\bentre\s+(.+)\s+y\s+(.+)$/i.exec(t);
  if (entre) {
    const origin = strip(entre[1]);
    const destination = strip(entre[2]);
    if (
      origin.length >= 2 &&
      destination.length >= 2 &&
      origin.toLowerCase() !== destination.toLowerCase()
    ) {
      return { origin, destination };
    }
  }

  const es = /\b(?:desde|de)\s+(.+)\s+\b(?:a|hacia|para)\s+(.+)$/i.exec(t);
  if (es) {
    const origin = strip(es[1]);
    const destination = strip(es[2]);
    if (
      origin.length >= 2 &&
      destination.length >= 2 &&
      origin.toLowerCase() !== destination.toLowerCase()
    ) {
      return { origin, destination };
    }
  }

  const en = /\bfrom\s+(.+)\s+to\s+(.+)$/i.exec(t);
  if (en) {
    const origin = strip(en[1]);
    const destination = strip(en[2]);
    if (origin.length >= 2 && destination.length >= 2) {
      return { origin, destination };
    }
  }

  return null;
}

export type IntentParseMeta = {
  groqRawPreview: string;
  jsonOk: boolean;
  zodOk: boolean;
  heuristicUsed: boolean;
  zodIssueSummaries?: string[];
  /** Set if the Groq API call failed (network, auth, quota). */
  groqApiError?: string;
};

export async function parseIntentWithMeta(
  userMessage: string,
): Promise<{ intent: ParsedIntent; meta: IntentParseMeta }> {
  let raw = "{}";

  try {
    const baseReq = {
      model: MODEL,
      messages: [
        { role: "system" as const, content: PARSE_SYSTEM },
        { role: "user" as const, content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 512,
    };
    let completion;
    try {
      completion = await getGroq().chat.completions.create({
        ...baseReq,
        response_format: { type: "json_object" },
      });
    } catch {
      completion = await getGroq().chat.completions.create(baseReq);
    }
    raw = completion.choices[0]?.message?.content ?? "{}";
  } catch (e) {
    const errBrief =
      e instanceof Error
        ? e.message.length > 220
          ? `${e.message.slice(0, 220)}…`
          : e.message
        : String(e);
    const fromText = heuristicExtractPlaces(userMessage);
    if (fromText) {
      return {
        intent: {
          ...fromText,
          budget: null,
          currency: "ARS",
          interests: [],
          dep_iata: undefined,
          arr_iata: undefined,
          rawQuery: userMessage,
        },
        meta: {
          groqRawPreview: "",
          jsonOk: false,
          zodOk: false,
          heuristicUsed: true,
          groqApiError: errBrief,
        },
      };
    }
    return {
      intent: {
        origin: "",
        destination: "",
        budget: null,
        currency: "ARS",
        interests: [],
        dep_iata: undefined,
        arr_iata: undefined,
        rawQuery: userMessage,
        parseFailed: true,
      },
      meta: {
        groqRawPreview: "",
        jsonOk: false,
        zodOk: false,
        heuristicUsed: false,
        groqApiError: errBrief,
      },
    };
  }

  const groqRawPreview = raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;

  let parsed: unknown;
  let jsonOk = false;
  try {
    const clean = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    const tryParse = (s: string) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    };
    parsed = tryParse(clean);
    if (parsed == null && /[{\[]/.test(clean)) {
      const startObj = clean.indexOf("{");
      const endObj = clean.lastIndexOf("}");
      if (startObj !== -1 && endObj > startObj) {
        parsed = tryParse(clean.slice(startObj, endObj + 1));
      }
    }
    if (parsed == null) parsed = {};
    else jsonOk = true;
  } catch {
    parsed = {};
  }

  parsed = coerceIntentPayload(parsed);
  const result = IntentSchema.safeParse(parsed);
  const zodIssueSummaries = result.success
    ? undefined
    : result.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`);

  if (!result.success) {
    const fromText = heuristicExtractPlaces(userMessage);
    if (fromText) {
      return {
        intent: {
          ...fromText,
          budget: null,
          currency: "ARS",
          interests: [],
          dep_iata: undefined,
          arr_iata: undefined,
          rawQuery: userMessage,
        },
        meta: {
          groqRawPreview,
          jsonOk,
          zodOk: false,
          heuristicUsed: true,
          zodIssueSummaries,
        },
      };
    }
    return {
      intent: {
        origin: "",
        destination: "",
        budget: null,
        currency: "ARS",
        interests: [],
        dep_iata: undefined,
        arr_iata: undefined,
        rawQuery: userMessage,
        parseFailed: true,
      },
      meta: {
        groqRawPreview,
        jsonOk,
        zodOk: false,
        heuristicUsed: false,
        zodIssueSummaries,
      },
    };
  }

  return {
    intent: { ...result.data, rawQuery: userMessage },
    meta: {
      groqRawPreview,
      jsonOk,
      zodOk: true,
      heuristicUsed: false,
    },
  };
}

export async function parseIntent(userMessage: string): Promise<ParsedIntent> {
  const { intent } = await parseIntentWithMeta(userMessage);
  return intent;
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
