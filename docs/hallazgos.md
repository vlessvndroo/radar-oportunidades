# Hallazgos sobre los datos

Mediciones con datos reales que condicionan las fases siguientes. Cada entrada indica la fecha y qué fase la usa.

## 2026-10-22 — Primera ejecución completa con evaluación (cierre de la fase 2)

- Ejecución 5: 27 ofertas nuevas desde la noche anterior, las 27 evaluadas en la misma ejecución (25 pasan, 2 descartadas), `status = success`.
- Las nuevas mostraron dos casos más:
  - **Roles no técnicos con "automation" en el título** ("Marketing Automation Manager", "Sales Development Representative – … Automation"). Resuelto con la regla "rol no técnico" (−40). El acierto frente a la revisión manual se mantiene en 88%.
  - **Restricción de país escrita en el título** ("Software Development Engineer II (Remote @ Colombia)", "… – Canada, Spain, India"), mientras la ubicación de WWR dice "Anywhere". Pendiente: el filtro de ubicación solo mira el campo de ubicación. Hace falta juntar más casos antes de leer países en el título, para no descartar ofertas por error.

## 2026-10-22 — Validación manual de la puntuación (fase 2)

Alessandro revisó 26 ofertas reales (15 mejores, 7 del medio, 3 descartadas y la de automatización con pago bajo) y las marcó sí / sí pero depende del stack / quizás / no.

**Su criterio, en orden de importancia:**
1. ¿Es un rol de desarrollo? Ventas, enablement y diseño son "no" sin importar lo demás.
2. ¿Cuánto se parece el stack al suyo? Casi todo lo de desarrollo es "sí, depende del stack". No conocer el framework principal (Ionic/Angular) lo convierte en "no".
3. El nivel senior resta, pero no descalifica. El pago bajo tampoco: lo quiere ver con el monto y decidir.

**Cambios que salieron de la revisión:** pago bajo como aviso con el monto (mínimo de referencia 8 USD/h); "Semi Senior" ya no cuenta como senior; nueva señal "rol de desarrollo" (+15); el stack suma +8 por tecnología hasta +24; stack ajeno en el título resta −15 por tecnología hasta −30 (.NET no, porque sabe C#); senior baja de −25 a −15; junior, pago, IA, recencia y herramientas solo suman en roles de desarrollo o automatización.

| Medida | Antes | Después |
|---|---|---|
| Pares ordenados como él | 83% | 88% |
| Puntaje promedio de sus "sí" | 78 | 89 |
| Puntaje promedio de sus "no" | 17 | 10 |
| Ofertas marcadas "no" en el top 10 del radar | 1 | 0 |

## 2026-10-22 — Aceptación de la fase 1 (main-daily en n8n)

| Ejecución | Estado | Nuevas | Existentes | Nota |
|---|---|---|---|---|
| 1 | success | 318 | 0 | 4 fuentes: 119 + 99 + 10 + 92 = 320 → 318 (2 repetidas entre Remotive y Remote OK) |
| 2 | success | 0 | 318 | Repetir no duplica |
| 3 | partial | 0 | 221 | Remote OK apuntada a un host inexistente: error registrado, las otras 3 siguieron |

- Una ejecución completa tarda ~4 s (la SPEC pide menos de 5 minutos); la que tiene una fuente caída suma ~15 s por los reintentos.

## 2026-10-21 — Primera recolección (fase 1, para la fase 2)

Muestra: una consulta a cada fuente → Remotive 10, Remote OK 99, We Work Remotely 92 (91 únicas) = 198 ofertas tras deduplicar.

**Volumen por fuente**
- Remotive: su API pública devuelve solo las 10 ofertas más recientes (con 24 h de retraso) e ignora `limit`. Es la fuente más chica.
- We Work Remotely: el feed general trae ~10 ofertas por categoría, incluidas ventas, diseño y soporte.
- Remote OK: ~100 ofertas de todas las áreas.

**Ubicación (riesgo "pocas ofertas compatibles con Venezuela")**

| Fuente | Total | Sin ubicación | Pasan el filtro simple del perfil | Mencionan LATAM/Venezuela |
|---|---|---|---|---|
| Remote OK | 99 | 47 | 15 | 1 |
| Remotive | 8 | 0 | 5 | 0 |
| We Work Remotely | 91 | 0 | 84 | 2 |
| **Total** | 198 | 47 | 104 | 3 |

Para la fase 2:
- El filtro simple (buscar "anywhere", "worldwide"…) es optimista. En WWR, `region` dice "Anywhere in the World", pero `country` a veces lista solo Estados Unidos, y no está claro si es una restricción o la sede de la empresa. Hay que decidir cómo interpretarlo.
- Casi la mitad de Remote OK no trae ubicación. Hay que decidir si "sin ubicación" pasa (marcada, como el pago desconocido) o se descarta.
- Solo 3 de 198 mencionan LATAM o Venezuela explícitamente. Si el filtro estricto deja muy pocas ofertas, la SPEC indica sumar fuentes antes de relajar reglas.

**Get on Board** (medido después, el mismo día): 120 ofertas → 119 únicas, todas `fully_remote` con ubicación "Remote".
- Contrato: 98 full-time, 6 part-time, 15 freelance (el filtro las descarta).
- Nivel: 7 junior, 45 semi-senior, 65 senior, 1 sin experiencia y 1 experto. El nivel viene como dato estructurado en `raw.seniority`, más fiable que buscar palabras clave.
- 73 de 119 publican salario, mensual en USD.
- Idioma: 58 en inglés, 23 en español y 38 sin especificar.
- Ninguna coincide con ofertas de las otras fuentes.
- Para la fase 2: al ser una bolsa de Latinoamérica, "Remote" en Get on Board probablemente significa abierto a LATAM. Conviene tratarla distinto de un "Remote" sin contexto de Remote OK.

**Otros datos**
- Remote OK no informa el tipo de contrato (`contract_type` queda `null`). El filtro de contrato debe tratar el valor desconocido como "pasa".
- Remote OK publica algunos salarios absurdos (por ejemplo, "10000/año" para una oferta pagada "por tarea"). La señal de pago debe tolerarlos.
- Remote OK entrega parte del texto con la codificación rota y parte del HTML escapado dos veces. `lib/text.js` ya lo corrige.
