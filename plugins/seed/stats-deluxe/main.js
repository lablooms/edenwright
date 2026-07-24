/**
 * Stats Deluxe (SPEC §9.6.4): a charts dashboard — 14-day pace, a 12-week
 * heatmap, and per-entity screen time — all read through the index API and
 * drawn with plain DOM (no chart library, no network).
 */

const { definePlugin } = require("@edenwright/plugin-api");

const PACE_DAYS = 14;
const HEATMAP_DAYS = 84;

module.exports = definePlugin({
  manifest: require("./manifest.json"),

  onload(ctx) {
    const bar = (label, value, max) => {
      const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2;
      return `
        <div class="stats-bar" title="${label}: ${value} words">
          <span class="stats-bar__label">${label}</span>
          <span class="stats-bar__track"><span class="stats-bar__fill" style="width:${width}%"></span></span>
          <span class="stats-bar__value">${value}</span>
        </div>`;
    };

    const heatCell = (day, words, max) => {
      const level = max === 0 ? 0 : Math.min(4, Math.ceil((words / max) * 4));
      return `<span class="stats-heat stats-heat--${level}" title="${day}: ${words} words"></span>`;
    };

    // One eden = one story: the dashboard reads the whole eden (".").
    const renderDashboard = async (element) => {
      const series = await ctx.index.getDailyWords(".", HEATMAP_DAYS);
      const pace = series.slice(-PACE_DAYS);
      const paceMax = Math.max(...pace.map((d) => d.words), 0);
      const heatMax = Math.max(...series.map((d) => d.words), 0);
      const total = series.reduce((sum, d) => sum + d.words, 0);

      const entities = await ctx.index.listEntities();
      const screenTime = [];
      for (const entity of entities.slice(0, 40)) {
        const appearances = await ctx.index.getEntityAppearances(
          entity.name.toLowerCase().split(/\s+/)[0],
        );
        const count = appearances.reduce((sum, a) => sum + a.count, 0);
        if (count > 0) screenTime.push({ name: entity.name, count });
      }
      screenTime.sort((a, b) => b.count - a.count);
      const top = screenTime.slice(0, 8);
      const topMax = top.length > 0 ? top[0].count : 0;

      element.innerHTML = `
        <h3>Stats</h3>
        <p class="stats-blurb">${total.toLocaleString("en-US")} words across ${HEATMAP_DAYS / 7} weeks.</p>
        <h4>Pace — last ${PACE_DAYS} days</h4>
        <div class="stats-pace">
          ${pace.map((d) => bar(d.day.slice(5), d.words, paceMax)).join("")}
        </div>
        <h4>Heatmap — last ${HEATMAP_DAYS / 7} weeks</h4>
        <div class="stats-heatmap">
          ${series.map((d) => heatCell(d.day, d.words, heatMax)).join("")}
        </div>
        <h4>Entity screen time</h4>
        ${
          top.length > 0
            ? `<div class="stats-pace">${top
                .map((e) => bar(e.name, e.count, topMax))
                .join("")}</div>`
            : '<p class="stats-blurb">No @mentions yet — tag an entity to light this up.</p>'
        }
      `;
    };

    ctx.workspace.registerView({
      id: "stats-deluxe-panel",
      title: "Stats",
      icon: "BarChart3",
      async render(element) {
        element.classList.add("stats-panel");
        const shell = document.createElement("div");
        shell.className = "stats-shell";
        element.appendChild(shell);
        await renderDashboard(shell);
        return () => element.replaceChildren();
      },
    });

    ctx.workspace.registerRibbonItem({
      id: "stats-deluxe-ribbon",
      icon: "BarChart3",
      title: "Stats",
      location: "sidebar-bottom",
      onClick: () => ctx.workspace.openView("stats-deluxe-panel"),
    });
  },
});
