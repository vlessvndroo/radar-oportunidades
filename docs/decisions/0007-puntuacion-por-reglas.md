# 0007 — Puntuación por reglas ahora, Gemini después

- **Estado:** aceptada
- **Fecha:** 2026-10-22
- **Fase:** 2

## Contexto

El documento del 2026-10-21 dejó abierta la pregunta: ¿puntuación por reglas fijas o con un LLM (Gemini) que lea cada oferta y devuelva puntaje y motivo?

## Alternativas

| | Reglas | Gemini para todas | Reglas + Gemini para finalistas |
|---|---|---|---|
| Costo | Gratis | Gratis con límite diario | Gratis (≈5 consultas por día) |
| Volumen | ~300 ofertas en milisegundos | ~300 consultas por revisión; choca con los límites | Solo las mejores |
| Explicable y estable | Sí: cada punto tiene su regla | Motivo variable entre ejecuciones | Sí en el orden; texto libre solo en la explicación |
| Comprobable con pruebas | Sí (`lib/__tests__`) | Difícil | El orden sí |
| Privacidad | Todo local | Todas las descripciones van a Google | Solo las finalistas |

## Decisión

Elegida por Alessandro: **reglas en la fase 2** (`lib/filters.js`, `lib/score.js`, configuradas en `profiles`), y **Gemini como mejora posterior solo para las finalistas**. Por ejemplo, para redactar por qué la oferta encaja y qué destacar al postular. Queda en `docs/ideas.md`.

## Consecuencias

- La puntuación es determinista: la misma oferta con el mismo perfil da siempre el mismo puntaje, y se puede verificar con pruebas.
- Los pesos se ajustan editando `db/seed/02_profiles.sql` y validando con `npm run evaluate`, que evalúa las ofertas guardadas sin tocar n8n.
- Gemini, cuando llegue, se agrega detrás de la misma salida (`score`, `rationale`) sin cambiar el resto del flujo.
