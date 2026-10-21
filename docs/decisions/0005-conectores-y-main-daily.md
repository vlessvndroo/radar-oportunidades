# 0005 — Diseño de los conectores y de main-daily en n8n

- **Estado:** aceptada
- **Fecha:** 2026-10-21
- **Fase:** 1

## Contexto

RF-1 pide que agregar una fuente sea "un conector y una fila en `sources`, sin tocar el resto", y que si una fuente falla las demás sigan. Antes de proponer el diseño se probaron en n8n 2.44.4 los comportamientos de los que depende, con workflows de prueba que después se borraron.

## Hallazgos de las pruebas

| Prueba | Resultado |
|---|---|
| Llamar un sub-workflow sin publicar | Falla: `Workflow is not active and cannot be executed`. En n8n 2.x los sub-workflows deben estar **publicados**. |
| Execute Workflow con el id en una expresión (`{{ $json.connector_workflow_id }}`), una vez por ítem | Funciona: cada fila de `sources` llama a su conector. |
| Un conector que lanza una excepción, con "On Error: Continue" en main | **Su resultado se pierde sin aviso** y el orden de los resultados se desfasa (el de la fuente "c" queda en la posición de "b"). |
| Conector que captura el error y devuelve `{source_id, error}` | Funciona: la fuente caída queda registrada con su error y las demás siguen. |
| HTTP Request con 3 intentos y "On Error: Continue" ante un host inexistente | Funciona: tras los reintentos entrega un ítem con `error`. |
| Nodo Postgres con `queryReplacement` = `{{ [JSON.stringify(lista)] }}` | Funciona con JSON que contiene comas, comillas y `$1`. |

## Decisión

- **`sources.connector_workflow_id`** (migración 003) guarda el id del workflow conector de cada fuente. `main-daily` lo llama con un solo nodo Execute Workflow, sin Switch por fuente.
- **Contrato del conector.** Recibe la fila de `sources` (`id`, `url`, …) y **siempre** devuelve un único ítem, sin lanzar excepciones:
  `{ source_id, fetched, normalized, error: null | "mensaje", opportunities: [...] }`
- **main-daily identifica cada resultado por `source_id`, no por posición**, y marca con error a la fuente que no devolvió nada.
- **Reintentos:** se usan los reintentos integrados del nodo HTTP Request (3 intentos, 5 s entre cada uno). La SPEC pide "espera creciente"; n8n solo ofrece espera fija. Para una consulta diaria la diferencia no importa, y evita armar un bucle de reintentos a mano.
- **Idempotencia y bitácora en SQL:** `upsert_opportunities`, `start_run` y `finish_run` (migración 002).

## Consecuencias

- Agregar una fuente = crear su conector (copiando uno existente y cambiando el parser), publicarlo, y agregar su fila en `db/seed/01_sources.sql` con el id del conector.
- Si un conector no está publicado, main-daily lo registra como fuente con error ("el conector no devolvió resultado") y sigue con las demás.
- Si `main-daily` falla a mitad de camino, la ejecución queda en estado `running` en `runs`. El aviso de error y el cierre como `failed` llegan en la fase 3 (Error Trigger).
