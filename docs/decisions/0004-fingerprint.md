# 0004 — Fingerprint: empresa + título, URL solo como respaldo

- **Estado:** aceptada
- **Fecha:** 2026-10-21
- **Fase:** 1

## Contexto

RF-2 pide que la misma oferta publicada en dos fuentes se guarde una sola vez. La SPEC define el fingerprint como "hash de empresa + título normalizado + URL canónica", pero cada fuente tiene su propia URL para la misma oferta (`remotive.com/...` y `remoteok.com/...`). Si se incluye la URL, nunca habría duplicados entre fuentes.

## Alternativas

1. **Empresa + título + URL** (texto literal de la SPEC): deduplica solo dentro de una fuente, así que no cumple RF-2.
2. **Empresa + título normalizados, con la URL como respaldo cuando falta la empresa.** Puede fusionar dos ofertas distintas de la misma empresa con exactamente el mismo título; en la práctica suele ser la misma vacante republicada.
3. **Similitud difusa** (distancia de texto, descripción): más precisa, pero no es determinista ni barata, y es más difícil de probar.

## Decisión

Opción 2, implementada en `lib/fingerprint.js`:

- **Empresa:** sin acentos, en minúsculas y sin signos; sin sufijos legales (`Inc`, `LLC`, `S.A.`, `GmbH`…).
- **Título:** igual, más sin notas entre paréntesis o corchetes (`(Remote)`, `[LATAM]`) y sin la palabra `remote`/`remoto`.
- **Clave:** `ct:<empresa>|<título>` → SHA-256, primeros 32 caracteres hex. Sin empresa: `url:<URL canónica>`.

## Evidencia

Con las respuestas reales del 2026-10-21 (200 ofertas), la opción 2 encontró 2 ofertas publicadas en Remotive y en Remote OK, por ejemplo "Senior React Full-stack Developer" frente a "Senior React Full stack Developer". La opción 1 no habría encontrado ninguna.

## Consecuencias

- `upsert_opportunities` (migración 002) combina las fuentes en `source_ids` cuando el fingerprint ya existe.
- Si dos vacantes realmente distintas comparten empresa y título, la segunda se pierde. Es un riesgo aceptable para la v1.
- Cambiar la normalización cambia los fingerprints: las ofertas ya guardadas se verían como nuevas. Si hace falta, se hace con una migración que recalcule la columna.
