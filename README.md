# CouchChain

Protocolo de logística, hospitalidad y reputación para nómadas digitales: una **IA (Gatito)** orquesta rutas con datos reales (APIs abiertas + verificación y *edge scraping* local) y **Etherlink** asegura itinerarios tokenizados y Trust Stamps portables.

Fuente de arquitectura: [docs/BLUEPRINT-TECNICO.md](docs/BLUEPRINT-TECNICO.md).

---

## Cómo empezar

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
# Editar .env.local con tus claves
```

Ver guía completa en [docs/REGISTROS-Y-APIS.md](docs/REGISTROS-Y-APIS.md).

### 3. Compilar y desplegar contratos

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test               # verificar que pasan los 4 tests
# Desplegar en testnet (requiere DEPLOYER_PRIVATE_KEY en .env.local):
npm run deploy:testnet
# Copiar las direcciones impresas a NEXT_PUBLIC_CONTRACT_ADDRESS y NEXT_PUBLIC_TRUST_REGISTRY_ADDRESS
cd ..
```

### 4. Base de datos

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Levantar el stack

Terminal 1 — servidor Next.js:

```bash
npm run dev
```

**N3 precios (elige uno):**

- **Apify (recomendado si ya tenés el Actor):** en `.env.local` poné `APIFY_API_TOKEN` (Consola Apify → Integrations → API token) y `APIFY_ACTOR_ID` (ej. `tu_usuario~couchchain-price-scraper`). No hace falta Redis ni worker para ese paso.
- **Worker local:** `REDIS_URL` + `npm run worker` (y `SERPAPI_API_KEY` en `.env.local` si querés precios reales sin Apify).

Redis local (Docker), solo si usás worker:

```bash
docker run -d -p 6379:6379 redis:alpine
npm run worker
```

---

## Stack (Blueprint v2.0)


| Capa                  | Tecnología                                           |
| --------------------- | ---------------------------------------------------- |
| Frontend              | Next.js (App Router), React, Tailwind, Leaflet       |
| IA                    | Groq (Llama 3.3 70B), prompts JSON                   |
| Geocoding / ruta N0   | Photon + OSRM                                        |
| Clima N1              | Open-Meteo                                           |
| Transporte público N2 | TransitLand                                          |
| Precios N3            | Actor Apify (REST) o worker BullMQ + Redis + SerpAPI |
| Cadena                | Etherlink testnet: `RoutePassport` + `TrustRegistry` |
| IPFS                  | Pinata                                               |
| Datos                 | PostgreSQL + Prisma                                  |


---

## Estructura de carpetas

```
app/
  api/
    route-plan/        POST — orquesta N0–N3
    jobs/[id]/         GET  — estado de job de scraping
    contact/           POST/PATCH — Puente de Confianza
    trust-stamp/       POST — prepara parámetros de stamp
    upload-route/      POST — sube JSON de ruta a IPFS
    routes/index/      GET/POST — índice de rutas
components/
  map/                 RouteMap, RouteLedger
  gatito/              GatitoAssistant
  ui/                  WalletButton, MintButton, Web3Provider, Header
  bridge/              TrustBridge
  passport/            PassportDashboard
lib/
  groq.ts              Parsing + síntesis
  photon.ts            Geocodificación
  osrm.ts              Routing terrestre
  open-meteo.ts        Clima
  transitland.ts       Transporte público
  scrape-queue.ts      Cola BullMQ
  validation-pipeline.ts  Validación y freshness de precios
  pinata.ts            Upload IPFS (servidor)
  pinata-client.ts     URL builder (cliente)
  wagmi-config.ts      Configuración de wallet/cadena
  db.ts                Cliente Prisma singleton
  types/route.ts       Tipos compartidos
workers/
  scrape-worker.ts     Consumer BullMQ + Crawlee
contracts/
  contracts/
    RoutePassport.sol
    TrustRegistry.sol
  ignition/modules/deploy.ts
  test/RoutePassport.test.ts
prisma/
  schema.prisma
docs/
  BLUEPRINT-TECNICO.md
  REGISTROS-Y-APIS.md
  llm-prepared/
    COUCHCHAIN-LLM.md
```

---

## Documentación


| Documento                                                                  | Contenido                                      |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| [docs/BLUEPRINT-TECNICO.md](docs/BLUEPRINT-TECNICO.md)                     | Arquitectura del protocolo v2.0                |
| [docs/REGISTROS-Y-APIS.md](docs/REGISTROS-Y-APIS.md)                       | Cuentas, APIs, variables de entorno            |
| [docs/llm-prepared/COUCHCHAIN-LLM.md](docs/llm-prepared/COUCHCHAIN-LLM.md) | Briefing para agentes LLM (UX, flujos, tokens) |


---

## Alcance fuera del MVP

Fase 2+: pagos USDT/USDC, escrow, royalties por réplicas. Fases 3–4: stamps geolocalizados, modo offline, DID, wearables. Ver Blueprint para detalle.