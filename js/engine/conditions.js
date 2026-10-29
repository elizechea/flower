// Evaluador puro de `requires` y `effects` de las historias (ver stories/SCHEMA.md).

const OPS = {
  gte: (a, b) => a >= b,
  lte: (a, b) => a <= b,
  gt: (a, b) => a > b,
  lt: (a, b) => a < b,
  ne: (a, b) => a !== b,
};

export const CONDITION_OPS = Object.keys(OPS);
export const EFFECT_OPS = ['set', 'inc', 'dec'];

/**
 * ¿Se cumplen todas las condiciones sobre `vars`?
 * `requires` es `{ var: valor }` (igualdad estricta) o `{ var: { gte|lte|gt|lt|ne: n } }`
 * (todos los operadores del objeto deben cumplirse). Sin `requires` → true.
 * Variable inexistente: falla la igualdad y las comparaciones numéricas; solo `ne` se cumple.
 * Operador desconocido → false (el validador lo señala como error).
 * @param {object|undefined} requires
 * @param {object} vars
 * @returns {boolean}
 */
export function checkRequires(requires, vars = {}) {
  if (!requires) return true;
  return Object.entries(requires).every(([name, cond]) => {
    const value = vars[name];
    if (cond !== null && typeof cond === 'object') {
      return Object.entries(cond).every(([op, expected]) => (op in OPS ? OPS[op](value, expected) : false));
    }
    return value === cond;
  });
}

/**
 * Aplica en orden una lista de efectos y devuelve un objeto NUEVO (no muta `vars`).
 * Efectos: `{ set: var, value }`, `{ inc: var, by? }`, `{ dec: var, by? }` (`by` por defecto 1).
 * `inc`/`dec` sobre una variable inexistente o no numérica parten de 0. Efectos desconocidos se ignoran.
 * @param {Array<object>|undefined} effects
 * @param {object} vars
 * @returns {object}
 */
export function applyEffects(effects, vars = {}) {
  const next = { ...vars };
  const num = (k) => (typeof next[k] === 'number' ? next[k] : 0);
  for (const e of effects || []) {
    if ('set' in e) next[e.set] = e.value;
    else if ('inc' in e) next[e.inc] = num(e.inc) + (e.by ?? 1);
    else if ('dec' in e) next[e.dec] = num(e.dec) - (e.by ?? 1);
  }
  return next;
}
