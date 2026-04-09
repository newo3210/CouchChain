# Guion de Demo — CouchChain MVP (~2 min)

Para presentación a stakeholders (IBM / Tezos / Etherlink).

---

## Preparación previa

1. Tener `npm run dev` corriendo en una terminal.
2. Tener MetaMask configurado con la red **Etherlink Shadownet Testnet** (Chain ID 128123) y saldo de XTZ de prueba (faucet en docs.etherlink.com).
3. Tener `npm run worker` corriendo con `REDIS_URL` y `SERPAPI_API_KEY` si quieres precios reales (Google Flights vía SerpAPI). En el mensaje incluí códigos IATA (ej. «de ROS a BRC»); sin IATA el worker usa datos stub.
4. Tener `.env.local` con todas las keys (mínimo: `GROQ_API_KEY` y `NEXT_PUBLIC_CONTRACT_ADDRESS`).

---

## Secuencia (2 min)

### [0:00 – 0:20] Pantalla principal

- Abrir `http://localhost:3000`.
- Mostrar el **mapa vacío** y el **Gatito asomando las orejas** en esquina inferior derecha.
- Señalar el panel "Route Ledger" a la derecha (colapsable).

### [0:20 – 0:50] Input de ruta

- Hacer click en el **Gatito** para expandirlo.
- Escribir en el chat: *"De Bariloche a Epuyén, bajo presupuesto, interesado en granjas de permacultura"*
- Mostrar el sprite cambiando a **processing** instantáneamente.
- En ~2 segundos, la ruta aparece en el mapa con una **polyline** entre las dos ciudades.
- El Gatito cambia a **success** y el panel Ledger muestra el tramo calculado.

**Punto clave:** *"Groq parseó la intención, Photon geolocalizó, OSRM calculó la ruta terrestre, Open-Meteo trajo el clima — todo en bajo 3 segundos, a costo cero."*

### [0:50 – 1:10] Datos en tiempo real

- Señalar el **Route Ledger**: distancia, duración, indicador de viabilidad (punto verde/amarillo).
- Si hay precios en verificación (banner parpadeante): *"El módulo de scraping local está extrayendo precios de vuelos/buses en segundo plano. Cuando termine mostrará 'verificado hace X min'."*
- Arrastrar un **pin** en el mapa para demostrar el recálculo de ruta.

### [1:10 – 1:40] Mint en Etherlink

- Conectar wallet con el **botón de wallet** en el header.
- Click en **"Guardar en mi Pasaporte"**.
- Mostrar la animación de carga → MetaMask prompt → confirmación.
- *"La ruta queda tokenizada como NFT en Etherlink L2. Confirmación en ~3 segundos, menos de $0.01 de gas."*

### [1:40 – 2:00] Pasaporte y reputación

- Navegar a `/passport`.
- Mostrar la **lista de rutas minteadas** con tags, origen/destino y link a IPFS.
- Señalar el **contador de Trust Stamps** (reputation score desde TrustRegistry).
- *"Este es el Pasaporte de Confianza del CryptoNómada — reputación portable, auditable, descentralizada."*

---

## Puntos de contingencia

| Escenario | Respuesta |
|-----------|-----------|
| OSRM no responde | El mapa igual muestra los pines; el Ledger indica "solo geocoding disponible" |
| TransitLand sin datos | No se muestra operadores; el flujo continúa sin bloquear |
| Wallet no conectada | Mostrar igual el flujo hasta el botón Mint y explicar el paso siguiente |
| DB no disponible | Las APIs de datos (route-plan) funcionan igual; solo el índice de rutas falla |

---

## Métricas para mencionar (Blueprint)

- Rutas minteadas: visible en el contrato `RoutePassport` en testnet explorer.
- Tiempo de respuesta del Gatito: <3 s (sync) / <30 s (con scraping).
- Costo operativo por ruta: **$0** (stack 100% APIs gratuitas + infraestructura propia).
