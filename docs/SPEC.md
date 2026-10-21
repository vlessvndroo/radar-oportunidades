# Radar de Oportunidades — Especificación técnica

Oct 20, 2026 · @Aless

## Resumen y objetivos

Radar de Oportunidades es un motor en n8n que cada mañana recolecta oportunidades de fuentes públicas, las filtra y puntúa contra un perfil, y avisa solo de las mejores. El primer caso de uso es la búsqueda de empleo remoto de Alessandro (automatización, integración, full-stack, IA). La arquitectura se diseña desde el día uno para crecer a más fuentes, más perfiles y más canales sin reescribir el núcleo.

El proyecto persigue dos objetivos a la vez:

1. **Útil:** reducir el tiempo diario de búsqueda a revisar un resumen de 3 a 5 ofertas ya filtradas y puntuadas.
2. **Demostrable:** servir como pieza central del portafolio para roles de automatización, con código, arquitectura y resultados reales documentados.

**Métricas de éxito de la v1**

- El flujo corre solo cada mañana durante 14 días seguidos sin intervención manual.
- Al menos 2 fuentes integradas, con duplicados eliminados entre ellas.
- El resumen diario llega antes de las 8:00 (hora de Caracas, UTC−4).
- De las ofertas marcadas como "top", al menos la mitad son relevantes según la revisión manual de Alessandro.
- Costo de operación: $0.

## Alcance

La v1 sirve a un solo perfil (Alessandro) con 2 o 3 fuentes y un canal de aviso, pero con la arquitectura modular completa.

**Dentro de la v1**

- Recolección programada desde fuentes con API o RSS públicos.
- Normalización a un esquema común y eliminación de duplicados.
- Filtros duros y puntuación de encaje por perfil.
- Resumen diario con las mejores ofertas.
- Registro de ejecuciones y errores.

**Fuera de la v1** (diseñar para ello, no construirlo)

- Varios usuarios o perfiles reales.
- Interfaz web propia o tablero.
- Adaptación automática de CV y cartas.
- Otros tipos de oportunidad (becas, freelance, leads).

**Reglas no negociables**

1. **Sin scraping de LinkedIn** ni de sitios cuyos términos lo prohíban. Solo APIs oficiales, RSS o páginas que lo permitan explícitamente.
2. **Sin postulación automática.** El sistema encuentra, puntúa y prepara; la persona revisa y envía.
3. **Costo cero.** Solo herramientas gratuitas o autoalojadas.
4. **Secretos fuera del código.** Credenciales y tokens en variables de entorno o en las credenciales de n8n, nunca en el repositorio.
5. **Respetar los límites de cada fuente:** frecuencia razonable, cabeceras de identificación y caché.

## Arquitectura

El motor separa tres piezas intercambiables (fuentes, perfiles y canales) alrededor de dos tablas: `opportunities` guarda cada oferta una sola vez y `matches` guarda cómo encaja con cada perfil.

**Una oferta se recolecta una vez y se evalúa contra cada perfil**

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ Fuentes             │    │ Normalizar y        │    │ opportunities       │
│ un conector por     │───▶│ deduplicar          │───▶│ tabla · una fila    │
│ fuente              │    │ esquema común       │    │ por oferta          │
│ API o RSS públicos  │    │ fingerprint único   │    │ se recolecta una vez│
└─────────────────────┘    └─────────────────────┘    └──────────┬──────────┘
                                                                 │
                                                                 ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ Canales             │    │ matches             │    │ Evaluar por perfil  │
│ Telegram o correo   │◀───│ tabla · oferta ×    │◀───│ filtros duros       │
│ resumen diario 3–5  │    │ perfil              │    │ puntuación 0–100    │
│                     │    │ puntuación y estado │    │ + motivo            │
└──────────┬──────────┘    └─────────────────────┘    └──────────▲──────────┘
           │                                                     │ lee criterios
           ▼                                                     │ del perfil
