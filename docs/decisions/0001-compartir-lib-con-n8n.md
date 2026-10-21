# 0001 — Cómo compartir `lib/` con los Code nodes de n8n

- **Estado:** aceptada
- **Fecha:** 2026-10-20
- **Fase:** 0

## Contexto

La SPEC pide que la lógica de normalización, fingerprint, filtros y puntuación viva en funciones puras con pruebas (`lib/`) y que esa misma lógica la usen los workflows de n8n. Por defecto, los Code nodes de n8n 2.x corren en un *task runner* que bloquea cualquier `require` que no esté habilitado.

## Alternativas

1. **Montar `lib/` en el contenedor y habilitar la ruta exacta** con `NODE_FUNCTION_ALLOW_EXTERNAL`. Una sola copia del código; los nodos hacen `require('/opt/radar/lib/index.js')`.
2. **Copiar el código dentro de cada Code node** con un script que lo incruste en el JSON del workflow. No depende de variables de entorno, pero hay dos copias que se pueden desincronizar y los nodos quedan ilegibles en la interfaz.
3. **Publicar `lib/` como paquete npm** e instalarlo en una imagen propia de n8n. Más ceremonia (imagen personalizada, versionado) sin beneficio para la v1.

## Prueba realizada (n8n 2.44.4)

| Configuración | Resultado |
|---|---|
| Sin habilitar nada | `Module '/opt/radar/lib/probe.cjs' is disallowed` |
| `NODE_FUNCTION_ALLOW_EXTERNAL=*` | Funciona con CommonJS y con ESM |
| `NODE_FUNCTION_ALLOW_EXTERNAL=/opt/radar/lib` (carpeta) | Bloqueado: compara la ruta exacta, no prefijos |
| `NODE_FUNCTION_ALLOW_EXTERNAL=/opt/radar/lib/probe.cjs` (archivo) | Funciona |
| Módulo habilitado que usa `node:crypto` internamente | Funciona sin habilitar `crypto`: el filtro solo aplica al `require` del Code node |

## Decisión

Opción 1, con un **único punto de entrada**:

- `docker-compose.yml` monta `./lib` en `/opt/radar/lib` (solo lectura) y define `NODE_FUNCTION_ALLOW_EXTERNAL=/opt/radar/lib/index.js`.
- `lib/index.js` reexporta todas las funciones. Es ESM (`lib/package.json` con `"type": "module"`); n8n lo carga con `require` gracias al soporte de `require(esm)` de Node.
- En un Code node: `const { normalize } = require('/opt/radar/lib/index.js');`
- La prueba `lib/__tests__/index.test.js` verifica que `index.js` se pueda cargar con `require`.

## Consecuencias

- Habilitar solo un archivo es más seguro que `*`: ningún otro módulo queda disponible para los Code nodes.
- Los módulos quedan en caché dentro del runner: después de cambiar `lib/` hay que reiniciar n8n (`docker compose restart n8n`) para que tome el código nuevo.
- Si se agrega otro archivo de entrada, hay que sumarlo a `NODE_FUNCTION_ALLOW_EXTERNAL` (separado por comas). La convención es no hacerlo y reexportar desde `index.js`.
- Si en el futuro se usan runners externos (imagen `n8nio/runners`), el montaje y la variable pasan a ese contenedor.
