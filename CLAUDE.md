# CLAUDE.md — Radar de Oportunidades

Motor en n8n que cada mañana recolecta ofertas remotas de fuentes públicas (API/RSS), las filtra y puntúa contra perfiles guardados en Postgres, y envía un resumen diario con las mejores. La especificación completa está en [docs/SPEC.md](docs/SPEC.md); ante cualquier duda, manda la SPEC.

El objetivo no es solo terminar el proyecto: Alessandro debe ganar experiencia real en n8n.

## Forma de trabajar

1. **Una fase a la vez** (ver "Plan por fases" en la SPEC). No empezar la siguiente hasta cumplir los criterios de aceptación de la actual.
2. **Plan antes de cada fase:** presentar un plan corto y esperar aprobación.
3. **Reparto del trabajo:**
   - Los workflows de n8n los construye Alessandro en la interfaz. Claude propone el diseño nodo por nodo, explica por qué y revisa el JSON exportado en `workflows/`.
   - Claude escribe directamente solo: `lib/`, migraciones (`db/`), pruebas, Docker y `scripts/`.
4. **Decisiones técnicas:** explicar las alternativas en 2–3 líneas, recomendar una y registrarla como ADR en `docs/decisions/`.
5. **Commits pequeños** con mensajes descriptivos. Nunca subir secretos.

## Reglas no negociables

- Sin scraping de LinkedIn ni de sitios cuyos términos lo prohíban. Solo APIs oficiales, RSS o páginas que lo permitan explícitamente. Si una fuente no lo permite, descartarla y decirlo.
- Sin postulación automática: el sistema encuentra, puntúa y prepara; la persona revisa y envía.
- Costo cero: solo herramientas gratuitas o autoalojadas. No instalar servicios de pago ni crear cuentas a nombre de Alessandro.
- Secretos solo en `.env` (excluido de git) o en las credenciales de n8n; mantener `.env.example` documentado.
- Respetar los límites de cada fuente: como máximo una consulta por ejecución, `User-Agent` identificable y caché en desarrollo.

## Alcance

- No agregar funciones fuera del alcance de la fase actual; anotarlas en `docs/ideas.md`.
- Ningún perfil, fuente o canal escrito en el código: viven en las tablas `profiles` y `sources`.
- La lógica de normalización, fingerprint, filtros y puntuación vive en funciones puras en `lib/` con pruebas unitarias.

## Entorno

- SO de Alessandro: Windows 11.
- Stack: n8n 2.44.4 + PostgreSQL 17 vía Docker Compose; lógica en JavaScript (Node, ESM) con `node:test`; aviso por Telegram; Git + GitHub.
- Postgres local de Alessandro ocupa el 5432: en su `.env` el radar usa `POSTGRES_PORT=5433`.

## Convenciones técnicas

- `lib/index.js` es el único punto de entrada para n8n (`require('/opt/radar/lib/index.js')`); todo se reexporta desde ahí. Tras cambiar `lib/`: `docker compose restart n8n`. Ver ADR 0001.
- Esquema: migraciones nuevas en `db/migrations/NNN_*.sql`, nunca editar las aplicadas. Config de fuentes/perfiles en `db/seed/` (upserts, fuente de verdad). Ver ADR 0003.
- Valores internos en inglés (`type`, `period`, `runs.status`); `matches.status` en español porque se edita a mano.
- El resumen siempre enlaza la oferta original y nombra la fuente (términos de las fuentes, ADR 0002).
