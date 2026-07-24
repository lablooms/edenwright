import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bug,
  CircleHelp,
  ExternalLink,
  GraduationCap,
  RefreshCw,
  Wrench,
} from "lucide-react";

import { BloomIcon, Button, Icon } from "@edenwright/ui";

import { useAppStore } from "../store";
import { useChromeStore } from "../chrome-store";
import { checkForUpdatesManual, showNewerModal } from "../updates";
import { WritingGuide } from "./writing-guide";

import "./help-menu.css";

const LINKS = [
  {
    label: "Source & issues",
    url: "https://github.com/lablooms/edenwright",
  },
  {
    label: "User guide",
    url: "https://github.com/lablooms/edenwright/blob/main/docs/user-guide.md",
  },
  {
    label: "Changelog",
    url: "https://github.com/lablooms/edenwright/blob/main/CHANGELOG.md",
  },
  {
    label: "Plugin docs",
    url: "https://github.com/lablooms/edenwright/tree/main/docs/plugins",
  },
  {
    label: "MIT License",
    url: "https://github.com/lablooms/edenwright/blob/main/LICENSE",
  },
];

/**
 * The Help menu (title bar): About, manual update check, docs, DevTools.
 * The About dialog is also the brand-credit moment — Lablooms pink lives
 * here and only here (§3.1).
 */
export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const aboutOpen = useChromeStore((state) => state.aboutOpen);
  const setAboutOpen = useChromeStore((state) => state.setAboutOpen);
  const guideOpen = useChromeStore((state) => state.guideOpen);
  const setGuideOpen = useChromeStore((state) => state.setGuideOpen);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const runUpdateCheck = async () => {
    setOpen(false);
    const showModal = useAppStore.getState().showModal;
    const result = await checkForUpdatesManual();
    if (result.kind === "newer") {
      await showNewerModal(result.tag);
    } else if (result.kind === "latest") {
      await showModal({
        title: "You're on the newest bloom",
        body: "No newer Edenwright anywhere. Back to writing.",
        actions: [{ id: "ok", label: "Good", primary: true }],
      });
    } else {
      await showModal({
        title: "No word from the garden gate",
        body: "The update check needs a connection — it'll quietly try again on its own next start.",
        actions: [{ id: "ok", label: "Fair enough", primary: true }],
      });
    }
  };

  return (
    <div className="help-menu" ref={wrapRef}>
      <button
        type="button"
        className="ew-titlebar__button"
        title="Help"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon icon={CircleHelp} size={16} />
      </button>
      {open ? (
        <div className="help-menu__dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setGuideOpen(true);
            }}
          >
            <Icon icon={GraduationCap} size={14} /> Writing guide
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setAboutOpen(true);
            }}
          >
            <Icon icon={CircleHelp} size={14} /> About Edenwright…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void runUpdateCheck()}
          >
            <Icon icon={RefreshCw} size={14} /> Check for Updates…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void window.edenwright.app.openExternal(LINKS[1].url);
            }}
          >
            <Icon icon={BookOpen} size={14} /> User guide
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void window.edenwright.app.openExternal(
                "https://github.com/lablooms/edenwright/issues/new",
              );
            }}
          >
            <Icon icon={Bug} size={14} /> Report an issue
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void window.edenwright.window.toggleDevTools();
            }}
          >
            <Icon icon={Wrench} size={14} /> Toggle DevTools
          </button>
        </div>
      ) : null}
      {aboutOpen ? <AboutDialog /> : null}
      {guideOpen ? <WritingGuide /> : null}
    </div>
  );
}

function AboutDialog() {
  const setAboutOpen = useChromeStore((state) => state.setAboutOpen);
  const [version, setVersion] = useState("…");

  useEffect(() => {
    void window.edenwright.app.version().then(setVersion);
  }, []);

  return (
    <div
      className="about-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAboutOpen(false);
      }}
    >
      <div className="about" role="dialog" aria-label="About Edenwright">
        <BloomIcon size={56} />
        <h2 className="about__name">Edenwright</h2>
        <p className="about__version">{version}</p>
        <p className="about__line">
          A studio for every kind of story, growing in the open.
        </p>
        <p className="about__credit">
          Made by <span className="about__pink">Lablooms Studio</span>
        </p>
        <div className="about__links">
          {LINKS.map((link) => (
            <button
              key={link.url}
              type="button"
              className="about__link"
              onClick={() => void window.edenwright.app.openExternal(link.url)}
            >
              {link.label} <Icon icon={ExternalLink} size={11} />
            </button>
          ))}
        </div>
        <div className="about__actions">
          <Button onClick={() => setAboutOpen(false)}>Close</Button>
        </div>
      </div>
    </div>
  );
}
