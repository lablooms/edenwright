/**
 * Namesmith (SPEC §9.6.3): a name generator from seeded culture/style lists.
 * No network — every name is forged locally. Click a name to copy it.
 */

const { definePlugin } = require("@edenwright/plugin-api");

const CULTURES = {
  elvish: {
    label: "Elvish",
    starts: [
      "Ael",
      "Cala",
      "Ela",
      "Fae",
      "Gil",
      "Ily",
      "Lor",
      "Nym",
      "Syl",
      "Thal",
    ],
    middles: ["a", "e", "ia", "ie", "o", "y"],
    ends: ["driel", "las", "lian", "mir", "nor", "rion", "thas", "wen", "wyn"],
  },
  nordic: {
    label: "Nordic",
    starts: [
      "As",
      "Bjorn",
      "Eir",
      "Frey",
      "Gunn",
      "Hal",
      "Ing",
      "Sig",
      "Tor",
      "Val",
    ],
    middles: ["a", "e", "i", "y"],
    ends: [
      "bjorn",
      "dis",
      "fred",
      "gard",
      "grim",
      "hild",
      "mund",
      "rik",
      "var",
    ],
  },
  cyberpunk: {
    label: "Cyberpunk",
    starts: [
      "Blitz",
      "Chrome",
      "Dex",
      "Flux",
      "Hex",
      "Jax",
      "Neo",
      "Raz",
      "Vex",
      "Zero",
    ],
    middles: ["-", "_", "", "x"],
    ends: ["bit", "burn", "jack", "link", "net", "run", "shade", "wire"],
  },
  "old-english": {
    label: "Old English",
    starts: [
      "Aelf",
      "Beorn",
      "Cwen",
      "Ead",
      "God",
      "Leof",
      "Os",
      "Sig",
      "Wig",
      "Wulf",
    ],
    middles: ["a", "e", "i", "u"],
    ends: ["bert", "frith", "gar", "here", "mund", "red", "ric", "stan", "win"],
  },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const forge = (culture) => {
  const parts = CULTURES[culture];
  const name = `${pick(parts.starts)}${pick(parts.middles)}${pick(parts.ends)}`;
  return name.charAt(0).toUpperCase() + name.slice(1);
};

module.exports = definePlugin({
  manifest: require("./manifest.json"),

  onload(ctx) {
    let culture = "elvish";
    let names = [];

    ctx.workspace.registerView({
      id: "namesmith-panel",
      title: "Namesmith",
      icon: "Dices",
      render(element) {
        element.classList.add("namesmith-panel");

        const render = () => {
          element.innerHTML = `
            <h3>Namesmith</h3>
            <div class="namesmith-cultures">
              ${Object.entries(CULTURES)
                .map(
                  ([id, parts]) =>
                    `<button type="button" class="namesmith-culture${
                      id === culture ? " namesmith-culture--active" : ""
                    }" data-id="${id}">${parts.label}</button>`,
                )
                .join("")}
            </div>
            <button type="button" class="namesmith-forge">Forge ten</button>
            <ul class="namesmith-names">
              ${names
                .map(
                  (name) =>
                    `<li><button type="button" class="namesmith-name" data-name="${name}" title="Click to copy">${name}</button></li>`,
                )
                .join("")}
            </ul>
            <p class="namesmith-hint">Click a name to copy it.</p>
          `;
          element.querySelectorAll(".namesmith-culture").forEach((button) =>
            button.addEventListener("click", () => {
              culture = button.dataset.id;
              names = [];
              render();
            }),
          );
          element
            .querySelector(".namesmith-forge")
            .addEventListener("click", () => {
              names = Array.from({ length: 10 }, () => forge(culture));
              render();
            });
          element.querySelectorAll(".namesmith-name").forEach((button) =>
            button.addEventListener("click", () => {
              void navigator.clipboard?.writeText(button.dataset.name);
              ctx.notices.show(`${button.dataset.name} — copied.`);
            }),
          );
        };

        render();
        return () => element.replaceChildren();
      },
    });

    ctx.workspace.registerRibbonItem({
      id: "namesmith-ribbon",
      icon: "Dices",
      title: "Namesmith",
      location: "sidebar-bottom",
      onClick: () => ctx.workspace.openView("namesmith-panel"),
    });
  },
});
