import { useEffect, useRef } from "react";

import { usePluginStore } from "../plugins/plugin-store";
import "./plugin-view-host.css";

/** Hosts a plugin-registered view (vanilla or React) in the side panel (§9.2). */
export function PluginViewHost({ viewId }: { viewId: string }) {
  const views = usePluginStore((state) => state.views);
  const view = views.find((candidate) => candidate.id === viewId);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!view || view.kind !== "vanilla" || !hostRef.current) return;
    const element = hostRef.current;
    element.replaceChildren();
    const cleanup = view.render(element);
    return () => {
      if (typeof cleanup === "function") cleanup();
      element.replaceChildren();
    };
  }, [view]);

  if (!view) {
    return (
      <div className="plugin-view-host">
        <p className="plugin-view-host__missing">
          That view isn't registered anymore — its plugin may have been
          disabled.
        </p>
      </div>
    );
  }

  return (
    <div className="plugin-view-host">
      <div className="plugin-view-host__header">
        <span className="plugin-view-host__title">{view.title}</span>
      </div>
      {view.kind === "vanilla" ? (
        <div className="plugin-view-host__body" ref={hostRef} />
      ) : (
        <div className="plugin-view-host__body">
          <view.component />
        </div>
      )}
    </div>
  );
}
