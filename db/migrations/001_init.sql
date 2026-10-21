-- 001_init: las cinco tablas del motor (ver docs/SPEC.md, "Modelo de datos").
-- Valores internos en inglés (type, period, run status); el estado de
-- postulación queda en español porque Alessandro lo edita a mano.

-- Fuentes disponibles. El id es un slug estable ("remotive") que usan los
-- conectores y que se guarda en opportunities.source_ids.
CREATE TABLE sources (
  id               text PRIMARY KEY CHECK (id ~ '^[a-z0-9_-]+$'),
  name             text NOT NULL,
  type             text NOT NULL CHECK (type IN ('api', 'rss')),
  url              text NOT NULL,
  enabled          boolean NOT NULL DEFAULT true,
  opportunity_type text NOT NULL DEFAULT 'job',
  terms_url        text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Qué busca cada persona. Filtros y reglas viven en JSONB para que agregar
-- un perfil sea solo configuración.
CREATE TABLE profiles (
  id                serial PRIMARY KEY,
  name              text NOT NULL UNIQUE,
  channel           text NOT NULL CHECK (channel IN ('telegram', 'email')),
  channel_target    text,                     -- chat id o correo; se completa en la fase 3
  hard_filters      jsonb NOT NULL DEFAULT '{}',
  scoring_rules     jsonb NOT NULL DEFAULT '{}',
  top_n             smallint NOT NULL DEFAULT 5 CHECK (top_n BETWEEN 1 AND 20),
  notify_when_empty boolean NOT NULL DEFAULT false,  -- RF-5: aviso corto si no hay ofertas
  enabled           boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Ofertas normalizadas: una fila por fingerprint, sin importar cuántas
-- fuentes la publiquen.
CREATE TABLE opportunities (
  id            bigserial PRIMARY KEY,
  fingerprint   text NOT NULL UNIQUE,
  title         text NOT NULL,
  company       text,
  url           text NOT NULL,
  location      text,
  remote        boolean,
  contract_type text,                         -- full_time, part_time, contract, freelance...
  salary_min    numeric(12, 2),
  salary_max    numeric(12, 2),
  currency      text,
  period        text CHECK (period IN ('hour', 'month', 'year')),
  description   text,
  tags          text[] NOT NULL DEFAULT '{}',
  published_at  timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  source_ids    text[] NOT NULL DEFAULT '{}',
  raw           jsonb,
  CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);

CREATE INDEX opportunities_first_seen_at_idx ON opportunities (first_seen_at DESC);
CREATE INDEX opportunities_source_ids_idx ON opportunities USING gin (source_ids);

-- Resultado de evaluar una oferta contra un perfil. La clave compuesta hace
-- que reevaluar sea un upsert y no un duplicado (idempotencia).
CREATE TABLE matches (
  opportunity_id bigint NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  profile_id     integer NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  passed_filters boolean NOT NULL,
  reject_reason  text,
  score          smallint CHECK (score BETWEEN 0 AND 100),
  rationale      text,
  notified_at    timestamptz,
  status         text NOT NULL DEFAULT 'nueva'
                 CHECK (status IN ('nueva', 'interesa', 'postulada', 'entrevista', 'descartada')),
  evaluated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, profile_id),
  CHECK (passed_filters OR reject_reason IS NOT NULL),
  CHECK (NOT passed_filters OR score IS NOT NULL)
);

-- Lo que consulta el resumen diario: aprobadas y aún no notificadas, por puntuación.
CREATE INDEX matches_pending_digest_idx
  ON matches (profile_id, score DESC)
  WHERE passed_filters AND notified_at IS NULL;

-- Bitácora de ejecuciones (RF-6).
CREATE TABLE runs (
  id          bigserial PRIMARY KEY,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'running'
              CHECK (status IN ('running', 'success', 'partial', 'failed')),
  stats       jsonb NOT NULL DEFAULT '{}',    -- por fuente: recolectadas, nuevas, errores...
  error       text
);

CREATE INDEX runs_started_at_idx ON runs (started_at DESC);
