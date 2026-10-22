# Hallazgos sobre los datos

Mediciones con datos reales que condicionan las fases siguientes. Cada entrada indica la fecha y qué fase la usa.

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
