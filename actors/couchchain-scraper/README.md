# CouchChain — Actor Apify (stub)

Apify **no** compila solo tu app Next.js: hace `docker build` en **una carpeta** que tenga `Dockerfile` + `.actor/actor.json`.

## En la consola Apify (mismo repo Git que CouchChain)

1. **Source / Git** → repo y rama correctos.
2. **Folder** (carpeta del Actor): `actors/couchchain-scraper`  
   (como en el [ejemplo monorepo de Apify](https://github.com/apify/actor-monorepo-example)).
3. **Build** de nuevo.

Sin la carpeta, Apify intenta construir la raíz del monorepo (Next.js) y no es un Actor válido.

## Input en Apify (Form / JSON)

No uses claves inventadas (`helloWorld`, etc.). El JSON válido es solo:

```json
{
  "origin": "Rosario",
  "destination": "San Carlos de Bariloche",
  "departureDate": "2026-06-15",
  "sessionId": "demo-1"
}
```

`origin` y `destination` son obligatorios. El schema ahora trae **default/prefill** para probar con un clic. En JSON, si borrás todo, usá al menos esas dos claves.

## Local

```bash
cd actors/couchchain-scraper
npm install
npm start
```

(Requiere entorno Apify local o `apify run` si usás CLI.)

## Siguiente paso

Reemplazar `src/main.js` por Crawlee, variables de entorno en **Settings → Environment** del Actor, y opcionalmente que tu backend llame la **API de ejecución** de Apify en lugar del stub en `workers/scrape-worker.ts`.
