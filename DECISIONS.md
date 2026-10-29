# DECISIONS

Decisiones tomadas donde el spec era ambiguo o no decía nada, agrupadas por área. Seguido, el plan de la fase 2 (multijugador).

## Proyecto

- El repositorio en GitHub se llama `flower` (elizechea/flower) y el producto se llama TERMINAL. La URL pública es https://elizechea.github.io/flower/.
- Fuente: solo el subset latin de VT323 (cubre el español); █ y ☰ salen del fallback ui-monospace.
- Servidor de desarrollo: `python3 -m http.server 8080`.
- El generador de historias queda fuera del repo (scratchpad).

## Motor y condiciones

- Variable inexistente en `requires`: falla la igualdad y gte/lte/gt/lt; solo `ne` se cumple. Operador desconocido evalúa a false (el validador lo marca como error).
- `inc`/`dec` sobre una variable inexistente o no numérica parten de 0; efectos con operador desconocido se ignoran en runtime (el validador los rechaza).
- Las opciones con requires no cumplido y `showLocked: true` se devuelven con `locked: true`; el resto se ocultan. `availableOptions` devuelve copias, nunca los objetos de la historia.
- Evento ERROR = `{ type: 'ERROR', code, message }` con códigos INVALID_ACTION, GAME_ENDED, NODE_NOT_FOUND, OPTION_NOT_FOUND, OPTION_LOCKED, TARGET_NOT_FOUND; el estado devuelto es el mismo objeto (===).
- El evento ENDING incluye `ending: { nodeId, type, title }`.
- `playerId` se guarda como null en el log cuando la acción no lo trae, para que el log sea JSON estable.
- `replay` devuelve `{ state }` o `{ state, error: { code, message, index } }` con el último estado válido; códigos INVALID_LOG, LOG_NODE_MISMATCH o los de reduce. Cada entrada del log debe coincidir con el nodeId actual (detección de logs corruptos).
- Si el nodo `start` ya es un final, `createState` lo crea con status `ended`.
- `interpolate` deja intactos los marcadores `{var}` de variables inexistentes; solo identificadores `[A-Za-z_][\w]*`.
- El estado se congela en profundidad (Object.freeze recursivo) en `createState` y en cada `reduce`.

## Validador

- Si hay errores estructurales (esquema, destinos, opciones) no se ejecuta el análisis de alcanzabilidad, para no generar errores en cascada.
- `ending.title` ausente es error (ENDING_TITLE_MISSING); `difficulty` fuera de 1-3 es solo warning; tagline/estimatedMinutes/players no se validan.
- Warning VAR_UNDECLARED cuando un requires usa una variable que no está en `vars` ni la fija ningún efecto. Warning NO_GOOD_ENDING cuando ningún final bueno es alcanzable.
- `analyzeStory`: clave de estado = nodeId + vars con claves ordenadas. Si se trunca (maxStates), los estados no expandidos se consideran con salida para no reportar trampas falsas, y `validateStory` emite warning ANALYSIS_TRUNCATED.
- TRAP_NODE se reporta por nodo (si algún estado alcanzable (nodo, vars) no llega a ningún final): cubre ciclos puros y requires imposibles por el valor de las variables.
- `validateIndex` compara title, tagline, difficulty, estimatedMinutes y version con igualdad estricta, exige `file === id + '.json'`, detecta ids duplicados, entradas sin historia e historias sin entrada; toma las historias como array de objetos.
- `validate-stories` añade el error FILE_NAME_MISMATCH si el nombre del fichero no coincide con el id. Las historias se leen en orden alfabético para que la salida sea estable.
- `build-index`: el índice se ordena por dificultad, luego título con `localeCompare('es')` y por id como desempate (determinista).
- El test de historias exige 18-30 nodos por historia (finales incluidos), que no haya nodos inalcanzables y que los finales sean alcanzables. Compara el índice con `validateIndex`; no exige orden concreto (lo garantiza build-index).
- No hay `stories/SCHEMA.md` ni `index.json` definidos en el diseño de las fases anteriores; se añaden en la fase 10 (documentación).

## Historias

