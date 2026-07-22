import { useState } from "react";

import { BloomIcon, Button } from "@edenwright/ui";
import { FolderOpen, Plus } from "lucide-react";

import { useAppStore } from "../store";
import "./welcome.css";

/** No eden open: create one, open one, or jump back into a recent one. */
export function WelcomeView() {
  const edenState = useAppStore((state) => state.edenState);
  const createEden = useAppStore((state) => state.createEden);
  const openEden = useAppStore((state) => state.openEden);

  const [name, setName] = useState("");
  const [parentDir, setParentDir] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const recents = edenState?.recents ?? [];

  const pickParent = async () => {
    const chosen = await window.edenwright.eden.pickDirectory(
      "Where should your eden live?",
    );
    if (chosen) setParentDir(chosen);
  };

  const onCreate = async () => {
    if (!parentDir || name.trim().length === 0 || busy) return;
    setBusy(true);
    await createEden(parentDir, name);
    setBusy(false);
  };

  return (
    <div className="welcome">
      <div className="welcome__hero">
        <BloomIcon size={88} />
        <h1 className="welcome__title">Every story needs a garden.</h1>
        <p className="welcome__lede">
          An eden is one ordinary folder — your projects, your worlds, plain
          files you own forever.
        </p>
      </div>

      <div className="welcome__card">
        <h2 className="welcome__card-title">Create a new eden</h2>
        <input
          className="welcome__input"
          placeholder="Name your eden — e.g. Aster Reach"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="welcome__location">
          <Button variant="ghost" onClick={() => void pickParent()}>
            <FolderOpen size={16} /> Choose a folder…
          </Button>
          <span className="welcome__location-path">
            {parentDir ?? "No folder chosen yet"}
          </span>
        </div>
        <Button
          disabled={!parentDir || name.trim().length === 0 || busy}
          onClick={() => void onCreate()}
        >
          <Plus size={16} /> Create eden
        </Button>
      </div>

      <div className="welcome__card">
        <h2 className="welcome__card-title">Open an eden</h2>
        {recents.length > 0 ? (
          <ul className="welcome__recents">
            {recents.map((recent) => (
              <li key={recent.path}>
                <button
                  type="button"
                  className="welcome__recent"
                  onClick={() => void openEden(recent.path)}
                >
                  <span className="welcome__recent-name">{recent.name}</span>
                  <span className="welcome__recent-path">{recent.path}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="welcome__empty-recents">
            No edens yet on this machine.
          </p>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            void window.edenwright.eden
              .pickDirectory("Open an eden")
              .then((chosen) => (chosen ? openEden(chosen) : undefined));
          }}
        >
          <FolderOpen size={16} /> Browse for an eden…
        </Button>
      </div>
    </div>
  );
}
