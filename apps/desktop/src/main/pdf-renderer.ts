import { BrowserWindow } from "electron";

import type { NodeFileSystemAdapter } from "./adapters/node-file-system.js";

/**
 * Print-clean HTML → PDF via a hidden BrowserWindow (SPEC §10): fast,
 * consistent, offline. CSS @page owns margins; we just add the ink.
 */
export async function renderPdfToFile(
  html: string,
  outAbsPath: string,
  fs: NodeFileSystemAdapter,
): Promise<void> {
  const window = new BrowserWindow({
    show: false,
    width: 850,
    height: 1100,
    webPreferences: { sandbox: true },
  });
  try {
    await window.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    );
    const pdf = await window.webContents.printToPDF({
      printBackground: true,
      pageSize: "Letter",
      margins: { marginType: "none" },
    });
    await fs.writeFileBinary(outAbsPath, new Uint8Array(pdf));
  } finally {
    window.destroy();
  }
}