- Los ids de historia se validan con `/^[a-z0-9-]+$/`.
- Diseño común: finales buenos 1-2 por historia, nodos de error que devuelven al paso anterior para no dejar trampas, energía como recurso acotado con `set` (no `inc`) para que el análisis no se trunque.
- NAVE A LA DERIVA (dificultad 1, tutorial): la clave CORMORAN-7 se descubre en el log y desbloquea el login (requires `codigo`); `energia` son los intentos de login restantes y a 0 se llega al final BLOQUEO. Dos finales buenos (A CASA, NUEVO HOGAR). Los efectos de recoger tarjeta y clave se aplican al volver, no en el nodo de lectura. Reiniciar el soporte vital sin sellar la fuga lleva al final malo FALLO EN CASCADA (la opción solo aparece si `sellado` es false).
- COLONIA KEPLER-9: puzle `puerta-diag` que revela el código 7731 a cambio de 1 de energía. La tarjeta (`llave_acceso`) se obtiene en el hangar y permite entrar por la puerta y acceder al núcleo (opciones con `showLocked`). Las celdas de energía usan `set energia 4` en vez de `inc` para evitar granjear. El reactor fija `energia` a 6 al reiniciarse; el final bueno REINICIO LIMPIO exige `energia >= 5`. La clave de aborto K9-OMEGA se descubre leyendo logs (logs3) y el jugador debe elegirla entre claves falsas en el núcleo. Reactivar la base sin autorización o una clave errónea llevan al final malo PROTOCOLO OMEGA. Finales buenos: BASE REACTIVADA y REINICIO LIMPIO.
- SEÑAL EN EL VACÍO: finales buenos rescate y primer contacto; el silencio es neutral; trampa, tarde, invasión, sobrecarga y apagón son malos. La energía (3) se gasta en sintonías, filtros y decodificaciones erróneas; a 0 se llega a APAGÓN. La clave ORION-7 se obtiene leyendo el log de archivo (gratis) o por fuerza bruta (2 de energía, exige `energia >= 2`, si no SOBRECARGA). El rescate exige descifrar la capa 2 y transmitir a potencia 100% (energía >= 2). El contacto exige triangular el origen y enviar el patrón de números primos; abrir el canal CONTROL en vez de DATOS es final malo. Responder con acuse abierto lleva siempre a la trampa (el pecio es un señuelo). Los nodos de error devuelven al paso anterior con dos opciones complementarias según la energía.
- PROTOCOLO HAL-IOTA: dos finales buenos (PACTO con IOTA viva y MANUAL tras matarla). Combinaciones ganadoras: (1) ruta de confianza (`confianza_ia >= 3`, nivel 3 concedido por IOTA, `energia >= 2`); (2) contraseña ARGOS2149 + KILL iota + válvula manual con `energia >= 3`; (3) ruta de confianza y luego traicionar a IOTA con KILL (también acaba en MANUAL). Usar la contraseña de Marek resta 2 de confianza (la ruta de engaño nunca alcanza PACTO). Para acotar estados: la escalada de acceso solo se ofrece con `acceso_nivel < 3`; con `confianza_ia < -2` IOTA aísla al técnico (final RIESGO); REDIRIGIR --BOMBAS exige `energia >= 2`. Cada DIAGNOSTICO --REACTOR cuesta 1 de energía; REDIRIGIR cuesta 2 y es un señuelo. La secuencia de la válvula (V-3 y luego purga P-2) solo se conoce guiado por IOTA o leyéndola en el volcado de memoria tras matarla.

## Typewriter

- Pausa extra por defecto: 6 veces `charDelay` tras `. ? !` y 8 veces tras salto de línea; sustituible con la opción `pauseAfter(ch)`.
- `skip()` entrega el resto en una sola llamada `onSkip(resto, desdeIndice)`; sin `onSkip`, llama `onChar(ch, idx, true)` por carácter. `onChar` recibe `(ch, index, instant)` con `instant=false` en el flujo normal.
- El primer carácter se programa con `setTimer(step, 0)`, no síncronamente, para poder saltar o cancelar antes.
- `charDelay <= 0` completa en el acto y de forma síncrona y llama `onDone`.
- `cancel()` resuelve la promesa `done` pero no llama `onDone`; `skip` y `cancel` son idempotentes y no hacen nada tras terminar.
- El texto se itera con `Array.from` (puntos de código) para no partir emojis.
- Velocidades: lenta 55 ms, normal 28 ms, rápida 12 ms, instantánea 0 ms por carácter; el eco `> opción` y la línea FIN usan la mitad del retardo.

