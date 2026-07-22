/**
 * Plugin manifest (`manifest.json` in `.eden/plugins/<id>/`), SPEC §9.1.
 */

export interface PluginManifest {
  /** Unique plugin id, reverse-domain style, e.g. "lablooms.screenplay-mode". */
  id: string;
  /** Human-readable name shown in the Plugins tab. */
  name: string;
  /** Semver version string. */
  version: string;
  /** Minimum Edenwright version required, semver. */
  minAppVersion: string;
  description: string;
  author: string;
  authorUrl?: string;
  fundingUrl?: string;
}
