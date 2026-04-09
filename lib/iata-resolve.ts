/**
 * Resolución heurística ciudad/texto → IATA principal para SerpAPI Google Flights.
 * Complementa dep_iata/arr_iata cuando el LLM no los devuelve.
 */

const SUBSTRING_CODES: [string, string][] = [
  ["lisboa", "LIS"],
  ["oporto", "OPO"],
  ["porto portugal", "OPO"],
  ["madrid", "MAD"],
  ["barcelona", "BCN"],
  ["valencia", "VLC"],
  ["sevilla", "SVQ"],
  ["bilbao", "BIO"],
  ["malaga", "AGP"],
  ["palma", "PMI"],
  ["paris", "CDG"],
  ["parís", "CDG"],
  ["lyon", "LYS"],
  ["marseille", "MRS"],
  ["toulouse", "TLS"],
  ["nice", "NCE"],
  ["london", "LHR"],
  ["londres", "LHR"],
  ["manchester", "MAN"],
  ["dublin", "DUB"],
  ["rome", "FCO"],
  ["roma", "FCO"],
  ["milano", "MXP"],
  ["milan", "MXP"],
  ["venice", "VCE"],
  ["venecia", "VCE"],
  ["florence", "FLR"],
  ["florencia", "FLR"],
  ["naples", "NAP"],
  ["nápoles", "NAP"],
  ["amsterdam", "AMS"],
  ["rotterdam", "RTM"],
  ["brussels", "BRU"],
  ["bruselas", "BRU"],
  ["frankfurt", "FRA"],
  ["francfort", "FRA"],
  ["berlin", "BER"],
  ["berlín", "BER"],
  ["munich", "MUC"],
  ["múnich", "MUC"],
  ["hamburg", "HAM"],
  ["vienna", "VIE"],
  ["viena", "VIE"],
  ["zurich", "ZRH"],
  ["zürich", "ZRH"],
  ["geneva", "GVA"],
  ["ginebra", "GVA"],
  ["prague", "PRG"],
  ["praga", "PRG"],
  ["warsaw", "WAW"],
  ["varsovia", "WAW"],
  ["budapest", "BUD"],
  ["athens", "ATH"],
  ["atenas", "ATH"],
  ["copenhagen", "CPH"],
  ["copenhague", "CPH"],
  ["stockholm", "ARN"],
  ["estocolmo", "ARN"],
  ["oslo", "OSL"],
  ["helsinki", "HEL"],
  ["buenos aires", "EZE"],
  ["caba", "AEP"],
  ["palermo buenos", "AEP"],
  ["ciudad autonoma de buenos aires", "AEP"],
  ["cordoba argentina", "COR"],
  ["córdoba argentina", "COR"],
  ["rosario", "ROS"],
  ["mendoza", "MDZ"],
  ["bariloche", "BRC"],
  ["salta", "SLA"],
  ["iguazu", "IGR"],
  ["iguazú", "IGR"],
  ["ushuaia", "USH"],
  ["santiago chile", "SCL"],
  ["santiago de chile", "SCL"],
  ["lima", "LIM"],
  ["bogota", "BOG"],
  ["bogotá", "BOG"],
  ["medellin", "MDE"],
  ["medellín", "MDE"],
  ["quito", "UIO"],
  ["sao paulo", "GRU"],
  ["são paulo", "GRU"],
  ["rio de janeiro", "GIG"],
  ["brasilia", "BSB"],
  ["brasília", "BSB"],
  ["montevideo", "MVD"],
  ["asuncion", "ASU"],
  ["asunción", "ASU"],
  ["la paz bolivia", "LPB"],
  ["santa cruz bolivia", "VVI"],
  ["mexico city", "MEX"],
  ["ciudad de mexico", "MEX"],
  ["cancun", "CUN"],
  ["cancún", "CUN"],
  ["guadalajara", "GDL"],
  ["new york", "JFK"],
  ["nueva york", "JFK"],
  ["los angeles", "LAX"],
  ["miami", "MIA"],
  ["chicago", "ORD"],
  ["toronto", "YYZ"],
  ["montreal", "YUL"],
  ["vancouver", "YVR"],
  ["tokyo", "NRT"],
  ["tokio", "NRT"],
  ["osaka", "KIX"],
  ["seoul", "ICN"],
  ["bangkok", "BKK"],
  ["singapore", "SIN"],
  ["singapur", "SIN"],
  ["sydney", "SYD"],
  ["melbourne", "MEL"],
  ["auckland", "AKL"],
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Intenta obtener código IATA de 3 letras a partir del texto de origen/destino o del nombre geocodificado. */
export function resolveIataFromPlaceText(placeText: string): string | undefined {
  const n = normalize(placeText);
  if (!n) return undefined;

  for (const [needle, code] of SUBSTRING_CODES) {
    if (n.includes(needle)) return code;
  }

  const first = n.split(",")[0]?.trim() ?? "";
  for (const [needle, code] of SUBSTRING_CODES) {
    if (first && (first === needle || first.includes(needle))) return code;
  }

  return undefined;
}

function normIataCode(v: string | undefined): string | undefined {
  if (v == null || !String(v).trim()) return undefined;
  const u = String(v).trim().toUpperCase();
  return u.length === 3 ? u : undefined;
}

/** Prioriza IATA del intent; si falta, infiere desde texto del usuario o nombre geocodificado. */
export function resolveIataForEndpoint(
  intentIata: string | undefined,
  placeText: string,
  geocodedName: string,
): string | undefined {
  const fromIntent = normIataCode(intentIata);
  if (fromIntent) return fromIntent;
  return (
    resolveIataFromPlaceText(placeText) ??
    resolveIataFromPlaceText(geocodedName)
  );
}
