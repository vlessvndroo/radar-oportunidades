# Guía fase 2: workflow `evaluate` y conexión con main-daily

El workflow `evaluate` toma las ofertas que el perfil todavía no evaluó, les aplica los filtros duros y la puntuación de `lib/`, y guarda el resultado en `matches`. Lo llama `main-daily` justo después de guardar las ofertas.

```
main-daily
  … → Guardar ofertas → Evaluar ofertas (llama a evaluate) → Cerrar run

evaluate
  When Executed by Another Workflow
  → Pendientes        (Postgres: pending_evaluations)
  → Evaluar           (Code: lib/evaluate.js)
  → Guardar matches   (Postgres: save_matches)
```

---

## Paso 1 — Workflow `evaluate`

### Nodo 1: When Executed by Another Workflow

- **Input data mode:** `Accept all data`.

### Nodo 2: Postgres, `Pendientes`

- Credential: `Radar DB` · Operation: `Execute Query`
- Query:
  ```sql
  SELECT profile, opportunity FROM pending_evaluations($1::boolean);
  ```
- Options → **Query Parameters** (Expression): `{{ [ $json.reevaluate === true ] }}`
- Pestaña **Settings → Always Output Data:** activado.

**Por qué:**
- `pending_evaluations` devuelve un par perfil × oferta por cada oferta que ese perfil todavía no evaluó. Así, cada día solo se evalúan las nuevas.
- Si recibe `reevaluate: true`, devuelve todas. Sirve para recalcular cuando cambian los pesos.
- **Always Output Data:** si no hay nada pendiente, el nodo igual entrega un ítem vacío y el workflow sigue hasta el final, en vez de cortarse sin responder a `main-daily`.

### Nodo 3: Code, `Evaluar`

- Mode: `Run Once for All Items`

```js
const { evaluateAll } = require('/opt/radar/lib/index.js');

// Con "Always Output Data" puede llegar un ítem vacío: se ignora.
const rows = $input.all()
  .map((item) => item.json)
  .filter((row) => row.profile && row.opportunity);

return [{ json: { results: evaluateAll(rows) } }];
```

### Nodo 4: Postgres, `Guardar matches`

- Operation: `Execute Query`
- Query:
  ```sql
  SELECT evaluated, passed, rejected FROM save_matches($1::jsonb);
  ```
- Options → **Query Parameters** (Expression): `{{ [JSON.stringify($json.results)] }}`

Devuelve un solo ítem, por ejemplo `{ evaluated: 318, passed: 250, rejected: 68 }`, que es lo que recibe `main-daily`.

### Probar y publicar

1. En el disparador, con el lápiz ✏️, pon datos de prueba: `[{ "reevaluate": false }]`.
2. **Execute workflow.** En `Guardar matches` deberías ver `evaluated` ≈ 318, `passed` ≈ 250 y `rejected` ≈ 68.
3. Ejecútalo otra vez: ahora `evaluated` debe ser **0**, porque ya no queda nada pendiente.
4. **Publish** (`v1 - evaluate`). Recuerda que en n8n 2.x los sub-workflows tienen que estar publicados.

---

## Paso 2 — Conectar `evaluate` a `main-daily`

### Nodo nuevo: Execute Workflow, `Evaluar ofertas`

Entre `Guardar ofertas` y `Cerrar run`. Pasa el mouse por la línea que los une, haz clic en **`+`** y elige **Execute Workflow**.

| Pestaña | Campo | Valor |
|---|---|---|
| Parameters | Source | `Database` |
| | Workflow | `From list` → `evaluate` |
| | Mode | `Run once with all items` |
| Settings | On Error | `Continue` |

Aquí el workflow es siempre el mismo, así que se elige de la lista, sin expresión.

### Cambiar los parámetros de `Cerrar run`

Antes, `Cerrar run` tomaba `new` y `existing` de `$json`, es decir, del nodo anterior. Ahora el nodo anterior es `Evaluar ofertas`, así que hay que pedirlos por nombre. Reemplaza **Query Parameters** por:

```
{{ [ $('Preparar lote').first().json.run_id, JSON.stringify({ sources: $('Preparar lote').first().json.sources, new: $('Guardar ofertas').first().json.new, existing: $('Guardar ofertas').first().json.existing, evaluation: $json }) ] }}
```

`evaluation: $json` guarda en la bitácora lo que devolvió `evaluate` (`evaluated`, `passed` y `rejected`), o el error si falló.

---

## Paso 3 — Criterio de aceptación

1. Ejecuta `main-daily`.
2. En `Cerrar run`: `status = success` y en `stats.evaluation` cuántas se evaluaron, cuántas pasaron y cuántas se descartaron. Si no hubo ofertas nuevas, `evaluated` es 0.
3. Revisa las mejores:
   ```sql
   SELECT m.score, o.title, o.company, m.cv_track, m.flags, m.rationale
   FROM matches m JOIN opportunities o ON o.id = m.opportunity_id
   WHERE m.passed_filters
   ORDER BY m.score DESC
   LIMIT 10;
   ```

## Ajustar los pesos más adelante

1. Edita `db/seed/02_profiles.sql` y aplica con `npm run db:migrate`.
2. Mira el efecto sin tocar n8n: `npm run evaluate`.
3. Recalcula lo guardado: ejecuta `evaluate` con `[{ "reevaluate": true }]`, o corre `npm run evaluate -- --save`.
