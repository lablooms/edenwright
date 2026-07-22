/**
 * Stable ID generation for files and entities (SPEC §6.1). IDs live in
 * frontmatter and never change on rename, so links can ripple by ID.
 * Uses the platform CSPRNG via the `crypto` global — available in every
 * supported runtime (Node ≥ 22, Electron, modern browsers), no imports needed.
 */

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * The CSPRNG capability core needs, declared structurally: every supported
 * runtime (Node ≥ 22, Electron, modern browsers) exposes it as the `crypto`
 * global, and core stays free of DOM/Node type dependencies.
 */
interface CryptoLike {
  getRandomValues(array: Uint32Array): Uint32Array;
}

function cryptoApi(): CryptoLike {
  const api = (globalThis as { crypto?: CryptoLike }).crypto;
  if (!api) {
    throw new Error(
      "No secure random source: this runtime lacks globalThis.crypto",
    );
  }
  return api;
}

function randomChars(length: number): string {
  const values = new Uint32Array(length);
  cryptoApi().getRandomValues(values);
  let result = "";
  for (const value of values) {
    result += ID_ALPHABET[value % ID_ALPHABET.length];
  }
  return result;
}

/**
 * New ID with a kind prefix, e.g. `newId("scn")` → `scn_8f3k2p1a`.
 * Prefixes in use: scn (scene), ent (entity), nod (graph node), prj, wld.
 */
export function newId(prefix: string, length = 8): string {
  return `${prefix}_${randomChars(length)}`;
}
