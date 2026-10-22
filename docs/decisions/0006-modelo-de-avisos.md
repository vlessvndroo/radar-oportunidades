# 0006 — Modelo de avisos: resumen diario + alerta inmediata

- **Estado:** aceptada (se implementa en la fase 3)
- **Fecha:** 2026-10-21

## Contexto

La SPEC original pedía un resumen diario con las 3 a 5 mejores ofertas. El documento del 2026-10-21 propone otra cosa: revisar un par de veces al día y avisar solo de cada oferta con puntaje alto.

## Alternativas

1. **Solo resumen diario:** un mensaje por mañana. Una oferta excelente publicada a mediodía espera hasta el día siguiente.
2. **Solo alertas por umbral:** un mensaje por cada oferta que lo supere. Si el umbral queda bajo llegan demasiados mensajes, y si queda alto pueden pasar días sin ninguno.
3. **Ambos:** resumen diario con las mejores, más una alerta inmediata cuando una revisión encuentra una oferta con puntaje muy alto.

## Decisión

Opción 3, elegida por Alessandro:

- El flujo revisa las fuentes un par de veces al día (el horario se fija en la fase 3).
- **Alerta inmediata:** después de cada revisión, las ofertas nuevas con `score >= profiles.alert_threshold` se envían enseguida y quedan con `notified_at`.
- **Resumen diario:** en la primera revisión de la mañana, las mejores `top_n` aún no notificadas. Las que ya llegaron como alerta no se repiten.

## Consecuencias

- La fase 3 agrega la columna `profiles.alert_threshold` (por ejemplo, 80; `NULL` desactiva las alertas) con una migración.
- `matches.notified_at` evita avisar dos veces la misma oferta, sea por alerta o por resumen.
- Revisar dos veces al día respeta los límites de las fuentes (Remotive pide como máximo 4 consultas al día).
