# Documentación preparada para LLM

Esta carpeta contiene **contexto denso y accionable** para asistentes de código (Cursor, Claude, etc.), inspirado en el formato de [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (`design-md/*/DESIGN.md`): secciones numeradas, tokens explícitos, tablas y reglas de componentes para minimizar ambigüedad.

## Archivos

| Archivo | Uso |
|---------|-----|
| [COUCHCHAIN-LLM.md](COUCHCHAIN-LLM.md) | Briefing único: producto MVP, diseño visual/UX, Gatito, mapa, stack (Photon/OSRM/Open-Meteo/TransitLand/scraping async), contratos `RoutePassport` + `TrustRegistry`, restricciones de implementación |
| [BLUEPRINT-TECNICO.md](../BLUEPRINT-TECNICO.md) | Arquitectura del protocolo v2.0 (fuente normativa para stack y flujos) |

## Cómo usarlo

1. **Adjuntar** `COUCHCHAIN-LLM.md` (o `@docs/llm-prepared/COUCHCHAIN-LLM.md`) al iniciar una tarea de implementación o UI.
2. **Complementar** con [README.md](../../README.md) y el [Blueprint](../BLUEPRINT-TECNICO.md) para plan de fases, estructura de carpetas y decisiones de arquitectura.
3. **No sustituye** claves reales ni despliegue: las APIs y contratos requieren `.env` y redes de prueba configuradas por el desarrollador.

## Nota

Este material resume el documento de producto MVP de CouchChain y el plan técnico acordado; si el producto evoluciona, actualizar `COUCHCHAIN-LLM.md` para mantener alineación entre agentes y código.
