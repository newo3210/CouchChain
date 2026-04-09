# CouchChain — Actor Apify (SerpAPI / Google Flights)

Precios **reales** cuando configurás **`SERPAPI_API_KEY`** como secret del Actor y mandás **`dep_iata`** + **`arr_iata`** en el input (3 letras IATA).

Apify **no** compila solo tu app Next.js: el build usa esta carpeta (`Dockerfile` + `.actor/actor.json`).

## En la consola Apify (mismo repo Git que CouchChain)

1. **Source / Git** → repo y rama correctos.
2. **Folder** (carpeta del Actor): `actors/couchchain-scraper`  
   (como en el [ejemplo monorepo de Apify](https://github.com/apify/actor-monorepo-example)).
3. **Build** de nuevo.

Sin la carpeta, Apify intenta construir la raíz del monorepo (Next.js) y no es un Actor válido.

## Secrets / env en Apify

- **`SERPAPI_API_KEY`** (obligatoria para cotizar): *Settings → Environment variables* → marcá como **Secret**.
- Opcional: **`SERPAPI_GL`** (ej. `ar`), **`SERPAPI_HL`** (ej. `es`) — igual que en el monorepo.

## Input (usuario / API)

`origin` y `destination` son obligatorios (texto del usuario). Para **precios SerpAPI** hace falta también **`dep_iata`** y **`arr_iata`** (el Gatito los extrae si el usuario dice «de ROS a BRC», etc.). Opcionales: `departureDate`, `sessionId`, `currency`.

```json
{
  "origin": "Rosario",
  "destination": "Bariloche",
  "departureDate": "2026-06-15",
  "sessionId": "…",
  "dep_iata": "ROS",
  "arr_iata": "BRC",
  "currency": "ARS"
}
```

Salida en el **dataset**: objeto con `source: "serpapi-google-flights"` y array `prices` (`provider`, `price`, `currency`, `mode`, `departure`). Sin IATA: `source: "serpapi-skipped"` y `prices: []`. Sin API key: `source: "error"`.

## Local

```bash
cd actors/couchchain-scraper
npm install
npm start
```

(Requiere entorno Apify local o `apify run` si usás CLI.)

## Integración CouchChain

Tu backend puede lanzar el Actor con la **API de Apify** pasando el mismo input que hoy encolás para el worker (incluidos `dep_iata`, `arr_iata`, `currency`). Crawlee/HTML propio es opcional si SerpAPI cubre tus rutas.
