# Esquema de historias (schemaVersion 1)

Cada historia es un fichero `stories/<id>.json`: un grafo de nodos. El motor (`js/engine/engine.js`) es un reductor puro; el validador (`js/engine/validate.js`) comprueba todo lo de este documento.

## Raíz

| Campo | Tipo | Obligatorio | Regla |
| --- | --- | --- | --- |
| `schemaVersion` | número | sí | Debe ser `1`. |
| `id` | string | sí | Solo `[a-z0-9-]`. Igual al nombre del fichero sin `.json`. |
| `version` | entero | sí | >= 1. Súbelo cuando cambie el grafo: una partida guardada con otra versión no se recupera. |
| `title` | string | sí | No vacío. |
| `tagline` | string | no | Frase gancho. Aparece en el catálogo. |
| `difficulty` | 1, 2, 3 | no | Otro valor es solo aviso. |
| `estimatedMinutes` | número | no | Para el catálogo. |
| `players` | `{min, max}` | no | Reservado para multijugador; hoy `{1,1}`. |
| `start` | string | sí | Id de un nodo existente. |
| `vars` | objeto | no | Estado inicial: valores booleanos, numéricos o de texto. |
| `nodes` | objeto | sí | `{ nodeId: nodo }`, al menos uno. |

## Nodo

```jsonc
{ "text": "string o array de párrafos",
  "options": [ ... ],            // nodo normal: 1 a 4 opciones
  "ending": { "type": "bad", "title": "DESCOMPRESIÓN" } }   // nodo final
```

- `text`: string o array de strings (cada elemento es un párrafo).
- Un nodo con `ending` no tiene `options`. Cualquier otro nodo tiene entre 1 y 4.
- `ending.type`: `"good"`, `"bad"` o `"neutral"`. `ending.title` es obligatorio. El neutral suena y se muestra como `FINAL NEUTRO`.
- Si el nodo `start` ya es un final, la partida nace terminada.

## Opción

| Campo | Regla |
| --- | --- |
| `id` | Cadena no vacía, única dentro del nodo (se recomienda `[a-z0-9-]`, es compacto en la URL). Es lo que se guarda en el log y en la URL (`?l=`). No lo cambies en una historia publicada sin subir `version`. |
| `label` | Obligatorio, máx. 48 caracteres. Si empieza por `>` no se antepone otro al eco. |
| `to` | Id de un nodo existente. |
| `requires` | Opcional. Condiciones sobre `vars`. |
| `effects` | Opcional. Lista ordenada de efectos. Se aplican al elegir la opción. |
| `showLocked` | Opcional. Con `true`, si `requires` no se cumple la opción se muestra deshabilitada con `[BLOQUEADO]`; si no, se oculta. |

## requires

Objeto `{ variable: condición }`; deben cumplirse todas.

- Igualdad estricta: `{ "tarjeta": true }`, `{ "codigo": "7731" }`.
- Comparación: `{ "energia": { "gte": 2 } }`. Operadores: `gte`, `lte`, `gt`, `lt`, `ne`. Se pueden combinar: `{ "energia": { "gte": 1, "lte": 3 } }`.
- Variable inexistente: falla la igualdad y las comparaciones numéricas; solo `ne` se cumple.
- Operador desconocido: evalúa a falso y el validador da error `CONDITION_OP_UNKNOWN`.

## effects

Lista ordenada; cada elemento es uno de:

| Efecto | Ejemplo |
| --- | --- |
| `set` | `{ "set": "tarjeta", "value": true }` |
| `inc` | `{ "inc": "puntos", "by": 2 }` (`by` por defecto 1) |
| `dec` | `{ "dec": "energia" }` (`by` por defecto 1) |

`inc`/`dec` sobre una variable inexistente o no numérica parten de 0. Un operador desconocido se ignora en runtime y el validador lo rechaza (`EFFECT_OP_UNKNOWN`).

## Interpolación

En `text` se puede escribir `{variable}`; se sustituye por el valor actual. Solo identificadores `[A-Za-z_][A-Za-z0-9_]*`. Si la variable no existe, el marcador queda tal cual.

## stories/index.json

Catálogo (GitHub Pages no lista directorios). Se genera con `node tools/build-index.mjs`; no lo edites a mano.

```json
{ "schemaVersion": 1, "stories": [
  { "id": "nave-a-la-deriva", "file": "nave-a-la-deriva.json", "title": "...", "tagline": "...",
    "difficulty": 1, "estimatedMinutes": 6, "version": 1 } ] }
```

Orden: dificultad, luego título, luego id. `file` es siempre `<id>.json`. Los campos `title`, `tagline`, `difficulty`, `estimatedMinutes` y `version` deben coincidir con los de la historia.

## Reglas del validador

`npm run validate` (o `validateStory`/`validateIndex` en `js/engine/validate.js`). Devuelve errores (fallan) y avisos.

Estructurales (si hay alguno no se hace el análisis de grafo):

- Raíz: `SCHEMA_VERSION`, `ID_INVALID`, `VERSION_INVALID`, `TITLE_MISSING`, `START_MISSING`, `START_NOT_FOUND`, `NODES_MISSING`, `VARS_INVALID`.
- Nodos: `NODE_INVALID`, `TEXT_INVALID`, `ENDING_TYPE_INVALID`, `ENDING_TITLE_MISSING`, `ENDING_WITH_OPTIONS`, `NODE_WITHOUT_OPTIONS`, `TOO_MANY_OPTIONS` (> 4).
- Opciones: `OPTION_INVALID`, `OPTION_ID_INVALID`, `OPTION_ID_DUPLICATE`, `LABEL_MISSING`, `LABEL_TOO_LONG` (> 48), `TARGET_NOT_FOUND`, `REQUIRES_INVALID`, `CONDITION_OP_UNKNOWN`, `EFFECTS_INVALID`, `EFFECT_OP_UNKNOWN`, `EFFECT_VAR_INVALID`, `EFFECT_VALUE_MISSING`, `EFFECT_BY_INVALID`.
- Además: `NO_ENDING` si la historia no tiene ningún final.

Grafo (explora el espacio de estados nodo + variables respetando `requires` y `effects`):

- `UNREACHABLE_NODE`: nodo al que no se llega desde `start`.
- `UNREACHABLE_ENDING`: final inalcanzable.
- `TRAP_NODE`: existe un estado alcanzable en ese nodo desde el que ya no se puede llegar a ningún final (ciclos sin salida o `requires` imposibles por el valor de las variables).
- Avisos: `NO_GOOD_ENDING` (ningún final bueno alcanzable), `VAR_UNDECLARED` (un `requires` usa una variable que no está en `vars` ni la fija ningún efecto), `DIFFICULTY_INVALID`, `ANALYSIS_TRUNCATED` (más de 200 000 estados: el análisis es parcial; evita `inc` sin tope, usa `set`).

Índice: `INDEX_INVALID`, `INDEX_ENTRY_INVALID`, `INDEX_ID_DUPLICATE`, `INDEX_FILE_MISMATCH`, `INDEX_STORY_NOT_FOUND`, `INDEX_FIELD_MISMATCH`, `INDEX_ENTRY_MISSING`. El CLI añade `FILE_NAME_MISMATCH` si el fichero no se llama como el `id`.

Límites adicionales exigidos por `tests/unit/stories.test.mjs` a las historias del repo: entre 18 y 30 nodos (finales incluidos), sin nodos inalcanzables y con finales alcanzables.
