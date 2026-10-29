# TERMINAL

Aventura conversacional de ciencia ficción con estética de monitor de fósforo verde de los años 80. Se juega en la pantalla del móvil: el texto se teclea carácter a carácter con un pitido por letra y las decisiones son botones retro.

- 100 % estático: HTML + CSS + JavaScript vanilla con módulos ES. Cero dependencias en runtime, sin backend, sin peticiones externas (funciona offline como PWA).
- Rutas relativas siempre, para servirlo bajo una subruta de GitHub Pages.
- Una partida = una URL (`#/play/<historia>/<sesión>`). Abrir la misma URL restaura el estado.

En vivo: https://elizechea.github.io/flower/

> El repositorio se llama `flower` (elizechea/flower); el producto se llama TERMINAL.

## Inicio rápido

```sh
npm install        # solo dependencias de desarrollo (Playwright)
npm run dev        # python3 -m http.server 8080
```

Abre http://localhost:8080.

## Tests

| Comando | Qué hace |
| --- | --- |
| `npm test` | Unitarios (`node --test`) + validación de historias |
| `npm run test:e2e` | Playwright (móvil 390x844); levanta su propio servidor en la subruta `/terminal/` |
| `npm run validate` | Valida `stories/*.json` y `stories/index.json` |

Requiere Node >= 20. Los E2E necesitan los navegadores de Playwright (`npx playwright install chromium`).

## Controles

- Tocar la pantalla (o Espacio / Enter): completa al instante el texto que se está tecleando.
- Pulsar una opción, o las teclas `1`–`4`: elegir la opción correspondiente.
- `Esc` o el botón de menú: abre/cierra el menú (velocidad de texto, sonido, otras historias, reiniciar).

## Estructura

```
index.html, manifest.webmanifest, sw.js   PWA y service worker
css/            base.css (layout, variables) y crt.css (scanlines, glow, flicker)
fonts/          VT323 autoalojada (+ OFL.txt)
icons/          iconos de la PWA
js/main.js      arranque, router y cableado
js/router.js    parseo/generación de hash
js/engine/      motor puro (engine.js), condiciones (conditions.js) y validador (validate.js)
js/session/     sesiones y persistencia (session.js, storage.js)
js/ui/          terminal, typewriter, menú y vistas
js/audio/       sintetizador de pitidos (Web Audio)
js/net/         Transport + LocalTransport (hueco para multijugador)
js/i18n/es.js   textos de la interfaz
stories/        index.json, SCHEMA.md y una historia por fichero
tools/          validate-stories.mjs, build-index.mjs, serve.mjs, make-icons.mjs
tests/          unit/*.test.mjs, e2e/*.spec.mjs y fixtures
```

## Escribir una historia nueva

Una historia es un grafo de nodos en `stories/<id>.json`. Resumen (referencia completa en [stories/SCHEMA.md](stories/SCHEMA.md)):

```jsonc
{
  "schemaVersion": 1,
  "id": "mi-historia",            // = nombre del fichero sin .json, [a-z0-9-]
  "version": 1,
  "title": "MI HISTORIA",
  "tagline": "Una frase gancho.",
  "difficulty": 2,                // 1-3
  "estimatedMinutes": 8,
  "players": { "min": 1, "max": 1 },
  "start": "inicio",
  "vars": { "energia": 3 },
  "nodes": {
    "inicio": {
      "text": ["Párrafo 1.", "Párrafo 2 con {energia}."],
      "options": [{ "id": "a", "label": "Continuar", "to": "fin", "effects": [{ "dec": "energia" }] }]
    },
    "fin": { "text": "Fin.", "ending": { "type": "good", "title": "FINAL" } }
  }
}
```

Pasos:

1. Crea `stories/<id>.json` (máx. 4 opciones por nodo, etiquetas de hasta 48 caracteres; los nodos con `ending` no llevan opciones).
2. `npm run validate`: comprueba esquema, destinos, alcanzabilidad de finales y ausencia de trampas.
3. `node tools/build-index.mjs`: regenera `stories/index.json`.
4. Si cambias el grafo de una historia ya publicada, sube su `version`. Al cargar una partida guardada se intenta reproducir su log con la historia actual; solo si falla se avisa y se ofrece reiniciar. Repite validate y build-index.
5. Si añades ficheros a `js/`, añádelos también a `SHELL` en `sw.js` (un test lo exige) y sube `VERSION` en `sw.js` para refrescar la caché de los usuarios.

## Despliegue en GitHub Pages

1. En el repositorio: Settings → Pages → Source: **GitHub Actions**.
2. El workflow `.github/workflows/pages.yml` ejecuta unit + validate + e2e y despliega en cada push a `main`.
3. El resultado queda en https://elizechea.github.io/flower/.

## Licencias

La fuente VT323 está bajo SIL Open Font License 1.1 (`fonts/OFL.txt`). Solo se incluye el subset latin, que cubre el español.

Decisiones de diseño y plan de multijugador: [DECISIONS.md](DECISIONS.md).
