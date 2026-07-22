import { useMemo, useState } from "react";

import { Button } from "@edenwright/ui";

import { ipcErrorMessage, useAppStore } from "../store";
import { usePluginStore } from "../plugins/plugin-store";
import { runExport } from "../plugins/export-runner";
import "./export-modal.css";

/** The export dialog (SPEC §12 M6): format, scope, options — then files. */
export function ExportModal() {
  const exportOpen = useAppStore((state) => state.exportOpen);
  const setExportOpen = useAppStore((state) => state.setExportOpen);
  const openFile = useAppStore((state) => state.openFile);
  const projects = useAppStore((state) => state.projects);
  const toast = useAppStore((state) => state.toast);
  const exporters = usePluginStore((state) => state.exporters);

  const [format, setFormat] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneFiles, setDoneFiles] = useState<string[] | null>(null);

  const project = useMemo(() => {
    if (!openFile) return undefined;
    const segments = openFile.path.split("/");
    if (segments[0] !== "Projects") return undefined;
    return projects.find((item) => item.name === segments[1]);
  }, [openFile, projects]);

  // Universal exporters (no media tag) plus exporters whose media includes
  // this project preset's medium (SPEC v2 §8) — formats merge, first wins.
  const matching = exporters.filter(
    (item) => !item.media || item.media.includes(project?.medium ?? ""),
  );
  const formats = matching
    .flatMap((item) => item.formats)
    .filter(
      (item, index, all) =>
        all.findIndex((other) => other.id === item.id) === index,
    );
  const chosenFormat = formats.find((item) => item.id === format) ?? formats[0];
  const exporter = matching.find((item) =>
    item.formats.some((item) => item.id === chosenFormat?.id),
  );

  if (!exportOpen) return null;

  const close = () => {
    setExportOpen(false);
    setDoneFiles(null);
    setBusy(false);
  };

  const run = async () => {
    if (!exporter || !chosenFormat || !project || busy) return;
    setBusy(true);
    try {
      await runExport(exporter, chosenFormat.id, project);
      const outputDir = `Projects/${project.name}/exports`;
      const entries = await window.edenwright.pluginfs.list(outputDir);
      setDoneFiles(
        entries
          .filter(
            (entry) => entry.kind === "file" && entry.name !== ".gitignore",
          )
          .map((entry) => entry.name)
          .sort(),
      );
      toast("Exported.");
    } catch (error) {
      toast(ipcErrorMessage(error), "warn");
      setBusy(false);
    }
  };

  return (
    <div
      className="export-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="export-modal" role="dialog" aria-label="Export project">
        {!project || !exporter ? (
          <>
            <h2 className="export-modal__title">Nothing to export here.</h2>
            <p className="export-modal__note">
              Open a file inside a project and its formats appear in this
              dialog.
            </p>
            <div className="export-modal__actions">
              <Button variant="ghost" onClick={close}>
                Close
              </Button>
            </div>
          </>
        ) : doneFiles ? (
          <>
            <h2 className="export-modal__title">
              {project.name} → {chosenFormat?.label}
            </h2>
            <ul className="export-modal__files">
              {doneFiles.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
            <p className="export-modal__note">
              Written into exports/ — gitignored by template.
            </p>
            <div className="export-modal__actions">
              <Button
                variant="ghost"
                onClick={() =>
                  void window.edenwright.app.revealPath(
                    `Projects/${project.name}/exports`,
                  )
                }
              >
                Reveal in folder
              </Button>
              <Button onClick={close}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="export-modal__title">Export {project.name}</h2>

            <div className="export-modal__section">
              <span className="export-modal__label">Format</span>
              <div className="export-modal__formats">
                {formats.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="export-modal__format"
                    data-active={chosenFormat?.id === item.id || undefined}
                    onClick={() => setFormat(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="export-modal__section">
              <span className="export-modal__label">Scope</span>
              <p className="export-modal__note">
                Whole project (scopes arrive with structure-aware exports).
              </p>
            </div>

            <div className="export-modal__actions">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                disabled={!chosenFormat || busy}
                onClick={() => void run()}
              >
                {busy ? "Exporting…" : "Export"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
