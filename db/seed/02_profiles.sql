-- Perfil inicial (docs/SPEC.md, "Sistema de puntuación").
-- Los pesos son punto de partida: se ajustan en la fase 2 editando este
-- archivo, que es la fuente de verdad. channel_target no se pisa si ya
-- se completó a mano (fase 3).

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
    "rules": [
      {"id": "automation", "label": "automatización", "weight": 30, "type": "keywords",
       "any": ["n8n", "zapier", "make.com", "integromat", "automation", "integration",
               "workflow", "automatización", "integraciones", "api integration"]},
      {"id": "stack", "label": "stack full-stack", "weight": 20, "type": "keywords",
       "any": ["javascript", "typescript", "node", "node.js", "python", "sql", "postgres"]},
      {"id": "ai", "label": "IA/LLM", "weight": 15, "type": "keywords",
       "any": ["llm", "openai", "anthropic", "claude", "gpt", "ai agent", "generative ai",
               "machine learning", "inteligencia artificial"]},
      {"id": "junior", "label": "nivel junior/semi-senior", "weight": 15, "type": "keywords",
       "fields": ["title", "description"],
       "any": ["junior", "jr", "trainee", "entry level", "semi-senior", "semi senior", "mid-level"]},
      {"id": "pay", "label": "pago ≥ $12/h", "weight": 10, "type": "min_hourly_usd", "value": 12},
      {"id": "recent", "label": "publicada hace ≤ 3 días", "weight": 10, "type": "max_age_days", "value": 3},
      {"id": "cloud", "label": "AWS/Azure requerido", "weight": -20, "type": "keywords",
       "any": ["aws", "azure"]},
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
