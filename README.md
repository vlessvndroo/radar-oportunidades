# Radar de Oportunidades

Motor en [n8n](https://n8n.io) que cada mañana recolecta ofertas de empleo remoto de fuentes públicas, las filtra y puntúa contra un perfil, y envía por Telegram un resumen con las 3 a 5 mejores. Sin scraping, sin postulación automática y con costo cero.

> Estado: **fase 2 (puntuar)** terminada: 4 fuentes, filtros duros y puntuación por reglas validada con revisión manual (88% de acierto). Ver el [plan por fases](docs/SPEC.md#plan-por-fases).

## Requisitos

- Docker Desktop (con Docker Compose v2)
- Node.js 22 o superior (solo para las pruebas y los scripts)

## Levantarlo

```sh
cp .env.example .env
# Edita .env: POSTGRES_PASSWORD y N8N_ENCRYPTION_KEY (el archivo explica cómo generarla)
docker compose up -d
```

- Interfaz de n8n: <http://localhost:5678> (la primera vez pide crear el usuario dueño).
- `docker compose up` crea las bases, aplica las migraciones y carga las fuentes y el perfil inicial.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas unitarias de `lib/` |
| `npm run up` / `npm run down` | Levantar / detener (los datos se conservan) |
| `npm run logs` | Ver logs de los contenedores |
| `npm run db:migrate` | Aplicar migraciones y recargar el seed sin reiniciar todo |
| `npm run db:psql` | Consola SQL sobre la base `radar` |
| `npm run db:backup` | Respaldar las bases `radar` y `n8n` en `backups/` |
| `npm run db:restore -- backups/<archivo>.dump` | Restaurar un respaldo |
| `npm run fixtures` | Descargar una muestra de cada fuente (caché local + muestras de prueba) |
| `npm run workflows:export` | Exportar los workflows de n8n a `workflows/` |
| `npm run workflows:import` | Importar `workflows/` a n8n y publicar los conectores |

> `docker compose down -v` borra los volúmenes, es decir, **todos los datos**. Respalda antes.

## Fuentes

| Fuente | Tipo | Términos |
|---|---|---|
| [Remotive](https://remotive.com) | API pública | Máx. ~4 consultas al día, atribución y enlace a la oferta, no reenviar a terceros. [Términos](https://github.com/remotive-com/remote-jobs-api) |
| [Remote OK](https://remoteok.com) | API pública | Atribución y enlace *follow* a la oferta, sin usar su logo. Términos en el primer elemento de [la API](https://remoteok.com/api). |
| [We Work Remotely](https://weworkremotely.com) | RSS | Uso libre con atribución de los enlaces. [Página del RSS](https://weworkremotely.com/remote-job-rss-feed) |
| [Get on Board](https://www.getonbrd.com) | API pública | Abierta y sin autenticación; bolsa de Latinoamérica. [Documentación](https://www.getonbrd.com/api-doc.html) |
| Alertas de LinkedIn (fase 1b) | Gmail | Solo se leen los correos de alerta propios; el radar nunca entra a LinkedIn. |

Detalle y verificación: [ADR 0002](docs/decisions/0002-fuentes-v1.md).

## Estructura

```
db/          migraciones SQL, seed y script de inicialización
docs/        SPEC, arquitectura, decisiones (ADR) e ideas fuera de alcance
lib/         lógica pura (normalize, fingerprint, filters, score) con pruebas
scripts/     migraciones, respaldo y restauración
workflows/   workflows de n8n exportados como JSON
```

## Documentación

- [Especificación técnica](docs/SPEC.md)
- [Arquitectura](docs/architecture.md)
- [Decisiones](docs/decisions/)
