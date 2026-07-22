import type { FileSystemAdapter } from "@edenwright/core";
import type { ExporterDefinition } from "@edenwright/plugin-api";
import JSZip from "jszip";

import type { ProjectInfo } from "../../../preload/api";

/**
 * Runs an exporter through the ExporterRegistry (SPEC v2 §7.2), with the
 * shell's real capabilities behind the context (§8).
 */
export async function runExport(
  exporter: ExporterDefinition,
  format: string,
  project: ProjectInfo,
): Promise<void> {
  const bridge = window.edenwright;
  const fs: FileSystemAdapter = {
    readFile: (path) => bridge.pluginfs.read(path),
    readFileBinary: (path) => bridge.pluginfs.readBinary(path),
    writeFile: (path, contents) => bridge.pluginfs.write(path, contents),
    writeFileBinary: (path, data) => bridge.pluginfs.writeBinary(path, data),
    exists: (path) => bridge.pluginfs.exists(path),
    stat: (path) => bridge.pluginfs.stat(path),
    list: (dirPath) => bridge.pluginfs.list(dirPath),
    mkdir: (path) => bridge.pluginfs.mkdir(path),
    remove: (path) => bridge.pluginfs.remove(path),
    move: (from, to) => bridge.pluginfs.rename(from, to),
  };

  await exporter.run(format, {
    projectPath: `Projects/${project.name}`,
    outputDir: `Projects/${project.name}/exports`,
    scope: [],
    fs,
    renderPdf: (html, outRelPath) =>
      bridge.exporter.renderPdf(html, outRelPath),
    writeZip: async (entries, outRelPath) => {
      const zip = new JSZip();
      for (const entry of entries) zip.file(entry.path, entry.data);
      const bytes = await zip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
      });
      await fs.writeFileBinary(outRelPath, bytes);
    },
    reportProgress: () => undefined,
  });
}