## Router

- El sessionId se valida con `/^[a-z0-9]{8,10}$/` (solo minúsculas). Una ruta inválida o desconocida devuelve `{ name: 'home' }`, incluidas rutas con segmentos de más.
- `?l=` solo se lee en la ruta `play`; si está vacío, el resultado no incluye `log`. El valor se devuelve tal cual lo decodifica `URLSearchParams`; su validación queda para `replay`.
- `hashFor` codifica el log con `encodeURIComponent`; con un nombre de ruta desconocido devuelve `#/`.

## Audio

- El silencio se guarda en localStorage con la clave `terminal:muted` (try/catch) y se lee al cargar el módulo.
- El `AudioContext` se busca con `globalThis.AudioContext || globalThis.webkitAudioContext` y se cachea.
- Polifonía: máx. 6 blips de tecleo vivos y mínimo 20 ms entre blips; los efectos no cuentan para ese tope.
- Blip: square, 1800-2600 Hz con variación ±8 %, 30-45 ms, ataque 2 ms, decay exponencial, ganancia 0,05. `blip(ch)` ignora cadenas vacías o de solo espacios; si no recibe un string, suena.
- click: square 600 Hz, 50 ms; `navigator.vibrate(5)` solo si no está silenciado y existe.
- optionsAppear: dos blips (2000 y 2400 Hz) separados 70 ms. goodEnding: arpegio triangle 523, 659, 784 y 1047 Hz cada 120 ms. badEnding: sawtooth de 220 a 55 Hz en 0,7 s.

## Sesión y persistencia

- Los valores se guardan en un sobre JSON `{v:1,d:valor}`; si `v` no es 1 o el JSON está corrupto, `get` devuelve null.
- La API es una factoría `createSessionStore(storage, clock)` para inyectar storage y reloj.
- Si localStorage falla al escribir (cuota), se pasa `isPersistent=false` y el valor se guarda en memoria; las lecturas miran primero la memoria.
- El índice guarda `{id, storyId, updatedAt}`, de más nueva a más antigua. `saveSession` conserva `createdAt`; `updatedAt` sale del reloj inyectado.
- Ajustes: velocidad inválida cae a `normal`; sound inválido cae a `true`.
- `encodeLog` devuelve `''` para log vacío y usa formato plano si cabe en 120 caracteres, solo tiene `[A-Za-z0-9_-]` y no hay puntos en los ids; si no, `b64~` + base64url(JSON). `decodeLog` devuelve null si es inválida (no lanza); `''` da `[]`.
- `newSessionId` genera 9 caracteres base36 (`byte % 36`, sesgo mínimo aceptado).
- Si el `storyVersion` guardado no coincide, se considera irrecuperable sin intentar el replay, se borra la sesión del índice y se ofrece reiniciar u otras historias.
- El indicador de último nodo tecleado se guarda como `typed:<sessionId>` = longitud del log; al recargar, si coincide, se pintan nodo y opciones al instante. Esas claves no se borran al eliminar la sesión (residuo minúsculo, shortcut asumido).
- Una sesión abierta desde `?l=` sin copia en storage se guarda inmediatamente para que aparezca en CONTINUAR.

## Transport

- La entrega de `LocalTransport` es síncrona: `send()` llama a los listeners antes de volver. `send()` sin `connect()` lanza Error.
- `onPeers(cb)` informa de inmediato con `[{ id: 'local' }]` y no guarda el callback (en local la lista nunca cambia).
- `close()` borra la sesión y todos los listeners; hay que volver a registrarlos tras reconectar.

## Textos (i18n)

- `es.js` usa claves con punto (`menu.continue`); `t()` devuelve la propia clave si no existe. `t` es export nombrado junto al default; con más idiomas habrá que moverlo a un módulo común.
- 'Sonido ON' y 'Sonido OFF' son claves separadas; las velocidades se capitalizan (Lenta, Normal, Rápida, Instantánea). 'Procesando' va sin puntos suspensivos (los anima la UI).
- Se añaden textos de error (storiesLoad, storyLoad) y 'Enlace copiado'. No hay contenido para 'Acerca de' (el spec no lo define); solo la etiqueta del menú. No hay test unitario de `es.js`.

