# Ideas fuera de alcance

Ideas que surgen durante el trabajo y no pertenecen a la fase actual. Se revisan al cerrar cada fase.

- **Gemini para las finalistas** (decidido en el ADR 0007): después de puntuar por reglas, pedirle a Gemini, solo para las 5 mejores del día, un párrafo de por qué encaja y qué destacar al postular. Gratis dentro de su límite diario.
- **Coincidencia de palabras clave** (resuelto en la fase 2 con `findKeyword`) (para la fase 2): buscar por palabra completa y no por subcadena. Si no, "jr" coincide dentro de otras palabras, "lead" penaliza ofertas de "lead generation" (que son justo de automatización) y "node" coincide con "nodes".
- **Canal comunitario y términos de las fuentes** (fase 0): Remotive pide no reenviar sus ofertas a sitios de terceros y We Work Remotely prohíbe servicios que compitan con ellos. Antes de construir el bot público para devs de Latinoamérica (expansión futura), revisar si esas fuentes pueden alimentarlo o si solo sirven para perfiles personales.
