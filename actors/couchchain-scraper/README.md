# CouchChain — Actor Apify (stub)

Apify **no** compila solo tu app Next.js: hace `docker build` en **una carpeta** que tenga `Dockerfile` + `.actor/actor.json`.

## En la consola Apify (mismo repo Git que CouchChain)

1. **Source / Git** → repo y rama correctos.
2. **Folder** (carpeta del Actor): `actors/couchchain-scraper`  
   (como en el [ejemplo monorepo de Apify](https://github.com/apify/actor-monorepo-example)).
3. **Build** de nuevo.

Sin la carpeta, Apify intenta construir la raíz del monorepo (Next.js) y no es un Actor válido.

## Local

```bash
cd actors/couchchain-scraper
npm install
npm start
```

(Requiere entorno Apify local o `apify run` si usás CLI.)

## Precios reales en CouchChain (fuente principal)

En el monorepo, el worker **`npm run worker`** ya puede traer precios vía **SerpAPI** (`SERPAPI_API_KEY` + IATA en el mensaje del usuario). Este Actor Apify sigue siendo útil si querés Crawlee en la nube; no duplica SerpAPI salvo que lo implementes aquí también.

## Siguiente paso

Reemplazar `src/main.js` por Crawlee, variables de entorno en **Settings → Environment** del Actor, o integrar runs de Apify desde el backend si movés el scrape a la plataforma Apify.
