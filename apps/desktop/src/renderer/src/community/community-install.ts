import { validatePluginManifest } from "@edenwright/plugin-api";

import { fetchAssetText, type RegistryEntry } from "./registry-client";

/**
 * Read one payload file for a registry entry — from the app bundle for
 * first-party seeds (offline by construction), from release assets for
 * third-party entries (SPEC v2 §7).
 */
export async function readEntryAsset(
  entry: RegistryEntry,
  fileName: string,
): Promise<string> {
  if (entry.bundled) {
    return window.edenwright.app.readBundled(`${entry.bundled}/${fileName}`);
  }
  return fetchAssetText(entry, fileName);
}

/** Downloaded plugin payload, validated and ready to write into the eden. */
export interface DownloadedPlugin {
  id: string;
  manifestText: string;
  mainJs: string;
  stylesCss: string | null;
}

/** Download and validate a plugin's payload (SPEC §7.2). */
export async function downloadPluginFiles(
  entry: RegistryEntry,
): Promise<DownloadedPlugin> {
  const manifestText = await readEntryAsset(entry, "manifest.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestText);
  } catch {
    throw new Error(`${entry.name}: manifest.json isn't valid JSON.`);
  }
  const validation = validatePluginManifest(parsed);
  if (!validation.ok) {
    throw new Error(`${entry.name}: ${validation.error}`);
  }
  const mainJs = await readEntryAsset(entry, "main.js");
  let stylesCss: string | null = null;
  try {
    stylesCss = await readEntryAsset(entry, "styles.css");
  } catch {
    // styles.css is optional (SPEC §7.1).
  }
  return { id: validation.manifest.id, manifestText, mainJs, stylesCss };
}
