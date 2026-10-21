# Guía fase 1: construir los workflows de recolección

Vas a construir 4 workflows en n8n (<http://localhost:5678>): tres **conectores**, uno por fuente, y el workflow principal **main-daily**. El diseño y sus motivos están en el [ADR 0005](../decisions/0005-conectores-y-main-daily.md).

```
main-daily
  Manual Trigger
  → Iniciar run           (Postgres: SELECT start_run())
  → Fuentes activas       (Postgres: una fila por fuente)
  → Ejecutar conector     (Execute Workflow, una vez por fuente, por id)
        ├─ source-remotive        HTTP → Normalizar
        ├─ source-remoteok        HTTP → Normalizar
        └─ source-weworkremotely  HTTP → Normalizar
  → Preparar lote         (Code: junta resultados por source_id)
  → Guardar ofertas       (Postgres: upsert_opportunities)
  → Cerrar run            (Postgres: finish_run)
```

> **Respeta los límites de las fuentes mientras pruebas.** Remotive pide máximo **4 consultas al día**.
>
> - Al probar un conector solo, ejecuta su HTTP Request una vez y **fija la salida** (botón de pin 📌 en el panel de salida). Las siguientes ejecuciones desde el editor usan esos datos sin consultar la fuente. El script de exportación borra los datos fijados, así que no terminan en git.
> - Los pins **solo valen al ejecutar ese mismo workflow desde el editor**. Cuando main-daily llama a un conector, la consulta es real. Cada ejecución de main-daily = 1 consulta a cada fuente.
> - Presupuesto de Remotive para un día: 1 prueba del conector + 3 ejecuciones de main-daily (paso 5) = 4. Si necesitas más, desactívala mientras pruebas con `UPDATE sources SET enabled = false WHERE id = 'remotive';`. `npm run db:migrate` la vuelve a activar.
> - El 21 de octubre ya hice 2 consultas a Remotive al preparar `lib/`. Si pruebas ese día, desactívala o deja las pruebas de main-daily para el día siguiente.

---

## Paso 0 — Credencial de la base de datos

En n8n: **Overview → Credentials → Create credential → Postgres**.

| Campo | Valor |
|---|---|
| Nombre | `Radar DB` |
| Host | `postgres` (el nombre del servicio en Docker, no `localhost`) |
| Database | `radar` |
| User | el `POSTGRES_USER` de tu `.env` |
| Password | el `POSTGRES_PASSWORD` de tu `.env` |
| Port | `5432` (el puerto interno; el 5433 es solo para tu Windows) |
| SSL | Disable |

Pulsa **Save**; n8n prueba la conexión.

**Por qué:** n8n guarda la contraseña cifrada con tu `N8N_ENCRYPTION_KEY`, así que nunca aparece en los JSON exportados.

---

## Paso 1 — Conector `source-remotive`

Crea un workflow nuevo llamado exactamente **`source-remotive`**.

### Nodo 1: When Executed by Another Workflow

- Agrégalo buscando "Execute Workflow Trigger" o "When Executed by Another Workflow".
- **Input data mode:** `Accept all data`.

**Por qué:** main-daily le pasa la fila completa de `sources` (`id`, `url`). Con "Accept all data" el conector recibe lo que llegue, sin tener que declarar campos.

### Nodo 2: HTTP Request, renómbralo `Descargar`

| Pestaña | Campo | Valor |
|---|---|---|
| Parameters | Method | `GET` |
| | URL | `{{ $json.url }}` (modo Expression) |
| | Send Headers | activado → Name `User-Agent`, Value `{{ $env.SOURCE_USER_AGENT }}` |
| | Options → Response → Response Format | `Text` |
| | Options → Response → Put Output in Field | `body` |
| Settings | Retry On Fail | activado |
| | Max Tries | `3` |
| | Wait Between Tries (ms) | `5000` |
| | On Error | `Continue` (la opción que sigue por la salida normal) |

**Por qué:**
- La URL sale de la base de datos y no se escribe en el workflow: si una fuente cambia de dirección, se edita el seed y no el workflow.
- Con `Text`, n8n no intenta interpretar la respuesta. Si fuera JSON, n8n partiría los arreglos en un ítem por elemento; el parser de `lib/` se encarga de leerla.
- `On Error: Continue` hace que, después de los 3 intentos, el error llegue como dato al siguiente nodo en vez de detener el workflow. En las pruebas se vio que si el conector lanza un error, main-daily pierde ese resultado sin avisar.

### Nodo 3: Code, renómbralo `Normalizar`

- **Mode:** `Run Once for All Items`
- **Language:** JavaScript

```js
const { parseRemotive, normalizeAll } = require('/opt/radar/lib/index.js');

const source = $('When Executed by Another Workflow').first().json;
const response = $input.first().json;

try {
  if (response.error) {
    throw new Error(response.error.message ?? JSON.stringify(response.error));
  }
  const candidates = parseRemotive(response.body);
  const opportunities = normalizeAll(candidates, source.id);
  return [{ json: {
    source_id: source.id,
    fetched: candidates.length,
    normalized: opportunities.length,
    error: null,
    opportunities,
  } }];
} catch (err) {
  return [{ json: {
    source_id: source.id, fetched: 0, normalized: 0, error: err.message, opportunities: [],
  } }];
}
```

**Por qué:** toda la lógica vive en `lib/`, que tiene pruebas. El nodo solo conecta datos. Pase lo que pase, devuelve **un ítem con `source_id`**: ese es el contrato con main-daily.

### Probar el conector solo

1. Fija datos de entrada de prueba en el trigger: ábrelo, pulsa **Edit Output** / pin y pega:
   ```json
   [{ "id": "remotive", "url": "https://remotive.com/api/remote-jobs" }]
   ```
2. **Execute workflow**. En `Normalizar` deberías ver un ítem con `fetched: 10` y la lista `opportunities`.
3. Fija la salida de `Descargar` (📌) para no volver a consultar Remotive.

### Publicar

Pulsa **Publish** (arriba a la derecha). **En n8n 2.x un sub-workflow sin publicar no se puede llamar desde otro workflow.**

Anota el **id** del workflow: es la parte final de la URL, `localhost:5678/workflow/<id>`.

---

## Paso 2 — Conectores `source-remoteok` y `source-weworkremotely`

Duplica `source-remotive` (menú **⋯ → Duplicate**) dos veces y cambia solo esto:

| Workflow | Línea del `require` y llamada al parser | Datos de prueba del trigger |
|---|---|---|
| `source-remoteok` | `const { parseRemoteOk, normalizeAll } = …` y `parseRemoteOk(response.body)` | `[{ "id": "remoteok", "url": "https://remoteok.com/api" }]` |
| `source-weworkremotely` | `const { parseWeWorkRemotely, normalizeAll } = …` y `parseWeWorkRemotely(response.body)` | `[{ "id": "weworkremotely", "url": "https://weworkremotely.com/remote-jobs.rss" }]` |

Prueba cada uno (Remote OK da ~99 ofertas y WWR ~91), fija la salida de `Descargar`, **publícalo** y anota su id.

---

## Paso 3 — Registrar los conectores en `sources`

Pásame los 3 ids y los agrego a `db/seed/01_sources.sql`. Así quedan versionados y se cargan solos en cada `docker compose up`.

Si quieres probar antes, puedes ponerlos a mano (el seed no los pisa):

```bash
npm run db:psql
```

```sql
UPDATE sources SET connector_workflow_id = '<id>' WHERE id = 'remotive';
UPDATE sources SET connector_workflow_id = '<id>' WHERE id = 'remoteok';
UPDATE sources SET connector_workflow_id = '<id>' WHERE id = 'weworkremotely';
```

---

## Paso 4 — Workflow `main-daily`

Crea un workflow llamado **`main-daily`**. **Respeta los nombres de los nodos**, porque el código los usa para referirse a ellos.

### Nodo 1: Manual Trigger

Sin configuración. El cron diario llega en la fase 3.

### Nodo 2: Postgres, `Iniciar run`

- Credential: `Radar DB` · Operation: `Execute Query`
- Query:
  ```sql
  SELECT start_run() AS run_id;
  ```

### Nodo 3: Postgres, `Fuentes activas`

- Operation: `Execute Query`
- Query:
  ```sql
  SELECT id, url, connector_workflow_id
  FROM sources
  WHERE enabled AND connector_workflow_id IS NOT NULL
  ORDER BY id;
  ```

Devuelve un ítem por fuente.

### Nodo 4: Execute Workflow, `Ejecutar conector`

| Pestaña | Campo | Valor |
|---|---|---|
| Parameters | Source | `Database` |
| | Workflow | `By ID` → `{{ $json.connector_workflow_id }}` (Expression) |
| | Mode | `Run once for each item` |
| | Options → Wait For Sub-Workflow Completion | activado |
| Settings | On Error | `Continue` |

**Por qué:** un solo nodo sirve para todas las fuentes. Para agregar una fuente basta con su conector y su fila en `sources`, sin tocar main-daily (RF-1).

### Nodo 5: Code, `Preparar lote`

- Mode: `Run Once for All Items`

```js
const runId = $('Iniciar run').first().json.run_id;
const expected = $('Fuentes activas').all().map((item) => item.json.id);

const sources = {};
const opportunities = [];

// Cada resultado se identifica por su source_id, nunca por su posición.
for (const { json: result } of $input.all()) {
  if (!result.source_id) continue;
  sources[result.source_id] = {
    fetched: result.fetched ?? 0,
    normalized: result.normalized ?? 0,
    error: result.error ?? null,
  };
  opportunities.push(...(result.opportunities ?? []));
}

// Una fuente sin resultado (conector sin publicar, caído, etc.) queda con error.
for (const id of expected) {
  sources[id] ??= { fetched: 0, normalized: 0, error: 'el conector no devolvió resultado' };
}

return [{ json: { run_id: runId, sources, opportunities } }];
```

### Nodo 6: Postgres, `Guardar ofertas`

- Operation: `Execute Query`
- Query:
  ```sql
  SELECT count(*) FILTER (WHERE is_new)::int     AS new,
         count(*) FILTER (WHERE NOT is_new)::int AS existing
  FROM upsert_opportunities($1::jsonb);
  ```
- Options → **Query Parameters**: `{{ [JSON.stringify($json.opportunities)] }}`

**Por qué:** se manda todo el lote como un solo parámetro JSON. Escrito como arreglo (`[ … ]`), n8n no lo separa por las comas que hay dentro del JSON (probado con comas, comillas y `$1` en el texto). La deduplicación y la combinación de fuentes ocurren en la función SQL, así que repetir la ejecución no crea duplicados.

### Nodo 7: Postgres, `Cerrar run`

- Operation: `Execute Query`
- Query:
  ```sql
  SELECT id, status, stats FROM finish_run($1::bigint, $2::jsonb);
  ```
- Options → **Query Parameters**:
  ```
  {{ [ $('Preparar lote').first().json.run_id, JSON.stringify({ sources: $('Preparar lote').first().json.sources, new: $json.new, existing: $json.existing }) ] }}
  ```

El estado queda en `success`, en `partial` si falló alguna fuente, o en `failed` si hubo un error general (fase 3).

---

## Paso 5 — Criterios de aceptación

### A. Dos ejecuciones seguidas no crean duplicados

1. Ejecuta `main-daily` dos veces.
2. Revisa:
   ```bash
   npm run db:psql
   ```
   ```sql
   SELECT id, status, stats->'new' AS nuevas, stats->'existing' AS existentes FROM runs ORDER BY id;
   SELECT count(*), count(DISTINCT fingerprint) FROM opportunities;
   ```
   Lo esperado: la primera ejecución tiene `nuevas` ≈ 190 o más, la segunda `nuevas = 0`, y los dos `count` son iguales.

### B. La caída de una fuente no detiene a las demás

1. Apunta una fuente a una dirección inexistente:
   ```sql
   UPDATE sources SET url = 'https://fuente-caida.invalid/api' WHERE id = 'remoteok';
   ```
2. Ejecuta `main-daily`. Tarda unos 15 s más por los reintentos.
3. El último registro de `runs` debe tener `status = 'partial'`, el error en `stats->'sources'->'remoteok'` y las otras dos fuentes con sus datos.
4. Restaura la URL original recargando el seed:
   ```bash
   npm run db:migrate
   ```

---

## Paso 6 — Exportar y avisarme

```bash
npm run workflows:export
```

Escribe los 4 JSON en `workflows/`. Avísame y los reviso nodo por nodo antes del commit.
