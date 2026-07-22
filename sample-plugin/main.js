/**
 * Hello, eden — the plugin developers copy to start (SPEC v2 §7).
 *
 * An Edenwright plugin is a folder: this `main.js`, the `manifest.json`
 * beside it, and an optional `styles.css`. main.js is evaluated as a
 * CommonJS module; the import allow-list is the typed plugin API, the app's
 * own `@codemirror/*` instances (for editor extensions), and your own
 * manifest.
 *
 * Write in TypeScript against `@edenwright/plugin-api` for the good
 * autocomplete, compile to a single `main.js`, and ship both files.
 */

const { definePlugin } = require("@edenwright/plugin-api");

module.exports = definePlugin({
  // The runtime reads your manifest from disk; require it if you want it.
  manifest: require("./manifest.json"),

  /**
   * `ctx` is the whole API surface (SPEC v2 §7.2). Everything you register
   * returns a Disposable, and the runtime disposes all of it when your
   * plugin is disabled — so registering is all you have to do.
   */
  onload(ctx) {
    // 1. A command, in the palette (Ctrl/Cmd-P) with everything else.
    ctx.commands.register({
      id: "hello-eden:greet",
      name: "Say hello to the eden",
      callback: () => ctx.notices.show("Hello from your eden."),
    });

    // 2. A panel, opened from the ribbon item below.
    ctx.workspace.registerView({
      id: "hello-eden-panel",
      title: "Hello, eden",
      icon: "Sprout",
      render(element) {
        element.classList.add("hello-eden-panel");
        element.innerHTML = `
          <h3>Hello, eden.</h3>
          <p>Your first plugin panel. From here: commands, views, editor
             extensions, settings tabs, exporters, presets (new media as
             data!), file events, index reads.</p>
          <button type="button" id="hello-eden-button">Greet again</button>
        `;
        element
          .querySelector("#hello-eden-button")
          .addEventListener("click", () =>
            ctx.notices.show("Still here. Happy writing."),
          );
        // Return a cleanup when you have listeners or timers to release.
        return () => element.replaceChildren();
      },
    });

    // 3. The ribbon item that opens the panel.
    ctx.workspace.registerRibbonItem({
      id: "hello-eden-ribbon",
      icon: "Sprout",
      title: "Hello, eden",
      location: "sidebar-bottom",
      onClick: () => ctx.workspace.openView("hello-eden-panel"),
    });
  },
});