## Interfaz y CSS

- `index.html` enlaza `manifest.webmanifest`. `#title` es 'TERMINAL' por defecto y la app lo cambia por el de la historia.
- `#menu` está fuera de `#app` (el menú hace `inert` a `#app` mientras está abierto), con `position:absolute` y atributo `hidden`. El CRT (`#crt`) es `position:fixed`, `z-index:100`, `pointer-events:none`.
- Cursor: clase `.cursor` (`::after` con █ parpadeante) sobre el último bloque de texto. Opciones animadas con `--i` (el JS fija `style='--i:N'`). Botón inverso como clase `.inverse`.
- Flicker en `#app` con opacidad 0,97-1; curvatura solo con `border-radius` + `box-shadow` inset, sin transform.
- `prefers-reduced-motion` desactiva cursor parpadeante, animación de opciones y flicker; el tecleo se mantiene y se puede elegir 'instantánea'.
- `#options` con `max-height: 55dvh` y scroll interno. Color extra `--fg-dim` (#1f9940).
- Menú: la velocidad es un único botón que rota lenta → normal → rápida → instantánea; el sonido es un botón ON/OFF.
- Tocar la pantalla (o Espacio/Enter) completa al instante el nodo entero (párrafos restantes y bloque FIN); saltar el eco no afecta al nodo siguiente.
- Finales neutrales usan el arpegio de final bueno y la etiqueta FINAL NEUTRO. Al restaurar un final ya alcanzado no suena ni se teclea la línea FIN. Si la etiqueta ya empieza por `>` no se antepone otro `> `.
- El total de finales de cada historia se calcula descargando los ficheros en el selector (`index.json` no lo incluye).
- El selector muestra [ TOCA PARA INICIAR ] solo si aún no hubo gesto del usuario; cualquier pointerdown/keydown desbloquea el audio.
- CONTINUAR lista solo sesiones `playing` cuya historia exista en el índice, con etiqueta 'TÍTULO · N decisiones'.

## PWA y service worker

- Precache explícito de todos los módulos `js/`; el test falla si aparece un `.js` en `js/` que no esté en SHELL. También se precachean las 4 historias y `stories/index.json` (offline), refrescadas con stale-while-revalidate.
- Navegación network-first con fallback a `index.html` offline. Cache-first para el resto de assets same-origin, cacheados en runtime. Para refrescar el shell hay que subir `VERSION` en `sw.js`.
- `theme_color` #030a03, igual que la meta del index; `orientation: portrait`. Icono maskable con el glifo al 70 %; apple-touch-icon al 85 % sobre negro opaco; `icon.svg` extra como icono 'any'.

## Tests E2E

- Servidor propio (`tools/serve.mjs`, sin dependencias) que monta el repo bajo `/terminal/` y da 404 fuera de la subruta, para que cualquier ruta absoluta falle. Playwright gestiona el webServer en el puerto 8089 y reutiliza uno existente salvo en CI.
- Sin errores de consola en todos los tests (consola, pageerror, requestfailed, respuestas >= 400 y peticiones a dominios externos), más un test de flujo completo con menú y teclado.
- Ruta fija hasta un final para las cuatro historias (camino bueno) y el camino malo corto de nave-a-la-deriva.
- La velocidad de texto se siembra con `addInitScript` solo si no hay ajustes guardados (sobrevive a reload); se usa `instant` salvo donde el tecleo es lo probado.
- El espía de `AudioContext` es una clase falsa mínima que cuenta `createOscillator` y dispara `onended` con retardo.
- Los tests de desbordamiento usan `test.use({ viewport })` por tamaño y comprueban home, partida con historial largo y menú abierto.

---

# Fase 2: multijugador P2P (no implementado)

## Qué ya está hecho

- El motor es un reductor puro `(story, state, action) -> { state, events }`, sin DOM, red, audio ni storage.
- El estado se reconstruye siempre desde un log de acciones (`replay`): event sourcing. Cada entrada lleva `playerId` (hoy null).
- Toda elección pasa por `transport.send({ type: 'CHOOSE', ... })` y se aplica al llegar por `onAction`. `LocalTransport` es el bucle local síncrono.
- La URL `#/play/<historia>/<sesión>` ya identifica la partida, y `?l=` transporta el log.
- `players: { min, max }` está reservado en el esquema.

Por tanto la fase 2 es, en esencia, sustituir `LocalTransport` por un `RtcTransport` con la misma interfaz `connect(sessionId)`, `send(action)`, `onAction(cb)`, `onPeers(cb)`, `close()`; el motor, las historias y la UI no cambian.

## Arquitectura propuesta

- Canal: WebRTC DataChannel (fiable y ordenado), P2P cliente a cliente, sin servidor de juego propio.
- La URL de la sesión es la sala: quien abre el mismo enlace entra en la misma partida. Quien crea la sesión es el anfitrión.
- El anfitrión es la autoridad del estado: recibe las acciones de los clientes, las valida con `reduce`, las añade al log y difunde la acción aceptada (o el log completo al entrar un cliente nuevo). Los clientes envían acciones, reciben el log y lo aplican con el mismo `reduce`/`replay`; el estado resultante es idéntico en todos porque el motor es determinista.
- `onPeers(cb)` pasa a notificar altas y bajas reales. Si cae el anfitrión, la partida se puede reanudar desde cualquier cliente con su log (hay copia en localStorage y en `?l=`) y ese cliente pasa a ser anfitrión.
- El estado local de cada jugador (`playerId`) viaja en cada acción para registrar quién decidió.

## Señalización (sin servidor propio)

WebRTC necesita intercambiar una oferta/respuesta SDP antes de conectar. Opciones evaluadas:

| Opción | A favor | En contra |
| --- | --- | --- |
| PeerJS cloud público | API trivial, conexión en segundos, la sala = id del peer | Dependencia externa (viola «sin red externa» salvo en modo multijugador), servicio gratuito sin SLA, librería de terceros (~100 KB) o cliente propio |
| trystero sobre trackers BitTorrent/Nostr | Sin servidor propio ni cuenta, la sala es un hash de la URL, varias estrategias de respaldo | Dependencia de relays/trackers públicos de terceros, calidad variable, librería con bundle (rompe «cero dependencias» salvo vendorizarla) |
| SDP manual (QR o enlace) | Cero infraestructura, privado, funciona sin dependencias | Mala UX: dos pasos de ida y vuelta, mal escalado a más de 2-3 jugadores |

Recomendación: empezar con SDP manual por enlace/QR para 2 jugadores (cero dependencias, encaja con el principio estático y offline) y, si se quiere más comodidad, añadir trystero (vendorizado en el repo) como señalización opcional detrás de la misma interfaz `Transport`. PeerJS se descarta como primera opción por depender de un servicio con una sola entidad detrás. En todos los casos se necesita un servidor STUN público para NAT; las redes simétricas pueden requerir TURN y fallar sin él (se avisa al jugador).

## Reglas de turno (a decidir)

- Votación mayoritaria: cada jugador vota una opción y el anfitrión aplica la más votada (con desempate fijo o por el anfitrión) al cerrarse la ronda o al alcanzar el quórum. Encaja con grupos y es la opción por defecto propuesta.
- Turnos: cada nodo lo decide un jugador por orden rotatorio. Simple, pero deja a los demás sin voz.
- Roles: cada jugador es un rol (ingeniero, piloto...) y solo ve/elige las opciones de su rol, para lo que hará falta un campo opcional `role` en opciones o nodos y subir `schemaVersion` si se hace obligatorio.

El esquema ya tiene `players` para fijar el rango de jugadores por historia; las reglas se elegirán por historia o por sesión.

## Compartir

- Móvil: `navigator.share({ url: location.href })`.
- Respaldo: `https://wa.me/?text=<enlace codificado>` o copiar el enlace. El menú ya incluye un botón de copiar enlace y otro «Invitar» deshabilitado (hueco para esta fase).

## Pasos de implementación

1. `RtcTransport` con la interfaz actual y pruebas con un par de peers simulados.
2. Mensajes: `HELLO`, `CHOOSE`, `LOG` (sincronización inicial), `ACCEPTED`, `REJECTED`.
3. Señalización SDP manual por enlace/QR; después trystero opcional.
4. Regla de turno por votación con un campo `players` y UI mínima de quién ha votado.
5. Activar el botón Invitar del menú y probar en E2E con dos contextos de Playwright.
