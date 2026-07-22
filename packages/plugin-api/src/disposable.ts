/**
 * Every registration returns a Disposable. Disposing undoes the registration;
 * the runtime disposes everything a plugin registered when it unloads, so a
 * well-behaved plugin can simply keep its disposables and let go.
 */

export interface Disposable {
  dispose(): void;
}
