-- Perfil inicial (docs/SPEC.md, "Sistema de puntuación").
-- Este archivo es la fuente de verdad: los pesos se ajustan aquí y se
-- recargan con `npm run db:migrate`. channel_target no se pisa si ya se
-- completó a mano (fase 3).
-- Un solo perfil cubre los dos enfoques de Alessandro (automatización y
-- full-stack); "cv_tracks" indica qué CV enviar según la regla que coincida.
-- Formato de filtros y reglas: lib/filters.js y lib/score.js.

INSERT INTO profiles (name, channel, channel_target, hard_filters, scoring_rules, top_n, notify_when_empty, enabled)
VALUES (
  'alessandro',
  'telegram',
  NULL,
  $json$
  {
    "remote_only": true,
    "location": {
      "accept_regions": ["latam", "latin america", "latinoamerica", "america latina", "south america",
                         "sudamerica", "americas", "the americas", "venezuela"],
      "accept_region_hints": ["latam"],
      "accept_global": ["anywhere in the world", "anywhere", "worldwide", "global", "work from anywhere",
                        "todo el mundo", "international"],
      "generic_remote": ["remote", "remoto", "fully remote", "100 remote", "remote first", "distributed"],
      "deny": ["us only", "usa only", "u s only", "united states only", "north america only", "uk only",
               "europe only", "eu only", "emea only", "canada only", "us based", "us citizens"],
      "unknown": "pass_flagged"
    },
    "contract_types": { "allow": ["full_time", "part_time", "contract"] },
    "min_hourly_usd": 8,
    "low_pay": "flag",
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
      {"id": "automation", "label": "automatización", "weight": 30, "match": {"keywords": [
        {"fields": ["title"], "any": ["automation", "automatizacion", "automatizaciones", "integration",
          "integrations", "integraciones", "workflow", "workflows", "rpa", "no-code", "low-code", "n8n",
          "zapier", "make.com", "integromat", "workato", "ipaas", "api integration"]}
      ]}},
      {"id": "automation_tools", "label": "menciona n8n/Zapier/Make", "weight": 10, "requires_any": ["automation", "fullstack", "dev_role"], "match": {"keywords": [
        {"fields": ["tags", "description"], "any": ["n8n", "zapier", "make.com", "integromat", "workato",
          "power automate"]}
      ]}},
      {"id": "fullstack", "label": "rol full-stack", "weight": 30, "match": {"keywords": [
        {"fields": ["title"], "any": ["full stack", "full-stack", "fullstack", "software engineer",
          "software development engineer", "sde",
          "software developer", "web developer", "backend", "back-end", "back end", "frontend", "front-end",
          "desarrollador", "programador"]}
      ]}},
      {"id": "non_dev_role", "label": "rol no técnico", "weight": -40, "match": {"keywords": [
        {"fields": ["title"], "any": ["sales", "marketing", "representative", "sdr", "bdr", "account executive",
          "account manager", "recruiter", "talent", "customer success", "customer support", "liaison",
          "copywriter", "content", "ventas", "vendedor", "reclutador"]}
      ]}},
      {"id": "dev_role", "label": "rol de desarrollo", "weight": 15, "match": {"keywords": [
        {"fields": ["title"], "any": ["developer", "engineer", "programmer", "desarrollador", "desarrolladora",
          "ingeniero", "ingeniera", "programador", "programadora", "dev", "architect", "arquitecto"]}
      ]}},
      {"id": "stack", "label": "stack coincidente", "weight": 8, "requires_any": ["automation", "fullstack", "dev_role"], "per_match": true, "max": 24, "match": {"keywords": [
        {"fields": ["title", "tags", "description"], "any": ["typescript", "javascript",
          ["node.js", "nodejs", "node"], "nestjs", "react", "python", "flask", ["postgresql", "postgres"],
          "sql", "supabase", "docker", "tailwind"]}
      ]}},
      {"id": "foreign_stack", "label": "stack ajeno en el título", "weight": -15, "per_match": true, "max": -30, "match": {"keywords": [
        {"fields": ["title"], "any": ["angular", "ionic", "java", "php", "laravel", "ruby", "rails",
          "solidity", "rust", "golang", "go", "kotlin", "swift", "flutter", "salesforce", "sap", "dynamics 365"]}
      ]}},
      {"id": "ai", "label": "IA/LLM", "weight": 15, "requires_any": ["automation", "fullstack", "dev_role"], "match": {"keywords": [
        {"fields": ["title", "tags", "description"], "any": ["llm", "llms", "openai", "anthropic", "claude",
          "gemini", "chatgpt", "gpt", "ai agent", "ai agents", "generative ai", "genai", "prompt engineering",
          "machine learning", "rag", "langchain", "inteligencia artificial"]}
      ]}},
      {"id": "junior", "label": "nivel junior/semi-senior", "weight": 15, "requires_any": ["automation", "fullstack", "dev_role"], "match": {
        "keywords": [{"fields": ["title"], "any": ["junior", "jr", "trainee", "entry level", "entry-level",
          "fresh graduate", "graduate", "recien egresado", "semi senior", "semi-senior", "semisenior", "ssr",
          "mid level", "mid-level", "intermediate"]}],
        "raw": {"seniority": ["no_experience", "junior", "semi_senior"]}
      }},
      {"id": "pay", "label": "pago ≥ 12 USD/h", "weight": 10, "requires_any": ["automation", "fullstack", "dev_role"], "match": {"min_hourly_usd": 12}},
      {"id": "recent", "label": "publicada hace ≤ 3 días", "weight": 10, "requires_any": ["automation", "fullstack", "dev_role"], "match": {"max_age_days": 3}},
      {"id": "senior", "label": "senior/lead o 5+ años", "weight": -15, "match": {
        "keywords": [{"fields": ["title"], "any": ["senior", "sr", "tech lead", "technical lead", "team lead",
          "lead engineer", "lead developer", "engineering lead", "design lead", "product lead", "staff",
          "principal", "head of", "architect", "director"],
          "except": ["semi senior", "semi-senior", "semisenior", "semi sr"]}],
        "raw": {"seniority": ["senior", "expert"]},
        "min_years": 5
      }}
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
