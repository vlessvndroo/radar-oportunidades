# 0002 — Fuentes de la v1

- **Estado:** aceptada
- **Fecha:** 2026-10-20
- **Fase:** 0

## Contexto

La SPEC propone tres candidatas (Remotive, RemoteOK y We Work Remotely) y pide verificar que sigan disponibles y que sus términos permitan el uso, respetando las reglas no negociables: solo APIs oficiales o RSS, sin scraping y respetando los límites de cada fuente.

## Verificación (2026-10-20)

| Fuente | Endpoint | Disponible | Términos relevantes |
|---|---|---|---|
| Remotive | `GET https://remotive.com/api/remote-jobs` | Sí (200) | Máx. ~4 consultas al día; bloquea más de 2 por minuto. Enlazar a la URL de Remotive y mencionar a Remotive como fuente. Ofertas con 24 h de retraso. No enviar sus ofertas a sitios de terceros. [Términos](https://github.com/remotive-com/remote-jobs-api) |
| Remote OK | `GET https://remoteok.com/api` | Sí (200) | El primer elemento del JSON es el aviso legal: enlazar a la URL de Remote OK (enlace *follow*) y mencionarlo como fuente; no usar su logo sin permiso. |
| We Work Remotely | `GET https://weworkremotely.com/remote-jobs.rss` | Sí (200) | Su página de RSS permite el uso a cualquiera siempre que se atribuyan los enlaces a We Work Remotely. Sus términos de API prohíben construir un servicio que compita con ellos. [Página del RSS](https://weworkremotely.com/remote-job-rss-feed) |

**Limitación de la verificación:** las páginas de We Work Remotely bloquean el acceso automatizado (HTTP 403), así que sus términos se confirmaron con el resultado de búsqueda de la página oficial del RSS y no leyendo el texto completo. Alessandro debería abrir la página en el navegador una vez para confirmarlo.

## Decisión

Se usan **las tres fuentes** en la v1 (la SPEC pide 2 o 3; tener tres da margen si una falla o trae pocas ofertas compatibles con Venezuela):

- Una consulta por fuente por ejecución (diaria), con el `User-Agent` de `SOURCE_USER_AGENT`.
- We Work Remotely: el feed general `remote-jobs.rss` en lugar de varios feeds por categoría, para cumplir "una consulta por fuente".
- El resumen diario siempre incluye el enlace original de la oferta y el nombre de la fuente.

## Consecuencias

- El uso es personal (un perfil que recibe un resumen privado), compatible con los términos de las tres.
- **Riesgo para la expansión:** un canal público o comunitario que reenvíe estas ofertas podría chocar con "no enviar a terceros" (Remotive) y con "no competir" (We Work Remotely). Quedó anotado en `docs/ideas.md` para revisarlo antes de esa expansión.
- Remotive llega con 24 h de retraso, lo que afecta la señal "publicada hace ≤ 3 días" de la puntuación. Se revisa en la fase 2.
