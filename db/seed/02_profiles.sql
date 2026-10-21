-- Perfil inicial (docs/SPEC.md, "Sistema de puntuación").
-- Los pesos son punto de partida: se ajustan en la fase 2 editando este
-- archivo, que es la fuente de verdad. channel_target no se pisa si ya
-- se completó a mano (fase 3).
-- Un solo perfil cubre los dos enfoques de Alessandro (automatización y
-- full-stack); "cv_tracks" indica qué CV enviar según la regla que coincida.

INSERT INTO profiles (name, channel, channel_target, hard_filters, scoring_rules, top_n, notify_when_empty, enabled)
VALUES (
  'alessandro',
  'telegram',
  NULL,
  $json$
  {
    "remote_only": true,
    "location": {
      "allow": ["anywhere", "worldwide", "global", "remote", "latam", "latin america",
                "latinoamérica", "south america", "americas", "venezuela"],
      "deny": ["us only", "usa only", "u.s. only", "united states only", "uk only",
               "europe only", "eu only", "canada only"]
    },
    "contract_types": {
      "allow": ["full_time", "part_time", "contract"],
      "deny": ["freelance", "project"]
    },
    "min_hourly_usd": 10,
    "unknown_salary": "pass_flagged",
    "languages": ["es", "en"]
  }
  $json$::jsonb,
  $json$
  {
    "clamp": [0, 100],
    "cv_tracks": [
      {"id": "automation", "label": "CV automatización", "rule": "automation"},
      {"id": "fullstack", "label": "CV full-stack", "rule": "fullstack"}
    ],
    "rules": [
      {"id": "automation", "label": "automatización", "weight": 30, "type": "keywords",
       "any": ["n8n", "zapier", "make.com", "integromat", "automation", "integration",
               "integrations", "workflow", "webhooks", "airtable", "rpa", "no-code", "low-code",
               "automatización", "integraciones", "api integration"]},
      {"id": "fullstack", "label": "rol full-stack", "weight": 30, "type": "keywords",
       "fields": ["title", "tags"],
       "any": ["full stack", "full-stack", "fullstack", "software engineer", "software developer",
               "web developer", "backend", "back-end", "back end", "frontend", "front-end",
               "desarrollador"]},
      {"id": "stack", "label": "stack coincidente", "weight": 20, "type": "keywords",
       "any": ["javascript", "typescript", "node", "node.js", "nestjs", "react", "python",
               "flask", "sql", "postgres", "postgresql", "supabase", "docker", "tailwind"]},
      {"id": "ai", "label": "IA/LLM", "weight": 15, "type": "keywords",
       "any": ["llm", "openai", "anthropic", "claude", "gemini", "gpt", "ai agent",
               "generative ai", "prompt", "machine learning", "inteligencia artificial"]},
      {"id": "junior", "label": "nivel junior/semi-senior", "weight": 15, "type": "keywords",
       "fields": ["title", "description"],
       "any": ["junior", "jr", "trainee", "entry level", "semi-senior", "semi senior", "mid-level"]},
      {"id": "pay", "label": "pago ≥ $12/h", "weight": 10, "type": "min_hourly_usd", "value": 12},
      {"id": "recent", "label": "publicada hace ≤ 3 días", "weight": 10, "type": "max_age_days", "value": 3},
      {"id": "senior", "label": "senior/lead o 5+ años", "weight": -25, "type": "keywords",
       "fields": ["title", "description"],
       "any": ["senior", "sr.", "lead", "staff", "principal", "5+ years", "6+ years",
               "7+ years", "8+ years", "10+ years"]}
    ]
  }
  $json$::jsonb,
  5,
  false,
  true
)
ON CONFLICT (name) DO UPDATE SET
  channel           = EXCLUDED.channel,
  channel_target    = COALESCE(profiles.channel_target, EXCLUDED.channel_target),
  hard_filters      = EXCLUDED.hard_filters,
  scoring_rules     = EXCLUDED.scoring_rules,
  top_n             = EXCLUDED.top_n,
  notify_when_empty = EXCLUDED.notify_when_empty,
  enabled           = EXCLUDED.enabled,
  updated_at        = now();
