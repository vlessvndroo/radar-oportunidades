# Arquitectura

Resumen operativo. El diseño completo y sus motivos están en [SPEC.md](SPEC.md) y las decisiones puntuales en [decisions/](decisions/).

## Contenedores

```
┌──────────────── docker compose (proyecto "radar") ────────────────┐
│                                                                    │
│  postgres (17)  ◀── migrate (una vez por "up": migraciones + seed)  │
│   ├─ base n8n    ◀── n8n (2.44.4)  ── interfaz en localhost:5678    │
│   └─ base radar  ◀──┘   └─ /opt/radar/lib ◀── ./lib (solo lectura)  │
│                                                                    │
│  volúmenes: radar_pgdata, radar_n8n_data                           │
└────────────────────────────────────────────────────────────────────┘
```

- **postgres:** guarda los datos internos de n8n (base `n8n`) y las tablas del radar (base `radar`).
- **migrate:** arranca, aplica migraciones pendientes, recarga el seed y termina. n8n espera a que termine bien.
- **n8n:** orquesta los workflows. Lee y escribe en `radar` con una credencial Postgres (host `postgres`, puerto `5432`, base `radar`).

## Flujo de datos

```
cron ─▶ main-daily
          ├─▶ source-remotive ┐
          ├─▶ source-remoteok ├─▶ ofertas normalizadas ─▶ opportunities (upsert por fingerprint)
          ├─▶ source-wwr      ┘
          ├─▶ evaluate ─▶ matches (por oferta × perfil activo)
          ├─▶ notify-telegram ─▶ resumen top N no notificado
          └─▶ runs (bitácora)
```

## Contratos entre módulos

| Módulo | Entrada | Salida |
|---|---|---|
| `source-*` | fila de `sources` (`id`, `url`, …) | **siempre** un ítem `{ source_id, fetched, normalized, error, opportunities[] }`; nunca lanza excepciones |
| `evaluate` | ids de ofertas nuevas | filas en `matches` |
| `notify-*` | perfil + lista de ofertas | mensaje enviado y `matches.notified_at` marcado |

- `main-daily` llama a cada conector por `sources.connector_workflow_id` ([ADR 0005](decisions/0005-conectores-y-main-daily.md)). Los conectores deben estar **publicados**.
- La lógica pura que usan estos módulos está en `lib/` y se carga en los Code nodes con `require('/opt/radar/lib/index.js')` ([ADR 0001](decisions/0001-compartir-lib-con-n8n.md)).

## Funciones SQL (base `radar`)

| Función | Uso |
|---|---|
| `start_run()` | Abre una ejecución en `runs` y devuelve su id |
| `upsert_opportunities(jsonb)` | Inserta ofertas nuevas y suma fuentes a las existentes; devuelve `(id, fingerprint, is_new)` |
| `finish_run(id, stats, error)` | Cierra la ejecución con estado `success`, `partial` o `failed` |