┌─────────────────────┐                               ┌──────────┴──────────┐
│ Persona revisa y    │                               │ profiles            │
│ postula             │                               │ tabla · criterios   │
│ sin postulación     │                               │ por persona         │
│ automática          │                               │ agregar uno =       │
│ decide y envía a    │                               │ configuración       │
│ mano                │                               │                     │
└─────────────────────┘                               └─────────────────────┘
```

*arquitectura del motor · flujo diario*

**Flujo diario**

1. Un cron dispara el workflow principal.
2. Cada conector de fuente trae ofertas de una API o RSS público.
3. Se normalizan al esquema común y se deduplican por `fingerprint`; las nuevas se guardan en `opportunities`.
4. Cada oferta nueva se evalúa contra cada perfil activo de `profiles`: primero filtros duros, luego puntuación.
5. El resultado se guarda en `matches`.
6. El canal de cada perfil envía el resumen con las mejores ofertas aún no notificadas.
7. La persona revisa y postula a mano.

**Piezas intercambiables**

- **Fuentes:** un sub-workflow por fuente, todos con la misma salida. Agregar uno no toca el resto.
- **Perfiles:** filas en `profiles` con filtros y reglas en JSONB. Agregar uno es solo configuración.
- **Canales:** un sub-workflow por canal, todos con la misma entrada (perfil + lista de ofertas).

## Requisitos funcionales

Cada módulo es un workflow de n8n independiente que se comunica con los demás solo a través de la base de datos o de sub-workflows con entrada y salida definidas.

**RF-1 Recolección**

- Un sub-workflow por fuente (conector) que devuelve ofertas en el esquema normalizado de la sección Modelo de datos.
- Agregar una fuente nueva = agregar un conector y una fila en la tabla `sources`, sin tocar el resto.
- Ejecución programada diaria (cron) y ejecución manual para pruebas.
- Si una fuente falla, las demás siguen; el fallo queda registrado.

**RF-2 Normalización y duplicados**

- Cada oferta tiene un `fingerprint` (hash de empresa + título normalizado + URL canónica).
- Una oferta ya vista no se vuelve a procesar ni a notificar.
- La misma oferta publicada en dos fuentes se guarda una vez, registrando ambas fuentes.

**RF-3 Filtros duros**

- Descarta ofertas que no cumplen las condiciones obligatorias del perfil (ver sección Puntuación).
- Guarda el motivo del descarte para poder auditar el filtro.

**RF-4 Puntuación de encaje**

- Asigna a cada oferta que pasa los filtros una puntuación de 0 a 100 y una justificación breve.
- Primera versión con reglas deterministas (palabras clave con pesos). La puntuación con un LLM queda como mejora opcional detrás de una interfaz común.

**RF-5 Aviso**

- Un resumen diario con las 3 a 5 ofertas de mayor puntuación: título, empresa, pago si existe, puntuación, justificación y enlace.
- Canal de la v1: Telegram (bot gratuito) o correo; el canal es un sub-workflow intercambiable.
- Si no hay ofertas nuevas, no se envía nada o se envía un aviso corto, según configuración.

**RF-6 Registro y observabilidad**

- Cada ejecución guarda inicio, fin, ofertas recolectadas por fuente, descartadas, puntuadas y notificadas.
- Si una ejecución falla por completo, se notifica el error por el mismo canal.

**RF-7 Estado de postulación (manual)**

- Cada oferta tiene un estado editable: nueva, interesa, postulada, entrevista, descartada.
- En la v1 se actualiza a mano en la base de datos o con un comando simple; la interfaz llega después.

## Modelo de datos

PostgreSQL (el mismo contenedor que usa n8n o uno aparte) con cinco tablas. Los perfiles y fuentes viven en la base de datos, no en el código, para que crecer sea configuración.

| Tabla | Para qué | Campos principales |
|---|---|---|
| `sources` | Fuentes disponibles | `id`, `name`, `type` (api/rss), `url`, `enabled`, `opportunity_type` (job, beca, lead…) |
| `profiles` | Qué busca cada persona | `id`, `name`, `channel`, `channel_target`, `hard_filters` (JSONB), `scoring_rules` (JSONB), `top_n`, `enabled` |
| `opportunities` | Ofertas normalizadas, una por `fingerprint` | `id`, `fingerprint` (único), `title`, `company`, `url`, `location`, `remote` (bool), `contract_type`, `salary_min`, `salary_max`, `currency`, `period` (hora/mes/año), `description`, `tags[]`, `published_at`, `first_seen_at`, `source_ids[]`, `raw` (JSONB) |
| `matches` | Resultado de un perfil frente a una oferta | `opportunity_id`, `profile_id`, `passed_filters` (bool), `reject_reason`, `score` (0–100), `rationale`, `notified_at`, `status` (nueva/interesa/postulada/entrevista/descartada) |
| `runs` | Bitácora de ejecuciones | `id`, `started_at`, `finished_at`, `status`, `stats` (JSONB por fuente), `error` |

La separación entre `opportunities` y `matches` es la clave de la expansión: una oferta se recolecta una sola vez y se evalúa contra todos los perfiles activos.

## Sistema de puntuación

La evaluación tiene dos etapas: filtros duros que descartan, y una puntuación de 0 a 100 que ordena. Ambas se leen del perfil en la base de datos.

**Filtros duros del perfil inicial** (si uno falla, la oferta se descarta con su motivo)

- Trabajo 100 % remoto y abierto a candidatos en Venezuela o Latinoamérica (no limitado a un país que lo excluya).
- Tipo de contrato: empleo o contrato part-time o full-time. Se excluyen ofertas solo freelance o por proyecto.
- Pago: si la oferta lo publica, mínimo equivalente a $10 por hora. Si no lo publica, pasa y queda marcada como "pago desconocido".
- Idioma de la oferta: español o inglés.

**Puntuación de encaje (0–100), primera versión por reglas**

| Señal | Peso |
|---|---|
| Rol de automatización, integración o workflows (n8n, Zapier, Make, APIs) | +30 |
| Stack full-stack que coincide (JavaScript/TypeScript, Node, Python, SQL) | +20 |
| Componente de IA o LLM aplicado | +15 |
| Nivel junior, trainee o semi-senior | +15 |
| Pago publicado y ≥ $12/hora | +10 |
| Publicada hace 3 días o menos | +10 |
| Requisito central de AWS o Azure | −20 |
| Nivel senior, lead o 5+ años exigidos | −25 |

El resultado se recorta entre 0 y 100. La justificación lista las señales que sumaron y restaron, por ejemplo: "+30 automatización, +20 Node, −20 AWS requerido".

Los pesos son un punto de partida. Antes de automatizar, se validan con 20 a 30 ofertas reales revisadas a mano, y se ajustan hasta que el orden coincida con el criterio de Alessandro.

## Requisitos no funcionales

- **Idempotencia:** ejecutar el flujo dos veces el mismo día no duplica ofertas ni avisos.
- **Tolerancia a fallos:** reintentos con espera creciente (3 intentos) por fuente; el fallo de una fuente no detiene a las demás.
- **Respeto a las fuentes:** como máximo una consulta por fuente por ejecución, cabecera `User-Agent` identificable y caché de respuestas en desarrollo.
- **Rendimiento:** una ejecución completa termina en menos de 5 minutos con 3 fuentes.
- **Reproducibilidad:** todo el entorno se levanta con un solo `docker compose up` desde un repositorio limpio.
- **Versionado:** los workflows de n8n se exportan como JSON al repositorio en cada cambio relevante.
- **Seguridad:** secretos solo en `.env` (excluido de git) o en credenciales de n8n; `.env.example` documentado.
- **Privacidad:** no se guardan datos personales de terceros más allá de lo publicado en la oferta.
- **Testabilidad:** la lógica de normalización, deduplicación y puntuación vive en funciones puras con pruebas unitarias.

## Stack y estructura del repositorio

| Pieza | Elección | Motivo |
|---|---|---|
| Orquestación | n8n Community Edition autoalojado | Gratis; es la herramienta que se quiere dominar |
| Base de datos | PostgreSQL | Soporta JSONB y arreglos; n8n puede usarlo también |
| Entorno | Docker Compose (n8n + Postgres) | Un solo comando para levantar todo |
| Lógica pura | JavaScript (Node) con pruebas en Vitest o `node:test` | Testeable fuera de n8n y reutilizable en Code nodes |
| Aviso | Bot de Telegram (o SMTP) | Gratis y fácil de cambiar |
| Control de versiones | Git + GitHub | Portafolio público |

**Fuentes candidatas para la v1** (verificar en la fase 0 que sigan disponibles y que sus términos permitan el uso): API pública de Remotive, API pública de RemoteOK y el RSS de We Work Remotely. Elegir 2 o 3 y documentar en el README los términos de cada una.

**Estructura propuesta**

```
radar-oportunidades/
├── docker-compose.yml
├── .env.example
├── README.md
├── docs/
│   ├── SPEC.md            # este documento
│   ├── architecture.md
│   └── decisions/         # registros de decisiones (ADR)
├── db/
│   ├── migrations/        # SQL versionado
│   └── seed/              # perfil inicial y fuentes
├── lib/                   # lógica pura: normalize, fingerprint, filters, score
│   └── __tests__/
├── workflows/             # JSON exportados de n8n
│   ├── main-daily.json
│   ├── source-*.json      # un conector por fuente
│   ├── evaluate.json
│   └── notify-*.json      # un canal por archivo
└── scripts/               # exportar/importar workflows, utilidades
```

Cómo compartir `lib/` con los Code nodes de n8n es una decisión técnica abierta. Claude Code debe evaluarla en la fase 0 (por ejemplo, montar la carpeta en el contenedor y permitir el módulo con la variable de entorno correspondiente) y registrarla en `docs/decisions/`.

## Plan por fases

Las fases 0 a 3 forman la v1 y caben en unas dos semanas de trabajo realista. Cada fase termina solo cuando cumple sus criterios de aceptación.

**Fase 0 — Preparación** (1–2 días)

- Repositorio con la estructura propuesta, `docker-compose.yml` (n8n + Postgres) y `.env.example`.
- Migraciones de las cinco tablas y seed con el perfil inicial y las fuentes candidatas.
- Verificación de disponibilidad y términos de las fuentes; decisión sobre cómo compartir `lib/` con n8n.
- *Aceptación:* `docker compose up` levanta todo desde cero; las tablas existen; las decisiones están en `docs/decisions/`.

**Fase 1 — Recolectar** (3–4 días)

- Conectores de 2 o 3 fuentes que devuelven el esquema normalizado.
- Funciones `normalize` y `fingerprint` en `lib/` con pruebas.
- Workflow principal que guarda ofertas, deduplica y registra la ejecución en `runs`.
- *Aceptación:* dos ejecuciones seguidas no crean duplicados; la caída simulada de una fuente no detiene las demás.

**Fase 2 — Puntuar** (2–3 días)

- Filtros duros y puntuación en `lib/` con pruebas, leídos desde `profiles`.
- Workflow de evaluación que llena `matches` con motivo de descarte o puntuación y justificación.
- Validación manual con 20–30 ofertas reales y ajuste de pesos.
- *Aceptación:* el orden de las 10 mejores coincide en lo esencial con el criterio de Alessandro.

**Fase 3 — Avisar** (1–2 días)

- Canal de aviso como sub-workflow; resumen diario con las mejores ofertas no notificadas.
- Ejecución programada diaria y aviso de error.
- *Aceptación:* 14 días seguidos de resúmenes sin intervención. **Con esto la v1 está terminada.**

**Fase 4 — Documentar y publicar** (1–2 días)

- README con problema, arquitectura, cómo levantarlo, capturas de los workflows y métricas reales (ofertas procesadas, filtradas, notificadas, postulaciones logradas).
- *Aceptación:* alguien ajeno al proyecto lo levanta siguiendo solo el README.

**Fase 5 — Prueba de expansión** (después de la v1)

- Agregar un segundo perfil real (un compañero) sin cambiar código.
- *Aceptación:* cada perfil recibe su propio resumen con su propia puntuación.

## Expansión horizontal futura

Nada de esto se construye en la v1, pero el diseño no debe bloquearlo. Cada línea indica qué pieza del motor cambia.

| Expansión | Qué se agrega | Pieza que cambia |
|---|---|---|
| Más personas (compañeros de la UCAB) | Una fila nueva en `profiles` por persona | Solo configuración |
| Comunidad: canal o bot de Telegram de ofertas remotas para devs de Latinoamérica | Un perfil "público" y un canal de difusión | Un canal nuevo |
| Becas, convocatorias, hackathons | Conectores nuevos con `opportunity_type` propio y perfiles para ese tipo | Fuentes y perfiles |
| Proyectos freelance | Conectores de plataformas que lo permitan | Fuentes |
| Leads B2B para agencias | Conectores de leads y reglas de puntuación comerciales | Fuentes y perfiles |
| Tablero de seguimiento | Interfaz que lee `matches` y edita `status` | Un canal o vista nueva |
| Puntuación con LLM y adaptación de CV | Implementación alternativa detrás de la interfaz de puntuación | Módulo de evaluación |

**Condiciones de diseño que lo hacen posible:** ningún perfil, fuente o canal está escrito en el código; el núcleo no sabe qué es un "empleo"; y toda evaluación se guarda por par oferta–perfil.

## Instrucciones para Claude Code

Esta sección está escrita para el agente que implementa el proyecto. El objetivo no es solo terminarlo, sino que Alessandro gane experiencia real en n8n.

**Forma de trabajar**

1. Trabaja una fase a la vez (ver Plan por fases). No empieces la siguiente hasta cumplir los criterios de aceptación de la actual.
2. Antes de cada fase, presenta un plan corto y espera aprobación.
3. Los workflows de n8n los construye Alessandro en la interfaz; tú propones el diseño nodo por nodo, explicas por qué y revisas el JSON exportado. Escribe directamente solo `lib/`, migraciones, pruebas, Docker y scripts.
4. Cuando haya una decisión técnica con alternativas, explícalas en dos o tres líneas, recomienda una y regístrala en `docs/decisions/`.
5. Commits pequeños con mensajes descriptivos; nunca subas secretos.

**Límites**

- Respeta las reglas no negociables de la sección Alcance; si una fuente no lo permite, descártala y dilo.
- No instales servicios de pago ni crees cuentas a nombre de Alessandro.
- No agregues funciones fuera del alcance de la fase actual; anótalas en `docs/ideas.md`.

**Primera tarea al recibir este documento**

1. Guarda este documento como `docs/SPEC.md` y crea un `CLAUDE.md` con un resumen de las reglas de esta sección.
2. Confirma con Alessandro su sistema operativo y si tiene Docker instalado.
3. Ejecuta la fase 0.

## Riesgos y preguntas abiertas

| Riesgo | Mitigación |
|---|---|
| Una fuente cierra su API o cambia el formato | Conectores aislados y pruebas con respuestas guardadas; el fallo de una fuente no rompe el resto |
| Pocas ofertas compatibles con Venezuela | Medir en la fase 1 cuántas pasan el filtro de ubicación; si son muy pocas, sumar fuentes antes de ajustar reglas |
| La puntuación por reglas ordena mal | Validación manual con 20–30 ofertas antes de automatizar; ajustar pesos con datos |
| Correr n8n solo cuando la computadora está encendida | Aceptable en la v1 (ejecución al encender); evaluar alojamiento gratuito después |
| Crecer el alcance antes de terminar la v1 | Ideas nuevas a `docs/ideas.md`, no al código |

**Preguntas abiertas**

- [ ] ¿Telegram o correo como canal de la v1?
- [ ] ¿Dónde corre n8n a diario: la computadora de Alessandro o un servidor gratuito?
- [ ] ¿Qué 2 o 3 fuentes pasan la verificación de términos en la fase 0?
- [ ] ¿El repositorio es público desde el inicio o se publica al cerrar la fase 3?
