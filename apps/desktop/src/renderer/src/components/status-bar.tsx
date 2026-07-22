import { useAppStore } from "../store";
import { usePluginStore } from "../plugins/plugin-store";
import "./status-bar.css";

/** Slim status bar (§9.2): plugin items left, app state right. */
export function StatusBar() {
  const statusBarItems = usePluginStore((state) => state.statusBarItems);
  const commands = usePluginStore((state) => state.commands);
  const indexing = useAppStore((state) => state.indexing);
  const edenOpen = useAppStore((state) => Boolean(state.edenState?.current));

  if (!edenOpen || (statusBarItems.length === 0 && !indexing)) return null;

  const runCommand = (id: string | undefined) => {
    if (!id) return;
    commands.find((command) => command.id === id)?.callback();
  };

  return (
    <footer className="status-bar">
      <div className="status-bar__left">
        {statusBarItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="status-bar__item"
            data-clickable={Boolean(item.command) || undefined}
            onClick={() => runCommand(item.command)}
          >
            {item.text}
          </button>
        ))}
      </div>
      <div className="status-bar__right">
        {indexing ? (
          <span className="status-bar__indexing">
            Indexing {indexing.done}/{indexing.total}…
          </span>
        ) : null}
      </div>
    </footer>
  );
}
