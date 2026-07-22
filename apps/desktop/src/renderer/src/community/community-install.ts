import { validatePluginManifest } from "@edenwright/plugin-api";

import { fetchAssetText, type RegistryEntry } from "./registry-client";

/** Downloaded plugin payload, validated and ready to write into the eden. */
export interface DownloadedPlugin {
  id: string;
  manifestText: string;
  mainJs: string;
  stylesCss: string | null;
}

/** Download and validate a plugin's release assets (SPEC §9.4). */
export async function downloadPluginFiles(
  entry: RegistryEntry,
): Promise<DownloadedPlugin> {
  const manifestText = await fetchAssetText(entry, "manifest.json");
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
  const mainJs = await fetchAssetText(entry, "main.js");
  let stylesCss: string | null = null;
  try {
    stylesCss = await fetchAssetText(entry, "styles.css");
  } catch {
    // styles.css is optional (SPEC §9.1).
  }
  return { id: validation.manifest.id, manifestText, mainJs, stylesCss };
}
