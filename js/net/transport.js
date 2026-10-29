// Transporte de acciones (§10). El jugador envía SIEMPRE sus elecciones con send()
// y las aplica al llegar por onAction, aunque en modo un jugador sea inmediato.

/**
 * Acción de juego, p. ej. `{ type: "CHOOSE", optionId: "buscar", playerId: "local" }`.
 * @typedef {{ type: string, [key: string]: unknown }} Action
 */

/**
 * Jugador conectado a la sesión.
 * @typedef {{ id: string }} Peer
 */

/**
 * Interfaz de transporte. LocalTransport la implementa en el modo un jugador;
 * en fase 2 la implementará WebRTC (ver DECISIONS.md).
 * @typedef {object} Transport
 * @property {(sessionId: string) => void} connect Abre la sesión (su URL es la sala).
 * @property {(action: Action) => void} send Envía una acción; se entrega a los listeners de onAction.
 * @property {(cb: (action: Action) => void) => void} onAction Registra un listener de acciones.
 * @property {(cb: (peers: Peer[]) => void) => void} onPeers Registra un listener de jugadores.
 * @property {() => void} close Cierra la sesión y elimina los listeners.
 */

/**
 * Bucle local: las acciones se entregan de forma síncrona a los listeners.
 * @implements {Transport}
 */
export class LocalTransport {
  /** @type {string | null} */
  #sessionId = null;
  /** @type {Array<(action: Action) => void>} */
  #actionListeners = [];

  /** @param {string} sessionId */
  connect(sessionId) {
    this.#sessionId = sessionId;
  }

  /** @param {Action} action */
  send(action) {
    // Sin sesión abierta la acción se perdería en silencio: mejor fallar.
    if (this.#sessionId === null) throw new Error('LocalTransport: send() antes de connect()');
    for (const cb of this.#actionListeners) cb(action);
  }

  /** @param {(action: Action) => void} cb */
  onAction(cb) {
    this.#actionListeners.push(cb);
  }

  /** @param {(peers: Peer[]) => void} cb Solo hay un jugador: el local, informado una vez. */
  onPeers(cb) {
    cb([{ id: 'local' }]);
  }

  close() {
    this.#sessionId = null;
    this.#actionListeners = [];
  }
}
