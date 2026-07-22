/**
 * Sprints (SPEC §9.6.2): a writing-sprint timer with session stats. Words are
 * counted through the index API before and after; history persists as plain
 * JSON in the eden (`.eden/plugins-data/sprints.json`) — plain files rule.
 */

const { definePlugin } = require("@edenwright/plugin-api");

const DURATIONS_MIN = [5, 15, 25];
const STATS_PATH = ".eden/plugins-data/sprints.json";

module.exports = definePlugin({
  manifest: require("./manifest.json"),

  onload(ctx) {
    let timer = null;
    let sprint = null; // { endsAt, startWords, durationMin, projectPath }
    let panel = null;

    const walkMarkdown = async (dir, out = []) => {
      let entries = [];
      try {
        entries = await ctx.eden.fs.list(dir);
      } catch {
        return out;
      }
      for (const entry of entries) {
        const path = `${dir}/${entry.name}`;
        if (entry.kind === "directory") await walkMarkdown(path, out);
        else if (entry.name.toLowerCase().endsWith(".md")) out.push(path);
      }
      return out;
    };

    const projectWords = async (projectPath) => {
      const files = await walkMarkdown(projectPath);
      let total = 0;
      for (const path of files) {
        const info = await ctx.index.getFileInfo(path);
        total += info?.wordCount ?? 0;
      }
      return total;
    };

    const firstProjectPath = async () => {
      const entries = await ctx.eden.fs.list("Projects").catch(() => []);
      const dir = entries.find((entry) => entry.kind === "directory");
      return dir ? `Projects/${dir.name}` : null;
    };

    const loadStats = async () => {
      try {
        return JSON.parse(await ctx.eden.fs.readFile(STATS_PATH));
      } catch {
        return { sprints: 0, bestWords: 0 };
      }
    };

    const saveStats = async (stats) => {
      await ctx.eden.fs.mkdir(".eden/plugins-data");
      await ctx.eden.fs.writeFile(
        STATS_PATH,
        `${JSON.stringify(stats, null, 2)}\n`,
      );
    };

    const renderIdle = async (element) => {
      const stats = await loadStats();
      element.innerHTML = `
        <h3>Sprints</h3>
        <p class="sprints-blurb">Pick a length, write until the bell. Words are
           counted from your project's files.</p>
        <div class="sprints-durations">
          ${DURATIONS_MIN.map(
            (min) =>
              `<button type="button" class="sprints-start" data-min="${min}">${min} min</button>`,
          ).join("")}
        </div>
        <p class="sprints-stats">${stats.sprints} sprints · best ${stats.bestWords} words</p>
      `;
      element
        .querySelectorAll(".sprints-start")
        .forEach((button) =>
          button.addEventListener("click", () =>
            startSprint(Number(button.dataset.min)),
          ),
        );
    };

    const renderRunning = (element) => {
      const left = Math.max(0, Math.round((sprint.endsAt - Date.now()) / 1000));
      const mm = String(Math.floor(left / 60)).padStart(2, "0");
      const ss = String(left % 60).padStart(2, "0");
      element.innerHTML = `
        <h3>Sprint running</h3>
        <p class="sprints-clock">${mm}:${ss}</p>
        <p class="sprints-blurb">Started at ${sprint.startWords} words. Go.</p>
        <button type="button" class="sprints-cancel">Give up</button>
      `;
      element
        .querySelector(".sprints-cancel")
        .addEventListener("click", () => stopSprint(false));
    };

    const rerender = () => {
      if (!panel) return;
      if (sprint) void renderRunning(panel);
      else void renderIdle(panel);
    };

    const stopSprint = async (finished) => {
      if (timer) clearInterval(timer);
      timer = null;
      const done = sprint;
      sprint = null;
      rerender();
      if (!finished || !done) return;
      const endWords = await projectWords(done.projectPath);
      const delta = Math.max(0, endWords - done.startWords);
      const stats = await loadStats();
      stats.sprints += 1;
      stats.bestWords = Math.max(stats.bestWords, delta);
      await saveStats(stats);
      ctx.notices.show(
        `Sprint done: ${delta} words in ${done.durationMin} minutes. Best: ${stats.bestWords}.`,
      );
      rerender();
    };

    const startSprint = async (durationMin) => {
      const projectPath = await firstProjectPath();
      if (!projectPath) {
        ctx.notices.show("Create a project first — sprints count its words.");
        return;
      }
      sprint = {
        endsAt: Date.now() + durationMin * 60_000,
        startWords: await projectWords(projectPath),
        durationMin,
        projectPath,
      };
      timer = setInterval(() => {
        if (sprint && Date.now() >= sprint.endsAt) void stopSprint(true);
        else rerender();
      }, 1000);
      rerender();
    };

    ctx.workspace.registerView({
      id: "sprints-panel",
      title: "Sprints",
      icon: "Timer",
      render(element) {
        panel = element;
        element.classList.add("sprints-panel");
        rerender();
        return () => {
          panel = null;
          if (timer) clearInterval(timer);
          timer = null;
          sprint = null;
        };
      },
    });

    ctx.workspace.registerRibbonItem({
      id: "sprints-ribbon",
      icon: "Timer",
      title: "Sprints",
      location: "sidebar-bottom",
      onClick: () => ctx.workspace.openView("sprints-panel"),
    });
  },
});
