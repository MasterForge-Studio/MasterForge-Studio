const DEFAULT_MANUAL_VISUAL_THEME = {
  id: "readable-parchment",
  name: "Readable Parchment",

  appBackground: "#E4D1B4",
  panelBackground: "#E8DFC8",
  panelBackgroundSoft: "#F4EBCF",
  textColour: "#1D1308",
  mutedTextColour: "#5A4630",

  headingColour: "#7B1D14",
  accentColour: "#C8960C",
  borderColour: "#7B1D14",

  buttonBackground: "#0D0B08",
  buttonTextColour: "#E8DFC8",
  buttonActiveTextColour: "#1D1308",
  buttonDisabledTextColour: "#D8CFBD",

  inputBackground: "#F9F1D6",
  inputTextColour: "#1D1308",

  backgroundImageMode: "plain",
  backgroundImageOpacity: 0,
  uiOpacity: 1
};

let themeSettings = {
  themeMode: "manual",
  manualTheme: "merchant-vessel",

  manualVisualThemeId: "readable-parchment",
  manualVisualTheme: {
    ...DEFAULT_MANUAL_VISUAL_THEME
  },
  savedManualVisualThemes: [],

  locationThemes: {},
  backgroundOpacity: 0.05,
  menusHidden: false
};

let installedThemes = [];

// ===========================
// MASTERFORGE THEME ENGINE
// ===========================

async function initialiseThemeSystem() {

  try {

    if (window.dmAPI.getDbThemeSettings) {

      themeSettings =
        await window.dmAPI.getDbThemeSettings();

    }


   installedThemes =
  await window.dmAPI.listThemes();

await applyCurrentTheme();

applyMenuVisibility();
console.log("Building settings...");
await buildThemeSettingsPanel();


  } catch (err) {

    console.error(
      "Theme system failed:",
      err
    );

  }

}


function getThemeForCurrentLocation() {
  if (themeSettings.themeMode !== "auto") {
    return themeSettings.manualTheme || "merchant-vessel";
  }

  const state = window.dmState.current;

  const worldRecord =
    (window.dmState.worlds || [])
      .find(world => world.id === state.world);

  const regionRecord =
    (window.dmState.regions || [])
      .find(region => region.id === state.region);

  const locationRecord =
    (window.dmState.locations || [])
      .find(location => location.id === state.location);

  return (
    themeSettings.locationThemes?.[state.location] ||
    locationRecord?.themeId ||
    locationRecord?.defaultThemeId ||

    regionRecord?.themeId ||
    regionRecord?.defaultThemeId ||

    worldRecord?.themeId ||
    worldRecord?.defaultThemeId ||

    themeSettings.manualTheme ||
    "merchant-vessel"
  );
}

function applyDynamicBackgroundImage(imageUrl) {
  let layer = document.querySelector("#masterForgeDynamicBackground");

  if (!layer) {
    layer = document.createElement("div");
    layer.id = "masterForgeDynamicBackground";
    document.body.prepend(layer);
  }

  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.zIndex = "0";
  layer.style.pointerEvents = "none";
  layer.style.backgroundSize = "cover";
  layer.style.backgroundPosition = "center";
  layer.style.backgroundRepeat = "no-repeat";

  if (!imageUrl) {
    layer.style.backgroundImage = "";
    layer.style.opacity = "0";
    layer.style.display = "none";
    return;
  }

  layer.style.display = "block";
  layer.style.opacity = "1";
  layer.style.backgroundImage = `url("${imageUrl}")`;

  console.log("DYNAMIC BACKGROUND LAYER APPLIED:", {
    layer,
    backgroundImagePreview: layer.style.backgroundImage.slice(0, 120),
    exists: !!imageUrl,
    length: String(imageUrl).length
  });
}

function applyManualVisualTheme(manualThemeBackgroundUrl = "") {
  const visual = {
    ...DEFAULT_MANUAL_VISUAL_THEME,
    ...(themeSettings.manualVisualTheme || {})
  };

  const root = document.documentElement;

  document.body.dataset.manualVisual = "true";

  root.style.setProperty("--mf-app-bg", visual.appBackground);
  root.style.setProperty("--mf-panel-bg", visual.panelBackground);
  root.style.setProperty("--mf-panel-bg-soft", visual.panelBackgroundSoft);
  root.style.setProperty("--mf-text", visual.textColour);
  root.style.setProperty("--mf-text-muted", visual.mutedTextColour);
  root.style.setProperty("--mf-heading", visual.headingColour);
  root.style.setProperty("--mf-accent", visual.accentColour);
  root.style.setProperty("--mf-border", visual.borderColour);
  root.style.setProperty("--mf-button-bg", visual.buttonBackground);
  root.style.setProperty("--mf-button-text", visual.buttonTextColour);
  root.style.setProperty("--mf-button-border", visual.borderColour);
  root.style.setProperty("--mf-button-hover-bg", `color-mix(in srgb, ${visual.accentColour} 22%, ${visual.buttonBackground})`);
  root.style.setProperty("--mf-button-hover-text", visual.buttonTextColour);
  root.style.setProperty("--mf-button-active-bg", visual.accentColour);
  root.style.setProperty("--mf-button-active-text", visual.buttonActiveTextColour || "#1D1308");
  root.style.setProperty("--mf-button-disabled-bg", `color-mix(in srgb, ${visual.buttonBackground} 72%, ${visual.panelBackgroundSoft})`);
  root.style.setProperty("--mf-button-disabled-text", visual.buttonDisabledTextColour || visual.buttonTextColour);
  root.style.setProperty("--mf-button-focus", visual.accentColour);
  root.style.setProperty("--mf-danger-bg", `color-mix(in srgb, #a72d2d 72%, ${visual.buttonBackground})`);
  root.style.setProperty("--mf-danger-text", "#fff4f4");
  root.style.setProperty("--mf-danger-border", "#d85a5a");
  root.style.setProperty("--mf-input-bg", visual.inputBackground);
  root.style.setProperty("--mf-input-text", visual.inputTextColour);

  root.style.setProperty("--app-ui-opacity", String(visual.uiOpacity ?? 1));

  document.body.style.backgroundColor =
    visual.appBackground || "#E4D1B4";

  if (visual.backgroundImageMode === "plain") {
    document.body.classList.add("manualPlainBackground");

    root.style.setProperty("--theme-background-image", "none");
    root.style.setProperty("--theme-image-opacity", "0");

    applyDynamicBackgroundImage("");

    const layer = document.querySelector("#masterForgeDynamicBackground");

    if (layer) {
      layer.style.backgroundImage = "none";
      layer.style.opacity = "0";
      layer.style.display = "none";
    }

    return;
  }

  document.body.classList.remove("manualPlainBackground");

  const opacity = Number.isFinite(Number(visual.backgroundImageOpacity))
    ? Number(visual.backgroundImageOpacity)
    : 0.25;

  root.style.setProperty("--theme-image-opacity", String(opacity));

  if (visual.backgroundImageMode === "image" && manualThemeBackgroundUrl) {
    root.style.setProperty(
      "--theme-background-image",
      `url("${manualThemeBackgroundUrl}")`
    );

    applyDynamicBackgroundImage(manualThemeBackgroundUrl);

    const layer = document.querySelector("#masterForgeDynamicBackground");

    if (layer) {
      layer.style.display = "block";
      layer.style.opacity = String(opacity);
    }
  }
}

async function applyCurrentTheme() {
  const themeId = getThemeForCurrentLocation();

  document.body.dataset.theme = themeId;

  const themeLink = document.querySelector("#themeStylesheet");

  let settings = null;
  let activeTheme = null;
  let themeFolder = themeId;
  let themeCss = "theme.css";
  let themeBackground = "background.webp";
  let themeBasePath = "";
  let contextBackground = "";
  let finalBackground = "";

  try {
    settings = await window.dmAPI.getSettings();

    activeTheme = installedThemes.find(theme => theme.id === themeId);

    themeFolder = activeTheme?.folder || themeId;
    themeCss = activeTheme?.css || "theme.css";
    themeBackground = activeTheme?.background || "background.webp";

    themeBasePath =
      "file:///" +
      settings.dataPath.replaceAll("\\", "/") +
      "/themes/" +
      themeFolder +
      "/";

    finalBackground = themeBasePath + themeBackground;

    try {
      contextBackground = await getBackgroundForCurrentContext(settings);
    } catch (error) {
      console.warn("Could not load context background:", error);
    }

    finalBackground = contextBackground || finalBackground;

    if (themeLink) {
      themeLink.href = themeBasePath + themeCss;
    }

    if (themeSettings.themeMode === "manual") {
      applyManualVisualTheme(finalBackground);
    } else {
      delete document.body.dataset.manualVisual;
      document.body.classList.remove("manualPlainBackground");
      [
        "--mf-app-bg", "--mf-panel-bg", "--mf-panel-bg-soft", "--mf-text",
        "--mf-text-muted", "--mf-heading", "--mf-accent", "--mf-border",
        "--mf-button-bg", "--mf-button-text", "--mf-button-border",
        "--mf-button-hover-bg", "--mf-button-hover-text", "--mf-button-active-bg",
        "--mf-button-active-text", "--mf-button-disabled-bg", "--mf-button-disabled-text",
        "--mf-button-focus", "--mf-danger-bg", "--mf-danger-text", "--mf-danger-border",
        "--mf-input-bg", "--mf-input-text"
      ].forEach(property => document.documentElement.style.removeProperty(property));

      document.documentElement.style.setProperty(
        "--theme-background-image",
        `url("${finalBackground}")`
      );

      document.documentElement.style.setProperty(
        "--theme-image-opacity",
        String(themeSettings.backgroundOpacity ?? 0.05)
      );

      applyDynamicBackgroundImage(finalBackground);
    }

    const opacity = themeSettings.backgroundOpacity ?? 0.05;

    document.documentElement.style.setProperty(
      "--app-ui-opacity",
      String(opacity)
    );

    console.log("FINAL BACKGROUND APPLIED:", {
      themeMode: themeSettings.themeMode,
      themeId,
      contextBackgroundExists: !!contextBackground,
      finalBackgroundPreview: String(finalBackground).slice(0, 120),
      finalBackgroundLength: String(finalBackground).length
    });

    console.log("Loading theme CSS:", themeLink?.href || "No theme link found");
    console.log("Loading theme background:", finalBackground);

  } catch (error) {
    console.error("applyCurrentTheme failed:", error);
  }
}


  const opacity =
    themeSettings.backgroundOpacity ?? 0.05;


  document.documentElement.style.setProperty(
    "--theme-image-opacity",
    1
  );


  document.documentElement.style.setProperty(
    "--app-ui-opacity",
    opacity
  );



function getRecordThumbnailHtml(options = {}) {
  const image = options.image || "";
  const fallback = options.fallback || "🗂";
  const alt = options.alt || "Record image";

  if (image) {
    return `
      <div class="builderListThumb has-image">
        <img src="${image}" alt="${alt}">
      </div>
    `;
  }

  return `
    <div class="builderListThumb">
      <span>${fallback}</span>
    </div>
  `;
}

function applyMenuVisibility() {

  document.body.classList.toggle(
    "menus-hidden",
    !!themeSettings.menusHidden
  );

}



async function saveThemeSettings() {

  if (window.dmAPI.saveDbThemeSettings) {

    await window.dmAPI.saveDbThemeSettings(
      themeSettings
    );

  }


  await applyCurrentTheme();
  applyMenuVisibility();

}



async function buildThemeSettingsPanel() {
  const settingsPanel = document.querySelector("#settings");

  if (!settingsPanel) {
    console.error("Settings panel not found.");
    return;
  }

  console.log("Building safe settings panel...");

  let settings = null;

  try {
    settings = await window.dmAPI.getSettings();
  } catch (error) {
    console.error("Could not load app settings:", error);
  }

  settingsPanel.innerHTML = `
    <h1>⚙ Forge Settings</h1>

    <div class="settingsGrid">

      <div class="infoCard">
        <h2>💾 Data Folder</h2>

        <p>Current data folder:</p>

        <div class="settingPathBox">
          <code id="settingsDataPathDisplay">
            ${escapeHtml(settings?.dataPath || "Unknown")}
          </code>
        </div>

        <button id="openDataModalBtn" type="button">
          Open Data Folder Settings
        </button>
      </div>

      <div class="infoCard">
  <h2>🎨 Theme Control</h2>

  <label for="themeModeSelect">Theme Mode</label>
  <select id="themeModeSelect">
    <option value="manual">Manual</option>
    <option value="auto">Auto by Location</option>
  </select>

  <label>Theme</label>
  <select id="manualThemeSelect">
    <option value="merchant-vessel">Merchant Vessel</option>
    <option value="lost-jungle-isle">Lost Jungle Isle</option>
  </select>

  <label>Background Opacity</label>
  <input
    id="backgroundOpacitySlider"
    type="range"
    min="2"
    max="100"
    value="5"
  >

  <span id="backgroundOpacityDisplay">5%</span>

  <hr>

  <h2>Manual Visual Theme</h2>

  <label>App Background</label>
  <input id="manualAppBackgroundInput" type="color">

  <label>Background Image Mode</label>
  <select id="manualBackgroundImageModeSelect">
    <option value="plain">Plain Background</option>
    <option value="image">Theme Background Image</option>
  </select>

  <label>Background Image Opacity</label>
  <input
    id="manualBackgroundImageOpacitySlider"
    type="range"
    min="0"
    max="100"
    value="0"
  >
  <span id="manualBackgroundImageOpacityDisplay">0%</span>

  <label for="manualPanelBackgroundInput">Panel / Card Background</label>
  <input id="manualPanelBackgroundInput" type="color">

  <label for="manualTextColourInput">Text Colour</label>
  <input id="manualTextColourInput" type="color">

  <label for="manualHeadingColourInput">Heading Colour</label>
  <input id="manualHeadingColourInput" type="color">

  <label for="manualBorderColourInput">Border Colour</label>
  <input id="manualBorderColourInput" type="color">

  <label for="manualButtonBackgroundInput">Button Background</label>
  <input id="manualButtonBackgroundInput" type="color">

  <label for="manualButtonTextInput">Button Text</label>
  <input id="manualButtonTextInput" type="color">

  <label for="manualInputBackgroundInput">Input Background</label>
  <input id="manualInputBackgroundInput" type="color">

  <label for="manualInputTextInput">Input Text</label>
  <input id="manualInputTextInput" type="color">

  <button id="resetManualVisualThemeBtn" type="button">
    Reset Readable Default
  </button>

  <hr>

  <button id="toggleMenusBtn" type="button">
    Toggle Menus
  </button>
</div>

      <div class="infoCard">
        <h2>📦 Content Packs</h2>

        <button id="installContentPackBtn" type="button">
          Install Content Pack
        </button>

        <div id="installedContentPacks">
          <p>Content pack list will appear here.</p>
        </div>
      </div>

    </div>
  `;

  const themeModeSelect = document.querySelector("#themeModeSelect");
  const manualThemeSelect = document.querySelector("#manualThemeSelect");
  const opacitySlider = document.querySelector("#backgroundOpacitySlider");
  const opacityDisplay = document.querySelector("#backgroundOpacityDisplay");
  const toggleMenusBtn = document.querySelector("#toggleMenusBtn");
  const installContentPackBtn = document.querySelector("#installContentPackBtn");
const manualAppBackgroundInput =
  document.querySelector("#manualAppBackgroundInput");

const manualBackgroundImageModeSelect =
  document.querySelector("#manualBackgroundImageModeSelect");

const manualBackgroundImageOpacitySlider =
  document.querySelector("#manualBackgroundImageOpacitySlider");

const manualBackgroundImageOpacityDisplay =
  document.querySelector("#manualBackgroundImageOpacityDisplay");
  if (themeModeSelect) {
    themeModeSelect.value = themeSettings.themeMode || "manual";

    themeModeSelect.onchange = async event => {
      themeSettings.themeMode = event.target.value;
      await saveThemeSettings();
    };
  }

  if (manualThemeSelect) {
    manualThemeSelect.value = themeSettings.manualTheme || "merchant-vessel";

    manualThemeSelect.onchange = async event => {
      themeSettings.manualTheme = event.target.value;
      await saveThemeSettings();
    };
  }

  if (opacitySlider && opacityDisplay) {
    const opacity = Math.round((themeSettings.backgroundOpacity ?? 0.05) * 100);

    opacitySlider.value = opacity;
    opacityDisplay.innerText = opacity + "%";

    opacitySlider.oninput = async event => {
      const value = Number(event.target.value);

      themeSettings.backgroundOpacity = value / 100;
      opacityDisplay.innerText = value + "%";

      await saveThemeSettings();
    };
  }

  if (toggleMenusBtn) {
  toggleMenusBtn.innerText = themeSettings.menusHidden
    ? "Show Menus"
    : "Hide Menus";

  toggleMenusBtn.onclick = async () => {
    themeSettings.menusHidden = !themeSettings.menusHidden;

    await saveThemeSettings();
    await buildThemeSettingsPanel();
  };
}

  if (installContentPackBtn) {
    installContentPackBtn.onclick = async () => {
      const packPath = await window.dmAPI.chooseContentPackFile();

      if (!packPath) return;

      try {
        const installedPack = await window.dmAPI.installContentPack(packPath);
        const entryPoint = installedPack?.entryPoint;
        if (entryPoint?.campaignId) {
          const campaignRecord = await window.dmAPI.getRecord(entryPoint.campaignId);
          if (campaignRecord) {
            saveCampaignAtlasRecord({
              ...campaignRecord,
              primaryWorldId: entryPoint.worldId,
              currentWorldId: entryPoint.worldId,
              currentRegionId: entryPoint.regionId,
              currentLocationId: entryPoint.locationId
            });
          }
          window.dmState.current = {
            ...window.dmState.current,
            campaign: entryPoint.campaignId,
            systemId: campaignRecord?.systemId || installedPack.systemId || "system-neutral",
            world: entryPoint.worldId,
            region: entryPoint.regionId,
            location: entryPoint.locationId
          };
          saveUiState();
        }
        alert("Content pack installed. MasterForge will refresh.");
        location.reload();
      } catch (error) {
        console.error("Content-pack installation failed:", error);
        alert(`Content pack was not installed. ${error?.message || "Validation or import failed."}`);
      }
    };
  }

  setupDataPathButton();
  setupManualVisualThemeControls();

  try {
    await renderInstalledContentPacks();
  } catch (error) {
    console.warn("Could not render content packs:", error);
  }
}

function setupManualVisualThemeControls() {
  const visual = {
    ...DEFAULT_MANUAL_VISUAL_THEME,
    ...(themeSettings.manualVisualTheme || {})
  };

  const controls = [
  ["#manualAppBackgroundInput", "appBackground"],
  ["#manualPanelBackgroundInput", "panelBackground"],
    ["#manualTextColourInput", "textColour"],
    ["#manualHeadingColourInput", "headingColour"],
    ["#manualBorderColourInput", "borderColour"],
    ["#manualButtonBackgroundInput", "buttonBackground"],
    ["#manualButtonTextInput", "buttonTextColour"],
    ["#manualInputBackgroundInput", "inputBackground"],
    ["#manualInputTextInput", "inputTextColour"]
  ];

  controls.forEach(([selector, key]) => {
    const input = document.querySelector(selector);

    if (!input) return;

    input.value = visual[key];

    input.oninput = async event => {
      themeSettings.manualVisualTheme = {
        ...DEFAULT_MANUAL_VISUAL_THEME,
        ...(themeSettings.manualVisualTheme || {}),
        [key]: event.target.value
      };

      await saveThemeSettings();
    };
  });

  const backgroundModeSelect =
  document.querySelector("#manualBackgroundImageModeSelect");

if (backgroundModeSelect) {
  backgroundModeSelect.value = visual.backgroundImageMode || "plain";

  backgroundModeSelect.onchange = async event => {
  themeSettings.manualVisualTheme = {
    ...DEFAULT_MANUAL_VISUAL_THEME,
    ...(themeSettings.manualVisualTheme || {}),
    backgroundImageMode: event.target.value
  };

  await saveThemeSettings();
  await buildThemeSettingsPanel();
};
}

const backgroundOpacitySlider =
  document.querySelector("#manualBackgroundImageOpacitySlider");

const backgroundOpacityDisplay =
  document.querySelector("#manualBackgroundImageOpacityDisplay");

if (backgroundOpacitySlider) {
  const opacityPercent =
    Math.round((visual.backgroundImageOpacity ?? 0) * 100);

  backgroundOpacitySlider.value = opacityPercent;

  if (backgroundOpacityDisplay) {
    backgroundOpacityDisplay.innerText = opacityPercent + "%";
  }

  backgroundOpacitySlider.oninput = async event => {
  const value = Number(event.target.value);

  themeSettings.manualVisualTheme = {
    ...DEFAULT_MANUAL_VISUAL_THEME,
    ...(themeSettings.manualVisualTheme || {}),
    backgroundImageOpacity: value / 100
  };

  if (backgroundOpacityDisplay) {
    backgroundOpacityDisplay.innerText = value + "%";
  }

  await saveThemeSettings();
};
}

  const resetBtn = document.querySelector("#resetManualVisualThemeBtn");

  if (resetBtn) {
    resetBtn.onclick = async () => {
      themeSettings.manualVisualTheme = {
        ...DEFAULT_MANUAL_VISUAL_THEME
      };

      themeSettings.manualVisualThemeId = DEFAULT_MANUAL_VISUAL_THEME.id;

      await saveThemeSettings();
      await buildThemeSettingsPanel();
    };
  }
}

async function renderInstalledContentPacks() {

  const wrapper =
    document.querySelector("#installedContentPacks");

  if (!wrapper) return;

  const packs =
    await window.dmAPI.listContentPacks();

  if (!packs.length) {
    wrapper.innerHTML =
      "<p>No content packs installed.</p>";
    return;
  }

  wrapper.innerHTML =
    packs.map(pack => `
      <div class="characterMiniCard">
        <h3>${escapeHtml(pack.name || "Unnamed Pack")}</h3>
        <p>${escapeHtml(pack.description || "No description supplied.")}</p>
        <p>Version: ${escapeHtml(pack.version || "Unknown")}</p>
        <p>Author: ${escapeHtml(pack.author || "Unknown")}</p>
        <p>System: ${escapeHtml(pack.systemId || "Not specified")}</p>
        <p>Installed: ${escapeHtml(pack.installedDate || pack.installed || "Unknown")}</p>
        ${pack.suppliedRecordCounts ? `<p>Records: ${escapeHtml(Object.entries(pack.suppliedRecordCounts).map(([collection, count]) => `${collection} ${count}`).join(" · "))}</p>` : ""}
        ${pack.licence ? `<p>Licence: ${escapeHtml(pack.licence)}</p>` : ""}

        <button
          class="removeContentPackBtn"
          data-pack-id="${escapeHtml(pack.packId || pack.id)}"
          data-entry-campaign-id="${escapeHtml(pack.entryPoint?.campaignId || "")}">
          Remove Pack
        </button>
      </div>
    `).join("");

  document
    .querySelectorAll(".removeContentPackBtn")
    .forEach(btn => {

      btn.onclick = async () => {

        const confirmed =
          confirm("Remove this content pack and all its imported content?");

        if (!confirmed) return;

        const removedCampaignId = btn.dataset.entryCampaignId || "";
        await window.dmAPI.removeContentPack(btn.dataset.packId);
        if (removedCampaignId && window.dmState.current.campaign === removedCampaignId) {
          const atlasRecords = getCampaignAtlasRecords();
          delete atlasRecords[removedCampaignId];
          localStorage.setItem("masterForgeCampaignAtlasRecords", JSON.stringify(atlasRecords));
          window.dmState.current = {
            ...window.dmState.current,
            campaign: null, systemId: null, world: null, region: null, location: null
          };
          saveUiState();
        }

        await renderInstalledContentPacks();
        await setupStateBar();

        alert("Content pack removed. MasterForge will refresh.");
        location.reload();

      };

    });

}

async function openWorldBuilderPanel() {
  const panel = document.querySelector("#world");

  if (!panel) return;

  const worlds = await window.dmAPI.listWorlds();

  panel.innerHTML = `
    <div class="campaignAtlasShell">
      <div class="worldBuilderSearchBar">
  <label>Find Place</label>
  <input
    id="worldBuilderSearchInput"
    placeholder="Search worlds, regions or locations..."
  >

  <select id="worldBuilderSearchTypeInput">
    <option value="all">All</option>
    <option value="world">Worlds</option>
    <option value="region">Regions</option>
    <option value="location">Locations</option>
  </select>

  <button id="worldBuilderSearchBtn" type="button">
    Search
  </button>
</div>

<div id="worldBuilderSearchResults" class="worldBuilderSearchResults"></div>

      <section class="campaignAtlasHero infoCard">
        <div>
          <div class="entityProfileMeta">
            <span>World Builder</span>
          </div>

          <h1>Manage Worlds, Regions & Locations</h1>

          <p>
            Create reusable world data, then attach regions, locations and location background images.
          </p>
        </div>

        <button id="backToCampaignAtlasBtn" type="button">
          Back to Campaign Atlas
        </button>
      </section>

      <section class="infoCard campaignCreateCard">

        <div class="genericEntityFormGrid two">

          <div>
            <label>World / Plane</label>
            <div class="inlineCreateRow">
              <select id="worldBuilderWorldInput">
                ${worlds.map(world => `
                  <option
                    value="${escapeHtml(world.id)}"
                    ${world.id === window.dmState.current.world ? "selected" : ""}
                  >
                    ${escapeHtml(world.name || world.id)}
                  </option>
                `).join("")}
              </select>

              <button id="worldBuilderNewWorldBtn" type="button">
                + New World
              </button>
            </div>
          </div>

          <div>
            <label>Region</label>
            <div class="inlineCreateRow">
              <select id="worldBuilderRegionInput">
                <option value="">Loading regions...</option>
              </select>

              <button id="worldBuilderNewRegionBtn" type="button">
                + New Region
              </button>
            </div>
          </div>

          <div>
            <label>Location</label>
            <div class="inlineCreateRow">
              <select id="worldBuilderLocationInput">
                <option value="">Loading locations...</option>
              </select>

              <button id="worldBuilderNewLocationBtn" type="button">
                + New Location
              </button>
            </div>
          </div>

          <div>
            <label>Location Background Image</label>
            <input
              id="worldBuilderLocationImageInput"
              type="file"
              accept="image/*"
            >

            <p class="forgeSmallHelp">
              This image becomes the background when this location is selected.
            </p>
          </div>

        </div>

        <hr>

        <div class="worldBuilderLocationEditorGrid">

  <div>
    <label>Location Name</label>
    <input id="worldBuilderLocationNameInput">
  </div>

  <div>
    <label>Location Summary</label>
    <textarea
      id="worldBuilderLocationSummaryInput"
      rows="5"
      placeholder="Short overview of this location..."
    ></textarea>
  </div>

  <section class="infoCard worldBuilderLocationOverviewCard">
  <h2>Location Overview Editor</h2>

  <p>
  These fields feed the current Location Overview shown in play. Use this as the main prep layer for the selected location.
</p>

  <div class="worldBuilderOverviewGrid">

    <div>
      <label>Location Environment</label>
      <textarea id="worldBuilderLocationEnvironmentInput" rows="5"></textarea>
    </div>

    <div>
      <label>Location Politics</label>
      <textarea id="worldBuilderLocationPoliticsInput" rows="5"></textarea>
    </div>

    <div>
      <label>Location Culture</label>
      <textarea id="worldBuilderLocationCultureInput" rows="5"></textarea>
    </div>

        <div>
      <label>Location Landmarks & Places</label>
      <textarea
        id="worldBuilderLocationLandmarksInput"
        rows="5"
        placeholder="Notable locations, ruins, caves, landmarks, encounter sites or exploration hooks."
      ></textarea>
    </div>
<div>
  <label>Location Local Creatures</label>
  <textarea
    id="worldBuilderLocationLocalCreaturesInput"
    rows="5"
    placeholder="Creature names, common wildlife, monster signs, lairs, tracks or local encounter notes."
  ></textarea>
</div>

<div>
  <label>Location Weather Roll Table</label>
  <textarea
    id="worldBuilderLocationWeatherInput"
    rows="8"
    placeholder="1 | Clear skies | Warm, humid and still.
2 | Light rain | Rain patters through the canopy.
3-4 | Heavy rain | Travel becomes difficult.
5 | Mist | Visibility is reduced.
6 | Thunderstorm | Lightning and loud thunder roll over the area.
7 | Oppressive heat | Exhaustion checks may be needed.
8 | Strange omen | The weather feels unnatural."
  ></textarea>
</div>
    <div>
      <label>Location Hazards</label>
      <textarea id="worldBuilderLocationHazardsInput" rows="5"></textarea>
    </div>

    <div>
      <label>Location Rumours</label>
      <textarea id="worldBuilderLocationRumoursInput" rows="5"></textarea>
    </div>

    <div>
      <label>Location GM Secrets</label>
      <textarea id="worldBuilderLocationSecretsInput" rows="5"></textarea>
    </div>

    <div>
      <label>Location Tone / Details</label>
      <textarea id="worldBuilderLocationToneInput" rows="5"></textarea>
    </div>

  </div>
</section>

</div>

        <div id="worldBuilderLocationPreview" class="infoCard">
          <p>No location selected.</p>
        </div>

                <div class="entityProfileActions">
          <button id="worldBuilderSaveLocationBtn" type="button">
            💾 Save Location
          </button>
        </div>

      </section>

    
    </div>
  `;

  setupWorldBuilderControls();

  await populateWorldBuilderRegions();
  }

function arrayToTextarea(value) {
  if (Array.isArray(value)) {
    return value.join("\n");
  }

  return value || "";
}

function weatherEntriesToTextarea(entries = []) {
  if (!Array.isArray(entries)) {
    return "";
  }

  return entries.map(entry => {
    return [
      entry.roll || "",
      entry.name || "",
      entry.description || ""
    ].join(" | ");
  }).join("\n");
}

function textareaToWeatherEntries(value) {
  return String(value || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split("|").map(part => part.trim());

      return {
        roll: parts[0] || "",
        name: parts[1] || "",
        description: parts.slice(2).join(" | ") || ""
      };
    })
    .filter(entry => entry.roll && entry.name);
}

function textareaToArray(value) {
  return String(value || "")
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
}

function firstOverviewValue(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return [];
}

async function loadWorldBuilderRegionEditor() {
  const regionInput = document.querySelector("#worldBuilderRegionInput");

  if (!regionInput?.value) return;

  const regionId = regionInput.value;

  let region = null;

  try {
    region = await window.dmAPI.getRecord(regionId);
  } catch (error) {
    console.warn("Could not load region directly:", regionId, error);
  }

  if (!region) return;

  const setValue = (selector, value) => {
    const field = document.querySelector(selector);

    if (field) {
      field.value = arrayToTextarea(value);
    }
  };

  setValue("#worldBuilderRegionEnvironmentInput", region.environment);
  setValue("#worldBuilderRegionPoliticsInput", region.politics);
  setValue("#worldBuilderRegionCultureInput", region.culture);
  setValue("#worldBuilderRegionHumanoidsInput", region.humanoids);
  setValue("#worldBuilderRegionFactionsInput", region.factions);
  setValue("#worldBuilderRegionHazardsInput", region.travelHazards || region.hazards);
  setValue("#worldBuilderRegionRumoursInput", region.rumours);
  setValue("#worldBuilderRegionSecretsInput", region.dmSecrets || region.gmSecrets);
}

async function saveWorldBuilderRegionOverview() {
  const worldInput = document.querySelector("#worldBuilderWorldInput");
  const regionInput = document.querySelector("#worldBuilderRegionInput");

  if (!worldInput?.value || !regionInput?.value) {
    alert("Choose a world and region first.");
    return;
  }

  const regionId = regionInput.value;
  const worldId = worldInput.value;

  const existing =
    await window.dmAPI.getRecord(regionId);

  const updated = {
    ...(existing || {}),
    id: regionId,
    worldId,
    parentWorldId: worldId,

    environment: textareaToArray(
      document.querySelector("#worldBuilderRegionEnvironmentInput")?.value
    ),

    politics: textareaToArray(
      document.querySelector("#worldBuilderRegionPoliticsInput")?.value
    ),

    culture: textareaToArray(
      document.querySelector("#worldBuilderRegionCultureInput")?.value
    ),

    humanoids: textareaToArray(
      document.querySelector("#worldBuilderRegionHumanoidsInput")?.value
    ),

    factions: textareaToArray(
      document.querySelector("#worldBuilderRegionFactionsInput")?.value
    ),

    travelHazards: textareaToArray(
      document.querySelector("#worldBuilderRegionHazardsInput")?.value
    ),

    rumours: textareaToArray(
      document.querySelector("#worldBuilderRegionRumoursInput")?.value
    ),

    dmSecrets: textareaToArray(
      document.querySelector("#worldBuilderRegionSecretsInput")?.value
    ),

    updated: new Date().toISOString()
  };

  await window.dmAPI.saveRecord(
    "regions",
    regionId,
    updated,
    worldId
  );

  window.dmState.regions = await window.dmAPI.listRegions(worldId);

  await renderRegionInfo();

  alert("Region overview saved.");
}

async function searchWorldBuilderPlaces() {
  const searchInput = document.querySelector("#worldBuilderSearchInput");
  const typeInput = document.querySelector("#worldBuilderSearchTypeInput");
  const resultsPanel = document.querySelector("#worldBuilderSearchResults");

  if (!searchInput || !typeInput || !resultsPanel) return;

  const query = searchInput.value.trim().toLowerCase();
  const type = typeInput.value;

  if (!query) {
    resultsPanel.innerHTML = `<p>Enter a search term.</p>`;
    return;
  }

  const results = [];

  const worlds = await window.dmAPI.listWorlds();

  for (const world of worlds) {
    if (
      (type === "all" || type === "world") &&
      `${world.name || ""} ${world.id || ""}`.toLowerCase().includes(query)
    ) {
      results.push({
        type: "world",
        label: world.name || world.id,
        worldId: world.id,
        regionId: "",
        locationId: ""
      });
    }

    let regions = [];

    try {
      regions = await window.dmAPI.listRegions(world.id);
    } catch (error) {
      console.warn("Could not search regions for world:", world.id, error);
    }

    for (const region of regions) {
      if (
        (type === "all" || type === "region") &&
        `${region.name || ""} ${region.id || ""} ${region.summary || ""}`.toLowerCase().includes(query)
      ) {
        results.push({
          type: "region",
          label: `${region.name || region.id} / ${world.name || world.id}`,
          worldId: world.id,
          regionId: region.id,
          locationId: ""
        });
      }

      let locations = [];

      try {
        locations = await window.dmAPI.listLocations(region.id);
      } catch (error) {
        console.warn("Could not search locations for region:", region.id, error);
      }

      for (const location of locations) {
        if (
          (type === "all" || type === "location") &&
          `${location.name || ""} ${location.id || ""} ${location.summary || ""}`.toLowerCase().includes(query)
        ) {
          results.push({
            type: "location",
            label: `${location.name || location.id} / ${region.name || region.id} / ${world.name || world.id}`,
            worldId: world.id,
            regionId: region.id,
            locationId: location.id
          });
        }
      }
    }
  }

  if (!results.length) {
    resultsPanel.innerHTML = `<p>No matching places found.</p>`;
    return;
  }

  resultsPanel.innerHTML = results.map(result => `
    <button
      type="button"
      class="worldBuilderSearchResult"
      data-type="${escapeHtml(result.type)}"
      data-world-id="${escapeHtml(result.worldId)}"
      data-region-id="${escapeHtml(result.regionId)}"
      data-location-id="${escapeHtml(result.locationId)}"
    >
      <strong>${escapeHtml(result.type.toUpperCase())}</strong>
      ${escapeHtml(result.label)}
    </button>
  `).join("");

  resultsPanel.querySelectorAll(".worldBuilderSearchResult").forEach(button => {
    button.onclick = async () => {
      await jumpWorldBuilderToPlace({
        type: button.dataset.type,
        worldId: button.dataset.worldId,
        regionId: button.dataset.regionId,
        locationId: button.dataset.locationId
      });
    };
  });
}
async function jumpWorldBuilderToPlace(place) {
  const worldInput = document.querySelector("#worldBuilderWorldInput");
  const regionInput = document.querySelector("#worldBuilderRegionInput");
  const locationInput = document.querySelector("#worldBuilderLocationInput");

  if (!worldInput) return;

  if (place.worldId) {
    worldInput.value = place.worldId;
    await populateWorldBuilderRegions();
  }

  if (place.regionId && regionInput) {
    regionInput.value = place.regionId;
    await populateWorldBuilderLocations();
  }

  if (place.locationId && locationInput) {
    locationInput.value = place.locationId;
    await loadWorldBuilderLocationEditor();
  }

  await loadWorldBuilderRegionEditor();
}

function setupWorldBuilderControls() {
  const backBtn = document.querySelector("#backToCampaignAtlasBtn");
  const worldInput = document.querySelector("#worldBuilderWorldInput");
  const regionInput = document.querySelector("#worldBuilderRegionInput");
  const locationInput = document.querySelector("#worldBuilderLocationInput");

  const newWorldBtn = document.querySelector("#worldBuilderNewWorldBtn");
  const newRegionBtn = document.querySelector("#worldBuilderNewRegionBtn");
  const newLocationBtn = document.querySelector("#worldBuilderNewLocationBtn");
  const saveLocationBtn = document.querySelector("#worldBuilderSaveLocationBtn");
  const imageInput = document.querySelector("#worldBuilderLocationImageInput");
  const saveRegionBtn = document.querySelector("#worldBuilderSaveRegionBtn");

  const searchBtn = document.querySelector("#worldBuilderSearchBtn");
const searchInput = document.querySelector("#worldBuilderSearchInput");

if (searchBtn) {
  searchBtn.onclick = searchWorldBuilderPlaces;
}

if (searchInput) {
  searchInput.onkeydown = event => {
    if (event.key === "Enter") {
      searchWorldBuilderPlaces();
    }
  };
}

if (saveRegionBtn) {
  saveRegionBtn.onclick = saveWorldBuilderRegionOverview;
}

  if (backBtn) {
    backBtn.onclick = renderCampaignAtlas;
  }

  if (worldInput) {
    worldInput.onchange = async () => {
      await populateWorldBuilderRegions();
    };
  }

  if (regionInput) {
  regionInput.onchange = async () => {
    await populateWorldBuilderLocations();
      };
}

  if (locationInput) {
    locationInput.onchange = async () => {
      await loadWorldBuilderLocationEditor();
    };
  }

  if (newWorldBtn) {
    newWorldBtn.onclick = createWorldFromWorldBuilder;
  }

  if (newRegionBtn) {
    newRegionBtn.onclick = createRegionFromWorldBuilder;
  }

  if (newLocationBtn) {
    newLocationBtn.onclick = createLocationFromWorldBuilder;
  }

  if (saveLocationBtn) {
    saveLocationBtn.onclick = saveWorldBuilderLocation;
  }

  if (imageInput) {
    imageInput.onchange = handleWorldBuilderLocationImageSelected;
  }
}

async function populateWorldBuilderRegions() {
  const worldInput = document.querySelector("#worldBuilderWorldInput");
  const regionInput = document.querySelector("#worldBuilderRegionInput");
  const locationInput = document.querySelector("#worldBuilderLocationInput");

  if (!worldInput || !regionInput || !locationInput) return;

  const worldId = worldInput.value;

  regionInput.innerHTML = `<option value="">Loading regions...</option>`;
  locationInput.innerHTML = `<option value="">Select a region first...</option>`;

  const regions = worldId
    ? await window.dmAPI.listRegions(worldId)
    : [];

  if (!regions.length) {
    regionInput.innerHTML = `<option value="">No regions yet</option>`;
    locationInput.innerHTML = `<option value="">No locations yet</option>`;
    await loadWorldBuilderLocationEditor();
    return;
  }

  regionInput.innerHTML = regions.map(region => `
    <option value="${escapeHtml(region.id)}">
      ${escapeHtml(region.name || region.id)}
    </option>
  `).join("");

  regionInput.value =
    regions.find(region => region.id === window.dmState.current.region)?.id ||
    regions[0].id;

  await populateWorldBuilderLocations();
}

async function populateWorldBuilderLocations() {
  const regionInput = document.querySelector("#worldBuilderRegionInput");
  const locationInput = document.querySelector("#worldBuilderLocationInput");

  if (!regionInput || !locationInput) return;

  const regionId = regionInput.value;

  const locations = regionId
    ? await window.dmAPI.listLocations(regionId)
    : [];

  if (!locations.length) {
    locationInput.innerHTML = `<option value="">No locations yet</option>`;
    await loadWorldBuilderLocationEditor();
    return;
  }

  locationInput.innerHTML = locations.map(location => `
    <option value="${escapeHtml(location.id)}">
      ${escapeHtml(location.name || location.id)}
    </option>
  `).join("");

  locationInput.value =
    locations.find(location => location.id === window.dmState.current.location)?.id ||
    locations[0].id;

  await loadWorldBuilderLocationEditor();
}

async function createWorldFromWorldBuilder() {
  const name = await askUser("New world / plane name?");

  if (!name) return;

  const id = window.dmStorage.slugify(name);

  const world = {
    id,
    name,
    type: "world",
    summary: "",
    defaultThemeId: themeSettings.manualTheme || "merchant-vessel",
    calendar: {
      id: `${id}-calendar`,
      name: `${name} Calendar`,
      daysPerWeek: 7,
      weekName: "Week",
      months: [],
      seasons: [],
      moons: []
    },
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  await window.dmAPI.saveRecord("worlds", id, world, "global");

  await openWorldBuilderPanel();

  const worldInput = document.querySelector("#worldBuilderWorldInput");
  if (worldInput) {
    worldInput.value = id;
    await populateWorldBuilderRegions();
  }
}

async function createRegionFromWorldBuilder() {
  const worldInput = document.querySelector("#worldBuilderWorldInput");

  if (!worldInput?.value) {
    alert("Choose a world first.");
    return;
  }

  const name = await askUser("New region name?");

  if (!name) return;

  const id = window.dmStorage.slugify(name);
  const worldId = worldInput.value;

  const region = {
    id,
    name,
    worldId,
    parentWorldId: worldId,
    summary: "",
    environment: [],
    politics: [],
    culture: [],
    creatures: {
      common: [],
      dangerous: [],
      legendary: []
    },
    humanoids: [],
    factions: [],
    travelHazards: [],
    rumours: [],
    dmSecrets: [],
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  await window.dmAPI.saveRecord("regions", id, region, worldId);

  await populateWorldBuilderRegions();

  const regionInput = document.querySelector("#worldBuilderRegionInput");
  if (regionInput) {
    regionInput.value = id;
    await populateWorldBuilderLocations();
  }
}

async function createLocationFromWorldBuilder() {
  const worldInput = document.querySelector("#worldBuilderWorldInput");
  const regionInput = document.querySelector("#worldBuilderRegionInput");

  if (!worldInput?.value || !regionInput?.value) {
    alert("Choose a world and region first.");
    return;
  }

  const name = await askUser("New location name?");

  if (!name) return;

  const id = window.dmStorage.slugify(name);
  const worldId = worldInput.value;
  const regionId = regionInput.value;

  const location = {
    id,
    name,
    worldId,
    regionId,
    parentWorldId: worldId,
    parentRegionId: regionId,
    summary: "",
    environment: [],
politics: [],
culture: [],
factions: [],
landmarks: [],
localCreatures: [],
weatherTable: {
  id: `${id}-weather`,
  die: "d8",
  entries: []
},
dmTone: [],
rumours: [],
dmSecrets: [],
    backgroundDataUrl: "",
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  await window.dmAPI.saveRecord("locations", id, location, regionId);

  await populateWorldBuilderLocations();

  const locationInput = document.querySelector("#worldBuilderLocationInput");
  if (locationInput) {
    locationInput.value = id;
    await loadWorldBuilderLocationEditor();
  }
}

async function loadWorldBuilderLocationEditor() {
  const regionInput = document.querySelector("#worldBuilderRegionInput");
  const locationInput = document.querySelector("#worldBuilderLocationInput");
  const nameInput = document.querySelector("#worldBuilderLocationNameInput");
  const summaryInput = document.querySelector("#worldBuilderLocationSummaryInput");
  const preview = document.querySelector("#worldBuilderLocationPreview");

  if (!regionInput || !locationInput || !nameInput || !summaryInput || !preview) return;

  const regionId = regionInput.value;
  const locationId = locationInput.value;

  const setValue = (selector, value) => {
    const field = document.querySelector(selector);

    if (field) {
      field.value = arrayToTextarea(value);
    }
  };

    const clearLocationOverviewFields = () => {
  setValue("#worldBuilderLocationEnvironmentInput", "");
  setValue("#worldBuilderLocationPoliticsInput", "");
  setValue("#worldBuilderLocationCultureInput", "");
  setValue("#worldBuilderLocationLandmarksInput", "");
  setValue("#worldBuilderLocationLocalCreaturesInput", "");
  setValue("#worldBuilderLocationWeatherInput", "");
  setValue("#worldBuilderLocationHazardsInput", "");
  setValue("#worldBuilderLocationRumoursInput", "");
  setValue("#worldBuilderLocationSecretsInput", "");
  setValue("#worldBuilderLocationToneInput", "");
};

  nameInput.value = "";
  summaryInput.value = "";
  clearLocationOverviewFields();

  if (!regionId || !locationId) {
    preview.innerHTML = `<p>No location selected.</p>`;
    delete preview.dataset.backgroundDataUrl;
    return;
  }

  let location = null;

  try {
    location = await window.dmAPI.getRecord(locationId);
  } catch (error) {
    console.warn("Could not load location by id:", locationId, error);
  }

  if (!location) {
    const locations = await window.dmAPI.listLocations(regionId);
    location = locations.find(item => item.id === locationId);
  }

  if (!location) {
    preview.innerHTML = `<p>Location not found.</p>`;
    delete preview.dataset.backgroundDataUrl;
    return;
  }

  nameInput.value = location.name || "";
  summaryInput.value = location.summary || "";

    setValue("#worldBuilderLocationEnvironmentInput", location.environment);
setValue("#worldBuilderLocationPoliticsInput", location.politics);
setValue("#worldBuilderLocationCultureInput", location.culture);

setValue(
  "#worldBuilderLocationLandmarksInput",
  firstOverviewValue(
    location.landmarks,
    location.places,
    location.pointsOfInterest
  )
);

setValue(
  "#worldBuilderLocationLocalCreaturesInput",
  firstOverviewValue(
    location.localCreatures,
    location.creatures,
    location.wildlife
  )
);

setValue(
  "#worldBuilderLocationWeatherInput",
  weatherEntriesToTextarea(location.weatherTable?.entries || location.weatherEntries || [])
);

setValue("#worldBuilderLocationHazardsInput", location.travelHazards || location.hazards);
setValue("#worldBuilderLocationRumoursInput", location.rumours);
setValue("#worldBuilderLocationSecretsInput", location.dmSecrets || location.gmSecrets);
setValue("#worldBuilderLocationToneInput", location.dmTone || location.tone);

  const bg = location.backgroundDataUrl || location.background || "";

  if (bg) {
    preview.dataset.backgroundDataUrl = bg;

    preview.innerHTML = `
      <h3>${escapeHtml(location.name || location.id || "Selected Location")}</h3>
      <div
        class="worldBuilderImagePreview"
        style="background-image: url('${bg}')"
      ></div>
    `;
  } else {
    delete preview.dataset.backgroundDataUrl;

    preview.innerHTML = `
      <h3>${escapeHtml(location.name || location.id || "Selected Location")}</h3>
      <p>No background image selected.</p>
    `;
  }
}

function handleWorldBuilderLocationImageSelected(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    const preview = document.querySelector("#worldBuilderLocationPreview");

    if (preview) {
      preview.dataset.backgroundDataUrl = reader.result;

      preview.innerHTML = `
        <h3>New background selected — click Save Location to apply</h3>
        <div
          class="worldBuilderImagePreview"
          style="background-image: url('${reader.result}')"
        ></div>
      `;
    }
  };

  reader.readAsDataURL(file);
}

async function saveWorldBuilderLocation() {
  const worldInput = document.querySelector("#worldBuilderWorldInput");
  const regionInput = document.querySelector("#worldBuilderRegionInput");
  const locationInput = document.querySelector("#worldBuilderLocationInput");
  const nameInput = document.querySelector("#worldBuilderLocationNameInput");
  const summaryInput = document.querySelector("#worldBuilderLocationSummaryInput");
  const preview = document.querySelector("#worldBuilderLocationPreview");

  if (!worldInput?.value || !regionInput?.value || !locationInput?.value) {
    alert("Choose a world, region and location first.");
    return;
  }

  const locations = await window.dmAPI.listLocations(regionInput.value);
  const existing = locations.find(location => location.id === locationInput.value);

  if (!existing) {
    alert("Location not found.");
    return;
  }

  const weatherEntries = textareaToWeatherEntries(
    document.querySelector("#worldBuilderLocationWeatherInput")?.value
  );

  const updated = {
    ...existing,

    name: nameInput?.value.trim() || existing.name,
    summary: summaryInput?.value.trim() || "",

    worldId: worldInput.value,
    regionId: regionInput.value,
    parentWorldId: worldInput.value,
    parentRegionId: regionInput.value,

    backgroundDataUrl:
      preview?.dataset.backgroundDataUrl ||
      existing.backgroundDataUrl ||
      "",

    environment: textareaToArray(
      document.querySelector("#worldBuilderLocationEnvironmentInput")?.value
    ),

    politics: textareaToArray(
      document.querySelector("#worldBuilderLocationPoliticsInput")?.value
    ),

    culture: textareaToArray(
      document.querySelector("#worldBuilderLocationCultureInput")?.value
    ),

    landmarks: textareaToArray(
      document.querySelector("#worldBuilderLocationLandmarksInput")?.value
    ),

    localCreatures: textareaToArray(
      document.querySelector("#worldBuilderLocationLocalCreaturesInput")?.value
    ),

    weatherTable: {
      id: `${existing.id}-weather`,
      die: "d8",
      entries: weatherEntries
    },

    weatherEntries,

    travelHazards: textareaToArray(
      document.querySelector("#worldBuilderLocationHazardsInput")?.value
    ),

    rumours: textareaToArray(
      document.querySelector("#worldBuilderLocationRumoursInput")?.value
    ),

    dmSecrets: textareaToArray(
      document.querySelector("#worldBuilderLocationSecretsInput")?.value
    ),

    dmTone: textareaToArray(
      document.querySelector("#worldBuilderLocationToneInput")?.value
    ),

    updated: new Date().toISOString()
  };

  await window.dmAPI.saveRecord(
    "locations",
    updated.id,
    updated,
    regionInput.value
  );

  await window.dmAPI.saveRecord(
    "weather",
    `${updated.id}-weather`,
    {
      id: `${updated.id}-weather`,
      locationId: updated.id,
      worldId: updated.worldId,
      regionId: updated.regionId,
      die: "d8",
      entries: weatherEntries,
      updated: new Date().toISOString()
    },
    updated.id
  );

  window.dmState.current.world = worldInput.value;
  window.dmState.current.region = regionInput.value;
  window.dmState.current.location = updated.id;

  updateCurrentCampaignAtlasPosition();
  saveUiState();

  await setupStateBar();

  const locationSelect = document.querySelector("#locationSelect");

  if (locationSelect) {
    locationSelect.value = updated.id;
  }

  window.dmState.locations = await window.dmAPI.listLocations(regionInput.value);

  await applyCurrentTheme();
  await loadWorldBuilderLocationEditor();

  alert("Location saved and set as current location.");
}

function renderLocationThemeAssignments() {
console.log("Locations:", window.dmState.locations);
  const wrapper =
    document.querySelector("#locationThemeAssignments");

  if (!wrapper) return;

  const locations =
    window.dmState.locations || [];

  if (!locations.length) {
    wrapper.innerHTML =
      "<p>No locations loaded yet.</p>";
    return;
  }

  const buildOptions = selectedTheme =>
    installedThemes.map(theme => `
      <option value="${theme.id}"
        ${selectedTheme === theme.id ? "selected" : ""}>
        ${theme.name}
      </option>
    `).join("");

  wrapper.innerHTML =
    locations.map(location => {

      const locationId =
        location.id || location;

      const locationName =
        location.name || locationId;

      const assigned =
        themeSettings.locationThemes?.[locationId] ||
        location.defaultThemeId ||
        window.dmState.defaultLocationThemes?.[locationId] ||
        themeSettings.manualTheme ||
        "merchant-vessel";

      return `
        <div class="locationThemeRow">
          <span>${locationName}</span>
          <select
            class="locationThemeSelect"
            data-location="${locationId}">
            ${buildOptions(assigned)}
          </select>
        </div>
      `;

    }).join("");

  document
    .querySelectorAll(".locationThemeSelect")
    .forEach(select => {

      select.onchange = async () => {
        themeSettings.locationThemes[select.dataset.location] =
          select.value;
        await saveThemeSettings();
      };

    });

}


// ===========================
// APP STARTUP
// ===========================


async function initialiseApp() {
  if (!window.MasterForgeRelationshipEngine) {
    throw new Error(
      "Universal Relationship Engine failed to load."
    );
  }

  console.log(
    "RELATIONSHIP ENGINE READY:",
    window.MasterForgeRelationshipEngine.version
  );

  const settings =
    await window.dmAPI.getSettings();


  document
    .querySelector("#dataPathDisplay")
    .innerText =
    settings.dataPath;


  loadUiState();

await window.dmStorage.initialise();

await loadCampaignAtlasRecordsFromDatabase();
refreshCampaignListFromAtlasRecords();
if (window.dmState.current.campaign && !window.dmState.campaigns.includes(window.dmState.current.campaign)) {
  window.dmState.current.campaign = null;
  window.dmState.current.systemId = null;
  window.dmState.current.world = null;
  window.dmState.current.region = null;
  window.dmState.current.location = null;
  saveUiState();
}
ensureCurrentCampaignAtlasRecord();


if (window.dmState.current.campaign) {
  await window.dmStorage.ensureCampaign(window.dmState.current.campaign);
}

try {
  if (window.dmState.current.campaign) await syncCampaignPartyEntity(window.dmState.current.campaign);
} catch (error) {
  console.warn("Could not sync the current campaign party:", error);
}

await migrateCampaignPartyEntities();


  setupWindowButtons();
  setupWorkflowShell();
  setupTabs();
  setupDataPathButton();

  await setupStateBar();

  await initialiseThemeSystem();
await applyCurrentTheme();


  await setupStoryModule();
  await setupSessionPrepModule();
  await setupSessionFieldModal();
  await setupPartyModule();
  await updatePartySummaryFromActiveCharacters();


  setupRegionModule();
  await renderRegionInfo();


  await setupEncounterModule();
  setupLootModule();
  try {
  setupCreatureModule();
} catch (error) {
  console.error("Creature module failed:", error);
}

try {
  setupForgeSearchModule();
} catch (error) {
  console.error("Forge Search module failed:", error);
}

try {
  setupNpcModule();
} catch (error) {
  console.error("NPC module failed:", error);
}

try {
  setupFactionModule();
} catch (error) {
  console.error("Faction module failed:", error);
}

try {
  setupWorldModule();
} catch (error) {
  console.error("World module failed:", error);
}


  const worldNoteType = document.querySelector("#worldNoteType");

  if (worldNoteType) {
   worldNoteType.onchange = renderWorldNotes;
  }

await openHomeOnStartup();

}

function setupWindowButtons() {
  document.querySelector("#closeBtn").onclick = () => {
    if (!confirmDiscardPlannedEncounterChanges()) return;
    if (!confirmDiscardFactionHierarchyChanges()) return;
    window.dmAPI.closeWindow();
  };

  document.querySelector("#minBtn").onclick = () => {
    window.dmAPI.minimizeWindow();
  };
}

function setupTabs() {
  const tabs = document.querySelectorAll("#tabs .tab");

  tabs.forEach((tab) => {
    tab.onclick = async () => {
      const targetId = tab.dataset.tab;
      const targetPanel = targetId === "story"
        ? document.querySelector("#session")
        : document.querySelector(`#${targetId}`);

      if (!targetPanel) {
        console.error(`No panel found for tab: ${targetId}`);
        alert(`No panel found for tab: ${targetId}`);
        return;
      }

      if (!activateMainPanel(tab, targetPanel)) return;

      if (targetId === "story") {
        await openNarrationWorkspace();
      } else if (targetId === "session") {
        closeNarrationWorkspace();
      }

      if (targetId === "settings") {
        await buildThemeSettingsPanel();
        setupDataPathButton();
      }

      if (targetId === "world") {
  await renderCampaignAtlas();
}

      if (targetId === "entities") {
        await loadEntityDebugPanel();
      }

      if (targetId === "encounters") {
        await renderPlannedEncounterWorkspace({ preserveSelection: true });
      }

      if (targetId === "combat-operations") {
        await window.MasterForgeCombatOps?.open();
      }

      console.log("Opened tab:", targetId);
      console.log("Active panel:", document.querySelector(".panel.active-panel")?.id);
    };
  });
}

async function openNarrationWorkspace() {
  if (!document.querySelector("#sessionPrompterSlideDown")) {
    await mountSessionPrompterPanel();
  }
  const mount = document.querySelector("#sessionPrompterSlideDown");
  if (!mount) return;
  mount.classList.remove("hidden");
  const context = document.querySelector("#sessionPrompterContext");
  if (currentSessionId) {
    await ensureDefaultSessionPrompt();
    await refreshScriptList();
    if (context) {
      const title = document.querySelector("#sessionTitleInput")?.value || "Current Session";
      context.textContent = `${title} prompts and read-aloud scripts.`;
    }
  } else {
    await refreshScriptList();
    if (context) context.textContent = "Select or create a session to prepare session-linked narration.";
  }
  document.querySelector("#openSessionPrompterBtn")?.setAttribute("aria-expanded", "true");
  mount.scrollIntoView({ block: "start" });
}

function closeNarrationWorkspace() {
  const mount = document.querySelector("#sessionPrompterSlideDown");
  if (mount) mount.classList.add("hidden");
  document.querySelector("#openSessionPrompterBtn")?.setAttribute("aria-expanded", "false");
}

const WORKFLOW_NAV_STORAGE_KEY = "masterforge.workflowNavigation.v1";
const WORKFLOW_DEFAULT_ROUTES = Object.freeze({
  "in-game": "combat-operations",
  "pre-game": "session",
  "world-building": "world",
  settings: "settings"
});

function readWorkflowNavigationState() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORKFLOW_NAV_STORAGE_KEY) || "{}");
    const migratedGroup = saved.activeWorkspaceGroup ||
      (Array.isArray(saved.expandedWorkspaceGroups) ? saved.expandedWorkspaceGroups[0] : null);
    return {
      activeWorkspaceGroup: migratedGroup || null
    };
  } catch (error) {
    console.warn("Could not load workflow navigation preferences:", error);
    return { activeWorkspaceGroup: null };
  }
}

function saveWorkflowNavigationState() {
  const activeWorkspaceGroup = document.querySelector("[data-workspace-group].active-workspace")?.dataset.workspaceGroup || null;
  try { localStorage.setItem(WORKFLOW_NAV_STORAGE_KEY, JSON.stringify({ activeWorkspaceGroup })); }
  catch (error) { console.warn("Could not save workflow navigation preferences:", error); }
}

function setActiveWorkflowGroup(groupId, { persist = true } = {}) {
  document.querySelectorAll("[data-workspace-group]").forEach(group => {
    const active = Boolean(groupId) && group.dataset.workspaceGroup === groupId;
    const heading = group.querySelector(".workflow-nav-heading");
    const children = group.querySelector(".workflow-nav-children");
    group.classList.toggle("active-workspace", active);
    heading.setAttribute("aria-expanded", String(active));
    children.hidden = !active;
    heading.querySelector("span").textContent = active ? "−" : "+";
  });
  if (persist) saveWorkflowNavigationState();
}

function openWorkflowGroup(groupId) {
  const route = WORKFLOW_DEFAULT_ROUTES[groupId];
  const button = document.querySelector(`#tabs [data-workspace-group="${groupId}"] .tab[data-tab="${route}"]`);
  if (button) button.click();
}

function setupWorkflowShell() {
  const saved = readWorkflowNavigationState();
  document.querySelectorAll("[data-workspace-group]").forEach(group => {
    const heading = group.querySelector(".workflow-nav-heading");
    heading.onclick = () => {
      const isOpen = heading.getAttribute("aria-expanded") === "true";
      setActiveWorkflowGroup(isOpen ? null : group.dataset.workspaceGroup);
    };
  });
  setActiveWorkflowGroup(saved.activeWorkspaceGroup, { persist: false });
  document.querySelectorAll("[data-home-workspace]").forEach(button => { button.onclick = () => openWorkflowGroup(button.dataset.homeWorkspace); });
  window.MasterForgeActionConsole?.initialise();
  document.querySelector("#actionConsoleToggle").onclick = () => window.MasterForgeActionConsole?.toggle();
  registerMasterForgeActionWorkspaces();
}

function registerMasterForgeActionWorkspaces() {
  const consoleApi = window.MasterForgeActionConsole;
  if (!consoleApi) return;
  consoleApi.registerWorkspace("encounters", { actions: [
    { id: "new-encounter", label: "New Encounter", groupId: "record", groupLabel: "Encounter", order: 10, handler: startNewPlannedEncounter },
    { id: "save-encounter", label: "Save Encounter", groupId: "record", groupLabel: "Encounter", order: 20, enabled: () => Boolean(plannedEncounterUiState.editorRecord), disabledReason: "Create or select an encounter first.", handler: savePlannedEncounter },
    { id: "duplicate-encounter", label: "Duplicate Encounter", groupId: "record", groupLabel: "Encounter", order: 30, enabled: () => Boolean(plannedEncounterUiState.selectedId), disabledReason: "Select a saved encounter first.", handler: () => duplicatePlannedEncounter(plannedEncounterUiState.selectedId) },
    { id: "delete-encounter", label: "Delete Encounter", groupId: "lifecycle", groupLabel: "Lifecycle", order: 40, danger: true, enabled: () => Boolean(plannedEncounterUiState.selectedId), disabledReason: "Select a saved encounter first.", handler: () => deletePlannedEncounter(plannedEncounterUiState.selectedId) },
    { id: "add-participant", label: "Add Participant", groupId: "participants", groupLabel: "Participants", order: 10, enabled: () => Boolean(plannedEncounterUiState.editorRecord), disabledReason: "Create or select an encounter first.", handler: () => { plannedEncounterUiState.participantPickerOpen = true; renderPlannedEncounterWorkspaceContents(); } },
    { id: "complete-encounter", label: "Mark Completed", groupId: "lifecycle", groupLabel: "Lifecycle", order: 10, visible: () => Boolean(plannedEncounterUiState.editorRecord) && plannedEncounterUiState.editorRecord.status !== "completed", handler: async () => { plannedEncounterUiState.editorRecord.status = "completed"; plannedEncounterUiState.editorRecord.completedAt = new Date().toISOString(); plannedEncounterUiState.dirty = true; await savePlannedEncounter(); } },
    { id: "archive-encounter", label: "Archive", groupId: "lifecycle", groupLabel: "Lifecycle", order: 20, visible: () => Boolean(plannedEncounterUiState.editorRecord) && plannedEncounterUiState.editorRecord.status !== "archived", handler: async () => { plannedEncounterUiState.editorRecord.status = "archived"; plannedEncounterUiState.editorRecord.archivedAt = new Date().toISOString(); plannedEncounterUiState.dirty = true; await savePlannedEncounter(); } },
    { id: "restore-encounter", label: "Restore", groupId: "lifecycle", groupLabel: "Lifecycle", order: 30, visible: () => plannedEncounterUiState.editorRecord?.status === "archived", handler: async () => { plannedEncounterUiState.editorRecord.status = "planned"; plannedEncounterUiState.editorRecord.archivedAt = ""; plannedEncounterUiState.dirty = true; await savePlannedEncounter(); } }
  ] });
  const combatApi = () => window.MasterForgeCombatOps;
  const hasCombatant = () => Boolean(combatApi()?.getActiveCombatant());
  const activeCombat = () => combatApi()?.state?.mode === "active";
  consoleApi.registerWorkspace("combat-operations", { title: "Combat Actions", actions: [
    { id: "combat-start", label: "Start Combat", groupId: "combat", groupLabel: "Combat", groupOrder: 0, order: 10, visible: () => combatApi()?.state?.mode === "initiative", enabled: () => Boolean(combatApi()?.state?.combatants?.length) && combatApi().state.combatants.every(combatApi().isCombatantReady), disabledReason: "Complete AC and HP for every combatant.", handler: () => combatApi()?.startCombat() },
    { id: "combat-previous", label: "Previous Turn", groupId: "combat", groupLabel: "Combat", order: 20, visible: activeCombat, handler: () => combatApi()?.nextTurn(-1) },
    { id: "combat-next", label: "Next Turn", groupId: "combat", groupLabel: "Combat", order: 30, visible: activeCombat, handler: () => combatApi()?.nextTurn(1) },
    { id: "combat-end", label: "End Combat", groupId: "combat", groupLabel: "Combat", order: 40, danger: true, visible: () => ["setup", "initiative", "active"].includes(combatApi()?.state?.mode), handler: () => combatApi()?.endCombat() },
    ...[1,5,10,20].map((amount, order) => ({ id: `combat-damage-${amount}`, label: `Damage ${amount}`, groupId: "hit-points", groupLabel: "Hit Points", groupOrder: 10, order, enabled: () => hasCombatant() && combatApi().getActiveCombatant().hp != null, disabledReason: "The active combatant has no HP value.", handler: () => combatApi()?.adjustHp(-amount) })),
    ...[1,5,10].map((amount, order) => ({ id: `combat-heal-${amount}`, label: `Heal ${amount}`, groupId: "hit-points", groupLabel: "Hit Points", groupOrder: 10, order: order + 10, enabled: () => hasCombatant() && combatApi().getActiveCombatant().hp != null, disabledReason: "The active combatant has no HP value.", handler: () => combatApi()?.adjustHp(amount) })),
    { id: "combat-condition-add", label: "Add Condition", groupId: "conditions", groupLabel: "Conditions", groupOrder: 20, order: 10, enabled: hasCombatant, handler: () => combatApi()?.addCondition() },
    { id: "combat-condition-remove", label: "Remove Condition", groupId: "conditions", groupLabel: "Conditions", order: 20, enabled: () => Boolean(combatApi()?.getActiveCombatant()?.conditions?.length), disabledReason: "The active combatant has no conditions.", handler: () => combatApi()?.removeCondition() },
    { id: "combat-unconscious", label: "Mark Unconscious", groupId: "conditions", groupLabel: "Conditions", order: 30, enabled: () => hasCombatant() && combatApi().getActiveCombatant().status !== "Unconscious", handler: () => combatApi()?.setActiveStatus("Unconscious") },
    { id: "combat-active", label: "Restore Active", groupId: "conditions", groupLabel: "Conditions", order: 40, enabled: () => hasCombatant() && combatApi().getActiveCombatant().status !== "Active", handler: () => combatApi()?.setActiveStatus("Active") },
    { id: "combat-participant-add", label: "Add Late Participant", groupId: "participants", groupLabel: "Participants", groupOrder: 30, order: 10, visible: () => combatApi()?.state?.mode !== "selection", handler: () => combatApi()?.addLateParticipant() },
    { id: "combat-participant-remove", label: "Remove Active Participant", groupId: "participants", groupLabel: "Participants", order: 20, danger: true, enabled: hasCombatant, handler: () => combatApi()?.removeActiveParticipant() }
  ] });
  consoleApi.registerWorkspace("region", { actions: [
    { id: "refresh-location", label: "Refresh Location", groupId: "location", groupLabel: "Location", order: 10, handler: renderRegionInfo },
    { id: "edit-location", label: "Open Full Location Management", groupId: "location", groupLabel: "Location", order: 20, handler: () => document.querySelector('#tabs [data-workspace-group="world-building"] .tab[data-tab="world"]')?.click() }
  ] });
  consoleApi.registerWorkspace("entities", { actions: [
    { id: "browse-search", label: "Search entities", groupId: "browse", groupLabel: "Browse", groupOrder: -20, order: 10,
      renderControl: () => `<label>Search entities<input id="entitySearchInput" type="search" autocomplete="off" value="${escapeHtml(activeEntitySearchTerm)}" placeholder="Search entities..."></label>`,
      bindControl: host => { const input = host.querySelector("#entitySearchInput"); if (input) input.oninput = () => { activeEntitySearchTerm = input.value; renderEntityIndexResults(); }; } },
    { id: "browse-type", label: "Entity Type", groupId: "browse", groupLabel: "Browse", groupOrder: -20, order: 20,
      renderControl: () => `<label>Entity Type<select id="entityTypeFilterInput">${ENTITY_LIBRARY_TYPE_FILTER_OPTIONS.map(([value, label]) => `<option value="${value}" ${activeEntityTypeFilter === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`,
      bindControl: host => { const input = host.querySelector("#entityTypeFilterInput"); if (input) input.onchange = () => { activeEntityTypeFilter = input.value || "all"; renderEntityIndexResults(); }; } },
    { id: "browse-scope", label: "Scope", groupId: "browse", groupLabel: "Browse", groupOrder: -20, order: 30,
      renderControl: () => `<label>Scope<select id="entityScopeFilterInput"><option value="current-location">Current Location</option><option value="current-world">Current World</option><option value="current-system">Current System</option><option value="all">All</option></select></label>`,
      bindControl: host => { const input = host.querySelector("#entityScopeFilterInput"); if (input) { input.value = activeEntityScopeFilter; input.onchange = () => { activeEntityScopeFilter = input.value; renderEntityIndexResults(); }; } } },
    { id: "browse-visibility", label: "Visibility", groupId: "browse", groupLabel: "Browse", groupOrder: -20, order: 40,
      renderControl: () => `<label>Visibility<select id="entityVisibilityFilterInput"><option value="active">Active Only</option><option value="pinned">Pinned</option><option value="hidden">Hidden</option><option value="archived">Archived</option><option value="all">All</option></select></label>`,
      bindControl: host => { const input = host.querySelector("#entityVisibilityFilterInput"); if (input) { input.value = activeEntityVisibilityFilter; input.onchange = () => { activeEntityVisibilityFilter = input.value; renderEntityIndexResults(); }; } } },
    { id: "new-entity", label: "New Record", groupId: "record", groupLabel: "Record", order: 10, handler: () => showGenericEntityBuilder(getDefaultGenericEntity(entityBuilderState.activeEntityType || "faction")) },
    { id: "save-entity", label: "Save Record", groupId: "record", groupLabel: "Record", order: 20, enabled: () => Boolean(entityBuilderState.activeEntity), disabledReason: "Open or create a record first.", handler: saveGenericEntityFromBuilder },
    { id: "delete-entity", label: "Delete Record", groupId: "lifecycle", groupLabel: "Lifecycle", order: 30, danger: true, enabled: () => Boolean(entityBuilderState.activeEntityId), disabledReason: "Select a saved record first.", handler: deleteGenericEntityFromBuilder },
    { id: "copy-faction-hierarchy", label: "Copy Hierarchy From Faction", groupId: "hierarchy", groupLabel: "Hierarchy", order: 10, visible: () => entityBuilderState.activeEntityType === "faction", enabled: () => Boolean(entityBuilderState.activeEntityId), disabledReason: "Save the target faction first.", handler: openCopyFactionHierarchyDialog }
  ] });
}

async function openCopyFactionHierarchyDialog() {
  if (!entityBuilderState.activeEntityId || entityBuilderState.activeEntityType !== "faction") return;
  if (hasUnsavedFactionHierarchyChanges() && !confirmDiscardFactionHierarchyChanges()) return;
  if (hasUnsavedFactionHierarchyChanges()) discardUnsavedFactionHierarchyChanges();
  const targetId = entityBuilderState.activeEntityId;
  const factions = (await window.dmAPI.getEntitiesByType("faction")).filter(faction => faction.id !== targetId);
  const choices = factions.map(faction => {
    const count = getFactionHierarchyApi().normaliseFactionHierarchy(faction.data_json || {}).nodes.length;
    return { faction, count };
  });
  const backdrop = document.createElement("div");
  backdrop.className = "plannedEncounterPickerBackdrop factionHierarchyCopyBackdrop";
  backdrop.innerHTML = `<section class="factionHierarchyCopyDialog" role="dialog" aria-modal="true" aria-labelledby="copyFactionHierarchyTitle"><header><div><h2 id="copyFactionHierarchyTitle">Copy Hierarchy From Faction</h2><p>Copy structure only. Members, leaders and relationships are never copied.</p></div><button type="button" data-copy-close>Close</button></header><label>Search factions<input type="search" data-copy-search placeholder="Search factions"></label><label>Source faction<select data-copy-source><option value="">Choose a faction</option>${choices.map(({ faction, count }) => `<option value="${escapeHtml(faction.id)}" ${count ? "" : "disabled"}>${escapeHtml(faction.name || faction.id)} — ${count} node${count === 1 ? "" : "s"}</option>`).join("")}</select></label><div data-copy-preview class="infoCard"><p class="forgeEmptyState">Choose a source faction to preview its hierarchy.</p></div><fieldset><legend>Copy mode</legend><label><input type="radio" name="faction-copy-mode" value="merge" checked> Merge — add fresh copies beside existing nodes</label><label><input type="radio" name="faction-copy-mode" value="replace"> Replace — remove the target structure</label></fieldset><label><input type="checkbox" data-copy-packs checked> Copy Ability Pack references</label><p data-copy-warning class="factionValidation warning hidden"></p><footer><button type="button" data-copy-confirm disabled>Copy Hierarchy</button><button type="button" data-copy-close>Cancel</button></footer></section>`;
  document.body.appendChild(backdrop);
  const sourceInput = backdrop.querySelector("[data-copy-source]");
  const preview = backdrop.querySelector("[data-copy-preview]");
  const confirmButton = backdrop.querySelector("[data-copy-confirm]");
  const warning = backdrop.querySelector("[data-copy-warning]");
  const close = () => { backdrop.remove(); document.querySelector('#actionConsoleToggle')?.focus(); };
  backdrop.querySelectorAll("[data-copy-close]").forEach(button => button.onclick = close);
  backdrop.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
  backdrop.querySelector("[data-copy-search]").oninput = event => {
    const term = event.target.value.trim().toLowerCase();
    [...sourceInput.options].forEach((option, index) => { if (index) option.hidden = Boolean(term) && !option.textContent.toLowerCase().includes(term); });
  };
  sourceInput.onchange = () => {
    const selected = choices.find(item => item.faction.id === sourceInput.value);
    confirmButton.disabled = !selected?.count;
    preview.innerHTML = selected ? `<h3>${escapeHtml(selected.faction.name || selected.faction.id)}</h3><ol>${getFactionHierarchyApi().sortFactionHierarchyNodes(getFactionHierarchyApi().normaliseFactionHierarchy(selected.faction.data_json || {}).nodes).map(node => `<li>${escapeHtml(node.name || "Unnamed node")} <small>${escapeHtml(node.nodeType)}</small></li>`).join("")}</ol>` : `<p class="forgeEmptyState">Choose a source faction to preview its hierarchy.</p>`;
  };
  backdrop.querySelectorAll('input[name="faction-copy-mode"]').forEach(input => input.onchange = async () => {
    if (input.value !== "replace" || !input.checked) { warning.classList.add("hidden"); return; }
    const memberships = await getFactionMembershipRelationships(targetId);
    const assigned = memberships.filter(item => item.data_json?.factionRankId || item.data?.factionRankId);
    warning.textContent = assigned.length ? `Replace is blocked: ${assigned.length} membership assignment${assigned.length === 1 ? "" : "s"} reference existing hierarchy nodes.` : "Replace removes every existing target node. This cannot be undone until the faction is saved.";
    warning.classList.remove("hidden");
    confirmButton.disabled = !sourceInput.value || assigned.length > 0;
  });
  confirmButton.onclick = async () => {
    const selected = choices.find(item => item.faction.id === sourceInput.value);
    if (!selected) return;
    const mode = backdrop.querySelector('input[name="faction-copy-mode"]:checked').value;
    if (mode === "replace" && !confirm("Replace the target hierarchy? Existing nodes will be removed when you save the faction.")) return;
    const result = getFactionHierarchyApi().copyFactionHierarchy(
      getFactionHierarchyApi().normaliseFactionHierarchy(selected.faction.data_json || {}),
      entityBuilderState.factionHierarchy,
      { mode, includeAbilityPacks: backdrop.querySelector("[data-copy-packs]").checked }
    );
    entityBuilderState.factionHierarchy = result.hierarchy;
    entityBuilderState.factionHierarchyDirty = true;
    entityBuilderState.factionWorkspaceTab = "hierarchy";
    close();
    await switchFactionWorkspace("hierarchy");
    alert(`${result.copiedNodeCount} hierarchy node${result.copiedNodeCount === 1 ? "" : "s"} copied. Save the faction to persist the change.${result.warnings.length ? `\n\n${result.warnings.join("\n")}` : ""}`);
  };
  sourceInput.focus();
}

async function openHomeOnStartup() {
  const campaigns = Array.isArray(window.dmState.campaigns)
    ? window.dmState.campaigns
    : [];

  if (campaigns.length === 0) {
    const tab = document.querySelector(
      '#tabs .tab[data-tab="world"]'
    );

    const panel = document.querySelector("#world");

    activateMainPanel(tab, panel);

    await openCampaignCreationWizard();
    return;
  }

  const tab = document.querySelector(
    '#tabs .tab[data-tab="home"]'
  );

  const panel = document.querySelector("#home");

  activateMainPanel(tab, panel);
}

function setupDataPathButton() {
  const modal = document.querySelector("#dataModal");
  const openBtn = document.querySelector("#openDataModalBtn");
  const closeBtn = document.querySelector("#closeDataModalBtn");
  const chooseBtn = document.querySelector("#chooseDataPathBtn");
  const dataPathDisplay = document.querySelector("#dataPathDisplay");
  const settingsDataPathDisplay = document.querySelector("#settingsDataPathDisplay");

  if (!modal || !openBtn || !closeBtn || !chooseBtn) {
    console.warn("Data path modal controls not ready, skipping setupDataPathButton.");
    return;
  }

  openBtn.onclick = () => {
    modal.classList.remove("hidden");
  };

  closeBtn.onclick = () => {
    modal.classList.add("hidden");
  };

  chooseBtn.onclick = async () => {
    const settings = await window.dmAPI.chooseDataPath();

    if (dataPathDisplay && settings?.dataPath) {
      dataPathDisplay.innerText = settings.dataPath;
    }

    if (settingsDataPathDisplay && settings?.dataPath) {
      settingsDataPathDisplay.innerText = settings.dataPath;
    }
  };
}

async function setupStateBar() {
  const state = window.dmState.current;

  const worldSelect = document.querySelector("#worldSelect");
  const campaignSelect = document.querySelector("#campaignSelect");
  const regionSelect = document.querySelector("#regionSelect");
  const locationSelect = document.querySelector("#locationSelect");

  const worlds = await window.dmAPI.listWorlds();
  window.dmState.worlds = worlds;

  if (!worlds.some((w) => w.id === state.world)) {
    state.world = worlds[0]?.id || null;
  }

  fillObjectSelect(worldSelect, worlds, state.world);

  const regions = state.world
    ? await window.dmAPI.listRegions(state.world)
    : [];

  window.dmState.regions = regions;

  if (!regions.some((r) => r.id === state.region)) {
    state.region = regions[0]?.id || null;
  }

  fillObjectSelect(regionSelect, regions, state.region);

  const locations = state.region
    ? await window.dmAPI.listLocations(state.region)
    : [];

  window.dmState.locations = locations;

  if (!locations.some((l) => l.id === state.location)) {
    state.location = locations[0]?.id || null;
  }

  fillObjectSelect(locationSelect, locations, state.location);

  fillCampaignSelect(campaignSelect, window.dmState.campaigns, state.campaign);

  renderLocationThemeAssignments();

  worldSelect.onchange = async () => {
  state.world = worldSelect.value;
  state.region = null;
  state.location = null;

  updateCurrentCampaignAtlasPosition();
  saveUiState();

  await setupStateBar();

  await refreshCurrentContextViews({
    refreshEntities: true,
    refreshCampaignAtlasPanel: true
  });
};

  campaignSelect.onchange = async () => {
  const selectedCampaignId = campaignSelect.value;
  const previousCampaignId = window.dmState.current.campaign;

  if (selectedCampaignId === previousCampaignId) return;

  if (!confirmDiscardPlannedEncounterChanges()) {
    campaignSelect.value = previousCampaignId || "";
    return;
  }

  const applied = applyCampaignAtlasRecordToState(selectedCampaignId);

  if (!applied) {
    window.dmState.current.campaign = selectedCampaignId;
    ensureCurrentCampaignAtlasRecord();
    applyCampaignAtlasRecordToState(selectedCampaignId);
  }

  updateCurrentCampaignAtlasPosition();

  saveUiState();

  let plannedEncounterRefresh = null;
  const encountersPanelIsActive = document.querySelector("#encounters")?.classList.contains("active-panel");
  clearPlannedEncounterStateForScopeChange();
  if (encountersPanelIsActive) {
    renderPlannedEncounterWorkspaceContents();
    plannedEncounterRefresh = renderPlannedEncounterWorkspace({ preserveSelection: false });
  }

  await window.dmStorage.ensureCampaign(window.dmState.current.campaign);

  try {
    await syncCampaignPartyEntity(window.dmState.current.campaign);
  } catch (error) {
    console.warn("Could not sync the selected campaign party:", error);
  }

  await setupStateBar();

if (plannedEncounterRefresh) {
  await plannedEncounterRefresh;
}

await refreshCurrentContextViews({
  refreshEntities: true,
  refreshCampaignAtlasPanel: true
});
  currentSessionId = null;
currentSessionSelectedCreatureIds = [];
currentSessionSelectedNpcIds = [];

await refreshScriptList();
await renderSessionList();
await renderSessionCastSelectors();

setTimeout(() => {
  setupSessionCastPicker();
}, 0);

clearSessionPrepEditor();

await renderParty();
await updatePartySummaryFromActiveCharacters();

if (typeof renderCreatureList === "function") {
  await renderCreatureList();
}

};

  regionSelect.onchange = async () => {
  state.region = regionSelect.value;
  state.location = null;

  updateCurrentCampaignAtlasPosition();
  saveUiState();

  await setupStateBar();

  await refreshCurrentContextViews({
    refreshEntities: true,
    refreshCampaignAtlasPanel: true
  });
};

    locationSelect.onchange = async () => {
  state.location = locationSelect.value;

  updateCurrentCampaignAtlasPosition();
  saveUiState();

  await refreshCurrentContextViews({
    refreshEntities: true,
    refreshCampaignAtlasPanel: true
  });
};

  locationSelect.onchange = async () => {
    state.location = locationSelect.value;

    updateCurrentCampaignAtlasPosition();
    saveUiState();

    await refreshCurrentContextViews({
      refreshEntities: true,
      refreshCampaignAtlasPanel: true
    });
  };
}


async function refreshCurrentContextViews(options = {}) {
  const {
    refreshEntities = true,
    refreshCampaignAtlasPanel = false
  } = options;

  try {
    await renderRegionInfo();
  } catch (error) {
    console.warn("Could not refresh Region view:", error);
  }

  try {
    renderLocationThemeAssignments();
  } catch (error) {
    console.warn("Could not refresh location theme assignments:", error);
  }

  try {
    await applyCurrentTheme();
  } catch (error) {
    console.warn("Could not apply current theme:", error);
  }

  if (refreshCampaignAtlasPanel) {
    try {
      await renderCampaignAtlas();
    } catch (error) {
      console.warn("Could not refresh Campaign Atlas:", error);
    }
  }

  if (refreshEntities && typeof loadEntityDebugPanel === "function") {
    const entitiesPanel = document.querySelector("#entities");
    const entitiesIsActive =
      entitiesPanel?.classList.contains("active-panel") ||
      !!document.querySelector("#entityRelationshipMapRoot");

    if (entitiesIsActive) {
      try {
        currentlySelectedEntity = null;
        await loadEntityDebugPanel();
      } catch (error) {
        console.warn("Could not refresh Entity Library:", error);
      }
    }
  }

  if (typeof renderNpcList === "function") {
    try {
      await renderNpcList();
    } catch (error) {
      console.warn("Could not refresh NPC list:", error);
    }
  }

  if (typeof renderCreatureList === "function") {
    try {
      await renderCreatureList();
    } catch (error) {
      console.warn("Could not refresh Creature list:", error);
    }
  }
}

async function loadRegionsForCurrentLocation() {
  console.warn(
    "loadRegionsForCurrentLocation is deprecated. Regions now load from the selected world."
  );
}

function fillObjectSelect(select, items, selectedValue) {
  select.innerHTML = "";

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });

  select.value = selectedValue;
}

function fillSelect(select, options, selectedValue) {
  select.innerHTML = "";

  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.value = selectedValue;
}

function renderRegionOptions() {
  const state = window.dmState.current;
  const regionSelect = document.querySelector("#regionSelect");
  const regions = window.dmState.regionsByLocation[state.location] || [];

  if (!regions.includes(state.region)) {
    state.region = regions[0] || "";
  }

  fillSelect(regionSelect, regions, state.region);
}

function renderPlayerLevels() {
  const wrapper = document.querySelector("#playerLevelInputs");
  wrapper.innerHTML = "";

  window.dmState.current.partyLevels.forEach((level, index) => {
    const input = document.createElement("select");
    input.className = "playerLevelInput";

    for (let i = 1; i <= 20; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = i;
      input.appendChild(option);
    }

    input.value = level;

    input.onchange = () => {
      window.dmState.current.partyLevels[index] = Number(input.value);
      updatePartySummary();
      saveUiState();
    };

    wrapper.appendChild(input);
  });
}

function updatePartySummary() {
  const avg = window.dmState.getAverageLevel();
  document.querySelector("#avgLevelDisplay").innerText = avg;
  document.querySelector("#tierDisplay").innerText = window.dmState.getTier(avg);
}

function saveUiState() {
  localStorage.setItem("masterForgeState", JSON.stringify(window.dmState.current));
}

function loadUiState() {
  const saved = localStorage.getItem("masterForgeState");

  if (!saved) return;

  window.dmState.current = {
    ...window.dmState.current,
    ...JSON.parse(saved)
  };
}

let currentScriptFile = null;
let promptRunning = false;
let promptY = window.innerHeight;

let promptSpeed = Number(localStorage.getItem("promptSpeed")) || 0.6;
let promptFontSize = Number(localStorage.getItem("promptFontSize")) || 46;
let storyOpacity = localStorage.getItem("storyOpacity") !== null
  ? Number(localStorage.getItem("storyOpacity"))
  : 90;
let promptNotesWidth = localStorage.getItem("promptNotesWidth") !== null
  ? Number(localStorage.getItem("promptNotesWidth"))
  : 33;
let currentSessionId = null;
let currentlySelectedEntity = null;
let currentSessionSelectedCreatureIds = [];
let currentSessionSelectedNpcIds = [];


// ===========================
// SESSION PREP MODULE
// ===========================
function clearSessionPrepEditor() {
  const fields = [
    "#sessionTitleInput",
    "#sessionDateInput",
    "#sessionOpeningInput",
    "#sessionPrepInput",
    "#sessionSecretsInput",
    "#sessionLiveNotesInput",
    "#sessionSummaryInput",
    "#sessionNextInput"
  ];

  fields.forEach(selector => {
    const input = document.querySelector(selector);

    if (input) {
      input.value = "";
    }
  });

  document.querySelectorAll(".sessionListItem").forEach(item => {
    item.classList.remove("active");
  });
}

async function setupSessionPrepModule() {

  await renderSessionList();
await renderSessionCastSelectors();

setTimeout(() => {
  setupSessionCastPicker();
}, 0);

  const newSessionBtn = document.querySelector("#newSessionBtn");
  const saveSessionBtn = document.querySelector("#saveSessionBtn");
  const openSessionPrompterBtn = document.querySelector("#openSessionPrompterBtn");

  if (newSessionBtn) {
    newSessionBtn.onclick = () => {

      currentSessionId = null;
      currentSessionSelectedCreatureIds = [];
      currentSessionSelectedNpcIds = [];
      renderSessionCastSelectors();

      document.querySelector("#sessionTitleInput").value = "";
      document.querySelector("#sessionDateInput").value = "";
      document.querySelector("#sessionOpeningInput").value = "";
      document.querySelector("#sessionPrepInput").value = "";
      document.querySelector("#sessionSecretsInput").value = "";
      document.querySelector("#sessionLiveNotesInput").value = "";
      document.querySelector("#sessionSummaryInput").value = "";
      document.querySelector("#sessionNextInput").value = "";

      document.querySelectorAll(".sessionListItem").forEach(el =>
        el.classList.remove("active")
      );
    };
  }

  if (saveSessionBtn) {
    saveSessionBtn.onclick = saveSessionPrep;
  }

  if (openSessionPrompterBtn) {
  openSessionPrompterBtn.onclick = async () => {
    await toggleSessionPrompterPanel();
  };
}

try {
  await mountSessionPrompterPanel();
} catch (error) {
  console.warn("Session Prompter mount failed:", error);
}
}

async function mountSessionPrompterPanel() {
  const sessionPanel =
    document.querySelector("#session") ||
    document.querySelector("#sessionPrep") ||
    document.querySelector("#sessions");

  const storyPanel = document.querySelector("#story");

  if (!sessionPanel || !storyPanel) {
    console.warn("Could not mount Session Prompter panel.", {
      sessionPanel,
      storyPanel
    });
    return;
  }

  
  let mount = document.querySelector("#sessionPrompterSlideDown");

  if (!mount) {
    mount = document.createElement("section");
    mount.id = "sessionPrompterSlideDown";
    mount.className = "infoCard sessionPrompterSlideDown hidden";

    const sessionEditor =
      document.querySelector(".sessionEditor") ||
      document.querySelector(".sessionPrepMain") ||
      document.querySelector(".sessionGrid")?.parentElement ||
      sessionPanel;

    sessionEditor.prepend(mount);
  }

  storyPanel.classList.remove("panel");
  storyPanel.classList.remove("active-panel");
  storyPanel.style.display = "block";
  storyPanel.classList.add("embeddedSessionPrompter");

  mount.innerHTML = `
    <div class="sessionPrompterHeader">
      <div>
        <h2>📖 Session Prompter</h2>
        <p id="sessionPrompterContext">Prompts linked to the active session.</p>
      </div>

      <button id="closeSessionPrompterBtn" type="button">
  ✕
</button>
    </div>

    <div id="sessionPrompterStoryMount"></div>
  `;

  const storyMount = document.querySelector("#sessionPrompterStoryMount");

  if (storyMount && storyPanel.parentElement !== storyMount) {
    storyMount.appendChild(storyPanel);
  }

  const closeBtn = document.querySelector("#closeSessionPrompterBtn");

  if (closeBtn) {
    closeBtn.onclick = toggleSessionPrompterPanel;
  }

  const titleInput = document.querySelector("#scriptTitleInput");
const scriptSelect = document.querySelector("#scriptSelect");

if (titleInput && scriptSelect && titleInput.parentElement !== scriptSelect.parentElement) {
  scriptSelect.insertAdjacentElement("afterend", titleInput);
}


  await refreshScriptList();
}

async function toggleSessionPrompterPanel() {
  const mount = document.querySelector("#sessionPrompterSlideDown");
  const button = document.querySelector("#openSessionPrompterBtn");

  if (!mount) {
    await mountSessionPrompterPanel();
    return;
  }

  if (!currentSessionId) {
    const saved = await saveSessionPrep();

    if (!currentSessionId) {
      alert("Create or save a session before opening the prompter.");
      return;
    }
  }

  const isHidden = mount.classList.contains("hidden");

  mount.classList.toggle("hidden", !isHidden);

  if (button) {
    button.innerText = isHidden ? "📕 Hide Prompter" : "📖 Prompter";
  }

  if (isHidden) {
    await ensureDefaultSessionPrompt();
    await refreshScriptList();

    const context = document.querySelector("#sessionPrompterContext");

    if (context) {
      const title =
        document.querySelector("#sessionTitleInput")?.value ||
        "Current Session";

      context.innerText = `${title} prompts and read-aloud scripts.`;
    }

    mount.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

async function getCurrentSessionRecord() {
  if (!currentSessionId) return null;

  const sessions = await window.dmAPI.getRecords(
    "sessions",
    window.dmState.current.campaign
  );

  return sessions.find(session => session.id === currentSessionId) || null;
}

async function ensureDefaultSessionPrompt() {
  if (!currentSessionId) return;

  const files = await window.dmStorage.listScripts();

  for (const file of files) {
    const script = await window.dmStorage.loadScript(file);

    if (script?.sessionId === currentSessionId) {
      return;
    }
  }

  const session = await getCurrentSessionRecord();

  const openingText =
    session?.opening ||
    document.querySelector("#sessionOpeningInput")?.value ||
    "";

  const liveNotes =
    session?.liveNotes ||
    document.querySelector("#sessionLiveNotesInput")?.value ||
    "";

  const defaultPrompt = {
    id: `prompt-${currentSessionId}-opening`,
    title: "Opening Narration",
    type: "opening",
    campaignId: window.dmState.current.campaign,
    sessionId: currentSessionId,
    readAloud: openingText,
    notes: liveNotes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const saved = await window.dmStorage.saveScript(defaultPrompt);

  currentScriptFile = `${saved.id}.json`;
}

async function saveSessionPrep() {

  const title =
    document.querySelector("#sessionTitleInput").value.trim() ||
    "Untitled Session";

  const id = currentSessionId || "session-" + Date.now();

  const session = {
    id,
    title,
    date: document.querySelector("#sessionDateInput").value,
    campaign: window.dmState.current.campaign,
    world: window.dmState.current.world,
    region: window.dmState.current.region,
    location: window.dmState.current.location,

    selectedCreatureIds: currentSessionSelectedCreatureIds,
    selectedNpcIds: currentSessionSelectedNpcIds,

    opening: document.querySelector("#sessionOpeningInput").value,
    prep: document.querySelector("#sessionPrepInput").value,
    secrets: document.querySelector("#sessionSecretsInput").value,
    liveNotes: document.querySelector("#sessionLiveNotesInput").value,
    summary: document.querySelector("#sessionSummaryInput").value,
    next: document.querySelector("#sessionNextInput").value
    
  };

  await window.dmAPI.saveRecord(
    "sessions",
    id,
    session,
    window.dmState.current.campaign
  );

  currentSessionId = id;

  await renderSessionList();

  // Re-highlight the active item in the sidebar
  document.querySelectorAll(".sessionListItem").forEach(el => {
    el.classList.toggle("active", el.dataset.id === id);
  });

}


async function renderSessionList() {

  const sessions = await window.dmAPI.getRecords(
    "sessions",
    window.dmState.current.campaign
  );

  const list = document.querySelector("#sessionList");

  if (!list) return;

  if (!sessions.length) {
    list.innerHTML =
      `<p class="sessionListEmpty">No sessions yet.<br>Click + New to start one.</p>`;
    return;
  }

  // Most recent first — sort by date if available, otherwise by id
  const sorted = [...sessions].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    return b.id.localeCompare(a.id);
  });

  list.innerHTML = sorted.map(s => `
    <div class="sessionListItem ${s.id === currentSessionId ? "active" : ""}"
         data-id="${s.id}">

      <div class="sessionItemInfo">
        <div class="sessionItemTitle">${s.title || "Untitled Session"}</div>
        <div class="sessionItemDate">${s.date || "No date set"}</div>
      </div>

      <button class="sessionDeleteBtn" data-id="${s.id}">✕</button>

    </div>
  `).join("");

  // Wire up click to load
  list.querySelectorAll(".sessionListItem").forEach(item => {
    item.onclick = (e) => {
      // Don't load if the delete button was clicked
      if (e.target.classList.contains("sessionDeleteBtn")) return;
      loadSessionPrep(item.dataset.id);
    };
  });

  // Wire up delete buttons
  list.querySelectorAll(".sessionDeleteBtn").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();

      const confirmed = confirm("Delete this session permanently?");
      if (!confirmed) return;

      await window.dmStorage.deleteDbRecord(btn.dataset.id);

      // If the deleted session was open, clear the editor
      if (currentSessionId === btn.dataset.id) {
        currentSessionId = null;
        document.querySelector("#sessionTitleInput").value = "";
        document.querySelector("#sessionDateInput").value = "";
        document.querySelector("#sessionOpeningInput").value = "";
        document.querySelector("#sessionPrepInput").value = "";
        document.querySelector("#sessionSecretsInput").value = "";
        document.querySelector("#sessionLiveNotesInput").value = "";
        document.querySelector("#sessionSummaryInput").value = "";
        document.querySelector("#sessionNextInput").value = "";
      }

      await renderSessionList();
    };
  });

}


async function loadSessionPrep(id) {

  const sessions = await window.dmAPI.getRecords(
    "sessions",
    window.dmState.current.campaign
  );

  const s = sessions.find(x => x.id === id);

  if (!s) return;

  currentSessionId = s.id;

  document.querySelector("#sessionTitleInput").value = s.title || "";
  document.querySelector("#sessionDateInput").value = s.date || "";
  document.querySelector("#sessionOpeningInput").value = s.opening || "";
  document.querySelector("#sessionPrepInput").value = s.prep || "";
  document.querySelector("#sessionSecretsInput").value = s.secrets || "";
  document.querySelector("#sessionLiveNotesInput").value = s.liveNotes || "";
  document.querySelector("#sessionSummaryInput").value = s.summary || "";
  document.querySelector("#sessionNextInput").value = s.next || "";

  // Highlight active item in sidebar
  document.querySelectorAll(".sessionListItem").forEach(el => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  currentSessionSelectedCreatureIds =
  Array.isArray(s.selectedCreatureIds)
    ? s.selectedCreatureIds
    : [];

currentSessionSelectedNpcIds =
  Array.isArray(s.selectedNpcIds)
    ? s.selectedNpcIds
    : [];

await renderSessionCastSelectors();
await refreshScriptList();

}

let activeSessionCastPickerType = null;

async function renderSessionCastSelectors() {
  await renderSelectedSessionCreatures();
  await renderSelectedSessionNpcs();
}

async function renderSelectedSessionCreatures() {
  const wrapper = document.querySelector("#selectedSessionCreatures");

  if (!wrapper) return;

  const creatures = await getCreatures();

  const selected = creatures
    .filter(creature => currentSessionSelectedCreatureIds.includes(creature.id))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  if (!selected.length) {
    wrapper.innerHTML = `<p class="sessionCastEmpty">No creatures selected.</p>`;
    return;
  }

  wrapper.innerHTML = selected.map(creature => `
    <div class="sessionSelectedCastItem">
      <div>
        <strong>${escapeHtml(creature.name || "Unnamed Creature")}</strong>
        <small>CR ${escapeHtml(creature.cr || "?")} · ${escapeHtml(creature.size || "")} ${escapeHtml(creature.type || "")}</small>
      </div>

      <div class="sessionCastItemActions">
  <button
    class="openSessionCreatureBtn"
    type="button"
    data-creature-id="${escapeHtml(creature.id)}"
  >
    Open
  </button>

  <button
    class="removeSessionCreatureBtn"
    type="button"
    data-creature-id="${escapeHtml(creature.id)}"
  >
    Remove
  </button>
</div>
    </div>
  `).join("");


wrapper.querySelectorAll(".openSessionCreatureBtn").forEach(button => {
  button.onclick = async () => {
    await openCreatureFromRegionOverview(button.dataset.creatureId);
  };
});
  wrapper.querySelectorAll(".removeSessionCreatureBtn").forEach(button => {
    button.onclick = async () => {
      currentSessionSelectedCreatureIds =
        currentSessionSelectedCreatureIds.filter(id => id !== button.dataset.creatureId);

      await renderSessionCastSelectors();
    };
  });
}

async function renderSelectedSessionNpcs() {
  const wrapper = document.querySelector("#selectedSessionNpcs");

  if (!wrapper) return;

  const npcs = await getNpcs();

  const selected = npcs
    .filter(npc => currentSessionSelectedNpcIds.includes(npc.id))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  if (!selected.length) {
    wrapper.innerHTML = `<p class="sessionCastEmpty">No NPCs selected.</p>`;
    return;
  }

  wrapper.innerHTML = selected.map(npc => `
    <div class="sessionSelectedCastItem">
      <div>
        <strong>${escapeHtml(npc.name || "Unnamed NPC")}</strong>
        <small>${escapeHtml(npc.species || "Unknown")} · ${escapeHtml(npc.role || "NPC")}</small>
      </div>

      <div class="sessionCastItemActions">
  <button
    class="openSessionNpcBtn"
    type="button"
    data-npc-id="${escapeHtml(npc.id)}"
  >
    Open
  </button>

  <button
    class="removeSessionNpcBtn"
    type="button"
    data-npc-id="${escapeHtml(npc.id)}"
  >
    Remove
  </button>
</div>
    </div>
  `).join("");

  wrapper.querySelectorAll(".openSessionNpcBtn").forEach(button => {
  button.onclick = async () => {
    await openNpcFromSessionCast(button.dataset.npcId);
  };
});

  wrapper.querySelectorAll(".removeSessionNpcBtn").forEach(button => {
    button.onclick = async () => {
      currentSessionSelectedNpcIds =
        currentSessionSelectedNpcIds.filter(id => id !== button.dataset.npcId);

      await renderSessionCastSelectors();
    };
  });
}

function setupSessionCastPicker() {
  const creatureBtn = document.querySelector("#openCreatureCastPickerBtn");
  const npcBtn = document.querySelector("#openNpcCastPickerBtn");
  const closeBtn = document.querySelector("#closeSessionCastPickerBtn");
  const searchInput = document.querySelector("#sessionCastPickerSearchInput");
  const modal = document.querySelector("#sessionCastPickerModal");

  console.log("SESSION CAST PICKER SETUP", {
    creatureBtn,
    npcBtn,
    closeBtn,
    searchInput,
    modal
  });

  if (creatureBtn) {
    creatureBtn.onclick = () => openSessionCastPicker("creatures");
  }

  if (npcBtn) {
    npcBtn.onclick = () => openSessionCastPicker("npcs");
  }

  if (closeBtn) {
    closeBtn.onclick = closeSessionCastPicker;
  }

  if (searchInput) {
    searchInput.oninput = renderSessionCastPickerResults;
  }

  if (modal) {
    modal.onclick = event => {
      if (event.target === modal) {
        closeSessionCastPicker();
      }
    };
  }
}
async function openNpcFromSessionCast(npcId) {
  await openNpcBuilderByAnyId(npcId);
}

async function openSessionCastPicker(type) {
  activeSessionCastPickerType = type;

  const modal = document.querySelector("#sessionCastPickerModal");
  const title = document.querySelector("#sessionCastPickerTitle");
  const searchInput = document.querySelector("#sessionCastPickerSearchInput");
  const results = document.querySelector("#sessionCastPickerResults");

  if (!modal || !title || !searchInput || !results) return;

  title.innerText =
    type === "creatures"
      ? "Add Creature to Session"
      : "Add NPC to Session";

  searchInput.value = "";
  results.innerHTML = `<p class="sessionCastEmpty">Start typing to search.</p>`;

  modal.classList.remove("hidden");

  setTimeout(() => {
    searchInput.focus();
  }, 50);

  await renderSessionCastPickerResults();
}

function closeSessionCastPicker() {
  const modal = document.querySelector("#sessionCastPickerModal");

  if (modal) {
    modal.classList.add("hidden");
  }

  activeSessionCastPickerType = null;
}

async function renderSessionCastPickerResults() {
  const results = document.querySelector("#sessionCastPickerResults");
  const searchInput = document.querySelector("#sessionCastPickerSearchInput");

  if (!results || !searchInput || !activeSessionCastPickerType) return;

  const search = searchInput.value.trim().toLowerCase();

  if (activeSessionCastPickerType === "creatures") {
    await renderCreatureCastPickerResults(results, search);
    return;
  }

  if (activeSessionCastPickerType === "npcs") {
    await renderNpcCastPickerResults(results, search);
    return;
  }
}

async function renderCreatureCastPickerResults(results, search) {
  const creatures = await getCreatures();

  let filtered = creatures
    .filter(creature => {
      if (
        typeof recordMatchesLibraryScope === "function" &&
        !recordMatchesLibraryScope(creature, "current-system")
      ) {
        return false;
      }

      const text = [
        creature.name,
        creature.type,
        creature.size,
        creature.cr,
        creature.tags,
        creature.environment,
        creature.systemId,
        creature.world,
        creature.worldId,
        creature.region,
        creature.regionId,
        creature.location,
        creature.locationId,
        creature.currentLocationId,
        creature.defaultLocationId
      ].join(" ").toLowerCase();

      return !search || text.includes(search);
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    .slice(0, 100);

  if (!filtered.length) {
    results.innerHTML = `<p class="sessionCastEmpty">No matching creatures.</p>`;
    return;
  }

  results.innerHTML = filtered.map(creature => {
    const alreadySelected = currentSessionSelectedCreatureIds.includes(creature.id);

    return `
      <div class="sessionCastPickerItem">
        <div>
          <strong>${escapeHtml(creature.name || "Unnamed Creature")}</strong>
          <small>
            CR ${escapeHtml(creature.cr || "?")}
            · ${escapeHtml(creature.size || "")}
            ${escapeHtml(creature.type || "")}
            ${creature._loadedFrom ? `· ${escapeHtml(creature._loadedFrom)}` : ""}
          </small>
        </div>

        <button
          class="addCreatureToSessionCastBtn"
          type="button"
          data-creature-id="${escapeHtml(creature.id)}"
          ${alreadySelected ? "disabled" : ""}
        >
          ${alreadySelected ? "Added" : "Add"}
        </button>
      </div>
    `;
  }).join("");

  results.querySelectorAll(".addCreatureToSessionCastBtn").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.creatureId;

      if (!currentSessionSelectedCreatureIds.includes(id)) {
        currentSessionSelectedCreatureIds.push(id);
      }

      await renderSessionCastSelectors();
      await renderSessionCastPickerResults();
    };
  });
}

async function renderNpcCastPickerResults(results, search) {
  const npcs = await getNpcs();

  let filtered = npcs
    .filter(npc => {
      if (
        typeof recordMatchesLibraryScope === "function" &&
        !recordMatchesLibraryScope(npc, "current-system")
      ) {
        return false;
      }

      const text = [
        npc.name,
        npc.species,
        npc.role,
        npc.class,
        npc.status,
        npc.systemId,
        npc.world,
        npc.region,
        npc.locationId,
        npc.locationState?.worldId,
        npc.locationState?.regionId,
        npc.locationState?.locationId,
        npc.locationState?.entityId,
        npc.faction?.factionName,
        npc.faction?.rankTitle,
        npc.personality?.appearance,
        npc.personality?.hook,
        npc.personality?.secret,
        npc.overview?.summary
      ].join(" ").toLowerCase();

      return !search || text.includes(search);
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    .slice(0, 100);

  if (!filtered.length) {
    results.innerHTML = `<p class="sessionCastEmpty">No matching NPCs.</p>`;
    return;
  }

  results.innerHTML = filtered.map(npc => {
    const alreadySelected = currentSessionSelectedNpcIds.includes(npc.id);

    return `
      <div class="sessionCastPickerItem">
        <div>
          <strong>${escapeHtml(npc.name || "Unnamed NPC")}</strong>
          <small>
            ${escapeHtml(npc.species || "Unknown")}
            · ${escapeHtml(npc.role || "NPC")}
            · ${escapeHtml(npc.status || "Unknown")}
            ${npc._loadedFrom ? `· ${escapeHtml(npc._loadedFrom)}` : ""}
          </small>
        </div>

        <button
          class="addNpcToSessionCastBtn"
          type="button"
          data-npc-id="${escapeHtml(npc.id)}"
          ${alreadySelected ? "disabled" : ""}
        >
          ${alreadySelected ? "Added" : "Add"}
        </button>
      </div>
    `;
  }).join("");

  results.querySelectorAll(".addNpcToSessionCastBtn").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.npcId;

      if (!currentSessionSelectedNpcIds.includes(id)) {
        currentSessionSelectedNpcIds.push(id);
      }

      await renderSessionCastSelectors();
      await renderSessionCastPickerResults();
    };
  });
}

function getStoryEls() {
  return {
    scriptSelect: document.querySelector("#scriptSelect"),
    scriptTitleInput: document.querySelector("#scriptTitleInput"),
    readAloudInput: document.querySelector("#readAloudInput"),
    dmNotesInput: document.querySelector("#dmNotesInput"),
    storyEditorLayout: document.querySelector("#storyEditorLayout"),
    storyPromptLayout: document.querySelector("#storyPromptLayout"),
    teleprompterText: document.querySelector("#teleprompterText"),
    promptNotesText: document.querySelector("#promptNotesText"),
    promptSpeedDisplay: document.querySelector("#promptSpeedDisplay"),
    fontSizeDisplay: document.querySelector("#fontSizeDisplay"),
    storyOpacitySlider: document.querySelector("#storyOpacitySlider"),
    storyOpacityDisplay: document.querySelector("#storyOpacityDisplay"),
    notesWidthSlider: document.querySelector("#notesWidthSlider"),
    notesWidthDisplay: document.querySelector("#notesWidthDisplay"),
    promptNotesPanel: document.querySelector("#promptNotesPanel")
  };
}

async function setupStoryModule() {
  applyStoryVisualSettings();
  await refreshScriptList();
  ensureScriptTypeSelector();

  document.querySelector("#newScriptBtn").onclick = newScript;
  document.querySelector("#saveScriptBtn").onclick = saveCurrentScript;
  document.querySelector("#deleteScriptBtn").onclick = () => window.dmStorage.deleteScript(currentScriptFile);

  document.querySelector("#promptModeBtn").onclick = enterStoryPromptMode;
  document.querySelector("#editModeBtn").onclick = enterStoryEditMode;
  document.querySelector("#pausePromptBtn").onclick = togglePrompt;
  document.querySelector("#resetPromptBtn").onclick = resetPrompt;

  document.querySelector("#slowerPromptBtn").onclick = () => {
    promptSpeed = Math.max(0.1, promptSpeed - 0.1);
    localStorage.setItem("promptSpeed", promptSpeed);
    applyStoryVisualSettings();
  };

  document.querySelector("#fasterPromptBtn").onclick = () => {
    promptSpeed += 0.1;
    localStorage.setItem("promptSpeed", promptSpeed);
    applyStoryVisualSettings();
  };

  document.querySelector("#fontDownBtn").onclick = () => {
    promptFontSize = Math.max(20, promptFontSize - 2);
    localStorage.setItem("promptFontSize", promptFontSize);
    applyStoryVisualSettings();
  };

  document.querySelector("#fontUpBtn").onclick = () => {
    promptFontSize += 2;
    localStorage.setItem("promptFontSize", promptFontSize);
    applyStoryVisualSettings();
  };

  document.querySelector("#storyOpacitySlider").oninput = (e) => {
    storyOpacity = Number(e.target.value);
    localStorage.setItem("storyOpacity", storyOpacity);
    applyStoryVisualSettings();
  };

  document.querySelector("#notesWidthSlider").oninput = (e) => {
    promptNotesWidth = Number(e.target.value);
    localStorage.setItem("promptNotesWidth", promptNotesWidth);
    applyStoryVisualSettings();
  };

  animatePrompt();
}

function ensureScriptTypeSelector() {
  const els = getStoryEls();

  if (!els.scriptSelect) return;

  if (document.querySelector("#scriptTypeInput")) return;

  const typeInput = document.createElement("select");
  typeInput.id = "scriptTypeInput";
  typeInput.innerHTML = `
    <option value="opening">Opening</option>
    <option value="scene">Scene</option>
    <option value="read-aloud">Read Aloud</option>
    <option value="npc-speech">NPC Speech</option>
    <option value="combat-intro">Combat Intro</option>
    <option value="recap">Recap</option>
    <option value="ending">Ending</option>
  `;

  els.scriptSelect.insertAdjacentElement("afterend", typeInput);
}

async function refreshScriptList() {
  const els = getStoryEls();

  if (!els.scriptSelect) return;

  const files = await window.dmStorage.listScripts();

  els.scriptSelect.innerHTML = "";

  const sessionFiles = [];

  for (const file of files) {
    const script = await window.dmStorage.loadScript(file);

    const belongsToCurrentSession =
      currentSessionId &&
      script?.sessionId === currentSessionId;

    if (belongsToCurrentSession) {
      sessionFiles.push({
        file,
        script
      });
    }
  }

  if (!sessionFiles.length && currentSessionId) {
    await ensureDefaultSessionPrompt();
    return refreshScriptList();
  }

  for (const item of sessionFiles) {
    const option = document.createElement("option");
    option.value = item.file;
    option.textContent = item.script?.title || item.file;
    els.scriptSelect.appendChild(option);
  }

  if (sessionFiles.length) {
    await loadScript(sessionFiles[0].file);
  } else {
    newScript();
  }

  els.scriptSelect.onchange = async () => {
    await loadScript(els.scriptSelect.value);
  };
}

function setupSessionFieldModal() {
 
  // Each session textarea gets an expand button injected next to its card title
  const fields = [
    { cardTitle: "🎙 Opening Narration",  inputId: "sessionOpeningInput"  },
    { cardTitle: "🎯 Goals / Prep Notes", inputId: "sessionPrepInput"     },
    { cardTitle: "🔐 Secrets & Reveals",  inputId: "sessionSecretsInput"  },
    { cardTitle: "✏️ Live Notes",          inputId: "sessionLiveNotesInput"},
    { cardTitle: "📜 Session Summary",    inputId: "sessionSummaryInput"  },
    { cardTitle: "➡ Next Session Hook",   inputId: "sessionNextInput"     },
  ];
 
  fields.forEach(({ cardTitle, inputId }) => {
 
    // Find the h2 whose text matches
    const h2 = [...document.querySelectorAll(".sessionGrid .infoCard h2")]
      .find(el => el.textContent.trim().startsWith(cardTitle.replace(/\s+/g, " ")));
 
    if (!h2) return;
 
    const btn = document.createElement("button");
    btn.className = "sessionCardExpand";
    btn.title = "Expand";
    btn.textContent = "⛶";
 
    btn.onclick = () => openSessionFieldModal(cardTitle, inputId);
 
    h2.appendChild(btn);
 
  });
 
  // Close button
  document.querySelector("#sessionFieldModalClose").onclick =
    closeSessionFieldModal;
 
  // Save & Close button
  document.querySelector("#sessionFieldModalSave").onclick = () => {
 
    const targetId = document.querySelector("#sessionFieldModal")
      .dataset.targetId;
 
    const modalTextarea =
      document.querySelector("#sessionFieldModalTextarea");
 
    const target = document.querySelector(`#${targetId}`);
 
    if (target) target.value = modalTextarea.value;
 
    closeSessionFieldModal();
 
  };
 
  // Click outside the box to close
  document.querySelector("#sessionFieldModal").onclick = (e) => {
    if (e.target === document.querySelector("#sessionFieldModal")) {
      closeSessionFieldModal();
    }
  };
 
  // Escape key to close
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      !document.querySelector("#sessionFieldModal").classList.contains("hidden")
    ) {
      closeSessionFieldModal();
    }
  });
 
}
 
function openSessionFieldModal(title, inputId) {
 
  const modal = document.querySelector("#sessionFieldModal");
  const textarea = document.querySelector("#sessionFieldModalTextarea");
  const sourceField = document.querySelector(`#${inputId}`);
 
  document.querySelector("#sessionFieldModalTitle").textContent = title;
 
  textarea.value = sourceField ? sourceField.value : "";
 
  modal.dataset.targetId = inputId;
 
  modal.classList.remove("hidden");
 
  // Focus and put cursor at end
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
 
}
 
function closeSessionFieldModal() {
  document.querySelector("#sessionFieldModal").classList.add("hidden");
}
async function loadScript(fileName) {
  const els = getStoryEls();
  const script = await window.dmStorage.loadScript(fileName);

  if (!script) return;

  currentScriptFile = fileName;

  if (els.scriptSelect) {
    els.scriptSelect.value = fileName;
  }

  if (els.scriptTitleInput) {
    els.scriptTitleInput.value = script.title || "";
    els.scriptTitleInput.disabled = false;
    els.scriptTitleInput.readOnly = false;
  }

  if (els.readAloudInput) {
    els.readAloudInput.value = script.readAloud || "";
  }

  if (els.dmNotesInput) {
    els.dmNotesInput.value = script.notes || script.gmNotes || "";
  }

  const typeInput = document.querySelector("#scriptTypeInput");

  if (typeInput) {
    typeInput.value = script.type || "read-aloud";
  }
}

async function saveCurrentScript() {
  const els = getStoryEls();

  if (!currentSessionId) {
    await saveSessionPrep();

    if (!currentSessionId) {
      alert("Save or select a session before saving a prompt.");
      return;
    }
  }

  const title =
    els.scriptTitleInput?.value?.trim() ||
    "Untitled Script";

  const existingId = currentScriptFile
    ? currentScriptFile.replace(".json", "")
    : "";

  const script = {
    id: existingId || window.dmStorage.slugify(
      `${currentSessionId}-${title}-${Date.now()}`
    ),

    title,
    type: document.querySelector("#scriptTypeInput")?.value || "read-aloud",

    campaignId: window.dmState.current.campaign,
    sessionId: currentSessionId,

    readAloud: els.readAloudInput?.value || "",
    notes: els.dmNotesInput?.value || "",

    updatedAt: new Date().toISOString()
  };

  const saved = await window.dmStorage.saveScript(script);

  currentScriptFile = `${saved.id}.json`;

  await refreshScriptList();

  if (els.scriptSelect) {
    els.scriptSelect.value = currentScriptFile;
  }
}

function newScript() {
  const els = getStoryEls();

  currentScriptFile = null;

  if (els.scriptTitleInput) {
    els.scriptTitleInput.value = "New Script";
    els.scriptTitleInput.disabled = false;
    els.scriptTitleInput.readOnly = false;
  }

  if (els.readAloudInput) {
    els.readAloudInput.value = "";
  }

  if (els.dmNotesInput) {
    els.dmNotesInput.value = "";
  }

  const typeInput = document.querySelector("#scriptTypeInput");

  if (typeInput) {
    typeInput.value = "read-aloud";
  }
}

function enterStoryPromptMode() {
  const els = getStoryEls();

  els.teleprompterText.innerText = els.readAloudInput.value;
  els.promptNotesText.innerText = els.dmNotesInput.value;

  els.storyEditorLayout.classList.add("hidden");
  els.scriptTitleInput.classList.add("hidden");
  els.storyPromptLayout.classList.remove("hidden");

  promptRunning = true;

  const pauseBtn = document.querySelector("#pausePromptBtn");
  if (pauseBtn) {
    pauseBtn.innerText = "Pause";
  }

  resetPrompt();
}

function enterStoryEditMode() {
  const els = getStoryEls();

  els.storyEditorLayout.classList.remove("hidden");
  els.scriptTitleInput.classList.remove("hidden");
  els.storyPromptLayout.classList.add("hidden");

  promptRunning = false;
  document.querySelector("#pausePromptBtn").innerText = "Play";
}

function togglePrompt() {
  promptRunning = !promptRunning;
  document.querySelector("#pausePromptBtn").innerText = promptRunning ? "Pause" : "Play";
}

function resetPrompt() {
  const els = getStoryEls();

  const promptPanel =
    document.querySelector("#teleprompterPanel") ||
    document.querySelector(".teleprompterPanel") ||
    els.storyPromptLayout;

  const panelHeight =
    promptPanel?.clientHeight ||
    520;

  promptY = panelHeight - 40;

  els.teleprompterText.style.top = promptY + "px";
}

function applyStoryVisualSettings() {
  const els = getStoryEls();

  els.promptSpeedDisplay.innerText = promptSpeed.toFixed(1);
  els.fontSizeDisplay.innerText = promptFontSize;
  els.teleprompterText.style.fontSize = promptFontSize + "px";
  if (els.promptNotesText) {
  els.promptNotesText.style.fontSize = promptFontSize + "px";
}

  els.storyOpacitySlider.value = storyOpacity;
  els.storyOpacityDisplay.innerText = storyOpacity + "%";
  const opacityValue = storyOpacity / 100;

  document.documentElement.style.setProperty(
    "--story-panel-opacity",
    opacityValue
  );

  els.notesWidthSlider.value = promptNotesWidth;
  els.notesWidthDisplay.innerText = promptNotesWidth + "%";
  els.promptNotesPanel.style.flex = `0 0 ${promptNotesWidth}%`;
}

function animatePrompt() {
  const els = getStoryEls();

  if (promptRunning) {
    promptY -= promptSpeed;
    els.teleprompterText.style.top = promptY + "px";
  }

  requestAnimationFrame(animatePrompt);
}

function askUser(title) {

  return new Promise(resolve => {

    const modal = document.querySelector("#inputModal");
    const heading = document.querySelector("#inputModalTitle");
    const input = document.querySelector("#inputModalField");

    heading.innerText = title;
    input.value = "";

    modal.classList.remove("hidden");
    input.focus();

    document.querySelector("#inputOkBtn").onclick = () => {
      modal.classList.add("hidden");
      resolve(input.value);
    };

    document.querySelector("#inputCancelBtn").onclick = () => {
      modal.classList.add("hidden");
      resolve(null);
    };

  });

}

async function setupPartyModule() {
  console.log("Party Module Loaded");

  const addPlayerBtn = document.querySelector("#addPlayerBtn");

  if (!addPlayerBtn) {
    console.error("No addPlayerBtn found");
    return;
  }

  await renderParty();

  addPlayerBtn.onclick = async () => {
    const name = await askUser("Player name?");
    if (!name) return;

    const players = await window.dmStorage.getPlayers();
    const id = window.dmStorage.slugify(name);

    if (players.some((p) => p.id === id)) {
      alert("That player already exists.");
      return;
    }

    players.push({ id, name });

    await window.dmStorage.savePlayers(players);
    await renderParty();
  };

  document.querySelector("#saveCharacterBtn").onclick = saveCharacterFromModal;
  document.querySelector("#cancelCharacterBtn").onclick = closeCharacterModal;
  document.querySelector("#calculatePassivesBtn").onclick = calculateAndFillPassives;

  [
    "#strInput",
    "#dexInput",
    "#conInput",
    "#intInput",
    "#wisInput",
    "#chaInput",
    "#characterLevelInput"
  ].forEach((selector) => {
    document.querySelector(selector).oninput = updateAbilityModifiersDisplay;
  });
}

async function populateCharacterDropdowns() {
  const species = await window.dmStorage.getSpeciesList();
  const classes = await window.dmStorage.getClassList();

  fillCharacterOptions("#characterSpeciesInput", species);
  fillCharacterOptions("#characterSpeciesTwoInput", species);
  fillCharacterOptions("#characterClassInput", classes);
}

function fillCharacterOptions(selector, options) {
  const select = document.querySelector(selector);
  select.innerHTML = "";

  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
}

function getSpeciesDisplay() {
  const isHybrid = document.querySelector("#characterHybridInput").checked;
  const s1 = document.querySelector("#characterSpeciesInput").value;
  const s2 = document.querySelector("#characterSpeciesTwoInput").value;

  if (!isHybrid || !s2 || s1 === s2) return s1;

  return `${s1}-${s2} Hybrid`;
}

async function createCharacterForPlayer(playerId, playerName) {
  await openCharacterModal({
    playerId,
    playerName
  });
}

function getAbilityMod(score) {
  return Math.floor((Number(score) - 10) / 2);
}

function formatMod(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function getProficiencyBonus(level) {
  level = Number(level);

  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;

  return 2;
}

function calculatePassive(baseAbility, proficient, expertise, level) {
  const mod = getAbilityMod(baseAbility);
  const prof = getProficiencyBonus(level);

  let bonus = mod;

  if (expertise) {
    bonus += prof * 2;
  } else if (proficient) {
    bonus += prof;
  }

  return 10 + bonus;
}

function updateAbilityModifiersDisplay() {
  const abilities = [
    ["strInput", "strMod"],
    ["dexInput", "dexMod"],
    ["conInput", "conMod"],
    ["intInput", "intMod"],
    ["wisInput", "wisMod"],
    ["chaInput", "chaMod"]
  ];

  abilities.forEach(([inputId, modId]) => {
    const score = document.querySelector(`#${inputId}`).value;
    const mod = getAbilityMod(score);
    document.querySelector(`#${modId}`).innerText = formatMod(mod);
  });
}

function calculateAndFillPassives() {
  const level = Number(document.querySelector("#characterLevelInput").value);

  const wis = Number(document.querySelector("#wisInput").value);
  const int = Number(document.querySelector("#intInput").value);

  document.querySelector("#characterPpInput").value = calculatePassive(
    wis,
    document.querySelector("#perceptionProf").checked,
    document.querySelector("#perceptionExpert").checked,
    level
  );

  document.querySelector("#characterPiInput").value = calculatePassive(
    int,
    document.querySelector("#investigationProf").checked,
    document.querySelector("#investigationExpert").checked,
    level
  );

  document.querySelector("#characterInsightInput").value = calculatePassive(
    wis,
    document.querySelector("#insightProf").checked,
    document.querySelector("#insightExpert").checked,
    level
  );
}

async function openCharacterModal({ playerId, playerName, character = null }) {
  await populateCharacterDropdowns();

  document.querySelector("#characterModalTitle").innerText =
    character ? `Edit ${character.name}` : `Create Character for ${playerName}`;

  document.querySelector("#characterIdInput").value = character?.id || "";
  document.querySelector("#characterPlayerIdInput").value = playerId;

  document.querySelector("#characterNameInput").value = character?.name || "";

  document.querySelector("#characterSpeciesInput").value =
    character?.speciesOne || character?.species || "Human";

  document.querySelector("#characterSpeciesTwoInput").value =
    character?.speciesTwo || "Human";

  document.querySelector("#characterHybridInput").checked =
    character?.isHybrid || false;

  document.querySelector("#characterClassInput").value =
    character?.class || "Fighter";

  document.querySelector("#characterSubclassInput").value =
    character?.subclass || "";

  document.querySelector("#characterLevelInput").value = character?.level || 1;
  document.querySelector("#characterAcInput").value = character?.ac || 10;
  document.querySelector("#characterMaxHpInput").value = character?.maxHP || 10;
  document.querySelector("#characterCurrentHpInput").value =
    character?.currentHP || character?.maxHP || 10;

  document.querySelector("#characterPpInput").value =
    character?.passivePerception || 10;

  document.querySelector("#characterPiInput").value =
    character?.passiveInvestigation || 10;

  document.querySelector("#characterInsightInput").value =
    character?.passiveInsight || 10;

  document.querySelector("#characterStatusInput").value =
    character?.status || "Alive";

  const abilities = character?.abilities || {
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
  };

  document.querySelector("#strInput").value = abilities.str;
  document.querySelector("#dexInput").value = abilities.dex;
  document.querySelector("#conInput").value = abilities.con;
  document.querySelector("#intInput").value = abilities.int;
  document.querySelector("#wisInput").value = abilities.wis;
  document.querySelector("#chaInput").value = abilities.cha;

  const skills = character?.skills || {};

  document.querySelector("#perceptionProf").checked = skills.perception?.proficient || false;
  document.querySelector("#perceptionExpert").checked = skills.perception?.expertise || false;

  document.querySelector("#investigationProf").checked = skills.investigation?.proficient || false;
  document.querySelector("#investigationExpert").checked = skills.investigation?.expertise || false;

  document.querySelector("#insightProf").checked = skills.insight?.proficient || false;
  document.querySelector("#insightExpert").checked = skills.insight?.expertise || false;

  updateAbilityModifiersDisplay();

  document.querySelector("#characterModal").classList.remove("hidden");
}

function closeCharacterModal() {
  document.querySelector("#characterModal").classList.add("hidden");
}

async function saveCharacterFromModal() {
  const idInput = document.querySelector("#characterIdInput").value;
  const playerId = document.querySelector("#characterPlayerIdInput").value;
  const name = document.querySelector("#characterNameInput").value.trim();

  if (!name) {
    alert("Character name is required.");
    return;
  }

  const chars = await window.dmStorage.getCharacters();

  const character = {
    id: idInput || window.dmStorage.slugify(name),
    playerId,
    name,

    species: getSpeciesDisplay(),
    speciesOne: document.querySelector("#characterSpeciesInput").value,
    speciesTwo: document.querySelector("#characterSpeciesTwoInput").value,
    isHybrid: document.querySelector("#characterHybridInput").checked,

    class: document.querySelector("#characterClassInput").value,
    subclass: document.querySelector("#characterSubclassInput").value,

    level: Number(document.querySelector("#characterLevelInput").value),
    ac: Number(document.querySelector("#characterAcInput").value),
    maxHP: Number(document.querySelector("#characterMaxHpInput").value),
    currentHP: Number(document.querySelector("#characterCurrentHpInput").value),

    passivePerception: Number(document.querySelector("#characterPpInput").value),
    passiveInvestigation: Number(document.querySelector("#characterPiInput").value),
    passiveInsight: Number(document.querySelector("#characterInsightInput").value),

    status: document.querySelector("#characterStatusInput").value,

    abilities: {
      str: Number(document.querySelector("#strInput").value),
      dex: Number(document.querySelector("#dexInput").value),
      con: Number(document.querySelector("#conInput").value),
      int: Number(document.querySelector("#intInput").value),
      wis: Number(document.querySelector("#wisInput").value),
      cha: Number(document.querySelector("#chaInput").value)
    },

    skills: {
      perception: {
        proficient: document.querySelector("#perceptionProf").checked,
        expertise: document.querySelector("#perceptionExpert").checked
      },
      investigation: {
        proficient: document.querySelector("#investigationProf").checked,
        expertise: document.querySelector("#investigationExpert").checked
      },
      insight: {
        proficient: document.querySelector("#insightProf").checked,
        expertise: document.querySelector("#insightExpert").checked
      }
    }
  };

  const existingIndex = chars.findIndex((c) => c.id === character.id);

  if (existingIndex >= 0) {
    chars[existingIndex] = character;
  } else {
    chars.push(character);
  }

  await window.dmStorage.saveCharacters(chars);
  closeCharacterModal();
  await renderParty();
}

async function isCharacterActive(characterId) {
  const party = await window.dmStorage.getCampaignParty();
  return party.characters.includes(characterId);
}

async function toggleCharacterActive(characterId, isActive) {
  const party = await window.dmStorage.getCampaignParty();

  if (!Array.isArray(party.characters)) {
    party.characters = [];
  }

  if (isActive && !party.characters.includes(characterId)) {
    party.characters.push(characterId);
  }

  if (!isActive) {
    party.characters = party.characters.filter((id) => id !== characterId);
  }

  await saveCampaignPartyAndSync(party);
  await renderParty();
  await updatePartySummaryFromActiveCharacters();
}

async function getActiveCharacters() {
  const party = await window.dmStorage.getCampaignParty();
  const chars = await window.dmStorage.getCharacters();

  if (!Array.isArray(party.characters)) {
    party.characters = [];
  }

  return chars.filter((char) => party.characters.includes(char.id));
}

async function updatePartySummaryFromActiveCharacters() {
  const avgEl = document.querySelector("#avgLevelDisplay");
  const tierEl = document.querySelector("#tierDisplay");

  if (!avgEl || !tierEl) return;

  const activeChars = await getActiveCharacters();

  if (!activeChars.length) {
    avgEl.innerText = "-";
    tierEl.innerText = "No Active Party";
    return;
  }

  const total = activeChars.reduce(
    (sum, char) => sum + Number(char.level || 1),
    0
  );

  const avg = Math.round((total / activeChars.length) * 10) / 10;

  avgEl.innerText = avg;
  tierEl.innerText = window.dmState.getTier(avg);
}

async function renderParty() {
  const players = await window.dmStorage.getPlayers();
  const chars = await window.dmStorage.getCharacters();
  const party = await window.dmStorage.getCampaignParty();

  if (!Array.isArray(party.characters)) {
    party.characters = [];
  }

  const vault = document.querySelector("#playerVault");
  const activePartyList = document.querySelector("#activePartyList");
  const partyControls = document.querySelector("#partyControls");

  if (!vault) return;

  let manageSplitGroupsBtn =
    document.querySelector("#manageSplitGroupsBtn");

  if (partyControls && !manageSplitGroupsBtn) {
    manageSplitGroupsBtn = document.createElement("button");
    manageSplitGroupsBtn.id = "manageSplitGroupsBtn";
    manageSplitGroupsBtn.type = "button";
    manageSplitGroupsBtn.textContent = "Manage Split Groups";
    partyControls.appendChild(manageSplitGroupsBtn);
  }

  let splitGroupManagerMount =
    document.querySelector("#splitGroupManagerMount");

  if (activePartyList && !splitGroupManagerMount) {
    splitGroupManagerMount = document.createElement("div");
    splitGroupManagerMount.id = "splitGroupManagerMount";
    splitGroupManagerMount.className = "hidden";
    activePartyList.insertAdjacentElement("afterend", splitGroupManagerMount);
  }

  if (manageSplitGroupsBtn) {
    manageSplitGroupsBtn.classList.toggle(
      "active",
      splitGroupManagerState.open
    );
    manageSplitGroupsBtn.onclick = async () => {
      splitGroupManagerState.open = !splitGroupManagerState.open;
      manageSplitGroupsBtn.classList.toggle(
        "active",
        splitGroupManagerState.open
      );
      await renderSplitGroupManager();
    };
  }

  vault.innerHTML = "";
  activePartyList.innerHTML = "";

  const activeChars = chars.filter((char) => party.characters.includes(char.id));

  if (!activeChars.length) {
    activePartyList.innerHTML = `<p>No active party members selected for this campaign.</p>`;
  } else {
    const activeGrid = document.createElement("div");
    activeGrid.className = "activePartyGrid";

    activeChars.forEach((c) => {
      const player = players.find((p) => p.id === c.playerId);

      activeGrid.innerHTML += `
        <div class="activePartyCard">
          <h3>${c.name}</h3>
          <p>${player?.name || "Unknown Player"}</p>
          <p>${c.species || "Unknown Species"} ${c.class || "Unknown Class"} ${c.subclass ? `(${c.subclass})` : ""}</p>

          <div class="characterStats">
            <span>Lv ${c.level}</span>
            <span>❤️ ${c.currentHP || 0}/${c.maxHP || 0}</span>
            <span>🛡 AC ${c.ac}</span>
            <span>👁 PP ${c.passivePerception}</span>
          </div>
        </div>
      `;
    });

    activePartyList.appendChild(activeGrid);
  }

  if (!players.length) {
    vault.innerHTML = `<p>No players yet. Click <b>+ Player</b> to add one.</p>`;
    await updatePartySummaryFromActiveCharacters();
    await renderSplitGroupManager();
    return;
  }

  players.forEach((player) => {
    const owned = chars.filter((c) => c.playerId === player.id);

    const card = document.createElement("div");
    card.className = "characterCard";

    let html = `
      <div class="playerCardHeader">
        <h3>${player.name}</h3>
        <button class="addCharacterForPlayerBtn" data-player-id="${player.id}" data-player-name="${player.name}">
          + Character
        </button>
      </div>
    `;

    if (!owned.length) {
      html += `<p>No characters yet.</p>`;
    }

    owned.forEach((c) => {
      const checked = party.characters.includes(c.id) ? "checked" : "";

      html += `
        <div class="characterMiniCard" data-character-id="${c.id}">
  <b>${c.name}</b><br>
          ${c.species || "Unknown Species"} ${c.class || "Unknown Class"} ${c.subclass ? `(${c.subclass})` : ""} Lv ${c.level}

          <div class="characterStats">
            <span>❤️ ${c.currentHP || 0}/${c.maxHP || 0}</span>
            <span>🛡 AC ${c.ac}</span>
            <span>👁 PP ${c.passivePerception}</span>
            <span>🔎 PI ${c.passiveInvestigation || 10}</span>
            <span>🧠 Insight ${c.passiveInsight || 10}</span>
          </div>

          <div class="characterActions">
            <label class="activeToggleLine">
              <input type="checkbox" class="activeCharacterToggle" data-character-id="${c.id}" ${checked}>
              Active in ${window.dmState.current.campaign}
            </label>

            <button class="editCharacterBtn" data-character-id="${c.id}">
              Edit
            </button>
            <button class="openCharacterDmWorkspaceBtn" data-character-id="${c.id}">
              DM Workspace
            </button>
            <button class="deleteCharacterBtn" data-character-id="${c.id}">
              Delete
            </button>
          </div>
        </div>
      `;
    });

    card.innerHTML = html;
    vault.appendChild(card);
  });

  document.querySelectorAll(".addCharacterForPlayerBtn").forEach((btn) => {
    btn.onclick = async () => {
      await createCharacterForPlayer(
        btn.dataset.playerId,
        btn.dataset.playerName
      );
    };
  });

  document.querySelectorAll(".editCharacterBtn").forEach((btn) => {
    btn.onclick = async () => {
      const chars = await window.dmStorage.getCharacters();
      const players = await window.dmStorage.getPlayers();

      const character = chars.find((c) => c.id === btn.dataset.characterId);
      if (!character) return;

      const player = players.find((p) => p.id === character.playerId);

      await openCharacterModal({
        playerId: character.playerId,
        playerName: player?.name || "Player",
        character
      });
    };
  });

  document.querySelectorAll(".deleteCharacterBtn").forEach((btn) => {
    btn.onclick = async () => {
      const confirmed = confirm("Delete this character permanently?");
      if (!confirmed) return;

      await window.dmStorage.deleteDbRecord(btn.dataset.characterId);

      const party = await window.dmStorage.getCampaignParty();

      if (Array.isArray(party.characters)) {
        party.characters = party.characters.filter(
          (id) => id !== btn.dataset.characterId
        );
        await saveCampaignPartyAndSync(party);
      }

      await renderParty();
      await updatePartySummaryFromActiveCharacters();
    };
  });

  let pcWorkspaceHost = document.querySelector('[data-canonical-dm-workspace-host="pc"]');
  if (!pcWorkspaceHost && vault) {
    pcWorkspaceHost = document.createElement("section");
    pcWorkspaceHost.className = "canonicalDmWorkspaceHost";
    pcWorkspaceHost.dataset.canonicalDmWorkspaceHost = "pc";
    vault.insertAdjacentElement("afterend", pcWorkspaceHost);
  }
  document.querySelectorAll(".openCharacterDmWorkspaceBtn").forEach(button => {
    button.onclick = async () => {
      const entity = await window.dmAPI.getEntity("pc", button.dataset.characterId);
      if (!entity) {
        pcWorkspaceHost.innerHTML = `<p class="forgeEmptyState">Save or activate this character before opening its canonical DM Workspace.</p>`;
        return;
      }
      await renderDmEntityWorkspace(entity, { mount: pcWorkspaceHost, hostContext: "pc", defaultTab: "overview" });
      pcWorkspaceHost.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  });

  document.querySelectorAll(".activeCharacterToggle").forEach((toggle) => {
    toggle.onchange = async () => {
      await toggleCharacterActive(
        toggle.dataset.characterId,
        toggle.checked
      );
    };
  });

  await updatePartySummaryFromActiveCharacters();
  await renderSplitGroupManager();
}

function fillCampaignSelect(select, campaignIds, selectedValue) {
  select.innerHTML = "";

  if (!campaignIds.length) {
    const option = document.createElement("option");

    option.value = "";
    option.textContent = "No campaign selected";

    select.appendChild(option);
    select.value = "";

    if (!hasAutoOpenedCampaignCreation) {
      hasAutoOpenedCampaignCreation = true;

      window.setTimeout(() => {
        openCampaignCreationWizard()
          .catch(error => {
            console.error(
              "Could not automatically open campaign creation:",
              error
            );

            hasAutoOpenedCampaignCreation = false;
          });
      }, 0);
    }

    return;
  }

  campaignIds.forEach(id => {
    const option = document.createElement("option");

    option.value = id;
    option.textContent =
      getCampaignAtlasRecord(id)?.name || id;

    select.appendChild(option);
  });

  select.value = selectedValue || "";
}

function fillCampaignSelect(select, campaignIds, selectedValue) {
  select.innerHTML = "";
  if (!campaignIds.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No campaign selected";
    select.appendChild(option);
  } else {
    campaignIds.forEach(id => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = getCampaignAtlasRecord(id)?.name || id;
      select.appendChild(option);
    });
  }
  select.value = selectedValue || "";
}

function listHtml(items) {
  if (!items || !items.length) return "<p>None recorded.</p>";

  return `
    <ul>
      ${items.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

function creaturesHtml(creatures) {
  if (!creatures) return "<p>None recorded.</p>";

  return `
    <h3>Common</h3>
    ${listHtml(creatures.common)}

    <h3>Dangerous</h3>
    ${listHtml(creatures.dangerous)}

    <h3>Legendary</h3>
    ${listHtml(creatures.legendary)}
  `;
}

async function createdCreaturesHtmlForContext(context = {}) {
  const creatures = await getCreatures();

  const matchingCreatures = creatures.filter(creature => {
    const foundInLocationIds = Array.isArray(creature.foundInLocationIds)
      ? creature.foundInLocationIds.map(String)
      : [];

    const directLocationIds = [
      creature.locationId,
      creature.location,
      creature.defaultLocationId,
      creature.currentLocationId
    ]
      .filter(Boolean)
      .map(String);

    const allLocationIds = [
      ...foundInLocationIds,
      ...directLocationIds
    ];

    if (!allLocationIds.includes(String(context.locationId || ""))) {
      return false;
    }

    const creatureWorldId =
      creature.worldId ||
      creature.world ||
      creature.defaultWorldId ||
      creature.currentWorldId ||
      creature.scope?.worldId ||
      "";

    const creatureRegionId =
      creature.regionId ||
      creature.region ||
      creature.defaultRegionId ||
      creature.currentRegionId ||
      creature.scope?.regionId ||
      "";

    if (
      creatureWorldId &&
      context.worldId &&
      !idsMatch(creatureWorldId, context.worldId)
    ) {
      return false;
    }

    if (
      creatureRegionId &&
      context.regionId &&
      !idsMatch(creatureRegionId, context.regionId)
    ) {
      return false;
    }

    return true;
  });

  if (!matchingCreatures.length) {
    return `
      <h3>Created Creatures</h3>
      <p>None created for this location yet.</p>
    `;
  }

  const sorted = [...matchingCreatures].sort((a, b) => {
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  return `
    <h3>Created Creatures</h3>
    <ul class="regionCreatedCreatureList">
      ${sorted.map(creature => `
        <li>
          <button
            class="regionCreatureOpenBtn"
            type="button"
            data-creature-id="${escapeHtml(creature.id)}"
          >
            <strong>${escapeHtml(creature.name || "Unnamed Creature")}</strong>
            <span>
              CR ${escapeHtml(creature.cr || "?")}
              ${creature._loadedFrom ? `· ${escapeHtml(creature._loadedFrom)}` : ""}
            </span>
          </button>
        </li>
      `).join("")}
    </ul>
  `;
}

function setupRegionCreatureOpenButtons() {
  document.querySelectorAll(".regionCreatureOpenBtn").forEach(button => {
    button.onclick = async () => {
      const creatureId = button.dataset.creatureId;

      await openCreatureFromRegionOverview(creatureId);
    };
  });
}

async function openCreatureFromRegionOverview(creatureId) {
  if (!creatureId) return;

  const creatureTab = document.querySelector('#tabs [data-workspace-group="world-building"] .tab[data-tab="creatures"]');
  const creaturePanel = document.querySelector("#creatures");

  if (!creatureTab || !creaturePanel || !activateMainPanel(creatureTab, creaturePanel)) return;

  const creatures = await getCreatures();
  const creature = creatures.find(item => item.id === creatureId);

  if (!creature) {
    alert("Creature not found.");
    return;
  }

  fillCreatureForm(creature);
  await renderCreatureList();

  switchCreatureWorkspace("overview", false);
}

async function renderRegionInfo() {
  const state = window.dmState.current;

  const regions =
    await window.dmAPI.getRecords("regions", state.world);

  const locations =
    await window.dmAPI.getRecords("locations", state.region);

  const regionInfo =
    regions.find((r) => r.id === state.region);

  const locationInfo =
    locations.find((l) => l.id === state.location);

    const firstFilled = (...values) => {
  for (const value of values) {
    if (Array.isArray(value) && value.length) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return [];
};


  console.log("REGION DISPLAY DATA", {
    state,
    regionInfo,
    locationInfo
  });

  const regionLabel = regionInfo?.name || state.region || "No region selected";
  const locationLabel = locationInfo?.name || state.location || "No location selected";
  document.querySelector("#regionTitle").innerText = `${regionLabel} - ${locationLabel}`;

  document.querySelector("#regionSummary").innerText =
    locationInfo?.summary ||
    regionInfo?.summary ||
    "No location summary recorded.";

    

  document.querySelector("#regionEnvironment").innerHTML = `
  ${listHtml(
    firstFilled(
      locationInfo?.environment,
      locationInfo?.dmTone,
      regionInfo?.environment,
      regionInfo?.dmTone
    )
  )}

  <hr>

  <h3>Weather Roller</h3>

  <p>Roll against the current location weather table.</p>

  <div class="inlineCreateRow">
    <input
      id="weatherRollInput"
      type="number"
      min="1"
      max="20"
      placeholder="d8 roll"
    >

    <button id="findWeatherBtn" type="button">
      Roll Weather
    </button>
  </div>

  <div id="weatherResult" class="forgeResultBox">
    <p>Enter a roll to check the weather.</p>
  </div>
`;

document.querySelector("#regionPolitics").innerHTML = `
  <h3>Politics</h3>
  ${listHtml(firstFilled(locationInfo?.politics, regionInfo?.politics))}
`;

document.querySelector("#regionCulture").innerHTML = `
  <h3>Culture</h3>
  ${listHtml(firstFilled(locationInfo?.culture, regionInfo?.culture))}
`;

document.querySelector("#regionFactions").innerHTML = `
  <h3>Landmarks & Places</h3>
  ${listHtml(
    firstFilled(
      locationInfo?.landmarks,
      locationInfo?.places,
      locationInfo?.pointsOfInterest,
      regionInfo?.landmarks,
      regionInfo?.places,
      regionInfo?.pointsOfInterest
    )
  )}
`;

document.querySelector("#regionHazards").innerHTML =
  listHtml(
    firstFilled(
      locationInfo?.travelHazards,
      locationInfo?.hazards,
      regionInfo?.travelHazards,
      regionInfo?.hazards
    )
  );

document.querySelector("#regionRumours").innerHTML =
  listHtml(firstFilled(locationInfo?.rumours, regionInfo?.rumours));

document.querySelector("#regionSecrets").innerHTML =
  listHtml(
    firstFilled(
      locationInfo?.dmSecrets,
      locationInfo?.gmSecrets,
      regionInfo?.dmSecrets,
      regionInfo?.gmSecrets
    )
  );

document.querySelector("#regionCreatures").innerHTML = `
  <h3>Local Creatures</h3>
  ${listHtml(
    firstFilled(
      locationInfo?.localCreatures,
      locationInfo?.creatures,
      locationInfo?.wildlife
    )
  )}

  <h3>Regional Creatures</h3>
  ${creaturesHtml(regionInfo?.creatures)}

  <p class="forgeEmptyState">Use the location category summary above to browse created creatures.</p>
`;

document.querySelector("#regionHumanoids").innerHTML = `
  <h3>Humanoids</h3>
  ${listHtml(firstFilled(locationInfo?.humanoids, regionInfo?.humanoids))}

    <p class="forgeEmptyState">Use the location category summary above to browse created NPCs and factions.</p>

  <h3>Factions</h3>
  ${listHtml(firstFilled(locationInfo?.factions, regionInfo?.factions))}
`;

setupRegionCreatureOpenButtons();
setupRegionNpcOpenButtons();
await renderLocationCategoryOverview();
setupRegionModule();
}

async function renderLocationCategoryOverview() {
  const countsHost = document.querySelector("#locationCategoryCounts");
  const drilldown = document.querySelector("#locationCategoryDrilldown");
  if (!countsHost || !drilldown) return;
  const locationId = String(window.dmState.current.location || "");
  const types = [["npc", "NPCs"], ["creature", "Creatures"], ["faction", "Factions"], ["vehicle", "Vehicles"]];
  const collections = new Map();
  await Promise.all(types.map(async ([type]) => {
    try {
      const records = await window.dmAPI.getEntitiesByType(type);
      collections.set(type, records.filter(record => {
        const data = record.data_json || record.data || {};
        const scope = data.scope || {};
        const position = data.currentPosition || {};
        return String(position.locationId || data.currentLocationId || scope.locationId || data.locationId || "") === locationId;
      }));
    } catch (error) { console.warn(`Could not load ${type} location summary:`, error); collections.set(type, []); }
  }));
  countsHost.innerHTML = types.map(([type, label]) => `<button type="button" data-location-category="${type}" aria-controls="locationCategoryDrilldown" aria-expanded="false"><span>${label}</span><strong>${collections.get(type).length}</strong></button>`).join("");
  const openCategory = type => {
    const label = types.find(item => item[0] === type)?.[1] || type;
    const records = collections.get(type) || [];
    countsHost.querySelectorAll("button").forEach(button => { const active = button.dataset.locationCategory === type; button.classList.toggle("active", active); button.setAttribute("aria-expanded", String(active)); });
    drilldown.hidden = false;
    drilldown.innerHTML = `<header><div><h2>${escapeHtml(label)} at this location</h2><p>Compact quick-reference records. Filters never change relationships.</p></div><button type="button" data-location-category-close>Close</button></header><label class="location-category-search">Search ${escapeHtml(label)}<input type="search" data-location-category-search placeholder="Search by name or status"></label><div class="location-category-rows">${records.length ? records.map(record => {
      const data = record.data_json || record.data || {};
      const status = data.status || record.status || "Active";
      const visibility = data.visibility?.hidden ? "Hidden" : data.visibility?.archived ? "Archived" : "Visible";
      return `<article class="location-category-row" data-location-row data-search="${escapeHtml(`${record.name || record.id} ${status} ${visibility}`.toLowerCase())}"><div><strong>${escapeHtml(record.name || "Unnamed record")}</strong><small>${escapeHtml(data.displayTitle || data.type || record.entity_type || type)} · ${escapeHtml(status)} · ${escapeHtml(visibility)}</small></div><button type="button" data-location-entity-open="${escapeHtml(record.id)}" data-location-entity-type="${type}">Quick open</button></article>`;
    }).join("") : `<p class="forgeEmptyState">No ${escapeHtml(label.toLowerCase())} are assigned to this location.</p>`}</div>`;
    drilldown.querySelector("[data-location-category-close]").onclick = () => { drilldown.hidden = true; countsHost.querySelectorAll("button").forEach(button => { button.classList.remove("active"); button.setAttribute("aria-expanded", "false"); }); };
    drilldown.querySelector("[data-location-category-search]").oninput = event => { const term = event.target.value.trim().toLowerCase(); drilldown.querySelectorAll("[data-location-row]").forEach(row => row.hidden = Boolean(term) && !row.dataset.search.includes(term)); };
    drilldown.querySelectorAll("[data-location-entity-open]").forEach(button => button.onclick = async () => {
      const record = collections.get(button.dataset.locationEntityType)?.find(item => item.id === button.dataset.locationEntityOpen);
      if (!record) return;
      const type = button.dataset.locationEntityType;
      if (type === "npc") {
        await openNpcBuilderByAnyId(record.data_json?.npcId || record.id);
        scrollCanonicalRecordIntoView("npc", record.data_json?.npcId || record.id);
        window.MasterForgeActionConsole?.updateContext({ pageId: "npc", recordType: "npc", recordId: record.id });
        return;
      }
      if (type === "creature") {
        await openCreatureFromRegionOverview(record.data_json?.creatureId || record.id);
        scrollCanonicalRecordIntoView("creature", record.data_json?.creatureId || record.id);
        window.MasterForgeActionConsole?.updateContext({ pageId: "creatures", recordType: "creature", recordId: record.id });
        return;
      }
      await openEntityLibraryRecord(record);
    });
  };
  countsHost.querySelectorAll("[data-location-category]").forEach(button => button.onclick = () => openCategory(button.dataset.locationCategory));
}

function setupRegionModule() {
  const refreshRegionBtn = document.querySelector("#refreshRegionBtn");
  const weatherBtn = document.querySelector("#findWeatherBtn");
  const weatherInput = document.querySelector("#weatherRollInput");

  if (refreshRegionBtn) {
    refreshRegionBtn.onclick = renderRegionInfo;
  }

  if (weatherBtn) {
    weatherBtn.onclick = findWeatherByRoll;
  }

  if (weatherInput) {
    weatherInput.onkeydown = event => {
      if (event.key === "Enter") {
        findWeatherByRoll();
      }
    };
  }
}

async function findWeatherByRoll() {
  const roll = Number(
    document.querySelector("#weatherRollInput")?.value
  );

  const locationId = window.dmState.current.location;

  const output = document.querySelector("#weatherResult");

  if (!output) return;

  if (!roll) {
    output.innerHTML = "<p>Enter a weather roll.</p>";
    return;
  }

  let table = null;

  try {
    const tables = await window.dmAPI.getRecords("weather", locationId);
    table = tables?.[0] || null;
  } catch (error) {
    console.warn("Could not load weather table records:", error);
  }

  if (!table?.entries?.length) {
    try {
      const locationRecord = await window.dmAPI.getRecord(locationId);

      table =
        locationRecord?.weatherTable ||
        {
          die: "d8",
          entries: locationRecord?.weatherEntries || []
        };
    } catch (error) {
      console.warn("Could not load fallback location weather table:", error);
    }
  }

  if (!table || !table.entries?.length) {
    output.innerHTML = "<p>No weather table found for this location.</p>";
    return;
  }

  const weather = table.entries.find(entry => {
    const [min, max] = String(entry.roll).split("-").map(Number);

    return max
      ? roll >= min && roll <= max
      : roll === min;
  });

  output.innerHTML = weather
    ? `
      <h3>🌦 ${escapeHtml(weather.name || "Weather")}</h3>
      <p>${escapeHtml(weather.description || "")}</p>
      <p><b>Roll:</b> ${escapeHtml(weather.roll || String(roll))}</p>
    `
    : `<p>No weather found for roll ${escapeHtml(String(roll))}.</p>`;
}

async function getBackgroundForCurrentContext(settings) {
  const state = window.dmState.current;

  let locationRecord = null;

  // Strongest source: direct DB lookup by location ID
  try {
    if (state.location && window.dmAPI.getRecord) {
      locationRecord = await window.dmAPI.getRecord(state.location);
    }
  } catch (error) {
    console.warn("Could not get active location directly:", error);
  }

  // Fallback: region-scoped location list
  if (!locationRecord && state.region) {
    try {
      const regionLocations = await window.dmAPI.listLocations(state.region);
      locationRecord = regionLocations.find(location => location.id === state.location);
      window.dmState.locations = regionLocations;
    } catch (error) {
      console.warn("Could not load active location from region:", error);
    }
  }

  const worldRecord =
    (window.dmState.worlds || [])
      .find(world => world.id === state.world);

  const regionRecord =
    (window.dmState.regions || [])
      .find(region => region.id === state.region);

  console.log("BACKGROUND CONTEXT:", {
    state,
    locationRecord,
    hasBackgroundDataUrl: !!locationRecord?.backgroundDataUrl,
    backgroundDataUrlLength: locationRecord?.backgroundDataUrl?.length || 0
  });

  if (locationRecord?.backgroundDataUrl) {
    return locationRecord.backgroundDataUrl;
  }

  if (locationRecord?.background) {
    const background = String(locationRecord.background);

    if (
      background.startsWith("data:") ||
      background.startsWith("file:")
    ) {
      return background;
    }
  }

  const contentBase =
    "file:///" +
    settings.dataPath.replaceAll("\\", "/") +
    "/content-packs/";

  const background =
    locationRecord?.background ||
    regionRecord?.background ||
    worldRecord?.background;

  const packId =
    locationRecord?.contentPack ||
    regionRecord?.contentPack ||
    worldRecord?.contentPack;

  if (background && packId) {
    return contentBase + packId + "/" + background;
  }

  return null;
}


const PLANNED_ENCOUNTER_COLLECTION = "planned-encounters";
const PLANNED_ENCOUNTER_RECORD_TYPE = "planned-encounter";
const PLANNED_ENCOUNTER_PARTICIPANT_TYPES = Object.freeze(["pc", "npc", "creature", "vehicle", "ship", "party", "party_group"]);
const PLANNED_ENCOUNTER_DISPOSITIONS = Object.freeze(["friendly", "neutral", "hostile"]);
const PLANNED_ENCOUNTER_TYPES = Object.freeze(["combat", "social", "exploration", "hazard", "mixed", "other"]);
const PLANNED_ENCOUNTER_STATUSES = Object.freeze(["planned", "completed", "archived"]);
const plannedEncounterUiState = {
  records: [],
  selectedId: "",
  editorRecord: null,
  dirty: false,
  loading: false,
  error: "",
  scope: "",
  loadRequestToken: 0,
  participantSources: [],
  participantPickerOpen: false,
  participantPickerSearch: "",
  participantPickerType: "all",
  participantPickerWorld: "current",
  editingParticipantId: "",
  browserSearch: "",
  browserStatus: "planned",
  browserType: "all",
  contextCatalog: {
    worlds: [],
    regionsByWorld: new Map(),
    locationsByRegion: new Map()
  }
};

function getPlannedEncounterScope() {
  return String(window.dmState.current.campaign || "").trim() || "global";
}

function confirmDiscardPlannedEncounterChanges() {
  if (!plannedEncounterUiState.dirty || !plannedEncounterUiState.editorRecord) return true;
  return confirm("Discard unsaved planned encounter changes?");
}

function isPlannedEncounterWorkspaceActive() {
  return document.querySelector("#encounters")?.classList.contains("active-panel") === true;
}

function getPlannedEncounterEligibilityContext() {
  const record = plannedEncounterUiState.editorRecord;
  return {
    campaignId: String(record?.campaignId || window.dmState.current?.campaign || "").trim(),
    worldId: String(record?.worldId || window.dmState.current?.world || "").trim()
  };
}

function discardCurrentPlannedEncounterEditorState() {
  const saved = plannedEncounterUiState.records.find(item => item.id === plannedEncounterUiState.selectedId);
  plannedEncounterUiState.editorRecord = saved ? clonePlannedEncounterValue(saved) : null;
  if (!saved) plannedEncounterUiState.selectedId = "";
  plannedEncounterUiState.dirty = false;
  plannedEncounterUiState.participantPickerOpen = false;
  plannedEncounterUiState.editingParticipantId = "";
}

function clearPlannedEncounterStateForScopeChange() {
  plannedEncounterUiState.loadRequestToken += 1;
  plannedEncounterUiState.records = [];
  plannedEncounterUiState.selectedId = "";
  plannedEncounterUiState.editorRecord = null;
  plannedEncounterUiState.dirty = false;
  plannedEncounterUiState.loading = false;
  plannedEncounterUiState.error = "";
  plannedEncounterUiState.scope = "";
  plannedEncounterUiState.participantSources = [];
  plannedEncounterUiState.participantPickerOpen = false;
  plannedEncounterUiState.participantPickerSearch = "";
  plannedEncounterUiState.participantPickerType = "all";
  plannedEncounterUiState.participantPickerWorld = "current";
  plannedEncounterUiState.editingParticipantId = "";
}

function createPlannedEncounterId() {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `planned-encounter-${value}`;
}

function createPlannedEncounterParticipantId() {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `encounter-participant-${value}`;
}

function clonePlannedEncounterValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalisePlannedEncounterEditorRecord(record = {}) {
  return {
    ...record,
    campaignId: String(record.campaignId || getPlannedEncounterScope()).trim(),
    worldId: record.worldId == null ? null : String(record.worldId).trim() || null,
    regionId: record.regionId == null ? null : String(record.regionId).trim() || null,
    locationId: record.locationId == null ? null : String(record.locationId).trim() || null,
    encounterType: record.encounterType == null ? "combat" : String(record.encounterType).trim(),
    difficulty: String(record.difficulty || ""),
    environment: String(record.environment || ""),
    timeOfDay: String(record.timeOfDay || ""),
    weather: String(record.weather || ""),
    description: String(record.description || ""),
    gmNotes: String(record.gmNotes || ""),
    status: record.status == null ? "planned" : String(record.status).trim(),
    completedAt: record.completedAt ?? null,
    archivedAt: record.archivedAt ?? null,
    participants: Array.isArray(record.participants) ? record.participants : []
  };
}

async function loadPlannedEncounterContextCatalog() {
  const worlds = await window.dmAPI.listWorlds();
  const regionsByWorld = new Map();
  const locationsByRegion = new Map();
  for (const world of worlds || []) {
    const regions = await window.dmAPI.listRegions(world.id);
    regionsByWorld.set(String(world.id), regions || []);
    for (const region of regions || []) {
      const locations = await window.dmAPI.listLocations(region.id);
      locationsByRegion.set(String(region.id), locations || []);
    }
  }
  plannedEncounterUiState.contextCatalog = {
    worlds: worlds || [],
    regionsByWorld,
    locationsByRegion
  };
}

function getPlannedEncounterCampaignLabel(campaignId) {
  const campaign = typeof getCampaignAtlasRecord === "function"
    ? getCampaignAtlasRecord(campaignId)
    : null;
  return campaign?.name || campaignId || "No Campaign";
}

function findPlannedEncounterContextRecord(kind, id, parentId = "") {
  if (!id) return null;
  const catalog = plannedEncounterUiState.contextCatalog;
  if (kind === "world") return catalog.worlds.find(item => String(item.id) === String(id)) || null;
  if (kind === "region") return (catalog.regionsByWorld.get(String(parentId)) || []).find(item => String(item.id) === String(id)) || null;
  if (kind === "location") return (catalog.locationsByRegion.get(String(parentId)) || []).find(item => String(item.id) === String(id)) || null;
  return null;
}

function findPlannedEncounterContextRecordAnywhere(kind, id) {
  if (!id) return null;
  const catalog = plannedEncounterUiState.contextCatalog;
  if (kind === "region") {
    for (const regions of catalog.regionsByWorld.values()) {
      const match = regions.find(item => String(item.id) === String(id));
      if (match) return match;
    }
  }
  if (kind === "location") {
    for (const locations of catalog.locationsByRegion.values()) {
      const match = locations.find(item => String(item.id) === String(id));
      if (match) return match;
    }
  }
  return null;
}

function getPlannedEncounterContextDetails(record = {}) {
  const world = findPlannedEncounterContextRecord("world", record.worldId);
  const region = findPlannedEncounterContextRecord("region", record.regionId, record.worldId);
  const location = findPlannedEncounterContextRecord("location", record.locationId, record.regionId);
  return {
    campaignLabel: getPlannedEncounterCampaignLabel(record.campaignId),
    world,
    region,
    location,
    missingWorld: Boolean(record.worldId && !world),
    missingRegion: Boolean(record.regionId && !region),
    missingLocation: Boolean(record.locationId && !location)
  };
}

function renderPlannedEncounterSelectOptions(items, selectedId, kindLabel) {
  const selected = String(selectedId || "");
  const resolved = items.some(item => String(item.id) === selected);
  return [
    `<option value="" ${selected ? "" : "selected"}>Unassigned</option>`,
    selected && !resolved
      ? `<option value="${escapeHtml(selected)}" selected>Missing ${escapeHtml(kindLabel)}: ${escapeHtml(selected)}</option>`
      : "",
    ...items.map(item => `<option value="${escapeHtml(item.id)}" ${String(item.id) === selected ? "selected" : ""}>${escapeHtml(item.name || item.id)}</option>`)
  ].join("");
}

function renderPlannedEncounterEnumOptions(values, selectedValue, labels = {}) {
  const selected = String(selectedValue || "");
  const known = values.includes(selected);
  return [
    selected && !known
      ? `<option value="${escapeHtml(selected)}" selected>Unknown: ${escapeHtml(selected)}</option>`
      : "",
    ...values.map(value => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(labels[value] || value[0].toUpperCase() + value.slice(1))}</option>`)
  ].join("");
}

function getPlannedEncounterWarnings(record = {}) {
  const details = getPlannedEncounterContextDetails(record);
  const warnings = [];
  if (details.missingWorld) warnings.push(`Missing World: ${record.worldId}`);
  if (details.missingRegion) warnings.push(findPlannedEncounterContextRecordAnywhere("region", record.regionId)
    ? `Region ${record.regionId} does not belong to the selected World.`
    : `Missing Region: ${record.regionId}`);
  if (details.missingLocation) warnings.push(findPlannedEncounterContextRecordAnywhere("location", record.locationId)
    ? `Location ${record.locationId} does not belong to the selected Region.`
    : `Missing Location: ${record.locationId}`);
  if (record.encounterType && !PLANNED_ENCOUNTER_TYPES.includes(record.encounterType)) warnings.push(`Unknown Encounter Type: ${record.encounterType}`);
  if (record.status && !PLANNED_ENCOUNTER_STATUSES.includes(record.status)) warnings.push(`Unknown Status: ${record.status}`);
  for (const [label, value] of [["Completed timestamp", record.completedAt], ["Archived timestamp", record.archivedAt]]) {
    if (value != null && value !== "" && Number.isNaN(Date.parse(value))) warnings.push(`${label} is not a valid ISO date and has been preserved.`);
  }
  return warnings;
}

function getPlannedEncounterParticipants(record = plannedEncounterUiState.editorRecord) {
  return Array.isArray(record?.participants) ? record.participants : [];
}

function stripPlannedEncounterRuntimeFields(participant = {}) {
  const safe = { ...participant };
  ["currentHp", "currentHP", "maximumHp", "maximumHP", "maxHp", "maxHP", "temporaryHp", "temporaryHP", "conditions", "deathState", "fled", "concentration", "round", "turn", "activeCombatant", "initiativeOrder", "combatOutcome", "combatStatus"].forEach(key => delete safe[key]);
  return safe;
}

function getPlannedEncounterParticipantTypeLabel(type) {
  return ({ pc: "PC", npc: "NPC", creature: "Creature", vehicle: "Vehicle", ship: "Vehicle", party: "Party", party_group: "Party Group" })[type] || "Unknown";
}

function getEntityVisibilityForEncounter(entity = {}) {
  return normaliseVisibility(entity.data_json?.visibility || entity.visibility || {});
}

function isEntityArchivedForEncounter(entity = {}) {
  return getEntityVisibilityForEncounter(entity).archived === true;
}

function makeEncounterSubtitle(parts = []) {
  return parts.map(value => String(value || "").trim()).filter(Boolean).join(" · ");
}

function getEncounterSourceStatus(entity = {}) {
  return String(entity.data_json?.status || entity.status || entity.data_json?.character?.status || "").trim().toLowerCase();
}

function getEncounterSourceBadges(entity = {}) {
  const visibility = getEntityVisibilityForEncounter(entity);
  return [visibility.hidden ? "Hidden" : "", visibility.gmOnly ? "GM only" : ""].filter(Boolean);
}

function getEncounterEntityOwnership(entity = {}) {
  const context = getEntityContext(entity);
  const data = entity.data_json || {};
  return {
    campaignId: String(context.scope?.campaignId || data.campaignId || entity.campaignId || entity.campaign || "").trim(),
    worldId: String(context.currentPosition?.worldId || context.scope?.worldId || data.worldId || entity.worldId || entity.world || "").trim(),
    regionId: String(context.currentPosition?.regionId || data.regionId || entity.regionId || entity.region || "").trim(),
    locationId: String(context.currentPosition?.locationId || data.locationId || entity.locationId || entity.location || "").trim()
  };
}

function getEncounterRecordWorld(record = {}) {
  return String(record.currentPosition?.worldId || record.locationState?.worldId || record.scope?.worldId || record.worldId || record.world || "").trim();
}

async function loadPlannedEncounterParticipantSources() {
  const { campaignId } = getPlannedEncounterEligibilityContext();
  const [characters, players, partyRecord, npcs, creatures, vehicles, ships, parties, groups] = await Promise.all([
    window.dmStorage.getCharacters(),
    window.dmStorage.getPlayers(),
    window.dmStorage.getCampaignParty(),
    window.dmAPI.getEntitiesByType("npc"),
    window.dmAPI.getEntitiesByType("creature"),
    window.dmAPI.getEntitiesByType("vehicle"),
    window.dmAPI.getEntitiesByType("ship"),
    window.dmAPI.getEntitiesByType("party"),
    window.dmAPI.getEntitiesByType("party_group")
  ]);
  const charactersById = new Map((characters || []).map(item => [String(item.id), item]));
  const playersById = new Map((players || []).map(item => [String(item.id), item]));
  const partyIds = [...new Set((Array.isArray(partyRecord?.characters) ? partyRecord.characters : []).map(String))];
  const sources = [];

  partyIds.forEach(characterId => {
    const character = charactersById.get(characterId);
    if (!character || ["inactive", "dead", "retired"].includes(String(character.status || "").toLowerCase())) return;
    const player = playersById.get(String(character.playerId || ""));
    sources.push({
      sourceType: "pc", sourceId: String(character.id), displayName: character.name || "Unnamed Character",
      subtitle: makeEncounterSubtitle([player?.name, [character.species, character.class].filter(Boolean).join(" "), character.level ? `Level ${character.level}` : ""]),
      badges: [], previewMembers: [], campaignId,
      worldId: getEncounterRecordWorld(character),
      regionId: String(character.regionId || character.region || "").trim(),
      locationId: String(character.locationId || character.location || "").trim()
    });
  });

  let excludedWithoutCampaign = 0;
  const ownedByEncounterCampaign = entity => {
    const ownership = getEncounterEntityOwnership(entity);
    if (!ownership.campaignId) {
      excludedWithoutCampaign += 1;
      return false;
    }
    return ownership.campaignId === campaignId;
  };

  (npcs || []).filter(entity => ownedByEncounterCampaign(entity) && !isEntityArchivedForEncounter(entity) && !["dead", "missing", "retired"].includes(getEncounterSourceStatus(entity))).forEach(entity => {
    const data = entity.data_json || {};
    const ownership = getEncounterEntityOwnership(entity);
    sources.push({ sourceType: "npc", sourceId: String(entity.id), displayName: entity.name || "Unnamed NPC", subtitle: makeEncounterSubtitle([data.role || data.occupation, data.species, data.locationName]), badges: getEncounterSourceBadges(entity), previewMembers: [], ...ownership });
  });
  (creatures || []).filter(entity => ownedByEncounterCampaign(entity) && !isEntityArchivedForEncounter(entity)).forEach(entity => {
    const data = entity.data_json || {};
    const ownership = getEncounterEntityOwnership(entity);
    sources.push({ sourceType: "creature", sourceId: String(entity.id), displayName: entity.name || "Unnamed Creature", subtitle: makeEncounterSubtitle([data.size, data.type, data.cr ? `CR ${data.cr}` : data.level ? `Level ${data.level}` : "", data.sourceName || data.source]), badges: getEncounterSourceBadges(entity), previewMembers: [], ...ownership });
  });
  [...(vehicles || []).map(entity => ["vehicle", entity]), ...(ships || []).map(entity => ["ship", entity])].filter(([, entity]) => ownedByEncounterCampaign(entity) && !isEntityArchivedForEncounter(entity) && !["destroyed", "inactive"].includes(getEncounterSourceStatus(entity))).forEach(([sourceType, entity]) => {
    const data = entity.data_json || {};
    const ownership = getEncounterEntityOwnership(entity);
    sources.push({ sourceType, sourceId: String(entity.id), displayName: entity.name || "Unnamed Vehicle", subtitle: makeEncounterSubtitle([data.vehicleType || data.type, data.size, data.locationName]), badges: getEncounterSourceBadges(entity), previewMembers: [], ...ownership });
  });

  const partyEntityId = campaignId ? `${window.dmStorage.slugify(campaignId)}-party` : "";
  const partyEntity = (parties || []).find(entity => entity.id === partyEntityId || entity.data_json?.campaignId === campaignId);
  const partyPreview = partyIds.map(id => charactersById.get(id)?.name).filter(Boolean);
  const unresolvedPartyMembers = partyIds.filter(id => !charactersById.has(id)).length;
  if (partyEntity) {
    const ownership = getEncounterEntityOwnership(partyEntity);
    if (ownership.campaignId === campaignId) sources.push({ sourceType: "party", sourceId: String(partyEntity.id), displayName: partyEntity.name || "Current Party", subtitle: makeEncounterSubtitle([`${partyPreview.length} member${partyPreview.length === 1 ? "" : "s"}`]), badges: [], previewMembers: partyPreview, unresolvedMembers: unresolvedPartyMembers, ...ownership });
  }

  const activeGroups = (groups || []).filter(group => group.data_json?.campaignId === campaignId && group.data_json?.parentPartyId === partyEntity?.id && isActiveSplitGroup(group));
  for (const group of activeGroups) {
    const relationships = await getSplitGroupRelationships(group);
    const memberIds = [...new Set(relationships.filter(rel => rel.relationshipType === "member_of_party" && rel.sourceEntityType === "pc" && rel.targetEntityType === "party_group" && rel.targetEntityId === group.id && isManagedSplitGroupRelationship(rel, campaignId, partyEntity.id)).map(rel => String(rel.sourceEntityId)))].sort((a, b) => a.localeCompare(b));
    const previewMembers = memberIds.map(id => charactersById.get(id)?.name).filter(Boolean);
    const ownership = getEncounterEntityOwnership(group);
    sources.push({ sourceType: "party_group", sourceId: String(group.id), displayName: group.name || "Unnamed Party Group", subtitle: makeEncounterSubtitle([`${previewMembers.length} member${previewMembers.length === 1 ? "" : "s"}`]), badges: [], previewMembers, unresolvedMembers: memberIds.length - previewMembers.length, ...ownership });
  }
  if (excludedWithoutCampaign) console.info(`Encounter participant picker excluded ${excludedWithoutCampaign} source record(s) without a campaign association.`);
  return sources;
}

function resolvePlannedEncounterParticipantSource(participant) {
  return plannedEncounterUiState.participantSources.find(source => source.sourceType === participant.sourceType && source.sourceId === participant.sourceId) || null;
}

function hasPlannedEncounterParticipantContextMismatch(record = {}) {
  return getPlannedEncounterParticipants(record).some(participant => {
    const source = resolvePlannedEncounterParticipantSource(participant);
    if (!source) return false;
    return ["worldId", "regionId", "locationId"].some(field =>
      Boolean(record[field] && source[field] && String(record[field]) !== String(source[field]))
    );
  });
}

function markPlannedEncounterDirty() {
  plannedEncounterUiState.dirty = true;
  const state = document.querySelector("[data-planned-encounter-state]");
  if (state) state.textContent = `${plannedEncounterUiState.selectedId ? "Saved encounter" : "Unsaved encounter"} — Unsaved changes`;
}

function getCurrentPlannedEncounterContext() {
  const value = key => {
    const current = String(window.dmState.current[key] || "").trim();
    return current || null;
  };
  return { campaignId: value("campaign"), worldId: value("world"), regionId: value("region"), locationId: value("location") };
}

function createPlannedEncounterDraft(source = null) {
  const now = new Date().toISOString();
  if (source) {
    const safePlannerFields = clonePlannedEncounterValue(source);
    ["round", "turn", "activeCombatant", "currentHp", "currentHP", "conditions", "initiativeOrder", "combatStatus", "combatOutcome"].forEach(key => delete safePlannerFields[key]);
    return {
      ...safePlannerFields,
      id: createPlannedEncounterId(),
      recordType: PLANNED_ENCOUNTER_RECORD_TYPE,
      schemaVersion: 1,
      name: `${String(source.name || "Untitled Encounter").trim()} Copy`,
      status: "planned",
      completedAt: null,
      archivedAt: null,
      sessionId: null,
      sessionOrder: null,
      participants: getPlannedEncounterParticipants(safePlannerFields).map(participant => ({ ...stripPlannedEncounterRuntimeFields(participant), id: createPlannedEncounterParticipantId() })),
      createdAt: now,
      updatedAt: now
    };
  }
  return {
    id: createPlannedEncounterId(),
    recordType: PLANNED_ENCOUNTER_RECORD_TYPE,
    schemaVersion: 1,
    name: "",
    ...getCurrentPlannedEncounterContext(),
    encounterType: "combat",
    difficulty: "",
    environment: "",
    timeOfDay: "",
    weather: "",
    status: "planned",
    description: "",
    gmNotes: "",
    completedAt: null,
    archivedAt: null,
    participants: [],
    createdAt: now,
    updatedAt: now
  };
}

function isValidPlannedEncounterRecord(record) {
  return Boolean(record && typeof record === "object" && !Array.isArray(record) && record.recordType === PLANNED_ENCOUNTER_RECORD_TYPE && typeof record.id === "string" && record.id.trim());
}

function formatPlannedEncounterContext(record) {
  const details = getPlannedEncounterContextDetails(record);
  const labelled = (value, resolved, label) => !value
    ? ""
    : resolved?.name || `Missing ${label}: ${value}`;
  const parts = [
    details.campaignLabel,
    labelled(record.worldId, details.world, "World"),
    labelled(record.regionId, details.region, "Region"),
    labelled(record.locationId, details.location, "Location")
  ].filter(Boolean);
  return parts.length ? parts.map(escapeHtml).join(" / ") : "No campaign context";
}

function formatPlannedEncounterType(value) {
  const type = String(value || "combat");
  return PLANNED_ENCOUNTER_TYPES.includes(type)
    ? type[0].toUpperCase() + type.slice(1)
    : `Unknown: ${type}`;
}

function formatPlannedEncounterStatus(value) {
  const status = String(value || "planned");
  return PLANNED_ENCOUNTER_STATUSES.includes(status)
    ? status[0].toUpperCase() + status.slice(1)
    : `Unknown: ${status}`;
}

function renderPlannedEncounterMemberPreview(source) {
  if (!source || !["party", "party_group"].includes(source.sourceType)) return "";
  const names = Array.isArray(source.previewMembers) ? source.previewMembers : [];
  const unresolved = Number(source.unresolvedMembers || 0);
  return `<div class="plannedEncounterMemberPreview"><strong>Current members</strong><span>${names.length ? names.map(escapeHtml).join(", ") : "No resolved members"}${unresolved ? ` · ${unresolved} unresolved` : ""}</span></div>`;
}

function renderPlannedEncounterParticipantEditor(participant) {
  const creature = participant.sourceType === "creature";
  const initiative = participant.initiativeOverride == null ? "" : String(participant.initiativeOverride);
  return `<div class="plannedEncounterParticipantForm" data-planned-participant-form="${escapeHtml(participant.id)}">
    <label>Quantity<input type="number" min="1" step="1" data-participant-field="quantity" value="${creature ? escapeHtml(participant.quantity ?? 1) : "1"}" ${creature ? "" : "disabled"}></label>
    <label>Disposition<select data-participant-field="disposition">${PLANNED_ENCOUNTER_DISPOSITIONS.map(value => `<option value="${value}" ${participant.disposition === value ? "selected" : ""}>${value[0].toUpperCase() + value.slice(1)}</option>`).join("")}</select></label>
    <label>Starting Distance<input data-participant-field="startingDistance" value="${escapeHtml(participant.startingDistance || "")}" placeholder="30 ft, adjacent, far"></label>
    <label>Initiative Override<input type="number" step="any" data-participant-field="initiativeOverride" value="${escapeHtml(initiative)}" placeholder="Automatic"></label>
    <div class="plannedEncounterParticipantChecks">${[["hidden", "Hidden"], ["surprised", "Surprised"], ["startsInvisible", "Starts Invisible"], ["startsMounted", "Starts Mounted"], ["startsInVehicle", "Starts in Vehicle"]].map(([field, label]) => `<label><input type="checkbox" data-participant-field="${field}" ${participant[field] ? "checked" : ""}>${label}</label>`).join("")}</div>
    <label class="plannedEncounterParticipantNotes">Notes<textarea data-participant-field="notes" rows="3">${escapeHtml(participant.notes || "")}</textarea></label>
    <div class="plannedEncounterParticipantFormActions"><button type="button" data-participant-done="${escapeHtml(participant.id)}">Done</button></div>
  </div>`;
}

function renderPlannedEncounterParticipantList(record) {
  const participants = getPlannedEncounterParticipants(record);
  return `<section class="plannedEncounterParticipants"><div class="plannedEncounterParticipantsHeader"><div><h3>Participants</h3><p>Canonical sources with encounter setup instructions. Runtime combat state is not stored here.</p></div></div>
    <div class="plannedEncounterParticipantList">${participants.length ? participants.map(participant => {
      const source = resolvePlannedEncounterParticipantSource(participant);
      const displayName = source?.displayName || participant.displayName || "Unnamed Participant";
      const subtitle = source?.subtitle || participant.subtitle || "";
      const setup = [participant.disposition || "neutral", participant.sourceType === "creature" && Number(participant.quantity || 1) > 1 ? `Quantity ${participant.quantity}` : "", participant.hidden ? "Hidden" : "", participant.surprised ? "Surprised" : "", participant.startsInvisible ? "Invisible" : "", participant.startsMounted ? "Mounted" : "", participant.startsInVehicle ? "In Vehicle" : "", participant.startingDistance || "", participant.initiativeOverride != null ? `Initiative ${participant.initiativeOverride}` : ""].filter(Boolean);
      return `<article class="plannedEncounterParticipantCard ${source ? "" : "missing"}"><div class="plannedEncounterParticipantSummary"><div><div class="plannedEncounterParticipantTitle"><strong>${escapeHtml(displayName)}</strong><span>${escapeHtml(getPlannedEncounterParticipantTypeLabel(participant.sourceType))}</span>${source ? "" : `<span class="plannedEncounterBadge warning">Missing Source</span>`}</div>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}<small>${setup.map(escapeHtml).join(" · ")}</small></div><div><button type="button" data-participant-edit="${escapeHtml(participant.id)}">Edit</button><button type="button" class="dangerBtn" data-participant-remove="${escapeHtml(participant.id)}">Remove</button></div></div>${renderPlannedEncounterMemberPreview(source)}${plannedEncounterUiState.editingParticipantId === participant.id ? renderPlannedEncounterParticipantEditor(participant) : ""}</article>`;
    }).join("") : `<p class="forgeEmptyState">No participants added yet.</p>`}</div>
  </section>`;
}

function renderPlannedEncounterParticipantPicker() {
  if (!plannedEncounterUiState.participantPickerOpen) return "";
  const term = plannedEncounterUiState.participantPickerSearch.trim().toLowerCase();
  const type = plannedEncounterUiState.participantPickerType;
  const worldMode = plannedEncounterUiState.participantPickerWorld;
  const { worldId } = getPlannedEncounterEligibilityContext();
  const sources = plannedEncounterUiState.participantSources.filter(source => {
    const matchesType = type === "all" || (type === "vehicle" ? ["vehicle", "ship"].includes(source.sourceType) : source.sourceType === type);
    const record = plannedEncounterUiState.editorRecord || {};
    const matchesWorld = worldMode === "all" || (
      Boolean(worldId) && source.worldId === worldId &&
      (!record.regionId || !source.regionId || source.regionId === record.regionId) &&
      (!record.locationId || !source.locationId || source.locationId === record.locationId)
    );
    const matchesSearch = !term || [source.displayName, source.subtitle, ...(source.badges || [])].some(value => String(value || "").toLowerCase().includes(term));
    return matchesType && matchesWorld && matchesSearch;
  });
  const filters = [["all", "All"], ["pc", "PC"], ["npc", "NPC"], ["creature", "Creature"], ["vehicle", "Vehicle"], ["party", "Party"], ["party_group", "Party Group"]];
  return `<div class="plannedEncounterPickerBackdrop" data-participant-picker-close><section class="plannedEncounterPicker" role="dialog" aria-modal="true" aria-labelledby="plannedEncounterPickerTitle"><div class="plannedEncounterPickerHeader"><div><h3 id="plannedEncounterPickerTitle">Add Encounter Participant</h3><p>Select a canonical source from this Encounter's campaign. This does not change the source or its memberships.</p></div><button type="button" data-participant-picker-close aria-label="Close participant picker">Close</button></div><div class="plannedEncounterPickerControls"><input type="search" data-participant-picker-search value="${escapeHtml(plannedEncounterUiState.participantPickerSearch)}" placeholder="Search participants"><label>World<select data-participant-picker-world><option value="current" ${worldMode === "current" ? "selected" : ""}>Current World</option><option value="all" ${worldMode === "all" ? "selected" : ""}>All Worlds in This Campaign</option></select></label></div><div class="plannedEncounterPickerFilters">${filters.map(([value, label]) => `<button type="button" class="${type === value ? "active" : ""}" data-participant-picker-type="${value}">${label}</button>`).join("")}</div><div class="plannedEncounterPickerResults">${sources.length ? sources.map(source => `<article class="plannedEncounterPickerItem"><div><div class="plannedEncounterParticipantTitle"><strong>${escapeHtml(source.displayName)}</strong><span>${escapeHtml(getPlannedEncounterParticipantTypeLabel(source.sourceType))}</span>${(source.badges || []).map(badge => `<span class="plannedEncounterBadge">${escapeHtml(badge)}</span>`).join("")}</div>${source.subtitle ? `<p>${escapeHtml(source.subtitle)}</p>` : ""}${renderPlannedEncounterMemberPreview(source)}</div><button type="button" data-participant-add-type="${escapeHtml(source.sourceType)}" data-participant-add-id="${escapeHtml(source.sourceId)}">Add</button></article>`).join("") : `<p class="forgeEmptyState">No eligible participants found for this campaign and world.</p>`}</div></section></div>`;
}

function renderPlannedEncounterEditor(record) {
  if (!record) return `<div class="plannedEncounterEditorEmpty"><p class="forgeEmptyState">Select a planned encounter or use New Encounter in Actions.</p></div>`;
  const saved = plannedEncounterUiState.records.some(item => item.id === record.id);
  const details = getPlannedEncounterContextDetails(record);
  const regions = plannedEncounterUiState.contextCatalog.regionsByWorld.get(String(record.worldId || "")) || [];
  const locations = plannedEncounterUiState.contextCatalog.locationsByRegion.get(String(record.regionId || "")) || [];
  const warnings = getPlannedEncounterWarnings(record);
  if (record.campaignId !== getPlannedEncounterScope()) warnings.push("Campaign ownership does not match the current record scope.");
  if (hasPlannedEncounterParticipantContextMismatch(record)) warnings.push("Some participants are outside the selected World, Region or Location. Their references have been preserved.");
  return `<div class="plannedEncounterEditor" data-planned-encounter-editor>
    <div class="plannedEncounterEditorHeader"><div><h2>${saved ? "Edit Planned Encounter" : "New Planned Encounter"}</h2><p data-planned-encounter-state>${saved ? "Saved encounter" : "Unsaved encounter"}${plannedEncounterUiState.dirty ? " — Unsaved changes" : ""}</p></div></div>
    <label for="plannedEncounterNameInput">Encounter name</label><input id="plannedEncounterNameInput" type="text" data-planned-encounter-name value="${escapeHtml(record.name || "")}" autocomplete="off" placeholder="Encounter name">
    <section class="plannedEncounterMetadataGrid" aria-label="Encounter metadata">
      <label>Campaign<span class="plannedEncounterReadOnlyValue">${escapeHtml(details.campaignLabel)}</span></label>
      <label>World<select data-planned-encounter-field="worldId">${renderPlannedEncounterSelectOptions(plannedEncounterUiState.contextCatalog.worlds, record.worldId, "World")}</select></label>
      <label>Region<select data-planned-encounter-field="regionId" ${record.worldId ? "" : "disabled"}>${renderPlannedEncounterSelectOptions(regions, record.regionId, "Region")}</select></label>
      <label>Location<select data-planned-encounter-field="locationId" ${record.regionId ? "" : "disabled"}>${renderPlannedEncounterSelectOptions(locations, record.locationId, "Location")}</select></label>
      <label>Encounter Type<select data-planned-encounter-field="encounterType">${renderPlannedEncounterEnumOptions(PLANNED_ENCOUNTER_TYPES, record.encounterType)}</select></label>
      <label>Difficulty <small>Manual</small><input data-planned-encounter-field="difficulty" list="plannedEncounterDifficultyOptions" value="${escapeHtml(record.difficulty)}" placeholder="Easy, Hard, custom..."><datalist id="plannedEncounterDifficultyOptions"><option value="Easy"><option value="Medium"><option value="Hard"><option value="Deadly"><option value="Custom"></datalist></label>
      <label>Time of Day<input data-planned-encounter-field="timeOfDay" list="plannedEncounterTimeOptions" value="${escapeHtml(record.timeOfDay)}" placeholder="Morning, Night, custom..."><datalist id="plannedEncounterTimeOptions">${["Dawn", "Morning", "Day", "Afternoon", "Dusk", "Evening", "Night", "Midnight", "Custom"].map(value => `<option value="${value}">`).join("")}</datalist></label>
      <label>Status<select data-planned-encounter-field="status">${renderPlannedEncounterEnumOptions(PLANNED_ENCOUNTER_STATUSES, record.status)}</select></label>
      <label class="plannedEncounterMetadataWide">Environment<input data-planned-encounter-field="environment" value="${escapeHtml(record.environment)}" placeholder="Rocky beach and jungle edge"></label>
      <label class="plannedEncounterMetadataWide">Weather<input data-planned-encounter-field="weather" value="${escapeHtml(record.weather)}" placeholder="Heavy coastal rain"></label>
      <label class="plannedEncounterMetadataWide">Description<textarea data-planned-encounter-field="description" rows="4" placeholder="Concise encounter setup or summary">${escapeHtml(record.description)}</textarea></label>
      <label class="plannedEncounterMetadataWide">GM Notes <small>GM-only</small><textarea data-planned-encounter-field="gmNotes" rows="5" placeholder="Secrets, tactics, contingencies and hidden triggers">${escapeHtml(record.gmNotes)}</textarea></label>
    </section>
    ${warnings.length ? `<div class="plannedEncounterWarnings" role="status">${warnings.map(warning => `<p>${escapeHtml(warning)}</p>`).join("")}</div>` : ""}
    <div class="plannedEncounterContext"><strong>Resolved Context</strong><span>${formatPlannedEncounterContext(record)}</span></div>
    <dl class="plannedEncounterTechnical"><dt>Status</dt><dd>${escapeHtml(formatPlannedEncounterStatus(record.status))}</dd><dt>Record ID</dt><dd>${escapeHtml(record.id)}</dd><dt>Created</dt><dd>${escapeHtml(record.createdAt || "—")}</dd><dt>Updated</dt><dd>${escapeHtml(record.updatedAt || "—")}</dd><dt>Completed</dt><dd>${escapeHtml(record.completedAt || "—")}</dd><dt>Archived</dt><dd>${escapeHtml(record.archivedAt || "—")}</dd></dl>
    ${renderPlannedEncounterParticipantList(record)}
    <p class="plannedEncounterStatus" data-planned-encounter-status role="status"></p>
    ${renderPlannedEncounterParticipantPicker()}
  </div>`;
}

function renderPlannedEncounterWorkspaceContents() {
  const container = document.querySelector("#encounters");
  if (!container) return;
  const records = plannedEncounterUiState.records;
  const search = plannedEncounterUiState.browserSearch.trim().toLowerCase();
  const filteredRecords = records.filter(record => {
    const details = getPlannedEncounterContextDetails(record);
    const statusMatches = plannedEncounterUiState.browserStatus === "all" ||
      record.status === plannedEncounterUiState.browserStatus;
    const typeMatches = plannedEncounterUiState.browserType === "all" ||
      record.encounterType === plannedEncounterUiState.browserType;
    const searchable = [
      record.name,
      record.description,
      details.location?.name || record.locationId,
      record.difficulty,
      formatPlannedEncounterType(record.encounterType)
    ].map(value => String(value || "").toLowerCase());
    return statusMatches && typeMatches && (!search || searchable.some(value => value.includes(search)));
  });
  container.innerHTML = `<div class="plannedEncounterShell">
    <aside class="plannedEncounterBrowser infoCard"><div class="plannedEncounterBrowserHeader"><div><h1>Planned Encounters</h1><p>Reusable encounter templates. Combat runtime state is stored separately.</p></div></div>
      ${plannedEncounterUiState.error ? `<p class="factionValidation error">${escapeHtml(plannedEncounterUiState.error)}</p>` : ""}
      <div class="plannedEncounterBrowserFilters">
        <input type="search" data-planned-encounter-filter-search value="${escapeHtml(plannedEncounterUiState.browserSearch)}" placeholder="Search encounters">
        <select data-planned-encounter-filter-status><option value="planned" ${plannedEncounterUiState.browserStatus === "planned" ? "selected" : ""}>Active / Planned</option><option value="completed" ${plannedEncounterUiState.browserStatus === "completed" ? "selected" : ""}>Completed</option><option value="archived" ${plannedEncounterUiState.browserStatus === "archived" ? "selected" : ""}>Archived</option><option value="all" ${plannedEncounterUiState.browserStatus === "all" ? "selected" : ""}>All Statuses</option></select>
        <select data-planned-encounter-filter-type><option value="all">All Types</option>${PLANNED_ENCOUNTER_TYPES.map(value => `<option value="${value}" ${plannedEncounterUiState.browserType === value ? "selected" : ""}>${escapeHtml(formatPlannedEncounterType(value))}</option>`).join("")}</select>
      </div>
      <div class="plannedEncounterList">${filteredRecords.length ? filteredRecords.map(record => {
        const details = getPlannedEncounterContextDetails(record);
        const locationLabel = record.locationId ? details.location?.name || `Missing Location: ${record.locationId}` : "Unassigned location";
        return `<article class="plannedEncounterListItem ${record.id === plannedEncounterUiState.selectedId ? "active" : ""}" data-planned-encounter-id="${escapeHtml(record.id)}"><div><strong>${escapeHtml(record.name || "Untitled Encounter")}</strong><small>${escapeHtml(formatPlannedEncounterType(record.encounterType))} · ${escapeHtml(locationLabel)}</small><small>${escapeHtml(record.difficulty || "No difficulty")} · ${escapeHtml(formatPlannedEncounterStatus(record.status))}</small><small>Updated ${escapeHtml(record.updatedAt || "Unknown")}</small></div><div><button type="button" data-planned-encounter-open="${escapeHtml(record.id)}">Open / Edit</button></div></article>`;
      }).join("") : `<div class="plannedEncounterEmpty"><p class="forgeEmptyState">${records.length ? "No planned encounters match these filters." : "No planned encounters yet. Use New Encounter in Actions."}</p></div>`}</div>
    </aside>
    <main class="plannedEncounterEditorPanel infoCard">${renderPlannedEncounterEditor(plannedEncounterUiState.editorRecord)}</main>
  </div>`;
  wirePlannedEncounterControls(container);
  window.MasterForgeActionConsole?.updateContext({
    pageId: "encounters",
    recordType: "planned-encounter",
    recordId: plannedEncounterUiState.selectedId || null,
    dirty: plannedEncounterUiState.dirty,
    participantCount: plannedEncounterUiState.editorRecord?.participants?.length || 0
  });
}

async function loadPlannedEncounterRecords({ preserveSelection = true } = {}) {
  const requestToken = ++plannedEncounterUiState.loadRequestToken;
  plannedEncounterUiState.loading = true;
  plannedEncounterUiState.error = "";
  const scope = getPlannedEncounterScope();
  try {
    const raw = await window.dmAPI.getRecords(PLANNED_ENCOUNTER_COLLECTION, scope);
    if (requestToken !== plannedEncounterUiState.loadRequestToken || scope !== getPlannedEncounterScope()) return false;
    plannedEncounterUiState.records = (Array.isArray(raw) ? raw : []).filter(record => {
      const valid = isValidPlannedEncounterRecord(record);
      if (!valid) console.warn("Ignoring invalid planned encounter record:", record?.id || "unknown");
      return valid;
    }).map(normalisePlannedEncounterEditorRecord).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) || String(a.name || "").localeCompare(String(b.name || "")));
    plannedEncounterUiState.scope = scope;
    const preserveDirtyEditor = preserveSelection && plannedEncounterUiState.dirty && Boolean(plannedEncounterUiState.editorRecord);
    if (!preserveDirtyEditor && (!preserveSelection || !plannedEncounterUiState.records.some(item => item.id === plannedEncounterUiState.selectedId))) {
      plannedEncounterUiState.selectedId = "";
      plannedEncounterUiState.editorRecord = null;
      plannedEncounterUiState.dirty = false;
    } else if (!preserveDirtyEditor && plannedEncounterUiState.selectedId) {
      plannedEncounterUiState.editorRecord = clonePlannedEncounterValue(plannedEncounterUiState.records.find(item => item.id === plannedEncounterUiState.selectedId));
    }
  } catch (error) {
    if (requestToken !== plannedEncounterUiState.loadRequestToken || scope !== getPlannedEncounterScope()) return false;
    console.error("Could not load planned encounters:", error);
    plannedEncounterUiState.records = [];
    plannedEncounterUiState.error = "Planned encounters could not be loaded. No data was changed.";
  } finally {
    if (requestToken === plannedEncounterUiState.loadRequestToken) plannedEncounterUiState.loading = false;
  }
  return true;
}

async function renderPlannedEncounterWorkspace(options = {}) {
  try {
    await loadPlannedEncounterContextCatalog();
  } catch (error) {
    console.warn("Could not load planned encounter context labels:", error);
    plannedEncounterUiState.contextCatalog = { worlds: [], regionsByWorld: new Map(), locationsByRegion: new Map() };
  }
  const isCurrentLoad = await loadPlannedEncounterRecords({ preserveSelection: options.preserveSelection !== false && plannedEncounterUiState.scope === getPlannedEncounterScope() });
  if (!isCurrentLoad) return;
  try {
    plannedEncounterUiState.participantSources = await loadPlannedEncounterParticipantSources();
  } catch (error) {
    console.warn("Could not load planned encounter participant sources:", error);
    plannedEncounterUiState.participantSources = [];
  }
  renderPlannedEncounterWorkspaceContents();
}

function selectPlannedEncounter(id) {
  const record = plannedEncounterUiState.records.find(item => item.id === id);
  if (!record) return false;
  if (record.id !== plannedEncounterUiState.editorRecord?.id && !confirmDiscardPlannedEncounterChanges()) return false;
  plannedEncounterUiState.selectedId = record.id;
  plannedEncounterUiState.editorRecord = clonePlannedEncounterValue(record);
  plannedEncounterUiState.dirty = false;
  plannedEncounterUiState.participantPickerOpen = false;
  plannedEncounterUiState.editingParticipantId = "";
  plannedEncounterUiState.participantPickerWorld = "current";
  renderPlannedEncounterWorkspaceContents();
  return true;
}

function startNewPlannedEncounter() {
  if (!confirmDiscardPlannedEncounterChanges()) return;
  plannedEncounterUiState.selectedId = "";
  plannedEncounterUiState.editorRecord = createPlannedEncounterDraft();
  plannedEncounterUiState.dirty = true;
  plannedEncounterUiState.participantPickerOpen = false;
  plannedEncounterUiState.editingParticipantId = "";
  plannedEncounterUiState.participantPickerWorld = "current";
  renderPlannedEncounterWorkspaceContents();
  requestAnimationFrame(() => document.querySelector("[data-planned-encounter-name]")?.focus());
}

function validatePlannedEncounterParticipants(participants) {
  const seen = new Set();
  const booleanFields = ["hidden", "surprised", "startsInvisible", "startsMounted", "startsInVehicle"];
  const normalized = [];
  for (const original of participants) {
    const participant = stripPlannedEncounterRuntimeFields(original);
    participant.id = String(participant.id || "").trim();
    participant.sourceType = String(participant.sourceType || "").trim();
    participant.sourceId = String(participant.sourceId || "").trim();
    if (!participant.id) throw new Error("Every participant requires an entry ID.");
    if (seen.has(participant.id)) throw new Error("Participant entry IDs must be unique within the encounter.");
    seen.add(participant.id);
    if (!PLANNED_ENCOUNTER_PARTICIPANT_TYPES.includes(participant.sourceType)) throw new Error(`Unsupported participant source type: ${participant.sourceType || "blank"}.`);
    if (!participant.sourceId) throw new Error("Every participant requires a source ID.");
    const quantity = Number(participant.quantity);
    if (participant.sourceType === "creature") {
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`${participant.displayName || "Creature"} requires a positive whole-number quantity.`);
      participant.quantity = quantity;
    } else {
      participant.quantity = 1;
    }
    if (!PLANNED_ENCOUNTER_DISPOSITIONS.includes(participant.disposition)) throw new Error(`${participant.displayName || "Participant"} has an invalid disposition.`);
    booleanFields.forEach(field => { participant[field] = participant[field] === true; });
    participant.startingDistance = String(participant.startingDistance ?? "");
    participant.notes = String(participant.notes ?? "");
    if (participant.initiativeOverride === "" || participant.initiativeOverride == null) participant.initiativeOverride = null;
    else {
      participant.initiativeOverride = Number(participant.initiativeOverride);
      if (!Number.isFinite(participant.initiativeOverride)) throw new Error(`${participant.displayName || "Participant"} has an invalid initiative override.`);
    }
    normalized.push(participant);
  }
  return normalized;
}

async function savePlannedEncounter() {
  const record = plannedEncounterUiState.editorRecord;
  const status = document.querySelector("[data-planned-encounter-status]");
  if (!record) return;
  const name = document.querySelector("[data-planned-encounter-name]")?.value.trim() || "";
  if (!name) {
    if (status) status.textContent = "Encounter name is required.";
    document.querySelector("[data-planned-encounter-name]")?.focus();
    return;
  }
  const existing = plannedEncounterUiState.records.find(item => item.id === record.id);
  const now = new Date().toISOString();
  const immutableCampaignId = String(existing?.campaignId || record.campaignId || "").trim();
  if (!immutableCampaignId || immutableCampaignId !== getPlannedEncounterScope()) {
    if (status) status.textContent = "Campaign ownership is invalid and cannot be changed from this editor.";
    return;
  }
  const normalizedMetadata = normalisePlannedEncounterEditorRecord(record);
  const resolvedRegion = findPlannedEncounterContextRecord("region", normalizedMetadata.regionId, normalizedMetadata.worldId);
  const resolvedLocation = findPlannedEncounterContextRecord("location", normalizedMetadata.locationId, normalizedMetadata.regionId);
  const regionAnywhere = findPlannedEncounterContextRecordAnywhere("region", normalizedMetadata.regionId);
  const locationAnywhere = findPlannedEncounterContextRecordAnywhere("location", normalizedMetadata.locationId);
  if (normalizedMetadata.regionId && regionAnywhere && !resolvedRegion) {
    if (status) status.textContent = "The selected Region does not belong to the selected World.";
    return;
  }
  if (normalizedMetadata.locationId && locationAnywhere && !resolvedLocation) {
    if (status) status.textContent = "The selected Location does not belong to the selected Region.";
    return;
  }
  let participants;
  try {
    participants = validatePlannedEncounterParticipants(getPlannedEncounterParticipants(record)).map(participant => {
      const source = resolvePlannedEncounterParticipantSource(participant);
      return source ? { ...participant, displayName: source.displayName, subtitle: source.subtitle } : participant;
    });
  } catch (error) {
    if (status) status.textContent = error.message || "Participant setup is invalid.";
    return;
  }
  const payload = {
    ...(existing || record),
    id: record.id,
    recordType: PLANNED_ENCOUNTER_RECORD_TYPE,
    schemaVersion: Number(existing?.schemaVersion || record.schemaVersion || 1),
    name,
    campaignId: immutableCampaignId,
    worldId: normalizedMetadata.worldId,
    regionId: normalizedMetadata.regionId,
    locationId: normalizedMetadata.locationId,
    encounterType: normalizedMetadata.encounterType,
    difficulty: normalizedMetadata.difficulty,
    environment: normalizedMetadata.environment,
    timeOfDay: normalizedMetadata.timeOfDay,
    weather: normalizedMetadata.weather,
    description: normalizedMetadata.description,
    gmNotes: normalizedMetadata.gmNotes,
    status: normalizedMetadata.status,
    completedAt: normalizedMetadata.completedAt,
    archivedAt: normalizedMetadata.archivedAt,
    participants,
    createdAt: existing?.createdAt || record.createdAt || now,
    updatedAt: now
  };
  try {
    if (status) status.textContent = "Saving…";
    await window.dmAPI.saveRecord(PLANNED_ENCOUNTER_COLLECTION, payload.id, payload, getPlannedEncounterScope());
    plannedEncounterUiState.selectedId = payload.id;
    plannedEncounterUiState.editorRecord = payload;
    plannedEncounterUiState.dirty = false;
    await renderPlannedEncounterWorkspace({ preserveSelection: true });
  } catch (error) {
    console.error("Could not save planned encounter:", error);
    if (status) status.textContent = error?.message || "Encounter could not be saved.";
  }
}

async function duplicatePlannedEncounter(id) {
  const source = plannedEncounterUiState.records.find(item => item.id === id) || (plannedEncounterUiState.editorRecord?.id === id ? plannedEncounterUiState.editorRecord : null);
  if (!source) return;
  if (plannedEncounterUiState.dirty && plannedEncounterUiState.editorRecord && !confirmDiscardPlannedEncounterChanges()) return;
  const duplicate = createPlannedEncounterDraft(source);
  try {
    await window.dmAPI.saveRecord(PLANNED_ENCOUNTER_COLLECTION, duplicate.id, duplicate, getPlannedEncounterScope());
    plannedEncounterUiState.selectedId = duplicate.id;
    plannedEncounterUiState.editorRecord = duplicate;
    plannedEncounterUiState.dirty = false;
    await renderPlannedEncounterWorkspace({ preserveSelection: true });
  } catch (error) {
    console.error("Could not duplicate planned encounter:", error);
    plannedEncounterUiState.error = "The encounter could not be duplicated. The original was not changed.";
    renderPlannedEncounterWorkspaceContents();
  }
}

async function deletePlannedEncounter(id) {
  const record = plannedEncounterUiState.records.find(item => item.id === id);
  if (record?.id === plannedEncounterUiState.editorRecord?.id && !confirmDiscardPlannedEncounterChanges()) return;
  if (!record || !confirm(`Delete planned encounter “${record.name || "Untitled Encounter"}”? This does not delete random encounter tables, entities, relationships, sessions or combat data.`)) return;
  try {
    await window.dmAPI.deleteRecord(record.id);
    if (plannedEncounterUiState.selectedId === record.id) {
      plannedEncounterUiState.selectedId = "";
      plannedEncounterUiState.editorRecord = null;
      plannedEncounterUiState.dirty = false;
    }
    await renderPlannedEncounterWorkspace({ preserveSelection: true });
  } catch (error) {
    console.error("Could not delete planned encounter:", error);
    plannedEncounterUiState.error = "The encounter could not be deleted. No item was removed from the list.";
    renderPlannedEncounterWorkspaceContents();
  }
}

function addPlannedEncounterParticipant(sourceType, sourceId) {
  const source = plannedEncounterUiState.participantSources.find(item => item.sourceType === sourceType && item.sourceId === sourceId);
  if (!source || !plannedEncounterUiState.editorRecord) return;
  const participant = {
    id: createPlannedEncounterParticipantId(), sourceType: source.sourceType, sourceId: source.sourceId,
    displayName: source.displayName, subtitle: source.subtitle, quantity: 1, disposition: "neutral",
    hidden: false, surprised: false, startsInvisible: false, startsMounted: false, startsInVehicle: false,
    startingDistance: "", notes: "", initiativeOverride: null
  };
  plannedEncounterUiState.editorRecord.participants = [...getPlannedEncounterParticipants(), participant];
  plannedEncounterUiState.participantPickerOpen = false;
  plannedEncounterUiState.participantPickerSearch = "";
  plannedEncounterUiState.editingParticipantId = participant.id;
  markPlannedEncounterDirty();
  renderPlannedEncounterWorkspaceContents();
}

function removePlannedEncounterParticipant(id) {
  if (!plannedEncounterUiState.editorRecord) return;
  plannedEncounterUiState.editorRecord.participants = getPlannedEncounterParticipants().filter(participant => participant.id !== id);
  if (plannedEncounterUiState.editingParticipantId === id) plannedEncounterUiState.editingParticipantId = "";
  markPlannedEncounterDirty();
  renderPlannedEncounterWorkspaceContents();
}

function updatePlannedEncounterParticipantField(form, target) {
  const participant = getPlannedEncounterParticipants().find(item => item.id === form?.dataset.plannedParticipantForm);
  const field = target?.dataset.participantField;
  if (!participant || !field) return;
  if (target.type === "checkbox") participant[field] = target.checked;
  else if (field === "quantity") participant[field] = target.value === "" ? "" : Number(target.value);
  else if (field === "initiativeOverride") participant[field] = target.value === "" ? null : Number(target.value);
  else participant[field] = target.value;
  if (participant.sourceType !== "creature") participant.quantity = 1;
  markPlannedEncounterDirty();
}

function wirePlannedEncounterControls(container) {
  container.querySelectorAll("[data-planned-encounter-new]").forEach(button => button.onclick = startNewPlannedEncounter);
  container.querySelectorAll("[data-planned-encounter-open]").forEach(button => button.onclick = () => selectPlannedEncounter(button.dataset.plannedEncounterOpen));
  container.querySelectorAll("[data-planned-encounter-duplicate]").forEach(button => button.onclick = () => duplicatePlannedEncounter(button.dataset.plannedEncounterDuplicate));
  container.querySelectorAll("[data-planned-encounter-delete]").forEach(button => button.onclick = () => deletePlannedEncounter(button.dataset.plannedEncounterDelete));
  container.querySelector("[data-planned-encounter-save]")?.addEventListener("click", savePlannedEncounter);
  const searchFilter = container.querySelector("[data-planned-encounter-filter-search]");
  searchFilter?.addEventListener("input", event => {
    plannedEncounterUiState.browserSearch = event.currentTarget.value;
    renderPlannedEncounterWorkspaceContents();
    const next = document.querySelector("[data-planned-encounter-filter-search]");
    next?.focus();
    next?.setSelectionRange(next.value.length, next.value.length);
  });
  container.querySelector("[data-planned-encounter-filter-status]")?.addEventListener("change", event => {
    plannedEncounterUiState.browserStatus = event.currentTarget.value;
    renderPlannedEncounterWorkspaceContents();
  });
  container.querySelector("[data-planned-encounter-filter-type]")?.addEventListener("change", event => {
    plannedEncounterUiState.browserType = event.currentTarget.value;
    renderPlannedEncounterWorkspaceContents();
  });
  container.querySelector("[data-participant-picker-open]")?.addEventListener("click", () => {
    plannedEncounterUiState.participantPickerOpen = true;
    renderPlannedEncounterWorkspaceContents();
    document.querySelector("[data-participant-picker-search]")?.focus();
  });
  container.querySelectorAll("[data-participant-picker-close]").forEach(button => button.addEventListener("click", event => {
    if (button.classList.contains("plannedEncounterPickerBackdrop") && event.target !== button) return;
    plannedEncounterUiState.participantPickerOpen = false;
    renderPlannedEncounterWorkspaceContents();
  }));
  container.querySelectorAll("[data-participant-picker-type]").forEach(button => button.addEventListener("click", () => {
    plannedEncounterUiState.participantPickerType = button.dataset.participantPickerType;
    renderPlannedEncounterWorkspaceContents();
  }));
  container.querySelector("[data-participant-picker-world]")?.addEventListener("change", event => {
    plannedEncounterUiState.participantPickerWorld = event.currentTarget.value === "all" ? "all" : "current";
    renderPlannedEncounterWorkspaceContents();
  });
  const pickerSearch = container.querySelector("[data-participant-picker-search]");
  if (pickerSearch) pickerSearch.addEventListener("input", () => {
    plannedEncounterUiState.participantPickerSearch = pickerSearch.value;
    renderPlannedEncounterWorkspaceContents();
    const next = document.querySelector("[data-participant-picker-search]");
    next?.focus();
    next?.setSelectionRange(next.value.length, next.value.length);
  });
  container.querySelectorAll("[data-participant-add-id]").forEach(button => button.addEventListener("click", () => addPlannedEncounterParticipant(button.dataset.participantAddType, button.dataset.participantAddId)));
  container.querySelectorAll("[data-participant-edit]").forEach(button => button.addEventListener("click", () => {
    plannedEncounterUiState.editingParticipantId = button.dataset.participantEdit;
    renderPlannedEncounterWorkspaceContents();
  }));
  container.querySelectorAll("[data-participant-done]").forEach(button => button.addEventListener("click", () => {
    plannedEncounterUiState.editingParticipantId = "";
    renderPlannedEncounterWorkspaceContents();
  }));
  container.querySelectorAll("[data-participant-remove]").forEach(button => button.addEventListener("click", () => removePlannedEncounterParticipant(button.dataset.participantRemove)));
  container.querySelectorAll("[data-planned-participant-form]").forEach(form => form.querySelectorAll("[data-participant-field]").forEach(control => {
    control.addEventListener(control.type === "checkbox" || control.tagName === "SELECT" ? "change" : "input", event => updatePlannedEncounterParticipantField(form, event.currentTarget));
  }));
  container.querySelectorAll("[data-planned-encounter-field]").forEach(control => {
    const eventName = control.tagName === "SELECT" ? "change" : "input";
    control.addEventListener(eventName, event => {
      const record = plannedEncounterUiState.editorRecord;
      const field = event.currentTarget.dataset.plannedEncounterField;
      if (!record || !field) return;
      const value = event.currentTarget.value;
      if (["worldId", "regionId", "locationId"].includes(field)) {
        record[field] = value || null;
        if (field === "worldId") {
          const regions = plannedEncounterUiState.contextCatalog.regionsByWorld.get(String(record.worldId || "")) || [];
          if (!regions.some(item => String(item.id) === String(record.regionId || ""))) {
            record.regionId = null;
            record.locationId = null;
          }
        } else if (field === "regionId") {
          const locations = plannedEncounterUiState.contextCatalog.locationsByRegion.get(String(record.regionId || "")) || [];
          if (!locations.some(item => String(item.id) === String(record.locationId || ""))) record.locationId = null;
        }
      } else if (field === "status") {
        const previousStatus = record.status;
        record.status = value;
        const now = new Date().toISOString();
        if (value === "completed" && previousStatus !== "completed") {
          record.completedAt = now;
          record.archivedAt = null;
        } else if (value === "archived" && previousStatus !== "archived") {
          record.archivedAt = now;
        } else if (value === "planned") {
          record.completedAt = null;
          record.archivedAt = null;
        }
      } else {
        record[field] = value;
      }
      markPlannedEncounterDirty();
      if (control.tagName === "SELECT") renderPlannedEncounterWorkspaceContents();
    });
  });
  const nameInput = container.querySelector("[data-planned-encounter-name]");
  if (nameInput) {
    nameInput.disabled = false;
    nameInput.readOnly = false;
    nameInput.addEventListener("input", event => {
      if (!plannedEncounterUiState.editorRecord) return;
      plannedEncounterUiState.editorRecord.name = event.currentTarget.value;
      markPlannedEncounterDirty();
    const state = container.querySelector("[data-planned-encounter-state]");
    if (state) state.textContent = `${plannedEncounterUiState.selectedId ? "Saved encounter" : "Unsaved encounter"} — Unsaved changes`;
    });
  }
}

async function setupEncounterModule() {
  if (!document.querySelector("#encounters")) {
    console.warn("Encounter container not found");
    return;
  }
  // Installed random encounter tables remain in the separate `encounters` collection for a later slice.
  await renderPlannedEncounterWorkspace({ preserveSelection: false });
}

async function findEncounterByRoll() {
  const roll = Number(document.querySelector("#encounterRollInput").value);
  const locationId = window.dmState.current.location;

  const tables = await window.dmAPI.getRecords("encounters", locationId);
  const table = tables[0];

  const output = document.querySelector("#encounterResult");

  if (!table || !table.entries?.length) {
    output.innerHTML = `<h2>No encounter table found for ${locationId}.</h2>`;
    return;
  }

  const encounter = table.entries.find((entry) => {
    const [min, max] = String(entry.roll).split("-").map(Number);
    return max ? roll >= min && roll <= max : roll === min;
  });

  output.innerHTML = encounter
    ? `<h2>🎲 ${encounter.name}</h2><p>${encounter.description || encounter.notes || ""}</p>`
    : `<h2>No encounter found for roll ${roll}</h2>`;
}

function renderEncounterChecks(checks, activeChars) {
  if (!checks || !checks.length) return "<p>None.</p>";

  return checks.map((check) => {
    let passiveResults = "";

    if (check.skill === "Perception") {
      passiveResults = `
        <h4>Passive Perception</h4>
        <ul>
          ${activeChars.map((char) => {
            const pp = Number(char.passivePerception || 10);
            const success = pp >= check.dc ? "✅ notices" : "❌ misses";
            return `<li>${char.name}: PP ${pp} ${success}</li>`;
          }).join("")}
        </ul>
      `;
    }

    return `
      <div class="checkBlock">
        <p><b>${check.skill} DC ${check.dc}</b> - ${check.success}</p>
        ${passiveResults}
      </div>
    `;
  }).join("");
}

function setupLootModule() {
  document.querySelector("#findLootBtn").onclick = findLootByRoll;
  document.querySelector("#generateVendorBtn").onclick = generateVendor;
}

async function findLootByRoll() {
  const roll = Number(document.querySelector("#lootRollInput").value);
  const locationId = window.dmState.current.location;

  const tables = await window.dmAPI.getRecords("loot", locationId);
  const table = tables[0];

  const output = document.querySelector("#lootResult");

  if (!table || !table.entries?.length) {
    output.innerHTML = `<h2>No loot table found for ${locationId}.</h2>`;
    return;
  }

  const loot = table.entries.find((entry) => {
    const [min, max] = String(entry.roll).split("-").map(Number);
    return max ? roll >= min && roll <= max : roll === min;
  });

  output.innerHTML = loot
    ? `<h2>🎁 ${loot.name || loot.item}</h2><p>${loot.description || loot.notes || ""}</p>`
    : `<h2>No loot found for roll ${roll}</h2>`;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function generateVendor() {
  const table = await window.dmStorage.getVendorTable("jungle-trader");
  const output = document.querySelector("#lootResult");

  if (!table) {
    output.innerHTML = `<h2>No vendor table found for this location.</h2>`;
    return;
  }

  const stock = [...table.stock]
    .sort(() => Math.random() - 0.5)
    .slice(0, 6);

  output.innerHTML = `
    <h2>🛒 ${pickRandom(table.names)}</h2>
    <p><b>Type:</b> ${pickRandom(table.vendorTypes)}</p>
    <p><b>Personality:</b> ${pickRandom(table.personalities)}</p>
    <p><b>Secret:</b> ${pickRandom(table.secrets)}</p>

    <h3>Items Available</h3>
    <ul>
      ${stock.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

let currentGeneratedNpc = null;

let npcBuilderState = {
  currentNpcId: null,
  activeWorkspace: "overview",
  activeNpc: null,
  npcs: []
};

let activeNpcScopeFilter = "current-system";

const npcWorkspaceRenderers = {
  overview: renderNpcOverviewWorkspace,
  personality: renderNpcPersonalityWorkspace,
  traits: renderNpcTraitsWorkspace,
  actions: renderNpcActionsWorkspace,
  bonus: renderNpcBonusActionsWorkspace,
  reactions: renderNpcReactionsWorkspace,
  legendary: renderNpcLegendaryWorkspace,
  lair: renderNpcLairWorkspace,
  entityLinks: renderNpcEntityLinksWorkspace
};

function updateNpcHeroCard() {
  const nameInput = document.querySelector("#npcNameInput");
  const speciesInput = document.querySelector("#npcSpeciesInput");
  const roleInput = document.querySelector("#npcRoleInput");
  const typeInput = document.querySelector("#npcTypeInput");
  const statusInput = document.querySelector("#npcStatusInput");

  const heroTitle = document.querySelector("#npcEditorTitle");
  const heroMeta = document.querySelector("#npcHeroMeta");

  const name =
    nameInput?.value?.trim() ||
    "New NPC";

  const species =
    speciesInput?.value?.trim() ||
    "Unknown Species";

  const role =
    roleInput?.value?.trim() ||
    typeInput?.value?.trim() ||
    "NPC";

  const status =
    statusInput?.value?.trim() ||
    "Unknown";

  if (heroTitle) {
    heroTitle.textContent = name;
  }

  if (heroMeta) {
    heroMeta.textContent = [
      species,
      role,
      status
    ]
      .filter(Boolean)
      .join(" · ");
  }
}

async function getPlaceDisplayName(type, id) {
  if (!id) return "";

  try {
    const record = await window.dmAPI.getRecord(id);
    return record?.name || id;
  } catch (error) {
    console.warn(`Could not load ${type} display name:`, id, error);
    return id;
  }
}


async function updateNpcHeroLocationCard(npc = null) {
  const locationEl = document.querySelector("#npcHeroLocation");

  if (!locationEl) return;

  const activeNpc =
    npc ||
    npcBuilderState.activeNpc ||
    null;

  if (!activeNpc) {
    locationEl.textContent = "📍 No current location set";
    return;
  }

  const locationState =
    activeNpc.locationState ||
    {};

    if (locationState.mode === "unknown") {
  locationEl.textContent = "📍 Current Location: Unknown";

  await renderNpcWorldStateWarnings(activeNpc);
  return;
}

  if (
    locationState.mode === "entity" &&
    locationState.entityType &&
    locationState.entityId
  ) {
    let entityName = locationState.entityId;

    try {
      const entity = await window.dmAPI.getEntity(
        locationState.entityType,
        locationState.entityId
      );

      entityName = entity?.name || entityName;
    } catch (error) {
      console.warn("Could not load NPC containing entity for hero:", error);
    }

    locationEl.textContent = `📍 Aboard ${entityName}`;
    return;
  }

  const effectivePosition =
    typeof getNpcEffectivePosition === "function"
      ? await getNpcEffectivePosition(activeNpc)
      : {
          worldId: activeNpc.world,
          regionId: activeNpc.region,
          locationId: activeNpc.locationId
        };

  const worldName = await getPlaceDisplayName("world", effectivePosition.worldId);
  const regionName = await getPlaceDisplayName("region", effectivePosition.regionId);
  const locationName = await getPlaceDisplayName("location", effectivePosition.locationId);

  const parts = [
    worldName,
    regionName,
    locationName
  ].filter(Boolean);

  locationEl.textContent =
    parts.length
      ? `📍 ${parts.join(" → ")}`
      : "📍 No current location set";

      await renderNpcWorldStateWarnings(activeNpc);
}

const MASTERFORGE_SOURCE_OPTIONS = [
  {
    value: "homebrew",
    label: "Homebrew",
    className: "builderSourceBadgeHomebrew"
  },
  {
    value: "campaign",
    label: "Campaign",
    className: "builderSourceBadgeCampaign"
  },
  {
    value: "adventure-pack",
    label: "Adventure Pack",
    className: "builderSourceBadgeAdventurePack"
  },
  {
    value: "official-reference",
    label: "Official Reference",
    className: "builderSourceBadgeOfficial"
  }
];

function normaliseSourceValue(value = "") {
  const source = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-");

  if (!source) return "homebrew";

  if (source === "adventure") return "adventure-pack";
  if (source === "official") return "official-reference";
  if (source === "official-reference") return "official-reference";
  if (source === "campaign") return "campaign";
  if (source === "homebrew") return "homebrew";

  return source;
}

function getSourceMeta(value = "") {
  const source = normaliseSourceValue(value);

  return (
    MASTERFORGE_SOURCE_OPTIONS.find(option => option.value === source) ||
    {
      value: source,
      label: source
        .replaceAll("-", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase()),
      className: "builderSourceBadgeUnknown"
    }
  );
}

function renderSourceOptions(selectedValue = "homebrew") {
  const selected = normaliseSourceValue(selectedValue);

  return MASTERFORGE_SOURCE_OPTIONS.map(option => `
    <option
      value="${escapeHtml(option.value)}"
      ${option.value === selected ? "selected" : ""}
    >
      ${escapeHtml(option.label)}
    </option>
  `).join("");
}

function renderSourceBadge(value = "homebrew", id = "") {
  const source = getSourceMeta(value);

  return `
    <span
      ${id ? `id="${escapeHtml(id)}"` : ""}
      class="builderSourceBadge ${escapeHtml(source.className)}"
      data-source="${escapeHtml(source.value)}"
    >
      ${escapeHtml(source.label)}
    </span>
  `;
}

function updateSourceBadge(selector, value = "homebrew") {
  const badge = document.querySelector(selector);

  if (!badge) return;

  const source = getSourceMeta(value);

  badge.className = `builderSourceBadge ${source.className}`;
  badge.dataset.source = source.value;
  badge.innerText = source.label;
}

function setupNpcModule() {
  const root = document.querySelector("#npcBuilderRoot");

  if (!root) {
    console.warn("NPC Builder root not found, skipping NPC module.");
    return;
  }

  root.innerHTML = renderNpcBuilderShell();

  document.querySelector("#newNpcBtn").onclick = newNpc;
  document.querySelector("#saveNpcBuilderBtn").onclick = saveNpc;
  document.querySelector("#deleteNpcBuilderBtn").onclick = deleteNpc;
  document.querySelector("#changeNpcImageBtn").onclick = () => {
  document.querySelector("#npcPortraitInput").click();
};

document.querySelector("#npcPortraitInput").onchange = handleNpcPortraitSelected;

document.querySelector("#removeNpcImageBtn").onclick = () => {
  if (!npcBuilderState.activeNpc) return;

  npcBuilderState.activeNpc.image = {
    ...(npcBuilderState.activeNpc.image || {}),
    portrait: ""
  };

  renderNpcImagePreview("");
};

  document.querySelector("#npcSearchInput").oninput = renderNpcList;
document.querySelector("#npcFilterInput").onchange = renderNpcList;

const npcScopeFilterInput = document.querySelector("#npcScopeFilterInput");

if (npcScopeFilterInput) {
  npcScopeFilterInput.value = activeNpcScopeFilter;

  npcScopeFilterInput.onchange = () => {
    activeNpcScopeFilter = npcScopeFilterInput.value;
    renderNpcList();
  };
}

document.querySelectorAll(".npc-workspace-tab").forEach(tab => {
  tab.onclick = () => switchNpcWorkspace(tab.dataset.workspace);
});

  [
  "#npcNameInput",
  "#npcSpeciesInput",
  "#npcRoleInput",
  "#npcTypeInput",
  "#npcStatusInput"
].forEach(selector => {
  const field = document.querySelector(selector);

  if (!field) return;

  field.addEventListener("input", updateNpcHeroCard);
  field.addEventListener("change", updateNpcHeroCard);
});

updateNpcHeroCard();

  renderNpcList();
  newNpc();

  console.log("NPC Builder mounted.");
}

function renderNpcBuilderShell() {
  return `
    <div class="forgeBuilderShell">

      <aside class="forgeBuilderSidebar infoCard">
        <div class="forgeSidebarHeader">
          <h1>🧍 NPC Builder</h1>
          <button id="newNpcBtn">+ New</button>
        </div>

        <input id="npcSearchInput" placeholder="Search NPCs...">

<select id="npcScopeFilterInput">
  ${renderLibraryScopeOptions(activeNpcScopeFilter)}
</select>

<select id="npcFilterInput">
          <option value="all">All NPCs</option>
          <option value="alive">Alive</option>
          <option value="dead">Dead</option>
          <option value="vendor">Vendors</option>
          <option value="boss">Bosses / BBEGs</option>
        </select>

        <div id="npcList" class="forgeBuilderList">
          <p class="forgeEmptyState">No NPCs loaded yet.</p>
        </div>

        <div class="forgeSidebarFooter">
          <span id="npcCount">0 NPCs</span>
        </div>
      </aside>

      <main class="forgeBuilderMain infoCard">
        <section class="infoCard builderHeroCard npcHeroCard">
  <div class="builderHeroTopRow">
    <div>
      <h1 id="npcEditorTitle">New NPC</h1>

      <p id="npcHeroMeta" class="builderHeroMeta">
        Human · NPC · Alive
      </p>

      <p id="npcHeroLocation" class="builderHeroLocation">
  📍 No current location set
</p>

<div id="npcWorldStateWarnings"></div>
    </div>

    <div class="builderHeroActions">
  ${renderSourceBadge("homebrew", "npcSourceBadge")}

  <button id="saveNpcBuilderBtn" type="button">
    💾 Save NPC
  </button>

  <button id="deleteNpcBuilderBtn" class="dangerBtn" type="button">
    Delete
  </button>
</div>
  </div>
</section>

        <input id="npcIdInput" type="hidden">

        <section class="forgeMetadataStrip">
          <div>
            <label>Name</label>
            <input id="npcNameInput">
          </div>

          <div>
            <label>Species</label>
            <input id="npcSpeciesInput" placeholder="Human">
          </div>

          <div>
            <label>Type</label>
            <select id="npcTypeInput">
              <option>Humanoid</option>
              <option>Beast</option>
              <option>Dragon</option>
              <option>Fiend</option>
              <option>Undead</option>
              <option>Celestial</option>
              <option>Fey</option>
              <option>Construct</option>
              <option>Elemental</option>
              <option>Monstrosity</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label>Role</label>
            <input id="npcRoleInput" placeholder="Captain, Vendor, BBEG">
          </div>

          <div>
            <label>Class</label>
            <input id="npcClassInput" placeholder="Fighter, Wizard, Commoner">
          </div>

          <div>
            <label>Level</label>
            <input id="npcLevelInput" type="number" min="0" max="20">
          </div>

          <div>
            <label>CR</label>
            <input id="npcCrInput" placeholder="1/2, 3, 12">
          </div>

          <div>
            <label>Status</label>
            <select id="npcStatusInput">
              <option>Alive</option>
              <option>Dead</option>
              <option>Missing</option>
              <option>Unknown</option>
              <option>Retired</option>
            </select>
          </div>
          <div>
  <label>Source</label>
  <select id="npcSourceInput">
    ${renderSourceOptions("homebrew")}
  </select>
</div>
        </section>

        <section class="forgeStatSummary">

  <div class="forgeImageBlock">
    <div id="npcImagePreview">
      <span>No Image</span>
    </div>

    <div class="forgeImageActions">
      <button id="changeNpcImageBtn" type="button">Change Image</button>
      <button id="removeNpcImageBtn" type="button">Remove</button>
      <input id="npcPortraitInput" type="file" accept="image/*" hidden>
    </div>
  </div>

  <div class="forgeCoreStats">
            <label>Armor Class</label>
            <input id="npcAcInput">

            <label>Hit Points</label>
            <input id="npcHpInput">

            <label>Speed</label>
            <input id="npcSpeedInput">
          </div>

          <div class="forgeAbilityPanel">
            <div class="forgeAbilityGrid">
              <div><label>STR</label><input id="npcStrInput" type="number"></div>
              <div><label>DEX</label><input id="npcDexInput" type="number"></div>
              <div><label>CON</label><input id="npcConInput" type="number"></div>
              <div><label>INT</label><input id="npcIntInput" type="number"></div>
              <div><label>WIS</label><input id="npcWisInput" type="number"></div>
              <div><label>CHA</label><input id="npcChaInput" type="number"></div>
            </div>

            <div class="forgeSmallStatGrid">
              <div>
                <label>Saving Throws</label>
                <input id="npcSavingThrowsInput" placeholder="DEX +4, CHA +6">
              </div>

              <div>
                <label>Skills</label>
                <input id="npcSkillsInput" placeholder="Persuasion +6">
              </div>

              <div>
                <label>Senses</label>
                <input id="npcSensesInput" placeholder="passive Perception 12">
              </div>

              <div>
                <label>Languages</label>
                <input id="npcLanguagesInput" placeholder="Common">
              </div>
            </div>
          </div>

        </section>
        <nav class="forgeWorkspaceTabs">
  <button class="npc-workspace-tab active" data-workspace="overview">Overview</button>
  <button class="npc-workspace-tab" data-workspace="personality">Personality</button>
  <button class="npc-workspace-tab" data-workspace="traits">Traits</button>
  <button class="npc-workspace-tab" data-workspace="actions">Actions</button>
  <button class="npc-workspace-tab" data-workspace="bonus">Bonus Actions</button>
  <button class="npc-workspace-tab" data-workspace="reactions">Reactions</button>
  <button class="npc-workspace-tab" data-workspace="legendary">Legendary</button>
  <button class="npc-workspace-tab" data-workspace="lair">Lair</button>
  <button class="npc-workspace-tab" data-workspace="entityLinks">Entity Links</button>
</nav>

        <section id="npcWorkspaceMount" class="forgeWorkspaceMount"></section>
        <section class="canonicalDmWorkspaceHost" data-canonical-dm-workspace-host="npc"></section>
      </main>

    </div>
  `;
}
function handleNpcPortraitSelected(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    if (!npcBuilderState.activeNpc) {
      npcBuilderState.activeNpc = getDefaultNpc();
    }

    npcBuilderState.activeNpc.image = {
      ...(npcBuilderState.activeNpc.image || {}),
      portrait: reader.result
    };

    renderNpcImagePreview(reader.result);
  };

  reader.readAsDataURL(file);
}

function renderNpcImagePreview(src) {
  const preview = document.querySelector("#npcImagePreview");

  if (!preview) return;

  if (!src) {
    preview.innerHTML = `<span>No Image</span>`;
    return;
  }

  preview.innerHTML = `
    <img
      src="${src}"
      alt="NPC portrait"
      class="creaturePortraitPreview"
    >
  `;
}

function getDefaultNpc() {
  return {
    id: null,
    entityId: "",
    name: "New NPC",
    species: "Human",
    type: "Humanoid",
    role: "NPC",
    class: "",
    level: 1,
    cr: "",
    status: "Alive",
    source: "homebrew",

    image: {
  portrait: "",
  token: "",
  background: ""
},

    stats: {
      ac: "10",
      hp: "4",
      speed: "30 ft.",
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10
    },

    savingThrows: "",
    skills: "",
    senses: "passive Perception 10",
    languages: "Common",

    overview: {
  summary: "",
  currentLocation: "",
  firstMet: ""
},

locationState: {
  mode: "location",
  worldId: window.dmState.current.world,
  regionId: window.dmState.current.region,
  locationId: window.dmState.current.location,
  entityType: "",
  entityId: "",
  notes: ""
},

    personality: {
  appearance: "",
  voice: "",
  mannerisms: "",
  ideals: "",
  bonds: "",
  flaws: "",
  secret: "",
  hook: ""
},

traits: [],
actions: [],
bonusActions: [],
reactions: [],
legendaryActions: [],
lairActions: [],

    flags: {
      isVendor: false,
      isBoss: false,
      legendaryNpc: false,
      hasLair: false
    },

    campaign: window.dmState.current.campaign,
    world: window.dmState.current.world,
    region: window.dmState.current.region,
    locationId: window.dmState.current.location,

    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
}

function normaliseNpc(npc) {
  const base = getDefaultNpc();

  return {
    ...base,
    ...npc,

    source: normaliseSourceValue(npc?.source || base.source || "homebrew"),

    entityId: npc?.entityId || npc?.entity?.id || "",

    image: {
  ...base.image,
  ...(npc?.image || {})

  
},

locationState: {
  ...base.locationState,
  ...(npc?.locationState || {})
},
systemId:
  npc?.systemId ||
  base.systemId ||
  getCurrentSystemId(),

scope: {
  ...base.scope,
  ...(npc?.scope || {})
},

visibility: normaliseVisibility(
  npc?.visibility ||
  base.visibility ||
  {}
),

    stats: {
      ...base.stats,
      ...(npc?.stats || {})
    },

    overview: {
      ...base.overview,
      ...(npc?.overview || {})
    },

    personality: {
  ...base.personality,
  ...(npc?.personality || {})
},

traits: Array.isArray(npc?.traits)
  ? npc.traits
  : [],

actions: Array.isArray(npc?.actions)
  ? npc.actions
  : [],

bonusActions: Array.isArray(npc?.bonusActions)
  ? npc.bonusActions
  : [],

reactions: Array.isArray(npc?.reactions)
  ? npc.reactions
  : [],

legendaryActions: Array.isArray(npc?.legendaryActions)
  ? npc.legendaryActions
  : [],

lairActions: Array.isArray(npc?.lairActions)
  ? npc.lairActions
  : [],

flags: {
      ...base.flags,
      ...(npc?.flags || {})
    }
  };
}

async function getNpcs() {
  let npcs = [];

  try {
    if (window.dmAPI.getAllRecordsInCollection) {
      npcs = await window.dmAPI.getAllRecordsInCollection("npcs");
    }
  } catch (error) {
    console.warn("Could not load all NPCs:", error);
  }

  if (!npcs.length) {
    const current = window.dmState.current || {};

    const fallbackScopes = [
      current.campaign,
      current.world,
      current.region,
      current.location,
      "testing"
    ].filter(Boolean);

    const byId = new Map();

    for (const scope of fallbackScopes) {
      try {
        const scopedNpcs = await window.dmAPI.getRecords("npcs", scope);

        scopedNpcs.forEach(npc => {
          if (!npc?.id) return;

          byId.set(npc.id, {
            ...npc,
            scope
          });
        });
      } catch (error) {
        console.warn("Could not load NPCs for scope:", scope, error);
      }
    }

    npcs = [...byId.values()];
  }

  
  return npcs.map(npc => ({
    ...npc,
    _loadedFrom: npc.scope || npc._loadedFrom || "unknown"
  }));
}

async function renderNpcList() {
  const list = document.querySelector("#npcList");
  const count = document.querySelector("#npcCount");
  const searchInput = document.querySelector("#npcSearchInput");
  const filterInput = document.querySelector("#npcFilterInput");

  if (!list) return;

  const searchTerm = searchInput?.value?.trim().toLowerCase() || "";
  const filter = filterInput?.value || "all";

  const npcs = await getNpcs();
  npcBuilderState.npcs = npcs;

  let filtered = npcs.filter(npc => {
  if (!recordMatchesLibraryScope(npc, activeNpcScopeFilter)) {
    return false;
  }

  const text = [
    npc.name,
    npc.species,
    npc.type,
    npc.role,
    npc.class,
    npc.status,
    npc.systemId,
    npc.world,
    npc.region,
    npc.locationId,
    npc.overview?.summary
  ].join(" ").toLowerCase();

  return !searchTerm || text.includes(searchTerm);
});

  if (filter === "alive") {
    filtered = filtered.filter(npc => npc.status === "Alive");
  }

  if (filter === "dead") {
    filtered = filtered.filter(npc => npc.status === "Dead");
  }

  if (filter === "vendor") {
    filtered = filtered.filter(npc => npc.flags?.isVendor);
  }

  if (filter === "boss") {
    filtered = filtered.filter(npc => npc.flags?.isBoss || npc.flags?.legendaryNpc);
  }

  filtered.sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );

  if (count) {
    count.innerText =
      `${filtered.length} of ${npcs.length} NPC${npcs.length === 1 ? "" : "s"} · ${getGameSystemName(getCurrentSystemId())}`;
  }

  if (!filtered.length) {
  list.innerHTML = npcs.length
    ? `<p class="forgeEmptyState">No matching NPCs.</p>`
    : `<p class="forgeEmptyState">No NPCs saved yet.</p>`;
  return;
}

  list.innerHTML = filtered.map(npc => {
  const portrait =
    npc.image?.portrait ||
    npc.portrait ||
    "";

  const thumbHtml = portrait
    ? `<img src="${portrait}" alt="" class="forgeListThumbImage">`
    : `<span>🧍</span>`;

  return `
    <button
      class="forgeListItem ${npc.id === npcBuilderState.currentNpcId ? "active" : ""}"
      data-id="${escapeHtml(npc.id)}"
      type="button"
    >
      <div class="forgeListThumb">${thumbHtml}</div>

      <div>
        <strong>${escapeHtml(npc.name || "Unnamed NPC")}</strong>
        <span>${escapeHtml(npc.species || "Unknown")} · ${escapeHtml(npc.role || "NPC")} · ${escapeHtml(npc.status || "Unknown")}</span>
      </div>
    </button>
  `;
}).join("");

  list.querySelectorAll(".forgeListItem").forEach(button => {
    button.onclick = async () => {
      const npcs = await getNpcs();
      const npc = npcs.find(item => item.id === button.dataset.id);

      if (npc) {
        fillNpcForm(npc);
      }
    };
  });
}

function newNpc() {
  const npc = getDefaultNpc();
  fillNpcForm(npc);

  const focusRequest =
    typeof window.dmAPI?.focusMainWindow === "function"
      ? window.dmAPI.focusMainWindow()
      : Promise.resolve(false);

  focusRequest.finally(() => {
    requestAnimationFrame(() => {
      document
        .querySelector("#npcNameInput")
        ?.focus();
    });
  });

}

const splitGroupManagerState = {
  open: false,
  selectedGroupId: "",
  memberSelections: new Set(),
  busy: false,
  statusType: "",
  statusMessage: "",
  initialisedCampaignId: "",
  associateContainerType: "",
  associateContainerId: "",
  associateSearch: "",
  associateEntityType: "npc",
  associateEntityId: "",
  associateRelationshipType: "travels_with",
  associateNotes: "",
  associateStatusMessage: "",
  associateOperationInProgress: false,
  reunionReviewGroupId: "",
  reunionAssociationActions: {}
};

const PARTY_ASSOCIATE_RELATIONSHIP_TYPES = new Set([
  "travels_with",
  "companion_of",
  "bonded_to",
  "prisoner_of",
  "has_prisoner",
  "captured_by",
  "holds_captive"
]);

const PARTY_ASSOCIATE_SYMMETRICAL_TYPES = new Set([
  "travels_with",
  "companion_of",
  "bonded_to"
]);

const PARTY_ASSOCIATE_LABELS = {
  travels_with: "Travels With",
  companion_of: "Companion Of",
  bonded_to: "Bonded To",
  prisoner_of: "Prisoner Of",
  has_prisoner: "Has Prisoner",
  captured_by: "Captured By",
  holds_captive: "Holds Captive"
};

function setSplitGroupManagerStatus(message = "", type = "") {
  splitGroupManagerState.statusMessage = message;
  splitGroupManagerState.statusType = type;

  const status = document.querySelector("#splitGroupManagerStatus");
  if (status) {
    status.textContent = message;
    status.className = `splitGroupManagerStatus ${type || ""}`.trim();
  }
}

function getSplitGroupRelationshipMetadata(relationship = {}) {
  return relationship.data_json || relationship.metadata || {};
}

function isManagedSplitGroupRelationship(
  relationship,
  campaignId,
  parentPartyId
) {
  const metadata = getSplitGroupRelationshipMetadata(relationship);
  return (
    metadata.source === "split-group-manager" &&
    metadata.managed === true &&
    metadata.campaignId === campaignId &&
    metadata.parentPartyId === parentPartyId
  );
}

function getSplitGroupStatus(group = {}) {
  return String(
    group.data_json?.status || group.status || "active"
  ).trim().toLowerCase();
}

function isActiveSplitGroup(group = {}) {
  return !["inactive", "dissolved"].includes(
    getSplitGroupStatus(group)
  );
}

async function getCurrentCampaignSplitGroupContext() {
  const campaignId = String(window.dmState.current?.campaign || "").trim();
  if (!campaignId) {
    throw new Error("Select a campaign before managing split groups.");
  }

  const partyEntity = await syncCampaignPartyEntity(campaignId);
  const characters = await window.dmStorage.getCharacters();
  const partyRecord = await window.dmStorage.getCampaignParty();
  const activeIds = new Set(
    Array.isArray(partyRecord?.characters) ? partyRecord.characters : []
  );

  return {
    campaignId,
    partyEntity,
    partyRecord,
    characters: characters.filter(character => activeIds.has(character.id))
  };
}

async function getSplitGroupRelationships(group) {
  const engine = window.MasterForgeRelationshipEngine;
  return (
    await engine.getRelationshipsForEntity("party_group", group.id)
  ).map(value => engine.normaliseRelationshipRecord(value));
}

function isManagedPartyAssociateRelationship(relationship = {}) {
  const metadata = getSplitGroupRelationshipMetadata(relationship);
  return (
    metadata.source === "party-associate-manager" &&
    metadata.managed === true
  );
}

function classifyPartyAssociation(relationshipType) {
  if (relationshipType === "travels_with") return "travellers";
  if (["companion_of", "bonded_to"].includes(relationshipType)) {
    return "companions";
  }
  if (relationshipType === "captured_by") return "historical";
  return "captivity";
}

function getPartyAssociationFacingLabel(association) {
  const relationship = association.relationship;
  const entityIsSource =
    relationship.sourceEntityType === association.entity.entity_type &&
    relationship.sourceEntityId === association.entity.id;
  const definition = window.MasterForgeRelationshipTypes?.get?.(
    relationship.relationshipType
  );

  return (
    (entityIsSource
      ? definition?.labels?.source
      : definition?.labels?.target) ||
    definition?.label ||
    PARTY_ASSOCIATE_LABELS[relationship.relationshipType] ||
    relationship.relationshipType
  );
}

function getPartyAssociationCanonicalEndpoints(
  entity,
  container,
  relationshipType
) {
  const containerIsSource = [
    "has_prisoner",
    "holds_captive"
  ].includes(relationshipType);

  return containerIsSource
    ? {
        sourceEntityType: container.entity_type,
        sourceEntityId: container.id,
        targetEntityType: entity.entity_type,
        targetEntityId: entity.id
      }
    : {
        sourceEntityType: entity.entity_type,
        sourceEntityId: entity.id,
        targetEntityType: container.entity_type,
        targetEntityId: container.id
      };
}

async function discoverPartyAssociations(container) {
  const engine = window.MasterForgeRelationshipEngine;
  const relationships = (
    await engine.getRelationshipsForEntity(
      container.entity_type,
      container.id
    )
  ).map(value => engine.normaliseRelationshipRecord(value));
  const result = {
    travellers: [],
    companions: [],
    captivity: [],
    historical: [],
    all: []
  };

  for (const relationship of relationships) {
    if (!PARTY_ASSOCIATE_RELATIONSHIP_TYPES.has(
      relationship.relationshipType
    )) {
      continue;
    }

    const containerIsSource =
      relationship.sourceEntityType === container.entity_type &&
      relationship.sourceEntityId === container.id;
    const containerIsTarget =
      relationship.targetEntityType === container.entity_type &&
      relationship.targetEntityId === container.id;

    if (!containerIsSource && !containerIsTarget) continue;

    const entityType = containerIsSource
      ? relationship.targetEntityType
      : relationship.sourceEntityType;
    const entityId = containerIsSource
      ? relationship.targetEntityId
      : relationship.sourceEntityId;

    if (!['npc', 'creature'].includes(entityType)) continue;

    const entity = await engine.getEntity(entityType, entityId);
    if (!entity) continue;

    const association = {
      relationship,
      entity,
      managed: isManagedPartyAssociateRelationship(relationship),
      classification: classifyPartyAssociation(
        relationship.relationshipType
      )
    };

    result[association.classification].push(association);
    result.all.push(association);
  }

  return result;
}

function partyAssociationSemanticMatch(
  relationship,
  entity,
  container,
  relationshipType
) {
  if (relationship.relationshipType !== relationshipType) return false;

  const canonical = getPartyAssociationCanonicalEndpoints(
    entity,
    container,
    relationshipType
  );
  const forward =
    relationship.sourceEntityType === canonical.sourceEntityType &&
    relationship.sourceEntityId === canonical.sourceEntityId &&
    relationship.targetEntityType === canonical.targetEntityType &&
    relationship.targetEntityId === canonical.targetEntityId;

  if (forward) return true;
  if (!PARTY_ASSOCIATE_SYMMETRICAL_TYPES.has(relationshipType)) {
    return false;
  }

  return (
    relationship.sourceEntityType === canonical.targetEntityType &&
    relationship.sourceEntityId === canonical.targetEntityId &&
    relationship.targetEntityType === canonical.sourceEntityType &&
    relationship.targetEntityId === canonical.sourceEntityId
  );
}

async function createPartyAssociation(
  entity,
  container,
  relationshipType,
  notes,
  context
) {
  const engine = window.MasterForgeRelationshipEngine;
  const relationships = (
    await engine.getRelationshipsForEntity(
      container.entity_type,
      container.id
    )
  ).map(value => engine.normaliseRelationshipRecord(value));
  const equivalent = relationships.find(relationship =>
    partyAssociationSemanticMatch(
      relationship,
      entity,
      container,
      relationshipType
    )
  );

  if (equivalent) {
    return { relationship: equivalent, existing: true };
  }

  const endpoints = getPartyAssociationCanonicalEndpoints(
    entity,
    container,
    relationshipType
  );
  const relationship = await engine.createRelationship({
    id: window.dmStorage.slugify([
      "party-associate-manager",
      context.campaignId,
      entity.id,
      relationshipType,
      container.id
    ].join("-")),
    ...endpoints,
    relationshipType,
    notes: String(notes || "").trim(),
    metadata: {
      source: "party-associate-manager",
      campaignId: context.campaignId,
      partyId: context.partyEntity.id,
      groupId: container.entity_type === "party_group"
        ? container.id
        : null,
      managed: true
    }
  });

  return { relationship, existing: false };
}

async function removeManagedPartyAssociation(association) {
  if (!association?.managed || !association.relationship?.id) {
    throw new Error("Manual relationships must be managed in the Universal Relationship Builder.");
  }

  await window.MasterForgeRelationshipEngine.deleteRelationship(
    association.relationship.id
  );
}

function getPartyAssociateCounts(associations) {
  return {
    travellers: associations.travellers.length,
    companions: associations.companions.length,
    captivity: associations.captivity.length
  };
}

async function loadPartyAssociateCandidates(entityType, search = "") {
  const entities = await window.dmAPI.getEntitiesByType(entityType);
  const term = String(search || "").trim().toLowerCase();

  return entities.filter(entity => {
    const visibility = getEntityEffectiveContext(entity).visibility || {};
    if (visibility.archived || visibility.hidden) return false;
    if (!term) return true;

    return [
      entity.name,
      entity.entity_type,
      entity.description
    ].some(value => String(value || "").toLowerCase().includes(term));
  });
}

async function ensureManagedSplitGroupParentRelationship(
  group,
  campaignId,
  parentPartyId
) {
  const engine = window.MasterForgeRelationshipEngine;
  const relationships = await getSplitGroupRelationships(group);
  const existing = relationships.find(relationship => (
    relationship.relationshipType === "subgroup_of" &&
    relationship.sourceEntityType === "party_group" &&
    relationship.sourceEntityId === group.id &&
    relationship.targetEntityType === "party" &&
    relationship.targetEntityId === parentPartyId
  ));

  if (existing) return existing;

  return engine.createRelationship({
    id: window.dmStorage.slugify([
      "split-group-manager",
      campaignId,
      group.id,
      "subgroup-of",
      parentPartyId
    ].join("-")),
    sourceEntityType: "party_group",
    sourceEntityId: group.id,
    relationshipType: "subgroup_of",
    targetEntityType: "party",
    targetEntityId: parentPartyId,
    metadata: {
      source: "split-group-manager",
      campaignId,
      parentPartyId,
      managed: true
    }
  });
}

async function loadManagedSplitGroups(campaignId, parentPartyId) {
  const groups = await window.dmAPI.getEntitiesByType("party_group");
  return groups.filter(group => {
    const data = group.data_json || {};
    return (
      data.source === "split-group-manager" &&
      data.campaignId === campaignId &&
      data.parentPartyId === parentPartyId
    );
  });
}

async function rebuildSplitGroupCharacterIds(group) {
  const relationships = await getSplitGroupRelationships(group);
  const data = group.data_json || {};
  const characterIds = relationships
    .filter(relationship => (
      relationship.relationshipType === "member_of_party" &&
      relationship.sourceEntityType === "pc" &&
      relationship.targetEntityType === "party_group" &&
      relationship.targetEntityId === group.id &&
      isManagedSplitGroupRelationship(
        relationship,
        data.campaignId,
        data.parentPartyId
      )
    ))
    .map(relationship => relationship.sourceEntityId);

  const uniqueCharacterIds = [...new Set(characterIds)];
  const updatedGroup = {
    ...group,
    data_json: {
      ...data,
      characterIds: uniqueCharacterIds
    }
  };

  await window.dmAPI.updateEntity("party_group", group.id, updatedGroup);
  return updatedGroup;
}

async function reconcileSplitGroupMemberAssignment(
  characterId,
  selectedGroup,
  context
) {
  const engine = window.MasterForgeRelationshipEngine;
  const relationships = (
    await engine.getRelationshipsForEntity("pc", characterId)
  ).map(value => engine.normaliseRelationshipRecord(value));
  const affectedGroupIds = new Set();

  for (const relationship of relationships) {
    if (
      relationship.relationshipType !== "member_of_party" ||
      relationship.sourceEntityType !== "pc" ||
      relationship.sourceEntityId !== characterId ||
      relationship.targetEntityType !== "party_group"
    ) {
      continue;
    }

    if (!isManagedSplitGroupRelationship(
      relationship,
      context.campaignId,
      context.partyEntity.id
    )) {
      continue;
    }

    affectedGroupIds.add(relationship.targetEntityId);

    if (!selectedGroup || relationship.targetEntityId !== selectedGroup.id) {
      await engine.deleteRelationship(relationship.id);
    }
  }

  if (selectedGroup) {
    affectedGroupIds.add(selectedGroup.id);
    const alreadyAssigned = relationships.some(relationship => (
      relationship.relationshipType === "member_of_party" &&
      relationship.sourceEntityType === "pc" &&
      relationship.sourceEntityId === characterId &&
      relationship.targetEntityType === "party_group" &&
      relationship.targetEntityId === selectedGroup.id &&
      isManagedSplitGroupRelationship(
        relationship,
        context.campaignId,
        context.partyEntity.id
      )
    ));

    if (!alreadyAssigned) {
      await engine.createRelationship({
        id: window.dmStorage.slugify([
          "split-group-manager",
          context.campaignId,
          characterId,
          "member-of",
          selectedGroup.id
        ].join("-")),
        sourceEntityType: "pc",
        sourceEntityId: characterId,
        relationshipType: "member_of_party",
        targetEntityType: "party_group",
        targetEntityId: selectedGroup.id,
        metadata: {
          source: "split-group-manager",
          campaignId: context.campaignId,
          parentPartyId: context.partyEntity.id,
          managed: true
        }
      });
    }
  }

  const groups = await loadManagedSplitGroups(
    context.campaignId,
    context.partyEntity.id
  );
  for (const group of groups) {
    if (affectedGroupIds.has(group.id)) {
      await rebuildSplitGroupCharacterIds(group);
    }
  }
}

async function createSplitGroup(name, characterIds = []) {
  const context = await getCurrentCampaignSplitGroupContext();
  const trimmedName = String(name || "").trim();
  if (!trimmedName) throw new Error("Group name is required.");

  const baseId = `${window.dmStorage.slugify(context.campaignId)}-party-group-${window.dmStorage.slugify(trimmedName)}`;
  let groupId = baseId;
  let suffix = 2;
  while (await window.dmAPI.getEntity("party_group", groupId)) {
    groupId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  let group = await window.dmAPI.createEntity({
    id: groupId,
    entity_type: "party_group",
    name: trimmedName,
    description: "",
    data_json: {
      source: "split-group-manager",
      campaignId: context.campaignId,
      parentPartyId: context.partyEntity.id,
      characterIds: [],
      status: "active"
    }
  });

  await ensureManagedSplitGroupParentRelationship(
    group,
    context.campaignId,
    context.partyEntity.id
  );

  for (const characterId of characterIds) {
    await reconcileSplitGroupMemberAssignment(characterId, group, context);
  }

  group = await window.dmAPI.getEntity("party_group", group.id);
  splitGroupManagerState.selectedGroupId = group.id;
  return group;
}

async function renameSplitGroup(group, name) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) throw new Error("Group name is required.");
  return window.dmAPI.updateEntity("party_group", group.id, {
    ...group,
    name: trimmedName,
    data_json: { ...(group.data_json || {}) }
  });
}

async function dissolveSplitGroup(group) {
  const context = await getCurrentCampaignSplitGroupContext();
  const relationships = await getSplitGroupRelationships(group);
  const engine = window.MasterForgeRelationshipEngine;

  for (const relationship of relationships) {
    if (
      relationship.relationshipType === "member_of_party" &&
      relationship.targetEntityType === "party_group" &&
      relationship.targetEntityId === group.id &&
      isManagedSplitGroupRelationship(
        relationship,
        context.campaignId,
        context.partyEntity.id
      )
    ) {
      await engine.deleteRelationship(relationship.id);
    }
  }

  await window.dmAPI.updateEntity("party_group", group.id, {
    ...group,
    data_json: {
      ...(group.data_json || {}),
      status: "dissolved",
      characterIds: [],
      dissolvedReason: "reunited",
      dissolvedAt: new Date().toISOString()
    }
  });
}

async function transferPartyAssociationToMainParty(
  association,
  context
) {
  const creation = await createPartyAssociation(
    association.entity,
    context.partyEntity,
    association.relationship.relationshipType,
    association.relationship.notes || "",
    context
  );

  if (!creation.relationship) {
    throw new Error(
      `Could not transfer ${association.entity.name || association.entity.id}.`
    );
  }

  await removeManagedPartyAssociation(association);
}

async function completeSplitGroupReunion(group, associations) {
  const context = await getCurrentCampaignSplitGroupContext();
  const actions = splitGroupManagerState.reunionAssociationActions || {};
  const currentCustody = associations.captivity.filter(item => item.managed);

  for (const association of currentCustody) {
    if (!actions[association.relationship.id]) {
      throw new Error(
        "Choose an action for every current prisoner or captive."
      );
    }
  }

  const automaticTransfers = [
    ...associations.travellers,
    ...associations.companions
  ].filter(item => item.managed);

  for (const association of automaticTransfers) {
    await transferPartyAssociationToMainParty(association, context);
  }

  for (const association of currentCustody) {
    const action = actions[association.relationship.id];

    if (action === "transfer") {
      await transferPartyAssociationToMainParty(association, context);
    } else if (action === "remove") {
      await removeManagedPartyAssociation(association);
    }
  }

  await dissolveSplitGroup(group);
  splitGroupManagerState.reunionReviewGroupId = "";
  splitGroupManagerState.reunionAssociationActions = {};
  splitGroupManagerState.associateContainerType = "";
  splitGroupManagerState.associateContainerId = "";
}

async function deleteSplitGroup(group) {
  const context = await getCurrentCampaignSplitGroupContext();
  const relationships = await getSplitGroupRelationships(group);
  const engine = window.MasterForgeRelationshipEngine;

  for (const relationship of relationships) {
    if (isManagedSplitGroupRelationship(
      relationship,
      context.campaignId,
      context.partyEntity.id
    )) {
      await engine.deleteRelationship(relationship.id);
    }
  }

  await window.dmAPI.deleteEntity("party_group", group.id);
}

async function getSplitGroupLocationLabel(group) {
  const contextCache = new Map();
  const context = await resolveEntityEffectiveContext(
    group,
    contextCache,
    new Set()
  );
  const locationId = context.currentPosition?.locationId || "";
  if (!locationId) return "Using main Party location";

  try {
    const location = await window.dmAPI.getRecord(locationId);
    return location?.name || locationId;
  } catch (_error) {
    return locationId;
  }
}

async function refreshSplitGroupRelatedViews() {
  if (typeof loadEntityDebugPanel === "function") {
    await loadEntityDebugPanel();
  }

  if (
    currentlySelectedEntity?.entity_type &&
    currentlySelectedEntity?.id
  ) {
    const refreshedSelection = await window.dmAPI.getEntity(
      currentlySelectedEntity.entity_type,
      currentlySelectedEntity.id
    );

    if (refreshedSelection) {
      currentlySelectedEntity = refreshedSelection;
      await showEntityDebugDetails(refreshedSelection, {
        preserveTreeOpen: true
      });
    }
  }

  const treePanel = document.querySelector("#entityRelationshipTreePanel");
  if (treePanel && !treePanel.classList.contains("hidden")) {
    await loadEntityTreeViewer();
  }
}

async function initialiseSplitGroupManagerGroups(context, groups) {
  if (splitGroupManagerState.initialisedCampaignId === context.campaignId) {
    return groups;
  }

  for (let group of groups) {
    await ensureManagedSplitGroupParentRelationship(
      group,
      context.campaignId,
      context.partyEntity.id
    );
    group = await rebuildSplitGroupCharacterIds(group);
  }

  splitGroupManagerState.initialisedCampaignId = context.campaignId;
  return loadManagedSplitGroups(context.campaignId, context.partyEntity.id);
}

async function renderSplitGroupManager() {
  const mount = document.querySelector("#splitGroupManagerMount");
  if (!mount) return;

  mount.classList.toggle("hidden", !splitGroupManagerState.open);
  if (!splitGroupManagerState.open) {
    mount.innerHTML = "";
    return;
  }

  mount.innerHTML = `<p class="muted">Loading split groups...</p>`;

  try {
    const context = await getCurrentCampaignSplitGroupContext();
    let groups = await loadManagedSplitGroups(
      context.campaignId,
      context.partyEntity.id
    );
    groups = await initialiseSplitGroupManagerGroups(context, groups);
    const activeGroups = groups.filter(isActiveSplitGroup);
    const historicalGroups = groups.filter(group => !isActiveSplitGroup(group));
    const groupDetails = new Map();
    const mainPartyAssociations = await discoverPartyAssociations(
      context.partyEntity
    );

    for (const group of groups) {
      const relationships = await getSplitGroupRelationships(group);
      const memberIds = relationships
        .filter(relationship => (
          relationship.relationshipType === "member_of_party" &&
          relationship.sourceEntityType === "pc" &&
          relationship.targetEntityType === "party_group" &&
          relationship.targetEntityId === group.id &&
          isManagedSplitGroupRelationship(
            relationship,
            context.campaignId,
            context.partyEntity.id
          )
        ))
        .map(relationship => relationship.sourceEntityId);
      groupDetails.set(group.id, {
        memberIds,
        location: await getSplitGroupLocationLabel(group),
        associations: await discoverPartyAssociations(group)
      });
    }

    const associateEditorIsOpen = !!(
      splitGroupManagerState.associateContainerType &&
      splitGroupManagerState.associateContainerId
    );
    const associateCandidates = associateEditorIsOpen
      ? await loadPartyAssociateCandidates(
          splitGroupManagerState.associateEntityType,
          splitGroupManagerState.associateSearch
        )
      : [];

    const renderAssociateCounts = associations => {
      const counts = getPartyAssociateCounts(associations);
      return `
        <div class="partyAssociateCountChips">
          <span>Travellers: ${counts.travellers}</span>
          <span>Companions: ${counts.companions}</span>
          <span>Prisoners/Captives: ${counts.captivity}</span>
        </div>
      `;
    };

    const renderAssociationSection = (title, items) => `
      <section class="partyAssociateSection">
        <h4>${escapeHtml(title)}</h4>
        <div class="partyAssociateList">
          ${items.map(association => `
            <div class="partyAssociateRow" data-association-id="${escapeHtml(association.relationship.id)}">
              <div>
                <strong>${escapeHtml(association.entity.name || association.entity.id)}</strong>
                <span>${escapeHtml(formatEntityTypeLabel(association.entity.entity_type))}</span>
                <span>${escapeHtml(getPartyAssociationFacingLabel(association))}</span>
                ${association.relationship.notes ? `<p>${escapeHtml(association.relationship.notes)}</p>` : ""}
              </div>
              <div class="partyAssociateRowActions">
                <span class="partyAssociateOwnershipBadge ${association.managed ? "managed" : "manual"}">
                  ${association.managed ? "Managed Here" : "Manual Relationship"}
                </span>
                ${association.managed
                  ? `<button type="button" data-associate-remove="${escapeHtml(association.relationship.id)}">Remove</button>`
                  : `<button type="button" data-associate-universal="${escapeHtml(association.relationship.id)}">Manage in Universal Builder</button>`}
              </div>
            </div>
          `).join("") || `<p class="muted">None.</p>`}
        </div>
      </section>
    `;

    const renderAssociateEditor = (container, associations) => {
      const isOpen =
        splitGroupManagerState.associateContainerType === container.entity_type &&
        splitGroupManagerState.associateContainerId === container.id;
      if (!isOpen) return "";

      return `
        <div class="partyAssociateEditor" data-associate-container-type="${escapeHtml(container.entity_type)}" data-associate-container-id="${escapeHtml(container.id)}">
          <div class="partyAssociateEditorHeader">
            <div>
              <h3>Associates of ${escapeHtml(container.name || container.id)}</h3>
              <p>NPCs and creatures remain separate entities and do not inherit this location.</p>
            </div>
            <button type="button" data-associate-close>Close Associates</button>
          </div>
          <div class="partyAssociateStatus" role="status" aria-live="polite">
            ${escapeHtml(splitGroupManagerState.associateStatusMessage)}
          </div>
          <div class="partyAssociateSections">
            ${renderAssociationSection("Travellers", associations.travellers)}
            ${renderAssociationSection("Companions & Bonds", associations.companions)}
            ${renderAssociationSection("Captives & Prisoners", associations.captivity)}
            ${renderAssociationSection("Historical Capture Links", associations.historical)}
          </div>
          <div class="partyAssociateAddControls">
            <label>Entity type
              <select id="partyAssociateEntityTypeInput">
                <option value="npc" ${splitGroupManagerState.associateEntityType === "npc" ? "selected" : ""}>NPC</option>
                <option value="creature" ${splitGroupManagerState.associateEntityType === "creature" ? "selected" : ""}>Creature</option>
              </select>
            </label>
            <label>Search
              <input id="partyAssociateSearchInput" value="${escapeHtml(splitGroupManagerState.associateSearch)}" placeholder="Search existing entities">
            </label>
            <label>Entity
              <select id="partyAssociateEntityInput">
                ${associateCandidates.map(entity => `
                  <option value="${escapeHtml(entity.id)}" ${splitGroupManagerState.associateEntityId === entity.id ? "selected" : ""}>
                    ${escapeHtml(entity.name || entity.id)} — ${escapeHtml(formatEntityTypeLabel(entity.entity_type))}
                  </option>
                `).join("") || `<option value="">No ${escapeHtml(splitGroupManagerState.associateEntityType)} entities found</option>`}
              </select>
            </label>
            <label>Relationship role
              <select id="partyAssociateRelationshipTypeInput">
                ${[...PARTY_ASSOCIATE_RELATIONSHIP_TYPES].map(type => `
                  <option value="${escapeHtml(type)}" ${splitGroupManagerState.associateRelationshipType === type ? "selected" : ""}>
                    ${escapeHtml(PARTY_ASSOCIATE_LABELS[type])}
                  </option>
                `).join("")}
              </select>
            </label>
            <label class="partyAssociateNotesField">Optional notes
              <textarea id="partyAssociateNotesInput" rows="3">${escapeHtml(splitGroupManagerState.associateNotes)}</textarea>
            </label>
            <button id="addPartyAssociateBtn" type="button" ${associateCandidates.length ? "" : "disabled"}>Add Association</button>
          </div>
          <p class="muted">Relationship notes can be changed from the Universal Relationship Builder.</p>
        </div>
      `;
    };

    const renderSplitGroupReunionReview = (group, associations) => {
      const custody = associations.captivity.filter(item => item.managed);
      const manualCount = associations.all.filter(item => !item.managed).length;

      return `
        <div class="splitGroupReunionReview" data-reunion-group-id="${escapeHtml(group.id)}">
          <h4>Review associations before reunion</h4>
          <p>Managed travellers, companions and bonds will transfer to the main Party. Historical capture links will remain with this group.</p>
          ${manualCount ? `<p class="muted">${manualCount} manual relationship${manualCount === 1 ? "" : "s"} will remain attached to this historical group.</p>` : ""}
          <div class="splitGroupReunionChoices">
            ${custody.map(association => `
              <fieldset data-reunion-association-id="${escapeHtml(association.relationship.id)}">
                <legend>${escapeHtml(association.entity.name || association.entity.id)} — ${escapeHtml(PARTY_ASSOCIATE_LABELS[association.relationship.relationshipType])}</legend>
                ${[
                  ["transfer", "Transfer to Main Party"],
                  ["remove", "Remove Association"],
                  ["leave", "Leave With Historical Group"]
                ].map(([value, label]) => `
                  <label>
                    <input type="radio" name="reunion-${escapeHtml(association.relationship.id)}" value="${value}" ${splitGroupManagerState.reunionAssociationActions[association.relationship.id] === value ? "checked" : ""}>
                    ${label}
                  </label>
                `).join("")}
              </fieldset>
            `).join("") || `<p>No current managed custody associations require a choice.</p>`}
          </div>
          <div class="splitGroupActions">
            <button type="button" data-split-action="confirm-reunion">Confirm Reunion</button>
            <button type="button" data-split-action="cancel-reunion">Cancel</button>
          </div>
        </div>
      `;
    };

    const renderGroupCard = (group, historical = false) => {
      const details = groupDetails.get(group.id) || {
        memberIds: [],
        location: "Unknown",
        associations: { travellers: [], companions: [], captivity: [], historical: [], all: [] }
      };
      const memberNames = details.memberIds.map(id => (
        context.characters.find(character => character.id === id)?.name || id
      ));
      return `
        <article class="splitGroupCard ${historical ? "is-historical" : ""}" data-group-id="${escapeHtml(group.id)}">
          <header>
            <div>
              <h3>${escapeHtml(group.name || group.id)}</h3>
              <p>${escapeHtml(getSplitGroupStatus(group))} · ${escapeHtml(details.location)}</p>
            </div>
          </header>
          <p><strong>Members:</strong> ${memberNames.length ? memberNames.map(escapeHtml).join(", ") : "None assigned"}</p>
          ${renderAssociateCounts(details.associations)}
          <div class="splitGroupActions">
            <button type="button" data-split-action="rename" ${historical ? "disabled" : ""}>Rename</button>
            <button type="button" data-split-action="move" ${historical ? "disabled" : ""}>Move Group</button>
            <button type="button" data-split-action="members" ${historical ? "disabled" : ""}>Manage Members</button>
            <button type="button" data-split-action="associates" ${historical ? "disabled" : ""}>Manage Associates</button>
            <button type="button" data-split-action="dissolve" ${historical ? "disabled" : ""}>Reunite with Main Party</button>
            <button type="button" class="dangerBtn" data-split-action="delete">Delete</button>
          </div>
          ${splitGroupManagerState.selectedGroupId === group.id && !historical ? `
            <div class="splitGroupMemberEditor">
              <h4>Assign main Party members</h4>
              ${context.characters.map(character => `
                <label>
                  <input type="checkbox" data-split-member-id="${escapeHtml(character.id)}" ${details.memberIds.includes(character.id) ? "checked" : ""}>
                  <span>${escapeHtml(character.name)}</span>
                </label>
              `).join("") || `<p class="muted">No active main Party members.</p>`}
              <button type="button" data-split-action="save-members">Save Assignments</button>
            </div>
          ` : ""}
          ${renderAssociateEditor(group, details.associations)}
          ${splitGroupManagerState.reunionReviewGroupId === group.id && !historical
            ? renderSplitGroupReunionReview(group, details.associations)
            : ""}
        </article>
      `;
    };

    mount.innerHTML = `
      <section class="splitGroupManagerPanel">
        <div class="splitGroupManagerHeader">
          <div>
            <h2>Split Group Manager</h2>
            <p>${escapeHtml(context.partyEntity.name)} membership remains managed by the main Party screen.</p>
          </div>
          <button id="closeSplitGroupManagerBtn" type="button">Close</button>
        </div>

        <div id="splitGroupManagerStatus" class="splitGroupManagerStatus ${escapeHtml(splitGroupManagerState.statusType)}" role="status" aria-live="polite">
          ${escapeHtml(splitGroupManagerState.statusMessage)}
        </div>

        <article class="splitGroupMainPartyCard">
          <div>
            <h3>${escapeHtml(context.partyEntity.name || context.partyEntity.id)}</h3>
            <p>Main campaign Party</p>
          </div>
          ${renderAssociateCounts(mainPartyAssociations)}
          <button type="button" id="manageMainPartyAssociatesBtn">Manage Associates</button>
          ${renderAssociateEditor(context.partyEntity, mainPartyAssociations)}
        </article>

        <section class="splitGroupCreationCard">
          <h3>Create operational group</h3>
          <label>Group name <input id="newSplitGroupNameInput" type="text"></label>
          <div class="splitGroupMemberChecklist">
            ${context.characters.map(character => `
              <label>
                <input type="checkbox" data-new-split-member-id="${escapeHtml(character.id)}">
                <span>${escapeHtml(character.name)}</span>
              </label>
            `).join("") || `<p class="muted">No active main Party members.</p>`}
          </div>
          <button id="createSplitGroupBtn" type="button">Create Group</button>
        </section>

        <section>
          <h3>Active Groups</h3>
          <div class="splitGroupCardGrid">
            ${activeGroups.map(group => renderGroupCard(group)).join("") || `<p class="muted">No active split groups.</p>`}
          </div>
        </section>

        <section class="splitGroupHistoricalSection">
          <h3>Historical Groups</h3>
          <div class="splitGroupCardGrid">
            ${historicalGroups.map(group => renderGroupCard(group, true)).join("") || `<p class="muted">No historical groups.</p>`}
          </div>
        </section>
      </section>
    `;

    document.querySelector("#closeSplitGroupManagerBtn").onclick = () => {
      splitGroupManagerState.open = false;
      document.querySelector("#manageSplitGroupsBtn")?.classList.remove("active");
      renderSplitGroupManager();
    };

    const toggleAssociateEditor = (containerType, containerId) => {
      const isCurrent =
        splitGroupManagerState.associateContainerType === containerType &&
        splitGroupManagerState.associateContainerId === containerId;
      splitGroupManagerState.associateContainerType = isCurrent ? "" : containerType;
      splitGroupManagerState.associateContainerId = isCurrent ? "" : containerId;
      splitGroupManagerState.associateStatusMessage = "";
      renderSplitGroupManager();
    };

    document.querySelector("#manageMainPartyAssociatesBtn").onclick = () => {
      toggleAssociateEditor("party", context.partyEntity.id);
    };

    const associateEditor = mount.querySelector(".partyAssociateEditor");
    if (associateEditor) {
      const container =
        associateEditor.dataset.associateContainerType === "party"
          ? context.partyEntity
          : groups.find(group =>
              group.id === associateEditor.dataset.associateContainerId
            );
      const associations = container?.entity_type === "party"
        ? mainPartyAssociations
        : groupDetails.get(container?.id)?.associations;
      const typeInput = associateEditor.querySelector("#partyAssociateEntityTypeInput");
      const searchInput = associateEditor.querySelector("#partyAssociateSearchInput");
      const entityInput = associateEditor.querySelector("#partyAssociateEntityInput");
      const relationshipInput = associateEditor.querySelector("#partyAssociateRelationshipTypeInput");
      const notesInput = associateEditor.querySelector("#partyAssociateNotesInput");

      associateEditor.querySelector("[data-associate-close]").onclick = () => {
        splitGroupManagerState.associateContainerType = "";
        splitGroupManagerState.associateContainerId = "";
        renderSplitGroupManager();
      };

      typeInput.onchange = async () => {
        splitGroupManagerState.associateEntityType = typeInput.value;
        splitGroupManagerState.associateEntityId = "";
        await renderSplitGroupManager();
      };
      searchInput.onchange = async () => {
        splitGroupManagerState.associateSearch = searchInput.value;
        splitGroupManagerState.associateEntityId = "";
        await renderSplitGroupManager();
      };
      entityInput.onchange = () => {
        splitGroupManagerState.associateEntityId = entityInput.value;
      };
      relationshipInput.onchange = () => {
        splitGroupManagerState.associateRelationshipType = relationshipInput.value;
      };
      notesInput.oninput = () => {
        splitGroupManagerState.associateNotes = notesInput.value;
      };

      associateEditor.querySelector("#addPartyAssociateBtn").onclick = async () => {
        if (splitGroupManagerState.associateOperationInProgress || !container) return;
        const entityId = entityInput.value;
        const entity = await window.dmAPI.getEntity(typeInput.value, entityId);
        if (!entity) {
          splitGroupManagerState.associateStatusMessage = "Choose an NPC or creature.";
          await renderSplitGroupManager();
          return;
        }

        splitGroupManagerState.associateOperationInProgress = true;
        try {
          const result = await createPartyAssociation(
            entity,
            container,
            relationshipInput.value,
            notesInput.value,
            context
          );
          splitGroupManagerState.associateStatusMessage = result.existing
            ? "That association already exists."
            : "Association created.";
          if (!result.existing) {
            splitGroupManagerState.associateNotes = "";
          }
          await renderSplitGroupManager();
          await refreshSplitGroupRelatedViews();
        } catch (error) {
          splitGroupManagerState.associateStatusMessage =
            error.message || "Association could not be created.";
          await renderSplitGroupManager();
        } finally {
          splitGroupManagerState.associateOperationInProgress = false;
        }
      };

      associateEditor.querySelectorAll("[data-associate-remove]").forEach(button => {
        button.onclick = async () => {
          const association = associations.all.find(item =>
            item.relationship.id === button.dataset.associateRemove
          );
          try {
            await removeManagedPartyAssociation(association);
            splitGroupManagerState.associateStatusMessage = "Association removed.";
            await renderSplitGroupManager();
            await refreshSplitGroupRelatedViews();
          } catch (error) {
            splitGroupManagerState.associateStatusMessage = error.message;
            await renderSplitGroupManager();
          }
        };
      });

      associateEditor.querySelectorAll("[data-associate-universal]").forEach(button => {
        button.onclick = async () => {
          const association = associations.all.find(item =>
            item.relationship.id === button.dataset.associateUniversal
          );
          if (!association) return;
          const relationship = association.relationship;
          const sourceEntity = await window.dmAPI.getEntity(
            relationship.sourceEntityType,
            relationship.sourceEntityId
          );
          if (!sourceEntity) return;
          activateMainPanel(
            document.querySelector('.tab[data-tab="entities"]'),
            document.querySelector("#entities")
          );
          currentlySelectedEntity = sourceEntity;
          await showUniversalRelationshipBuilder(sourceEntity, relationship);
        };
      });
    }

    document.querySelector("#createSplitGroupBtn").onclick = async () => {
      const name = document.querySelector("#newSplitGroupNameInput")?.value || "";
      const memberIds = [...document.querySelectorAll("[data-new-split-member-id]:checked")]
        .map(input => input.dataset.newSplitMemberId);
      splitGroupManagerState.busy = true;
      try {
        await createSplitGroup(name, memberIds);
        setSplitGroupManagerStatus("Split group created.", "success");
        await renderSplitGroupManager();
        await refreshSplitGroupRelatedViews();
      } catch (error) {
        setSplitGroupManagerStatus(error.message || "Could not create split group.", "error");
      } finally {
        splitGroupManagerState.busy = false;
      }
    };

    mount.querySelectorAll(".splitGroupCard").forEach(card => {
      const group = groups.find(item => item.id === card.dataset.groupId);
      if (!group) return;

      card.querySelectorAll("[data-split-action]").forEach(button => {
        button.onclick = async () => {
          const action = button.dataset.splitAction;
          try {
            if (action === "members") {
              splitGroupManagerState.selectedGroupId =
                splitGroupManagerState.selectedGroupId === group.id ? "" : group.id;
              await renderSplitGroupManager();
              return;
            }

            if (action === "associates") {
              toggleAssociateEditor("party_group", group.id);
              return;
            }

            if (action === "save-members") {
              const selectedIds = new Set(
                [...card.querySelectorAll("[data-split-member-id]:checked")]
                  .map(input => input.dataset.splitMemberId)
              );
              for (const character of context.characters) {
                const currentlyHere = groupDetails.get(group.id).memberIds.includes(character.id);
                if (selectedIds.has(character.id)) {
                  await reconcileSplitGroupMemberAssignment(character.id, group, context);
                } else if (currentlyHere) {
                  await reconcileSplitGroupMemberAssignment(character.id, null, context);
                }
              }
              setSplitGroupManagerStatus("Group assignments saved.", "success");
            }

            if (action === "rename") {
              const name = await askUser("New group name?");
              if (name) {
                await renameSplitGroup(group, name);
                setSplitGroupManagerStatus("Group renamed.", "success");
              }
            }

            if (action === "move") {
              activateMainPanel(
                document.querySelector('.tab[data-tab="entities"]'),
                document.querySelector("#entities")
              );
              currentlySelectedEntity = group;
              await showEntityDebugDetails(group);
              await openMoveEntityPanel(group);
              return;
            }

            if (action === "dissolve") {
              splitGroupManagerState.reunionReviewGroupId = group.id;
              splitGroupManagerState.reunionAssociationActions = {};
              await renderSplitGroupManager();
              return;
            }

            if (action === "cancel-reunion") {
              splitGroupManagerState.reunionReviewGroupId = "";
              splitGroupManagerState.reunionAssociationActions = {};
              await renderSplitGroupManager();
              return;
            }

            if (action === "confirm-reunion") {
              card.querySelectorAll("[data-reunion-association-id]").forEach(fieldset => {
                const selected = fieldset.querySelector("input:checked")?.value;
                if (selected) {
                  splitGroupManagerState.reunionAssociationActions[
                    fieldset.dataset.reunionAssociationId
                  ] = selected;
                }
              });
              if (!confirm(`Reunite ${group.name} with the main Party?`)) return;
              await completeSplitGroupReunion(
                group,
                groupDetails.get(group.id).associations
              );
              splitGroupManagerState.selectedGroupId = "";
              setSplitGroupManagerStatus("Group reunited with the main Party.", "success");
            }

            if (action === "delete") {
              if (!confirm(`Permanently delete ${group.name}? This cannot be undone.`)) return;
              await deleteSplitGroup(group);
              if (splitGroupManagerState.selectedGroupId === group.id) {
                splitGroupManagerState.selectedGroupId = "";
              }
              setSplitGroupManagerStatus("Split group deleted.", "success");
            }

            await renderSplitGroupManager();
            await refreshSplitGroupRelatedViews();
          } catch (error) {
            setSplitGroupManagerStatus(error.message || "Split group operation failed.", "error");
          }
        };
      });
    });
  } catch (error) {
    mount.innerHTML = `
      <section class="splitGroupManagerPanel">
        <div class="splitGroupManagerStatus error" role="status" aria-live="polite">
          ${escapeHtml(error.message || "Could not load split groups.")}
        </div>
      </section>
    `;
  }
}

function fillNpcForm(npc) {
  const normalised = normaliseNpc(npc || getDefaultNpc());

  npcBuilderState.currentNpcId = normalised.id || null;
  npcBuilderState.activeNpc = normalised;

  document.querySelector("#npcEditorTitle").innerText =
  normalised.name || "New NPC";

  document.querySelector("#npcIdInput").value = normalised.id || "";
  document.querySelector("#npcNameInput").value = normalised.name || "";
  document.querySelector("#npcSpeciesInput").value = normalised.species || "";
  document.querySelector("#npcTypeInput").value = normalised.type || "Humanoid";
  document.querySelector("#npcRoleInput").value = normalised.role || "";
  document.querySelector("#npcClassInput").value = normalised.class || "";
  document.querySelector("#npcLevelInput").value = normalised.level || 1;
  document.querySelector("#npcCrInput").value = normalised.cr || "";
  document.querySelector("#npcStatusInput").value = normalised.status || "Alive";
  const npcSourceInput = document.querySelector("#npcSourceInput");

if (npcSourceInput) {
  npcSourceInput.value = normaliseSourceValue(
    normalised.source || "homebrew"
  );

  npcSourceInput.onchange = () => {
    updateSourceBadge("#npcSourceBadge", npcSourceInput.value);
  };

  updateSourceBadge("#npcSourceBadge", npcSourceInput.value);
}

  document.querySelector("#npcAcInput").value = normalised.stats?.ac || "";
  document.querySelector("#npcHpInput").value = normalised.stats?.hp || "";
  document.querySelector("#npcSpeedInput").value = normalised.stats?.speed || "";

  document.querySelector("#npcStrInput").value = normalised.stats?.str || 10;
  document.querySelector("#npcDexInput").value = normalised.stats?.dex || 10;
  document.querySelector("#npcConInput").value = normalised.stats?.con || 10;
  document.querySelector("#npcIntInput").value = normalised.stats?.int || 10;
  document.querySelector("#npcWisInput").value = normalised.stats?.wis || 10;
  document.querySelector("#npcChaInput").value = normalised.stats?.cha || 10;

  document.querySelector("#npcSavingThrowsInput").value = normalised.savingThrows || "";
  document.querySelector("#npcSkillsInput").value = normalised.skills || "";
  document.querySelector("#npcSensesInput").value = normalised.senses || "";
  document.querySelector("#npcLanguagesInput").value = normalised.languages || "";
  renderNpcImagePreview(normalised.image?.portrait || "");

updateNpcHeroCard();
updateNpcHeroLocationCard(normalised);
renderNpcWorldStateWarnings(normalised);

switchNpcWorkspace(npcBuilderState.activeWorkspace || "overview", false);
renderNpcList();
void mountCanonicalDmWorkspace("npc", normalised, "npc").catch(error => console.warn("NPC DM Workspace could not be mounted:", error));
}

function getEntityPositionFromData(entity) {
  const data = entity?.data_json || entity?.data || {};

  return {
    worldId:
      data.currentWorldId ||
      data.worldId ||
      data.world ||
      "",

    regionId:
      data.currentRegionId ||
      data.regionId ||
      data.defaultRegionId ||
      data.region ||
      "",

    locationId:
      data.currentLocationId ||
      data.locationId ||
      data.defaultLocationId ||
      data.location ||
      ""
  };
}

async function getNpcEffectivePosition(npc) {
  const locationState = npc?.locationState || {};

  if (
    locationState.mode === "entity" &&
    locationState.entityType &&
    locationState.entityId &&
    window.dmAPI.getEntity
  ) {
    try {
      const entity = await window.dmAPI.getEntity(
        locationState.entityType,
        locationState.entityId
      );

      const entityPosition = getEntityPositionFromData(entity);

      if (entityPosition.locationId) {
        return {
          mode: "entity",
          worldId: entityPosition.worldId || locationState.worldId || npc.world,
          regionId: entityPosition.regionId || locationState.regionId || npc.region,
          locationId: entityPosition.locationId,
          entityType: locationState.entityType,
          entityId: locationState.entityId,
          entityName: entity?.name || locationState.entityId
        };
      }
    } catch (error) {
      console.warn("Could not resolve NPC containing entity:", {
        npc,
        locationState,
        error
      });
    }
  }

  return {
    mode: locationState.mode || "location",
    worldId:
      locationState.worldId ||
      npc.world ||
      window.dmState.current.world,

    regionId:
      locationState.regionId ||
      npc.region ||
      window.dmState.current.region,

    locationId:
      locationState.locationId ||
      npc.locationId ||
      npc.location ||
      window.dmState.current.location,

    entityType: "",
    entityId: "",
    entityName: ""
  };
}

function syncNpcFormToState() {
  const npc = npcBuilderState.activeNpc || getDefaultNpc();

  npc.id = npcBuilderState.currentNpcId;
  npc.entityId =
  document.querySelector("#npcLinkedEntityIdInput")?.value.trim() ||
  npc.entityId ||
  npc.id;
  npc.name = document.querySelector("#npcNameInput")?.value.trim() || "";
  npc.species = document.querySelector("#npcSpeciesInput")?.value || "";
  npc.type = document.querySelector("#npcTypeInput")?.value || "Humanoid";
  npc.role = document.querySelector("#npcRoleInput")?.value || "";
  npc.class = document.querySelector("#npcClassInput")?.value || "";
  npc.level = Number(document.querySelector("#npcLevelInput")?.value || 0);
  npc.cr = document.querySelector("#npcCrInput")?.value || "";
  npc.status = document.querySelector("#npcStatusInput")?.value || "Alive";
  npc.source = normaliseSourceValue(
  document.querySelector("#npcSourceInput")?.value || "homebrew"
);

  npc.stats = {
    ac: document.querySelector("#npcAcInput")?.value || "",
    hp: document.querySelector("#npcHpInput")?.value || "",
    speed: document.querySelector("#npcSpeedInput")?.value || "",
    str: Number(document.querySelector("#npcStrInput")?.value || 10),
    dex: Number(document.querySelector("#npcDexInput")?.value || 10),
    con: Number(document.querySelector("#npcConInput")?.value || 10),
    int: Number(document.querySelector("#npcIntInput")?.value || 10),
    wis: Number(document.querySelector("#npcWisInput")?.value || 10),
    cha: Number(document.querySelector("#npcChaInput")?.value || 10)
  };

  npc.savingThrows = document.querySelector("#npcSavingThrowsInput")?.value || "";
  npc.skills = document.querySelector("#npcSkillsInput")?.value || "";
  npc.senses = document.querySelector("#npcSensesInput")?.value || "";
  npc.languages = document.querySelector("#npcLanguagesInput")?.value || "";

  syncActiveNpcWorkspace();

  npc.systemId =
  npc.systemId ||
  getCurrentSystemId();

npc.campaign =
  npc.campaign ||
  window.dmState.current.campaign;

npc.world =
  npc.world ||
  window.dmState.current.world;

npc.region =
  npc.region ||
  window.dmState.current.region;

npc.locationId =
  npc.locationId ||
  window.dmState.current.location;

npc.scope = {
  campaignId: npc.campaign || "",
  worldId: npc.world || "",
  regionId: npc.region || "",
  locationId: npc.locationId || ""
};

npc.currentPosition = npc.locationState || {
  mode: "location",
  worldId: npc.world || "",
  regionId: npc.region || "",
  locationId: npc.locationId || "",
  entityType: "",
  entityId: "",
  notes: npc.overview?.currentLocation || ""
};

npc.visibility = normaliseVisibility(npc.visibility);

npc.updated = new Date().toISOString();

npc.image = {
  ...(npc.image || {}),
  portrait: npc.image?.portrait || "",
  token: npc.image?.token || "",
  background: npc.image?.background || ""
};
  npcBuilderState.activeNpc = npc;

  return npc;
}

function syncActiveNpcWorkspace() {
  const npc = npcBuilderState.activeNpc;

  if (!npc) return;

  const workspace = npcBuilderState.activeWorkspace;

  if (workspace === "overview") {
  const mode =
    document.querySelector("#npcLocationModeInput")?.value || "location";

  const worldId =
    document.querySelector("#npcLocationWorldInput")?.value ||
    npc.world ||
    window.dmState.current.world;

  const regionId =
    document.querySelector("#npcLocationRegionInput")?.value ||
    npc.region ||
    window.dmState.current.region;

  const locationId =
    document.querySelector("#npcLocationLocationInput")?.value ||
    npc.locationId ||
    window.dmState.current.location;

  const entityType =
    document.querySelector("#npcLocationEntityTypeInput")?.value || "";

  const entityId =
    document.querySelector("#npcLocationEntityIdInput")?.value || "";

  const notes =
    document.querySelector("#npcLocationNotesInput")?.value || "";

  npc.overview = {
    summary: document.querySelector("#npcSummaryInput")?.value || "",
    currentLocation: notes,
    firstMet: document.querySelector("#npcFirstMetInput")?.value || ""
  };

  npc.locationState = {
    mode,
    worldId,
    regionId,
    locationId,
    entityType: mode === "entity" ? entityType : "",
    entityId: mode === "entity" ? entityId : "",
    notes
  };

  npc.replaceOldLocationRelationships =
  document.querySelector(
    "#npcReplaceLocationRelationshipsInput"
  )?.checked !== false;

  npc.world = worldId;
  npc.region = regionId;
  npc.locationId = locationId;

  npc.flags = {
    ...(npc.flags || {}),
    isVendor: document.querySelector("#npcIsVendorInput")?.checked || false,
    isBoss: document.querySelector("#npcIsBossInput")?.checked || false,
    legendaryNpc: document.querySelector("#npcLegendaryInput")?.checked || false,
    hasLair: document.querySelector("#npcHasLairInput")?.checked || false
  };
}

  if (workspace === "personality") {
    npc.personality = {
      appearance: document.querySelector("#npcAppearanceInput")?.value || "",
      voice: document.querySelector("#npcVoiceInput")?.value || "",
      mannerisms: document.querySelector("#npcMannerismsInput")?.value || "",
      ideals: document.querySelector("#npcIdealsInput")?.value || "",
      bonds: document.querySelector("#npcBondsInput")?.value || "",
      flaws: document.querySelector("#npcFlawsInput")?.value || "",
      secret: document.querySelector("#npcSecretInput")?.value || "",
      hook: document.querySelector("#npcHookInput")?.value || ""
    };
  }

  if (workspace === "traits") {
  npc.traits = collectSimpleCards("npcTrait");
}
if (workspace === "actions") {
  npc.actions = collectActionCards(".npcActionCard");
}

if (workspace === "bonus") {
  npc.bonusActions = collectActionCards(".npcBonusActionCard");
}

if (workspace === "reactions") {
  npc.reactions = collectActionCards(".npcReactionCard");
}
if (workspace === "legendary") {
  npc.flags = {
    ...(npc.flags || {}),
    legendaryNpc: document.querySelector("#npcLegendaryEnabledInput")?.checked || false
  };

  npc.legendaryActions = collectActionCards(".npcLegendaryActionCard");
}

if (workspace === "lair") {
  npc.flags = {
    ...(npc.flags || {}),
    hasLair: document.querySelector("#npcHasLairEnabledInput")?.checked || false
  };

  npc.lairActions = collectActionCards(".npcLairActionCard");
}

}
const MOVE_WITH_ENTITY_RELATIONSHIPS = new Set([
  "aboard",
  "inside",
  "contained_in",
  "stored_in",
  "carried_by",
  "located_in",
  "operates_from",
  "stationed_at",
  "assigned_to"
]);

const NPC_CURRENT_LOCATION_RELATIONSHIPS = new Set([
  "aboard",
  "inside",
  "contained_in",
  "stored_in",
  "carried_by",
  "located_in",
  "stationed_at",
  "assigned_to"
]);

function isNpcCurrentLocationRelationship(relationshipValue) {
  return NPC_CURRENT_LOCATION_RELATIONSHIPS.has(
    String(relationshipValue || "").toLowerCase()
  );
}
const MASTERFORGE_DESTROYED_ENTITY_STATUSES = new Set([
  "destroyed",
  "wrecked",
  "ruined",
  "sunk",
  "lost"
]);

const MASTERFORGE_UNCERTAIN_NPC_STATUSES = new Set([
  "missing",
  "dead",
  "unknown",
  "retired"
]);

function normaliseWorldStateStatus(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isDestroyedEntityStatus(value = "") {
  return MASTERFORGE_DESTROYED_ENTITY_STATUSES.has(
    normaliseWorldStateStatus(value)
  );
}

function isUncertainNpcStatus(value = "") {
  return MASTERFORGE_UNCERTAIN_NPC_STATUSES.has(
    normaliseWorldStateStatus(value)
  );
}

function getEntityDisplayStatus(entity = null) {
  const data = entity?.data_json || entity?.data || {};

  return (
    entity?.status ||
    data.status ||
    data.entityStatus ||
    data.currentStatus ||
    ""
  );
}

async function getNpcWorldStateWarnings(npc = null) {
  const warnings = [];

  if (!npc) return warnings;

  const status = normaliseWorldStateStatus(npc.status);

  const locationState = npc.locationState || {};

  const npcIsUncertain =
    isUncertainNpcStatus(status);

  const isLinkedToEntity =
    locationState.mode === "entity" &&
    locationState.entityType &&
    locationState.entityId;

  if (npcIsUncertain && isLinkedToEntity) {
    warnings.push({
      type: "npc-uncertain-current-entity",
      severity: "warning",
      title: "Current location may be stale",
      message: `${npc.name || "This NPC"} is marked as ${npc.status}, but is still shown as currently aboard / inside an entity.`,
      action: "Consider changing this to Last Seen Here or Unknown Location."
    });
  }

  if (!isLinkedToEntity || !window.dmAPI.getEntity) {
    return warnings;
  }

  let entity = null;

  try {
    entity = await window.dmAPI.getEntity(
      locationState.entityType,
      locationState.entityId
    );
  } catch (error) {
    console.warn("Could not check NPC linked entity state:", {
      npc,
      locationState,
      error
    });
  }

  if (!entity) return warnings;

  const entityStatus = getEntityDisplayStatus(entity);

  if (isDestroyedEntityStatus(entityStatus)) {
    warnings.push({
      type: "npc-aboard-destroyed-entity",
      severity: "danger",
      title: "Linked entity is destroyed",
      message: `${npc.name || "This NPC"} is still shown as aboard / inside ${entity.name || locationState.entityId}, but that entity is marked as ${entityStatus}.`,
      action: "Mark as Last Seen Here or move the NPC to Unknown Location.",
      entityType: locationState.entityType,
      entityId: locationState.entityId,
      entityName: entity.name || locationState.entityId,
      entityStatus
    });
  }

  return warnings;
}

function renderWorldStateWarningsHtml(warnings = []) {
  if (!warnings.length) return "";

  return `
    <div class="worldStateWarnings">
      ${warnings.map(warning => `
        <div
          class="worldStateWarning ${warning.severity === "danger" ? "danger" : "warning"}"
          data-warning-type="${escapeHtml(warning.type || "")}"
        >
          <strong>
            ${warning.severity === "danger" ? "⚠" : "🕯"}
            ${escapeHtml(warning.title || "World State Warning")}
          </strong>

          <p>${escapeHtml(warning.message || "")}</p>

          ${
            warning.action
              ? `<small>${escapeHtml(warning.action)}</small>`
              : ""
          }

          <div class="worldStateWarningActions">
            <button
              class="moveNpcUnknownBtn"
              type="button"
            >
              Move to Unknown Location
            </button>

            <button
              class="reviewNpcLinksBtn"
              type="button"
            >
              Review Links
            </button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

async function renderNpcWorldStateWarnings(npc = null) {
  const wrapper = document.querySelector("#npcWorldStateWarnings");

  if (!wrapper) return;

  const activeNpc =
    npc ||
    npcBuilderState.activeNpc ||
    null;

  const warnings = await getNpcWorldStateWarnings(activeNpc);

  wrapper.innerHTML = renderWorldStateWarningsHtml(warnings);

  setupNpcWorldStateWarningActions(activeNpc);
}

function setupNpcWorldStateWarningActions(npc = null) {
  const activeNpc =
    npc ||
    npcBuilderState.activeNpc ||
    null;

  if (!activeNpc) return;

  document.querySelectorAll(".moveNpcUnknownBtn").forEach(button => {
    button.onclick = async () => {
      await moveNpcToUnknownLocationFromWarning(activeNpc);
    };
  });

  document.querySelectorAll(".reviewNpcLinksBtn").forEach(button => {
    button.onclick = () => {
      switchNpcWorkspace("entityLinks", true);

      const mount = document.querySelector("#npcWorkspaceMount");

      if (mount) {
        mount.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    };
  });
}

async function moveNpcToUnknownLocationFromWarning(npc = null) {
  const activeNpc =
    npc ||
    npcBuilderState.activeNpc ||
    null;

  if (!activeNpc) return;

  const previousLocationState =
    activeNpc.locationState || {};

  let previousEntityName =
    previousLocationState.entityId || "Unknown entity";

  if (
    previousLocationState.entityType &&
    previousLocationState.entityId &&
    window.dmAPI.getEntity
  ) {
    try {
      const entity = await window.dmAPI.getEntity(
        previousLocationState.entityType,
        previousLocationState.entityId
      );

      previousEntityName =
        entity?.name ||
        previousLocationState.entityId;
    } catch (error) {
      console.warn("Could not resolve previous NPC entity location:", error);
    }
  }

  const note = [
    activeNpc.locationState?.notes || "",
    `Last seen aboard / inside ${previousEntityName} before their current location became unknown.`
  ]
    .filter(Boolean)
    .join("\n");

  activeNpc.locationState = {
    mode: "unknown",
    worldId: activeNpc.world || window.dmState.current.world,
    regionId: activeNpc.region || window.dmState.current.region,
    locationId: "",
    entityType: "",
    entityId: "",
    notes: note
  };

  activeNpc.overview = {
    ...(activeNpc.overview || {}),
    currentLocation: note
  };

  activeNpc.currentPosition = activeNpc.locationState;
  activeNpc.updated = new Date().toISOString();

  npcBuilderState.activeNpc = activeNpc;

  await window.dmAPI.saveRecord(
    "npcs",
    activeNpc.id,
    activeNpc,
    activeNpc.world || window.dmState.current.world
  );

  if (typeof syncNpcToEntity === "function") {
    await syncNpcToEntity(activeNpc);
  }

  fillNpcForm(activeNpc);

  alert(`${activeNpc.name || "NPC"} moved to Unknown Location.`);
}

const MOVE_WITH_ENTITY_TYPES = new Set([
  "npc",
  "faction",
  "ship",
  "vehicle",
  "settlement",
  "location",
  "item",
  "loot",
  "quest",
  "event",
  "creature"
]);

function shouldRelationshipMoveWithEntity(relationship) {
  return MOVE_WITH_ENTITY_RELATIONSHIPS.has(
    String(relationship?.relationship || "").toLowerCase()
  );
}

async function updateEntityCurrentPosition(entity, newPosition) {
  if (!entity?.entity_type || !entity?.id) {
    return null;
  }

  const data = entity.data_json || entity.data || {};

  const updatedData = {
    ...data,

    world: newPosition.worldId,
    worldId: newPosition.worldId,
    region: newPosition.regionId,
    regionId: newPosition.regionId,
    location: newPosition.locationId,
    locationId: newPosition.locationId,

    currentWorldId: newPosition.worldId,
    currentRegionId: newPosition.regionId,
    currentLocationId: newPosition.locationId,

    currentPosition: {
      ...(data.currentPosition || {}),
      mode: "location",
      worldId: newPosition.worldId,
      regionId: newPosition.regionId,
      locationId: newPosition.locationId,
      entityType: "",
      entityId: "",
      notes: data.currentPosition?.notes || ""
    },

    updated: new Date().toISOString()
  };

  const updatedEntity = {
    ...entity,
    data_json: updatedData
  };

  await window.dmAPI.updateEntity(
    entity.entity_type,
    entity.id,
    updatedEntity
  );

  return updatedEntity;
}

async function getMoveWithEntityChildren(entityType, entityId) {
  const children = [];

  if (!window.dmAPI.getEntity || !window.dmAPI.getEntityRelationships) {
    return children;
  }

  let relationships = [];

  try {
    if (typeof getRelationshipsForEntityPanel === "function") {
      relationships = await getRelationshipsForEntityPanel({
        entity_type: entityType,
        id: entityId
      });
    } else {
      relationships = await window.dmAPI.getEntityRelationships(entityType, entityId);
    }
  } catch (error) {
    console.warn("Could not load move-with relationships:", error);
    relationships = [];
  }

  for (const relationship of relationships) {
    const relationshipPointsToMovedEntity =
      relationship.to_type === entityType &&
      relationship.to_id === entityId;

    if (!relationshipPointsToMovedEntity) {
      continue;
    }

    if (!shouldRelationshipMoveWithEntity(relationship)) {
      continue;
    }

    if (!MOVE_WITH_ENTITY_TYPES.has(String(relationship.from_type || ""))) {
      continue;
    }

    try {
      const childEntity = await window.dmAPI.getEntity(
        relationship.from_type,
        relationship.from_id
      );

      if (childEntity) {
        children.push({
          relationship,
          entity: childEntity
        });
      }
    } catch (error) {
      console.warn("Could not load move-with child entity:", relationship, error);
    }
  }

  return children;
}

async function moveAttachedEntitiesRecursively(
  entityType,
  entityId,
  newPosition,
  moveContext = null
) {
  const context = moveContext || {
    visited: new Set(),
    movedEntities: [],
    skippedEntities: []
  };

  const key = `${entityType}:${entityId}`;

  if (context.visited.has(key)) {
    return context;
  }

  context.visited.add(key);

  const children = await getMoveWithEntityChildren(entityType, entityId);

  for (const child of children) {
    const childEntity = child.entity;
    const childKey = `${childEntity.entity_type}:${childEntity.id}`;

    if (context.visited.has(childKey)) {
      continue;
    }

    await updateEntityCurrentPosition(childEntity, newPosition);

    context.movedEntities.push({
      type: childEntity.entity_type,
      id: childEntity.id,
      name: childEntity.name || childEntity.id,
      via: child.relationship.relationship
    });

    await moveAttachedEntitiesRecursively(
      childEntity.entity_type,
      childEntity.id,
      newPosition,
      context
    );
  }

  return context;
}


async function moveNpcRecordsInsideEntity(entityType, entityId, newPosition) {
  const moved = [];

  if (typeof getNpcs !== "function") {
    return moved;
  }

  const npcs = await getNpcs();

  const containedNpcs = npcs.filter(npc => {
    const locationState = npc.locationState || {};

    return (
      locationState.mode === "entity" &&
      locationState.entityType === entityType &&
      locationState.entityId === entityId
    );
  });

  for (const npc of containedNpcs) {
    npc.locationState = {
      ...(npc.locationState || {}),
      mode: "entity",
      worldId: newPosition.worldId,
      regionId: newPosition.regionId,
      locationId: newPosition.locationId,
      entityType,
      entityId
    };

    npc.world = newPosition.worldId;
    npc.region = newPosition.regionId;
    npc.locationId = newPosition.locationId;
    npc.currentPosition = npc.locationState;
    npc.updated = new Date().toISOString();

    await window.dmAPI.saveRecord(
      "npcs",
      npc.id,
      npc,
      npc.world || window.dmState.current.world
    );

    if (typeof syncNpcToEntity === "function") {
      await syncNpcToEntity(npc);
    }

    if (typeof syncNpcLocationEntityRelationship === "function") {
      await syncNpcLocationEntityRelationship(npc);
    }

    moved.push(npc);
  }

  return moved;
}
async function getAutoCrewEntitiesForMovedEntity(entityType, entityId) {
  const crews = [];

  if (!window.dmAPI.getEntitiesByType) {
    return crews;
  }

  let factions = [];

  try {
    factions = await window.dmAPI.getEntitiesByType("faction");
  } catch (error) {
    console.warn("Could not load factions while checking moved crews:", error);
    return crews;
  }

  const expectedCrewId =
    typeof getVehicleCrewId === "function"
      ? getVehicleCrewId({ id: entityId, entity_type: entityType })
      : window.dmStorage.slugify(`${entityId}-crew`);

  for (const faction of factions) {
    const data = faction.data_json || faction.data || {};

    const isExactGeneratedCrew =
      faction.id === expectedCrewId;

    const isVehicleCrewByData =
      data.source === "vehicle-crew-auto" &&
      data.vehicleType === entityType &&
      data.vehicleId === entityId;

    const isLikelyNamedCrew =
      String(faction.id || "").includes(String(entityId)) &&
      String(faction.id || "").includes("crew");

    if (
      isExactGeneratedCrew ||
      isVehicleCrewByData ||
      isLikelyNamedCrew
    ) {
      crews.push(faction);
    }
  }

  return crews;
}
async function moveEntityAndContainedNpcs(
  entityType,
  entityId,
  newPosition,
  options = {}
) {
  const moveContained =
    options.moveContainedNpcs !== false;

  const entity = await window.dmAPI.getEntity(entityType, entityId);

  if (!entity) {
    alert("Entity not found.");
    return;
  }

  await updateEntityCurrentPosition(entity, newPosition);

let movedEntityContext = {
  movedEntities: [],
  skippedEntities: []
};

let movedCrewCount = 0;

const autoCrews = await getAutoCrewEntitiesForMovedEntity(
  entityType,
  entityId
);

for (const crewEntity of autoCrews) {
  await updateEntityCurrentPosition(crewEntity, newPosition);
  movedCrewCount += 1;
}

let movedNpcRecords = [];

  if (moveContained) {
  movedEntityContext = await moveAttachedEntitiesRecursively(
    entityType,
    entityId,
    newPosition
  );

  movedEntityContext.movedEntities =
    (movedEntityContext.movedEntities || []).filter(item => {
      return !autoCrews.some(crew => {
        return (
          crew.entity_type === item.type &&
          crew.id === item.id
        );
      });
    });

  movedNpcRecords = await moveNpcRecordsInsideEntity(
    entityType,
    entityId,
    newPosition
  );
}

  if (typeof refreshEntityLibraryAfterMove === "function") {
  await refreshEntityLibraryAfterMove(entityType, entityId);
} else if (typeof loadEntityDebugPanel === "function") {
  await loadEntityDebugPanel();
}

  if (
    entityType === "party_group" &&
    splitGroupManagerState.open
  ) {
    await renderSplitGroupManager();
  }

  if (typeof renderNpcList === "function") {
    await renderNpcList();
  }

  if (typeof renderRegionInfo === "function") {
    await renderRegionInfo();
  }

  const movedEntityCount =
  movedEntityContext.movedEntities?.length || 0;

const movedNpcCount =
  movedNpcRecords.length || 0;

const isPartyContextEntity =
  entityType === "party" ||
  entityType === "party_group";

if (isPartyContextEntity) {
  let destinationName = newPosition.locationId;

  try {
    const destination = await window.dmAPI.getRecord(
      newPosition.locationId
    );

    destinationName =
      destination?.name ||
      newPosition.locationId;
  } catch (error) {
    console.warn("Could not resolve moved party destination name:", error);
  }

  alert(
    `${entity.name || entityId} moved to ${destinationName}. Connected members now inherit this location.`
  );
} else {
  alert(
    `${entity.name || entityId} moved.` +
    (moveContained
      ? ` ${movedCrewCount} crew entit${movedCrewCount === 1 ? "y" : "ies"}, ${movedEntityCount} linked entit${movedEntityCount === 1 ? "y" : "ies"} and ${movedNpcCount} NPC record${movedNpcCount === 1 ? "" : "s"} updated.`
      : "")
  );
}
}

function switchNpcWorkspace(workspaceKey, shouldSync = true) {
  if (shouldSync) {
    syncNpcFormToState();
  }

  npcBuilderState.activeWorkspace = workspaceKey;

  document.querySelectorAll(".npc-workspace-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.workspace === workspaceKey);
  });

  const mount = document.querySelector("#npcWorkspaceMount");

  if (!mount) return;

  mount.innerHTML = "";

  const renderer = npcWorkspaceRenderers[workspaceKey];

  if (!renderer) {
    mount.innerHTML = `<div class="forgeEmptyState">NPC workspace not found.</div>`;
    return;
  }

  mount.appendChild(renderer(npcBuilderState.activeNpc));
  if (workspaceKey === "overview") {
  populateNpcLocationControls(npcBuilderState.activeNpc);
}
}

async function populateNpcLocationControls(npc) {
  const locationState = {
    mode: "location",
    worldId: npc?.world || window.dmState.current.world,
    regionId: npc?.region || window.dmState.current.region,
    locationId: npc?.locationId || window.dmState.current.location,
    entityType: "",
    entityId: "",
    notes: npc?.overview?.currentLocation || "",
    ...(npc?.locationState || {})
  };

  const modeInput = document.querySelector("#npcLocationModeInput");
  const worldInput = document.querySelector("#npcLocationWorldInput");
  const regionInput = document.querySelector("#npcLocationRegionInput");
  const locationInput = document.querySelector("#npcLocationLocationInput");
  const entityTypeInput = document.querySelector("#npcLocationEntityTypeInput");
  const entityInput = document.querySelector("#npcLocationEntityIdInput");
  const entityFields = document.querySelector("#npcLocationEntityFields");
  const moveToCurrentBtn = document.querySelector("#moveNpcToCurrentLocationBtn");
  const saveLocationBtn = document.querySelector("#saveNpcLocationQuickBtn");
  const directLocationFields = document.querySelector("#npcDirectLocationFields");

  if (!modeInput || !worldInput || !regionInput || !locationInput) {
    console.warn("NPC location controls missing.");
    return;
  }

  let worlds = [];

  try {
    worlds = await window.dmAPI.listWorlds();
  } catch (error) {
    console.warn("Could not load NPC location worlds:", error);
  }

  worldInput.innerHTML = worlds.map(world => `
    <option value="${escapeHtml(world.id)}">
      ${escapeHtml(world.name || world.id)}
    </option>
  `).join("");

  worldInput.value =
    worlds.some(world => world.id === locationState.worldId)
      ? locationState.worldId
      : worlds[0]?.id || "";

  async function loadRegions(selectedRegionId = "") {
    const worldId = worldInput.value;
    const regions = worldId
      ? await window.dmAPI.listRegions(worldId)
      : [];

    regionInput.innerHTML = regions.map(region => `
      <option value="${escapeHtml(region.id)}">
        ${escapeHtml(region.name || region.id)}
      </option>
    `).join("");

    regionInput.value =
      regions.some(region => region.id === selectedRegionId)
        ? selectedRegionId
        : regions[0]?.id || "";
  }

  async function loadLocations(selectedLocationId = "") {
    const regionId = regionInput.value;
    const locations = regionId
      ? await window.dmAPI.listLocations(regionId)
      : [];

    locationInput.innerHTML = locations.map(location => `
      <option value="${escapeHtml(location.id)}">
        ${escapeHtml(location.name || location.id)}
      </option>
    `).join("");

    locationInput.value =
      locations.some(location => location.id === selectedLocationId)
        ? selectedLocationId
        : locations[0]?.id || "";
  }

  async function refreshNpcHeroLocationFromControls() {
  const previewNpc = {
    ...(npcBuilderState.activeNpc || npc || {}),
    world: worldInput?.value || "",
    region: regionInput?.value || "",
    locationId: locationInput?.value || "",
    locationState: {
      ...(npcBuilderState.activeNpc?.locationState || npc?.locationState || {}),
      mode: modeInput?.value || "location",
      worldId: worldInput?.value || "",
      regionId: regionInput?.value || "",
      locationId: locationInput?.value || "",
      entityType: entityTypeInput?.value || "",
      entityId: entityInput?.value || ""
    }
  };

  await updateNpcHeroLocationCard(previewNpc);
}

  async function loadEntities(selectedEntityId = "") {
  if (!entityTypeInput || !entityInput) return;

  const selectedType =
    entityTypeInput.value || "vehicle";

  let entities = [];

  try {
    if (
      selectedType === "vehicle" &&
      window.dmAPI.getEntitiesByType
    ) {
      const [vehicles, legacyShips] =
        await Promise.all([
          window.dmAPI.getEntitiesByType("vehicle"),
          window.dmAPI.getEntitiesByType("ship")
        ]);

      const byIdentity = new Map();

      [
        ...(vehicles || []),
        ...(legacyShips || [])
      ].forEach(entity => {
        if (!entity?.id) return;

        byIdentity.set(
          `${entity.entity_type}:${entity.id}`,
          entity
        );
      });

      entities = [...byIdentity.values()];
    } else {
      entities =
        window.dmAPI.getEntitiesByType
          ? await window.dmAPI.getEntitiesByType(
              selectedType
            )
          : [];
    }
  } catch (error) {
    console.warn(
      "Could not load containing entities:",
      error
    );
  }

  entities.sort((a, b) =>
    String(a.name || a.id).localeCompare(
      String(b.name || b.id)
    )
  );

  entityInput.innerHTML = `
    <option value="">Choose ${escapeHtml(selectedType)}...</option>

    ${entities.map(entity => `
      <option
        value="${escapeHtml(entity.id)}"
        data-entity-type="${escapeHtml(
          entity.entity_type || selectedType
        )}"
      >
        ${escapeHtml(entity.name || entity.id)}
      </option>
    `).join("")}
  `;

  entityInput.value =
    entities.some(
      entity => entity.id === selectedEntityId
    )
      ? selectedEntityId
      : "";
}

  modeInput.value = locationState.mode || "location";

  await loadRegions(locationState.regionId);
  await loadLocations(locationState.locationId);

  if (entityTypeInput) {
  entityTypeInput.value =
    ["vehicle", "ship"].includes(
      locationState.entityType
    )
      ? "vehicle"
      : locationState.entityType || "vehicle";
}

  await loadEntities(locationState.entityId);

  if (entityFields) {
    entityFields.classList.toggle("hidden", modeInput.value !== "entity");
  }

  function updateNpcLocationModeVisibility() {
  const isEntityMode = modeInput.value === "entity";
  const isLocationMode = modeInput.value === "location";

  if (entityFields) {
    entityFields.classList.toggle("hidden", !isEntityMode);
  }

  if (directLocationFields) {
    directLocationFields.classList.toggle("hidden", !isLocationMode);
  }
}

updateNpcLocationModeVisibility();

modeInput.onchange = async () => {
  updateNpcLocationModeVisibility();
  await refreshNpcHeroLocationFromControls();
};
  
worldInput.onchange = async () => {
  await loadRegions("");
  await loadLocations("");
  await refreshNpcHeroLocationFromControls();
};

  regionInput.onchange = async () => {
  await loadLocations("");
  await refreshNpcHeroLocationFromControls();
};

  if (entityTypeInput) {
  entityTypeInput.onchange = async () => {
    await loadEntities("");
    await refreshNpcHeroLocationFromControls();
  };
}

if (entityInput) {
  entityInput.onchange = async () => {
    await refreshNpcHeroLocationFromControls();
  };
}
  if (moveToCurrentBtn) {
    moveToCurrentBtn.onclick = async () => {
      modeInput.value = "location";

      if (entityFields) {
        entityFields.classList.add("hidden");
      }

      worldInput.value = window.dmState.current.world;

      await loadRegions(window.dmState.current.region);
      await loadLocations(window.dmState.current.location);
    };
  }

  if (saveLocationBtn) {
    saveLocationBtn.onclick = async () => {
      await saveNpc();
    };
  }
}

async function populateNpcRegionDropdown(locationState = {}) {
  const worldInput = document.querySelector("#npcLocationWorldInput");
  const regionInput = document.querySelector("#npcLocationRegionInput");

  if (!worldInput || !regionInput) return;

  const regions = await window.dmAPI.listRegions(worldInput.value);

  regionInput.innerHTML = regions.map(region => `
    <option value="${escapeHtml(region.id)}">
      ${escapeHtml(region.name || region.id)}
    </option>
  `).join("");

  regionInput.value =
    locationState.regionId ||
    npcBuilderState.activeNpc?.region ||
    window.dmState.current.region;
}

async function populateNpcLocationDropdown(locationState = {}) {
  const regionInput = document.querySelector("#npcLocationRegionInput");
  const locationInput = document.querySelector("#npcLocationLocationInput");

  if (!regionInput || !locationInput) return;

  const locations = await window.dmAPI.listLocations(regionInput.value);

  locationInput.innerHTML = locations.map(location => `
    <option value="${escapeHtml(location.id)}">
      ${escapeHtml(location.name || location.id)}
    </option>
  `).join("");

  locationInput.value =
    locationState.locationId ||
    npcBuilderState.activeNpc?.locationId ||
    window.dmState.current.location;
}

async function populateNpcEntityDropdown(locationState = {}) {
  const entityTypeInput = document.querySelector("#npcLocationEntityTypeInput");
  const entityInput = document.querySelector("#npcLocationEntityIdInput");

  if (!entityTypeInput || !entityInput) return;

  const type = entityTypeInput.value || "ship";

  if (!window.dmAPI.getEntitiesByType) {
    entityInput.innerHTML = `<option value="">Entity API unavailable</option>`;
    return;
  }

  const entities = await window.dmAPI.getEntitiesByType(type);

  entityInput.innerHTML = `
    <option value="">Choose ${escapeHtml(type)}...</option>
    ${entities.map(entity => `
      <option value="${escapeHtml(entity.id)}">
        ${escapeHtml(entity.name || entity.id)}
      </option>
    `).join("")}
  `;

  entityInput.value = locationState.entityId || "";
}

async function renderNpcOverviewRelationshipSummary(npc) {
  const wrapper = document.querySelector(
    "#npcOverviewRelationshipSummary"
  );

  if (!wrapper || !npc) return;

  const engine =
    window.MasterForgeRelationshipEngine;

  if (!engine?.getLegacyRelationshipsForEntity) {
    wrapper.innerHTML = `
      <p class="forgeEmptyState">
        Relationship Engine unavailable.
      </p>
    `;
    return;
  }

  const entityId =
    npc.entityId ||
    npc.id;

  if (!entityId) {
    wrapper.innerHTML = `
      <p class="forgeEmptyState">
        Save this NPC before adding relationships.
      </p>
    `;
    return;
  }

  let relationships = [];

  try {
    relationships =
      await engine.getLegacyRelationshipsForEntity(
        "npc",
        entityId
      );
  } catch (error) {
    console.warn(
      "Could not load NPC overview relationships:",
      error
    );
  }

  if (!relationships.length) {
    wrapper.innerHTML = `
      <p class="forgeEmptyState">
        No relationships recorded.
      </p>
    `;
    return;
  }

  wrapper.innerHTML = relationships.map(relationship => {
    const isOutgoing =
      relationship.from_type === "npc" &&
      relationship.from_id === entityId;

    const otherType = isOutgoing
      ? relationship.to_type
      : relationship.from_type;

    const otherId = isOutgoing
      ? relationship.to_id
      : relationship.from_id;

    const relationshipLabel =
      formatNpcRelationshipLabel(
        relationship.relationship
      );

    return `
      <button
        type="button"
        class="npcOverviewRelationshipItem"
        data-entity-type="${escapeHtml(otherType)}"
        data-entity-id="${escapeHtml(otherId)}"
      >
        <span class="npcOverviewRelationshipDirection">
          ${isOutgoing ? "Outgoing" : "Incoming"}
        </span>

        <strong>
          ${escapeHtml(relationshipLabel)}
        </strong>

        <small>
          ${escapeHtml(otherType)} · ${escapeHtml(otherId)}
        </small>
      </button>
    `;
  }).join("");

  wrapper
    .querySelectorAll(".npcOverviewRelationshipItem")
    .forEach(button => {
      button.onclick = async () => {
        if (
          button.dataset.entityType === "npc" &&
          typeof openNpcBuilderByAnyId === "function"
        ) {
          await openNpcBuilderByAnyId(
            button.dataset.entityId
          );

          return;
        }

        if (
          typeof openEntityFromRelationship === "function"
        ) {
          await openEntityFromRelationship(
            button.dataset.entityType,
            button.dataset.entityId
          );
        }
      };
    });
}

function renderNpcOverviewWorkspace(npc) {
  const overview = npc?.overview || {};
  const flags = npc?.flags || {};

  const locationState = {
    mode: "location",
    worldId: npc?.world || window.dmState.current.world,
    regionId: npc?.region || window.dmState.current.region,
    locationId: npc?.locationId || window.dmState.current.location,
    entityType: "",
    entityId: "",
    notes: overview.currentLocation || "",
    ...(npc?.locationState || {})
  };

  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  wrapper.innerHTML = `
    <div class="forgeWorkspaceGrid two">

      <div class="forgeWorkspaceCard">
        <h2>Overview</h2>

        <label>Summary</label>
        <textarea id="npcSummaryInput">${escapeHtml(overview.summary || "")}</textarea>

        <label>First Met</label>
        <input
          id="npcFirstMetInput"
          value="${escapeHtml(overview.firstMet || "")}"
          placeholder="Session 1, Port Nyanzaru, aboard Sea's Fury..."
        >

        <hr>

        <h2>Current Location</h2>

        <label>Location Mode</label>
        <select id="npcLocationModeInput">
          <option value="location" ${locationState.mode === "location" ? "selected" : ""}>At Location</option>
          <option value="entity" ${locationState.mode === "entity" ? "selected" : ""}>Inside / On Entity</option>
          <option value="travelling" ${locationState.mode === "travelling" ? "selected" : ""}>Travelling</option>
          <option value="unknown" ${locationState.mode === "unknown" ? "selected" : ""}>Unknown</option>
        </select>

        <label>World / Plane</label>
        <select id="npcLocationWorldInput"></select>

        <label>Region</label>
        <select id="npcLocationRegionInput"></select>

        <label>Location</label>
        <select id="npcLocationLocationInput"></select>

        <div id="npcLocationEntityFields" class="${locationState.mode === "entity" ? "" : "hidden"}">
          <label>Containing Entity Type</label>
          <select id="npcLocationEntityTypeInput">
  <option
    value="vehicle"
    ${["vehicle", "ship"].includes(locationState.entityType) ? "selected" : ""}
  >
    Vehicle
  </option>

  <option
    value="settlement"
    ${locationState.entityType === "settlement" ? "selected" : ""}
  >
    Settlement
  </option>

  <option
    value="location"
    ${locationState.entityType === "location" ? "selected" : ""}
  >
    Location
  </option>

  <option
    value="faction"
    ${locationState.entityType === "faction" ? "selected" : ""}
  >
    Faction Base
  </option>
</select>

          <label>Containing Entity</label>
          <select id="npcLocationEntityIdInput">
            <option value="">Loading entities...</option>
          </select>
        </div>

        <label>Location Notes</label>
        <textarea
          id="npcLocationNotesInput"
          placeholder="Aboard The Sea's Fury, below decks, guarding the hold..."
        >${escapeHtml(locationState.notes || "")}</textarea>

<label class="forgeSwitchLine">
  <span>
    <strong>Replace previous current-location links</strong>
    <small>
      Removes old Aboard / Inside / Assigned links when this NPC moves.
      Command, faction and reporting links are kept.
    </small>
  </span>

  <input
  id="npcReplaceLocationRelationshipsInput"
  type="checkbox"
  ${npc?.replaceOldLocationRelationships !== false ? "checked" : ""}
>
</label>
        <div class="entityProfileActions">
          <button id="moveNpcToCurrentLocationBtn" type="button">
            Move to Current Top-Bar Location
          </button>

          <button id="saveNpcLocationQuickBtn" type="button">
            💾 Save Location
          </button>
        </div>
      </div>

      <div class="forgeWorkspaceCard">
        <h2>Flags</h2>

        <label class="forgeSwitchLine">
          <span>
            <strong>Vendor</strong>
            <small>Used for shopkeepers and travelling traders.</small>
          </span>
          <input id="npcIsVendorInput" type="checkbox" ${flags.isVendor ? "checked" : ""}>
        </label>

        <label class="forgeSwitchLine">
          <span>
            <strong>Boss / BBEG</strong>
            <small>Used for major villains and powerful NPCs.</small>
          </span>
          <input id="npcIsBossInput" type="checkbox" ${flags.isBoss ? "checked" : ""}>
        </label>

        <label class="forgeSwitchLine">
          <span>
            <strong>Legendary NPC</strong>
            <small>Can use legendary-style actions later.</small>
          </span>
          <input id="npcLegendaryInput" type="checkbox" ${flags.legendaryNpc ? "checked" : ""}>
        </label>

        <label class="forgeSwitchLine">
          <span>
            <strong>Has Lair</strong>
            <small>Can use lair actions later.</small>
          </span>
          <input id="npcHasLairInput" type="checkbox" ${flags.hasLair ? "checked" : ""}>
        </label>
      </div>

    </div>
  `;

  setTimeout(async () => {
  await populateNpcLocationControls(npc);
  await renderNpcOverviewRelationshipSummary(npc);

  const manageLinksBtn =
    document.querySelector(
      "#openNpcEntityLinksFromOverviewBtn"
    );

  if (manageLinksBtn) {
    manageLinksBtn.onclick = () => {
      switchNpcWorkspace("entityLinks", true);
    };
  }
}, 0);

  return wrapper;
}

function renderNpcLocationControls(npc) {
  const locationState = npc?.locationState || {};
  const mode = locationState.mode || "location";

  return `
    <div class="npcLocationControls">

      <label>Location Mode</label>
      <select id="npcLocationModeInput">
        <option value="location" ${mode === "location" ? "selected" : ""}>At Location</option>
        <option value="entity" ${mode === "entity" ? "selected" : ""}>Inside / On Entity</option>
        <option value="travelling" ${mode === "travelling" ? "selected" : ""}>Travelling</option>
        <option value="unknown" ${mode === "unknown" ? "selected" : ""}>Unknown</option>
      </select>

      <div id="npcDirectLocationFields">
  <label>World / Plane</label>
  <select id="npcLocationWorldInput"></select>

  <label>Region</label>
  <select id="npcLocationRegionInput"></select>

  <label>Location</label>
  <select id="npcLocationLocationInput"></select>
</div>

      <div id="npcLocationEntityFields" class="${mode === "entity" ? "" : "hidden"}">
        <label>Entity Type</label>
        <select id="npcLocationEntityTypeInput">
          <option value="ship" ${(locationState.entityType || "") === "ship" ? "selected" : ""}>Ship</option>
          <option value="settlement" ${(locationState.entityType || "") === "settlement" ? "selected" : ""}>Settlement</option>
          <option value="location" ${(locationState.entityType || "") === "location" ? "selected" : ""}>Location</option>
          <option value="faction" ${(locationState.entityType || "") === "faction" ? "selected" : ""}>Faction Base</option>
        </select>

        <label>Entity</label>
        <select id="npcLocationEntityIdInput">
          <option value="">Loading entities...</option>
        </select>
      </div>

      <label>Location Notes</label>
      <textarea
        id="npcLocationNotesInput"
        placeholder="Aboard The Sea's Fury, below decks, guarding the hold..."
      >${escapeHtml(locationState.notes || overview.currentLocation || "")}</textarea>

    </div>
  `;
}

function renderNpcPersonalityWorkspace(npc) {
  const personality = npc?.personality || {};

  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  wrapper.innerHTML = `
    <div class="forgeWorkspaceGrid two">

      <div class="forgeWorkspaceCard">
        <h2>Roleplay</h2>

        <label>Appearance</label>
        <textarea id="npcAppearanceInput">${escapeHtml(personality.appearance || "")}</textarea>

        <label>Voice</label>
        <textarea id="npcVoiceInput">${escapeHtml(personality.voice || "")}</textarea>

        <label>Mannerisms</label>
        <textarea id="npcMannerismsInput">${escapeHtml(personality.mannerisms || "")}</textarea>
      </div>

      <div class="forgeWorkspaceCard">
        <h2>Motivation</h2>

        <label>Ideals</label>
        <textarea id="npcIdealsInput">${escapeHtml(personality.ideals || "")}</textarea>

        <label>Bonds</label>
        <textarea id="npcBondsInput">${escapeHtml(personality.bonds || "")}</textarea>

        <label>Flaws</label>
        <textarea id="npcFlawsInput">${escapeHtml(personality.flaws || "")}</textarea>

        <label>Secret</label>
        <textarea id="npcSecretInput">${escapeHtml(personality.secret || "")}</textarea>

        <label>Hook</label>
        <textarea id="npcHookInput">${escapeHtml(personality.hook || "")}</textarea>
      </div>

    </div>
    <div class="forgeWorkspaceCard npcOverviewRelationshipsCard">
  <div class="forgeWorkspaceHeader">
    <div>
      <h2>Relationships</h2>
      <p>Story links connected through the Universal Relationship Engine.</p>
    </div>

    <button
      id="openNpcEntityLinksFromOverviewBtn"
      type="button"
    >
      Manage Links
    </button>
  </div>

  <div id="npcOverviewRelationshipSummary">
    <p class="forgeEmptyState">
      Loading relationships...
    </p>
  </div>
</div>
  `;

  return wrapper;
}

function renderNpcTraitsWorkspace(npc) {
  return renderSimpleCardWorkspace({
    title: "NPC Traits",
    addLabel: "+ Add Trait",
    type: "npcTrait",
    items: npc?.traits || [],
    emptyText: "No NPC traits yet."
  });
}

function renderNpcActionsWorkspace(npc) {
  return renderActionFamilyWorkspace({
    title: "NPC Actions",
    description: "Structured actions for combat-ready NPCs.",
    addLabel: "+ Add Action",
    listId: "npcActionCardList",
    buttonId: "addNpcActionBtn",
    cardClass: "npcActionCard",
    items: npc?.actions || []
  });
}
function renderNpcBonusActionsWorkspace(npc) {
  return renderActionFamilyWorkspace({
    title: "NPC Bonus Actions",
    description: "Bonus actions for combat-ready NPCs.",
    addLabel: "+ Add Bonus Action",
    listId: "npcBonusActionCardList",
    buttonId: "addNpcBonusActionBtn",
    cardClass: "npcBonusActionCard",
    items: npc?.bonusActions || []
  });
}

function renderNpcReactionsWorkspace(npc) {
  return renderActionFamilyWorkspace({
    title: "NPC Reactions",
    description: "Reactions triggered by enemy movement, attacks, spells, or story conditions.",
    addLabel: "+ Add Reaction",
    listId: "npcReactionCardList",
    buttonId: "addNpcReactionBtn",
    cardClass: "npcReactionCard",
    items: npc?.reactions || []
  });
}

function renderNpcLegendaryWorkspace(npc) {
  const wrapper = renderActionFamilyWorkspace({
    title: "NPC Legendary Actions",
    description: "Used by major villains, bosses, and BBEG-level NPCs.",
    addLabel: "+ Add Legendary Action",
    listId: "npcLegendaryActionCardList",
    buttonId: "addNpcLegendaryActionBtn",
    cardClass: "npcLegendaryActionCard",
    items: npc?.legendaryActions || []
  });

  const toggle = document.createElement("div");
  toggle.className = "forgeWorkspaceToggle forgeWorkspaceToggleCompact";

  toggle.innerHTML = `
    <label class="forgeSwitchLine">
      <span>
        <strong>Legendary NPC</strong>
        <small>Enable legendary action tracking for this NPC.</small>
      </span>

      <input
        id="npcLegendaryEnabledInput"
        type="checkbox"
        ${npc?.flags?.legendaryNpc ? "checked" : ""}
      >
    </label>
  `;

  wrapper.prepend(toggle);

  return wrapper;
}

function renderNpcLairWorkspace(npc) {
  const wrapper = renderActionFamilyWorkspace({
    title: "NPC Lair Actions",
    description: "Used when this NPC controls a lair, stronghold, temple, ship, dungeon, or battlefield.",
    addLabel: "+ Add Lair Action",
    listId: "npcLairActionCardList",
    buttonId: "addNpcLairActionBtn",
    cardClass: "npcLairActionCard",
    items: npc?.lairActions || []
  });

  const toggle = document.createElement("div");
  toggle.className = "forgeWorkspaceToggle forgeWorkspaceToggleCompact";

  toggle.innerHTML = `
    <label class="forgeSwitchLine">
      <span>
        <strong>Has Lair</strong>
        <small>Enable lair action tracking for this NPC.</small>
      </span>

      <input
        id="npcHasLairEnabledInput"
        type="checkbox"
        ${npc?.flags?.hasLair ? "checked" : ""}
      >
    </label>
  `;

  wrapper.prepend(toggle);

  return wrapper;
}

const NPC_RELATIONSHIP_PRESET_ORDER = [
  "answers_to",
  "commands",
  "member_of",
  "secretly_member_of",
  "operates_from",
  "aboard",
  "located_in",
  "allied_with",
  "rival_of",
  "owns",
  "inside",
  "contained_in",
  "stored_in",
  "carried_by",
  "stationed_at",
  "assigned_to",
  "co_leads_with",
  "equal_rank_to",
  "deputy_to",
  "leads",
  "secretly_answers_to",
  "secretly_commands"
];

const NPC_RELATIONSHIP_SUGGESTED_TARGETS = {
  answers_to: "npc",
  commands: "faction",
  member_of: "faction",
  secretly_member_of: "faction",
  operates_from: "vehicle",
  aboard: "vehicle",
  located_in: "location",
  allied_with: "npc",
  rival_of: "npc",
  owns: "item",
  inside: "vehicle",
  contained_in: "vehicle",
  stored_in: "vehicle",
  carried_by: "npc",
  stationed_at: "location",
  assigned_to: "vehicle",
  co_leads_with: "npc",
  equal_rank_to: "npc",
  deputy_to: "npc",
  leads: "faction",
  secretly_answers_to: "npc",
  secretly_commands: "npc"
};

const NPC_RELATIONSHIP_PRESET_FALLBACKS = {
  answers_to: {
    value: "answers_to",
    label: "Reports To",
    description: "This NPC answers to, reports to, or serves under another NPC."
  },
  commands: {
    value: "commands",
    label: "Commands / Leads",
    description: "This NPC commands a crew, faction, squad, group or organisation. If you choose a ship or vehicle, MasterForge will link them to that vehicle's crew instead."
  },
  member_of: {
    value: "member_of",
    label: "Member Of",
    description: "This NPC is openly a member of a faction, crew, guild, army, order, or organisation."
  },
  secretly_member_of: {
    value: "secretly_member_of",
    label: "Secretly Member Of",
    description: "This NPC is secretly connected to a faction or organisation."
  },
  operates_from: {
    value: "operates_from",
    label: "Operates From",
    description: "This NPC operates from a ship, base, settlement, stronghold, lair, or location."
  },
  aboard: {
    value: "aboard",
    label: "Aboard / Assigned To",
    description: "This NPC is currently aboard, stationed on, or assigned to a ship, base, settlement or other entity."
  },
  located_in: {
    value: "located_in",
    label: "Located In",
    description: "This NPC is currently based in, found in, or associated with a location."
  },
  allied_with: {
    value: "allied_with",
    label: "Allied With",
    description: "This NPC is allied with another entity."
  },
  rival_of: {
    value: "rival_of",
    label: "Rival Of",
    description: "This NPC is a rival, enemy, competitor, or opposing force to another entity."
  },
  owns: {
    value: "owns",
    label: "Owns / Controls",
    description: "This NPC owns, controls, possesses, or claims something."
  },
  inside: {
    value: "inside",
    label: "Inside",
    description: "This entity is physically inside another entity."
  },
  contained_in: {
    value: "contained_in",
    label: "Contained In",
    description: "This entity is contained inside another entity."
  },
  stored_in: {
    value: "stored_in",
    label: "Stored In",
    description: "This item, loot, cargo or object is stored inside another entity."
  },
  carried_by: {
    value: "carried_by",
    label: "Carried By",
    description: "This item or object is carried by another entity."
  },
  stationed_at: {
    value: "stationed_at",
    label: "Stationed At",
    description: "This group, NPC, crew, creature or force is stationed at another entity."
  },
  assigned_to: {
    value: "assigned_to",
    label: "Assigned To",
    description: "This entity is assigned to another entity, ship, base, faction or location."
  },
  co_leads_with: {
    value: "co_leads_with",
    label: "Co-Leads With",
    description: "This entity shares leadership responsibility with another entity."
  },
  equal_rank_to: {
    value: "equal_rank_to",
    label: "Equal In Position To",
    description: "This entity holds equal rank or authority with another entity."
  },
  deputy_to: {
    value: "deputy_to",
    label: "Deputy To",
    description: "This entity serves as deputy, second-in-command, or designated subordinate to another entity."
  },
  leads: {
    value: "leads",
    label: "Leads",
    description: "This entity leads a faction, organisation, crew, order, or other group."
  },
  secretly_answers_to: {
    value: "secretly_answers_to",
    label: "Secretly Answers To",
    description: "This entity secretly reports to or serves under another entity."
  },
  secretly_commands: {
    value: "secretly_commands",
    label: "Secretly Commands",
    description: "This entity secretly commands, directs, or controls another entity."
  }
};

function getNpcRelationshipRegistry() {
  return window.MasterForgeRelationshipTypes || null;
}

function normaliseNpcRelationshipTargetType(
  value = ""
) {
  const targetType =
    String(value || "")
      .trim()
      .toLowerCase();

  return targetType === "ship"
    ? "vehicle"
    : targetType;
}

function formatNpcRelationshipFallbackLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function createNpcRelationshipPreset(id) {
  const registry = getNpcRelationshipRegistry();
  const registered =
    typeof registry?.get === "function"
      ? registry.get(id)
      : null;
  const fallback =
    NPC_RELATIONSHIP_PRESET_FALLBACKS[id] || {
      value: id,
      label: formatNpcRelationshipFallbackLabel(id),
      description: ""
    };

  return {
    value: registered?.id || fallback.value || id,
    label: registered?.label || fallback.label,
    description:
      registered?.description ||
      fallback.description,
    suggestedTargetType:
      NPC_RELATIONSHIP_SUGGESTED_TARGETS[id]
  };
}

function getNpcRelationshipPresets() {
  return NPC_RELATIONSHIP_PRESET_ORDER.map(
    createNpcRelationshipPreset
  );
}

function renderNpcRelationshipPresetOptions(selectedValue = "") {
  const presets = getNpcRelationshipPresets();
  const normalOptions = presets.map(preset => `
    <option
      value="${escapeHtml(preset.value)}"
      ${selectedValue === preset.value ? "selected" : ""}
    >
      ${escapeHtml(preset.label)}
    </option>
  `).join("");

  const selectedIsKnown = presets.some(
    preset => preset.value === selectedValue
  );

  if (!selectedValue || selectedIsKnown) {
    return normalOptions;
  }

  return `${normalOptions}
    <option value="${escapeHtml(selectedValue)}" selected>
      ${escapeHtml(formatNpcRelationshipFallbackLabel(selectedValue))}
    </option>
  `;
}

function getNpcRelationshipPreset(value) {
  const preset = getNpcRelationshipPresets()
    .find(item => item.value === value);

  if (preset) {
    return preset;
  }

  if (!value) {
    return null;
  }

  return {
    value,
    label: formatNpcRelationshipFallbackLabel(value),
    description: "",
    suggestedTargetType: null
  };
}

function formatNpcRelationshipLabel(value) {
  return getNpcRelationshipPreset(value)?.label ||
    formatNpcRelationshipFallbackLabel(value);
}

function updateNpcRelationshipPresetHelp() {
  const relationshipInput = document.querySelector("#npcRelationshipTypeInput");
  const help = document.querySelector("#npcRelationshipPresetHelp");

  if (!relationshipInput || !help) return;

  const preset = getNpcRelationshipPreset(relationshipInput.value);

  if (!preset) {
    help.innerText = "";
    return;
  }

  help.innerText = preset.description || "";
}

function renderNpcEntityLinksWorkspace(npc) {
  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  const entityId = npc?.entityId || npc?.id || "";
const npcName = npc?.name || "This NPC";

  wrapper.innerHTML = `
    <div class="forgeWorkspaceHeader">
      <div>
        <h2>Entity Links</h2>
        <p>Connect this NPC to the shared Relationship Engine.</p>
      </div>
      <button id="refreshNpcEntityLinksBtn" type="button">Refresh Links</button>
    </div>

    <div class="forgeWorkspaceGrid two">

      <div class="forgeWorkspaceCard relationshipHeroCard">
  <div class="relationshipHeroTop">
    <div class="relationshipHeroIcon">🧍</div>

    <div>
      <h2>${escapeHtml(npcName)}</h2>
      <p>Linked to the Relationship Engine as an NPC.</p>
    </div>
  </div>

  <div class="relationshipStatusBox">
    <span class="relationshipStatusLabel">Linked Entity ID</span>
    <code id="npcLinkedEntityIdDisplay">${escapeHtml(entityId || "Not linked yet")}</code>
  </div>

  <details class="relationshipAdvancedBox">
    <summary>Advanced entity settings</summary>

    <label>Entity Type</label>
    <input value="npc" disabled>

    <label>Linked Entity ID</label>
    <input
      id="npcLinkedEntityIdInput"
      value="${escapeHtml(entityId)}"
      placeholder="captain-thorne"
    >

    <p class="forgeSmallHelp">
      Usually this should match the NPC ID. Only change this if fixing a broken or renamed entity.
    </p>
  </details>

  <button id="syncNpcEntityBtn" type="button">
    🔄 Sync NPC to Relationship Engine
  </button>
</div>

      <div class="forgeWorkspaceCard">
        <h2>Create Relationship</h2>
<p class="forgeSmallHelp">
  Build a link from ${escapeHtml(npcName)} to another part of your campaign.
</p>

        <label>Relationship</label>
<select id="npcRelationshipTypeInput">
  ${renderNpcRelationshipPresetOptions("commands")}
</select>

<p id="npcRelationshipPresetHelp" class="forgeSmallHelp"></p>

        <label>Target Entity Type</label>
        <select id="npcRelationshipTargetTypeInput">
          <option value="npc">NPC</option>
          <option value="faction">Faction</option>
          <option value="vehicle">Vehicle</option>
          <option value="location">Location</option>
          <option value="settlement">Settlement</option>
          <option value="item">Item</option>
          <option value="quest">Quest</option>
          <option value="event">Event</option>
          <option value="creature">Creature</option>
        </select>

        <label>Target Entity</label>
        <select id="npcRelationshipTargetIdInput">
          <option value="">Loading targets...</option>
        </select>

        <label>Notes</label>
        <textarea
          id="npcRelationshipNotesInput"
          placeholder="Captain Thorne commands the crew of The Sea's Fury."
        ></textarea>

        <button id="addNpcRelationshipBtn" type="button">
          + Create Relationship
        </button>
      </div>

    </div>

    <div class="forgeWorkspaceCard">
      <h2>Current Relationships</h2>
      <div id="npcEntityRelationshipsList">
        <p class="forgeEmptyState">Loading relationships...</p>
      </div>
    </div>
  `;

  setTimeout(() => {
    setupNpcEntityLinksWorkspace(npc);
  }, 0);

  return wrapper;
}

async function setupNpcEntityLinksWorkspace(npc) {
  const entityIdInput = document.querySelector("#npcLinkedEntityIdInput");
  const syncBtn = document.querySelector("#syncNpcEntityBtn");
  const refreshBtn = document.querySelector("#refreshNpcEntityLinksBtn");
  const addBtn = document.querySelector("#addNpcRelationshipBtn");
  const relationshipInput = document.querySelector("#npcRelationshipTypeInput");
const targetTypeInput = document.querySelector("#npcRelationshipTargetTypeInput");

  if (!npc) return;

  if (syncBtn) {
    syncBtn.onclick = async () => {
      syncNpcFormToState();

      const activeNpc = npcBuilderState.activeNpc;

      if (!activeNpc.id) {
        activeNpc.id =
          window.dmStorage.slugify(activeNpc.name || "new-npc");

        npcBuilderState.currentNpcId = activeNpc.id;
      }

      activeNpc.entityId =
        entityIdInput?.value.trim() ||
        activeNpc.entityId ||
        activeNpc.id;

      npc.world = window.dmState.current.world;
npc.region = window.dmState.current.region;
npc.locationId = window.dmState.current.location;

await window.dmAPI.saveRecord(
  "npcs",
  npc.id,
  npc,
  window.dmState.current.campaign
);

await window.dmAPI.saveRecord(
  "npcs",
  npc.id,
  npc,
  window.dmState.current.world
);

      await syncNpcToEntity(activeNpc);
      await refreshForgeAfterRelationshipChange();

      alert("NPC synced to Entity.");
    };
  }

  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      syncNpcFormToState();
      await refreshForgeAfterRelationshipChange();
    };
  }

  if (relationshipInput) {
  relationshipInput.onchange = async () => {
    const preset = getNpcRelationshipPreset(relationshipInput.value);

    updateNpcRelationshipPresetHelp();

    if (preset?.suggestedTargetType && targetTypeInput) {
      targetTypeInput.value = preset.suggestedTargetType;
      await populateNpcRelationshipTargetDropdown();
    }
  };

  updateNpcRelationshipPresetHelp();
}

if (targetTypeInput) {
  targetTypeInput.onchange = async () => {
    await populateNpcRelationshipTargetDropdown();
  };

  const preset = getNpcRelationshipPreset(relationshipInput?.value);

  if (preset?.suggestedTargetType) {
    targetTypeInput.value = preset.suggestedTargetType;
  }

  await populateNpcRelationshipTargetDropdown();
}

  if (addBtn) {
    addBtn.onclick = async () => {
      await addNpcRelationshipFromWorkspace();
    };
  }

  await renderNpcEntityRelationships(npc);
}

async function populateNpcRelationshipTargetDropdown() {
  const targetTypeInput = document.querySelector("#npcRelationshipTargetTypeInput");
  const targetSelect = document.querySelector("#npcRelationshipTargetIdInput");

  if (!targetTypeInput || !targetSelect) return;

  const selectedTargetType = targetTypeInput.value;
  const targetType =
    normaliseNpcRelationshipTargetType(
      selectedTargetType
    );

  if (
    selectedTargetType === "ship" &&
    targetTypeInput.querySelector(
      'option[value="vehicle"]'
    )
  ) {
    targetTypeInput.value = "vehicle";
  }

  targetSelect.innerHTML = `
    <option value="">Loading ${escapeHtml(targetType)} entities...</option>
  `;

  if (!window.dmAPI.getEntitiesByType) {
    targetSelect.innerHTML = `
      <option value="">Entity API not available</option>
    `;
    return;
  }

  let entities = [];

  try {
    entities = await window.dmAPI.getEntitiesByType(targetType);
  } catch (error) {
    console.error("Failed to load target entities:", error);

    targetSelect.innerHTML = `
      <option value="">Could not load ${escapeHtml(targetType)} entities</option>
    `;
    return;
  }

  const currentNpcEntityId =
    document.querySelector("#npcLinkedEntityIdInput")?.value.trim() ||
    npcBuilderState.activeNpc?.entityId ||
    npcBuilderState.activeNpc?.id;

  entities = entities.filter(entity => {
    return !(targetType === "npc" && entity.id === currentNpcEntityId);
  });

  if (!entities.length) {
    targetSelect.innerHTML = `
      <option value="">No ${escapeHtml(targetType)} entities found</option>
    `;
    return;
  }

  entities.sort((a, b) =>
    String(a.name || a.id).localeCompare(String(b.name || b.id))
  );

  targetSelect.innerHTML = `
    <option value="">Choose ${escapeHtml(targetType)}...</option>
    ${entities.map(entity => `
      <option value="${escapeHtml(entity.id)}">
        ${escapeHtml(entity.name || entity.id)} (${escapeHtml(entity.id)})
      </option>
    `).join("")}
  `;
}

async function renderNpcEntityRelationships(npc) {
  const list = document.querySelector("#npcEntityRelationshipsList");

  if (!list) return;

  const entityId =
    document.querySelector("#npcLinkedEntityIdInput")?.value.trim() ||
    npc?.entityId ||
    npc?.id;

  const npcName = npc?.name || entityId || "This NPC";

  if (!entityId) {
    list.innerHTML = `
      <div class="relationshipEmptyState">
        <h3>No linked entity yet</h3>
        <p>Save and sync this NPC before adding relationships.</p>
      </div>
    `;
    return;
  }

  if (!window.dmAPI.getEntityRelationships) {
    list.innerHTML = `
      <div class="relationshipEmptyState">
        <h3>Relationship API unavailable</h3>
        <p>The Relationship Engine could not be reached.</p>
      </div>
    `;
    return;
  }

  let relationships = [];

  try {
    relationships = await window.dmAPI.getEntityRelationships("npc", entityId);
  } catch (error) {
    console.error("Could not load NPC relationships:", error);

    list.innerHTML = `
      <div class="relationshipEmptyState">
        <h3>Could not load relationships</h3>
        <p>Check the console for details.</p>
      </div>
    `;
    return;
  }

  if (!relationships.length) {
    list.innerHTML = `
      <div class="relationshipEmptyState">
        <h3>No relationships yet</h3>
        <p>Create the first link for ${escapeHtml(npcName)}.</p>
      </div>
    `;
    return;
  }

  const renderedCards = [];

  for (const rel of relationships) {
    const relationshipId = rel.id || "";

    const isOutgoing =
      rel.from_type === "npc" && rel.from_id === entityId;

    const direction = isOutgoing ? "Outgoing" : "Incoming";

    const otherType = isOutgoing ? rel.to_type : rel.from_type;
    const otherId = isOutgoing ? rel.to_id : rel.from_id;

    const otherName = await getEntityDisplayName(otherType, otherId);
    const relationshipLabel = formatNpcRelationshipLabel(rel.relationship);

    const sentence = isOutgoing
      ? `${npcName} ${relationshipLabel.toLowerCase()} ${otherName}`
      : `${otherName} ${relationshipLabel.toLowerCase()} ${npcName}`;

    renderedCards.push(`
      <div class="relationshipStoryCard">
        <div class="relationshipStoryMain">
          <div class="relationshipStoryIcon">
            ${getEntityTypeIcon(otherType)}
          </div>

          <div class="relationshipStoryBody">
            <div class="relationshipStoryMeta">
              <span>${escapeHtml(direction)}</span>
              <span>${escapeHtml(formatEntityTypeLabel(otherType))}</span>
            </div>

            <h3>${escapeHtml(sentence)}</h3>

            ${
              rel.notes
                ? `<p>${escapeHtml(rel.notes)}</p>`
                : `<p class="forgeEmptyState">No notes added.</p>`
            }

            <details class="relationshipAdvancedBox">
              <summary>Technical details</summary>
              <p><small>ID: ${escapeHtml(relationshipId || "No relationship ID")}</small></p>
              <p><small>Engine value: ${escapeHtml(rel.relationship || "")}</small></p>
              <p><small>${escapeHtml(rel.from_type)}:${escapeHtml(rel.from_id)} → ${escapeHtml(rel.to_type)}:${escapeHtml(rel.to_id)}</small></p>
            </details>
          </div>
        </div>

        <div class="relationshipStoryActions">
          <button
            class="openRelationshipTargetBtn"
            type="button"
            data-entity-type="${escapeHtml(otherType)}"
            data-entity-id="${escapeHtml(otherId)}"
          >
            Open
          </button>

          <button
            class="deleteNpcRelationshipBtn dangerBtn"
            type="button"
            data-relationship-id="${escapeHtml(relationshipId)}"
            ${relationshipId ? "" : "disabled"}
          >
            Remove
          </button>
        </div>
      </div>
    `);
  }

  list.innerHTML = renderedCards.join("");

  list.querySelectorAll(".openRelationshipTargetBtn").forEach(button => {
    button.onclick = async () => {
      const type = button.dataset.entityType;
      const id = button.dataset.entityId;

      if (type === "npc") {
        await openNpcEntityInBuilder(id);
        return;
      }

      const entity = await window.dmAPI.getEntity(type, id);

      if (entity) {
        activateMainPanel(
          document.querySelector('.tab[data-tab="entities"]'),
          document.querySelector("#entities")
        );

        await showEntityDebugDetails(entity);
      } else {
        alert("Target entity not found.");
      }
    };
  });

  list.querySelectorAll(".deleteNpcRelationshipBtn").forEach(button => {
    button.onclick = async () => {
      const relationshipId = button.dataset.relationshipId;

      if (!relationshipId) {
        alert("This relationship has no ID and cannot be removed safely.");
        return;
      }

      const confirmed = confirm(
        "Remove this relationship? This will not delete the NPC or target entity."
      );

      if (!confirmed) return;

      await deleteNpcRelationshipFromWorkspace(relationshipId);
    };
  });
}

function formatEntityTypeLabel(type) {
  const labels = {
    npc: "NPC",
    faction: "Faction",
    ship: "Ship",
    location: "Location",
    settlement: "Settlement",
    item: "Item",
    quest: "Quest",
    event: "Event",
    creature: "Creature"
  };

  return labels[type] || String(type || "Entity");
}

function getEntityTypeIcon(type) {
  const icons = {
    npc: "🧍",
    faction: "🏴",
    ship: "🚢",
    location: "🗺",
    settlement: "🏘",
    item: "💎",
    quest: "📜",
    event: "⚡",
    creature: "🐲"
  };

  return icons[type] || "🔗";
}

async function getEntityDisplayName(type, id) {
  if (!type || !id || !window.dmAPI.getEntity) return id || "Unknown";

  try {
    const entity = await window.dmAPI.getEntity(type, id);
    return entity?.name || id;
  } catch (error) {
    console.warn("Could not resolve entity display name:", { type, id, error });
    return id;
  }
}

async function addNpcRelationshipFromWorkspace() {
  syncNpcFormToState();

  const npc = npcBuilderState.activeNpc;

  if (!npc) return;

  if (!npc.id) {
    alert("Save the NPC before adding relationships.");
    return;
  }

  const engine =
    window.MasterForgeRelationshipEngine;

  if (!engine?.createRelationship) {
    alert("Universal Relationship Engine is unavailable.");
    return;
  }

  const fromId =
    document.querySelector("#npcLinkedEntityIdInput")
      ?.value.trim() ||
    npc.entityId ||
    npc.id;

  npc.entityId = fromId;

  let relationshipType =
    document.querySelector("#npcRelationshipTypeInput")
      ?.value;

  let targetType =
    normaliseNpcRelationshipTargetType(
      document.querySelector("#npcRelationshipTargetTypeInput")
        ?.value
    );

  let targetId =
    document.querySelector("#npcRelationshipTargetIdInput")
      ?.value;

  const notes =
    document.querySelector("#npcRelationshipNotesInput")
      ?.value.trim() ||
    "";

  if (!relationshipType || !targetType || !targetId) {
    alert(
      "Relationship type, target type and target entity are required."
    );
    return;
  }

  /*
   * Temporary compatibility rule:
   *
   * NPC commands ship → NPC commands generated ship crew.
   *
   * This remains in the renderer for now because crew creation
   * is still part of the existing vehicle UI workflow.
   */
  if (
    relationshipType === "commands" &&
    isVehicleEntityType(targetType)
  ) {
    const vehicleEntity =
      await window.dmAPI.getEntity(
        targetType,
        targetId
      );

    if (!vehicleEntity) {
      alert("Vehicle entity not found.");
      return;
    }

    const crewEntity =
      await ensureVehicleCrewEntity(vehicleEntity);

    if (!crewEntity) {
      alert(
        "Could not create or find crew for this vehicle."
      );
      return;
    }

    targetType = "faction";
    targetId = crewEntity.id;
  }

  await syncNpcToEntity(npc);

  const relationshipInput = {
    id: window.dmStorage.slugify(
      [
        "relationship",
        fromId,
        relationshipType,
        targetType,
        targetId,
        Date.now()
      ].join("-")
    ),

    sourceEntityType: "npc",
    sourceEntityId: fromId,

    relationshipType,

    targetEntityType: targetType,
    targetEntityId: targetId,

    campaignId:
      window.dmState.current.campaign ||
      "",

    visibility: "gm",
    status: "active",
    notes
  };

  try {
    const createdRelationship =
      await engine.createRelationship(
        relationshipInput
      );

    console.log(
      "URE RELATIONSHIP CREATED:",
      createdRelationship
    );

    await window.dmAPI.saveRecord(
      "npcs",
      npc.id,
      npc,
      window.dmState.current.campaign
    );

    const targetInput =
      document.querySelector(
        "#npcRelationshipTargetIdInput"
      );

    const notesInput =
      document.querySelector(
        "#npcRelationshipNotesInput"
      );

    if (targetInput) {
      targetInput.value = "";
    }

    if (notesInput) {
      notesInput.value = "";
    }

    await populateNpcRelationshipTargetDropdown();
    await refreshForgeAfterRelationshipChange();

    alert("Relationship added.");
  } catch (error) {
    console.error(
      "URE failed to create relationship:",
      {
        relationshipInput,
        error
      }
    );

    alert(
      error?.message ||
      "Failed to create relationship. Check console."
    );
  }
}

async function deleteNpcRelationshipFromWorkspace(relationshipId) {
  if (!relationshipId) {
    alert("Relationship ID is required.");
    return;
  }

  const engine =
    window.MasterForgeRelationshipEngine;

  if (!engine?.deleteRelationship) {
    alert("Universal Relationship Engine is unavailable.");
    return;
  }

  const confirmed = confirm(
    "Remove this relationship permanently?"
  );

  if (!confirmed) return;

  try {
    console.log(
      "URE DELETING RELATIONSHIP:",
      relationshipId
    );

    const result =
      await engine.deleteRelationship(
        relationshipId
      );

    console.log(
      "URE RELATIONSHIP DELETED:",
      result
    );

    await refreshForgeAfterRelationshipChange();

    alert("Relationship removed.");
  } catch (error) {
    console.error(
      "URE failed to delete relationship:",
      {
        relationshipId,
        error
      }
    );

    alert(
      error?.message ||
      "Failed to remove relationship. Check console."
    );
  }
}

async function refreshForgeAfterRelationshipChange() {
  try {
    await renderNpcEntityRelationships(npcBuilderState.activeNpc);
  } catch (error) {
    console.warn("Could not refresh NPC relationship list:", error);
  }

  try {
    if (typeof loadEntityDebugPanel === "function") {
      await loadEntityDebugPanel();
    }
  } catch (error) {
    console.warn("Could not refresh Entity panel:", error);
  }

  try {
    const treePanel = document.querySelector("#entityRelationshipTreePanel");

    if (
      typeof loadEntityTreeViewer === "function" &&
      treePanel &&
      !treePanel.classList.contains("hidden")
    ) {
      await loadEntityTreeViewer();
    }
  } catch (error) {
    console.warn("Could not refresh relationship tree:", error);
  }

  try {
    await renderNpcList();
  } catch (error) {
    console.warn("Could not refresh NPC list:", error);
  }
}

async function syncNpcToEntity(npc) {
  if (!npc?.id) {
    console.warn("Cannot sync NPC to entity without an NPC ID.", npc);
    return;
  }

  if (
    !window.dmAPI.getEntity ||
    !window.dmAPI.createEntity ||
    !window.dmAPI.updateEntity
  ) {
    console.warn("Entity API methods missing, skipping NPC entity sync.");
    return;
  }

  const entityId = npc.entityId || npc.id;

  npc.entityId = entityId;

  let existing = null;
  try {
    existing = await window.dmAPI.getEntity("npc", entityId);
  } catch (error) {
    console.warn("Could not load the existing NPC entity before sync; sync was skipped to avoid replacing unknown metadata:", error);
    return;
  }

  const entity = {
    ...(existing || {}),
    id: entityId,
    entity_type: "npc",
    name: npc.name || "Unnamed NPC",
    description:
      npc.overview?.summary ||
      npc.personality?.hook ||
      npc.role ||
      "",

    data_json: {
  ...(existing?.data_json || {}),
  source: "npc-builder",
  npcId: npc.id,
  entityId,

  systemId:
    npc.systemId ||
    getCurrentSystemId(),

  scope: npc.scope || {
    campaignId: npc.campaign || "",
    worldId: npc.world || "",
    regionId: npc.region || "",
    locationId: npc.locationId || ""
  },

  currentPosition: npc.locationState || npc.currentPosition || {
  mode: "location",
  worldId: npc.world || "",
  regionId: npc.region || "",
  locationId: npc.locationId || "",
  entityType: "",
  entityId: "",
  notes: npc.overview?.currentLocation || ""
},

  visibility: normaliseVisibility(npc.visibility),

  species: npc.species || "",
      type: npc.type || "",
      role: npc.role || "",
      class: npc.class || "",
      level: npc.level || 0,
      cr: npc.cr || "",
      status: npc.status || "Unknown",

      campaign: npc.campaign || window.dmState.current.campaign,
      world: npc.world || window.dmState.current.world,
      region: npc.region || window.dmState.current.region,
      locationId: npc.locationId || window.dmState.current.location,

      faction: npc.faction || null,
      flags: npc.flags || {}
    }
  };

  try {
    if (existing) {
      await window.dmAPI.updateEntity("npc", entityId, entity);
      console.log("Updated linked NPC entity:", entityId);
    } else {
      await window.dmAPI.createEntity(entity);
      console.log("Created linked NPC entity:", entityId);
    }
  } catch (error) {
    console.error("Failed to sync NPC to entity:", error);
  }
}

async function syncNpcLocationEntityRelationship(npc) {
  if (!npc?.id || !npc?.locationState) {
    return null;
  }

  const engine =
    window.MasterForgeRelationshipEngine;

  if (!engine?.syncCurrentLocationRelationship) {
    console.warn(
      "URE location relationship sync is unavailable."
    );

    return null;
  }

  await syncNpcToEntity(npc);

  const npcEntityId =
    npc.entityId ||
    npc.id;

  /*
   * Vehicle crew creation remains in the renderer for now.
   * It is entity creation behaviour, not relationship behaviour.
   */
  if (
    npc.locationState.mode === "entity" &&
    npc.locationState.entityType &&
    npc.locationState.entityId
  ) {
    try {
      const containingEntity =
        await window.dmAPI.getEntity(
          npc.locationState.entityType,
          npc.locationState.entityId
        );

      if (
        containingEntity &&
        isVehicleEntityType(
          containingEntity.entity_type
        )
      ) {
        await ensureVehicleCrewEntity(
          containingEntity
        );
      }
    } catch (error) {
      console.warn(
        "Could not prepare containing vehicle crew:",
        error
      );
    }
  }

  const result =
    await engine.syncCurrentLocationRelationship({
      entityType: "npc",
      entityId: npcEntityId,

      locationState:
        npc.locationState,

      replaceExisting:
        npc.replaceOldLocationRelationships !== false,

      campaignId:
        npc.campaign ||
        window.dmState.current.campaign ||
        "",

      notes:
        npc.locationState.notes ||
        npc.overview?.currentLocation ||
        ""
    });

  console.log(
    "URE NPC LOCATION RELATIONSHIP SYNCED:",
    {
      npcId: npc.id,
      entityId: npcEntityId,
      locationState:
        npc.locationState,
      result
    }
  );

  return result;
}

async function openNpcEntityInBuilder(entityOrNpcId) {
  const npcId =
    typeof entityOrNpcId === "string"
      ? entityOrNpcId
      : entityOrNpcId?.data_json?.npcId ||
        entityOrNpcId?.data_json?.entityId ||
        entityOrNpcId?.entityId ||
        entityOrNpcId?.id;

  if (!npcId) {
    alert("No NPC ID found for this entity.");
    return;
  }

  await openNpcBuilderByAnyId(npcId);
}

async function openNpcEntityLocationEditor(entityOrNpcId) {
  const npcId =
    typeof entityOrNpcId === "string"
      ? entityOrNpcId
      : entityOrNpcId?.data_json?.npcId ||
        entityOrNpcId?.data_json?.entityId ||
        entityOrNpcId?.entityId ||
        entityOrNpcId?.id;

  if (!npcId) {
    alert("No NPC ID found for this entity.");
    return;
  }

  const npc = await findNpcByAnyId(npcId);

  if (!npc) {
    alert("NPC not found.");
    return;
  }

  const npcTab =
    document.querySelector('.tab[data-tab="npc"]') ||
    document.querySelector('.tab[data-tab="npcs"]');

  const npcPanel =
    document.querySelector("#npc") ||
    document.querySelector("#npcs");

  if (!npcTab || !npcPanel) {
    alert("NPC Builder panel not found.");
    return;
  }

  activateMainPanel(npcTab, npcPanel);

  fillNpcForm(npc);

  npcBuilderState.activeWorkspace = "overview";
  switchNpcWorkspace("overview", false);

  await renderNpcList();

  setTimeout(() => {
    const locationModeInput = document.querySelector("#npcLocationModeInput");
    const locationSection =
      locationModeInput?.closest(".forgeWorkspaceCard") ||
      document.querySelector("#npcWorkspaceMount");

    if (locationSection) {
      locationSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      locationSection.classList.add("forgeFlashFocus");

      setTimeout(() => {
        locationSection.classList.remove("forgeFlashFocus");
      }, 1600);
    }

    if (locationModeInput) {
      locationModeInput.focus();
    }
  }, 150);
}

async function findNpcByAnyId(npcIdOrEntityId) {
  if (!npcIdOrEntityId) return null;

  let npcs = [];

  try {
    npcs = await getNpcs();
  } catch (error) {
    console.warn("Could not load NPCs via getNpcs:", error);
    npcs = [];
  }

  const searchId = String(npcIdOrEntityId);

  return npcs.find(npc => {
  const possibleIds = [
    npc.id,
    npc.entityId,
    npc.data_json?.npcId,
    npc.data_json?.entityId,
    npc.scope?.id,
    npc._id
  ]
    .filter(Boolean)
    .map(String);

  return possibleIds.includes(searchId);
}) || null;
}

async function openNpcBuilderByAnyId(npcIdOrEntityId) {
  const npc = await findNpcByAnyId(npcIdOrEntityId);

  if (!npc) {
    console.warn("NPC not found by helper:", npcIdOrEntityId);
    alert("NPC not found.");
    return;
  }

  const npcTab =
    document.querySelector('.tab[data-tab="npc"]') ||
    document.querySelector('.tab[data-tab="npcs"]');

  const npcPanel =
    document.querySelector("#npc") ||
    document.querySelector("#npcs");

  if (!npcTab || !npcPanel) {
    alert("NPC Builder panel not found.");
    return;
  }

  activateMainPanel(npcTab, npcPanel);

  fillNpcForm(npc);
  await renderNpcList();

  switchNpcWorkspace("overview", false);
}


async function saveNpc() {
  const npc = syncNpcFormToState();

  if (!npc.name) {
    alert("NPC name is required.");
    return;
  }

  npc.id =
    npcBuilderState.currentNpcId ||
    window.dmStorage.slugify(npc.name || "new-npc");

  npcBuilderState.currentNpcId = npc.id;
  npcBuilderState.activeNpc = npc;

  await window.dmAPI.saveRecord(
  "npcs",
  npc.id,
  npc,
  window.dmState.current.campaign
);

await window.dmAPI.saveRecord(
  "npcs",
  npc.id,
  npc,
  npc.world || window.dmState.current.world
  );

await syncNpcToEntity(npc);
await syncNpcLocationEntityRelationship(npc);
await mountCanonicalDmWorkspace("npc", npc, "npc");

await renderNpcList();

if (typeof loadEntityDebugPanel === "function") {
  await loadEntityDebugPanel();
}

if (
  currentlySelectedEntity &&
  currentlySelectedEntity.entity_type === npc.locationState?.entityType &&
  currentlySelectedEntity.id === npc.locationState?.entityId &&
  typeof showEntityDebugDetails === "function"
) {
  const freshContainingEntity = await window.dmAPI.getEntity(
    npc.locationState.entityType,
    npc.locationState.entityId
  );

  if (freshContainingEntity) {
    await showEntityDebugDetails(freshContainingEntity);
  }
}

  console.log("NPC saved.");

  const saveButton =
    document.querySelector("#saveNpcBuilderBtn");

  if (saveButton) {
    const normalText = saveButton.textContent;

    saveButton.textContent = "Saved ✓";

    setTimeout(() => {
      if (
        saveButton.isConnected &&
        saveButton.textContent === "Saved ✓"
      ) {
        saveButton.textContent = normalText;
      }
    }, 1500);
  }
}

async function deleteNpc() {
  if (!npcBuilderState.currentNpcId) {
    alert("No NPC selected.");
    return;
  }

  const confirmed = confirm("Delete this NPC permanently?");
  if (!confirmed) return;

  await window.dmStorage.deleteDbRecord(npcBuilderState.currentNpcId);

  npcBuilderState.currentNpcId = null;
  npcBuilderState.activeNpc = null;

  await renderNpcList();
  newNpc();
}

async function generateNpc() {
  const table = await window.dmStorage.getNpcGeneratorTable();
  const output = document.querySelector("#npcResult");

  if (!table) {
    output.innerHTML = `<h2>No NPC generator found for this location.</h2>`;
    return;
  }

  currentGeneratedNpc = {
    id: "npc-" + Date.now(),
    name: pickRandom(table.names),
    species: pickRandom(table.species),
    role: pickRandom(table.roles),
    appearance: pickRandom(table.appearances),
    personality: pickRandom(table.personalities),
    secret: pickRandom(table.secrets),
    hook: pickRandom(table.hooks),
    faction: pickRandom(table.factions),
    firstMet: {
      campaign: window.dmState.current.campaign,
      location: window.dmState.current.location,
      region: window.dmState.current.region
    },
    notes: ""
  };

  output.innerHTML = `
    <h2>🧙 ${currentGeneratedNpc.name}</h2>

    <p><b>Species:</b> ${currentGeneratedNpc.species}</p>
    <p><b>Role:</b> ${currentGeneratedNpc.role}</p>
    <p><b>Faction:</b> ${currentGeneratedNpc.faction}</p>

    <h3>Appearance</h3>
    <p>${currentGeneratedNpc.appearance}</p>

    <h3>Personality</h3>
    <p>${currentGeneratedNpc.personality}</p>

    <h3>Secret</h3>
    <p>${currentGeneratedNpc.secret}</p>

    <h3>Hook</h3>
    <p>${currentGeneratedNpc.hook}</p>
  `;
}

async function saveGeneratedNpc() {
  if (!currentGeneratedNpc) {
    alert("Generate an NPC first.");
    return;
  }

  const npcs = await window.dmStorage.getSavedNpcs();

  npcs.push(currentGeneratedNpc);

  await window.dmStorage.saveSavedNpcs(npcs);

  await renderSavedNpcs();

  alert("NPC saved.");
}

async function renderSavedNpcs() {
  const npcs = await window.dmStorage.getSavedNpcs();
  const list = document.querySelector("#savedNpcList");

  if (!npcs.length) {
    list.innerHTML = `<p>No saved NPCs yet.</p>`;
    return;
  }

  list.innerHTML = npcs.map((npc) => `
    <div class="characterMiniCard savedNpcCard" data-npc-id="${escapeHtml(npc.id)}">
      <b>${npc.name}</b><br>
      ${npc.species} ${npc.role}<br>
      <span>Faction: ${npc.faction}</span><br>
      <span>First met: ${npc.firstMet?.campaign} - ${npc.firstMet?.region}</span>
    </div>
  `).join("");
}

function setupFactionModule() {
  const loadFactionBtn = document.querySelector("#loadFactionBtn");
  const advanceFactionBtn = document.querySelector("#advanceFactionBtn");
  const generateFactionContactBtn = document.querySelector("#generateFactionContactBtn");
  const factionSelect = document.querySelector("#factionSelect");

  if (
    !loadFactionBtn ||
    !advanceFactionBtn ||
    !generateFactionContactBtn ||
    !factionSelect
  ) {
    console.warn("Faction buttons not found, skipping Faction module.");
    return;
  }

  loadFactionBtn.onclick = renderSelectedFaction;
  advanceFactionBtn.onclick = advanceSelectedFaction;
  generateFactionContactBtn.onclick = generateFactionContact;

  refreshFactionSelect();
}

async function refreshFactionSelect() {
  const factions = await window.dmStorage.getFactions();
  const select = document.querySelector("#factionSelect");

  select.innerHTML = "";

  factions.forEach((faction) => {
    const option = document.createElement("option");
    option.value = faction.id;
    option.textContent = faction.name;
    select.appendChild(option);
  });

  if (factions.length) {
    await renderSelectedFaction();
  }
}

async function getSelectedFaction() {
  const factions = await window.dmStorage.getFactions();
  const selectedId = document.querySelector("#factionSelect").value;

  return factions.find((faction) => faction.id === selectedId);
}

async function renderSelectedFaction() {
  const faction = await getSelectedFaction();
  const output = document.querySelector("#factionResult");

  if (!faction) {
    output.innerHTML = `<p>No faction selected.</p>`;
    return;
  }

  output.innerHTML = `
    <h2>🏰 ${faction.name}</h2>

    <p><b>Type:</b> ${faction.type}</p>
    <p><b>Alignment:</b> ${faction.alignment}</p>
    <p><b>Status:</b> ${faction.status}</p>
    <p><b>Leader:</b> ${faction.leader}</p>
    ${faction.companion ? `<p><b>Companion:</b> ${faction.companion}</p>` : ""}

    <h3>Summary</h3>
    <p>${faction.summary}</p>

    <h3>Goals</h3>
    ${listHtml(faction.goals)}

    <h3>Regions</h3>
    ${listHtml(faction.regions)}

    ${faction.generals ? `<h3>Generals</h3>${listHtml(faction.generals)}` : ""}

    <h3>Influence</h3>
    <p>${faction.influence}%</p>

    <h3>Progress</h3>
    <div class="progressBar">
      <div class="progressFill" style="width:${faction.progress || 0}%"></div>
    </div>
    <p>${faction.progress || 0}%</p>
  `;
}

async function advanceSelectedFaction() {
  const factions = await window.dmStorage.getFactions();
  const selectedId = document.querySelector("#factionSelect").value;
  const index = factions.findIndex((faction) => faction.id === selectedId);

  if (index === -1) return;

  factions[index].progress = Math.min(100, Number(factions[index].progress || 0) + 10);

  await window.dmStorage.saveFactions(factions);
  await renderSelectedFaction();
}

async function generateFactionContact() {
  const faction = await getSelectedFaction();
  const output = document.querySelector("#factionResult");

  if (!faction) return;

  const role = pickRandom(faction.localContactRoles || ["Contact"]);

  const contact = {
    name: `Local ${faction.name} Contact`,
    role,
    faction: faction.name,
    location: window.dmState.current.location,
    region: window.dmState.current.region,
    attitude: pickRandom(["Helpful", "Cautious", "Suspicious", "Desperate", "Secretive"]),
    hook: pickRandom([
      "Has information about recent disappearances.",
      "Needs the party to deliver a message.",
      "Can provide a safe place to rest.",
      "Knows a hidden route nearby.",
      "Is being watched by enemies."
    ])
  };

  output.innerHTML += `
    <hr>
    <h2>🕵 Generated Local Contact</h2>
    <p><b>Name:</b> ${contact.name}</p>
    <p><b>Role:</b> ${contact.role}</p>
    <p><b>Faction:</b> ${contact.faction}</p>
    <p><b>Location:</b> ${contact.region}, ${contact.location}</p>
    <p><b>Attitude:</b> ${contact.attitude}</p>
    <p><b>Hook:</b> ${contact.hook}</p>
  `;
}

function setupWorldModule() {
  const panel = document.querySelector("#world");
  if (panel && !panel.dataset.campaignAtlasDelegationBound) {
    panel.dataset.campaignAtlasDelegationBound = "true";
    panel.addEventListener("click", async event => {
      if (!event.target.closest("#newCampaignAtlasBtn")) return;
      try {
        await openCampaignCreationWizard();
      } catch (error) {
        console.error("Could not open the existing campaign creation flow:", error);
        alert(`Campaign creation could not be opened. ${error?.message || "Please try again."}`);
      }
    });
  }
  renderCampaignAtlas();
}

async function renderCampaignAtlas() {
  const panel = document.querySelector("#world");

  if (!panel) {
    console.warn("Campaign Atlas panel not found.");
    return;
  }

  const campaigns =
    Array.isArray(window.dmState.campaigns)
      ? window.dmState.campaigns
      : [];

  const activeCampaign =
    window.dmState.current?.campaign || campaigns[0] || "";

  const currentWorld =
    window.dmState.current?.world || "";

  const currentRegion =
    window.dmState.current?.region || "";

  const currentLocation =
    window.dmState.current?.location || "";

    const currentSystem =
  getCurrentSystemId();

const currentSystemName =
  getGameSystemName(currentSystem);

  panel.innerHTML = `
    <div class="campaignAtlasShell">

      <section class="campaignAtlasHero infoCard">
        <div>
          <div class="entityProfileMeta">
            <span>Campaign Atlas</span>
          </div>

          <h1>${escapeHtml(activeCampaign || "Welcome, Game Master")}</h1>

          <p>
            ${
              activeCampaign
                ? `Current system:
<strong>${escapeHtml(currentSystemName)}</strong>
<br>
Current position:
<strong>${escapeHtml(currentWorld || "No world")}</strong>
→
<strong>${escapeHtml(currentRegion || "No region")}</strong>
→
<strong>${escapeHtml(currentLocation || "No location")}</strong>`
                : `Create your first campaign, choose where it begins, then build your
                  party, sessions, NPCs, creatures and encounters from there.`
            }
          </p>
        </div>

        <button id="newCampaignAtlasBtn" type="button">
          ${activeCampaign ? "+ New Campaign" : "+ Create First Campaign"}
        </button>
      </section>

      <section class="campaignAtlasGrid">

      <div class="infoCard">
  <h2>🗺 World Builder</h2>
  <p>Create worlds, regions and locations. Add location background images.</p>
  <button id="openWorldBuilderBtn" type="button">
    Manage World
  </button>
</div>

        <div class="infoCard">
          <h2>🧭 Campaign Position</h2>
          <p>Move the active campaign between worlds, planes, regions and locations.</p>
          <button id="openCampaignMoveBtn" type="button">
            Move Campaign
          </button>
        </div>

        <div class="infoCard">
          <h2>📅 Timeline</h2>
          <p>Track campaign time, calendars, moon phases, deadlines and progressions.</p>
          <button id="openCampaignTimelineBtn" type="button">
            Timeline
          </button>
        </div>

        <div class="infoCard">
  <h2>🎲 Game Systems</h2>
  <p>Manage rules systems used by campaigns, worlds, entities and content packs.</p>
  <button id="openGameSystemsBtn" type="button">
    Manage Systems
  </button>
</div>

        <div class="infoCard">
          <h2>🗺 Current Location</h2>
          <p>Open the current region and location overview.</p>
          <button id="openRegionFromAtlasBtn" type="button">
            Open Location
          </button>
        </div>

        <div class="infoCard">
          <h2>🎙 Session Prep</h2>
          <p>Prepare narration, goals, secrets, live notes and next hooks.</p>
          <button id="openSessionPrepFromAtlasBtn" type="button">
            Session Prep
          </button>
        </div>

        <div class="infoCard">
          <h2>👥 Party & PCs</h2>
          <p>Manage players, active characters, passive scores, HP and AC.</p>
          <button id="openPartyFromAtlasBtn" type="button">
            Party
          </button>
        </div>

        <div class="infoCard">
          <h2>🧍 NPCs & Relationships</h2>
          <p>Create NPCs, vendors, quest givers, factions and relationship links.</p>
          <button id="openNpcFromAtlasBtn" type="button">
            NPC Builder
          </button>
        </div>

        <div class="infoCard">
          <h2>🐲 Creatures</h2>
          <p>Create monsters, beasts, bosses and location-linked threats.</p>
          <button id="openCreaturesFromAtlasBtn" type="button">
            Creature Builder
          </button>
        </div>

        <div class="infoCard">
          <h2>⚔ Encounters</h2>
          <p>Build and run initiative, HP, conditions and creature turns.</p>
          <button id="openEncounterFromAtlasBtn" type="button">
            Build Encounter
          </button>
        </div>

      </section>

    </div>
  `;

  
  document.querySelector("#openWorldBuilderBtn").onclick = () => {
  openWorldBuilderPanel();
};

  document.querySelector("#openCampaignMoveBtn").onclick = () => {
    openCampaignMovePanel();
  };

  document.querySelector("#openCampaignTimelineBtn").onclick = () => {
    openCampaignTimelinePanel();
  };
  document.querySelector("#openGameSystemsBtn").onclick = () => {
  openGameSystemsPanel();
};

  document.querySelector("#openRegionFromAtlasBtn").onclick = () => {
    activateMainPanel(
      document.querySelector('.tab[data-tab="region"]'),
      document.querySelector("#region")
    );
  };

  document.querySelector("#openSessionPrepFromAtlasBtn").onclick = () => {
    activateMainPanel(
      document.querySelector('.tab[data-tab="session"]'),
      document.querySelector("#session")
    );
  };

  document.querySelector("#openPartyFromAtlasBtn").onclick = () => {
    activateMainPanel(
      document.querySelector('.tab[data-tab="party"]'),
      document.querySelector("#party")
    );
  };

  document.querySelector("#openNpcFromAtlasBtn").onclick = () => {
    activateMainPanel(
      document.querySelector('.tab[data-tab="npc"]'),
      document.querySelector("#npc")
    );
  };

  document.querySelector("#openCreaturesFromAtlasBtn").onclick = () => {
    activateMainPanel(
      document.querySelector('.tab[data-tab="creatures"]'),
      document.querySelector("#creatures")
    );
  };

  document.querySelector("#openEncounterFromAtlasBtn").onclick = async () => {
    const encounterTab =
      document.querySelector('.tab[data-tab="encounters"]') ||
      document.querySelector('.tab[data-tab="encounter"]');

    const encounterPanel =
      document.querySelector("#encounters") ||
      document.querySelector("#encounter");

    if (!encounterTab || !encounterPanel) {
      alert("Encounter Builder is coming next.");
      return;
    }

    activateMainPanel(encounterTab, encounterPanel);
    await renderPlannedEncounterWorkspace({ preserveSelection: true });
  };
}

async function openCampaignCreationWizard() {
  const panel = document.querySelector("#world");

  if (!panel) {
    console.warn("Campaign Atlas panel not found.");
    return;
  }

  const worlds = await window.dmAPI.listWorlds();

  const selectedWorld =
    window.dmState.current?.world ||
    worlds[0]?.id ||
    "";

  panel.innerHTML = `
    <div class="campaignAtlasShell">

      <section class="campaignAtlasHero infoCard">
        <div>
          <div class="entityProfileMeta">
            <span>Campaign Atlas</span>
          </div>

          <h1>Create New Campaign</h1>

          <p>
            Start with a campaign name, then choose where the adventure begins.
            You can move the campaign between worlds, planes, regions and locations later.
          </p>
        </div>

        <button id="cancelCampaignCreateBtn" type="button">
          Cancel
        </button>
      </section>

      <section class="infoCard campaignCreateCard">

        <div class="genericEntityFormGrid two">

          <div>
            <label>Campaign Name</label>
            <input
              id="campaignCreateNameInput"
              placeholder="The Broken Tide, Curse of..."
            >
          </div>

          <div>
            <label>Campaign ID</label>
            <input
              id="campaignCreateIdInput"
              placeholder="auto-created-from-name"
            >
          </div>
          <div>
  <label>Game System</label>
  <select id="campaignCreateSystemInput">
    ${renderGameSystemOptions(getCurrentSystemId())}
  </select>
</div>

          <div>
  <label>Starting World / Plane</label>

  <div class="inlineCreateRow">
    <select id="campaignCreateWorldInput">
      ${worlds.map(world => `
        <option
          value="${escapeHtml(world.id)}"
          ${world.id === selectedWorld ? "selected" : ""}
        >
          ${escapeHtml(world.name || world.id)}
        </option>
      `).join("")}
    </select>

    <button id="createWorldFromCampaignBtn" type="button">
      + New World
    </button>
  </div>
</div>

          <div>
  <label>Starting Region</label>

  <div class="inlineCreateRow">
    <select id="campaignCreateRegionInput">
      <option value="">Loading regions...</option>
    </select>

    <button id="createRegionFromCampaignBtn" type="button">
      + New Region
    </button>
  </div>
</div>

<div>
  <label>Starting Location</label>

  <div class="inlineCreateRow">
    <select id="campaignCreateLocationInput">
      <option value="">Loading locations...</option>
    </select>

    <button id="createLocationFromCampaignBtn" type="button">
      + New Location
    </button>
  </div>
</div>
          <div>
            <label>Campaign Tone / Notes</label>
            <textarea
              id="campaignCreateNotesInput"
              placeholder="Pulp jungle adventure, gothic horror, planar chaos..."
            ></textarea>
          </div>

        </div>

        <details class="relationshipAdvancedBox">
          <summary>Future timeline foundation</summary>

          <p>
            This campaign will be created with timeline and progression placeholders
            so we can later track calendars, moons, curses, faction clocks and deadlines.
          </p>
        </details>

        <div class="entityProfileActions">
          <button id="saveCampaignCreateBtn" type="button">
            💾 Create Campaign
          </button>
        </div>

      </section>

    </div>
  `;

  setupCampaignCreationWizardControls();

  await populateCampaignCreateRegions();
}

function setupCampaignCreationWizardControls() {
  const nameInput = document.querySelector("#campaignCreateNameInput");
  const idInput = document.querySelector("#campaignCreateIdInput");
  const createWorldBtn = document.querySelector("#createWorldFromCampaignBtn");
const createRegionBtn = document.querySelector("#createRegionFromCampaignBtn");
const createLocationBtn = document.querySelector("#createLocationFromCampaignBtn");
  const worldInput = document.querySelector("#campaignCreateWorldInput");
  const regionInput = document.querySelector("#campaignCreateRegionInput");
  const saveBtn = document.querySelector("#saveCampaignCreateBtn");
  const cancelBtn = document.querySelector("#cancelCampaignCreateBtn");

  if (nameInput && idInput) {
    nameInput.oninput = () => {
      if (!idInput.value.trim()) {
        idInput.value = window.dmStorage.slugify(nameInput.value || "");
      }
    };
  }

  if (worldInput) {
    worldInput.onchange = async () => {
      await populateCampaignCreateRegions();
    };
  }

  if (regionInput) {
  regionInput.onchange = async () => {
    await populateCampaignCreateLocations();
  };
}

  if (saveBtn) {
    saveBtn.onclick = saveCampaignFromWizard;
  }

  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      await renderCampaignAtlas();
    };
  }
  if (createWorldBtn) {
  createWorldBtn.onclick = createWorldFromCampaignWizard;
}

if (createRegionBtn) {
  createRegionBtn.onclick = createRegionFromCampaignWizard;
}

if (createLocationBtn) {
  createLocationBtn.onclick = createLocationFromCampaignWizard;
}
}

async function createWorldFromCampaignWizard() {
  const name = await askUser("New world / plane name?");

  if (!name) return;

  const id = window.dmStorage.slugify(name);

  const world = {
    id,
    name,
    type: "world",
    summary: "",
    defaultThemeId: themeSettings.manualTheme || "merchant-vessel",

    calendar: {
      id: `${id}-calendar`,
      name: `${name} Calendar`,
      daysPerWeek: 7,
      weekName: "Week",
      months: [],
      seasons: [],
      moons: []
    },

    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  await window.dmAPI.saveRecord(
    "worlds",
    id,
    world,
    "global"
  );

  const worldInput = document.querySelector("#campaignCreateWorldInput");

  const worlds = await window.dmAPI.listWorlds();

  worldInput.innerHTML = worlds.map(world => `
    <option value="${escapeHtml(world.id)}">
      ${escapeHtml(world.name || world.id)}
    </option>
  `).join("");

  worldInput.value = id;

  await populateCampaignCreateRegions();
}

async function createRegionFromCampaignWizard() {
  const worldInput = document.querySelector("#campaignCreateWorldInput");

  if (!worldInput?.value) {
    alert("Choose or create a world first.");
    return;
  }

  const name = await askUser("New region name?");

  if (!name) return;

  const id = window.dmStorage.slugify(name);
  const worldId = worldInput.value;

  const region = {
    id,
    name,
    worldId,
    parentWorldId: worldId,
    summary: "",
    environment: [],
    politics: [],
    culture: [],
    creatures: {
      common: [],
      dangerous: [],
      legendary: []
    },
    humanoids: [],
    factions: [],
    travelHazards: [],
    rumours: [],
    dmSecrets: [],
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  await window.dmAPI.saveRecord(
    "regions",
    id,
    region,
    worldId
  );

  await populateCampaignCreateRegions();

  const regionInput = document.querySelector("#campaignCreateRegionInput");

  if (regionInput) {
    regionInput.value = id;
  }

  await populateCampaignCreateLocations();
}

async function createLocationFromCampaignWizard() {
  const worldInput = document.querySelector("#campaignCreateWorldInput");
  const regionInput = document.querySelector("#campaignCreateRegionInput");

  if (!worldInput?.value) {
    alert("Choose or create a world first.");
    return;
  }

  if (!regionInput?.value) {
    alert("Choose or create a region first.");
    return;
  }

  const name = await askUser("New location name?");

  if (!name) return;

  const id = window.dmStorage.slugify(name);
  const worldId = worldInput.value;
  const regionId = regionInput.value;

  const location = {
    id,
    name,
    worldId,
    regionId,
    parentWorldId: worldId,
    parentRegionId: regionId,
    summary: "",
    environment: [],
    politics: [],
    culture: [],
    factions: [],
    dmTone: [],
    rumours: [],
    dmSecrets: [],
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  await window.dmAPI.saveRecord(
    "locations",
    id,
    location,
    regionId
  );

  await populateCampaignCreateLocations();

  const locationInput = document.querySelector("#campaignCreateLocationInput");

  if (locationInput) {
    locationInput.value = id;
  }
}

async function createdNpcsHtmlForContext(context = {}) {
  const npcs = await getNpcs();

  const npcPositions = await Promise.all(
    npcs.map(async npc => {
      const effectivePosition = await getNpcEffectivePosition(npc);

      return {
        npc,
        effectivePosition
      };
    })
  );

  const matchingNpcs = npcPositions.filter(item => {
    return placeMatchesContext(item.effectivePosition, context);
  });

  if (!matchingNpcs.length) {
    return `
      <h3>Created NPCs</h3>
      <p>No NPCs currently placed here.</p>
    `;
  }

  return `
    <h3>Created NPCs</h3>
    <ul class="regionCreatedCreatureList">
      ${matchingNpcs.map(({ npc, effectivePosition }) => `
        <li>
          <button
            class="regionNpcOpenBtn"
            type="button"
            data-npc-id="${escapeHtml(npc.id)}"
          >
            <strong>${escapeHtml(npc.name || "Unnamed NPC")}</strong>
            <span>
              ${escapeHtml(npc.role || npc.species || "NPC")}
              ${
                effectivePosition.mode === "entity"
                  ? `· aboard ${escapeHtml(effectivePosition.entityName || effectivePosition.entityId)}`
                  : ""
              }
            </span>
          </button>
        </li>
      `).join("")}
    </ul>
  `;
}

function idsMatch(a, b) {
  return String(a || "") === String(b || "");
}

function placeMatchesContext(position = {}, context = {}) {
  if (!idsMatch(position.locationId, context.locationId)) {
    return false;
  }

  // If both sides know the world, they must match.
  if (
    position.worldId &&
    context.worldId &&
    !idsMatch(position.worldId, context.worldId)
  ) {
    return false;
  }

  // If both sides know the region, they must match.
  if (
    position.regionId &&
    context.regionId &&
    !idsMatch(position.regionId, context.regionId)
  ) {
    return false;
  }

  return true;
}

function setupRegionNpcOpenButtons() {
  document.querySelectorAll(".regionNpcOpenBtn").forEach(button => {
    button.onclick = async () => {
      const npcId =
        button.dataset.npcId ||
        button.dataset.entityId ||
        button.dataset.id;

      await openNpcBuilderByAnyId(npcId);
    };
  });
}

function refreshCampaignListFromAtlasRecords() {
  const records = getCampaignAtlasRecords();

  const atlasCampaignIds = Object.keys(records);

  const existingCampaigns =
    Array.isArray(window.dmState.campaigns)
      ? window.dmState.campaigns
      : [];

  window.dmState.campaigns = [
    ...new Set([
      ...existingCampaigns,
      ...atlasCampaignIds
    ])
  ];
}

async function loadCampaignAtlasRecordsFromDatabase() {
  const campaigns = await window.dmAPI.getAllRecordsInCollection("campaigns");
  window.dmState.campaigns = [];
  for (const campaign of campaigns) {
    saveCampaignAtlasRecord({
      ...campaign,
      primaryWorldId: campaign.primaryWorldId || campaign.worldId || campaign.world || "",
      currentWorldId: campaign.currentWorldId || campaign.worldId || campaign.world || "",
      currentRegionId: campaign.currentRegionId || campaign.regionId || campaign.region || "",
      currentLocationId: campaign.currentLocationId || campaign.locationId || campaign.location || ""
    });
    window.dmState.campaigns.push(campaign.id);
  }
}

function ensureCurrentCampaignAtlasRecord() {
  const current = window.dmState.current;

  if (!current?.campaign) return;

  const existing = getCampaignAtlasRecord(current.campaign);

  if (existing) return;

  saveCampaignAtlasRecord({
  id: current.campaign,
  name: current.campaign,

  systemId: current.systemId || "system-neutral",

  primaryWorldId: current.world,

    currentWorldId: current.world,
    currentRegionId: current.region,
    currentLocationId: current.location,

    visitedWorldIds: current.world ? [current.world] : [],

    notes: "",

    timeline: {
      calendarId: "",
      currentDate: {
        year: 1,
        month: "",
        day: 1,
        hour: 8,
        minute: 0
      },
      elapsedDays: 0
    },

    progressions: [],

    created: new Date().toISOString(),
    updated: new Date().toISOString()
  });
}

function updateCurrentCampaignAtlasPosition() {
  const current = window.dmState.current;

  if (!current?.campaign) return;

  const existing =
    getCampaignAtlasRecord(current.campaign) || {
      id: current.campaign,
      name: current.campaign,
      primaryWorldId: current.world,
      visitedWorldIds: []
    };

  const visitedWorldIds = Array.isArray(existing.visitedWorldIds)
    ? existing.visitedWorldIds
    : [];

  if (current.world && !visitedWorldIds.includes(current.world)) {
    visitedWorldIds.push(current.world);
  }

  saveCampaignAtlasRecord({
    ...existing,

    currentWorldId: current.world,
    currentRegionId: current.region,
    currentLocationId: current.location,

    visitedWorldIds
  });
}

async function populateCampaignCreateRegions() {
  const worldInput = document.querySelector("#campaignCreateWorldInput");
  const regionInput = document.querySelector("#campaignCreateRegionInput");
  const locationInput = document.querySelector("#campaignCreateLocationInput");

  if (!worldInput || !regionInput || !locationInput) return;

  const worldId = worldInput.value;

  regionInput.innerHTML = `<option value="">Loading regions...</option>`;
  locationInput.innerHTML = `<option value="">Select a region first...</option>`;

  let regions = [];

  try {
    regions = worldId
      ? await window.dmAPI.listRegions(worldId)
      : [];
  } catch (error) {
    console.error("Could not load campaign creation regions:", error);
  }

  if (!regions.length) {
    regionInput.innerHTML = `<option value="">No regions found</option>`;
    locationInput.innerHTML = `<option value="">No locations found</option>`;
    return;
  }

  regionInput.innerHTML = regions.map(region => `
    <option value="${escapeHtml(region.id)}">
      ${escapeHtml(region.name || region.id)}
    </option>
  `).join("");

  const preferredRegion =
    regions.find(region => region.id === window.dmState.current?.region)?.id ||
    regions[0]?.id ||
    "";

  regionInput.value = preferredRegion;

  await populateCampaignCreateLocations();
}

async function populateCampaignCreateLocations() {
  const regionInput = document.querySelector("#campaignCreateRegionInput");
  const locationInput = document.querySelector("#campaignCreateLocationInput");

  if (!regionInput || !locationInput) return;

  const regionId = regionInput.value;

  locationInput.innerHTML = `<option value="">Loading locations...</option>`;

  let locations = [];

  try {
    locations = regionId
      ? await window.dmAPI.listLocations(regionId)
      : [];
  } catch (error) {
    console.error("Could not load campaign creation locations:", error);
  }

  if (!locations.length) {
    locationInput.innerHTML = `<option value="">No locations found</option>`;
    return;
  }

  locationInput.innerHTML = locations.map(location => `
    <option value="${escapeHtml(location.id)}">
      ${escapeHtml(location.name || location.id)}
    </option>
  `).join("");

  const preferredLocation =
    locations.find(location => location.id === window.dmState.current?.location)?.id ||
    locations[0]?.id ||
    "";

  locationInput.value = preferredLocation;
}

async function saveCampaignFromWizard() {
  const nameInput = document.querySelector("#campaignCreateNameInput");
  const idInput = document.querySelector("#campaignCreateIdInput");
  const worldInput = document.querySelector("#campaignCreateWorldInput");
  const regionInput = document.querySelector("#campaignCreateRegionInput");
  const locationInput = document.querySelector("#campaignCreateLocationInput");
  const notesInput = document.querySelector("#campaignCreateNotesInput");
  const systemInput = document.querySelector("#campaignCreateSystemInput");

  const name = nameInput?.value.trim() || "";
  const id =
    idInput?.value.trim() ||
    window.dmStorage.slugify(name || "new-campaign");

  const worldId = worldInput?.value || "";
  const regionId = regionInput?.value || "";
  const locationId = locationInput?.value || "";
  const systemId = systemInput?.value || "system-neutral";

  if (!name) {
    alert("Campaign name is required.");
    return;
  }

  if (!worldId || !regionId || !locationId) {
    alert("Choose a starting world, region and location.");
    return;
  }

  const campaignRecord = {
  id,
  name,

  systemId,

  primaryWorldId: worldId,

    currentWorldId: worldId,
    currentRegionId: regionId,
    currentLocationId: locationId,

    visitedWorldIds: [worldId],

    notes: notesInput?.value.trim() || "",

    timeline: {
      calendarId: "",
      currentDate: {
        year: 1,
        month: "",
        day: 1,
        hour: 8,
        minute: 0
      },
      elapsedDays: 0
    },

    progressions: [],

    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  saveCampaignAtlasRecord(campaignRecord);

  refreshCampaignListFromAtlasRecords();

  if (!Array.isArray(window.dmState.campaigns)) {
    window.dmState.campaigns = [];
  }

  if (!window.dmState.campaigns.includes(id)) {
    window.dmState.campaigns.push(id);
  }

window.dmState.current.campaign = id;
window.dmState.current.systemId = systemId;
window.dmState.current.world = worldId;
window.dmState.current.region = regionId;
window.dmState.current.location = locationId;

  saveUiState();

  await window.dmStorage.ensureCampaign(id);

  try {
    await syncCampaignPartyEntity(id);
  } catch (error) {
    console.warn("Could not sync the new campaign party:", error);
  }

  if (window.dmAPI.saveRecord) {
    await window.dmAPI.saveRecord(
      "campaigns",
      id,
      campaignRecord,
      id
    );
  }

  await setupStateBar();
  await renderCampaignAtlas();

  try {
    await refreshScriptList();
    await renderParty();
    await updatePartySummaryFromActiveCharacters();
    await renderRegionInfo();
    await applyCurrentTheme();
  } catch (error) {
    console.warn("Campaign created, but one refresh step failed:", error);
  }

  alert(`Campaign created: ${name}`);
}
function getCampaignAtlasRecords() {
  try {
    return JSON.parse(localStorage.getItem("masterForgeCampaignAtlasRecords")) || {};
  } catch (error) {
    console.warn("Could not read Campaign Atlas records:", error);
    return {};
  }
}

function saveCampaignAtlasRecord(record) {
  const records = getCampaignAtlasRecords();

  records[record.id] = {
    ...(records[record.id] || {}),
    ...record,
    updated: new Date().toISOString()
  };

  localStorage.setItem(
    "masterForgeCampaignAtlasRecords",
    JSON.stringify(records)
  );
}

function getCampaignAtlasRecord(campaignId) {
  const records = getCampaignAtlasRecords();
  return records[campaignId] || null;
}

function applyCampaignAtlasRecordToState(campaignId) {
  const record = getCampaignAtlasRecord(campaignId);

  if (!record) {
    console.warn("No Campaign Atlas record found for:", campaignId);
    return false;
  }

  window.dmState.current.campaign = record.id;

window.dmState.current.systemId =
  record.systemId ||
  window.dmState.current.systemId ||
  "system-neutral";

window.dmState.current.world =
  record.currentWorldId || record.primaryWorldId || window.dmState.current.world;

  window.dmState.current.region =
    record.currentRegionId || window.dmState.current.region;

  window.dmState.current.location =
    record.currentLocationId || window.dmState.current.location;

  saveUiState();

  return true;
}

function openGameSystemsPanel() {
  const panel = document.querySelector("#world");

  if (!panel) {
    console.warn("Campaign Atlas panel not found.");
    return;
  }

  const systems = getGameSystems();

  panel.innerHTML = `
    <div class="campaignAtlasShell">

      <section class="campaignAtlasHero infoCard">
        <div>
          <div class="entityProfileMeta">
            <span>Campaign Atlas</span>
          </div>

          <h1>Game Systems</h1>

          <p>
            Manage the rules systems used by campaigns, worlds and entities.
            Entity filtering uses these system IDs to stop D&D, Star Trek,
            Daggerheart and other settings becoming one giant mixed list.
          </p>
        </div>

        <button id="backToCampaignAtlasFromSystemsBtn" type="button">
          Back to Campaign Atlas
        </button>
      </section>

      <section class="infoCard campaignCreateCard">
        <h2>Add Game System</h2>

        <div class="genericEntityFormGrid two">
          <div>
            <label>System Name</label>
            <input
              id="gameSystemNameInput"
              placeholder="Cyberpunk RED, Traveller, Homebrew..."
            >
          </div>

          <div>
            <label>System ID</label>
            <input
              id="gameSystemIdInput"
              placeholder="auto-created-from-name"
            >
          </div>

          <div>
            <label>Description</label>
            <textarea
              id="gameSystemDescriptionInput"
              placeholder="Short note about what this system is for..."
            ></textarea>
          </div>
        </div>

        <div class="entityProfileActions">
          <button id="saveGameSystemBtn" type="button">
            💾 Add System
          </button>
        </div>
      </section>

      <section class="infoCard">
        <h2>Installed / Available Systems</h2>

        <div id="gameSystemsList" class="gameSystemsList">
          ${renderGameSystemsListHtml(systems)}
        </div>
      </section>

    </div>
  `;

  setupGameSystemsPanelControls();
}

function renderGameSystemsListHtml(systems = getGameSystems()) {
  if (!systems.length) {
    return `<p>No game systems found.</p>`;
  }

  return systems.map(system => `
    <div class="gameSystemCard">
      <div>
        <h3>${escapeHtml(system.name || system.id)}</h3>
        <p>${escapeHtml(system.description || "No description recorded.")}</p>
        <code>${escapeHtml(system.id)}</code>
      </div>

      <div class="gameSystemCardActions">
        <button
          class="setCampaignSystemBtn"
          type="button"
          data-system-id="${escapeHtml(system.id)}"
        >
          Use for Current Campaign
        </button>

        <button
          class="archiveGameSystemBtn"
          type="button"
          data-system-id="${escapeHtml(system.id)}"
          ${system.id === "system-neutral" ? "disabled" : ""}
        >
          ${system.archived ? "Unarchive" : "Archive"}
        </button>
      </div>
    </div>
  `).join("");
}

function setupGameSystemsPanelControls() {
  const backBtn = document.querySelector("#backToCampaignAtlasFromSystemsBtn");
  const nameInput = document.querySelector("#gameSystemNameInput");
  const idInput = document.querySelector("#gameSystemIdInput");
  const descriptionInput = document.querySelector("#gameSystemDescriptionInput");
  const saveBtn = document.querySelector("#saveGameSystemBtn");

  if (backBtn) {
    backBtn.onclick = renderCampaignAtlas;
  }

  if (nameInput && idInput) {
    nameInput.oninput = () => {
      if (!idInput.value.trim()) {
        idInput.value = window.dmStorage.slugify(nameInput.value || "");
      }
    };
  }

  if (saveBtn) {
    saveBtn.onclick = () => {
      const name = nameInput?.value.trim() || "";
      const id =
        idInput?.value.trim() ||
        window.dmStorage.slugify(name || "new-system");

      const description =
        descriptionInput?.value.trim() || "";

      if (!name) {
        alert("System name is required.");
        return;
      }

      const systems = getGameSystems();

      if (systems.some(system => system.id === id)) {
        alert("A system with that ID already exists.");
        return;
      }

      systems.push({
        id,
        name,
        description,
        archived: false,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      });

      saveGameSystems(systems);

      openGameSystemsPanel();
    };
  }

  document.querySelectorAll(".setCampaignSystemBtn").forEach(button => {
    button.onclick = () => {
      const systemId = button.dataset.systemId;
      const currentCampaignId = window.dmState.current?.campaign;

      if (!currentCampaignId) {
        alert("No active campaign selected.");
        return;
      }

      const record =
        getCampaignAtlasRecord(currentCampaignId) || {
          id: currentCampaignId,
          name: currentCampaignId
        };

      saveCampaignAtlasRecord({
        ...record,
        systemId
      });

      window.dmState.current.systemId = systemId;
      saveUiState();

      alert(`Current campaign system set to: ${getGameSystemName(systemId)}`);

      openGameSystemsPanel();
    };
  });

  document.querySelectorAll(".archiveGameSystemBtn").forEach(button => {
    button.onclick = () => {
      const systemId = button.dataset.systemId;

      const systems = getGameSystems().map(system => {
        if (system.id !== systemId) return system;

        return {
          ...system,
          archived: !system.archived,
          updated: new Date().toISOString()
        };
      });

      saveGameSystems(systems);

      openGameSystemsPanel();
    };
  });
}

function openCampaignMovePanel() {
  alert("Campaign travel / move panel coming next.");
}

function openCampaignTimelinePanel() {
  alert("Campaign timeline and progression tracker coming next.");
}

async function addWorldNote() {

  const title = await askUser("World note title?");

  if (!title) return;

  const notes = await window.dmStorage.getWorldNotes();

  notes.push({
    id: "world-" + Date.now(),
    title,
    type: document.querySelector("#worldNoteType").value,
    world: window.dmState.current.world,
    location: window.dmState.current.location,
    region: window.dmState.current.region,
    content: "",
    secrets: "",
    created: new Date().toISOString()
  });

  await window.dmStorage.saveWorldNotes(notes);

  await renderWorldNotes();

}

async function renderWorldNotes() {

  const allNotes = await window.dmStorage.getWorldNotes();

  const selectedType = document.querySelector("#worldNoteType").value;

  const notes = selectedType
    ? allNotes.filter(note => note.type === selectedType)
    : allNotes;

  const box = document.querySelector("#worldNotesList");

  if (!notes.length) {
    box.innerHTML = "<p>No world notes yet.</p>";
    return;
  }

  box.innerHTML = notes.map(note => `
    <div class="characterMiniCard">
      <h3>${note.type}: ${note.title}</h3>
      <p>${note.region}, ${note.location}</p>
      <p>${note.content || "No information added yet."}</p>
      <button class="editWorldNoteBtn" data-id="${note.id}">Edit</button>
      <button class="deleteWorldNoteBtn" data-id="${note.id}">Delete</button>
    </div>
  `).join("");

  document.querySelectorAll(".editWorldNoteBtn").forEach(btn => {
    btn.onclick = async () => {
      openWorldNoteEditor(btn.dataset.id);
    };
  });

  document.querySelectorAll(".deleteWorldNoteBtn").forEach(btn => {
    btn.onclick = async () => {
      const confirmed = confirm("Delete this world note?");
      if (!confirmed) return;
      await window.dmStorage.deleteDbRecord(btn.dataset.id);
      await renderWorldNotes();
    };
  });

}

async function openWorldNoteEditor(id) {

  const notes = await window.dmStorage.getWorldNotes();

  const note = notes.find(n => n.id === id);

  if (!note) return;

  document.querySelector("#worldNoteId").value = note.id;
  document.querySelector("#worldNoteTitle").innerText = note.title;
  document.querySelector("#worldNoteContent").value = note.content || "";
  document.querySelector("#worldNoteSecrets").value = note.secrets || "";

  document.querySelector("#worldNoteModal").classList.remove("hidden");

}

async function saveWorldNoteEdit() {

  const notes = await window.dmStorage.getWorldNotes();

  const id = document.querySelector("#worldNoteId").value;

  const note = notes.find(n => n.id === id);

  if (!note) return;

  note.content = document.querySelector("#worldNoteContent").value;
  note.secrets = document.querySelector("#worldNoteSecrets").value;

  await window.dmStorage.saveWorldNotes(notes);

  document.querySelector("#worldNoteModal").classList.add("hidden");

  renderWorldNotes();

}
// =====================================================
// MasterForge Studio v0.3.0-alpha
// Entities / Relationship Map
// =====================================================
// =====================================================
// Entity Context / Visibility Helpers
// =====================================================
// =====================================================
// Game System Registry
// =====================================================
function isPlaceEntityType(type = "") {
  return ["location", "settlement"].includes(String(type).toLowerCase());
}

function updateGenericEntityLocationFieldVisibility() {
  const typeInput = document.querySelector("#genericEntityTypeInput");

  if (!typeInput) return;

  const type = typeInput.value;
  const isPlace = isPlaceEntityType(type);

  const defaultRegionLabel = document.querySelector("#genericEntityDefaultRegionLabel");
  const currentRegionLabel = document.querySelector("#genericEntityCurrentRegionLabel");

  const defaultLocationBlock = document.querySelector(".genericEntityDefaultLocationField");
  const currentLocationBlock = document.querySelector(".genericEntityCurrentLocationField");

  const defaultLocationInput = document.querySelector("#genericEntityLocationInput");
  const currentLocationInput = document.querySelector("#genericEntityCurrentLocationInput");

  if (defaultRegionLabel) {
    defaultRegionLabel.innerText = isPlace ? "Parent Region" : "Default Region";
  }

  if (currentRegionLabel) {
    currentRegionLabel.innerText = isPlace ? "Current / Parent Region" : "Current Region";
  }

  if (defaultLocationBlock) {
    defaultLocationBlock.classList.toggle("hidden", isPlace);
  }

  if (currentLocationBlock) {
    currentLocationBlock.classList.toggle("hidden", isPlace);
  }

  if (isPlace) {
    if (defaultLocationInput) {
      defaultLocationInput.innerHTML = `<option value="">Not required for place entities</option>`;
      defaultLocationInput.value = "";
    }

    if (currentLocationInput) {
      currentLocationInput.innerHTML = `<option value="">Not required for place entities</option>`;
      currentLocationInput.value = "";
    }
  }
}

const defaultGameSystems = [
  {
    id: "system-neutral",
    name: "System Neutral / Generic GM",
    description: "For campaigns, worlds and entities that are not tied to one rules system.",
    archived: false
  },
  {
    id: "dnd-5e",
    name: "D&D 5e",
    description: "Fantasy d20 campaign support.",
    archived: false
  },
  {
    id: "star-trek",
    name: "Star Trek",
    description: "Science-fiction Starfleet and Federation campaign support.",
    archived: false
  },
  {
    id: "daggerheart",
    name: "Daggerheart",
    description: "Fantasy adventure campaign support.",
    archived: false
  },
  {
    id: "pathfinder",
    name: "Pathfinder",
    description: "Pathfinder campaign support.",
    archived: false
  },
  {
    id: "custom",
    name: "Custom System",
    description: "A custom or homebrew rules system.",
    archived: false
  }
];

function getGameSystems() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("masterForgeGameSystems")
    );

    if (Array.isArray(saved) && saved.length) {
      return saved;
    }
  } catch (error) {
    console.warn("Could not read saved game systems:", error);
  }

  localStorage.setItem(
    "masterForgeGameSystems",
    JSON.stringify(defaultGameSystems)
  );

  return defaultGameSystems;
}

function saveGameSystems(systems) {
  localStorage.setItem(
    "masterForgeGameSystems",
    JSON.stringify(systems)
  );
}

function getGameSystemName(systemId = "system-neutral") {
  const systems = getGameSystems();

  return (
    systems.find(system => system.id === systemId)?.name ||
    systemId ||
    "System Neutral"
  );
}

function renderGameSystemOptions(selectedId = "system-neutral") {
  const systems = getGameSystems()
    .filter(system => !system.archived);

  return systems.map(system => `
    <option
      value="${escapeHtml(system.id)}"
      ${system.id === selectedId ? "selected" : ""}
    >
      ${escapeHtml(system.name)}
    </option>
  `).join("");
}

function getCurrentSystemId() {
  const currentCampaignId =
    window.dmState.current?.campaign || "";

  const campaignRecord =
    getCampaignAtlasRecord(currentCampaignId);

  return (
    campaignRecord?.systemId ||
    window.dmState.current?.systemId ||
    "system-neutral"
  );
}

function getRecordSystemId(record = {}) {
  return (
    record.systemId ||
    record.data_json?.systemId ||
    record.scope?.systemId ||
    record.campaignSystemId ||
    "system-neutral"
  );
}

function getRecordWorldId(record = {}) {
  return (
    record.world ||
    record.worldId ||
    record.scope?.worldId ||
    record.data_json?.world ||
    record.data_json?.worldId ||
    record.data_json?.scope?.worldId ||
    ""
  );
}

function getRecordRegionId(record = {}) {
  return (
    record.region ||
    record.regionId ||
    record.scope?.regionId ||
    record.data_json?.region ||
    record.data_json?.regionId ||
    record.data_json?.scope?.regionId ||
    ""
  );
}

function getRecordLocationId(record = {}) {
  return (
    record.locationId ||
    record.location ||
    record.currentLocationId ||
    record.scope?.locationId ||
    record.currentPosition?.locationId ||
    record.locationState?.locationId ||
    record.data_json?.locationId ||
    record.data_json?.location ||
    record.data_json?.currentLocationId ||
    record.data_json?.scope?.locationId ||
    record.data_json?.currentPosition?.locationId ||
    ""
  );
}

function getRecordCampaignId(record = {}) {
  return record.campaignId || record.campaign || record.scope?.campaignId ||
    record.data_json?.campaignId || record.data_json?.campaign ||
    record.data_json?.scope?.campaignId || "";
}

function recordMatchesLibraryScope(record = {}, scopeFilter = "current-system") {
  const current = window.dmState.current || {};

  const recordSystem = getRecordSystemId(record);
  const recordWorld = getRecordWorldId(record);
  const recordRegion = getRecordRegionId(record);
  const recordLocation = getRecordLocationId(record);

  if (scopeFilter === "all") return true;

  if (scopeFilter === "current-location") {
    return recordLocation === current.location;
  }

  if (scopeFilter === "current-region") {
    return recordRegion === current.region;
  }

  if (scopeFilter === "current-world") {
    return recordWorld === current.world || !recordWorld;
  }

  if (scopeFilter === "current-campaign") {
    return getRecordCampaignId(record) === current.campaign;
  }

  if (scopeFilter === "current-system") {
    return recordSystem === getCurrentSystemId() || recordSystem === "system-neutral";
  }

  return true;
}

function renderLibraryScopeOptions(selected = "current-system") {
  const options = [
    ["current-system", "Current System"],
    ["current-campaign", "Current Campaign"],
    ["current-world", "Current World"],
    ["current-region", "Current Region"],
    ["current-location", "Current Location"],
    ["all", "All"]
  ];

  return options.map(([value, label]) => `
    <option value="${value}" ${selected === value ? "selected" : ""}>
      ${label}
    </option>
  `).join("");
}

function getDefaultVisibility() {
  return {
    hidden: false,
    archived: false,
    pinned: false,
    gmOnly: true
  };
}

function normaliseVisibility(value = {}) {
  return {
    ...getDefaultVisibility(),
    ...(value || {})
  };
}

function getCurrentScope() {
  return {
    campaignId: window.dmState.current?.campaign || "",
    worldId: window.dmState.current?.world || "",
    regionId: window.dmState.current?.region || "",
    locationId: window.dmState.current?.location || ""
  };
}

function getCurrentPositionFromState(notes = "") {
  return {
    mode: "location",
    worldId: window.dmState.current?.world || "",
    regionId: window.dmState.current?.region || "",
    locationId: window.dmState.current?.location || "",
    entityType: "",
    entityId: "",
    notes
  };
}

function normaliseEntityContext(record = {}) {
  const data =
    record.data_json ||
    record.data ||
    record;

  const scope = {
    campaignId:
      data.scope?.campaignId ||
      data.campaignId ||
      data.campaign ||
      "",

    worldId:
      data.scope?.worldId ||
      data.worldId ||
      data.world ||
      "",

    regionId:
      data.scope?.regionId ||
      data.regionId ||
      data.region ||
      "",

    locationId:
      data.scope?.locationId ||
      data.locationId ||
      data.location ||
      ""
  };

  const currentPosition = {
    mode:
      data.currentPosition?.mode ||
      data.locationState?.mode ||
      "location",

    worldId:
      data.currentPosition?.worldId ||
      data.locationState?.worldId ||
      scope.worldId,

    regionId:
      data.currentPosition?.regionId ||
      data.locationState?.regionId ||
      scope.regionId,

    locationId:
      data.currentPosition?.locationId ||
      data.locationState?.locationId ||
      scope.locationId,

    entityType:
      data.currentPosition?.entityType ||
      data.locationState?.entityType ||
      "",

    entityId:
      data.currentPosition?.entityId ||
      data.locationState?.entityId ||
      "",

    notes:
      data.currentPosition?.notes ||
      data.locationState?.notes ||
      data.currentLocation ||
      ""
  };

  return {
    systemId:
      data.systemId ||
      record.systemId ||
      "system-neutral",

    scope,

    currentPosition,

    visibility: normaliseVisibility(
      data.visibility ||
      record.visibility ||
      {}
    )
  };
}


let entityIndexCache = [];
let entityIndexRenderSequence = 0;
let activeEntitySearchTerm = "";
let activeEntityTypeFilter = "all";
let activeEntityScopeFilter = "current-world";
let activeEntityVisibilityFilter = "active";
const ENTITY_LIBRARY_TYPE_FILTER_OPTIONS = Object.freeze([
  ["all", "All"], ["npc", "NPCs"], ["pc", "PCs"], ["creature", "Creatures"],
  ["faction", "Factions"], ["vehicle", "Vehicles"], ["location", "Locations"],
  ["item", "Items"], ["quest", "Quests"], ["party", "Parties"], ["party_group", "Party Groups"]
]);
let activeDmEntityWorkspaceTab = "overview";
let pendingDmWorkspaceReturn = null;
let activeRelationshipTreeMode = "command";
let activeRelationshipTreeScope = "focused";
let relationshipTreeFocusMode = false;
let relationshipTreeFocusScrollState = {
  top: 0,
  left: 0
};
const WORLD_ENTITY_LIBRARY_TYPES = Object.freeze([
  "vehicle", "ship", "faction", "npc", "pc", "location", "settlement",
  "item", "quest", "event", "creature", "party", "party_group"
]);
const UNIVERSAL_RELATIONSHIP_ENTITY_TYPES = [
  "npc",
  "creature",
  "faction",
  "organisation",
  "vehicle",
  "location",
  "settlement",
  "item",
  "quest",
  "event",
  "party",
  "party_group"
];

function getEntityLibraryBrowseLabel(options, value, fallback = value) {
  return options.find(([optionValue]) => optionValue === value)?.[1] || fallback;
}

function syncEntityLibraryBrowseControls() {
  const search = document.getElementById("entitySearchInput");
  const type = document.getElementById("entityTypeFilterInput");
  const scope = document.getElementById("entityScopeFilterInput");
  const visibility = document.getElementById("entityVisibilityFilterInput");
  if (search && search.value !== activeEntitySearchTerm) search.value = activeEntitySearchTerm;
  if (type) type.value = activeEntityTypeFilter;
  if (scope) scope.value = activeEntityScopeFilter;
  if (visibility) visibility.value = activeEntityVisibilityFilter;
}

function updateEntityLibraryBrowseSummary() {
  const summary = document.getElementById("entityLibraryActiveFilters");
  const clearButton = document.getElementById("entityClearFiltersBtn");
  const typeLabel = getEntityLibraryBrowseLabel(ENTITY_LIBRARY_TYPE_FILTER_OPTIONS, activeEntityTypeFilter, "All");
  const scopeLabel = { "current-location": "Current Location", "current-world": "Current World", "current-system": "Current System", all: "All Scopes" }[activeEntityScopeFilter] || activeEntityScopeFilter;
  const visibilityLabel = { active: "Active Only", pinned: "Pinned", hidden: "Hidden", archived: "Archived", all: "All Visibility" }[activeEntityVisibilityFilter] || activeEntityVisibilityFilter;
  if (summary) summary.innerHTML = `<strong>Showing:</strong> ${escapeHtml(typeLabel)} · ${escapeHtml(scopeLabel)} · ${escapeHtml(visibilityLabel)}${activeEntitySearchTerm.trim() ? `<small>Search: ${escapeHtml(activeEntitySearchTerm.trim())}</small>` : ""}`;
  const differs = Boolean(activeEntitySearchTerm.trim()) || activeEntityTypeFilter !== "all" || activeEntityScopeFilter !== "current-world" || activeEntityVisibilityFilter !== "active";
  if (clearButton) clearButton.hidden = !differs;
  syncEntityLibraryBrowseControls();
}

function clearEntityLibraryBrowseFilters() {
  activeEntitySearchTerm = "";
  activeEntityTypeFilter = "all";
  activeEntityScopeFilter = "current-world";
  activeEntityVisibilityFilter = "active";
  syncEntityLibraryBrowseControls();
  renderEntityIndexResults();
}
const universalRelationshipBuilderState = {
  mode: "new",
  status: "new",
  relationshipId: null,
  originalRelationship: null,
  sourceEntity: null,
  error: "",
  successMessage: ""
};

function isSafeCampaignPartyId(campaignId = "") {
  const value = String(campaignId || "").trim();
  return (
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !/[\u0000-\u001f]/.test(value)
  );
}

async function syncCharacterEntity(
  characterId,
  characterRecord = null
) {
  const normalizedCharacterId = String(characterId || "").trim();
  let character = characterRecord;

  if (!character) {
    const characters = await window.dmStorage.getCharacters();
    character = characters.find(item => item.id === normalizedCharacterId);
  }

  if (!character?.id || !character?.name) {
    throw new Error(`Character record not found: ${normalizedCharacterId}`);
  }

  const existing = await window.dmAPI.getEntity("pc", character.id);
  const existingData = existing?.data_json || {};
  const entity = {
    ...(existing || {}),
    id: character.id,
    entity_type: "pc",
    name: character.name,
    description: existing?.description || "",
    data_json: {
      ...existingData,
      source: "party-character",
      characterId: character.id,
      playerId: character.playerId || "",
      character: {
        species: character.species || "",
        class: character.class || "",
        subclass: character.subclass || "",
        level: Number(character.level || 1),
        status: character.status || "",
        ac: Number(character.ac || 0),
        maxHP: Number(character.maxHP || 0),
        currentHP: Number(character.currentHP || 0)
      }
    }
  };

  if (existing) {
    return window.dmAPI.updateEntity("pc", character.id, entity);
  }

  return window.dmAPI.createEntity(entity);
}

async function reconcileManagedPartyMemberships(
  campaignId,
  partyEntity,
  partyRecord
) {
  const engine = window.MasterForgeRelationshipEngine;
  const activeCharacterIds = new Set(
    (Array.isArray(partyRecord?.characters)
      ? partyRecord.characters
      : []
    ).map(value => String(value || "").trim()).filter(Boolean)
  );
  const characters = await window.dmStorage.getCharacters();
  const charactersById = new Map(
    characters.map(character => [String(character.id), character])
  );
  const existingRelationships = (
    await engine.getRelationshipsForEntity(
      "party",
      partyEntity.id
    )
  ).map(value => engine.normaliseRelationshipRecord(value));

  for (const characterId of activeCharacterIds) {
    const character = charactersById.get(characterId);

    if (!character) {
      console.warn(
        "Party membership references an unresolved character:",
        campaignId,
        characterId
      );
      continue;
    }

    try {
      await syncCharacterEntity(characterId, character);

      const alreadyLinked = existingRelationships.some(relationship => {
        return (
          relationship.relationshipType === "member_of_party" &&
          relationship.sourceEntityType === "pc" &&
          relationship.sourceEntityId === characterId &&
          relationship.targetEntityType === "party" &&
          relationship.targetEntityId === partyEntity.id
        );
      });

      if (!alreadyLinked) {
        const relationshipId = window.dmStorage.slugify([
          "party-manager",
          campaignId,
          characterId,
          "member-of-party",
          partyEntity.id
        ].join("-"));

        await engine.createRelationship({
          id: relationshipId,
          sourceEntityType: "pc",
          sourceEntityId: characterId,
          relationshipType: "member_of_party",
          targetEntityType: "party",
          targetEntityId: partyEntity.id,
          metadata: {
            source: "party-manager",
            campaignId,
            managed: true
          }
        });
      }
    } catch (error) {
      console.warn(
        "Could not reconcile party member:",
        campaignId,
        characterId,
        error
      );
    }
  }

  for (const relationship of existingRelationships) {
    const metadata = relationship.data_json || {};
    const isStaleManagedMembership =
      relationship.relationshipType === "member_of_party" &&
      relationship.sourceEntityType === "pc" &&
      relationship.targetEntityType === "party" &&
      relationship.targetEntityId === partyEntity.id &&
      metadata.source === "party-manager" &&
      metadata.managed === true &&
      !activeCharacterIds.has(relationship.sourceEntityId);

    if (isStaleManagedMembership) {
      try {
        await engine.deleteRelationship(relationship.id);
      } catch (error) {
        console.warn(
          "Could not remove stale managed party membership:",
          relationship.id,
          error
        );
      }
    }
  }
}

async function syncCampaignPartyEntity(
  campaignId,
  {
    campaignRecord = null,
    partyRecord = null
  } = {}
) {
  const normalizedCampaignId = String(campaignId || "").trim();
  if (!isSafeCampaignPartyId(normalizedCampaignId)) {
    throw new Error("A safe campaign ID is required to sync its party entity.");
  }

  const campaign = campaignRecord ||
    getCampaignAtlasRecord(normalizedCampaignId) ||
    await window.dmAPI.readJson(
      `campaigns/${normalizedCampaignId}/campaign.json`,
      null
    ) ||
    {};
  const party = partyRecord ||
    await window.dmAPI.readJson(
      `campaigns/${normalizedCampaignId}/party.json`,
      { characters: [] }
    ) ||
    {};
  const characterIds = Array.isArray(party.characters)
    ? [...party.characters]
    : [];
  const partyEntityId =
    `${window.dmStorage.slugify(normalizedCampaignId)}-party`;
  const generatedName =
    `${campaign.name || normalizedCampaignId} Party`;
  const existing = await window.dmAPI.getEntity(
    "party",
    partyEntityId
  );
  const existingData = existing?.data_json || {};
  const entity = {
    ...(existing || {}),
    id: partyEntityId,
    entity_type: "party",
    name: existing?.name || generatedName,
    description: existing?.description || "",
    data_json: {
      ...existingData,
      source: "campaign-party",
      campaignId: normalizedCampaignId,
      characterIds
    }
  };

  let savedEntity;

  if (existing) {
    savedEntity = await window.dmAPI.updateEntity(
      "party",
      partyEntityId,
      entity
    );
  } else {
    savedEntity = await window.dmAPI.createEntity(entity);
  }

  await reconcileManagedPartyMemberships(
    normalizedCampaignId,
    savedEntity,
    party
  );

  return savedEntity;
}

async function migrateCampaignPartyEntities() {
  if (typeof window.dmAPI?.listCampaignPartyRecords !== "function") {
    console.warn("Campaign party migration API is unavailable.");
    return;
  }

  let result;
  try {
    result = await window.dmAPI.listCampaignPartyRecords();
  } catch (error) {
    console.warn("Campaign party migration could not start:", error);
    return;
  }

  if (!result?.success) {
    console.warn(
      "Campaign party migration could not list records:",
      result?.error || "Unknown error"
    );
    return;
  }

  for (const record of result.campaigns || []) {
    try {
      await syncCampaignPartyEntity(record.campaignId, {
        campaignRecord: record.campaign,
        partyRecord: record.party
      });
    } catch (error) {
      console.warn(
        "Could not migrate campaign party:",
        record?.campaignId,
        error
      );
    }
  }
}

async function saveCampaignPartyAndSync(party) {
  await window.dmStorage.saveCampaignParty(party);
  await syncCampaignPartyEntity(
    window.dmState.current.campaign,
    { partyRecord: party }
  );
}

function captureRelationshipTreeScroll() {
  const treeBody = document.querySelector(
    "#entityRelationshipTreePanel .entityTreeBody"
  );

  if (!treeBody) return;

  relationshipTreeFocusScrollState = {
    top: treeBody.scrollTop,
    left: treeBody.scrollLeft
  };
}

function restoreRelationshipTreeScroll() {
  const scrollState = { ...relationshipTreeFocusScrollState };

  requestAnimationFrame(() => {
    const treeBody = document.querySelector(
      "#entityRelationshipTreePanel .entityTreeBody"
    );

    if (!treeBody) return;

    treeBody.scrollTop = scrollState.top;
    treeBody.scrollLeft = scrollState.left;
  });
}

function setRelationshipTreeFocusMode(focused) {
  const nextFocusMode = !!focused;
  const focusModeChanged =
    relationshipTreeFocusMode !== nextFocusMode;

  if (focusModeChanged) {
    captureRelationshipTreeScroll();
  }

  relationshipTreeFocusMode = nextFocusMode;
  document.body.classList.toggle(
    "relationship-tree-focus-mode",
    relationshipTreeFocusMode
  );

  const focusButton = document.getElementById(
    "relationshipTreeFocusBtn"
  );

  if (focusButton) {
    focusButton.textContent = relationshipTreeFocusMode
      ? "Return to Entity View"
      : "Pop Out Tree";
    focusButton.classList.toggle(
      "active",
      relationshipTreeFocusMode
    );
  }

  if (focusModeChanged) {
    restoreRelationshipTreeScroll();
  }
}

function exitRelationshipTreeFocusMode() {
  setRelationshipTreeFocusMode(false);
}

document.addEventListener(
  "keydown",
  event => {
    if (event.key !== "Escape" || !relationshipTreeFocusMode) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    exitRelationshipTreeFocusMode();
  },
  true
);

let entityBuilderState = {
  activeEntityId: null,
  activeEntityType: "faction",
  activeEntity: null,

  originalEntityId: null,
  originalEntityType: null,
  factionWorkspaceTab: "overview",
  factionHierarchy: null,
  factionHierarchyFocusNodeId: null,
  factionHierarchyEditorDraft: null,
  factionHierarchyEditorNodeId: null,
  factionHierarchyEditorError: "",
  factionHierarchyEditorReturnNodeId: null,
  factionHierarchyEditorShouldFocus: false,
  factionHierarchyEditorDirty: false,
  factionHierarchyDirty: false,
  factionHierarchyBaseline: null,
  factionTraits: [],
  factionAbilityPackIds: [],
  abilityPackWorkspaceTab: "overview",
  abilityPackData: null
};

const FACTION_MEMBERSHIP_TYPES = new Set([
  "member_of",
  "secretly_member_of"
]);

function getFactionMetadataRegistry() {
  return window.MasterForgeRelationshipMetadata;
}

function getFactionHierarchyApi() {
  const api = window.MasterForgeFactionHierarchy;
  if (!api) throw new Error("Faction hierarchy helpers are unavailable.");
  return api;
}

function getAbilityPackApi() {
  const api = window.MasterForgeAbilityPacks;
  if (!api) throw new Error("Ability Pack helpers are unavailable.");
  return api;
}

async function getAllAbilityPacks() {
  try {
    return (await window.dmAPI.getEntitiesByType("ability_pack")) || [];
  } catch (error) {
    console.warn("Could not load Ability Packs:", error);
    return [];
  }
}

function getFactionHierarchyNodeById(faction, nodeId) {
  return getFactionHierarchyApi()
    .normaliseFactionHierarchy(faction?.data_json || faction || {})
    .nodes.find(node => node.id === nodeId) || null;
}

async function getFactionMembershipRelationships(factionId) {
  if (!factionId) return [];
  const engine = window.MasterForgeRelationshipEngine;
  const relationships = await engine.getRelationshipsForEntity("faction", factionId);
  return relationships.filter(relationship =>
    relationship.targetEntityType === "faction" &&
    relationship.targetEntityId === factionId &&
    FACTION_MEMBERSHIP_TYPES.has(relationship.relationshipType) &&
    ["npc", "pc", "creature"].includes(relationship.sourceEntityType)
  );
}

async function getFactionMembershipsByNode(factionId, nodeId) {
  const key = getFactionMetadataRegistry().KEYS.FACTION_RANK_ID;
  return (await getFactionMembershipRelationships(factionId)).filter(
    relationship => relationship.data_json?.[key] === nodeId
  );
}

async function countFactionMembershipsByNode(factionId) {
  const key = getFactionMetadataRegistry().KEYS.FACTION_RANK_ID;
  const counts = new Map();
  (await getFactionMembershipRelationships(factionId)).forEach(relationship => {
    const nodeId = relationship.data_json?.[key] || "";
    counts.set(nodeId, (counts.get(nodeId) || 0) + 1);
  });
  return counts;
}

function formatFactionMemberDisplayName({
  entityName,
  node,
  membershipMetadata = {},
  isSecret = false,
  visibilityMode = "gm"
}) {
  const registry = getFactionMetadataRegistry();
  const keys = registry.KEYS;
  const rawName = String(entityName || "").trim();
  const visibility = isSecret && membershipMetadata[keys.TITLE_VISIBILITY] === registry.TITLE_VISIBILITY.PUBLIC
    ? registry.TITLE_VISIBILITY.GM
    : membershipMetadata[keys.TITLE_VISIBILITY] || registry.TITLE_VISIBILITY.PUBLIC;

  if (visibility === registry.TITLE_VISIBILITY.HIDDEN) return rawName;
  if (visibilityMode === "public" && (isSecret || node?.hidden || visibility !== registry.TITLE_VISIBILITY.PUBLIC)) return rawName;
  if (node?.active === false) return rawName;
  if (membershipMetadata[keys.SHOW_TITLE_IN_DISPLAY_NAME] === false) return rawName;
  const title = String(
    membershipMetadata[keys.FACTION_TITLE_OVERRIDE] || node?.displayTitle || node?.name || ""
  ).trim();
  if (!title) return rawName;
  if (node?.titleFormat === "prefix") return `${title} ${rawName}`.trim();
  if (node?.titleFormat === "suffix") return `${rawName} — ${title}`.trim();
  return rawName;
}

window.formatFactionMemberDisplayName = formatFactionMemberDisplayName;

async function resolveFactionMemberDisplayTitle(
  entity,
  {
    factionId = "",
    visibilityMode = "gm"
  } = {}
) {
  const rawName = String(entity?.name || entity?.id || "").trim();
  const emptyResult = {
    rawName,
    displayName: rawName,
    hierarchyTitle: "",
    titleFormat: "",
    nodeId: "",
    factionId: ""
  };

  if (!entity?.entity_type || !entity?.id) return emptyResult;

  const registry = getFactionMetadataRegistry();
  const keys = registry?.KEYS;
  if (!keys) return emptyResult;

  const memberships = (await getEntityFactionMemberships(entity))
    .filter(relationship => !factionId || relationship.targetEntityId === factionId)
    .filter(relationship => !(
      visibilityMode === "public" &&
      relationship.relationshipType === "secretly_member_of"
    ));
  const candidates = [];

  for (const relationship of memberships) {
    const faction = await window.dmAPI.getEntity(
      "faction",
      relationship.targetEntityId
    );
    if (!faction) continue;

    const rawHierarchy = parseFactionRecordDataJson(faction).factionHierarchy;
    const rawNodes = Array.isArray(rawHierarchy?.nodes)
      ? rawHierarchy.nodes
      : [];
    const nodeId = relationship.data_json?.[keys.FACTION_RANK_ID] || "";
    const node = rawNodes.find(item => item.id === nodeId) || null;
    if (!node || node.active === false) continue;

    const metadata = relationship.data_json || {};
    const titleVisibility = metadata[keys.TITLE_VISIBILITY] ||
      (relationship.relationshipType === "secretly_member_of"
        ? registry.TITLE_VISIBILITY.GM
        : registry.TITLE_VISIBILITY.PUBLIC);
    if (titleVisibility === registry.TITLE_VISIBILITY.HIDDEN) continue;
    if (metadata[keys.SHOW_TITLE_IN_DISPLAY_NAME] === false) continue;
    if (
      visibilityMode === "public" &&
      (node.hidden === true || titleVisibility !== registry.TITLE_VISIBILITY.PUBLIC)
    ) {
      continue;
    }

    const hierarchyTitle = String(
      metadata[keys.FACTION_TITLE_OVERRIDE] ||
      node.displayTitle ||
      node.name ||
      ""
    ).trim();
    const titleFormat = String(node.titleFormat || "").trim();
    const displayName = formatFactionMemberDisplayName({
      entityName: rawName,
      node,
      membershipMetadata: metadata,
      isSecret: relationship.relationshipType === "secretly_member_of",
      visibilityMode
    });
    candidates.push({
      rawName,
      displayName,
      hierarchyTitle,
      titleFormat,
      nodeId,
      factionId: faction.id,
      primary: metadata[keys.PRIMARY_FACTION] === true,
      promotional: node.promotional !== false,
      order: Number(node.order || 0),
      factionName: faction.name || faction.id,
      relationshipId: relationship.id
    });
  }

  candidates.sort((left, right) =>
    Number(right.primary) - Number(left.primary) ||
    Number(right.promotional) - Number(left.promotional) ||
    left.order - right.order ||
    String(left.factionName).localeCompare(String(right.factionName)) ||
    String(left.nodeId).localeCompare(String(right.nodeId)) ||
    String(left.relationshipId).localeCompare(String(right.relationshipId))
  );

  const selected = candidates[0];
  return selected
    ? {
        rawName: selected.rawName,
        displayName: selected.displayName,
        hierarchyTitle: selected.hierarchyTitle,
        titleFormat: selected.titleFormat,
        nodeId: selected.nodeId,
        factionId: selected.factionId
      }
    : emptyResult;
}

window.resolveFactionMemberDisplayTitle = resolveFactionMemberDisplayTitle;

async function loadEntityDebugPanel() {
  await ensureEntityRelationshipMapShell();

  try {
    const entityTypes = WORLD_ENTITY_LIBRARY_TYPES;

const loadedGroups = await Promise.all(
  entityTypes.map(async type => {
    try {
      return await window.dmAPI.getEntitiesByType(type);
    } catch (error) {
      console.warn(`Could not load ${type} entities:`, error);
      return [];
    }
  })
);

entityIndexCache = loadedGroups.flat().filter(entity =>
  !window.MasterForgeConfigurationReferenceHelper?.isConfigurationAsset(entity)
);

    await renderEntityIndexResults();

if (!currentlySelectedEntity) {
  const firstVisibleEntityButton =
    document.querySelector("#entityIndexResults .entityMapListItem");

  if (firstVisibleEntityButton) {
    const entityType = firstVisibleEntityButton.dataset.entityType;
    const entityId = firstVisibleEntityButton.dataset.entityId;

    const firstVisibleEntity =
      entityIndexCache.find(entity => {
        return (
          entity.entity_type === entityType &&
          entity.id === entityId
        );
      });

    if (firstVisibleEntity) {
      await showEntityDebugDetails(firstVisibleEntity);
    }
  }
}

  } catch (error) {
    console.error("Failed to load Entities / Relationship Map:", error);

    const resultsContainer = document.getElementById("entityIndexResults");

    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="relationshipEmptyState">
          <h3>Could not load entities</h3>
          <p>Check the console for details.</p>
        </div>
      `;
    }
  }
}

async function refreshEntityLibraryAfterMove(entityType, entityId) {
  try {
    // Force the library cache/list to rebuild
    await loadEntityDebugPanel();

    // Re-open the moved entity from fresh DB data
    if (entityType && entityId && window.dmAPI.getEntity) {
      const freshEntity = await window.dmAPI.getEntity(entityType, entityId);

      if (freshEntity && typeof showEntityDebugDetails === "function") {
        currentlySelectedEntity = freshEntity;
        await showEntityDebugDetails(freshEntity);
      }
    }

    // If the tree panel is open, redraw it too
    const treePanel = document.querySelector("#entityRelationshipTreePanel");

    if (
      treePanel &&
      !treePanel.classList.contains("hidden") &&
      typeof loadEntityTreeViewer === "function"
    ) {
      await loadEntityTreeViewer();
    }
  } catch (error) {
    console.warn("Could not refresh Entity Library after move:", error);
  }
}


async function ensureEntityRelationshipMapShell() {
  const panel = document.querySelector("#entities");

  if (!panel) {
    console.warn("Entities panel not found.");
    return;
  }

  if (document.querySelector("#entityRelationshipMapRoot")) {
    wireEntityRelationshipMapControls();
    return;
  }

  panel.innerHTML = `
    <div id="entityRelationshipMapRoot" class="entityRelationshipMap">

      <aside class="entityMapSidebar infoCard">

  <div class="entityLibraryTop">
    <div class="entityLibraryTitleBlock">
      <span class="entityLibraryEyebrow">Relationship Engine</span>
      <h1>🕸 Entity Library</h1>
      <p>People, factions, vehicles, places and story links.</p>
    </div>

    <div class="entityMapHeaderActions">
      <button id="newEntityBtn" type="button" title="New entity">+ New</button>
      <button id="backfillEntityContextBtn" type="button" title="Backfill entity context" aria-label="Backfill entity context">🧩</button>
      <button id="refreshEntitiesBtn" type="button" title="Refresh entities" aria-label="Refresh entities">🔄</button>
    </div>
  </div>

  <div class="entityLibraryBrowseSummary" aria-live="polite">
    <div id="entityLibraryActiveFilters"></div>
    <div class="entityLibraryBrowseSummaryActions">
      <button id="entityClearFiltersBtn" type="button">Clear Filters</button>
      <button id="entityBrowseOpenBtn" type="button">Search &amp; Filters</button>
    </div>
  </div>

  <div id="entityIndexResults" class="entityMapList"></div>

</aside>

      <main id="entityRelationshipWorkspace" class="entityMapWorkspace">

        <section class="entityMapMain infoCard">
          <div id="entity-debug-selected">
            <div class="relationshipEmptyState">
              <h3>Select an entity</h3>
              <p>Choose an entity from the left to view its relationships.</p>
            </div>
          </div>
        </section>

        <section class="entityMapRelationships infoCard">
          <div class="entityMapSectionHeader">
            <div>
              <h2>Relationships</h2>
              <p>Story-facing links for the selected entity.</p>
            </div>

            <button id="showRelationshipTreeBtn" class="hidden" type="button">
              🌳 Show Trees
            </button>
          </div>

          <div id="entity-debug-relationships">
            <p class="forgeEmptyState">No entity selected.</p>
          </div>
        </section>

        <aside id="entityRelationshipTreePanel" class="entityRelationshipTreePanel hidden">
          <div class="entityTreeHeader">
            <div>
              <h2>Relationship Tree</h2>
              <p>Switch between campaign map views.</p>
            </div>

            <div class="entityTreeHeaderActions">
              <button id="relationshipTreeFocusBtn" class="entity-tree-mode-tab" type="button">
                Pop Out Tree
              </button>

              <button id="hideRelationshipTreeBtn" type="button" aria-label="Return to entity view" title="Return to entity view">
                ✕
              </button>
            </div>
          </div>

          <div class="entityTreeModeTabs">
            <button class="entity-tree-mode-tab active" data-tree-mode="command" type="button">
              Command Tree
            </button>
            <button class="entity-tree-mode-tab" data-tree-mode="faction" type="button">
              Faction Tree
            </button>
            <button class="entity-tree-mode-tab" data-tree-mode="party" type="button">
              Party Tree
            </button>
            <button class="entity-tree-mode-tab" data-tree-mode="all" type="button">
              All Links
            </button>
          </div>

          <div class="entityTreeScopeTabs">
            <button class="entity-tree-mode-tab entity-tree-scope-tab active" data-tree-scope="focused" type="button">
              Focused View
            </button>
            <button class="entity-tree-mode-tab entity-tree-scope-tab" data-tree-scope="full" type="button">
              Full Hierarchy
            </button>
          </div>

          <div id="entity-debug-tree" class="entityTreeBody">
            <p class="forgeEmptyState">Select an entity first.</p>
          </div>
        </aside>

      </main>
    </div>
  `;

  wireEntityRelationshipMapControls();
}

async function backfillEntityContextForAllEntities() {
  if (!window.dmAPI.getEntitiesByType || !window.dmAPI.updateEntity) {
    alert("Entity API not available.");
    return;
  }

  const entityTypes = [
  "vehicle",
  "ship",
  "faction",
  "npc",
  "location",
  "settlement",
  "item",
  "quest",
  "event",
  "creature"
];

  let activeCreatureScopeFilter = "current-system";
  let updatedCount = 0;

  for (const entityType of entityTypes) {
    let entities = [];

    try {
      entities = await window.dmAPI.getEntitiesByType(entityType);
    } catch (error) {
      console.warn("Could not load entities for type:", entityType, error);
      continue;
    }

    for (const entity of entities) {
      const context = normaliseEntityContext(entity);

      const updated = {
        ...entity,

        systemId: context.systemId,
        scope: context.scope,
        currentPosition: context.currentPosition,
        visibility: context.visibility,

        data_json: {
          ...(entity.data_json || {}),
          systemId: context.systemId,
          scope: context.scope,
          currentPosition: context.currentPosition,
          visibility: context.visibility
        }
      };

      try {
        await window.dmAPI.updateEntity(entityType, entity.id, updated);
        updatedCount += 1;
      } catch (error) {
        console.warn("Could not backfill entity:", entityType, entity.id, error);
      }
    }
  }

  await loadEntityDebugPanel();

  alert(`Entity context backfill complete. Updated ${updatedCount} entities.`);
}

function wireEntityRelationshipMapControls() {
  const newEntityBtn =
    document.querySelector("#newEntityBtn");

  if (newEntityBtn) {
    newEntityBtn.onclick = async event => {
      event.preventDefault();
      event.stopPropagation();

      console.log("NEW ENTITY BUTTON CLICKED");

      try {
        if (window.MasterForgeConfigurationReferenceHelper?.isConfigurationAsset(entityBuilderState.activeEntityType)) {
          entityBuilderState.activeEntityType = "faction";
        }
        await showGenericEntityBuilder();

        console.log(
          "GENERIC ENTITY BUILDER OPENED"
        );
      } catch (error) {
        console.error(
          "GENERIC ENTITY BUILDER FAILED:",
          error
        );

        alert(
          error?.message ||
          "The entity builder could not be opened."
        );
      }
    };
  }

  document.getElementById("entityClearFiltersBtn")?.addEventListener("click", clearEntityLibraryBrowseFilters);
  document.getElementById("entityBrowseOpenBtn")?.addEventListener("click", () => window.MasterForgeActionConsole?.openGroup("browse"));
  updateEntityLibraryBrowseSummary();

  const showRelationshipTreeBtn = document.getElementById("showRelationshipTreeBtn");
  const hideRelationshipTreeBtn = document.getElementById("hideRelationshipTreeBtn");
  const relationshipTreeFocusBtn = document.getElementById(
    "relationshipTreeFocusBtn"
  );
  const relationshipTreePanel = document.getElementById("entityRelationshipTreePanel");
  const relationshipWorkspace = document.getElementById("entityRelationshipWorkspace");

  if (showRelationshipTreeBtn && relationshipTreePanel && relationshipWorkspace) {
    showRelationshipTreeBtn.onclick = async () => {
      relationshipTreePanel.classList.remove("hidden");
      relationshipTreePanel.classList.remove("is-visible");

      await loadEntityTreeViewer();

      requestAnimationFrame(() => {
        relationshipWorkspace.classList.add("tree-open");
        relationshipTreePanel.classList.add("is-visible");
      });
    };
  }

  if (hideRelationshipTreeBtn && relationshipTreePanel && relationshipWorkspace) {
    hideRelationshipTreeBtn.onclick = () => {
      if (relationshipTreeFocusMode) {
        exitRelationshipTreeFocusMode();
      }

      relationshipWorkspace.classList.remove("tree-open");
      relationshipTreePanel.classList.remove("is-visible");

      setTimeout(() => {
        relationshipTreePanel.classList.add("hidden");
      }, 260);
    };
  }

  if (relationshipTreeFocusBtn) {
    relationshipTreeFocusBtn.onclick = () => {
      setRelationshipTreeFocusMode(
        !relationshipTreeFocusMode
      );
    };
  }

  const entityTreeModeTabs = document.querySelectorAll(
    ".entityTreeModeTabs .entity-tree-mode-tab"
  );

  entityTreeModeTabs.forEach(tab => {
    tab.onclick = async () => {
      entityTreeModeTabs.forEach(item => item.classList.remove("active"));
      tab.classList.add("active");

      activeRelationshipTreeMode = tab.dataset.treeMode || "command";

      const treePanel = document.getElementById("entityRelationshipTreePanel");

      if (treePanel && !treePanel.classList.contains("hidden")) {
        await loadEntityTreeViewer();
      }
    };
  });

  const entityTreeScopeTabs = document.querySelectorAll(
    ".entity-tree-scope-tab"
  );

  entityTreeScopeTabs.forEach(tab => {
    tab.onclick = async () => {
      entityTreeScopeTabs.forEach(item => {
        item.classList.remove("active");
      });
      tab.classList.add("active");
      activeRelationshipTreeScope =
        tab.dataset.treeScope || "focused";

      const treePanel = document.getElementById(
        "entityRelationshipTreePanel"
      );

      if (treePanel && !treePanel.classList.contains("hidden")) {
        await loadEntityTreeViewer();
      }
    };
  });
}

function getEntityContext(entity = {}) {
  const data =
    entity.data_json ||
    entity.data ||
    {};

  const context =
    typeof normaliseEntityContext === "function"
      ? normaliseEntityContext(entity)
      : {
          systemId: data.systemId || entity.systemId || "system-neutral",
          scope: data.scope || {},
          currentPosition: data.currentPosition || {},
          visibility: data.visibility || entity.visibility || {}
        };

  return {
    systemId:
      context.systemId ||
      data.systemId ||
      entity.systemId ||
      "system-neutral",

    scope: {
      campaignId:
        context.scope?.campaignId ||
        data.scope?.campaignId ||
        data.campaignId ||
        data.campaign ||
        "",

      worldId:
        context.scope?.worldId ||
        data.scope?.worldId ||
        data.worldId ||
        data.world ||
        "",

      regionId:
        context.scope?.regionId ||
        data.scope?.regionId ||
        data.regionId ||
        data.region ||
        "",

      locationId:
        context.scope?.locationId ||
        data.scope?.locationId ||
        data.locationId ||
        data.location ||
        ""
    },

    currentPosition: {
      mode:
        context.currentPosition?.mode ||
        data.currentPosition?.mode ||
        data.locationState?.mode ||
        "location",

      worldId:
        context.currentPosition?.worldId ||
        data.currentPosition?.worldId ||
        data.locationState?.worldId ||
        data.worldId ||
        data.world ||
        "",

      regionId:
        context.currentPosition?.regionId ||
        data.currentPosition?.regionId ||
        data.locationState?.regionId ||
        data.regionId ||
        data.region ||
        "",

      locationId:
        context.currentPosition?.locationId ||
        data.currentPosition?.locationId ||
        data.locationState?.locationId ||
        data.locationId ||
        data.location ||
        "",

      entityType:
        context.currentPosition?.entityType ||
        data.currentPosition?.entityType ||
        data.locationState?.entityType ||
        "",

      entityId:
        context.currentPosition?.entityId ||
        data.currentPosition?.entityId ||
        data.locationState?.entityId ||
        "",

      notes:
        context.currentPosition?.notes ||
        data.currentPosition?.notes ||
        data.locationState?.notes ||
        ""
    },

    visibility: normaliseVisibility(
      context.visibility ||
      data.visibility ||
      entity.visibility ||
      {}
    )
  };
}

function getEntityEffectiveContext(entity = {}) {
  const context = getEntityContext(entity);
  const position = context.currentPosition || {};

  if (
    position.mode === "entity" &&
    position.entityType &&
    position.entityId &&
    Array.isArray(entityIndexCache)
  ) {
    const containingEntity = entityIndexCache.find(item => {
      return (
        item.entity_type === position.entityType &&
        item.id === position.entityId
      );
    });

    if (containingEntity) {
      const containingContext = getEntityContext(containingEntity);
      const containingPosition = containingContext.currentPosition || {};

      return {
        ...context,

        // Keep original home/scope data, but make filtering use
        // the containing entity's live location.
        currentPosition: {
          ...position,
          worldId: containingPosition.worldId || position.worldId || "",
          regionId: containingPosition.regionId || position.regionId || "",
          locationId: containingPosition.locationId || position.locationId || ""
        }
      };
    }
  }

  return context;
}

function getExplicitEntityContext(entity = {}) {
  const data = entity.data_json || entity.data || {};
  const scope = data.scope || entity.scope || {};
  const position =
    data.currentPosition ||
    entity.currentPosition ||
    data.locationState ||
    entity.locationState ||
    {};

  return {
    systemId:
      data.systemId ||
      entity.systemId ||
      "",
    worldId:
      position.worldId ||
      scope.worldId ||
      data.worldId ||
      data.world ||
      entity.worldId ||
      entity.world ||
      "",
    regionId:
      position.regionId ||
      scope.regionId ||
      data.regionId ||
      data.region ||
      entity.regionId ||
      entity.region ||
      "",
    locationId:
      position.locationId ||
      scope.locationId ||
      data.currentLocationId ||
      data.locationId ||
      data.location ||
      entity.currentLocationId ||
      entity.locationId ||
      entity.location ||
      ""
  };
}

function mergeInheritedEntityContext(
  entity,
  inheritedContext = null
) {
  const ownContext = getEntityEffectiveContext(entity);
  const explicit = getExplicitEntityContext(entity);
  const inheritedPosition = inheritedContext?.currentPosition || {};
  const inheritedScope = inheritedContext?.scope || {};
  const worldId =
    explicit.worldId ||
    inheritedPosition.worldId ||
    inheritedScope.worldId ||
    "";
  const regionId =
    explicit.regionId ||
    inheritedPosition.regionId ||
    inheritedScope.regionId ||
    "";
  const locationId =
    explicit.locationId ||
    inheritedPosition.locationId ||
    inheritedScope.locationId ||
    "";

  return {
    ...ownContext,
    systemId:
      explicit.systemId ||
      inheritedContext?.systemId ||
      ownContext.systemId,
    scope: {
      ...ownContext.scope,
      worldId,
      regionId,
      locationId
    },
    currentPosition: {
      ...ownContext.currentPosition,
      worldId,
      regionId,
      locationId
    }
  };
}

function partyGroupIsActive(entity = {}) {
  const status = String(
    entity.data_json?.status ||
    entity.status ||
    "active"
  ).trim().toLowerCase();

  return !["inactive", "dissolved"].includes(status);
}

async function getEntityForContextResolution(entityType, entityId) {
  const cachedEntity = entityIndexCache.find(item =>
    item.entity_type === entityType && item.id === entityId
  );

  return cachedEntity || window.dmAPI.getEntity(entityType, entityId);
}

async function resolveEntityEffectiveContext(
  entity,
  contextCache = new Map(),
  visited = new Set()
) {
  const entityType = String(entity?.entity_type || "").toLowerCase();
  const entityId = String(entity?.id || "");
  const entityKey = `${entityType}:${entityId}`;

  if (!["pc", "party_group"].includes(entityType)) {
    return getEntityEffectiveContext(entity);
  }

  if (visited.has(entityKey)) {
    return mergeInheritedEntityContext(entity);
  }

  if (contextCache.has(entityKey)) {
    return contextCache.get(entityKey);
  }

  const resolution = (async () => {
    const nextVisited = new Set(visited);
    nextVisited.add(entityKey);
    const engine = window.MasterForgeRelationshipEngine;
    const values = await engine.getRelationshipsForEntity(
      entityType,
      entityId
    );
    const memberships = [];

    for (const value of values) {
      const relationship = engine.normaliseRelationshipRecord(value);
      const selectedIsSource =
        relationship.sourceEntityType === entityType &&
        relationship.sourceEntityId === entityId;
      const selectedIsTarget =
        relationship.targetEntityType === entityType &&
        relationship.targetEntityId === entityId;
      const relationshipType = relationship.relationshipType;
      const isParentLink =
        (selectedIsSource && [
          "member_of_party",
          "subgroup_of"
        ].includes(relationshipType)) ||
        (selectedIsTarget && [
          "has_party_member",
          "contains_subgroup"
        ].includes(relationshipType));

      if (!isParentLink) continue;

      const parentType = selectedIsSource
        ? relationship.targetEntityType
        : relationship.sourceEntityType;
      const parentId = selectedIsSource
        ? relationship.targetEntityId
        : relationship.sourceEntityId;

      if (!["party", "party_group"].includes(parentType)) continue;

      const parent = await getEntityForContextResolution(parentType, parentId);
      if (parent) memberships.push(parent);
    }

    if (entityType === "party_group") {
      const parent =
        memberships.find(item => item.entity_type === "party") ||
        memberships.find(item => item.entity_type === "party_group");
      const inherited = parent
        ? await resolveEntityEffectiveContext(
            parent,
            contextCache,
            nextVisited
          )
        : null;

      return mergeInheritedEntityContext(entity, inherited);
    }

    const activeGroups = memberships.filter(item =>
      item.entity_type === "party_group" && partyGroupIsActive(item)
    );
    const explicitGroup = activeGroups.find(item => {
      const context = getExplicitEntityContext(item);
      return !!(
        context.systemId ||
        context.worldId ||
        context.regionId ||
        context.locationId
      );
    });
    const mainParty = memberships.find(item => item.entity_type === "party");
    const inheritanceSource = explicitGroup || mainParty;
    const inherited = inheritanceSource
      ? await resolveEntityEffectiveContext(
          inheritanceSource,
          contextCache,
          nextVisited
        )
      : null;

    return mergeInheritedEntityContext(entity, inherited);
  })().catch(error => {
    console.warn("Could not resolve inherited entity context:", entityKey, error);
    return getEntityEffectiveContext(entity);
  });

  contextCache.set(entityKey, resolution);
  return resolution;
}

function getEntityLibraryLocationLabel(entity = {}) {
  const context =
    entity._context ||
    getEntityContext(entity);

  const position =
    context.currentPosition ||
    {};

  if (position.mode === "entity" && position.entityType && position.entityId) {
    const containingEntity = entityIndexCache.find(item =>
      item.entity_type === position.entityType &&
      item.id === position.entityId
    );

    return `Aboard ${containingEntity?.name || position.entityId}`;
  }

  return (
    position.locationId ||
    entity.currentLocationId ||
    entity.locationId ||
    context.scope?.locationId ||
    "No location"
  );
}

async function renderEntityIndexResults() {
  const resultsContainer = document.getElementById("entityIndexResults");

  if (!resultsContainer) return;

  const searchTerm = activeEntitySearchTerm.trim().toLowerCase();
  updateEntityLibraryBrowseSummary();

  const currentSystemId = getCurrentSystemId();
  const currentWorldId = window.dmState.current?.world || "";
  const currentRegionId = window.dmState.current?.region || "";
  const currentLocationId = window.dmState.current?.location || "";
  const renderSequence = ++entityIndexRenderSequence;
  const contextCache = new Map();
  const shouldResolveInheritedContext =
    activeEntityScopeFilter !== "all";

  let filteredEntities = await Promise.all(
    entityIndexCache.map(async entity => {
      const context = shouldResolveInheritedContext
        ? await resolveEntityEffectiveContext(
            entity,
            contextCache
          )
        : getEntityEffectiveContext(entity);

      return {
        ...entity,
        _context: context
      };
    })
  );

  if (renderSequence !== entityIndexRenderSequence) return;

  if (activeEntityTypeFilter !== "all") {
  filteredEntities =
    filteredEntities.filter(entity => {
      if (
        activeEntityTypeFilter ===
        "vehicle"
      ) {
        return [
          "vehicle",
          "ship"
        ].includes(
          entity.entity_type
        );
      }

      return (
        entity.entity_type ===
        activeEntityTypeFilter
      );
    });
}

  if (activeEntityScopeFilter === "current-location") {
  filteredEntities = filteredEntities.filter(entity => {
    const position = entity._context.currentPosition || {};

    return position.locationId === currentLocationId;
  });
}
  if (activeEntityScopeFilter === "current-world") {
  filteredEntities = filteredEntities.filter(entity => {
    const position = entity._context.currentPosition || {};

    return position.worldId === currentWorldId;
  });
}

  if (activeEntityScopeFilter === "current-region") {
    filteredEntities = filteredEntities.filter(entity => {
      const position = entity._context.currentPosition || {};

      return position.regionId === currentRegionId;
    });
  }

  if (activeEntityScopeFilter === "current-system") {
    filteredEntities = filteredEntities.filter(entity => {
      return entity._context.systemId === currentSystemId;
    });
  }

  if (activeEntityVisibilityFilter === "active") {
    filteredEntities = filteredEntities.filter(entity => {
      const visibility = entity._context.visibility || {};

      return !visibility.hidden && !visibility.archived;
    });
  }

  if (activeEntityVisibilityFilter === "pinned") {
    filteredEntities = filteredEntities.filter(entity => {
      return !!entity._context.visibility?.pinned;
    });
  }

  if (activeEntityVisibilityFilter === "hidden") {
    filteredEntities = filteredEntities.filter(entity => {
      return !!entity._context.visibility?.hidden;
    });
  }

  if (activeEntityVisibilityFilter === "archived") {
    filteredEntities = filteredEntities.filter(entity => {
      return !!entity._context.visibility?.archived;
    });
  }

  if (searchTerm) {
    filteredEntities = filteredEntities.filter(entity => {
      const searchableText = [
        entity.name,
        entity.entity_type,
        entity.description,
        entity._context.systemId,
        entity._context.scope?.worldId,
        entity._context.scope?.regionId,
        entity._context.scope?.locationId,
        entity._context.currentPosition?.locationId,
        JSON.stringify(entity.data_json || {})
      ].join(" ").toLowerCase();

      return searchableText.includes(searchTerm);
    });
  }

  filteredEntities = [...filteredEntities].sort((a, b) => {
    const pinnedA = a._context.visibility?.pinned ? 1 : 0;
    const pinnedB = b._context.visibility?.pinned ? 1 : 0;

    if (pinnedA !== pinnedB) return pinnedB - pinnedA;

    const typeCompare = String(a.entity_type).localeCompare(String(b.entity_type));

    if (typeCompare !== 0) return typeCompare;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  if (!filteredEntities.length) {
    resultsContainer.innerHTML = `
      <div class="relationshipEmptyState">
        <h3>No entities match the current filters.</h3>
        <p>Try another type, visibility, search term, or scope.</p>
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = filteredEntities.map(entity => {
    const isActive =
      currentlySelectedEntity &&
      currentlySelectedEntity.entity_type === entity.entity_type &&
      currentlySelectedEntity.id === entity.id;

    const visibility = entity._context.visibility || {};

const badges = [
  visibility.pinned ? "Pinned" : "",
  visibility.hidden ? "Hidden" : "",
  visibility.archived ? "Archived" : ""
].filter(Boolean);

const locationLabel = getEntityLibraryLocationLabel(entity);

return `
      <button
        class="entityMapListItem ${isActive ? "active" : ""}"
        type="button"
        data-entity-type="${escapeHtml(entity.entity_type)}"
        data-entity-id="${escapeHtml(entity.id)}"
      >
        <span class="entityMapListIcon">${getEntityTreeIcon(entity.entity_type)}</span>

        <span class="entityMapListBody">
          <strong>${escapeHtml(entity.name || entity.id)}</strong>

          <small>
            ${escapeHtml(formatEntityTypeLabel(entity.entity_type))}
            · ${escapeHtml(entity._context.systemId)}
          </small>

          <small>
  📍 ${escapeHtml(locationLabel)}
</small>

          ${
            badges.length
              ? `<em>${badges.map(badge => escapeHtml(badge)).join(" · ")}</em>`
              : ""
          }
        </span>
      </button>
    `;
  }).join("");

resultsContainer
  .querySelectorAll(".entityMapListItem")
  .forEach(button => {
    button.onclick = async () => {
      const entity = entityIndexCache.find(item =>
        item.entity_type === button.dataset.entityType &&
        item.id === button.dataset.entityId
      );

      if (!entity) {
        alert("Entity not found.");
        return;
      }

      currentlySelectedEntity = entity;

resultsContainer
  .querySelectorAll(".entityMapListItem")
  .forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.entityType === entity.entity_type &&
      item.dataset.entityId === entity.id
    );
  });

await showEntityDebugDetails(entity);
    };
  });

const selectedStillVisible =
  currentlySelectedEntity &&
  filteredEntities.some(entity => {
    return (
      entity.entity_type === currentlySelectedEntity.entity_type &&
      entity.id === currentlySelectedEntity.id
    );
  });

if (!selectedStillVisible) {
  currentlySelectedEntity = null;

  const selectedPanel =
    document.querySelector("#entity-debug-selected");

  const relationshipsPanel =
    document.querySelector("#entity-debug-relationships");

  if (selectedPanel) {
    selectedPanel.innerHTML = `
      <div class="relationshipEmptyState">
        <h3>No entity selected</h3>
        <p>Select an entity from the current filtered list.</p>
      </div>
    `;
  }

  if (relationshipsPanel) {
    relationshipsPanel.innerHTML = `
      <div class="relationshipEmptyState">
        <h3>No relationships shown</h3>
        <p>Select an entity to view its links.</p>
      </div>
    `;
  }
}
}

async function getRelationshipsForEntityPanel(entity) {
  if (!entity?.entity_type || !entity?.id) {
    return [];
  }

  const engine =
    window.MasterForgeRelationshipEngine;

  if (!engine) {
    throw new Error(
      "Universal Relationship Engine is unavailable."
    );
  }

  const relationships = [];

  const addRelationship = relationship => {
    if (!relationship) return;

    relationships.push(
      engine.toLegacyRelationshipRecord(relationship)
    );
  };

  try {
    const directRelationships =
      await engine.getLegacyRelationshipsForEntity(
        entity.entity_type,
        entity.id
      );

    directRelationships.forEach(addRelationship);

  } catch (error) {
    console.warn(
      "Could not load relationships through URE:",
      entity,
      error
    );
  }

    console.log("URE RELATIONSHIPS LOADED:", {
  entityType: entity.entity_type,
  entityId: entity.id,
  count: relationships.length
});

  return engine.deduplicateRelationships(
    relationships
  );
}

async function showEntityDebugDetails(
  entity,
  {
    preserveTreeOpen = false
  } = {}
) {
  currentlySelectedEntity = entity;

  const workspace = document.getElementById("entityRelationshipWorkspace");

  if (workspace) {
    workspace.classList.remove("entity-editing", "relationship-builder-open");
  }

  if (!preserveTreeOpen) {
    closeRelationshipTree();
  }

  const selectedContainer = document.getElementById("entity-debug-selected");
  const relationshipsContainer = document.getElementById("entity-debug-relationships");

    if (!selectedContainer || !relationshipsContainer) {
  console.error(
    "Generic entity builder containers missing:",
    {
      selectedContainer,
      relationshipsContainer,
      workspace
    }
  );

  throw new Error(
    "Entity builder workspace containers could not be found."
  );
}

  const displayResolution = await resolveFactionMemberDisplayTitle(entity, {
    visibilityMode: "gm"
  }).catch(() => null);
  const presentationEntity = displayResolution
    ? { ...entity, presentationDisplayName: displayResolution.displayName }
    : entity;

  selectedContainer.innerHTML = renderEntityProfileCard(
    presentationEntity,
    displayResolution
  );

wireEntityProfileButtons(entity);
setupDmEntityWorkspace(presentationEntity, selectedContainer.querySelector(".dmEntityWorkspace"));

if (typeof renderEntityWorldStateWarnings === "function") {
  await renderEntityWorldStateWarnings(entity);
} else {
  console.warn(
    "Entity world-state warnings are unavailable; continuing with relationships."
  );
}

  relationshipsContainer.innerHTML = `
    <p class="forgeEmptyState">Loading relationships...</p>
  `;

  try {
    const relationships = await getRelationshipsForEntityPanel(entity);

    await renderEntityDebugRelationships(
      relationshipsContainer,
      relationships,
      entity
    );

    updateRelationshipTreeButton(
      relationships,
      { preserveTreeOpen }
    );

  } catch (error) {
    console.error("Failed to load entity relationships:", error);

    relationshipsContainer.innerHTML = `
      <div class="relationshipEmptyState">
        <h3>Could not load relationships</h3>
        <p>Check the console for details.</p>
      </div>
    `;
    updateRelationshipTreeButton(
      [],
      { preserveTreeOpen }
    );
  }
}

function getEntityVisibilityLabel(entity = {}) {
  const context =
    entity._context ||
    getEntityEffectiveContext(entity);

  const visibility =
    context.visibility ||
    entity.visibility ||
    entity.data_json?.visibility ||
    {};

  if (visibility.archived) return "Archived";
  if (visibility.hidden) return "Hidden";
  if (visibility.pinned) return "Pinned";

  return "Active";
}

async function openMoveEntityPanel(entity) {
  if (!entity?.entity_type || !entity?.id) {
    alert("No entity selected.");
    return;
  }

  const detailsPanel =
  document.querySelector("#entity-debug-selected") ||
  document.querySelector("#entityDebugDetails") ||
  document.querySelector("#entityDetails") ||
  document.querySelector("#entityDebugDetailPanel");

  if (!detailsPanel) {
    alert("Entity detail panel not found.");
    return;
  }

  const context =
    typeof getEntityContext === "function"
      ? getEntityContext(entity)
      : {};

  const position =
    context.currentPosition ||
    entity.data_json?.currentPosition ||
    {};

  const selectedWorldId =
    position.worldId ||
    entity.data_json?.currentWorldId ||
    entity.data_json?.worldId ||
    entity.data_json?.world ||
    window.dmState.current.world ||
    "";

  const selectedRegionId =
    position.regionId ||
    entity.data_json?.currentRegionId ||
    entity.data_json?.regionId ||
    entity.data_json?.region ||
    window.dmState.current.region ||
    "";

  const selectedLocationId =
    position.locationId ||
    entity.data_json?.currentLocationId ||
    entity.data_json?.locationId ||
    entity.data_json?.location ||
    window.dmState.current.location ||
    "";

  const worlds = await window.dmAPI.listWorlds();

  detailsPanel.innerHTML = `
    <section class="entityProfileCard">
      <div class="entityProfileHeader">
        <div class="entityProfileIcon">
          ${getEntityTypeIcon(entity.entity_type)}
        </div>

        <div>
          <div class="entityProfileMeta">
            <span>Move ${escapeHtml(formatEntityTypeLabel(entity.entity_type))}</span>
          </div>

          <h1>${escapeHtml(entity.name || entity.id)}</h1>

          <p>
            Move this entity to a new current location. Home/default location will not be changed.
          </p>
        </div>
      </div>

      <div class="forgeWorkspaceCard">
        <h2>Current Position</h2>

        <div class="genericEntityFormGrid two">
          <div>
            <label>World / Plane</label>
            <select id="moveEntityWorldInput">
              ${worlds.map(world => `
                <option
                  value="${escapeHtml(world.id)}"
                  ${world.id === selectedWorldId ? "selected" : ""}
                >
                  ${escapeHtml(world.name || world.id)}
                </option>
              `).join("")}
            </select>
          </div>

          <div>
            <label>Region</label>
            <select id="moveEntityRegionInput">
              <option value="">Loading regions...</option>
            </select>
          </div>

          <div>
            <label>Location</label>
            <select id="moveEntityLocationInput">
              <option value="">Loading locations...</option>
            </select>
          </div>

          <div>
            <label class="forgeSwitchLine">
              <span>
                <strong>Move contained NPCs</strong>
                <small>NPCs aboard / inside this entity keep following it.</small>
              </span>

              <input
                id="moveEntityContainedNpcsInput"
                type="checkbox"
                checked
              >
            </label>
          </div>
        </div>

        <div class="entityProfileActions">
          <button id="saveMoveEntityBtn" type="button">
            💾 Save Move
          </button>

          <button id="cancelMoveEntityBtn" type="button">
            Cancel
          </button>
        </div>
      </div>
    </section>
  `;

  await setupMoveEntityControls({
    entity,
    selectedRegionId,
    selectedLocationId
  });
}

async function setupMoveEntityControls({
  entity,
  selectedRegionId = "",
  selectedLocationId = ""
}) {
  const worldInput = document.querySelector("#moveEntityWorldInput");
  const regionInput = document.querySelector("#moveEntityRegionInput");
  const locationInput = document.querySelector("#moveEntityLocationInput");
  const moveContainedInput = document.querySelector("#moveEntityContainedNpcsInput");
  const saveBtn = document.querySelector("#saveMoveEntityBtn");
  const cancelBtn = document.querySelector("#cancelMoveEntityBtn");

  if (!worldInput || !regionInput || !locationInput) {
    console.warn("Move Entity controls missing.");
    return;
  }

  async function loadRegions(preferredRegionId = "") {
    const worldId = worldInput.value;

    let regions = [];

    try {
      regions = worldId
        ? await window.dmAPI.listRegions(worldId)
        : [];
    } catch (error) {
      console.warn("Could not load move entity regions:", error);
    }

    if (!regions.length) {
      regionInput.innerHTML = `<option value="">No regions found</option>`;
      locationInput.innerHTML = `<option value="">No locations found</option>`;
      return;
    }

    regionInput.innerHTML = regions.map(region => `
      <option
        value="${escapeHtml(region.id)}"
        ${region.id === preferredRegionId ? "selected" : ""}
      >
        ${escapeHtml(region.name || region.id)}
      </option>
    `).join("");

    regionInput.value =
      regions.some(region => region.id === preferredRegionId)
        ? preferredRegionId
        : regions[0].id;
  }

  async function loadLocations(preferredLocationId = "") {
    const regionId = regionInput.value;

    let locations = [];

    try {
      locations = regionId
        ? await window.dmAPI.listLocations(regionId)
        : [];
    } catch (error) {
      console.warn("Could not load move entity locations:", error);
    }

    if (!locations.length) {
      locationInput.innerHTML = `<option value="">No locations found</option>`;
      return;
    }

    locationInput.innerHTML = locations.map(location => `
      <option
        value="${escapeHtml(location.id)}"
        ${location.id === preferredLocationId ? "selected" : ""}
      >
        ${escapeHtml(location.name || location.id)}
      </option>
    `).join("");

    locationInput.value =
      locations.some(location => location.id === preferredLocationId)
        ? preferredLocationId
        : locations[0].id;
  }

  worldInput.onchange = async () => {
    await loadRegions("");
    await loadLocations("");
  };

  regionInput.onchange = async () => {
    await loadLocations("");
  };

  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      await showEntityDebugDetails(entity);
    };
  }

  if (saveBtn) {
    saveBtn.onclick = async () => {
      if (!worldInput.value || !regionInput.value || !locationInput.value) {
        alert("Choose a world, region and location.");
        return;
      }

      await moveEntityAndContainedNpcs(
        entity.entity_type,
        entity.id,
        {
          worldId: worldInput.value,
          regionId: regionInput.value,
          locationId: locationInput.value
        },
        {
          moveContainedNpcs: !!moveContainedInput?.checked
        }
      );
    };
  }

  await loadRegions(selectedRegionId);
  await loadLocations(selectedLocationId);
}

function renderEntityProfileCard(entity, displayResolution = null) {
  const typeLabel = formatEntityTypeLabel(entity.entity_type);
  const icon = getEntityTreeIcon(entity.entity_type);
  const visibilityLabel = getEntityVisibilityLabel(entity);

  return `
    <div class="entityProfileCard">

      <div class="entityProfileHero">
        <div class="entityProfileIcon">${icon}</div>

        <div>
          <div class="entityProfileMeta">
  <span>${escapeHtml(typeLabel)}</span>
  <span id="entityVisibilityBadge" class="entityVisibilityBadge">
    ${escapeHtml(visibilityLabel)}
  </span>
</div>

          <h1>${escapeHtml(displayResolution?.displayName || entity.presentationDisplayName || entity.name || entity.id)}</h1>

          <p>
            ${escapeHtml(entity.description || "No description recorded yet.")}
          </p>

          ${entity.data_json?.source === "campaign-party" ? `
            <p class="forgeEmptyState">
              Party membership is managed from the Party screen.
            </p>
          ` : ""}

          <div id="entityWorldStateWarnings"></div>

        </div>
      </div>

      <div class="entityProfileActions">
  <button id="openEntitySourceBtn" type="button">
    ${["npc", "pc", "creature"].includes(entity.entity_type) ? "Edit Entity" : "Open Source Builder"}
  </button>

  <button id="openMoveEntityBtn" type="button">
    ${
      entity.entity_type === "npc"
        ? "📍 Edit Location"
        : "🧭 Move Entity"
    }
  </button>

  <button id="pinEntityBtn" type="button">
    📌 Pin
  </button>

  <button id="hideEntityBtn" type="button">
    🙈 Hide
  </button>

  <button id="archiveEntityBtn" type="button">
    🗄 Archive
  </button>

  <button id="restoreEntityBtn" type="button">
    ↩ Restore
  </button>
</div>
      
      </div>

      ${["npc", "pc", "creature"].includes(entity.entity_type) ? renderDmEntityWorkspaceShell(entity, { hostContext: "entity-library", defaultTab: activeDmEntityWorkspaceTab }) : ""}

      <details class="relationshipAdvancedBox">
        <summary>Advanced technical details</summary>

        <p><strong>Type:</strong> ${escapeHtml(entity.entity_type)}</p>
        <p><strong>ID:</strong> ${escapeHtml(entity.id)}</p>

        <pre>${escapeHtml(JSON.stringify(entity.data_json || {}, null, 2))}</pre>
      </details>

    </div>
  `;
}

async function openCanonicalEntityEditor(entity) {
  if (entity.entity_type === "npc") return openNpcEntityInBuilder(entity);
  if (entity.entity_type === "creature") return openCreatureFromRegionOverview(entity.data_json?.creatureId || entity.id);
  if (entity.entity_type === "pc") return openCharacterFromForgeSearch(entity.data_json?.characterId || entity.id);
  return showGenericEntityBuilder(entity);
}

async function openCanonicalEntityFromContext(entity, origin = "entity-library") {
  if (["npc", "pc", "creature"].includes(entity?.entity_type)) return openCanonicalEntityEditor(entity);
  return showEntityDebugDetails(entity, { preserveTreeOpen: origin === "entity-library" });
}

function scrollCanonicalRecordIntoView(type, id) {
  const panel = type === "npc" ? document.querySelector("#npc") : document.querySelector("#creatures");
  const listSelector = type === "npc" ? "#npcList" : "#creatureList";
  const selector = `${listSelector} .forgeListItem[data-id="${CSS.escape(String(id || ""))}"]`;
  const item = panel?.querySelector(selector);
  if (!item) return;
  item.classList.add("active");
  item.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function openEntityLibraryRecord(entityOrType, entityId = "") {
  let entity = typeof entityOrType === "object" ? entityOrType : null;
  const entityType = entity?.entity_type || String(entityOrType || "");
  const id = entity?.id || String(entityId || "");
  if (!entity && entityType && id) entity = await window.dmAPI.getEntity(entityType, id);
  if (!entity?.entity_type || !entity?.id) {
    alert("The referenced entity could not be found. No data was changed.");
    return false;
  }
  const tab = document.querySelector('#tabs [data-workspace-group="world-building"] .tab[data-tab="entities"]');
  const panel = document.querySelector("#entities");
  if (!tab || !panel || !activateMainPanel(tab, panel)) return false;
  await loadEntityDebugPanel();
  entity = entityIndexCache.find(item => item.entity_type === entity.entity_type && item.id === entity.id) || entity;
  activeEntityTypeFilter = ["ship", "vehicle"].includes(entity.entity_type) ? "vehicle" : entity.entity_type;
  syncEntityLibraryBrowseControls();
  await renderEntityIndexResults();
  let resultButton = document.querySelector(`#entityIndexResults .entityMapListItem[data-entity-type="${CSS.escape(entity.entity_type)}"][data-entity-id="${CSS.escape(entity.id)}"]`);
  if (!resultButton) {
    activeEntityScopeFilter = "all";
    activeEntityVisibilityFilter = "all";
    const scopeInput = document.querySelector("#entityScopeFilterInput");
    const visibilityInput = document.querySelector("#entityVisibilityFilterInput");
    if (scopeInput) scopeInput.value = "all";
    if (visibilityInput) visibilityInput.value = "all";
    await renderEntityIndexResults();
    resultButton = document.querySelector(`#entityIndexResults .entityMapListItem[data-entity-type="${CSS.escape(entity.entity_type)}"][data-entity-id="${CSS.escape(entity.id)}"]`);
  }
  currentlySelectedEntity = entity;
  await showEntityDebugDetails(entity, { preserveTreeOpen: false });
  resultButton?.classList.add("active");
  resultButton?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  window.MasterForgeActionConsole?.updateContext({
    pageId: "entities",
    recordType: entity.entity_type,
    recordId: entity.id,
    selectionType: entity.entity_type,
    selectionId: entity.id
  });
  return true;
}

async function returnToDmEntityAffiliations(entity) {
  await openCanonicalEntityEditor(entity);
  const hostContext = entity.entity_type === "creature" ? "creature" : entity.entity_type === "pc" ? "pc" : "npc";
  if (entity.entity_type === "pc") {
    const host = document.querySelector('[data-canonical-dm-workspace-host="pc"]');
    if (host) {
      const workspace = await renderDmEntityWorkspace(entity, { mount: host, hostContext, defaultTab: "affiliations" });
      workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }
  const workspace = await mountCanonicalDmWorkspace(entity.entity_type, { id: entity.id, entityId: entity.id }, hostContext);
  if (workspace) await switchDmEntityWorkspace("affiliations", entity, workspace);
}

async function openFactionHierarchyFromMembership(faction, sourceEntity, workspace) {
  const factionId = faction?.id;
  if (!factionId) throw new Error("The membership faction could not be resolved.");
  const fullFaction = await loadMembershipFaction(factionId);
  workspace?.querySelector("[data-add-faction-membership-mount]")?.replaceChildren();
  activateMainPanel(document.querySelector('.tab[data-tab="entities"]'), document.querySelector("#entities"));
  showGenericEntityBuilder(fullFaction, { factionTab: "hierarchy" });
  await switchFactionWorkspace("hierarchy");
  const selectedContainer = document.querySelector("#entity-debug-selected");
  const card = selectedContainer?.querySelector(".entityProfileCard");
  if (card && sourceEntity) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dmWorkspaceReturn factionHierarchyReturn";
    button.textContent = `Back to ${formatEntityTypeLabel(sourceEntity.entity_type)}`;
    button.onclick = () => returnToDmEntityAffiliations(sourceEntity);
    card.insertAdjacentElement("afterbegin", button);
  }
}

async function openUniversalRelationshipPreset(entity, relationshipType = "", targetType = "") {
  await showUniversalRelationshipBuilder(entity);
  const relationshipInput = document.querySelector("#universalRelationshipType");
  const targetInput = document.querySelector("#universalRelationshipTargetType");
  if (relationshipInput && relationshipType && [...relationshipInput.options].some(option => option.value === relationshipType)) relationshipInput.value = relationshipType;
  if (targetInput && targetType) targetInput.value = targetType;
  renderUniversalRelationshipHelp();
  if (targetInput) await populateUniversalRelationshipEntitySelect("Target");
}

function renderDmEntityOverview(entity) {
  const context = getEntityEffectiveContext(entity);
  const data = entity.data_json || {};
  const position = context.currentPosition || {};
  const location = position.mode === "entity"
    ? `Aboard / inside ${position.entityId || "an entity"}`
    : position.locationId || data.currentLocationId || "Unknown location";
  return `<div class="dmEntityWorkspacePanel"><h2>Overview</h2>
    <div class="dmEntityOverviewGrid">
      <div><small>Type</small><strong>${escapeHtml(formatEntityTypeLabel(entity.entity_type))}</strong></div>
      <div><small>Subtype</small><strong>${escapeHtml(data.subtype || data.species || data.type || "—")}</strong></div>
      <div><small>Status</small><strong>${escapeHtml(data.status || "Unknown")}</strong></div>
      <div><small>Visibility</small><strong>${escapeHtml(getEntityVisibilityLabel(entity))}</strong></div>
      <div><small>Current location</small><strong>${escapeHtml(location)}</strong></div>
      <div><small>Campaign</small><strong>${escapeHtml(context.scope?.campaignId || "—")}</strong></div>
      <div><small>World</small><strong>${escapeHtml(context.scope?.worldId || "—")}</strong></div>
      <div><small>Region</small><strong>${escapeHtml(context.scope?.regionId || "—")}</strong></div>
    </div>
    <p class="dmEntitySummary">${escapeHtml(entity.description || data.publicNotes || "No concise notes recorded.")}</p>
    <div class="dmEntityQuickActions">
      <button type="button" data-dm-action="edit">Edit Entity</button><button type="button" data-dm-action="location">Change Location</button><button type="button" data-dm-tab-link="affiliations">Manage Affiliations</button><button type="button" data-dm-action="relationship">Add Relationship</button><button type="button" data-dm-tab-link="session-use">Add to Session</button><button type="button" disabled title="Deferred until an existing encounter insertion API is available">Add to Encounter — Deferred</button>
    </div>
  </div>`;
}

async function renderDmEntityFeatures(entity, workspace) {
  const mount = workspace?.querySelector("[data-dm-workspace-mount]");
  if (!mount) return;
  mount.innerHTML = `<div class="dmEntityWorkspacePanel"><div class="dmEntityPanelHeader"><div><h2>Personal Features</h2><p>Traits and actions remain editable in the canonical ${escapeHtml(formatEntityTypeLabel(entity.entity_type))} workspace.</p></div><button type="button" data-edit-personal-features>Edit Personal Features</button></div><div id="inheritedFeaturesPanelMount"><p class="forgeEmptyState">Resolving inherited features…</p></div></div>`;
  const inheritedMount = mount.querySelector("#inheritedFeaturesPanelMount");
  inheritedMount?.removeAttribute("id");
  if (inheritedMount) inheritedMount.dataset.inheritedFeaturesMount = "";
  mount.querySelector("[data-edit-personal-features]").onclick = () => openCanonicalEntityEditor(entity);
  await renderInheritedFeaturesForEntity(entity, { open: true, excludePersonal: true, workspace });
}

function affiliationGroupTitle(relationship, entityIsSource) {
  const type = relationship.relationshipType;
  if (["member_of", "secretly_member_of"].includes(type)) return "Faction Memberships";
  if (["member_of_party", "has_party_member"].includes(type)) return "Party Memberships";
  if (["subgroup_of", "contains_subgroup", "split_from", "rejoined_with"].includes(type)) return "Party Group Memberships";
  if (["aboard", "contains", "operates_from", "stationed_at"].includes(type)) return "Vehicle Crew / Aboard";
  if (["companion_of", "bonded_to", "travels_with", "handler_of", "handled_by"].includes(type)) return "Companions and Associates";
  return null;
}

async function renderDmEntityAffiliations(entity, { visibilityMode = "gm", workspace } = {}) {
  const mount = workspace?.querySelector("[data-dm-workspace-mount]");
  if (!mount) return;
  mount.innerHTML = `<div class="dmEntityWorkspacePanel"><p class="forgeEmptyState">Loading affiliations…</p></div>`;
  const raw = await window.MasterForgeRelationshipEngine.getRelationshipsForEntity(entity.entity_type, entity.id);
  const relationships = raw.map(window.MasterForgeRelationshipEngine.normaliseRelationshipRecord).filter(relationship => affiliationGroupTitle(relationship) && !(visibilityMode === "public" && relationship.relationshipType === "secretly_member_of"));
  const resolution = await window.MasterForgeInheritanceEngine.resolveForEntityRecord(entity, { visibilityMode });
  const groups = new Map();
  for (const relationship of relationships) {
    const isSource = relationship.sourceEntityType === entity.entity_type && relationship.sourceEntityId === entity.id;
    const otherType = isSource ? relationship.targetEntityType : relationship.sourceEntityType;
    const otherId = isSource ? relationship.targetEntityId : relationship.sourceEntityId;
    const other = await window.dmAPI.getEntity(otherType, otherId);
    const group = affiliationGroupTitle(relationship, isSource);
    const cards = groups.get(group) || [];
    let details = "";
    if (group === "Faction Memberships") {
      const faction = otherType === "faction" ? other : null;
      const rankId = relationship.data_json?.[getFactionMetadataRegistry().KEYS.FACTION_RANK_ID];
      const node = faction ? getFactionHierarchyNodeById(faction, rankId) : null;
      const count = [...resolution.grouped.traits, ...resolution.grouped.abilities].filter(feature => feature.relationshipId === relationship.id).length;
      details = `<div class="dmAffiliationFacts"><span>${relationship.relationshipType === "secretly_member_of" ? "Secret / GM-only" : "Public"}</span><span>${escapeHtml(node?.displayTitle || node?.name || "Unranked")}</span>${relationship.data_json?.primaryFaction === true ? `<span>Primary faction</span>` : ""}<span>Title: ${escapeHtml(relationship.data_json?.titleVisibility || "public")}</span><span>${count} inherited feature${count === 1 ? "" : "s"}</span></div>`;
    }
    cards.push(`<article class="dmAffiliationCard" data-affiliation-id="${escapeHtml(relationship.id)}"><div><strong>${escapeHtml(other?.name || otherId)}</strong><small>${escapeHtml(formatRelationshipLabel(relationship.relationshipType, isSource ? "outgoing" : "incoming"))}</small>${details}</div><div class="dmAffiliationActions">${group === "Faction Memberships" ? `<button type="button" data-edit-membership>Edit Membership</button><button type="button" data-change-membership-position>Change Position</button><button type="button" data-remove-membership>Remove Membership</button>` : `<button type="button" data-view-affiliation>View Relationship</button>`}<button type="button" data-open-affiliation data-other-type="${escapeHtml(otherType)}" data-other-id="${escapeHtml(otherId)}">Open ${group === "Faction Memberships" ? "Faction" : "Entity"}</button></div></article>`);
    groups.set(group, cards);
  }
  const ordered = ["Faction Memberships", "Party Memberships", "Party Group Memberships", "Vehicle Crew / Aboard", "Companions and Associates"];
  mount.innerHTML = `<div class="dmEntityWorkspacePanel"><div class="dmEntityPanelHeader"><div><h2>Affiliations</h2><p>Memberships and associations are read from canonical relationships.</p></div><button type="button" data-add-faction-membership>Add Faction Membership</button></div><div id="addFactionMembershipMount"></div>${ordered.map(group => `<section class="dmAffiliationGroup"><h3>${group}</h3>${groups.get(group)?.join("") || `<p class="forgeEmptyState">No ${group.toLowerCase()} yet.</p>`}</section>`).join("")}</div>`;
  const editorMount = mount.querySelector("#addFactionMembershipMount");
  editorMount?.removeAttribute("id");
  if (editorMount) editorMount.dataset.addFactionMembershipMount = "";
  mount.querySelector("[data-add-faction-membership]").onclick = () => renderFactionMembershipEditor(entity, null, {}, workspace);
  mount.querySelectorAll("[data-edit-membership]").forEach(button => button.onclick = async () => {
    const rel = relationships.find(item => item.id === button.closest("[data-affiliation-id]").dataset.affiliationId);
    await renderFactionMembershipEditor(entity, rel, { positionOnly: false }, workspace);
  });
  mount.querySelectorAll("[data-change-membership-position]").forEach(button => button.onclick = async () => {
    const rel = relationships.find(item => item.id === button.closest("[data-affiliation-id]").dataset.affiliationId);
    await renderFactionMembershipEditor(entity, rel, { positionOnly: true }, workspace);
  });
  mount.querySelectorAll("[data-remove-membership]").forEach(button => button.onclick = async () => {
    const id = button.closest("[data-affiliation-id]").dataset.affiliationId;
    if (!confirm("Remove this faction membership? Features inherited through this faction and position will stop applying. Personal features, the entity, faction, hierarchy and Ability Packs will not be changed.")) return;
    button.disabled = true;
    try {
      await window.MasterForgeRelationshipEngine.deleteRelationship(id);
      window.MasterForgeInheritanceEngine.clearCache();
      await renderDmEntityAffiliations(entity, { workspace });
      await refreshInheritanceAndFactionViews(entity);
    } catch (error) {
      button.disabled = false;
      alert(`The membership could not be removed. No other record was changed. ${error?.message || ""}`.trim());
    }
  });
  mount.querySelectorAll("[data-open-affiliation]").forEach(button => button.onclick = async () => {
    const other = await window.dmAPI.getEntity(button.dataset.otherType, button.dataset.otherId);
    if (!other) {
      alert("The referenced entity could not be found. No data was changed.");
      return;
    }
    if (other.entity_type === "faction") await openEntityLibraryRecord(other);
    else await openCanonicalEntityFromContext(other, workspace?.dataset.dmWorkspaceHost || "entity-library");
  });
  mount.querySelectorAll("[data-view-affiliation]").forEach(button => button.onclick = () => {
    const rel = relationships.find(item => item.id === button.closest("[data-affiliation-id]").dataset.affiliationId);
    if (rel) showUniversalRelationshipBuilder(entity, rel);
  });
}

async function renderLegacyAddFactionMembershipForm(entity) {
  const mount = document.querySelector("#addFactionMembershipMount");
  if (!mount) return;
  const factions = await window.dmAPI.getEntitiesByType("faction");
  mount.innerHTML = `<div class="dmAddAffiliationForm"><label>Faction<select data-new-faction-id>${factions.map(faction => `<option value="${escapeHtml(faction.id)}">${escapeHtml(faction.name || faction.id)}</option>`).join("")}</select></label><label>Membership visibility<select data-new-faction-visibility><option value="member_of">Public</option><option value="secretly_member_of">Secret / GM-only</option></select></label><div class="dmEntityQuickActions"><button type="button" data-create-faction-membership ${factions.length ? "" : "disabled"}>Add Membership</button><button type="button" data-cancel-faction-membership>Cancel</button></div><span data-new-faction-status></span></div>`;
  mount.querySelector("[data-cancel-faction-membership]").onclick = () => { mount.innerHTML = ""; };
  mount.querySelector("[data-create-faction-membership]").onclick = async () => {
    const factionId = mount.querySelector("[data-new-faction-id]").value;
    const relationshipType = mount.querySelector("[data-new-faction-visibility]").value;
    const status = mount.querySelector("[data-new-faction-status]");
    try {
      status.textContent = "Adding…";
      const existing = await window.MasterForgeRelationshipEngine.relationshipExists({ sourceEntityType: entity.entity_type, sourceEntityId: entity.id, relationshipType, targetEntityType: "faction", targetEntityId: factionId });
      if (existing) throw new Error("This membership already exists.");
      await window.MasterForgeRelationshipEngine.createRelationship({
        id: window.dmStorage.slugify(["membership", entity.entity_type, entity.id, relationshipType, factionId, Date.now()].join("-")),
        sourceEntityType: entity.entity_type, sourceEntityId: entity.id, relationshipType,
        targetEntityType: "faction", targetEntityId: factionId,
        metadata: {
          [getFactionMetadataRegistry().KEYS.TITLE_VISIBILITY]: relationshipType === "secretly_member_of" ? getFactionMetadataRegistry().TITLE_VISIBILITY.GM : getFactionMetadataRegistry().TITLE_VISIBILITY.PUBLIC,
          [getFactionMetadataRegistry().KEYS.PRIMARY_FACTION]: false,
          [getFactionMetadataRegistry().KEYS.SHOW_TITLE_IN_DISPLAY_NAME]: true
        }
      });
      await renderDmEntityAffiliations(entity);
    } catch (error) { status.textContent = error?.message || "Membership could not be added."; }
  };
}

async function getEntityFactionMemberships(entity) {
  const engine = window.MasterForgeRelationshipEngine;
  return (await engine.getRelationshipsForEntity(entity.entity_type, entity.id))
    .map(engine.normaliseRelationshipRecord)
    .filter(rel => rel.sourceEntityType === entity.entity_type && rel.sourceEntityId === entity.id && rel.targetEntityType === "faction" && FACTION_MEMBERSHIP_TYPES.has(rel.relationshipType));
}

function getFactionMembershipFormMetadata(form, type, previous = {}) {
  const registry = getFactionMetadataRegistry();
  const showTitle = form.querySelector("[data-membership-show-title]")?.checked !== false;
  return {
    ...previous,
    [registry.KEYS.FACTION_RANK_ID]: form.querySelector("[data-membership-position]")?.value || "",
    [registry.KEYS.PRIMARY_FACTION]: form.querySelector("[data-membership-primary]")?.checked === true,
    [registry.KEYS.TITLE_VISIBILITY]: showTitle ? (type === "secretly_member_of" ? registry.TITLE_VISIBILITY.GM : registry.TITLE_VISIBILITY.PUBLIC) : registry.TITLE_VISIBILITY.HIDDEN,
    [registry.KEYS.SHOW_TITLE_IN_DISPLAY_NAME]: showTitle
  };
}

function parseFactionRecordDataJson(faction) {
  const raw = faction?.data_json;
  if (raw === null || raw === undefined || raw === "") return {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  }
  throw new Error("Unable to load this faction's hierarchy.");
}

function getFactionPositionLabel(node) {
  return node?.displayTitle || node?.name || node?.titleFormat || node?.id || "Unnamed Position";
}

async function loadMembershipFaction(factionId) {
  if (!factionId) throw new Error("Unable to load this faction's hierarchy.");
  const faction = await window.dmAPI.getEntity("faction", factionId);
  if (!faction) throw new Error("Unable to load this faction's hierarchy.");
  try {
    return { ...faction, data_json: parseFactionRecordDataJson(faction) };
  } catch (error) {
    console.warn(`Faction hierarchy data could not be parsed for ${factionId}:`, error);
    throw new Error("Unable to load this faction's hierarchy.");
  }
}

async function renderFactionMembershipPreview(form, faction) {
  const preview = form.querySelector("[data-membership-preview]");
  if (!preview) return;
  if (!faction) {
    preview.innerHTML = `<p class="forgeEmptyState">Choose a faction to preview inherited features.</p>`;
    return;
  }
  const nodeId = form.querySelector("[data-membership-position]")?.value || "";
  const node = getFactionHierarchyNodeById(faction, nodeId);
  const packs = await getAllAbilityPacks();
  const byId = new Map(packs.map(pack => [pack.id, pack]));
  const factionIds = Array.isArray(faction.data_json?.abilityPackIds) ? faction.data_json.abilityPackIds : [];
  const nodeIds = Array.isArray(node?.abilityPackIds) ? node.abilityPackIds : [];
  const localTraits = (Array.isArray(faction.data_json?.traits) ? faction.data_json.traits : []).map(getAbilityPackApi().normaliseTrait).filter(item => item.active);
  const featureIds = new Set();
  let traits = 0;
  let abilities = 0;
  localTraits.forEach(item => { const key = `trait:${item.id}`; if (!featureIds.has(key)) { featureIds.add(key); traits += 1; } });
  [...factionIds, ...nodeIds].forEach(packId => {
    const data = byId.has(packId) ? getAbilityPackApi().normalisePackData(byId.get(packId).data_json) : null;
    if (!data?.active) return;
    data.traits.filter(item => item.active).forEach(item => { const key = `trait:${item.id}`; if (!featureIds.has(key)) { featureIds.add(key); traits += 1; } });
    data.abilities.filter(item => item.active).forEach(item => { const key = `ability:${item.id}`; if (!featureIds.has(key)) { featureIds.add(key); abilities += 1; } });
  });
  const names = ids => ids.length ? ids.map(id => escapeHtml(byId.get(id)?.name || `${id} (missing)`)).join(", ") : "None";
  preview.innerHTML = `<strong>This membership will provide:</strong><dl><dt>Faction-wide Ability Packs:</dt><dd>${names(factionIds)}</dd><dt>Hierarchy-node Ability Packs:</dt><dd>${names(nodeIds)}</dd><dt>Local faction traits:</dt><dd>${localTraits.length ? localTraits.map(item => escapeHtml(item.name || item.id)).join(", ") : "None"}</dd><dt>Selected position:</dt><dd>${node ? escapeHtml(getFactionPositionLabel(node)) : "No Position / Unranked"}</dd></dl><p><strong>Resolved trait total:</strong> ${traits} &nbsp; <strong>Resolved ability total:</strong> ${abilities}</p>`;
}

async function refreshFactionMembershipEditor(form, factions, relationship, positionOnly) {
  const factionId = relationship?.targetEntityId || form.querySelector("[data-membership-faction]")?.value;
  const select = form.querySelector("[data-membership-position]");
  const guidance = form.querySelector("[data-membership-hierarchy-guidance]");
  const warning = form.querySelector("[data-membership-position-warning]");
  if (!select) return;
  let faction;
  try {
    faction = await loadMembershipFaction(factionId);
    form._membershipFaction = faction;
  } catch (error) {
    form._membershipFaction = null;
    select.innerHTML = `<option value="">No Position / Unranked</option>`;
    select.disabled = true;
    if (warning) warning.textContent = "Unable to load this faction's hierarchy.";
    if (guidance) guidance.innerHTML = "";
    await renderFactionMembershipPreview(form, null);
    return;
  }
  select.disabled = false;
  const registry = getFactionMetadataRegistry();
  const selected = select.value || relationship?.data_json?.[registry.KEYS.FACTION_RANK_ID] || "";
  const includeInactive = form.querySelector("[data-membership-include-inactive]")?.checked === true;
  const allNodes = getFactionHierarchyApi().sortFactionHierarchyNodes(getFactionHierarchyApi().normaliseFactionHierarchy(faction.data_json || {}).nodes);
  const eligible = allNodes.filter(node => node.active || includeInactive);
  const matchedCurrent = selected ? allNodes.find(node => node.id === selected) : null;
  const unavailable = matchedCurrent && !eligible.some(node => node.id === selected) ? matchedCurrent : null;
  const missing = selected && !matchedCurrent ? selected : "";
  const optionLabel = node => `${getFactionPositionLabel(node)}${node.hidden ? " — Hidden" : ""}${node.active ? "" : " — Inactive"}`;
  select.innerHTML = `<option value="">No Position / Unranked</option>${missing ? `<option value="${escapeHtml(missing)}">Missing Position — ${escapeHtml(missing)}</option>` : ""}${unavailable ? `<option value="${escapeHtml(unavailable.id)}">${escapeHtml(optionLabel(unavailable))}</option>` : ""}${eligible.filter(node => node.id !== unavailable?.id).map(node => `<option value="${escapeHtml(node.id)}">${escapeHtml(optionLabel(node))}</option>`).join("")}`;
  select.value = selected;
  if (warning) warning.textContent = missing ? `The saved position ${missing} no longer matches a hierarchy node. It will be retained until you save a replacement.` : "";
  if (guidance) guidance.innerHTML = allNodes.length ? "" : `<div><span>This faction has no positions yet.</span><small>Create positions such as Captain, First Mate, Officer or Crew, then return here to assign one.</small></div><button type="button" data-open-faction-hierarchy>Open Faction Hierarchy</button>`;
  const hierarchyButton = guidance?.querySelector("[data-open-faction-hierarchy]");
  if (hierarchyButton) hierarchyButton.onclick = async event => {
    event.preventDefault();
    event.stopPropagation();
    hierarchyButton.disabled = true;
    try {
      await openFactionHierarchyFromMembership(faction, form._membershipSourceEntity, form.closest(".dmEntityWorkspace"));
    } catch (error) {
      hierarchyButton.disabled = false;
      if (warning) warning.textContent = error?.message || "The Faction Hierarchy could not be opened.";
    }
  };
  if (positionOnly) {
    const current = form.querySelector("[data-membership-current-position]");
    const node = allNodes.find(item => item.id === relationship?.data_json?.[registry.KEYS.FACTION_RANK_ID]);
    if (current) current.textContent = node ? getFactionPositionLabel(node) : relationship?.data_json?.[registry.KEYS.FACTION_RANK_ID] ? "Missing Position" : "No Position / Unranked";
  }
  await renderFactionMembershipPreview(form, faction);
}

async function makeMembershipSolePrimary(entity, savedId) {
  const registry = getFactionMetadataRegistry();
  const others = (await getEntityFactionMemberships(entity)).filter(item => item.id !== savedId && item.data_json?.[registry.KEYS.PRIMARY_FACTION] === true);
  for (const other of others) {
    await window.MasterForgeRelationshipEngine.updateRelationshipMetadata(other.id, { data_json: { [registry.KEYS.PRIMARY_FACTION]: false } });
  }
}

async function safelyReplaceFactionMembership(rel, type, metadata) {
  const engine = window.MasterForgeRelationshipEngine;
  const id = window.dmStorage.slugify(["membership", rel.sourceEntityType, rel.sourceEntityId, type, rel.targetEntityId, Date.now()].join("-"));
  await engine.createRelationship({ id, sourceEntityType: rel.sourceEntityType, sourceEntityId: rel.sourceEntityId, relationshipType: type, targetEntityType: rel.targetEntityType, targetEntityId: rel.targetEntityId, campaignId: rel.campaignId, visibility: rel.visibility, status: rel.status, startDate: rel.startDate, endDate: rel.endDate, notes: rel.notes, strength: rel.strength, metadata });
  const replacement = (await engine.getRelationshipsForEntity(rel.sourceEntityType, rel.sourceEntityId)).map(engine.normaliseRelationshipRecord).find(item => item.id === id);
  if (!replacement) throw new Error("The replacement membership could not be verified; the original was kept.");
  try {
    await engine.deleteRelationship(rel.id);
  } catch (error) {
    try { await engine.deleteRelationship(id); } catch (rollbackError) { console.error("Membership replacement rollback failed:", rollbackError); }
    throw new Error(`The original membership could not be removed; the replacement was rolled back. ${error?.message || ""}`.trim());
  }
  return replacement;
}

async function refreshInheritanceAndFactionViews(entity, factionId = "") {
  window.MasterForgeInheritanceEngine.clearCache();
  await refreshUniversalRelationshipPanels();
  const openFaction = entityBuilderState?.activeEntity;
  if (openFaction?.entity_type === "faction" && (!factionId || openFaction.id === factionId) && entityBuilderState.factionWorkspaceTab === "members" && document.querySelector('[data-faction-tab="members"].active')) {
    await renderFactionMembersWorkspace();
  }
}

async function renderFactionMembershipEditor(entity, relationship = null, { positionOnly = false } = {}, workspace) {
  const mount = workspace?.querySelector("[data-add-faction-membership-mount]");
  if (!mount) return;
  const factions = await window.dmAPI.getEntitiesByType("faction");
  const registry = getFactionMetadataRegistry();
  const currentType = relationship?.relationshipType || "member_of";
  const currentData = relationship?.data_json || {};
  mount.innerHTML = `<form class="dmAddAffiliationForm dmMembershipEditor" data-membership-editor>
    <div class="dmMembershipEditorHeader"><div><h3>${positionOnly ? "Change Position" : relationship ? "Edit Faction Membership" : "Add Faction Membership"}</h3>${positionOnly ? `<p>Current: <strong data-membership-current-position>Loading…</strong></p>` : ""}</div><button type="button" data-cancel-faction-membership>Cancel</button></div>
    ${positionOnly ? `<input type="hidden" data-membership-faction value="${escapeHtml(relationship.targetEntityId)}">` : `<label>Faction<select data-membership-faction ${relationship ? "disabled" : ""}>${factions.map(faction => `<option value="${escapeHtml(faction.id)}" ${faction.id === relationship?.targetEntityId ? "selected" : ""}>${escapeHtml(faction.name || faction.id)}</option>`).join("")}</select></label><label>Membership type<select data-membership-type><option value="member_of" ${currentType === "member_of" ? "selected" : ""}>Public Member</option><option value="secretly_member_of" ${currentType === "secretly_member_of" ? "selected" : ""}>Secret Member</option></select></label>`}
    <label>Position<select data-membership-position></select></label>
    <label class="dmMembershipOption"><input type="checkbox" data-membership-include-inactive> Include inactive positions</label>
    <div class="dmMembershipHierarchyGuidance" data-membership-hierarchy-guidance></div>
    <p class="dmMembershipPositionWarning" data-membership-position-warning></p>
    ${positionOnly ? "" : `<label class="dmMembershipOption"><input type="checkbox" data-membership-primary ${currentData[registry.KEYS.PRIMARY_FACTION] === true ? "checked" : ""}> Primary faction</label><label class="dmMembershipOption"><input type="checkbox" data-membership-show-title ${currentData[registry.KEYS.TITLE_VISIBILITY] === registry.TITLE_VISIBILITY.HIDDEN || currentData[registry.KEYS.SHOW_TITLE_IN_DISPLAY_NAME] === false ? "" : "checked"}> <span data-membership-title-label>Show title publicly</span></label>`}
    <section class="dmMembershipPreview" data-membership-preview><p class="forgeEmptyState">Loading inheritance preview…</p></section>
    <div class="dmEntityQuickActions"><button type="submit" ${factions.length || relationship ? "" : "disabled"}>${positionOnly ? "Save Position" : relationship ? "Save Membership" : "Add Membership"}</button></div><span class="factionValidation" data-membership-status></span>
  </form>`;
  const form = mount.querySelector("[data-membership-editor]");
  form._membershipSourceEntity = entity;
  const titleLabel = () => { const label = form.querySelector("[data-membership-title-label]"); if (label) label.textContent = form.querySelector("[data-membership-type]")?.value === "secretly_member_of" ? "Show title in GM view" : "Show title publicly"; };
  form.querySelector("[data-cancel-faction-membership]").onclick = () => { mount.innerHTML = ""; };
  form.querySelector("[data-membership-faction]")?.addEventListener("change", () => refreshFactionMembershipEditor(form, factions, relationship, positionOnly));
  form.querySelector("[data-membership-type]")?.addEventListener("change", titleLabel);
  form.querySelector("[data-membership-position]").addEventListener("change", () => renderFactionMembershipPreview(form, form._membershipFaction));
  form.querySelector("[data-membership-include-inactive]").addEventListener("change", () => refreshFactionMembershipEditor(form, factions, relationship, positionOnly));
  titleLabel();
  await refreshFactionMembershipEditor(form, factions, relationship, positionOnly);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const status = form.querySelector("[data-membership-status]");
    const engine = window.MasterForgeRelationshipEngine;
    const factionId = relationship?.targetEntityId || form.querySelector("[data-membership-faction]").value;
    const type = positionOnly ? relationship.relationshipType : form.querySelector("[data-membership-type]").value;
    try {
      status.textContent = "Saving…";
      if (positionOnly) {
        await engine.updateRelationshipMetadata(relationship.id, { data_json: { [registry.KEYS.FACTION_RANK_ID]: form.querySelector("[data-membership-position]").value || "" } });
      } else {
        const memberships = await getEntityFactionMemberships(entity);
        if (memberships.some(item => item.id !== relationship?.id && item.targetEntityId === factionId)) throw new Error("This entity already has a membership in that faction. Edit the existing membership instead.");
        const metadata = getFactionMembershipFormMetadata(form, type, currentData);
        const replacingPrimary = metadata[registry.KEYS.PRIMARY_FACTION] && memberships.some(item => item.id !== relationship?.id && item.data_json?.[registry.KEYS.PRIMARY_FACTION] === true);
        if (replacingPrimary && !confirm("Another faction membership is already primary. Make this the sole primary membership?")) throw new Error("Save cancelled; the existing primary membership was not changed.");
        let saved;
        if (!relationship) {
          const id = window.dmStorage.slugify(["membership", entity.entity_type, entity.id, type, factionId, Date.now()].join("-"));
          await engine.createRelationship({ id, sourceEntityType: entity.entity_type, sourceEntityId: entity.id, relationshipType: type, targetEntityType: "faction", targetEntityId: factionId, metadata });
          saved = (await getEntityFactionMemberships(entity)).find(item => item.id === id);
          if (!saved) throw new Error("The new membership could not be verified.");
        } else if (type !== relationship.relationshipType) saved = await safelyReplaceFactionMembership(relationship, type, metadata);
        else { await engine.updateRelationshipMetadata(relationship.id, { data_json: metadata, mergeDataJson: false }); saved = { ...relationship, data_json: metadata }; }
        if (metadata[registry.KEYS.PRIMARY_FACTION]) await makeMembershipSolePrimary(entity, saved.id);
      }
      await renderDmEntityAffiliations(entity, { workspace });
      await refreshInheritanceAndFactionViews(entity, factionId);
    } catch (error) {
      status.textContent = error?.message || "Membership could not be saved.";
    }
  });
}

window.runFactionPositionSelectorDiagnostic = async function (entityType, entityId) {
  const warnings = [];
  const entity = await window.dmAPI.getEntity(entityType, entityId);
  if (!entity) throw new Error(`Entity not found: ${entityType}/${entityId}`);
  const relationships = await getEntityFactionMemberships(entity);
  const membershipRelationship = relationships[0] || null;
  if (relationships.length > 1) warnings.push(`Multiple faction memberships found; reporting the first of ${relationships.length}.`);
  if (!membershipRelationship) warnings.push("No canonical faction membership relationship was found.");
  let faction = null;
  let hierarchy = { nodes: [] };
  let hierarchyFound = false;
  if (membershipRelationship) {
    try {
      faction = await loadMembershipFaction(membershipRelationship.targetEntityId);
      hierarchyFound = Object.prototype.hasOwnProperty.call(faction.data_json, "factionHierarchy");
      hierarchy = getFactionHierarchyApi().normaliseFactionHierarchy(faction.data_json);
      if (!hierarchyFound) warnings.push("The faction has no factionHierarchy value.");
    } catch (error) {
      warnings.push(error?.message || "Unable to load this faction's hierarchy.");
    }
  }
  const registry = getFactionMetadataRegistry();
  const currentFactionRankId = membershipRelationship?.data_json?.[registry.KEYS.FACTION_RANK_ID] || "";
  const currentNode = hierarchy.nodes.find(node => node.id === currentFactionRankId) || null;
  if (currentFactionRankId && !currentNode) warnings.push(`Current position ${currentFactionRankId} does not match a hierarchy node.`);
  const selectorOptions = [
    { value: "", label: "No Position / Unranked" },
    ...getFactionHierarchyApi().sortFactionHierarchyNodes(hierarchy.nodes).filter(node => node.active).map(node => ({ value: node.id, label: `${getFactionPositionLabel(node)}${node.hidden ? " — Hidden" : ""}` }))
  ];
  console.table(hierarchy.nodes.map(node => ({ id: node.id, displayTitle: node.displayTitle, nodeType: node.nodeType, active: node.active, hidden: node.hidden, abilityPackCount: node.abilityPackIds.length })));
  const result = {
    entity,
    membershipRelationship,
    faction,
    hierarchyFound,
    hierarchyNodeCount: hierarchy.nodes.length,
    activeNodeCount: hierarchy.nodes.filter(node => node.active).length,
    hiddenNodeCount: hierarchy.nodes.filter(node => node.hidden).length,
    inactiveNodeCount: hierarchy.nodes.filter(node => !node.active).length,
    currentFactionRankId,
    currentNodeMatched: Boolean(currentNode),
    selectorOptions,
    warnings
  };
  console.log("Faction position selector diagnostic", result);
  return result;
};

async function renderDmEntityRelationships(entity, workspace) {
  const mount = workspace?.querySelector("[data-dm-workspace-mount]");
  if (!mount) return;
  mount.innerHTML = `<div class="dmEntityWorkspacePanel"><p class="forgeEmptyState">Loading relationships…</p></div>`;
  const relationships = await getRelationshipsForEntityPanel(entity);
  const rows = await Promise.all(relationships.map(async relationship => {
    const normalised = window.MasterForgeRelationshipEngine.normaliseRelationshipRecord(relationship);
    const isSource = normalised.sourceEntityType === entity.entity_type && normalised.sourceEntityId === entity.id;
    const otherType = isSource ? normalised.targetEntityType : normalised.sourceEntityType;
    const otherId = isSource ? normalised.targetEntityId : normalised.sourceEntityId;
    const other = await window.dmAPI.getEntity(otherType, otherId);
    return `<article class="dmAffiliationCard" data-dm-relationship-id="${escapeHtml(normalised.id)}"><div><strong>${escapeHtml(other?.name || otherId)}</strong><small>${escapeHtml(formatRelationshipLabel(normalised.relationshipType, isSource ? "outgoing" : "incoming"))}</small></div><div class="dmAffiliationActions"><button type="button" data-view-dm-relationship>View Relationship</button><button type="button" data-open-dm-related data-other-type="${escapeHtml(otherType)}" data-other-id="${escapeHtml(otherId)}">Open Related Entity</button></div></article>`;
  }));
  mount.innerHTML = `<div class="dmEntityWorkspacePanel"><div class="dmEntityPanelHeader"><div><h2>Relationships</h2><p>Readable links for this entity. Technical editing remains available on demand.</p></div><div class="dmEntityQuickActions"><button type="button" data-dm-action="relationship">Add Relationship</button><button type="button" data-advanced-relationships>Advanced Relationship Manager</button></div></div>${rows.length ? rows.join("") : `<p class="forgeEmptyState">No relationships yet.</p>`}</div>`;
  mount.querySelectorAll("[data-view-dm-relationship]").forEach(button => button.onclick = () => {
    const relationship = relationships.find(item => window.MasterForgeRelationshipEngine.normaliseRelationshipRecord(item).id === button.closest("[data-dm-relationship-id]").dataset.dmRelationshipId);
    if (relationship) showUniversalRelationshipBuilder(entity, relationship);
  });
  mount.querySelectorAll("[data-open-dm-related]").forEach(button => button.onclick = async () => {
    const other = await window.dmAPI.getEntity(button.dataset.otherType, button.dataset.otherId);
    if (other) await openCanonicalEntityFromContext(other, workspace.dataset.dmWorkspaceHost || "entity-library");
  });
}

async function updateCurrentSessionUse(entity, add) {
  const session = await getCurrentSessionRecord();
  if (!session) throw new Error("Open or create a current session first.");
  const field = entity.entity_type === "npc" ? "selectedNpcIds" : entity.entity_type === "creature" ? "selectedCreatureIds" : null;
  if (!field) throw new Error("PC session inclusion is deferred because the current session format has no PC cast field.");
  const values = new Set(Array.isArray(session[field]) ? session[field] : []);
  if (add) values.add(entity.data_json?.npcId || entity.data_json?.creatureId || entity.id); else values.delete(entity.data_json?.npcId || entity.data_json?.creatureId || entity.id);
  session[field] = [...values];
  await window.dmAPI.saveRecord("sessions", session.id, session, window.dmState.current.campaign);
  if (field === "selectedNpcIds") currentSessionSelectedNpcIds = [...values]; else currentSessionSelectedCreatureIds = [...values];
}

async function renderDmEntitySessionUse(entity, workspace) {
  const mount = workspace?.querySelector("[data-dm-workspace-mount]");
  const session = await getCurrentSessionRecord();
  const sourceId = entity.data_json?.npcId || entity.data_json?.creatureId || entity.id;
  const ids = entity.entity_type === "npc" ? session?.selectedNpcIds : entity.entity_type === "creature" ? session?.selectedCreatureIds : [];
  const included = Array.isArray(ids) && ids.includes(sourceId);
  const supported = ["npc", "creature"].includes(entity.entity_type);
  mount.innerHTML = `<div class="dmEntityWorkspacePanel"><h2>Session Use</h2><div class="dmSessionStatus"><strong>${session ? escapeHtml(session.title || session.id) : "No current session"}</strong><span>${included ? "Included in the current session." : "This entity is not included in the current session."}</span></div><div class="dmEntityQuickActions"><button type="button" data-session-add ${!session || !supported || included ? "disabled" : ""}>Add to Current Session</button><button type="button" data-session-remove ${!session || !supported || !included ? "disabled" : ""}>Remove from Session</button><button type="button" disabled>Add to Encounter — Deferred</button><button type="button" disabled>Open Encounter Planner — Deferred</button></div>${supported ? "" : `<p class="forgeEmptyState">PC session inclusion is deferred until the current session format supports PC cast records.</p>`}</div>`;
  mount.querySelector("[data-session-add]").onclick = async () => { await updateCurrentSessionUse(entity, true); await renderDmEntitySessionUse(entity, workspace); };
  mount.querySelector("[data-session-remove]").onclick = async () => { await updateCurrentSessionUse(entity, false); await renderDmEntitySessionUse(entity, workspace); };
}

async function switchDmEntityWorkspace(tab, entity, workspace) {
  activeDmEntityWorkspaceTab = tab;
  workspace.querySelectorAll("[data-dm-entity-tab]").forEach(button => { const active = button.dataset.dmEntityTab === tab; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
  const mount = workspace.querySelector("[data-dm-workspace-mount]");
  if (!mount) return;
  try {
    if (tab === "overview") mount.innerHTML = renderDmEntityOverview(entity);
    if (tab === "features") await renderDmEntityFeatures(entity, workspace);
    if (tab === "affiliations") await renderDmEntityAffiliations(entity, { workspace });
    if (tab === "relationships") await renderDmEntityRelationships(entity, workspace);
    if (tab === "session-use") await renderDmEntitySessionUse(entity, workspace);
  } catch (error) {
    mount.innerHTML = `<div class="dmEntityWorkspacePanel"><p class="forgeEmptyState">This workspace could not be loaded. ${escapeHtml(error?.message || "Unknown error")}</p></div>`;
  }
  mount.querySelectorAll("[data-dm-tab-link]").forEach(button => button.onclick = () => switchDmEntityWorkspace(button.dataset.dmTabLink, entity, workspace));
  mount.querySelectorAll('[data-dm-action="edit"]').forEach(button => button.onclick = () => openCanonicalEntityEditor(entity));
  mount.querySelectorAll('[data-dm-action="location"]').forEach(button => button.onclick = () => entity.entity_type === "npc" ? openNpcEntityLocationEditor(entity) : openMoveEntityPanel(entity));
  mount.querySelectorAll('[data-dm-action="relationship"], [data-advanced-relationships]').forEach(button => button.onclick = () => showUniversalRelationshipBuilder(entity));
  mount.querySelectorAll("[data-focus-readable-relationships]").forEach(button => button.onclick = () => document.querySelector("#entity-debug-relationships")?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function setupDmEntityWorkspace(entity, workspace = document.querySelector(".dmEntityWorkspace"), { defaultTab = "overview" } = {}) {
  if (!workspace) return;
  activeDmEntityWorkspaceTab = defaultTab;
  workspace.querySelectorAll("[data-dm-entity-tab]").forEach(button => button.onclick = () => switchDmEntityWorkspace(button.dataset.dmEntityTab, entity, workspace));
  switchDmEntityWorkspace(defaultTab, entity, workspace);
}

function renderDmEntityWorkspaceShell(entity, { hostContext = "entity-library", defaultTab = "overview", compact = false } = {}) {
  const tabs = [["overview", "Overview"], ["features", "Features"], ["affiliations", "Affiliations"], ["relationships", "Relationships"], ["session-use", "Session Use"]];
  return `<section class="dmEntityWorkspace${compact ? " compact" : ""}" data-dm-workspace-host="${escapeHtml(hostContext)}" data-dm-workspace-entity-type="${escapeHtml(entity.entity_type)}" data-dm-workspace-entity-id="${escapeHtml(entity.id)}"><header class="dmSharedWorkspaceHeader"><div><h2>DM Workspace</h2><p>Canonical details, inherited features and relationships for ${escapeHtml(entity.presentationDisplayName || entity.name || entity.id)}.</p></div>${pendingDmWorkspaceReturn ? `<button type="button" class="dmWorkspaceReturn" data-dm-workspace-return>${escapeHtml(pendingDmWorkspaceReturn.label)}</button>` : ""}</header><nav class="dmEntityWorkspaceTabs" aria-label="${escapeHtml(formatEntityTypeLabel(entity.entity_type))} DM workspace">${tabs.map(([key, label]) => `<button type="button" data-dm-entity-tab="${key}" class="${key === defaultTab ? "active" : ""}" aria-pressed="${key === defaultTab}">${label}</button>`).join("")}</nav><div data-dm-workspace-mount></div></section>`;
}

async function renderDmEntityWorkspace(entityOrType, entityIdOrOptions = {}, maybeOptions = {}) {
  const options = typeof entityOrType === "string" ? maybeOptions : entityIdOrOptions;
  const entity = typeof entityOrType === "string"
    ? await window.dmAPI.getEntity(entityOrType, entityIdOrOptions)
    : entityOrType;
  if (!entity) throw new Error("The canonical entity record could not be loaded.");
  const displayResolution = entity.presentationDisplayName
    ? null
    : await resolveFactionMemberDisplayTitle(entity, {
        visibilityMode: "gm"
      }).catch(() => null);
  const presentationEntity = displayResolution
    ? { ...entity, presentationDisplayName: displayResolution.displayName }
    : entity;
  const host = typeof options.mount === "string" ? document.querySelector(options.mount) : options.mount;
  if (!host) throw new Error("A DM workspace host is required.");
  host.innerHTML = renderDmEntityWorkspaceShell(presentationEntity, options);
  const workspace = host.querySelector(".dmEntityWorkspace");
  const returnContext = pendingDmWorkspaceReturn;
  workspace.querySelector("[data-dm-workspace-return]")?.addEventListener("click", () => returnContext?.action?.());
  setupDmEntityWorkspace(presentationEntity, workspace, options);
  return workspace;
}

async function mountCanonicalDmWorkspace(entityType, sourceRecord, hostContext) {
  const host = document.querySelector(`[data-canonical-dm-workspace-host="${hostContext}"]`);
  if (!host) return null;
  const entityId = sourceRecord?.entityId || sourceRecord?.id;
  if (!entityId) {
    host.innerHTML = `<p class="forgeEmptyState">Save this ${escapeHtml(formatEntityTypeLabel(entityType).toLowerCase())} to enable the DM Workspace.</p>`;
    return null;
  }
  const entity = await window.dmAPI.getEntity(entityType, entityId);
  if (!entity) {
    host.innerHTML = `<p class="forgeEmptyState">Save this record to create its canonical entity workspace.</p>`;
    return null;
  }
  const displayResolution = await resolveFactionMemberDisplayTitle(entity, {
    visibilityMode: "gm"
  }).catch(() => null);
  const presentationEntity = displayResolution
    ? { ...entity, presentationDisplayName: displayResolution.displayName }
    : entity;
  const titleTarget = hostContext === "npc"
    ? document.querySelector("#npcEditorTitle")
    : hostContext === "creature"
      ? document.querySelector("#creatureEditorTitle")
      : null;
  if (titleTarget && displayResolution?.displayName) {
    titleTarget.textContent = displayResolution.displayName;
  }
  const result = await renderDmEntityWorkspace(presentationEntity, { mount: host, hostContext, defaultTab: "overview" });
  pendingDmWorkspaceReturn = null;
  return result;
}

window.renderDmEntityWorkspace = renderDmEntityWorkspace;

window.runDmEntityWorkspaceDiagnostic = async function (entityType, entityId) {
  const warnings = [];
  const entity = await window.dmAPI.getEntity(entityType, entityId);
  const detached = document.createElement("div");
  const supported = ["npc", "pc", "creature"].includes(entityType);
  if (entity) detached.innerHTML = renderDmEntityWorkspaceShell(entity, { hostContext: "diagnostic" });
  const tabs = [...detached.querySelectorAll("[data-dm-entity-tab]")].map(button => button.dataset.dmEntityTab);
  const ids = [...detached.querySelectorAll("[id]")].map(node => node.id);
  const duplicateDomIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  let affiliationsRendered = false;
  let inheritedFeaturesRendered = false;
  let relationshipsRendered = false;
  if (entity) {
    try { await window.MasterForgeRelationshipEngine.getRelationshipsForEntity(entityType, entityId); affiliationsRendered = true; relationshipsRendered = true; } catch (error) { warnings.push(`Relationship read failed: ${error?.message || error}`); }
    try { await window.MasterForgeInheritanceEngine.resolveForEntityRecord(entity, { visibilityMode: "gm" }); inheritedFeaturesRendered = true; } catch (error) { warnings.push(`Inheritance read failed: ${error?.message || error}`); }
  } else warnings.push("Canonical entity record was not found.");
  const result = {
    entityLoaded: Boolean(entity),
    canonicalRouteFound: supported,
    sharedRendererUsed: typeof renderDmEntityWorkspace === "function",
    tabsPresent: tabs,
    affiliationsRendered,
    inheritedFeaturesRendered,
    relationshipsRendered,
    sessionUseRendered: typeof renderDmEntitySessionUse === "function" && tabs.includes("session-use"),
    duplicateDomIds,
    activeHandlersWarning: false,
    hostContextsTested: [entityType === "pc" ? "pc" : entityType, "entity-library", "diagnostic"].filter(Boolean),
    warnings
  };
  console.table([{ entityType, entityId, entityLoaded: result.entityLoaded, tabs: tabs.length, duplicateIds: duplicateDomIds.length, warnings: warnings.length }]);
  console.log("DM entity workspace diagnostic", result);
  return result;
};

window.runDmWorkspaceLayoutDiagnostic = function (entityType, entityId) {
  const warnings = [];
  const workspaces = [...document.querySelectorAll(`.dmEntityWorkspace[data-dm-workspace-entity-type="${CSS.escape(entityType)}"][data-dm-workspace-entity-id="${CSS.escape(entityId)}"]`)];
  const workspace = workspaces.find(item => item.closest(".canonicalDmWorkspaceHost")) || workspaces[0] || null;
  const host = workspace?.closest(".canonicalDmWorkspaceHost") || workspace?.parentElement || null;
  const mount = workspace?.querySelector("[data-dm-workspace-mount]") || null;
  const content = mount?.firstElementChild || null;
  const formMount = host?.previousElementSibling || null;
  const parent = host?.parentElement || null;
  const workspaceStyle = workspace ? getComputedStyle(workspace) : null;
  const parentStyle = host ? getComputedStyle(host) : null;
  const workspaceRect = workspace?.getBoundingClientRect();
  const hostRect = host?.getBoundingClientRect();
  const previousRect = formMount?.getBoundingClientRect();
  const nextSiblingRectRaw = host?.nextElementSibling?.getBoundingClientRect() || null;
  const background = workspaceStyle?.backgroundColor || "";
  const backgroundImage = workspaceStyle?.backgroundImage || "none";
  const alphaMatch = background.match(/rgba?\([^)]*[,\s]([\d.]+)\)$/);
  const backgroundIsTransparent = backgroundImage === "none" && (background === "transparent" || background === "rgba(0, 0, 0, 0)" || (alphaMatch ? Number(alphaMatch[1]) < 1 : false));
  const contentHeight = mount?.scrollHeight || 0;
  const workspaceHeight = workspaceRect?.height || 0;
  const isClipped = Boolean(mount && (mount.scrollHeight > mount.clientHeight + 1 || mount.scrollWidth > mount.clientWidth + 1) && ["hidden", "clip"].includes(getComputedStyle(mount).overflow));
  const overlapPixels = previousRect && hostRect ? Math.max(0, Math.round(previousRect.bottom - hostRect.top)) : 0;
  const overlapsPreviousSibling = overlapPixels > 0;
  const rectObject = rect => rect ? { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height } : null;
  const describeNode = node => {
    if (!node) return null;
    const style = getComputedStyle(node);
    return { tag: node.tagName.toLowerCase(), className: node.className || "", dataAttributes: { ...node.dataset }, display: style.display, position: style.position, float: style.cssFloat, clear: style.clear, height: style.height, minHeight: style.minHeight, maxHeight: style.maxHeight, overflow: style.overflow, contain: style.contain, transform: style.transform, gridColumn: style.gridColumn, gridRow: style.gridRow, flex: style.flex, alignSelf: style.alignSelf, zIndex: style.zIndex, margin: style.margin, inset: style.inset, pointerEvents: style.pointerEvents, boundingRect: rectObject(node.getBoundingClientRect()) };
  };
  const mountChain = [parent, formMount, host, workspace, mount, content].filter(Boolean).map(describeNode);
  const numberStyle = (style, property) => Number.parseFloat(style?.[property]) || 0;
  const parentComputed = parent ? getComputedStyle(parent) : null;
  const hostComputed = host ? getComputedStyle(host) : null;
  const parentRect = parent?.getBoundingClientRect() || null;
  const parentScrollHeight = parent?.scrollHeight || 0;
  const parentClientHeight = parent?.clientHeight || 0;
  const parentOffsetHeight = parent?.offsetHeight || 0;
  const parentScrollTop = parent?.scrollTop || 0;
  const parentBorderTop = numberStyle(parentComputed, "borderTopWidth");
  const parentBorderBottom = numberStyle(parentComputed, "borderBottomWidth");
  const parentPaddingTop = numberStyle(parentComputed, "paddingTop");
  const parentPaddingBottom = numberStyle(parentComputed, "paddingBottom");
  const hostMarginTop = numberStyle(hostComputed, "marginTop");
  const hostMarginBottom = numberStyle(hostComputed, "marginBottom");
  const hostBottomInParentContent = hostRect && parentRect
    ? hostRect.bottom - parentRect.top - parentBorderTop + parentScrollTop
    : 0;
  const containmentDifference = parentScrollHeight - hostBottomInParentContent;
  const containmentValid = Boolean(parent && host && containmentDifference >= -1);
  const legacyRequiredParentHeight = host ? host.offsetTop + host.offsetHeight : 0;
  const legacyCoordinateDifference = legacyRequiredParentHeight - hostBottomInParentContent;
  const measurementFormula = "hostRect.bottom - parentRect.top - parentBorderTop + parent.scrollTop <= parent.scrollHeight (1px subpixel tolerance)";
  const flowPositionsValid = mountChain.every(item => !["absolute", "fixed"].includes(item.position));
  const nextSiblingAfterWorkspace = !nextSiblingRectRaw || !workspaceRect || nextSiblingRectRaw.top >= workspaceRect.bottom - 1;
  const participatesInFlow = Boolean(workspace && flowPositionsValid && containmentValid && overlapPixels === 0 && !isClipped && nextSiblingAfterWorkspace);
  const selectorPath = element => {
    if (!element) return "";
    const parts = [];
    let current = element;
    while (current?.nodeType === Node.ELEMENT_NODE) {
      if (current.id) { parts.unshift(`#${CSS.escape(current.id)}`); break; }
      const classes = [...current.classList].map(value => `.${CSS.escape(value)}`).join("");
      parts.unshift(`${current.tagName.toLowerCase()}${classes}`);
      current = current.parentElement;
    }
    return parts.join(" > ");
  };
  let offendingSelector = "";
  let offendingNode = null;
  if (!flowPositionsValid) offendingNode = [parent, formMount, host, workspace, mount, content].filter(Boolean).find(node => ["absolute", "fixed"].includes(getComputedStyle(node).position)) || null;
  else if (overlapPixels > 0) offendingNode = formMount;
  else if (!containmentValid) offendingNode = parent;
  if (offendingNode) offendingSelector = selectorPath(offendingNode);
  const offendingElement = offendingNode ? { tag: offendingNode.tagName.toLowerCase(), id: offendingNode.id || "", classes: [...offendingNode.classList], selectorPath: offendingSelector } : null;
  if (!workspace) warnings.push("No matching DM Workspace is currently mounted.");
  if (isClipped) warnings.push("The active workspace content is clipped.");
  if (overlapsPreviousSibling) warnings.push("The workspace overlaps its previous sibling.");
  if (backgroundIsTransparent) warnings.push("The workspace computed background is transparent.");
  if (!containmentValid) warnings.push("The workspace host bottom exceeds the scrolling parent's content extent.");
  const result = { workspaceFound: Boolean(workspace), hostContext: workspace?.dataset.dmWorkspaceHost || "", parentPosition: parentStyle?.position || "", workspacePosition: workspaceStyle?.position || "", parentOverflow: parentStyle?.overflow || "", workspaceHeight, contentHeight, isClipped, overlapsPreviousSibling, backgroundIsTransparent, duplicateWorkspaceInstances: Math.max(0, workspaces.length - 1), mountChain, nextSiblingRect: rectObject(nextSiblingRectRaw), overlapPixels, parentClientHeight, parentOffsetHeight, parentScrollHeight, parentScrollTop, parentRectTop: parentRect?.top || 0, parentRectBottom: parentRect?.bottom || 0, parentBorderTop, parentBorderBottom, parentPaddingTop, parentPaddingBottom, hostRectTop: hostRect?.top || 0, hostRectBottom: hostRect?.bottom || 0, hostBottomInParentContent, hostMarginTop, hostMarginBottom, containmentDifference, measurementFormula, containmentValid, legacyRequiredParentHeight, legacyCoordinateDifference, parentSelector: selectorPath(parent), hostOffsetParentSelector: selectorPath(host?.offsetParent), participatesInFlow, offendingSelector, offendingElement, warnings };
  console.table([result]);
  return result;
};

window.runFactionHierarchyNavigationDiagnostic = async function (entityType, entityId) {
  const warnings = [];
  const entity = await window.dmAPI.getEntity(entityType, entityId);
  const memberships = entity ? await getEntityFactionMemberships(entity) : [];
  const membership = memberships[0] || null;
  const factionId = membership?.targetEntityId || "";
  let faction = null;
  if (factionId) {
    try { faction = await loadMembershipFaction(factionId); } catch (error) { warnings.push(error?.message || "Faction could not be loaded."); }
  }
  if (!entity) warnings.push("Entity could not be loaded.");
  if (!membership) warnings.push("No canonical faction membership was found.");
  const workspace = document.querySelector(`.dmEntityWorkspace[data-dm-workspace-entity-type="${CSS.escape(entityType)}"][data-dm-workspace-entity-id="${CSS.escape(entityId)}"]`);
  const button = workspace?.querySelector("[data-open-faction-hierarchy]") || null;
  const result = {
    membershipFound: Boolean(membership),
    factionId,
    factionLoaded: Boolean(faction),
    factionRouteAvailable: typeof showGenericEntityBuilder === "function" && typeof activateMainPanel === "function",
    hierarchyTabAvailable: Boolean(document.querySelector('[data-faction-tab="hierarchy"]')) || typeof switchFactionWorkspace === "function",
    buttonFound: Boolean(button),
    handlerAttached: typeof button?.onclick === "function",
    pointerEvents: button ? getComputedStyle(button).pointerEvents : "",
    navigationTarget: faction ? `entities/faction/${faction.id}/hierarchy` : "",
    warnings
  };
  console.table([result]);
  return result;
};

function formatInheritedFeatureSource(feature) {
  let text = "Personal";
  if (feature.sourceType === "faction") text = `From ${feature.factionName || feature.sourceName}`;
  if (feature.sourceType === "factionAbilityPack") text = `From ${feature.sourceName} via ${feature.factionName}`;
  if (feature.sourceType === "hierarchyAbilityPack") text = `From ${feature.sourceName} via ${feature.hierarchyNodeName} — ${feature.factionName}`;
  if (feature.sourceType === "relationshipProfile") text = `From ${feature.sourceName}`;
  return feature.secret ? `GM-only: ${text}` : text;
}

function renderInheritedFeatureRow(feature, resolution) {
  const conflicted = resolution.conflicts.some(conflict => conflict.featureId === feature.id);
  return `<article class="inheritedFeatureRow">
    <div class="inheritedFeatureMain"><strong>${escapeHtml(feature.name)}</strong><small>${escapeHtml(feature.featureType === "trait" ? "Trait" : feature.category || "Ability")}</small><p>${escapeHtml(feature.description || "No description.")}</p></div>
    <div class="inheritedFeatureProvenance"><span>${escapeHtml(formatInheritedFeatureSource(feature))}</span><div>
      ${feature.active ? "" : `<small class="factionBadge">Inactive</small>`}${feature.secret ? `<small class="factionBadge secret">GM-only</small>` : ""}${feature.hidden ? `<small class="factionBadge hiddenBadge">Hidden</small>` : ""}${feature.overriddenBy ? `<small class="factionBadge">Overridden</small>` : ""}${feature.duplicateSources?.length ? `<small class="factionBadge">${feature.duplicateSources.length + 1} sources</small>` : ""}${conflicted ? `<small class="factionBadge hiddenBadge">Conflict</small>` : ""}
    </div></div>
    ${feature.sourceType !== "personal" ? `<button type="button" data-open-inheritance-source data-source-type="${escapeHtml(feature.sourceType)}" data-source-id="${escapeHtml(feature.sourceId || "")}" data-faction-id="${escapeHtml(feature.factionId || "")}" data-node-id="${escapeHtml(feature.hierarchyNodeId || "")}">Open Source</button>` : ""}
  </article>`;
}

function renderInheritedFeatureSection(title, features, resolution) {
  const traits = features.filter(feature => feature.featureType === "trait");
  const abilities = features.filter(feature => feature.featureType === "ability");
  return `<details class="inheritedFeatureSection"><summary>${escapeHtml(title)} <span>${features.length}</span></summary>
    <div class="inheritedFeatureKind"><h4>Traits</h4>${traits.length ? traits.map(feature => renderInheritedFeatureRow(feature, resolution)).join("") : `<p class="forgeEmptyState">No traits.</p>`}</div>
    <div class="inheritedFeatureKind"><h4>Abilities</h4>${abilities.length ? abilities.map(feature => renderInheritedFeatureRow(feature, resolution)).join("") : `<p class="forgeEmptyState">No abilities.</p>`}</div>
  </details>`;
}

function renderInheritedFeaturesPanel(resolution, options = {}) {
  const resolvedFeatures = [...resolution.effective.traits, ...resolution.effective.abilities];
  const features = options.excludePersonal
    ? resolvedFeatures.filter(feature => feature.sourceType !== "personal")
    : resolvedFeatures;
  const sections = [
    ...(options.excludePersonal ? [] : [["Personal", features.filter(feature => feature.sourceType === "personal")]]),
    ["From Hierarchy", features.filter(feature => feature.sourceType === "hierarchyAbilityPack")],
    ["From Factions", features.filter(feature => ["faction", "factionAbilityPack"].includes(feature.sourceType))],
    ["From Relationship Profiles", features.filter(feature => feature.sourceType === "relationshipProfile")]
  ];
  return `<details class="inheritedFeaturesPanel" ${options.open ? "open" : ""}><summary>Inherited Features (${features.length})</summary>
    <div class="inheritedFeaturesBody">${features.length ? sections.map(([title, items]) => renderInheritedFeatureSection(title, items, resolution)).join("") : `<p class="forgeEmptyState">No inherited features currently resolve for this entity.</p>`}
      ${resolution.warnings.length || resolution.conflicts.length ? `<details class="inheritedFeatureDiagnostics"><summary>Warnings (${resolution.warnings.length + resolution.conflicts.length})</summary>${resolution.warnings.map(warning => `<p>${escapeHtml(warning.message || warning.code)}</p>`).join("")}${resolution.conflicts.map(conflict => `<p>Conflict for feature ${escapeHtml(conflict.featureId)}${conflict.unresolvedSameTier ? " at equal precedence" : ""}.</p>`).join("")}</details>` : ""}
    </div></details>`;
}

async function renderInheritedFeaturesForEntity(entity, options = {}) {
  const mount = options.workspace?.querySelector("[data-inherited-features-mount]") || document.querySelector("#inheritedFeaturesPanelMount");
  if (!mount) return;
  try {
    const resolution = await window.MasterForgeInheritanceEngine.resolveForEntityRecord(entity, options);
    mount.innerHTML = renderInheritedFeaturesPanel(resolution, options);
    mount.querySelectorAll("[data-open-inheritance-source]").forEach(button => button.onclick = async () => {
      if (["factionAbilityPack", "hierarchyAbilityPack"].includes(button.dataset.sourceType)) {
        const pack = await window.dmAPI.getEntity("ability_pack", button.dataset.sourceId);
        if (pack) showGenericEntityBuilder(pack);
        return;
      }
      const faction = await window.dmAPI.getEntity("faction", button.dataset.factionId || button.dataset.sourceId);
      if (!faction) return;
      entityBuilderState.factionHierarchyFocusNodeId = button.dataset.nodeId || null;
      showGenericEntityBuilder(faction, { factionTab: button.dataset.nodeId ? "hierarchy" : "overview" });
    });
  } catch (error) {
    mount.innerHTML = `<details class="inheritedFeaturesPanel"><summary>Inherited Features</summary><p class="forgeEmptyState">Inherited features could not be resolved. ${escapeHtml(error?.message || "Unknown error")}</p></details>`;
  }
}

window.renderInheritedFeaturesPanel = renderInheritedFeaturesPanel;

function formatUniversalRelationshipTypeLabel(value = "") {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getUniversalRelationshipDefinitions() {
  const registry = window.MasterForgeRelationshipTypes;
  const types = registry?.types;

  if (!types || typeof types !== "object") {
    return [];
  }

  return Object.values(types).filter(type => type?.id);
}

function getUniversalRelationshipDefinition(typeId) {
  const registry = window.MasterForgeRelationshipTypes;

  return typeof registry?.get === "function"
    ? registry.get(typeId)
    : registry?.types?.[typeId] || null;
}

function renderUniversalRelationshipTypeOptions(selectedType = "", readOnly = false) {
  const definitions = getUniversalRelationshipDefinitions();
  const known = definitions.some(type => type.id === selectedType);
  const options = definitions.map(type => `
    <option value="${escapeHtml(type.id)}" ${type.id === selectedType ? "selected" : ""}>
      ${escapeHtml(type.label || formatUniversalRelationshipTypeLabel(type.id))}
    </option>
  `);

  if (readOnly && selectedType && !known) {
    options.unshift(`
      <option value="${escapeHtml(selectedType)}" selected>
        ${escapeHtml(formatUniversalRelationshipTypeLabel(selectedType))}
      </option>
    `);
  }

  return options.join("");
}

function renderUniversalRelationshipEntityTypeOptions(selectedType = "", readOnly = false) {
  const options = UNIVERSAL_RELATIONSHIP_ENTITY_TYPES.map(type => `
    <option value="${escapeHtml(type)}" ${type === selectedType ? "selected" : ""}>
      ${escapeHtml(formatEntityTypeLabel(type))}
    </option>
  `);

  if (readOnly && selectedType && !UNIVERSAL_RELATIONSHIP_ENTITY_TYPES.includes(selectedType)) {
    options.unshift(`
      <option value="${escapeHtml(selectedType)}" selected>
        ${escapeHtml(formatEntityTypeLabel(selectedType))}
      </option>
    `);
  }

  return options.join("");
}

function getSuggestedUniversalRelationshipEndpointTypes(relationshipType) {
  const explicitMappings = {
    member_of_party: { source: "npc", target: "party" },
    has_party_member: { source: "party", target: "npc" },
    subgroup_of: { source: "party_group", target: "party" },
    contains_subgroup: { source: "party", target: "party_group" },
    split_from: { source: "party_group", target: "party" },
    rejoined_with: { source: "party_group", target: "party" },
    travels_with: { source: "npc", target: "party" },
    companion_of: { source: "npc", target: "npc" },
    bonded_to: { source: "npc", target: "creature" },
    handler_of: { source: "npc", target: "creature" },
    handled_by: { source: "creature", target: "npc" },
    captured_by: { source: "npc", target: "faction" },
    holds_captive: { source: "faction", target: "npc" },
    prisoner_of: { source: "npc", target: "faction" },
    has_prisoner: { source: "faction", target: "npc" }
  };

  if (explicitMappings[relationshipType]) {
    return explicitMappings[relationshipType];
  }

  if (["subfaction_of", "contains_subfaction"].includes(relationshipType)) {
    return { source: "faction", target: "faction" };
  }

  if (["equal_rank_to", "co_leads_with"].includes(relationshipType)) {
    return { source: "npc", target: "npc" };
  }

  const category = getUniversalRelationshipDefinition(relationshipType)?.category;
  if (category === "faction") return { source: "npc", target: "faction" };
  if (category === "location") return { source: "npc", target: "location" };
  if (category === "command") return { source: "npc", target: "npc" };
  return { source: "npc", target: "npc" };
}

function renderUniversalRelationshipHelp() {
  const container = document.querySelector("#universalRelationshipHelp");
  const select = document.querySelector("#universalRelationshipType");
  if (!container || !select) return;

  const definition = getUniversalRelationshipDefinition(select.value);
  if (!definition) {
    container.innerHTML = `<p>Custom relationship key: <strong>${escapeHtml(select.value)}</strong></p>`;
    return;
  }

  container.innerHTML = `
    <h3>${escapeHtml(definition.label || definition.id)}</h3>
    <p>${escapeHtml(definition.description || "No description available.")}</p>
    <dl>
      <dt>Source label</dt><dd>${escapeHtml(definition.labels?.source || definition.label || definition.id)}</dd>
      <dt>Target label</dt><dd>${escapeHtml(definition.labels?.target || definition.label || definition.id)}</dd>
      <dt>Category</dt><dd>${escapeHtml(definition.category || "general")}</dd>
      <dt>Symmetrical</dt><dd>${definition.symmetrical ? "Yes" : "No"}</dd>
      <dt>Inverse</dt><dd>${escapeHtml(definition.inverseType || "None registered")}</dd>
      <dt>Secret</dt><dd>${definition.secrecy?.inherentlySecret ? "Inherently secret" : "Not inherently secret"}</dd>
      <dt>Tree modes</dt><dd>${escapeHtml((definition.modes || []).join(", ") || "None")}</dd>
      <dt>Endpoint guidance</dt><dd>${escapeHtml((definition.allowedSources || ["*"]).join(", "))} → ${escapeHtml((definition.allowedTargets || ["*"]).join(", "))}</dd>
    </dl>
  `;
}

function setUniversalRelationshipBuilderStatus(status, message = "") {
  universalRelationshipBuilderState.status = status;
  const statusElement = document.querySelector("#universalRelationshipStatus");
  if (!statusElement) return;
  statusElement.dataset.status = status;
  statusElement.textContent = message;
  statusElement.classList.toggle("hidden", !message);
}

async function populateUniversalRelationshipEntitySelect(side, selectedId = "") {
  const typeSelect = document.querySelector(`#universalRelationship${side}Type`);
  const entitySelect = document.querySelector(`#universalRelationship${side}Entity`);
  if (!typeSelect || !entitySelect) return;

  const type = typeSelect.value;
  const readOnly = universalRelationshipBuilderState.mode === "view";
  entitySelect.disabled = true;
  entitySelect.innerHTML = `<option value="">Loading ${escapeHtml(formatEntityTypeLabel(type).toLowerCase())} entities…</option>`;

  try {
    const entities = await window.dmAPI.getEntitiesByType(type);
    const items = Array.isArray(entities) ? entities : [];

    if (!items.length) {
      entitySelect.innerHTML = `<option value="">No ${escapeHtml(formatEntityTypeLabel(type).toLowerCase())} entities found</option>`;
    } else {
      entitySelect.innerHTML = items.map(entity => `
        <option value="${escapeHtml(entity.id)}" ${entity.id === selectedId ? "selected" : ""}>
          ${escapeHtml(entity.name || entity.id)} (${escapeHtml(formatEntityTypeLabel(type))})
        </option>
      `).join("");
    }

    if (readOnly && selectedId && !items.some(entity => entity.id === selectedId)) {
      entitySelect.insertAdjacentHTML("afterbegin", `
        <option value="${escapeHtml(selectedId)}" selected>
          ${escapeHtml(selectedId)} (${escapeHtml(formatEntityTypeLabel(type))})
        </option>
      `);
    }
  } catch (error) {
    console.error(`Could not load ${side.toLowerCase()} entities:`, error);
    entitySelect.innerHTML = `<option value="">No ${escapeHtml(formatEntityTypeLabel(type).toLowerCase())} entities found</option>`;
  } finally {
    entitySelect.disabled = readOnly;
  }
}

async function refreshUniversalRelationshipPanels() {
  if (!currentlySelectedEntity) return;
  const relationships = await getRelationshipsForEntityPanel(currentlySelectedEntity);
  const relationshipsContainer = document.querySelector("#entity-debug-relationships");
  if (relationshipsContainer) {
    await renderEntityDebugRelationships(
      relationshipsContainer,
      relationships,
      currentlySelectedEntity
    );
  }
  updateRelationshipTreeButton(relationships, { preserveTreeOpen: true });

  const treePanel = document.querySelector("#entityRelationshipTreePanel");
  if (treePanel?.classList.contains("is-visible") && !treePanel.classList.contains("hidden")) {
    await loadEntityTreeViewer();
  }
}

function openEntityRecordBuilder(entity) {
  if (entity?.entity_type === "npc") {
    return openNpcEntityInBuilder(entity);
  }
  return showGenericEntityBuilder(entity);
}

async function showUniversalRelationshipBuilder(sourceEntity, storedRelationship = null) {
  const container = document.querySelector("#entity-debug-selected");
  if (!container || !sourceEntity) return;

  if (!storedRelationship && window.MasterForgeConfigurationReferenceHelper?.isConfigurationAsset(sourceEntity)) {
    alert("Configuration assets are assigned through their dedicated configuration controls, not through world relationships.");
    return;
  }

  closeRelationshipTree();
  const workspace = document.getElementById("entityRelationshipWorkspace");
  workspace?.classList.remove("entity-editing");
  workspace?.classList.add("relationship-builder-open");

  const engine = window.MasterForgeRelationshipEngine;
  const normalized = storedRelationship
    ? engine?.normaliseRelationshipRecord(storedRelationship)
    : null;
  const readOnly = !!normalized;
  const defaultRelationship = normalized?.relationshipType || getUniversalRelationshipDefinitions()[0]?.id || "";
  const sourceType = normalized?.sourceEntityType || sourceEntity.entity_type || "npc";
  const sourceId = normalized?.sourceEntityId || sourceEntity.id || "";
  const suggestedEndpointTypes =
    getSuggestedUniversalRelationshipEndpointTypes(defaultRelationship);
  const targetType = normalized?.targetEntityType || suggestedEndpointTypes.target;
  const targetId = normalized?.targetEntityId || "";

  Object.assign(universalRelationshipBuilderState, {
    mode: readOnly ? "view" : "new",
    status: readOnly ? "viewing" : "new",
    relationshipId: normalized?.id || storedRelationship?.id || null,
    originalRelationship: storedRelationship,
    sourceEntity,
    error: "",
    successMessage: ""
  });

  container.innerHTML = `
    <section class="universalRelationshipBuilderCard">
      <div class="universalRelationshipBuilderHeader">
        <div>
          <p class="entityProfileMeta">Universal Relationship Builder</p>
          <h1>${readOnly ? "Existing Relationship — read-only" : "New Relationship"}</h1>
        </div>
        <div class="universalRelationshipBuilderActions">
          <button id="newUniversalRelationshipBtn" type="button">New Relationship</button>
          <button id="editUniversalRelationshipSourceEntityBtn" type="button">Edit Entity Record</button>
          <button id="cancelUniversalRelationshipBuilderBtn" type="button">Return to Entity View</button>
        </div>
      </div>

      <div class="universalRelationshipEndpointGrid">
        <fieldset>
          <legend>Source entity</legend>
          <label>Type<select id="universalRelationshipSourceType" ${readOnly ? "disabled" : ""}>${renderUniversalRelationshipEntityTypeOptions(sourceType, readOnly)}</select></label>
          <label>Entity<select id="universalRelationshipSourceEntity" ${readOnly ? "disabled" : ""}></select></label>
        </fieldset>

        <fieldset>
          <legend>Relationship</legend>
          <label>Type<select id="universalRelationshipType" ${readOnly ? "disabled" : ""}>${renderUniversalRelationshipTypeOptions(defaultRelationship, readOnly)}</select></label>
          <div id="universalRelationshipHelp" class="universalRelationshipHelp"></div>
        </fieldset>

        <fieldset>
          <legend>Target entity</legend>
          <label>Type<select id="universalRelationshipTargetType" ${readOnly ? "disabled" : ""}>${renderUniversalRelationshipEntityTypeOptions(targetType, readOnly)}</select></label>
          <label>Entity<select id="universalRelationshipTargetEntity" ${readOnly ? "disabled" : ""}></select></label>
        </fieldset>
      </div>

      <label class="universalRelationshipNotes">Notes
        <textarea id="universalRelationshipNotes" rows="4" ${readOnly ? "readonly" : ""}>${escapeHtml(normalized?.notes || "")}</textarea>
      </label>

      <p class="universalRelationshipInfo">Advanced metadata editing is available to future builders; this relationship view remains read-only.</p>
      <p id="universalRelationshipStatus" class="universalRelationshipStatus hidden" aria-live="polite"></p>

      <div class="universalRelationshipBuilderActions">
        ${readOnly
          ? `<button id="deleteUniversalRelationshipBtn" type="button">Delete Relationship</button>`
          : `<button id="saveUniversalRelationshipBtn" type="button">Create Relationship</button>`}
      </div>
    </section>
  `;

  renderUniversalRelationshipHelp();
  await Promise.all([
    populateUniversalRelationshipEntitySelect("Source", sourceId),
    populateUniversalRelationshipEntitySelect("Target", targetId)
  ]);
  wireUniversalRelationshipBuilderControls();
}

function wireUniversalRelationshipBuilderControls() {
  const sourceType = document.querySelector("#universalRelationshipSourceType");
  const targetType = document.querySelector("#universalRelationshipTargetType");
  const relationshipType = document.querySelector("#universalRelationshipType");

  if (sourceType) sourceType.onchange = () => populateUniversalRelationshipEntitySelect("Source");
  if (targetType) targetType.onchange = () => populateUniversalRelationshipEntitySelect("Target");
  if (relationshipType) {
    relationshipType.onchange = async () => {
      renderUniversalRelationshipHelp();
      if (universalRelationshipBuilderState.mode !== "new") return;
      const sourceEntityId = document.querySelector(
        "#universalRelationshipSourceEntity"
      )?.value || "";
      const targetEntityId = document.querySelector(
        "#universalRelationshipTargetEntity"
      )?.value || "";
      const suggestedTypes =
        getSuggestedUniversalRelationshipEndpointTypes(
          relationshipType.value
        );

      if (sourceType && suggestedTypes.source) {
        sourceType.value = suggestedTypes.source;
      }

      if (targetType && suggestedTypes.target) {
        targetType.value = suggestedTypes.target;
      }

      await Promise.all([
        populateUniversalRelationshipEntitySelect(
          "Source",
          sourceEntityId
        ),
        populateUniversalRelationshipEntitySelect(
          "Target",
          targetEntityId
        )
      ]);
    };
  }

  const newButton = document.querySelector("#newUniversalRelationshipBtn");
  if (newButton) newButton.onclick = () => showUniversalRelationshipBuilder(universalRelationshipBuilderState.sourceEntity);

  const editButton = document.querySelector("#editUniversalRelationshipSourceEntityBtn");
  if (editButton) editButton.onclick = () => openEntityRecordBuilder(universalRelationshipBuilderState.sourceEntity);

  const cancelButton = document.querySelector("#cancelUniversalRelationshipBuilderBtn");
  if (cancelButton) cancelButton.onclick = () => showEntityDebugDetails(currentlySelectedEntity, { preserveTreeOpen: true });

  const saveButton = document.querySelector("#saveUniversalRelationshipBtn");
  if (saveButton) saveButton.onclick = createUniversalRelationshipFromBuilder;

  const deleteButton = document.querySelector("#deleteUniversalRelationshipBtn");
  if (deleteButton) deleteButton.onclick = deleteUniversalRelationshipFromBuilder;
}

async function createUniversalRelationshipFromBuilder() {
  const engine = window.MasterForgeRelationshipEngine;
  const sourceEntityType = document.querySelector("#universalRelationshipSourceType")?.value || "";
  const sourceEntityId = document.querySelector("#universalRelationshipSourceEntity")?.value || "";
  const relationshipType = document.querySelector("#universalRelationshipType")?.value || "";
  const targetEntityType = document.querySelector("#universalRelationshipTargetType")?.value || "";
  const targetEntityId = document.querySelector("#universalRelationshipTargetEntity")?.value || "";
  const notes = document.querySelector("#universalRelationshipNotes")?.value?.trim() || "";
  const saveButton = document.querySelector("#saveUniversalRelationshipBtn");

  const configurationHelper = window.MasterForgeConfigurationReferenceHelper;
  if (
    configurationHelper?.isConfigurationAsset(sourceEntityType) ||
    configurationHelper?.isConfigurationAsset(targetEntityType)
  ) {
    setUniversalRelationshipBuilderStatus(
      "error",
      "Configuration assets cannot be used as world relationship endpoints."
    );
    return;
  }

  if (!sourceEntityId || !relationshipType || !targetEntityId) {
    setUniversalRelationshipBuilderStatus("error", "Choose a source, relationship and target.");
    return;
  }

  try {
    setUniversalRelationshipBuilderStatus("saving", "Saving relationship…");
    if (saveButton) saveButton.disabled = true;
    const id = window.dmStorage.slugify([
      "relationship",
      sourceEntityType,
      sourceEntityId,
      relationshipType,
      targetEntityType,
      targetEntityId,
      Date.now()
    ].join("-"));

    await engine.createRelationship({
      id,
      sourceEntityType,
      sourceEntityId,
      relationshipType,
      targetEntityType,
      targetEntityId,
      notes
    });
    setUniversalRelationshipBuilderStatus("success", "Relationship created.");
    await refreshUniversalRelationshipPanels();
    const returnEntity = universalRelationshipBuilderState.sourceEntity || currentlySelectedEntity;
    if (returnEntity) {
      await showEntityDebugDetails(returnEntity);
    }
  } catch (error) {
    console.error("Universal relationship creation failed:", error);
    setUniversalRelationshipBuilderStatus("error", error?.message || "Relationship could not be created.");
  } finally {
    if (saveButton?.isConnected) saveButton.disabled = false;
  }
}

async function deleteUniversalRelationshipFromBuilder() {
  const relationshipId = universalRelationshipBuilderState.relationshipId;
  if (!relationshipId) {
    setUniversalRelationshipBuilderStatus("error", "This relationship has no stable ID and cannot be deleted here.");
    return;
  }

  if (!confirm("Delete this relationship? This cannot be undone.")) return;

  const deleteButton = document.querySelector("#deleteUniversalRelationshipBtn");
  try {
    setUniversalRelationshipBuilderStatus("deleting", "Deleting relationship…");
    if (deleteButton) deleteButton.disabled = true;
    await window.MasterForgeRelationshipEngine.deleteRelationship(relationshipId);
    await refreshUniversalRelationshipPanels();
    await showUniversalRelationshipBuilder(universalRelationshipBuilderState.sourceEntity);
    setUniversalRelationshipBuilderStatus("success", "Relationship deleted.");
  } catch (error) {
    console.error("Universal relationship deletion failed:", error);
    setUniversalRelationshipBuilderStatus("error", error?.message || "Relationship could not be deleted.");
    if (deleteButton?.isConnected) deleteButton.disabled = false;
  }
}

// Developer-only Slice 0 proof. This is never invoked automatically and restores
// the relationship's original editable fields before it returns.
async function findRelationshipForUpdateDiagnostic(relationshipId) {
  const engine = window.MasterForgeRelationshipEngine;
  const viewed = universalRelationshipBuilderState.originalRelationship;

  if (viewed?.id === relationshipId) {
    return engine.normaliseRelationshipRecord(viewed);
  }

  const entityTypes = new Set([
    ...UNIVERSAL_RELATIONSHIP_ENTITY_TYPES,
    "pc",
    "ship",
    "region",
    "world",
    "campaign",
    "crew",
    "group",
    "organisation",
    "organization",
    "landmark",
    "loot",
    "encounter"
  ]);

  for (const entityType of entityTypes) {
    const entities = await window.dmAPI.getEntitiesByType(entityType);

    for (const entity of entities || []) {
      const relationships = await window.dmAPI.getEntityRelationships(
        entityType,
        entity.id
      );
      const relationship = (relationships || []).find(
        item => item.id === relationshipId
      );

      if (relationship) {
        return engine.normaliseRelationshipRecord(relationship);
      }
    }
  }

  return null;
}

async function reloadRelationshipForUpdateDiagnostic(relationship) {
  const relationships = await window.dmAPI.getEntityRelationships(
    relationship.sourceEntityType,
    relationship.sourceEntityId
  );

  return (relationships || []).find(item => item.id === relationship.id) || null;
}

window.runRelationshipUpdateDiagnostic = async function (relationshipId) {
  const id = String(relationshipId || "").trim();
  const checks = [];
  const addCheck = (name, passed, expected, actual) => {
    checks.push({ name, passed: Boolean(passed), expected, actual });
  };
  const sameJson = (left, right) =>
    JSON.stringify(left) === JSON.stringify(right);

  if (!id) {
    return {
      passed: false,
      checks: [{
        name: "relationship ID supplied",
        passed: false,
        expected: "non-empty relationship ID",
        actual: relationshipId
      }]
    };
  }

  const engine = window.MasterForgeRelationshipEngine;
  let original = null;

  try {
    original = await findRelationshipForUpdateDiagnostic(id);

    if (!original) {
      throw new Error(`Relationship not found: ${id}`);
    }

    const originalMetadata = { ...(original.data_json || {}) };
    const testMetadata = {
      slice0Test: {
        successful: true,
        testedAt: new Date().toISOString()
      }
    };
    const merged = await engine.updateRelationshipMetadata(id, {
      data_json: testMetadata
    });
    const expectedMergedMetadata = {
      ...originalMetadata,
      ...testMetadata
    };

    addCheck("metadata shallow merge", sameJson(merged.data_json, expectedMergedMetadata), expectedMergedMetadata, merged.data_json);
    addCheck("relationship ID unchanged", merged.id === original.id, original.id, merged.id);
    addCheck("source endpoint unchanged", merged.from_type === original.sourceEntityType && merged.from_id === original.sourceEntityId, `${original.sourceEntityType}:${original.sourceEntityId}`, `${merged.from_type}:${merged.from_id}`);
    addCheck("target endpoint unchanged", merged.to_type === original.targetEntityType && merged.to_id === original.targetEntityId, `${original.targetEntityType}:${original.targetEntityId}`, `${merged.to_type}:${merged.to_id}`);
    addCheck("relationship type unchanged", merged.relationship === original.relationshipType, original.relationshipType, merged.relationship);
    addCheck("notes preserved by metadata update", merged.notes === original.notes, original.notes, merged.notes);
    addCheck("strength preserved by metadata update", merged.strength === original.strength, original.strength, merged.strength);

    let reloaded = await reloadRelationshipForUpdateDiagnostic(original);
    addCheck("merged metadata persisted", sameJson(reloaded?.data_json, expectedMergedMetadata), expectedMergedMetadata, reloaded?.data_json);

    const diagnosticNotes = `Slice 0 diagnostic ${new Date().toISOString()}`;
    await engine.updateRelationshipMetadata(id, { notes: diagnosticNotes });
    reloaded = await reloadRelationshipForUpdateDiagnostic(original);
    addCheck("notes-only update persisted", reloaded?.notes === diagnosticNotes, diagnosticNotes, reloaded?.notes);
    addCheck("notes-only update preserved metadata", sameJson(reloaded?.data_json, expectedMergedMetadata), expectedMergedMetadata, reloaded?.data_json);

    const diagnosticStrength = Number.isFinite(original.strength)
      ? original.strength + 1
      : 1;
    await engine.updateRelationshipMetadata(id, { strength: diagnosticStrength });
    reloaded = await reloadRelationshipForUpdateDiagnostic(original);
    addCheck("strength-only update persisted", reloaded?.strength === diagnosticStrength, diagnosticStrength, reloaded?.strength);
    addCheck("strength-only update preserved notes", reloaded?.notes === diagnosticNotes, diagnosticNotes, reloaded?.notes);
    addCheck("strength-only update preserved metadata", sameJson(reloaded?.data_json, expectedMergedMetadata), expectedMergedMetadata, reloaded?.data_json);

    const replacementMetadata = {
      slice0ReplacementTest: {
        successful: true
      }
    };
    await engine.updateRelationshipMetadata(id, {
      data_json: replacementMetadata,
      mergeDataJson: false
    });
    reloaded = await reloadRelationshipForUpdateDiagnostic(original);
    addCheck("explicit metadata replacement", sameJson(reloaded?.data_json, replacementMetadata), replacementMetadata, reloaded?.data_json);
  } catch (error) {
    addCheck("diagnostic completed", false, "all update operations succeed", error?.message || String(error));
  } finally {
    if (original) {
      try {
        await engine.updateRelationshipMetadata(id, {
          notes: original.notes,
          strength: original.strength,
          data_json: original.data_json || {},
          mergeDataJson: false
        });
        const restored = await reloadRelationshipForUpdateDiagnostic(original);
        addCheck(
          "original editable fields restored",
          restored?.notes === original.notes &&
            restored?.strength === original.strength &&
            sameJson(restored?.data_json, original.data_json || {}),
          {
            notes: original.notes,
            strength: original.strength,
            data_json: original.data_json || {}
          },
          {
            notes: restored?.notes,
            strength: restored?.strength,
            data_json: restored?.data_json
          }
        );
      } catch (restoreError) {
        addCheck("original editable fields restored", false, "restore succeeds", restoreError?.message || String(restoreError));
      }
    }
  }

  return {
    passed: checks.length > 0 && checks.every(check => check.passed),
    checks
  };
};

function wireEntityProfileButtons(entity) {
  const openBtn = document.querySelector("#openEntitySourceBtn");
  const moveEntityBtn = document.querySelector("#openMoveEntityBtn");

  if (openBtn) {
    openBtn.onclick = async () => {
      if (["npc", "pc", "creature"].includes(entity.entity_type)) await openCanonicalEntityEditor(entity);
      else await showUniversalRelationshipBuilder(entity);
    };
  }

  if (moveEntityBtn) {
    moveEntityBtn.onclick = async () => {
      if (entity.entity_type === "npc") {
        await openNpcEntityLocationEditor(entity);
        return;
      }

      await openMoveEntityPanel(entity);
    };
  }

  const pinEntityBtn = document.querySelector("#pinEntityBtn");
const hideEntityBtn = document.querySelector("#hideEntityBtn");
const archiveEntityBtn = document.querySelector("#archiveEntityBtn");
const restoreEntityBtn = document.querySelector("#restoreEntityBtn");

if (pinEntityBtn) {
  pinEntityBtn.onclick = async () => {
    await updateEntityVisibility(entity, "pinned");
  };
}

if (hideEntityBtn) {
  hideEntityBtn.onclick = async () => {
    await updateEntityVisibility(entity, "hidden");
  };
}

if (archiveEntityBtn) {
  archiveEntityBtn.onclick = async () => {
    await updateEntityVisibility(entity, "archived");
  };
}

if (restoreEntityBtn) {
  restoreEntityBtn.onclick = async () => {
    await updateEntityVisibility(entity, "active");
  };
}

}

async function updateEntityVisibility(entity, mode = "active") {
  if (!entity?.entity_type || !entity?.id) return;

  const visibility = {
    pinned: mode === "pinned",
    hidden: mode === "hidden",
    archived: mode === "archived"
  };

  const updatedEntity = {
    ...entity,
    visibility,
    data_json: {
      ...(entity.data_json || {}),
      visibility
    }
  };

  const context = normaliseEntityContext(updatedEntity);

  updatedEntity.systemId = context.systemId;
  updatedEntity.scope = context.scope;
  updatedEntity.currentPosition = context.currentPosition;
  updatedEntity.visibility = context.visibility;

  updatedEntity.data_json = {
    ...(updatedEntity.data_json || {}),
    systemId: context.systemId,
    scope: context.scope,
    currentPosition: context.currentPosition,
    visibility: context.visibility
  };

  if (window.dmAPI.updateEntity) {
    await window.dmAPI.updateEntity(
      updatedEntity.entity_type,
      updatedEntity.id,
      updatedEntity
    );
  }

  currentlySelectedEntity = updatedEntity;

  await loadEntityDebugPanel();

  const freshEntity = window.dmAPI.getEntity
    ? await window.dmAPI.getEntity(
        updatedEntity.entity_type,
        updatedEntity.id
      )
    : updatedEntity;

  if (freshEntity) {
    currentlySelectedEntity = freshEntity;
    await showEntityDebugDetails(freshEntity);
  }
}

function getDefaultGenericEntity(type = "faction") {
  const idSeed = `new-${type}`;

  return {
    id: "",
    entity_type: type,
    name: "",
    description: "",
    data_json: {
      source: "entity-builder",
      status: "Active",
      tags: "",
      publicNotes: "",
      dmSecrets: "",
      systemId: getCurrentSystemId(),

campaign: window.dmState.current.campaign,
world: window.dmState.current.world,
region: window.dmState.current.region,
locationId: window.dmState.current.location,

scope: getCurrentScope(),

visibility: getDefaultVisibility(),
    }
  };
}

function showGenericEntityBuilder(
  entity = null,
  { factionTab = "overview", abilityPackTab = "overview", preserveNew = false } = {}
) {
  if (entityBuilderState.activeEntityType === "faction" && hasUnsavedFactionHierarchyChanges()) {
    if (!confirmDiscardFactionHierarchyChanges()) return false;
    discardUnsavedFactionHierarchyChanges();
  }
  console.log("OPENING GENERIC ENTITY BUILDER");
  closeRelationshipTree();

  const selectedContainer = document.getElementById("entity-debug-selected");
  const relationshipsContainer = document.getElementById("entity-debug-relationships");

  const workspace = document.getElementById("entityRelationshipWorkspace");

  if (workspace) {
    workspace.classList.add("entity-editing");
  }

  if (!selectedContainer || !relationshipsContainer) return;

  const workingEntity = entity
    ? {
        ...entity,
        data_json: {
          ...(entity.data_json || {})
        }
      }
    : getDefaultGenericEntity(entityBuilderState.activeEntityType || "faction");

  entityBuilderState.activeEntity = workingEntity;
  entityBuilderState.originalEntityId =
  preserveNew ? null : entity?.id || null;

entityBuilderState.originalEntityType =
  preserveNew ? null : entity?.entity_type || null;
  entityBuilderState.activeEntityId = workingEntity.id || null;
  entityBuilderState.activeEntityType = workingEntity.entity_type || "faction";
  entityBuilderState.factionWorkspaceTab = factionTab;
  entityBuilderState.factionHierarchy = workingEntity.entity_type === "faction"
    ? getFactionHierarchyApi().normaliseFactionHierarchy(workingEntity.data_json)
    : null;
  entityBuilderState.factionHierarchyEditorDraft = null;
  entityBuilderState.factionHierarchyEditorNodeId = null;
  entityBuilderState.factionHierarchyEditorError = "";
  entityBuilderState.factionHierarchyEditorReturnNodeId = null;
  entityBuilderState.factionHierarchyEditorShouldFocus = false;
  entityBuilderState.factionHierarchyEditorDirty = false;
  entityBuilderState.factionHierarchyDirty = false;
  entityBuilderState.factionHierarchyBaseline = entityBuilderState.factionHierarchy
    ? clonePlannedEncounterValue(entityBuilderState.factionHierarchy)
    : null;
  entityBuilderState.factionTraits = workingEntity.entity_type === "faction"
    ? (Array.isArray(workingEntity.data_json?.traits) ? workingEntity.data_json.traits : []).map(getAbilityPackApi().normaliseTrait)
    : [];
  entityBuilderState.factionAbilityPackIds = workingEntity.entity_type === "faction"
    ? getAbilityPackApi().uniqueIds(workingEntity.data_json?.abilityPackIds)
    : [];
  entityBuilderState.abilityPackWorkspaceTab = abilityPackTab;
  entityBuilderState.abilityPackData = workingEntity.entity_type === "ability_pack"
    ? getAbilityPackApi().normalisePackData(workingEntity.data_json)
    : null;

  currentlySelectedEntity = workingEntity;

  selectedContainer.innerHTML = renderGenericEntityBuilder(workingEntity);

  relationshipsContainer.innerHTML = `
    <div class="relationshipEmptyState">
      <h3>Save this entity first</h3>
      <p>Once saved, relationships will appear here.</p>
    </div>
  `;

  

  populateGenericEntityRegionAndLocationControls(
  workingEntity
)
  .then(() => {
    setupGenericEntityBuilderControls();
    setupFactionWorkspaceControls();
    setupAbilityPackWorkspaceControls();
    updateGenericEntityJsonPreview();

    console.log("GENERIC ENTITY BUILDER FULLY WIRED", {
      saveButton:
        document.querySelector("#saveGenericEntityBtn"),
      typeInput:
        document.querySelector("#genericEntityTypeInput")
    });
  })
  .catch(error => {
    console.error(
      "Could not populate entity location controls:",
      error
    );

    /*
     * Still wire the builder even if locations fail.
     */
    setupGenericEntityBuilderControls();
    setupFactionWorkspaceControls();
    setupAbilityPackWorkspaceControls();
  });

  if (workingEntity.id) {
    getRelationshipsForEntityPanel(workingEntity)
      .then(relationships => renderEntityDebugRelationships(
        relationshipsContainer,
        relationships,
        workingEntity
      ))
      .catch(error => {
        console.warn("Could not load relationships while editing entity:", error);
      });
  }

updateRelationshipTreeButton([]);

/*
 * Do not re-render the entity index here.
 * It would overwrite the newly opened builder.
 */
}

async function populateGenericEntityRegionAndLocationControls(entity) {
  const worldSelect = document.querySelector("#genericEntityWorldInput");
  const regionSelect = document.querySelector("#genericEntityRegionInput");
  const locationSelect = document.querySelector("#genericEntityLocationInput");

  const currentWorldSelect = document.querySelector("#genericEntityCurrentWorldInput");
  const currentRegionSelect = document.querySelector("#genericEntityCurrentRegionInput");
  const currentLocationSelect = document.querySelector("#genericEntityCurrentLocationInput");

  if (
    !worldSelect ||
    !regionSelect ||
    !locationSelect ||
    !currentWorldSelect ||
    !currentRegionSelect ||
    !currentLocationSelect
  ) {
    console.warn("Generic entity world/region/location controls missing.");
    return;
  }

  const data = entity?.data_json || entity?.data || {};

  const selectedHomeWorld =
    data.defaultWorldId ||
    data.worldId ||
    data.world ||
    data.scope?.worldId ||
    window.dmState.current.world ||
    "";

  const selectedCurrentWorld =
    data.currentWorldId ||
    data.currentPosition?.worldId ||
    data.worldId ||
    data.world ||
    selectedHomeWorld ||
    window.dmState.current.world ||
    "";

  const selectedHomeRegion =
    data.defaultRegionId ||
    data.regionId ||
    data.region ||
    data.scope?.regionId ||
    window.dmState.current.region ||
    "";

  const selectedCurrentRegion =
    data.currentRegionId ||
    data.currentPosition?.regionId ||
    data.regionId ||
    data.region ||
    selectedHomeRegion ||
    window.dmState.current.region ||
    "";

  const selectedHomeLocation =
    data.defaultLocationId ||
    data.locationId ||
    data.location ||
    data.scope?.locationId ||
    window.dmState.current.location ||
    "";

  const selectedCurrentLocation =
    data.currentLocationId ||
    data.currentPosition?.locationId ||
    data.locationId ||
    data.location ||
    selectedHomeLocation ||
    window.dmState.current.location ||
    "";

  let worlds = [];

  try {
    worlds = await window.dmAPI.listWorlds();
  } catch (error) {
    console.error("Could not load worlds for entity builder:", error);
  }

  const renderWorldOptions = selectedWorldId => {
  if (!worlds.length) {
    return `<option value="">No worlds found</option>`;
  }

  return worlds.map(world => `
    <option
      value="${escapeHtml(world.id)}"
      ${world.id === selectedWorldId ? "selected" : ""}
    >
      ${escapeHtml(world.name || world.id)}
    </option>
  `).join("");
};

worldSelect.innerHTML = renderWorldOptions(selectedHomeWorld);
currentWorldSelect.innerHTML = renderWorldOptions(selectedCurrentWorld);

  worldSelect.value =
    worlds.some(world => world.id === selectedHomeWorld)
      ? selectedHomeWorld
      : worlds[0]?.id || "";

  currentWorldSelect.value =
    worlds.some(world => world.id === selectedCurrentWorld)
      ? selectedCurrentWorld
      : worldSelect.value || worlds[0]?.id || "";

  async function loadRegionsForWorld(worldId, targetRegionSelect, selectedRegionId = "") {
    let regions = [];

    try {
      regions = worldId
        ? await window.dmAPI.listRegions(worldId)
        : [];
    } catch (error) {
      console.error("Could not load entity regions:", worldId, error);
    }

    if (!regions.length) {
      targetRegionSelect.innerHTML = `<option value="">No regions for this world</option>`;
      return "";
    }

    targetRegionSelect.innerHTML = regions.map(region => `
      <option
        value="${escapeHtml(region.id)}"
        ${region.id === selectedRegionId ? "selected" : ""}
      >
        ${escapeHtml(region.name || region.id)}
      </option>
    `).join("");

    targetRegionSelect.value =
      regions.some(region => region.id === selectedRegionId)
        ? selectedRegionId
        : regions[0]?.id || "";

    return targetRegionSelect.value;
  }

  async function loadLocationsForRegion(regionId, targetLocationSelect, selectedLocationId = "") {
    let locations = [];

    try {
      locations = regionId
        ? await window.dmAPI.listLocations(regionId)
        : [];
    } catch (error) {
      console.error("Could not load entity locations:", regionId, error);
    }

    if (!locations.length) {
      targetLocationSelect.innerHTML = `<option value="">No locations for this region</option>`;
      return "";
    }

    targetLocationSelect.innerHTML = locations.map(location => `
      <option
        value="${escapeHtml(location.id)}"
        ${location.id === selectedLocationId ? "selected" : ""}
      >
        ${escapeHtml(location.name || location.id)}
      </option>
    `).join("");

    targetLocationSelect.value =
      locations.some(location => location.id === selectedLocationId)
        ? selectedLocationId
        : locations[0]?.id || "";

    return targetLocationSelect.value;
  }

  const homeRegionId =
    await loadRegionsForWorld(
      worldSelect.value,
      regionSelect,
      selectedHomeRegion
    );

  await loadLocationsForRegion(
    homeRegionId,
    locationSelect,
    selectedHomeLocation
  );

  const currentRegionId =
    await loadRegionsForWorld(
      currentWorldSelect.value,
      currentRegionSelect,
      selectedCurrentRegion
    );

  await loadLocationsForRegion(
    currentRegionId,
    currentLocationSelect,
    selectedCurrentLocation
  );

  worldSelect.onchange = async () => {
    const regionId = await loadRegionsForWorld(worldSelect.value, regionSelect, "");
    await loadLocationsForRegion(regionId, locationSelect, "");
    updateGenericEntityJsonPreview();
  };

  regionSelect.onchange = async () => {
    await loadLocationsForRegion(regionSelect.value, locationSelect, "");
    updateGenericEntityJsonPreview();
  };

  locationSelect.onchange = updateGenericEntityJsonPreview;

  currentWorldSelect.onchange = async () => {
    const regionId = await loadRegionsForWorld(
      currentWorldSelect.value,
      currentRegionSelect,
      ""
    );

    await loadLocationsForRegion(regionId, currentLocationSelect, "");
    updateGenericEntityJsonPreview();
  };

  currentRegionSelect.onchange = async () => {
    await loadLocationsForRegion(
      currentRegionSelect.value,
      currentLocationSelect,
      ""
    );

    updateGenericEntityJsonPreview();
  };

  currentLocationSelect.onchange = updateGenericEntityJsonPreview;
  updateGenericEntityLocationFieldVisibility();
updateGenericEntityJsonPreview();
}

async function populateGenericEntityLocationSelector(regionId, entity = null) {
  const builder = document.querySelector(".genericEntityBuilderCard");
  const locationSelect = builder?.querySelector("#genericEntityLocationInput");

  if (!locationSelect) {
    console.warn("Entity Builder location select not found.");
    return;
  }

  const data = entity?.data_json || entity?.data || {};

  locationSelect.innerHTML = `<option value="">Loading locations...</option>`;

  let locations = [];

  try {
    locations = regionId
      ? await window.dmAPI.listLocations(regionId)
      : [];
  } catch (error) {
    console.error("Could not load default locations for region:", regionId, error);
  }

  if (!locations.length && Array.isArray(window.dmState.locations)) {
    locations = window.dmState.locations.filter(location => {
      return (
        location.regionId === regionId ||
        location.region_id === regionId ||
        location.parentId === regionId ||
        location.parent_id === regionId
      );
    });

    if (!locations.length && regionId === window.dmState.current.region) {
      locations = window.dmState.locations;
    }
  }

  console.log("Entity Builder Region:", regionId);
  console.log("Entity Builder Locations:", locations);

  if (!locations.length) {
    locationSelect.innerHTML = `<option value="">No locations for this region</option>`;
    return;
  }

  locationSelect.innerHTML = "";

  locations.forEach(location => {
    const option = document.createElement("option");
    option.value = location.id;
    option.textContent = location.name || location.id;
    locationSelect.appendChild(option);
  });

  const selectedLocation =
    data.defaultLocationId ||
    data.locationId ||
    data.location ||
    window.dmState.current.location ||
    locations[0]?.id ||
    "";

  locationSelect.value = locations.some(location => location.id === selectedLocation)
    ? selectedLocation
    : locations[0]?.id || "";

  updateGenericEntityJsonPreview();
}

async function populateGenericEntityCurrentLocationSelector(regionId, entity = null) {
  const builder = document.querySelector(".genericEntityBuilderCard");
  const locationSelect = builder?.querySelector("#genericEntityCurrentLocationInput");

  if (!locationSelect) return;

  const data = entity?.data_json || entity?.data || {};

  locationSelect.innerHTML = `<option value="">Loading locations...</option>`;

  let locations = [];

  try {
    locations = regionId
      ? await window.dmAPI.listLocations(regionId)
      : [];
  } catch (error) {
    console.error("Could not load current locations for entity:", regionId, error);
  }

  if (!locations.length) {
    locationSelect.innerHTML = `<option value="">No locations for this region</option>`;
    return;
  }

  locationSelect.innerHTML = "";

  locations.forEach(location => {
    const option = document.createElement("option");
    option.value = location.id;
    option.textContent = location.name || location.id;
    locationSelect.appendChild(option);
  });

  const selectedLocation =
    data.currentLocationId ||
    data.locationId ||
    data.defaultLocationId ||
    window.dmState.current.location ||
    locations[0]?.id ||
    "";

  locationSelect.value = locations.some(location => location.id === selectedLocation)
    ? selectedLocation
    : locations[0]?.id || "";
}

function renderAbilityPackWorkspaceShell() {
  const tabs = [["overview", "Overview"], ["abilities", "Abilities"], ["traits", "Traits"], ["assignments", "Assignments"], ["references", "References"]];
  return `<section class="factionWorkspace abilityPackWorkspace">
    <nav class="factionWorkspaceTabs" aria-label="Ability Pack workspace">${tabs.map(([key, label]) =>
      `<button type="button" data-ability-pack-tab="${key}" class="${key === entityBuilderState.abilityPackWorkspaceTab ? "active" : ""}">${label}</button>`
    ).join("")}</nav>
    <div id="abilityPackWorkspaceMount" class="factionWorkspaceMount"></div>
  </section>`;
}

function renderAbilityPackReferenceRow(reference, { hierarchyNode = false } = {}) {
  return `<article class="abilityPackReferenceRow" data-reference-faction-id="${escapeHtml(reference.factionId || reference.entityId)}" ${hierarchyNode ? `data-reference-node-id="${escapeHtml(reference.nodeId)}"` : ""}>
    <div><strong>${escapeHtml(reference.entityName)}</strong>${hierarchyNode ? `<small>${escapeHtml(reference.nodeName)}</small>` : ""}</div>
    <span><small>Reference level</small><strong>${escapeHtml(reference.referenceLevel)}</strong></span>
    <span><small>Reference type</small><strong>${escapeHtml(reference.referenceType)}</strong></span>
    <button type="button" data-open-reference>Open Entity</button>
  </article>`;
}

function renderAbilityPackReferenceGroup(title, content, emptyMessage) {
  return `<section class="abilityPackReferenceGroup"><h3>${escapeHtml(title)}</h3>${content || `<p class="forgeEmptyState">${escapeHtml(emptyMessage)}</p>`}</section>`;
}

async function renderAbilityPackReferencesWorkspace() {
  const mount = document.querySelector("#abilityPackWorkspaceMount");
  if (!mount) return;
  const packId = entityBuilderState.activeEntity?.id;
  mount.innerHTML = `<div class="factionWorkspacePanel"><p class="forgeEmptyState">Loading references…</p></div>`;
  const references = packId
    ? await window.MasterForgeConfigurationReferenceHelper.getAbilityPackReferences(packId)
    : { factions: [], hierarchyNodes: [], future: [] };
  const used = references.factions.length + references.hierarchyNodes.length + references.future.length;
  mount.innerHTML = `<div class="factionWorkspacePanel abilityPackReferencesPanel"><h2>Used By</h2>
    ${used ? "" : `<p class="forgeEmptyState">This Ability Pack is not currently referenced.</p>`}
    ${renderAbilityPackReferenceGroup("Faction", references.factions.map(reference => renderAbilityPackReferenceRow(reference)).join(""), "No faction references.")}
    ${renderAbilityPackReferenceGroup("Hierarchy Node", references.hierarchyNodes.map(reference => renderAbilityPackReferenceRow(reference, { hierarchyNode: true })).join(""), "No hierarchy-node references.")}
    ${renderAbilityPackReferenceGroup("Relationship Profile", "", "Future placeholder — no relationship-profile references are available yet.")}
    ${renderAbilityPackReferenceGroup("Future references", references.future.map(reference => renderAbilityPackReferenceRow(reference)).join(""), "No future reference providers are registered.")}
  </div>`;
  mount.querySelectorAll("[data-open-reference]").forEach(button => button.onclick = async () => {
    const row = button.closest("[data-reference-faction-id]");
    const faction = await window.dmAPI.getEntity("faction", row.dataset.referenceFactionId);
    if (!faction) return;
    entityBuilderState.factionHierarchyFocusNodeId = row.dataset.referenceNodeId || null;
    showGenericEntityBuilder(faction, { factionTab: row.dataset.referenceNodeId ? "hierarchy" : "overview" });
  });
}

function syncAbilityPackDraftFromDom() {
  const data = entityBuilderState.abilityPackData;
  if (!data) return;
  const mount = document.querySelector("#abilityPackWorkspaceMount");
  if (!mount) return;
  const read = id => mount.querySelector(`#${id}`);
  if (read("abilityPackCategoryInput")) {
    data.category = read("abilityPackCategoryInput").value.trim();
    data.systemId = read("abilityPackSystemInput").value.trim();
    data.tags = getAbilityPackApi().normaliseTags(read("abilityPackTagsInput").value);
    data.active = read("abilityPackActiveInput").checked;
  }
  mount.querySelectorAll("[data-pack-item]").forEach(card => {
    const collection = card.dataset.packItem === "ability" ? data.abilities : data.traits;
    const item = collection.find(entry => entry.id === card.dataset.itemId);
    if (!item) return;
    card.querySelectorAll("[data-item-field]").forEach(input => {
      const field = input.dataset.itemField;
      item[field] = input.type === "checkbox" ? input.checked : field === "tags"
        ? getAbilityPackApi().normaliseTags(input.value) : input.value.trim();
    });
  });
}

function renderPackItemCard(item, kind) {
  const fields = kind === "ability"
    ? [["type", "Type"], ["actionType", "Action type"], ["activation", "Activation"], ["range", "Range"], ["target", "Target"], ["duration", "Duration"], ["uses", "Uses"], ["recharge", "Recharge"]]
    : [["category", "Category"]];
  return `<article class="abilityPackItem" data-pack-item="${kind}" data-item-id="${escapeHtml(item.id)}">
    <header><strong>${escapeHtml(item.name || `Unnamed ${kind}`)}</strong><code>${escapeHtml(item.id)}</code>
      <span><button type="button" data-item-move="up">↑</button><button type="button" data-item-move="down">↓</button><button type="button" data-item-delete>Delete</button></span></header>
    <div class="abilityPackItemGrid"><label>Name<input data-item-field="name" value="${escapeHtml(item.name)}"></label>
      ${fields.map(([key, label]) => `<label>${label}<input data-item-field="${key}" value="${escapeHtml(item[key] || "")}"></label>`).join("")}
      <label>Tags<input data-item-field="tags" value="${escapeHtml((item.tags || []).join(", "))}"></label>
      <label class="factionCheck"><input type="checkbox" data-item-field="active" ${item.active ? "checked" : ""}> Active</label>
      <label class="factionNodeWide">Description<textarea data-item-field="description">${escapeHtml(item.description || "")}</textarea></label>
      <label class="factionNodeWide">Rules text<textarea data-item-field="rulesText">${escapeHtml(item.rulesText || "")}</textarea></label>
    </div></article>`;
}

async function scanAbilityPackAssignments(packId) {
  const factions = await window.dmAPI.getEntitiesByType("faction").catch(() => []);
  const rows = [];
  for (const faction of factions) {
    const hierarchy = getFactionHierarchyApi().normaliseFactionHierarchy(faction.data_json || {});
    const direct = getAbilityPackApi().uniqueIds(faction.data_json?.abilityPackIds).includes(packId);
    const nodes = hierarchy.nodes.filter(node => getAbilityPackApi().uniqueIds(node.abilityPackIds).includes(packId));
    if (!direct && !nodes.length) continue;
    const memberships = await getFactionMembershipRelationships(faction.id).catch(() => []);
    const rankKey = getFactionMetadataRegistry().KEYS.FACTION_RANK_ID;
    rows.push({ faction, direct, nodes, affected: direct ? memberships.length : memberships.filter(rel => nodes.some(node => node.id === rel.data_json?.[rankKey])).length });
  }
  return rows;
}

async function switchAbilityPackWorkspace(tab) {
  syncAbilityPackDraftFromDom();
  entityBuilderState.abilityPackWorkspaceTab = tab;
  document.querySelectorAll("[data-ability-pack-tab]").forEach(button => button.classList.toggle("active", button.dataset.abilityPackTab === tab));
  const mount = document.querySelector("#abilityPackWorkspaceMount");
  if (!mount) return;
  const data = entityBuilderState.abilityPackData || getAbilityPackApi().normalisePackData();
  if (tab === "overview") mount.innerHTML = `<div class="factionWorkspacePanel abilityPackOverviewPanel"><h2>Pack Overview</h2><div class="abilityPackItemGrid abilityPackOverviewGrid">
    <label>Category<input id="abilityPackCategoryInput" value="${escapeHtml(data.category)}"></label>
    <label>Game system<input id="abilityPackSystemInput" value="${escapeHtml(data.systemId)}"></label>
    <label>Tags<input id="abilityPackTagsInput" value="${escapeHtml(data.tags.join(", "))}"></label>
    <label class="factionCheck abilityPackActiveControl"><input id="abilityPackActiveInput" type="checkbox" ${data.active ? "checked" : ""}> Active</label></div></div>`;
  if (tab === "abilities" || tab === "traits") {
    const kind = tab === "abilities" ? "ability" : "trait";
    const items = tab === "abilities" ? data.abilities : data.traits;
    const validation = getAbilityPackApi().validatePackData(data);
    mount.innerHTML = `<div class="factionWorkspacePanel"><div class="factionWorkspaceHeader"><div><h2>${tab === "abilities" ? "Abilities" : "Traits"}</h2><p>Embedded definitions keep stable IDs and pack-local order.</p></div><button type="button" id="addPackItemBtn">+ Add ${kind}</button></div>
      ${renderFactionHierarchyWarnings(validation)}<div class="abilityPackItemList">${items.length ? items.map(item => renderPackItemCard(item, kind)).join("") : `<p class="forgeEmptyState">No ${tab} yet.</p>`}</div></div>`;
    wirePackItemControls(kind);
  }
  if (tab === "assignments") {
    mount.innerHTML = `<div class="factionWorkspacePanel"><p class="forgeEmptyState">Loading assignments…</p></div>`;
    const packId = entityBuilderState.activeEntity?.id;
    const rows = packId ? await scanAbilityPackAssignments(packId) : [];
    mount.innerHTML = `<div class="factionWorkspacePanel"><h2>Assignments</h2><p>Read-only references from factions and hierarchy nodes.</p>${packId ? (rows.length ? rows.map(row => `<article class="abilityPackAssignment"><strong>${escapeHtml(row.faction.name || row.faction.id)}</strong><span>${row.direct ? "Faction-wide" : "Hierarchy"} · ${row.affected} affected member${row.affected === 1 ? "" : "s"}</span>${row.nodes.map(node => `<small>${escapeHtml(node.name || node.id)}</small>`).join("")}</article>`).join("") : `<p class="forgeEmptyState">Not assigned.</p>`) : `<p class="forgeEmptyState">Save this pack to scan assignments.</p>`}</div>`;
  }
  if (tab === "references") await renderAbilityPackReferencesWorkspace();
}

function wirePackItemControls(kind) {
  const mount = document.querySelector("#abilityPackWorkspaceMount");
  const collection = kind === "ability" ? entityBuilderState.abilityPackData.abilities : entityBuilderState.abilityPackData.traits;
  mount?.querySelector("#addPackItemBtn")?.addEventListener("click", () => {
    syncAbilityPackDraftFromDom();
    collection.push(kind === "ability" ? getAbilityPackApi().normaliseAbility({}) : getAbilityPackApi().normaliseTrait({}));
    switchAbilityPackWorkspace(kind === "ability" ? "abilities" : "traits");
  });
  mount?.querySelectorAll("[data-pack-item]").forEach(card => {
    card.querySelector("[data-item-delete]").onclick = () => { syncAbilityPackDraftFromDom(); collection.splice(collection.findIndex(item => item.id === card.dataset.itemId), 1); switchAbilityPackWorkspace(kind === "ability" ? "abilities" : "traits"); };
    card.querySelectorAll("[data-item-move]").forEach(button => button.onclick = () => {
      syncAbilityPackDraftFromDom(); const index = collection.findIndex(item => item.id === card.dataset.itemId); const target = index + (button.dataset.itemMove === "up" ? -1 : 1);
      if (target >= 0 && target < collection.length) [collection[index], collection[target]] = [collection[target], collection[index]];
      switchAbilityPackWorkspace(kind === "ability" ? "abilities" : "traits");
    });
  });
}

function setupAbilityPackWorkspaceControls() {
  const workspace = document.querySelector(".abilityPackWorkspace");
  if (!workspace) return;
  workspace.querySelectorAll("[data-ability-pack-tab]").forEach(button => button.onclick = () => switchAbilityPackWorkspace(button.dataset.abilityPackTab));
  switchAbilityPackWorkspace(entityBuilderState.abilityPackWorkspaceTab || "overview");
}

function renderFactionWorkspaceShell() {
  const tabs = [
    ["overview", "Overview"],
    ["members", "Members"],
    ["hierarchy", "Hierarchy"],
    ["traits", "Traits"],
    ["ability-packs", "Ability Packs"],
    ["relationships", "Relationships"]
  ];
  return `
    <section class="factionWorkspace">
      <nav class="factionWorkspaceTabs" aria-label="Faction workspace">
        ${tabs.map(([key, label]) => `
          <button type="button" data-faction-tab="${key}" class="${key === entityBuilderState.factionWorkspaceTab ? "active" : ""}">
            ${label}
          </button>
        `).join("")}
      </nav>
      <div id="factionWorkspaceMount" class="factionWorkspaceMount"></div>
    </section>
  `;
}

function renderFactionOverviewWorkspace() {
  const hierarchy = entityBuilderState.factionHierarchy || { nodes: [] };
  return `
    <div class="factionWorkspacePanel">
      <h2>Faction Overview</h2>
      <p>Identity, context, notes, visibility, status and tags are edited in the standard fields above.</p>
      <div class="factionWorkspaceSummary">
        <span>${hierarchy.nodes.length} hierarchy node${hierarchy.nodes.length === 1 ? "" : "s"}</span>
        <span>Membership remains relationship-driven</span>
      </div>
    </div>
  `;
}

function renderFactionPlaceholderWorkspace(name) {
  return `
    <div class="factionWorkspacePanel factionWorkspacePlaceholder">
      <h2>${escapeHtml(name)}</h2>
      <p>${escapeHtml(name)} are planned for the next slice.</p>
    </div>
  `;
}

function renderAbilityPackSelector(packs, assignedIds, key) {
  const assigned = new Set(assignedIds || []);
  return `<div class="abilityPackSelector" data-pack-selector="${escapeHtml(key)}">
    <div class="abilityPackSelectorFilters"><input data-pack-search placeholder="Search Ability Packs…"><select data-pack-category><option value="">All categories</option>${[...new Set(packs.map(pack => pack.data_json?.category).filter(Boolean))].sort().map(value => `<option>${escapeHtml(value)}</option>`).join("")}</select><select data-pack-system><option value="">All systems</option>${[...new Set(packs.map(pack => pack.data_json?.systemId).filter(Boolean))].sort().map(value => `<option>${escapeHtml(value)}</option>`).join("")}</select></div>
    <div class="abilityPackSelectorList">${packs.map(pack => {
      const counts = getAbilityPackApi().countContents(pack.data_json);
      return `<label data-pack-option data-search="${escapeHtml(`${pack.name} ${pack.data_json?.category || ""}`.toLowerCase())}" data-category="${escapeHtml(pack.data_json?.category || "")}" data-system="${escapeHtml(pack.data_json?.systemId || "")}"><input type="checkbox" value="${escapeHtml(pack.id)}" ${assigned.has(pack.id) ? "checked" : ""}><span><strong>${escapeHtml(pack.name || pack.id)}</strong><small>${escapeHtml(pack.data_json?.category || "Uncategorised")} · ${counts.abilities} abilities · ${counts.traits} traits</small></span><button type="button" data-open-pack="${escapeHtml(pack.id)}">Open</button></label>`;
    }).join("") || `<p class="forgeEmptyState">No Ability Packs found.</p>`}</div>
  </div>`;
}

function wireAbilityPackSelector(selector, onChange) {
  if (!selector) return;
  const filter = () => {
    const search = selector.querySelector("[data-pack-search]").value.trim().toLowerCase();
    const category = selector.querySelector("[data-pack-category]").value;
    const system = selector.querySelector("[data-pack-system]").value;
    selector.querySelectorAll("[data-pack-option]").forEach(option => option.classList.toggle("hidden", !option.dataset.search.includes(search) || (category && option.dataset.category !== category) || (system && option.dataset.system !== system)));
  };
  selector.querySelectorAll("[data-pack-search], [data-pack-category], [data-pack-system]").forEach(input => { input.oninput = filter; input.onchange = filter; });
  selector.querySelectorAll('[data-pack-option] input[type="checkbox"]').forEach(input => input.onchange = () => onChange([...selector.querySelectorAll('[data-pack-option] input:checked')].map(item => item.value)));
  selector.querySelectorAll("[data-open-pack]").forEach(button => button.onclick = async event => {
    event.preventDefault(); event.stopPropagation();
    syncFactionHierarchyDraftFromDom(); syncFactionTraitsFromDom();
    const pack = await window.dmAPI.getEntity("ability_pack", button.dataset.openPack);
    if (pack) showGenericEntityBuilder(pack);
  });
}

function renderFactionTraitsWorkspace() {
  const traits = entityBuilderState.factionTraits || [];
  const validation = getAbilityPackApi().validatePackData({ traits });
  return `<div class="factionWorkspacePanel"><div class="factionWorkspaceHeader"><div><h2>Faction Traits</h2><p>Local embedded traits unique to this faction.</p></div><button type="button" id="addFactionTraitBtn">+ Add Trait</button></div>${renderFactionHierarchyWarnings(validation)}<div class="abilityPackItemList">${traits.length ? traits.map(trait => renderPackItemCard(trait, "trait").replace('data-pack-item="trait"', 'data-faction-trait')).join("") : `<p class="forgeEmptyState">No local traits.</p>`}</div></div>`;
}

function syncFactionTraitsFromDom() {
  document.querySelectorAll("[data-faction-trait]").forEach(card => {
    const trait = entityBuilderState.factionTraits.find(item => item.id === card.dataset.itemId);
    if (!trait) return;
    card.querySelectorAll("[data-item-field]").forEach(input => { const field = input.dataset.itemField; trait[field] = input.type === "checkbox" ? input.checked : field === "tags" ? getAbilityPackApi().normaliseTags(input.value) : input.value.trim(); });
  });
}

function wireFactionTraitControls() {
  const mount = document.querySelector("#factionWorkspaceMount");
  mount?.querySelector("#addFactionTraitBtn")?.addEventListener("click", () => { syncFactionTraitsFromDom(); entityBuilderState.factionTraits.push(getAbilityPackApi().normaliseTrait({})); switchFactionWorkspace("traits"); });
  mount?.querySelectorAll("[data-faction-trait]").forEach(card => {
    card.querySelector("[data-item-delete]").onclick = () => { syncFactionTraitsFromDom(); entityBuilderState.factionTraits.splice(entityBuilderState.factionTraits.findIndex(item => item.id === card.dataset.itemId), 1); switchFactionWorkspace("traits"); };
    card.querySelectorAll("[data-item-move]").forEach(button => button.onclick = () => { syncFactionTraitsFromDom(); const items = entityBuilderState.factionTraits; const index = items.findIndex(item => item.id === card.dataset.itemId); const target = index + (button.dataset.itemMove === "up" ? -1 : 1); if (target >= 0 && target < items.length) [items[index], items[target]] = [items[target], items[index]]; switchFactionWorkspace("traits"); });
  });
}

async function renderFactionAbilityPacksWorkspace() {
  const mount = document.querySelector("#factionWorkspaceMount");
  if (!mount) return;
  const packs = await getAllAbilityPacks();
  const memberCount = entityBuilderState.activeEntity?.id ? (await getFactionMembershipRelationships(entityBuilderState.activeEntity.id)).length : 0;
  const missing = entityBuilderState.factionAbilityPackIds.filter(id => !packs.some(pack => pack.id === id));
  mount.innerHTML = `<div class="factionWorkspacePanel"><div class="factionWorkspaceHeader"><div><h2>Faction-wide Ability Packs</h2><p>Attached packs currently affect ${memberCount} member${memberCount === 1 ? "" : "s"}. Save the faction to persist changes.</p></div><button type="button" id="createAbilityPackBtn">+ Create Pack</button></div>${missing.map(id => `<p class="factionValidation warning">Missing Ability Pack: ${escapeHtml(id)}</p>`).join("")}${renderAbilityPackSelector(packs, entityBuilderState.factionAbilityPackIds, "faction")}</div>`;
  wireAbilityPackSelector(mount.querySelector('[data-pack-selector="faction"]'), ids => { entityBuilderState.factionAbilityPackIds = ids; updateGenericEntityJsonPreview(); });
  mount.querySelector("#createAbilityPackBtn").onclick = () => { syncFactionTraitsFromDom(); entityBuilderState.activeEntityType = "ability_pack"; showGenericEntityBuilder(getDefaultGenericEntity("ability_pack")); };
}

function renderFactionRelationshipsWorkspace() {
  return `
    <div class="factionWorkspacePanel">
      <h2>Relationships</h2>
      <p>Use the existing Relationships panel alongside this editor. No relationship records are duplicated into faction data.</p>
      <button type="button" id="focusFactionRelationshipsBtn">Focus Relationships Panel</button>
    </div>
  `;
}

function getFactionNodeDepth(nodes, node, visited = new Set()) {
  if (!node || visited.has(node.id) || !node.parentNodeIds?.length) return 0;
  visited.add(node.id);
  const depths = node.parentNodeIds.map(parentId =>
    1 + getFactionNodeDepth(nodes, nodes.find(item => item.id === parentId), new Set(visited))
  );
  return Math.min(8, Math.max(0, ...depths));
}

function renderFactionHierarchyWarnings(validation) {
  const entries = [
    ...validation.errors.map(message => ({ type: "error", message })),
    ...validation.warnings.map(message => ({ type: "warning", message }))
  ];
  if (!entries.length) return `<p class="factionValidationOk">Hierarchy validation passed.</p>`;
  return `<div class="factionValidationList">${entries.map(entry => `
    <p class="factionValidation ${entry.type}">${escapeHtml(entry.message)}</p>
  `).join("")}</div>`;
}

function hasUnsavedFactionHierarchyChanges() {
  return entityBuilderState.factionHierarchyDirty || entityBuilderState.factionHierarchyEditorDirty;
}

function confirmDiscardFactionHierarchyChanges() {
  if (!hasUnsavedFactionHierarchyChanges()) return true;
  return confirm("Discard unsaved hierarchy changes?");
}

function clearFactionHierarchyEditorDraft() {
  entityBuilderState.factionHierarchyEditorDraft = null;
  entityBuilderState.factionHierarchyEditorNodeId = null;
  entityBuilderState.factionHierarchyEditorError = "";
  entityBuilderState.factionHierarchyEditorReturnNodeId = null;
  entityBuilderState.factionHierarchyEditorShouldFocus = false;
  entityBuilderState.factionHierarchyEditorDirty = false;
}

function discardUnsavedFactionHierarchyChanges() {
  if (entityBuilderState.factionHierarchyBaseline) {
    entityBuilderState.factionHierarchy = clonePlannedEncounterValue(entityBuilderState.factionHierarchyBaseline);
  }
  clearFactionHierarchyEditorDraft();
  entityBuilderState.factionHierarchyDirty = false;
  updateGenericEntityJsonPreview();
}

function renderFactionHierarchyWorkspace(counts = new Map(), packs = []) {
  const api = getFactionHierarchyApi();
  const hierarchy = entityBuilderState.factionHierarchy || { version: 1, nodes: [] };
  const nodes = api.sortFactionHierarchyNodes(hierarchy.nodes);
  const validation = api.validateFactionHierarchy(hierarchy);
  return `
    <div class="factionWorkspacePanel">
      <div class="factionWorkspaceHeader">
        <div><h2>Hierarchy</h2><p>Define ranks, titles, positions, honours and roles.</p></div>
        <button type="button" id="addFactionHierarchyNodeBtn">+ Add Node</button>
      </div>
      ${entityBuilderState.factionHierarchyEditorDraft ? `<section class="factionHierarchyTopEditor" data-hierarchy-node-editor><h3>${entityBuilderState.factionHierarchyEditorNodeId ? "Edit Hierarchy Node" : "Add Hierarchy Node"}</h3>${entityBuilderState.factionHierarchyEditorError ? `<p class="factionValidation error" data-hierarchy-editor-error>${escapeHtml(entityBuilderState.factionHierarchyEditorError)}</p>` : ""}${renderFactionHierarchyNodeCard(entityBuilderState.factionHierarchyEditorDraft, hierarchy.nodes, counts, packs, { editor: true })}</section>` : ""}
      ${renderFactionHierarchyWarnings(validation)}
      <div class="factionHierarchyList">
        ${nodes.length ? nodes.map(node => renderFactionHierarchyNodeCard(node, hierarchy.nodes, counts, packs, { editor: false })).join("") : `
          <p class="forgeEmptyState">No hierarchy nodes yet.</p>
        `}
      </div>
    </div>
  `;
}

function renderFactionHierarchyNodeCard(node, allNodes, counts, packs = [], { editor = true } = {}) {
  const api = getFactionHierarchyApi();
  const depth = getFactionNodeDepth(allNodes, node);
  const descendants = new Set(api.getFactionHierarchyDescendants(allNodes, node.id));
  const parentOptions = api.sortFactionHierarchyNodes(allNodes.filter(item =>
    item.id !== node.id && !descendants.has(item.id)
  ));
  const missingPackIds = getAbilityPackApi().uniqueIds(node.abilityPackIds).filter(id => !packs.some(pack => pack.id === id));
  return `
    <article class="factionHierarchyNode" data-node-id="${escapeHtml(node.id)}" style="--faction-node-depth:${depth}">
      <header>
        <div class="factionHierarchyNodeTitle">
          <span class="factionNodeIcon">${escapeHtml(node.icon || "◇")}</span>
          <strong>${escapeHtml(node.name || "Unnamed node")}</strong>
          <span class="factionBadge">${escapeHtml(node.nodeType)}</span>
          ${node.active ? "" : `<span class="factionBadge inactive">Inactive</span>`}
          ${node.hidden ? `<span class="factionBadge hiddenBadge">Hidden</span>` : ""}
          <span class="factionBadge memberCount">${counts.get(node.id) || 0} member${(counts.get(node.id) || 0) === 1 ? "" : "s"}</span>
        </div>
        <div class="factionNodeActions">
          ${editor ? "" : `<button type="button" data-node-edit>Edit</button>`}
          <button type="button" data-node-move="up">↑</button>
          <button type="button" data-node-move="down">↓</button>
          <button type="button" data-node-delete>Delete</button>
        </div>
      </header>
      ${editor ? `<div class="factionNodeForm">
        <label>Name<input data-node-field="name" value="${escapeHtml(node.name)}"></label>
        <label>Node type<select data-node-field="nodeType">
          ${api.NODE_TYPES.includes(node.nodeType) ? "" : `<option value="${escapeHtml(node.nodeType)}" selected>${escapeHtml(node.nodeType)} (unknown)</option>`}
          ${api.NODE_TYPES.map(type => `<option value="${type}" ${node.nodeType === type ? "selected" : ""}>${type}</option>`).join("")}
        </select></label>
        <label>Display title<input data-node-field="displayTitle" value="${escapeHtml(node.displayTitle)}"></label>
        <label>Title format<select data-node-field="titleFormat">
          ${api.TITLE_FORMATS.includes(node.titleFormat) ? "" : `<option value="${escapeHtml(node.titleFormat)}" selected>${escapeHtml(node.titleFormat)} (invalid)</option>`}
          ${api.TITLE_FORMATS.map(format => `<option value="${format}" ${node.titleFormat === format ? "selected" : ""}>${format}</option>`).join("")}
        </select></label>
        <label>Order<input data-node-field="order" type="number" value="${Number(node.order || 0)}"></label>
        <label>Colour<input data-node-field="colour" value="${escapeHtml(node.colour)}" placeholder="Theme token or CSS colour"></label>
        <label>Icon<input data-node-field="icon" value="${escapeHtml(node.icon)}"></label>
        <label class="factionNodeWide">Description<textarea data-node-field="description">${escapeHtml(node.description)}</textarea></label>
        <fieldset class="factionNodeParents factionNodeWide"><legend>Parent nodes</legend>
          ${node.parentNodeIds.filter(parentId => !allNodes.some(item => item.id === parentId)).map(parentId => `
            <label><input type="checkbox" data-node-parent="${escapeHtml(parentId)}" checked>${escapeHtml(parentId)} (missing)</label>
          `).join("")}
          ${parentOptions.length ? parentOptions.map(parent => `
            <label><input type="checkbox" data-node-parent="${escapeHtml(parent.id)}" ${node.parentNodeIds.includes(parent.id) ? "checked" : ""}>${escapeHtml(parent.name || parent.id)}</label>
          `).join("") : `<span>No eligible parents</span>`}
        </fieldset>
        <label class="factionCheck"><input type="checkbox" data-node-field="active" ${node.active ? "checked" : ""}> Active</label>
        <label class="factionCheck"><input type="checkbox" data-node-field="hidden" ${node.hidden ? "checked" : ""}> Hidden</label>
        <label class="factionCheck"><input type="checkbox" data-node-field="promotional" ${node.promotional ? "checked" : ""}> Promotional</label>
        <div class="factionNodeWide factionNodePackAssignment"><strong>Ability Packs</strong><small>${counts.get(node.id) || 0} affected member${(counts.get(node.id) || 0) === 1 ? "" : "s"}</small>${missingPackIds.map(id => `<span class="factionValidation warning">Missing pack: ${escapeHtml(id)}</span>`).join("")}${renderAbilityPackSelector(packs, node.abilityPackIds, `node-${node.id}`)}</div>
        <div class="factionNodeWide factionNodeEditorActions"><button type="button" data-node-save>${entityBuilderState.factionHierarchyEditorNodeId ? "Apply Node Changes" : "Create Hierarchy Node"}</button><button type="button" data-node-cancel>Cancel</button></div>
      </div>` : ""}
    </article>
  `;
}

async function renderFactionMembersWorkspace() {
  const faction = entityBuilderState.activeEntity;
  const mount = document.querySelector("#factionWorkspaceMount");
  if (!mount || !faction?.id) {
    if (mount) mount.innerHTML = `<div class="factionWorkspacePanel"><p class="forgeEmptyState">Save this faction before assigning members.</p></div>`;
    return;
  }
  mount.innerHTML = `<div class="factionWorkspacePanel"><p class="forgeEmptyState">Loading faction members…</p></div>`;
  const relationships = await getFactionMembershipRelationships(faction.id);
  const hierarchy = entityBuilderState.factionHierarchy || { nodes: [] };
  const rows = await Promise.all(relationships.map(async relationship => {
    const registry = getFactionMetadataRegistry();
    const memberRelationships = await window.MasterForgeRelationshipEngine.getRelationshipsForEntity(
      relationship.sourceEntityType,
      relationship.sourceEntityId
    );
    const primaryVisibleCount = memberRelationships.filter(item =>
      FACTION_MEMBERSHIP_TYPES.has(item.relationshipType) &&
      item.data_json?.[registry.KEYS.PRIMARY_FACTION] === true &&
      item.data_json?.[registry.KEYS.TITLE_VISIBILITY] !== registry.TITLE_VISIBILITY.HIDDEN
    ).length;
    return {
      relationship,
      entity: await window.dmAPI.getEntity(
        relationship.sourceEntityType,
        relationship.sourceEntityId
      ),
      multiplePrimary: primaryVisibleCount > 1
    };
  }));
  mount.innerHTML = `
    <div class="factionWorkspacePanel">
      <div class="factionWorkspaceHeader"><div><h2>Members</h2><p>Assignments are stored on existing membership relationships.</p></div><span>${rows.length} member${rows.length === 1 ? "" : "s"}</span></div>
      <div class="factionMembersList">
        ${rows.length ? rows.map(row => renderFactionMemberCard(row, hierarchy)).join("") : `<p class="forgeEmptyState">No incoming NPC, PC or Creature memberships.</p>`}
      </div>
    </div>
  `;
  wireFactionMemberControls(rows, hierarchy);
}

function renderFactionMemberCard({ relationship, entity, multiplePrimary }, hierarchy) {
  const registry = getFactionMetadataRegistry();
  const keys = registry.KEYS;
  const metadata = relationship.data_json || {};
  const isSecret = relationship.relationshipType === "secretly_member_of";
  const rawVisibility = metadata[keys.TITLE_VISIBILITY] || (isSecret ? registry.TITLE_VISIBILITY.GM : registry.TITLE_VISIBILITY.PUBLIC);
  const visibility = isSecret && rawVisibility === registry.TITLE_VISIBILITY.PUBLIC ? registry.TITLE_VISIBILITY.GM : rawVisibility;
  const nodeId = metadata[keys.FACTION_RANK_ID] || "";
  const node = hierarchy.nodes.find(item => item.id === nodeId);
  const missingNode = nodeId && !node;
  const preview = formatFactionMemberDisplayName({
    entityName: entity?.name || relationship.sourceEntityId,
    node,
    membershipMetadata: { ...metadata, [keys.TITLE_VISIBILITY]: visibility },
    isSecret
  });
  return `
    <article class="factionMemberCard" data-relationship-id="${escapeHtml(relationship.id)}">
      <header><div><strong>${escapeHtml(preview)}</strong><span>${escapeHtml(formatEntityTypeLabel(relationship.sourceEntityType))}</span></div><div><span class="factionBadge ${isSecret ? "secret" : "public"}">${isSecret ? "Secret / GM-only" : "Public"}</span></div></header>
      <div class="factionMemberForm">
        <label>Hierarchy node<select data-member-field="rank">
          <option value="">Unranked</option>
          ${getFactionHierarchyApi().sortFactionHierarchyNodes(hierarchy.nodes).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === nodeId ? "selected" : ""}>${escapeHtml(item.name || item.id)}</option>`).join("")}
        </select></label>
        <label>Title visibility<select data-member-field="visibility">
          ${[registry.TITLE_VISIBILITY.PUBLIC, registry.TITLE_VISIBILITY.GM, registry.TITLE_VISIBILITY.HIDDEN]
            .filter(value => !isSecret || value !== registry.TITLE_VISIBILITY.PUBLIC)
            .map(value => `<option value="${value}" ${visibility === value ? "selected" : ""}>${value}</option>`).join("")}
        </select></label>
        <label>Title override<input data-member-field="override" value="${escapeHtml(metadata[keys.FACTION_TITLE_OVERRIDE] || "")}"></label>
        <label class="factionCheck"><input type="checkbox" data-member-field="primary" ${metadata[keys.PRIMARY_FACTION] === true ? "checked" : ""}> Primary faction</label>
        <label class="factionCheck"><input type="checkbox" data-member-field="show-title" ${metadata[keys.SHOW_TITLE_IN_DISPLAY_NAME] !== false ? "checked" : ""}> Show title in display name</label>
      </div>
      ${missingNode ? `<p class="factionValidation warning">Assigned node ${escapeHtml(nodeId)} is missing.</p>` : ""}
      ${node?.hidden && visibility === registry.TITLE_VISIBILITY.PUBLIC ? `<p class="factionValidation warning">Hidden hierarchy node has a public title assignment.</p>` : ""}
      ${multiplePrimary ? `<p class="factionValidation warning">This member has multiple visible faction memberships marked primary.</p>` : ""}
      <div class="factionTitlePreview"><small>Preview</small><strong data-title-preview>${escapeHtml(preview)}</strong>${isSecret ? `<span>GM-only</span>` : ""}</div>
      <footer><button type="button" data-save-member>Save Assignment</button><button type="button" data-open-member>Open Member</button><span data-member-status></span></footer>
    </article>
  `;
}

function wireFactionMemberControls(rows, hierarchy) {
  const registry = getFactionMetadataRegistry();
  const keys = registry.KEYS;
  document.querySelectorAll(".factionMemberCard").forEach(card => {
    const row = rows.find(item => item.relationship.id === card.dataset.relationshipId);
    if (!row) return;
    const isSecret = row.relationship.relationshipType === "secretly_member_of";
    const updatePreview = () => {
      const node = hierarchy.nodes.find(item => item.id === card.querySelector('[data-member-field="rank"]')?.value);
      const metadata = {
        [keys.FACTION_TITLE_OVERRIDE]: card.querySelector('[data-member-field="override"]')?.value || "",
        [keys.TITLE_VISIBILITY]: card.querySelector('[data-member-field="visibility"]')?.value,
        [keys.SHOW_TITLE_IN_DISPLAY_NAME]: card.querySelector('[data-member-field="show-title"]')?.checked !== false
      };
      card.querySelector("[data-title-preview]").textContent = formatFactionMemberDisplayName({
        entityName: row.entity?.name || row.relationship.sourceEntityId,
        node,
        membershipMetadata: metadata,
        isSecret
      });
    };
    card.querySelectorAll("input, select").forEach(input => {
      input.oninput = updatePreview;
      input.onchange = updatePreview;
    });
    card.querySelector("[data-save-member]").onclick = async () => {
      const status = card.querySelector("[data-member-status]");
      const visibilityInput = card.querySelector('[data-member-field="visibility"]');
      let visibility = visibilityInput.value;
      if (isSecret && visibility === registry.TITLE_VISIBILITY.PUBLIC) {
        visibility = registry.TITLE_VISIBILITY.GM;
        visibilityInput.value = visibility;
      }
      const data_json = {
        [keys.FACTION_RANK_ID]: card.querySelector('[data-member-field="rank"]').value,
        [keys.FACTION_TITLE_OVERRIDE]: card.querySelector('[data-member-field="override"]').value.trim(),
        [keys.PRIMARY_FACTION]: card.querySelector('[data-member-field="primary"]').checked,
        [keys.TITLE_VISIBILITY]: visibility,
        [keys.SHOW_TITLE_IN_DISPLAY_NAME]: card.querySelector('[data-member-field="show-title"]').checked
      };
      try {
        status.textContent = "Saving…";
        const updated = await window.MasterForgeRelationshipEngine.updateRelationshipMetadata(
          row.relationship.id,
          { data_json }
        );
        row.relationship = window.MasterForgeRelationshipEngine.normaliseRelationshipRecord(updated);
        status.textContent = "Saved";
        updatePreview();
        await refreshInheritanceAndFactionViews(
          row.entity,
          row.relationship.targetEntityId
        );
      } catch (error) {
        status.textContent = error?.message || "Save failed";
      }
    };
    card.querySelector("[data-open-member]").onclick = async () => {
      syncFactionHierarchyDraftFromDom();
      const fresh = await window.dmAPI.getEntity(row.relationship.sourceEntityType, row.relationship.sourceEntityId);
      const faction = entityBuilderState.activeEntity;
      if (fresh) {
        pendingDmWorkspaceReturn = faction ? { label: "Back to Faction", action: () => showGenericEntityBuilder(faction, { factionTab: "members" }) } : null;
        await openCanonicalEntityEditor(fresh);
      }
    };
  });
}

async function switchFactionWorkspace(tab) {
  syncFactionHierarchyDraftFromDom();
  syncFactionTraitsFromDom();
  if (entityBuilderState.factionWorkspaceTab === "hierarchy" && tab !== "hierarchy" && hasUnsavedFactionHierarchyChanges()) {
    if (!confirmDiscardFactionHierarchyChanges()) return false;
    discardUnsavedFactionHierarchyChanges();
  }
  entityBuilderState.factionWorkspaceTab = tab;
  document.querySelectorAll("[data-faction-tab]").forEach(button =>
    button.classList.toggle("active", button.dataset.factionTab === tab)
  );
  const mount = document.querySelector("#factionWorkspaceMount");
  if (!mount) return;
  if (tab === "overview") mount.innerHTML = renderFactionOverviewWorkspace();
  if (tab === "traits") { mount.innerHTML = renderFactionTraitsWorkspace(); wireFactionTraitControls(); }
  if (tab === "ability-packs") await renderFactionAbilityPacksWorkspace();
  if (tab === "relationships") {
    mount.innerHTML = renderFactionRelationshipsWorkspace();
    mount.querySelector("#focusFactionRelationshipsBtn").onclick = () =>
      document.querySelector("#entity-debug-relationships")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (tab === "members") await renderFactionMembersWorkspace();
  if (tab === "hierarchy") await refreshFactionHierarchyWorkspace();
  return true;
}

function setupFactionWorkspaceControls() {
  const workspace = document.querySelector(".factionWorkspace");
  if (!workspace) return;
  workspace.querySelectorAll("[data-faction-tab]").forEach(button => {
    button.onclick = () => switchFactionWorkspace(button.dataset.factionTab);
  });
  switchFactionWorkspace(entityBuilderState.factionWorkspaceTab || "overview");
}

function collectFactionHierarchyNodeCard(card, original) {
  const value = field => card.querySelector(`[data-node-field="${field}"]`);
  return {
    ...original,
    name: value("name").value.trim(),
    nodeType: value("nodeType").value,
    displayTitle: value("displayTitle").value.trim(),
    titleFormat: value("titleFormat").value,
    order: Number(value("order").value || 0),
    colour: value("colour").value.trim(),
    icon: value("icon").value.trim(),
    description: value("description").value.trim(),
    active: value("active").checked,
    hidden: value("hidden").checked,
    promotional: value("promotional").checked,
    parentNodeIds: [...card.querySelectorAll("[data-node-parent]:checked")]
      .map(input => input.dataset.nodeParent)
  };
}

function syncFactionHierarchyDraftFromDom() {
  const hierarchy = entityBuilderState.factionHierarchy;
  if (!hierarchy) return;
  const editorCard = document.querySelector("[data-hierarchy-node-editor] .factionHierarchyNode");
  if (editorCard && entityBuilderState.factionHierarchyEditorDraft) {
    entityBuilderState.factionHierarchyEditorDraft = collectFactionHierarchyNodeCard(
      editorCard,
      entityBuilderState.factionHierarchyEditorDraft
    );
  }
}

async function refreshFactionHierarchyWorkspace() {
  const mount = document.querySelector("#factionWorkspaceMount");
  if (!mount) return;
  const factionId = entityBuilderState.activeEntity?.id;
  const counts = factionId
    ? await countFactionMembershipsByNode(factionId)
    : new Map();
  const packs = await getAllAbilityPacks();
  mount.innerHTML = renderFactionHierarchyWorkspace(counts, packs);
  wireFactionHierarchyControls();
  mount.querySelectorAll('[data-pack-selector^="node-"]').forEach(selector => {
    const nodeId = selector.dataset.packSelector.slice(5);
    wireAbilityPackSelector(selector, ids => {
      if (entityBuilderState.factionHierarchyEditorDraft?.id === nodeId) entityBuilderState.factionHierarchyEditorDraft.abilityPackIds = ids;
      entityBuilderState.factionHierarchyEditorDirty = true;
      updateGenericEntityJsonPreview();
    });
  });
  if (entityBuilderState.factionHierarchyEditorDraft && entityBuilderState.factionHierarchyEditorShouldFocus) {
    entityBuilderState.factionHierarchyEditorShouldFocus = false;
    requestAnimationFrame(() => {
      const editor = mount.querySelector("[data-hierarchy-node-editor]");
      const nameInput = editor?.querySelector('[data-node-field="name"]');
      if (!editor || !nameInput) return;
      editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
      nameInput.focus();
      nameInput.select();
    });
  }
  if (entityBuilderState.factionHierarchyFocusNodeId) {
    const focused = [...mount.querySelectorAll(".factionHierarchyNode")].find(
      card => card.dataset.nodeId === entityBuilderState.factionHierarchyFocusNodeId
    );
    if (focused) {
      focused.classList.add("factionHierarchyNodeFocused");
      focused.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    entityBuilderState.factionHierarchyFocusNodeId = null;
  }
}

function getFactionHierarchyReplacementNode(promptValue, deletedNodeId) {
  const value = String(promptValue || "").trim();
  if (!value || value.toUpperCase() === "CANCEL") return { cancelled: true };
  if (value.toUpperCase() === "CLEAR") return { nodeId: "" };
  const node = entityBuilderState.factionHierarchy.nodes.find(item =>
    item.id === value && item.id !== deletedNodeId
  );
  return node ? { nodeId: node.id } : { invalid: true };
}

async function deleteFactionHierarchyNode(nodeId) {
  const hierarchy = entityBuilderState.factionHierarchy;
  const node = hierarchy.nodes.find(item => item.id === nodeId);
  if (!node) return;
  if (entityBuilderState.factionHierarchyEditorNodeId === nodeId) {
    syncFactionHierarchyDraftFromDom();
    if (entityBuilderState.factionHierarchyEditorDirty && !confirmDiscardFactionHierarchyChanges()) return;
    clearFactionHierarchyEditorDraft();
  }
  const memberships = entityBuilderState.activeEntity?.id
    ? await getFactionMembershipsByNode(entityBuilderState.activeEntity.id, nodeId)
    : [];
  const children = hierarchy.nodes.filter(item => item.parentNodeIds.includes(nodeId));
  let membershipReplacement = "";
  let childReplacement = "";

  if (memberships.length) {
    const response = prompt(
      `${node.name || node.id} is assigned to ${memberships.length} membership(s).\n` +
      `Enter another hierarchy node ID to reassign them, CLEAR to make them unranked, or CANCEL.`
    );
    const parsed = getFactionHierarchyReplacementNode(response, nodeId);
    if (parsed.cancelled) return;
    if (parsed.invalid) return alert("That replacement hierarchy node does not exist.");
    membershipReplacement = parsed.nodeId;
  } else if (!confirm(`Delete hierarchy node ${node.name || node.id}?`)) {
    return;
  }

  if (children.length) {
    const response = prompt(
      `${children.length} child node(s) reference this node.\n` +
      `Enter another hierarchy node ID to reparent them, CLEAR to remove this parent reference, or CANCEL.`
    );
    const parsed = getFactionHierarchyReplacementNode(response, nodeId);
    if (parsed.cancelled) return;
    if (parsed.invalid) return alert("That replacement hierarchy node does not exist.");
    childReplacement = parsed.nodeId;
    if (
      childReplacement &&
      children.some(child => getFactionHierarchyApi().wouldCreateFactionHierarchyCycle(
        hierarchy,
        child.id,
        [...child.parentNodeIds.filter(id => id !== nodeId), childReplacement]
      ))
    ) {
      return alert("That reparenting choice would create a hierarchy cycle.");
    }
  }

  const rankKey = getFactionMetadataRegistry().KEYS.FACTION_RANK_ID;
  for (const membership of memberships) {
    await window.MasterForgeRelationshipEngine.updateRelationshipMetadata(
      membership.id,
      { data_json: { [rankKey]: membershipReplacement } }
    );
  }
  children.forEach(child => {
    child.parentNodeIds = [
      ...child.parentNodeIds.filter(id => id !== nodeId),
      ...(childReplacement ? [childReplacement] : [])
    ].filter((id, index, values) => values.indexOf(id) === index);
  });
  hierarchy.nodes = hierarchy.nodes.filter(item => item.id !== nodeId);
  entityBuilderState.factionHierarchyDirty = true;
  updateGenericEntityJsonPreview();
  await refreshFactionHierarchyWorkspace();
}

function wireFactionHierarchyControls() {
  const hierarchy = entityBuilderState.factionHierarchy;
  const api = getFactionHierarchyApi();
  document.querySelector("#addFactionHierarchyNodeBtn")?.addEventListener("click", async () => {
    syncFactionHierarchyDraftFromDom();
    if (entityBuilderState.factionHierarchyEditorDraft && !entityBuilderState.factionHierarchyEditorNodeId) {
      entityBuilderState.factionHierarchyEditorShouldFocus = true;
      await refreshFactionHierarchyWorkspace();
      return;
    }
    if (entityBuilderState.factionHierarchyEditorDraft && entityBuilderState.factionHierarchyEditorDirty) {
      if (!confirmDiscardFactionHierarchyChanges()) return;
      clearFactionHierarchyEditorDraft();
    }
    const order = hierarchy.nodes.length
      ? Math.max(...hierarchy.nodes.map(node => Number(node.order || 0))) + 10
      : 10;
    entityBuilderState.factionHierarchyEditorDraft = api.normaliseFactionHierarchyNode({
      id: api.createFactionHierarchyNodeId(),
      name: "",
      displayTitle: "",
      order
    });
    entityBuilderState.factionHierarchyEditorNodeId = null;
    entityBuilderState.factionHierarchyEditorError = "";
    entityBuilderState.factionHierarchyEditorReturnNodeId = null;
    entityBuilderState.factionHierarchyEditorShouldFocus = true;
    entityBuilderState.factionHierarchyEditorDirty = false;
    await refreshFactionHierarchyWorkspace();
  });
  document.querySelectorAll(".factionHierarchyNode").forEach(card => {
    const nodeId = card.dataset.nodeId;
    card.querySelector("[data-node-edit]")?.addEventListener("click", async () => {
      syncFactionHierarchyDraftFromDom();
      if (entityBuilderState.factionHierarchyEditorNodeId === nodeId) {
        entityBuilderState.factionHierarchyEditorShouldFocus = true;
        await refreshFactionHierarchyWorkspace();
        return;
      }
      if (entityBuilderState.factionHierarchyEditorDraft && entityBuilderState.factionHierarchyEditorDirty) {
        if (!confirmDiscardFactionHierarchyChanges()) return;
        clearFactionHierarchyEditorDraft();
      }
      const node = hierarchy.nodes.find(item => item.id === nodeId);
      if (!node) return;
      entityBuilderState.factionHierarchyEditorDraft = clonePlannedEncounterValue(node);
      entityBuilderState.factionHierarchyEditorNodeId = node.id;
      entityBuilderState.factionHierarchyEditorError = "";
      entityBuilderState.factionHierarchyEditorReturnNodeId = node.id;
      entityBuilderState.factionHierarchyEditorShouldFocus = true;
      entityBuilderState.factionHierarchyEditorDirty = false;
      await refreshFactionHierarchyWorkspace();
    });
    card.querySelector("[data-node-save]")?.addEventListener("click", async () => {
      const draft = entityBuilderState.factionHierarchyEditorDraft;
      if (!draft) return;
      const candidate = collectFactionHierarchyNodeCard(card, draft);
      if (!candidate.name) {
        entityBuilderState.factionHierarchyEditorDraft = candidate;
        entityBuilderState.factionHierarchyEditorError = "Node Name is required.";
        entityBuilderState.factionHierarchyEditorDirty = true;
        entityBuilderState.factionHierarchyEditorShouldFocus = true;
        await refreshFactionHierarchyWorkspace();
        return;
      }
      if (api.wouldCreateFactionHierarchyCycle(hierarchy, nodeId, candidate.parentNodeIds)) {
        entityBuilderState.factionHierarchyEditorDraft = candidate;
        entityBuilderState.factionHierarchyEditorError = "Those parents would create a hierarchy cycle.";
        entityBuilderState.factionHierarchyEditorDirty = true;
        entityBuilderState.factionHierarchyEditorShouldFocus = true;
        await refreshFactionHierarchyWorkspace();
        return;
      }
      const existingIndex = hierarchy.nodes.findIndex(node => node.id === (entityBuilderState.factionHierarchyEditorNodeId || candidate.id));
      if (existingIndex >= 0) hierarchy.nodes[existingIndex] = candidate;
      else hierarchy.nodes.push(candidate);
      entityBuilderState.factionHierarchyEditorDraft = null;
      entityBuilderState.factionHierarchyEditorNodeId = null;
      entityBuilderState.factionHierarchyEditorError = "";
      entityBuilderState.factionHierarchyEditorReturnNodeId = null;
      entityBuilderState.factionHierarchyEditorDirty = false;
      entityBuilderState.factionHierarchyDirty = true;
      updateGenericEntityJsonPreview();
      await refreshFactionHierarchyWorkspace();
      requestAnimationFrame(() => document.querySelector("#addFactionHierarchyNodeBtn")?.focus());
    });
    card.querySelector("[data-node-cancel]")?.addEventListener("click", async () => {
      syncFactionHierarchyDraftFromDom();
      if (entityBuilderState.factionHierarchyEditorDirty && !confirmDiscardFactionHierarchyChanges()) return;
      const returnNodeId = entityBuilderState.factionHierarchyEditorReturnNodeId;
      clearFactionHierarchyEditorDraft();
      await refreshFactionHierarchyWorkspace();
      requestAnimationFrame(() => {
        const target = returnNodeId
          ? document.querySelector(`.factionHierarchyNode[data-node-id="${CSS.escape(returnNodeId)}"] [data-node-edit]`)
          : document.querySelector("#addFactionHierarchyNodeBtn");
        target?.focus();
      });
    });
    card.querySelector("[data-node-delete]")?.addEventListener("click", () => deleteFactionHierarchyNode(nodeId));
    card.querySelectorAll("[data-node-move]").forEach(button => {
      button.onclick = async () => {
        syncFactionHierarchyDraftFromDom();
        const node = hierarchy.nodes.find(item => item.id === nodeId);
        if (!node) return;
        node.order = Number(node.order || 0) + (button.dataset.nodeMove === "up" ? -10 : 10);
        entityBuilderState.factionHierarchyDirty = true;
        updateGenericEntityJsonPreview();
        await refreshFactionHierarchyWorkspace();
      };
    });
  });
  document.querySelectorAll("[data-hierarchy-node-editor] [data-node-field], [data-hierarchy-node-editor] [data-node-parent]").forEach(input => {
    const markDirty = () => { entityBuilderState.factionHierarchyEditorDirty = true; };
    input.addEventListener("input", markDirty);
    input.addEventListener("change", markDirty);
  });
}

window.runFactionHierarchyDiagnostic = async function (factionId) {
  const id = String(factionId || "").trim();
  const checks = [];
  const addCheck = (name, passed, expected, actual, skipped = false) =>
    checks.push({ name, passed: Boolean(passed), expected, actual, ...(skipped ? { skipped: true } : {}) });
  const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const api = getFactionHierarchyApi();
  const rankKey = getFactionMetadataRegistry().KEYS.FACTION_RANK_ID;
  let originalFaction = null;
  let originalMembership = null;

  if (!id) {
    addCheck("faction ID supplied", false, "non-empty faction ID", factionId);
    return { passed: false, checks };
  }

  try {
    originalFaction = await window.dmAPI.getEntity("faction", id);
    addCheck("faction loads", Boolean(originalFaction), "stored faction", originalFaction?.id || null);
    if (!originalFaction) throw new Error(`Faction not found: ${id}`);

    const originalData = originalFaction.data_json || {};
    const hierarchy = api.normaliseFactionHierarchy(originalData);
    addCheck("hierarchy normalises", hierarchy.version === 1 && Array.isArray(hierarchy.nodes), { version: 1, nodes: "array" }, { version: hierarchy.version, nodes: Array.isArray(hierarchy.nodes) });
    const temporaryId = api.createFactionHierarchyNodeId();
    const temporaryNode = api.normaliseFactionHierarchyNode({
      id: temporaryId,
      name: "Slice 1 Diagnostic Node",
      displayTitle: "Diagnostic",
      order: 98760
    });
    const testHierarchy = { ...hierarchy, version: 1, nodes: [...hierarchy.nodes, temporaryNode] };
    await window.dmAPI.updateEntity("faction", id, {
      data_json: { ...originalData, factionHierarchy: testHierarchy }
    });
    let reloaded = await window.dmAPI.getEntity("faction", id);
    let storedNode = api.normaliseFactionHierarchy(reloaded.data_json).nodes.find(node => node.id === temporaryId);
    addCheck("temporary node persists", Boolean(storedNode), temporaryId, storedNode?.id || null);
    addCheck("unrelated metadata preserved", Object.keys(originalData).filter(key => key !== "factionHierarchy").every(key => sameJson(reloaded.data_json[key], originalData[key])), "all unrelated keys unchanged", "checked");

    const renamedHierarchy = api.normaliseFactionHierarchy(reloaded.data_json);
    storedNode = renamedHierarchy.nodes.find(node => node.id === temporaryId);
    storedNode.name = "Renamed Slice 1 Diagnostic Node";
    storedNode.order = 98770;
    reloaded.data_json = {
      ...reloaded.data_json,
      factionHierarchy: renamedHierarchy
    };
    await window.dmAPI.updateEntity("faction", id, { data_json: reloaded.data_json });
    reloaded = await window.dmAPI.getEntity("faction", id);
    storedNode = api.normaliseFactionHierarchy(reloaded.data_json).nodes.find(node => node.id === temporaryId);
    addCheck("rename preserves ID", storedNode?.id === temporaryId && storedNode?.name.startsWith("Renamed"), temporaryId, storedNode?.id);
    addCheck("reorder preserves ID", storedNode?.id === temporaryId && storedNode?.order === 98770, { id: temporaryId, order: 98770 }, { id: storedNode?.id, order: storedNode?.order });

    const cyclic = {
      version: 1,
      nodes: [api.normaliseFactionHierarchyNode({ id: "fhn_cycle", name: "Cycle", parentNodeIds: ["fhn_cycle"] })]
    };
    const cycleValidation = api.validateFactionHierarchy(cyclic);
    addCheck("cycle rejected", !cycleValidation.valid, "invalid hierarchy", cycleValidation);

    const memberships = await getFactionMembershipRelationships(id);
    if (!memberships.length) {
      addCheck("membership assignment", true, "membership available", "Skipped: faction has no NPC, PC or Creature membership.", true);
    } else {
      originalMembership = memberships[0];
      const updated = await window.MasterForgeRelationshipEngine.updateRelationshipMetadata(
        originalMembership.id,
        { data_json: { [rankKey]: temporaryId } }
      );
      const normalisedUpdated = window.MasterForgeRelationshipEngine.normaliseRelationshipRecord(updated);
      addCheck("membership identity unchanged", normalisedUpdated.id === originalMembership.id && normalisedUpdated.sourceEntityType === originalMembership.sourceEntityType && normalisedUpdated.sourceEntityId === originalMembership.sourceEntityId && normalisedUpdated.relationshipType === originalMembership.relationshipType && normalisedUpdated.targetEntityType === originalMembership.targetEntityType && normalisedUpdated.targetEntityId === originalMembership.targetEntityId, "all identity fields unchanged", normalisedUpdated);
      const relationshipReload = (await window.dmAPI.getEntityRelationships(
        originalMembership.sourceEntityType,
        originalMembership.sourceEntityId
      )).find(item => item.id === originalMembership.id);
      addCheck("membership metadata persists", relationshipReload?.data_json?.[rankKey] === temporaryId, temporaryId, relationshipReload?.data_json?.[rankKey]);
    }
  } catch (error) {
    addCheck("diagnostic completed", false, "all operations succeed", error?.message || String(error));
  } finally {
    if (originalMembership) {
      try {
        await window.MasterForgeRelationshipEngine.updateRelationshipMetadata(
          originalMembership.id,
          { data_json: originalMembership.data_json || {}, mergeDataJson: false }
        );
        addCheck("membership metadata restored", true, "original metadata", "restored");
      } catch (error) {
        addCheck("membership metadata restored", false, "original metadata", error?.message || String(error));
      }
    }
    if (originalFaction) {
      try {
        await window.dmAPI.updateEntity("faction", id, {
          name: originalFaction.name,
          description: originalFaction.description,
          data_json: originalFaction.data_json,
          source_pack: originalFaction.source_pack,
          is_persistent: originalFaction.is_persistent
        });
        const restored = await window.dmAPI.getEntity("faction", id);
        addCheck("faction hierarchy restored", sameJson(restored?.data_json, originalFaction.data_json), originalFaction.data_json, restored?.data_json);
      } catch (error) {
        addCheck("faction hierarchy restored", false, "original faction data", error?.message || String(error));
      }
    }
  }

  return { passed: checks.every(check => check.passed), checks };
};

window.runAbilityPackDiagnostic = async function (abilityPackId) {
  const id = String(abilityPackId || "").trim();
  const checks = [];
  const check = (name, passed, expected, actual) => checks.push({ name, passed: Boolean(passed), expected, actual });
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  let originalPack = null;
  let originalFaction = null;
  try {
    originalPack = id ? await window.dmAPI.getEntity("ability_pack", id) : null;
    check("Ability Pack loads", Boolean(originalPack), "stored ability_pack", originalPack?.id || null);
    if (!originalPack) throw new Error(`Ability Pack not found: ${id || "(empty ID)"}`);
    const api = getAbilityPackApi();
    const data = api.normalisePackData(originalPack.data_json);
    const ability = api.normaliseAbility({ name: "Slice 3 Diagnostic Ability", description: "Temporary diagnostic record" });
    const trait = api.normaliseTrait({ name: "Slice 3 Diagnostic Trait", description: "Temporary diagnostic record" });
    const updatedData = { ...data, abilities: [...data.abilities, ability], traits: [...data.traits, trait] };
    await window.dmAPI.updateEntity("ability_pack", id, { data_json: updatedData });
    const reloaded = await window.dmAPI.getEntity("ability_pack", id);
    const reloadedData = api.normalisePackData(reloaded.data_json);
    check("Embedded ability persists", reloadedData.abilities.some(item => item.id === ability.id), ability.id, reloadedData.abilities.map(item => item.id));
    check("Embedded trait persists", reloadedData.traits.some(item => item.id === trait.id), trait.id, reloadedData.traits.map(item => item.id));
    check("Unknown pack metadata preserved", Object.keys(originalPack.data_json || {}).filter(key => !["abilities", "traits"].includes(key)).every(key => same(reloaded.data_json[key], originalPack.data_json[key])), "unchanged keys", "checked");
    const factions = await window.dmAPI.getEntitiesByType("faction").catch(() => []);
    if (factions.length) {
      originalFaction = factions[0];
      const assigned = api.uniqueIds([...(originalFaction.data_json?.abilityPackIds || []), id]);
      await window.dmAPI.updateEntity("faction", originalFaction.id, { data_json: { ...(originalFaction.data_json || {}), abilityPackIds: assigned } });
      const factionReload = await window.dmAPI.getEntity("faction", originalFaction.id);
      check("Faction assignment persists", factionReload.data_json?.abilityPackIds?.includes(id), id, factionReload.data_json?.abilityPackIds);
    } else {
      check("Faction assignment scan", true, "optional when no faction exists", "skipped");
    }
  } catch (error) {
    check("Diagnostic completes", false, "all operations succeed", error?.message || String(error));
  } finally {
    if (originalFaction) {
      try { await window.dmAPI.updateEntity("faction", originalFaction.id, { data_json: originalFaction.data_json }); check("Faction restored", true, "original data_json", "restored"); }
      catch (error) { check("Faction restored", false, "original data_json", error?.message || String(error)); }
    }
    if (originalPack) {
      try { await window.dmAPI.updateEntity("ability_pack", id, { name: originalPack.name, description: originalPack.description, data_json: originalPack.data_json, source_pack: originalPack.source_pack, is_persistent: originalPack.is_persistent }); const restored = await window.dmAPI.getEntity("ability_pack", id); check("Ability Pack restored", same(restored?.data_json, originalPack.data_json), originalPack.data_json, restored?.data_json); }
      catch (error) { check("Ability Pack restored", false, "original data_json", error?.message || String(error)); }
    }
  }
  const result = { passed: checks.every(item => item.passed), checks };
  console.table(checks);
  console.log("Ability Pack diagnostic", result);
  return result;
};

window.runInheritanceDiagnostic = async function (entityType, entityId) {
  const checks = [];
  const add = (name, passed, expected, actual, skipped = false) => checks.push({ name, passed: Boolean(passed), expected, actual, ...(skipped ? { skipped: true } : {}) });
  const skip = (name, reason) => add(name, true, "suitable source data", `Skipped: ${reason}`, true);
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  let entity = null;
  let before = null;
  try {
    entity = await window.dmAPI.getEntity(entityType, entityId);
    add("entity loads", Boolean(entity), `${entityType}/${entityId}`, entity?.id || null);
    if (!entity) throw new Error("Entity not found.");
    const relationships = await window.MasterForgeRelationshipEngine.getRelationshipsForEntity(entityType, entityId);
    const memberships = relationships.filter(item => ["member_of", "secretly_member_of"].includes(item.relationshipType) && item.sourceEntityType === entityType && item.sourceEntityId === entityId && item.targetEntityType === "faction");
    const factions = (await Promise.all(memberships.map(item => window.dmAPI.getEntity("faction", item.targetEntityId)))).filter(Boolean);
    const packs = await window.dmAPI.getEntitiesByType("ability_pack");
    before = { entity: JSON.parse(JSON.stringify(entity)), relationships: JSON.parse(JSON.stringify(relationships)), factions: JSON.parse(JSON.stringify(factions)), packs: JSON.parse(JSON.stringify(packs)) };
    add("membership relationships resolve", true, "controlled relationship read", memberships.length);

    const engine = window.MasterForgeInheritanceEngine;
    const resolution = await engine.resolveForEntityRecord(entity, { visibilityMode: "gm" });
    const inactiveResolution = await engine.resolveForEntityRecord(entity, { visibilityMode: "gm", includeInactive: true, includeHidden: true });
    const publicResolution = await engine.resolveForEntityRecord(entity, { visibilityMode: "public" });
    const allGrouped = [...resolution.grouped.traits, ...resolution.grouped.abilities];
    const allEffective = [...resolution.effective.traits, ...resolution.effective.abilities];

    const hasFactionTraits = factions.some(faction => faction.data_json?.traits?.length);
    hasFactionTraits ? add("faction local trait resolves", allGrouped.some(item => item.sourceType === "faction"), true, allGrouped.filter(item => item.sourceType === "faction").length) : skip("faction local trait resolves", "memberships have no faction-local traits");
    const factionPackFeatures = allGrouped.filter(item => item.sourceType === "factionAbilityPack");
    factions.some(faction => faction.data_json?.abilityPackIds?.length) ? add("faction Ability Pack trait resolves", factionPackFeatures.some(item => item.featureType === "trait"), true, factionPackFeatures.length) : skip("faction Ability Pack trait resolves", "no faction-wide pack assignment");
    factions.some(faction => faction.data_json?.abilityPackIds?.length) ? add("faction Ability Pack ability resolves", factionPackFeatures.some(item => item.featureType === "ability"), true, factionPackFeatures.length) : skip("faction Ability Pack ability resolves", "no faction-wide pack assignment");
    const hierarchyFeatures = allGrouped.filter(item => item.sourceType === "hierarchyAbilityPack");
    memberships.some(item => item.data_json?.factionRankId) ? add("direct hierarchy-node pack resolves", hierarchyFeatures.length > 0 || resolution.warnings.some(item => ["missing-hierarchy-node", "missing-ability-pack"].includes(item.code)), "feature or controlled missing-reference warning", hierarchyFeatures.length) : skip("direct hierarchy-node pack resolves", "no direct hierarchy assignment");
    const personal = allGrouped.filter(item => item.sourceType === "personal");
    personal.length ? add("personal adapter resolves", true, "one or more personal features", personal.length) : skip("personal adapter resolves", "no structured personal source data");

    const pure = engine.runPureDiagnostic();
    add("same-ID duplicate deduplicates", pure.checks.find(item => item.name === "same-ID duplicate deduplicates")?.passed, true, pure.result.effective.length);
    add("duplicate sources retained", pure.checks.find(item => item.name === "duplicate provenance retained")?.passed, true, pure.result.effective.find(item => item.id === "same")?.duplicateSources.length);
    add("higher-precedence feature wins", pure.checks.find(item => item.name === "higher precedence wins")?.passed, true, pure.result.effective.find(item => item.id === "conflict")?.description);
    add("same-name/different-ID warning", pure.checks.find(item => item.name === "same-name warning")?.passed, true, pure.result.warnings);
    add("inactive excluded by default", allEffective.every(item => item.active !== false), true, allEffective.filter(item => item.active === false).length);
    const inactiveGrouped = [...inactiveResolution.grouped.traits, ...inactiveResolution.grouped.abilities].filter(item => item.active === false);
    inactiveGrouped.length ? add("includeInactive includes inactive", [...inactiveResolution.effective.traits, ...inactiveResolution.effective.abilities].some(item => item.active === false), true, inactiveGrouped.length) : skip("includeInactive includes inactive", "no inactive source content");
    const gmSecret = allGrouped.filter(item => item.secret);
    memberships.some(item => item.relationshipType === "secretly_member_of") ? add("secret membership appears in GM mode", gmSecret.length > 0 || resolution.warnings.length > 0, "secret feature or controlled source warning", gmSecret.length) : skip("secret membership appears in GM mode", "no secret membership");
    add("secret membership absent in public mode", [...publicResolution.grouped.traits, ...publicResolution.grouped.abilities].every(item => !item.secret), true, "no secret features");
    resolution.warnings.some(item => item.code === "missing-ability-pack") ? add("missing pack warns without failure", true, "warning", "warning present") : skip("missing pack warns without failure", "no missing assigned pack");
    resolution.warnings.some(item => item.code === "missing-hierarchy-node") ? add("missing node preserves faction inheritance", allGrouped.some(item => ["faction", "factionAbilityPack"].includes(item.sourceType)) || !hasFactionTraits, true, "resolution continued") : skip("missing node preserves faction inheritance", "no missing hierarchy assignment");

    const afterEntity = await window.dmAPI.getEntity(entityType, entityId);
    const afterRelationships = await window.MasterForgeRelationshipEngine.getRelationshipsForEntity(entityType, entityId);
    const afterFactions = (await Promise.all(memberships.map(item => window.dmAPI.getEntity("faction", item.targetEntityId)))).filter(Boolean);
    const afterPacks = await window.dmAPI.getEntitiesByType("ability_pack");
    add("resolution is storage read-only", same(before.entity, afterEntity) && same(before.relationships, afterRelationships) && same(before.factions, afterFactions) && same(before.packs, afterPacks), "all source records unchanged", "compared entity, relationships, factions and packs");
    const result = { passed: checks.every(check => check.passed), checks, resolutionSummary: { traits: resolution.effective.traits.length, abilities: resolution.effective.abilities.length, warnings: resolution.warnings.length, conflicts: resolution.conflicts.length } };
    console.table(checks); console.log("Inheritance diagnostic", result); return result;
  } catch (error) {
    add("diagnostic completes", false, "successful read-only resolution", error?.message || String(error));
    return { passed: false, checks, resolutionSummary: { traits: 0, abilities: 0, warnings: 1, conflicts: 0 } };
  }
};

function renderGenericEntityBuilder(entity) {
  const data = entity.data_json || {};
  const isMirroredCampaignParty =
    data.source === "campaign-party";
  const isMirroredCharacter =
    data.source === "party-character";
  const hasManagedIdentity =
    isMirroredCampaignParty || isMirroredCharacter;

  return `
    <div class="entityProfileCard genericEntityBuilderCard">

      <div class="entityProfileHero">
        <div class="entityProfileIcon">
          ${getEntityTreeIcon(entity.entity_type || "faction")}
        </div>

        <div>
          <div class="entityProfileMeta">
            <span>Entity Builder</span>
          </div>

          <h1>${entity.id ? "Edit Entity" : "New Entity"}</h1>

          <p>Create factions, vehicles, locations, items, quests and other campaign entities.</p>
          ${isMirroredCampaignParty ? `
            <p class="forgeEmptyState">
              Party membership is managed from the Party screen.
            </p>
          ` : ""}
        </div>
      </div>

      <div class="genericEntityFormGrid">

        <div>
          <label>Type</label>
          <select id="genericEntityTypeInput" ${hasManagedIdentity ? "disabled" : ""}>
            ${[
              ...(isMirroredCampaignParty ? [["party", "Party"]] : []),
              ...(isMirroredCharacter ? [["pc", "PC"]] : []),
              ["faction", "Faction"],
              ...(entity.entity_type === "ability_pack" ? [["ability_pack", "Ability Pack"]] : []),
              ["vehicle", "Vehicle"],
              ["location", "Location"],
              ["settlement", "Settlement"],
              ["item", "Item"],
              ["quest", "Quest"],
              ["event", "Event"],
              ["creature", "Creature"],
              ["party_group", "Party Group"]
            ].map(([value, label]) => `
              <option
                value="${escapeHtml(value)}"
                ${entity.entity_type === value ? "selected" : ""}
              >
                ${escapeHtml(label)}
              </option>
            `).join("")}
          </select>
        </div>

        <div
  id="genericEntityVehicleSubtypeField"
  class="${["vehicle", "ship"].includes(entity.entity_type) ? "" : "hidden"}"
>
  <label>Vehicle Subtype</label>

  <select id="genericEntityVehicleSubtypeInput">
    ${[
      ["sailing-ship", "Sailing Ship"],
      ["warship", "Warship"],
      ["galley", "Galley"],
      ["rowboat", "Rowboat"],
      ["airship", "Airship"],
      ["spelljammer", "Spelljammer"],
      ["land-vehicle", "Land Vehicle"],
      ["cart", "Cart / Wagon"],
      ["mount", "Mount"],
      ["submersible", "Submersible"],
      ["spacecraft", "Spacecraft"],
      ["other", "Other"]
    ].map(([value, label]) => `
      <option
        value="${escapeHtml(value)}"
        ${data.subtype === value ? "selected" : ""}
      >
        ${escapeHtml(label)}
      </option>
    `).join("")}
  </select>
</div>

        <div>
          <label>Name</label>
          <input
            id="genericEntityNameInput"
            value="${escapeHtml(entity.name || "")}"
            placeholder="Sea's Fury Crew"
          >
        </div>

        <div>
          <label>Entity ID</label>
          <input
            id="genericEntityIdInput"
            value="${escapeHtml(entity.id || "")}"
            placeholder="auto-created-from-name"
            ${hasManagedIdentity ? "disabled" : ""}
          >
        </div>

        <div>
          <label>Status</label>
          <select id="genericEntityStatusInput">
            ${["Active", "Hidden", "Destroyed", "Inactive", "Unknown"].map(status => `
              <option
                value="${escapeHtml(status)}"
                ${data.status === status ? "selected" : ""}
              >
                ${escapeHtml(status)}
              </option>
            `).join("")}
          </select>
        </div>

      </div>

      <label>Description</label>
      <textarea
        id="genericEntityDescriptionInput"
        placeholder="Short player-facing or DM-facing summary."
      >${escapeHtml(entity.description || "")}</textarea>

      <div class="genericEntityFormGrid two">

  <div>
    <label>Tags</label>
    <input
      id="genericEntityTagsInput"
      value="${escapeHtml(data.tags || "")}"
      placeholder="crew, ship, faction, chult"
    >
  </div>

  <div class="genericEntityHomeWorldField">
    <label id="genericEntityHomeWorldLabel">Home World / Plane</label>
    <select id="genericEntityWorldInput"></select>
  </div>

  <div class="genericEntityDefaultRegionField">
    <label id="genericEntityDefaultRegionLabel">Home Region</label>
    <select id="genericEntityRegionInput"></select>
  </div>

  <div class="genericEntityDefaultLocationField">
    <label>Home Location</label>
    <select id="genericEntityLocationInput"></select>
  </div>

  <div class="genericEntityCurrentWorldField">
    <label id="genericEntityCurrentWorldLabel">Current World / Plane</label>
    <select id="genericEntityCurrentWorldInput"></select>
  </div>

  <div class="genericEntityCurrentRegionField">
    <label id="genericEntityCurrentRegionLabel">Current Region</label>
    <select id="genericEntityCurrentRegionInput"></select>
  </div>

  <div class="genericEntityCurrentLocationField">
    <label>Current Location</label>
    <select id="genericEntityCurrentLocationInput"></select>
  </div>

</div>

<div class="genericEntityFormGrid two">

  <div>
    <label>Public Notes</label>
    <textarea
      id="genericEntityPublicNotesInput"
      placeholder="Information safe to show or remember during play."
    >${escapeHtml(data.publicNotes || "")}</textarea>
  </div>

  <div>
    <label>GM Secrets</label>
    <textarea
      id="genericEntitySecretsInput"
      placeholder="Hidden truths, twists, betrayals, secret ownership, future reveals."
    >${escapeHtml(data.dmSecrets || "")}</textarea>
  </div>

</div>

      ${entity.entity_type === "faction" ? renderFactionWorkspaceShell() : ""}
      ${entity.entity_type === "ability_pack" ? renderAbilityPackWorkspaceShell() : ""}

      <div class="entityProfileActions">
        <button id="saveGenericEntityBtn" type="button">
          💾 Save Entity
        </button>

        <button id="deleteGenericEntityBtn" class="dangerBtn" type="button" ${entity.id ? "" : "disabled"}>
          Delete
        </button>
      </div>

      <details class="relationshipAdvancedBox">
        <summary>Advanced technical preview</summary>
        <pre id="genericEntityJsonPreview">${escapeHtml(JSON.stringify(entity, null, 2))}</pre>
      </details>

    </div>
  `;
}

function setupGenericEntityBuilderControls() {
  console.log("WIRING GENERIC ENTITY BUILDER");
  const typeInput =
    document.querySelector("#genericEntityTypeInput");

  const nameInput =
    document.querySelector("#genericEntityNameInput");

  const idInput =
    document.querySelector("#genericEntityIdInput");

  const subtypeField =
    document.querySelector(
      "#genericEntityVehicleSubtypeField"
    );

  const saveBtn =
    document.querySelector("#saveGenericEntityBtn");

  const deleteBtn =
    document.querySelector("#deleteGenericEntityBtn");

  const updateVehicleSubtypeVisibility = () => {
    const selectedType =
      typeInput?.value || "";

    const isVehicle = [
      "vehicle",
      "ship"
    ].includes(selectedType);

    subtypeField?.classList.toggle(
      "hidden",
      !isVehicle
    );
  };

  if (nameInput && idInput) {
    nameInput.oninput = () => {
      if (
        !entityBuilderState.activeEntityId &&
        !idInput.value.trim()
      ) {
        idInput.value =
          window.dmStorage.slugify(
            nameInput.value || ""
          );
      }

      updateGenericEntityJsonPreview();
    };
  }

  if (typeInput) {
    typeInput.onchange = () => {
      entityBuilderState.activeEntityType =
        typeInput.value;

      if (!entityBuilderState.originalEntityId && typeInput.value !== entityBuilderState.activeEntity?.entity_type) {
        const draft = collectGenericEntityFromBuilder();
        draft.entity_type = typeInput.value;
        entityBuilderState.activeEntityType = typeInput.value;
        showGenericEntityBuilder(draft, { preserveNew: true });
        return;
      }

      updateGenericEntityLocationFieldVisibility();
      updateVehicleSubtypeVisibility();

      const icon =
        document.querySelector(
          "#genericEntityHeaderIcon"
        );

      if (icon) {
        icon.innerText =
          getEntityTypeIcon(typeInput.value);
      }

      if (
        typeof updateGenericEntityTagPlaceholder ===
        "function"
      ) {
        updateGenericEntityTagPlaceholder();
      }

      updateGenericEntityJsonPreview();
    };
  }

  [
    "#genericEntityIdInput",
    "#genericEntityDescriptionInput",
    "#genericEntityStatusInput",
    "#genericEntityTagsInput",
    "#genericEntityVehicleSubtypeInput",
    "#genericEntityWorldInput",
    "#genericEntityRegionInput",
    "#genericEntityLocationInput",
    "#genericEntityCurrentWorldInput",
    "#genericEntityCurrentRegionInput",
    "#genericEntityCurrentLocationInput",
    "#genericEntityPublicNotesInput",
    "#genericEntitySecretsInput"
  ].forEach(selector => {
    const input =
      document.querySelector(selector);

    if (!input) return;

    input.oninput =
      updateGenericEntityJsonPreview;

    input.onchange =
      updateGenericEntityJsonPreview;
  });

  if (saveBtn) {
  saveBtn.onclick = async event => {
    event.preventDefault();
    event.stopPropagation();

    console.log("SAVE ENTITY BUTTON CLICKED");

    await saveGenericEntityFromBuilder();
  };

  console.log("SAVE ENTITY BUTTON WIRED");
} else {
  console.error("SAVE ENTITY BUTTON NOT FOUND");
}

  if (deleteBtn) {
    deleteBtn.onclick =
      deleteGenericEntityFromBuilder;
  }

  updateVehicleSubtypeVisibility();
  updateGenericEntityLocationFieldVisibility();
  updateGenericEntityJsonPreview();
}

function collectGenericEntityFromBuilder() {
  syncFactionHierarchyDraftFromDom();
  syncFactionTraitsFromDom();
  syncAbilityPackDraftFromDom();
  const builder = document.querySelector(".genericEntityBuilderCard");

  const type =
    builder?.querySelector("#genericEntityTypeInput")?.value || "faction";

  const name =
    builder?.querySelector("#genericEntityNameInput")?.value.trim() || "";

  const id =
    builder?.querySelector("#genericEntityIdInput")?.value.trim() ||
    window.dmStorage.slugify(name || `new-${type}`);

  const description =
    builder?.querySelector("#genericEntityDescriptionInput")?.value.trim() || "";

    const selectedDefaultWorld =
  builder?.querySelector("#genericEntityWorldInput")?.value ||
  window.dmState.current.world ||
  "";

const selectedCurrentWorld =
  builder?.querySelector("#genericEntityCurrentWorldInput")?.value ||
  selectedDefaultWorld ||
  window.dmState.current.world ||
  "";

    const selectedDefaultRegion =
    builder?.querySelector("#genericEntityRegionInput")?.value ||
    window.dmState.current.region ||
    "";

  const selectedEntityType =
    builder?.querySelector("#genericEntityTypeInput")?.value ||
    type ||
    "faction";

  const isPlaceEntity =
    isPlaceEntityType(selectedEntityType);

  const selectedDefaultLocation =
    isPlaceEntity
      ? ""
      : (
          builder?.querySelector("#genericEntityLocationInput")?.value ||
          window.dmState.current.location ||
          ""
        );

  const selectedCurrentRegion =
    builder?.querySelector("#genericEntityCurrentRegionInput")?.value ||
    selectedDefaultRegion ||
    window.dmState.current.region ||
    "";

  const selectedCurrentLocation =
    isPlaceEntity
      ? ""
      : (
          builder?.querySelector("#genericEntityCurrentLocationInput")?.value ||
          selectedDefaultLocation ||
          window.dmState.current.location ||
          ""
        );

  const finalDefaultRegion =
    selectedDefaultRegion ||
    selectedCurrentRegion ||
    window.dmState.current.region ||
    "";

  const finalCurrentRegion =
    selectedCurrentRegion ||
    finalDefaultRegion ||
    window.dmState.current.region ||
    "";

  const finalDefaultLocation =
    isPlaceEntity ? "" : selectedDefaultLocation;

  const finalCurrentLocation =
    isPlaceEntity ? "" : selectedCurrentLocation;

  const entity = {
    id,
    entity_type: type,
    name,
    description,

    data_json: {
  ...(entityBuilderState.activeEntity?.data_json || {}),
  source: "entity-builder",

  subtype:
    builder?.querySelector(
      "#genericEntityVehicleSubtypeInput"
    )?.value || "",

  systemId: getCurrentSystemId(),

            scope: {
        campaignId: window.dmState.current?.campaign || "",
        worldId: selectedDefaultWorld,
        regionId: finalDefaultRegion,
        locationId: finalDefaultLocation
      },

      currentPosition: {
        mode: isPlaceEntity ? "self" : "location",
        worldId: selectedCurrentWorld,
        regionId: finalCurrentRegion,
        locationId: finalCurrentLocation,
        entityType: "",
        entityId: "",
        notes: isPlaceEntity ? "This entity is a place/location record." : ""
      },

      visibility: normaliseVisibility(
        entityBuilderState.activeEntity?.data_json?.visibility ||
        entityBuilderState.activeEntity?.visibility ||
        {}
      ),

      status:
        builder?.querySelector("#genericEntityStatusInput")?.value || "Active",

      tags:
        builder?.querySelector("#genericEntityTagsInput")?.value.trim() || "",

            defaultRegionId: finalDefaultRegion,
      defaultLocationId: finalDefaultLocation,

      currentRegionId: finalCurrentRegion,
      currentLocationId: finalCurrentLocation,

      // Legacy compatibility while older helpers still look for these
      campaign: window.dmState.current.campaign,
      world: selectedCurrentWorld,
worldId: selectedCurrentWorld,

      regionId: finalCurrentRegion,
      locationId: finalCurrentLocation,
      region: finalCurrentRegion,
      location: finalCurrentLocation,

      publicNotes:
        builder?.querySelector("#genericEntityPublicNotesInput")?.value.trim() || "",

      dmSecrets:
        builder?.querySelector("#genericEntitySecretsInput")?.value.trim() || ""
    }
  };

  if (entity.entity_type === "faction") {
    entity.data_json.factionHierarchy = {
      ...getFactionHierarchyApi().normaliseFactionHierarchy(
        entityBuilderState.activeEntity?.data_json || {}
      ),
      ...(entityBuilderState.factionHierarchy || {}),
      version: 1,
      nodes: (entityBuilderState.factionHierarchy?.nodes || []).map(node => ({ ...node }))
    };
    entity.data_json.traits = (entityBuilderState.factionTraits || []).map(trait => ({ ...trait, tags: [...(trait.tags || [])], systemData: { ...(trait.systemData || {}) } }));
    entity.data_json.abilityPackIds = getAbilityPackApi().uniqueIds(entityBuilderState.factionAbilityPackIds);
  }

  if (entity.entity_type === "ability_pack") {
    entity.data_json = {
      ...entity.data_json,
      ...getAbilityPackApi().normalisePackData(entityBuilderState.abilityPackData || {}),
      source: entityBuilderState.activeEntity?.data_json?.source || "ability-pack-builder"
    };
  }

  const activeEntityData =
    entityBuilderState.activeEntity?.data_json || {};
  const isMirroredCampaignParty =
    activeEntityData.source === "campaign-party";
  const isMirroredCharacter =
    activeEntityData.source === "party-character";

  if (isMirroredCampaignParty) {
    entity.id = entityBuilderState.activeEntity.id;
    entity.entity_type = "party";
    entity.data_json.source = "campaign-party";
    entity.data_json.campaignId = activeEntityData.campaignId;
    entity.data_json.characterIds = Array.isArray(
      activeEntityData.characterIds
    )
      ? [...activeEntityData.characterIds]
      : [];
  }

  if (isMirroredCharacter) {
    entity.id = entityBuilderState.activeEntity.id;
    entity.entity_type = "pc";
    entity.data_json.source = "party-character";
    entity.data_json.characterId = activeEntityData.characterId;
    entity.data_json.playerId = activeEntityData.playerId;
    entity.data_json.character = {
      ...(activeEntityData.character || {})
    };
  }

  if (
    entity.entity_type === "party_group" &&
    !entityBuilderState.activeEntity?.id
  ) {
    entity.data_json.campaignId =
      window.dmState.current?.campaign || "";
    entity.data_json.parentPartyId = "";
    entity.data_json.characterIds = [];
    entity.data_json.status = "active";
  }

  const context = normaliseEntityContext(entity);

  entity.systemId = context.systemId;
  entity.scope = context.scope;
  entity.currentPosition = context.currentPosition;
  entity.visibility = context.visibility;

  return entity;
}

function getEntityLibraryLocationLabel(entity = {}) {
  const context =
    entity._context ||
    getEntityEffectiveContext(entity);

  const position =
    context.currentPosition || {};

  if (
    position.mode === "entity" &&
    position.entityType &&
    position.entityId
  ) {
    const containingEntity = entityIndexCache.find(item => {
      return (
        item.entity_type === position.entityType &&
        item.id === position.entityId
      );
    });

    return `Aboard ${containingEntity?.name || position.entityId}`;
  }

  return (
    position.locationId ||
    entity.currentLocationId ||
    entity.data_json?.currentLocationId ||
    entity.data_json?.currentPosition?.locationId ||
    "No current location"
  );
}

function updateGenericEntityJsonPreview() {
  const preview = document.querySelector("#genericEntityJsonPreview");

  if (!preview) return;

  const entity = collectGenericEntityFromBuilder();

  preview.textContent = JSON.stringify(entity, null, 2);
}

async function saveGenericEntityFromBuilder() {
  console.log("SAVE GENERIC ENTITY HIT");
  let hierarchyBeforeSaveAttempt = null;

  if (entityBuilderState.activeEntityType === "faction" && entityBuilderState.factionHierarchyEditorDraft) {
    syncFactionHierarchyDraftFromDom();
    const card = document.querySelector("[data-hierarchy-node-editor] .factionHierarchyNode");
    const candidate = card ? collectFactionHierarchyNodeCard(card, entityBuilderState.factionHierarchyEditorDraft) : entityBuilderState.factionHierarchyEditorDraft;
    const api = getFactionHierarchyApi();
    if (!candidate.name) {
      entityBuilderState.factionHierarchyEditorError = "Node Name is required.";
      entityBuilderState.factionHierarchyEditorDirty = true;
      entityBuilderState.factionHierarchyEditorShouldFocus = true;
      await refreshFactionHierarchyWorkspace();
      return;
    }
    if (api.wouldCreateFactionHierarchyCycle(entityBuilderState.factionHierarchy, candidate.id, candidate.parentNodeIds)) {
      entityBuilderState.factionHierarchyEditorError = "Those parents would create a hierarchy cycle.";
      entityBuilderState.factionHierarchyEditorDirty = true;
      entityBuilderState.factionHierarchyEditorShouldFocus = true;
      await refreshFactionHierarchyWorkspace();
      return;
    }
    hierarchyBeforeSaveAttempt = clonePlannedEncounterValue(entityBuilderState.factionHierarchy);
    const stagedIndex = entityBuilderState.factionHierarchy.nodes.findIndex(node => node.id === (entityBuilderState.factionHierarchyEditorNodeId || candidate.id));
    if (stagedIndex >= 0) entityBuilderState.factionHierarchy.nodes[stagedIndex] = candidate;
    else entityBuilderState.factionHierarchy.nodes.push(candidate);
    entityBuilderState.factionHierarchyEditorDraft = candidate;
    entityBuilderState.factionHierarchyDirty = true;
    entityBuilderState.factionHierarchyEditorDirty = true;
  }

  const entity =
    collectGenericEntityFromBuilder();

  if (!entity.name) {
    alert("Entity name is required.");
    return;
  }

  if (entity.entity_type === "faction") {
    const validation = getFactionHierarchyApi().validateFactionHierarchy(
      entity.data_json.factionHierarchy
    );
    if (!validation.valid) {
      alert(`Faction hierarchy cannot be saved:\n\n${validation.errors.join("\n")}`);
      return;
    }
  }

  if (entity.entity_type === "ability_pack") {
    const validation = getAbilityPackApi().validatePackData(entity.data_json);
    if (!validation.valid) {
      alert(`Ability Pack cannot be saved:\n\n${validation.errors.join("\n")}`);
      return;
    }
  }
  if (entity.entity_type === "faction") {
    const emptyTrait = (entity.data_json.traits || []).find(trait => !String(trait.name || "").trim());
    if (emptyTrait) { alert("Every faction trait requires a name."); return; }
  }

  const originalType =
    entityBuilderState.originalEntityType;

  const originalId =
    entityBuilderState.originalEntityId;

  const editingExisting =
    !!originalType &&
    !!originalId;

  const identityChanged =
    editingExisting &&
    (
      originalType !== entity.entity_type ||
      originalId !== entity.id
    );

  try {
    /*
     * Load the originally selected record, not the edited
     * type shown in the form.
     */
    const originalEntity =
      editingExisting && window.dmAPI.getEntity
        ? await window.dmAPI.getEntity(
            originalType,
            originalId
          )
        : null;

    const targetEntity =
      window.dmAPI.getEntity
        ? await window.dmAPI.getEntity(
            entity.entity_type,
            entity.id
          )
        : null;

    const existingContext =
      originalEntity
        ? normaliseEntityContext(originalEntity)
        : targetEntity
          ? normaliseEntityContext(targetEntity)
          : normaliseEntityContext(entity);

    entity.visibility =
      normaliseVisibility(
        existingContext.visibility ||
        entity.visibility ||
        {}
      );

    entity.data_json = {
      ...(originalEntity?.data_json || {}),
      ...(targetEntity?.data_json || {}),
      ...(entity.data_json || {}),
      visibility: entity.visibility
    };

    const context =
      normaliseEntityContext(entity);

    entity.systemId =
      context.systemId;

    entity.scope =
      context.scope;

    entity.currentPosition =
      context.currentPosition;

    entity.visibility =
      context.visibility;

    entity.data_json = {
      ...(entity.data_json || {}),
      systemId: context.systemId,
      scope: context.scope,
      currentPosition: context.currentPosition,
      visibility: context.visibility
    };

    /*
     * Normal edit: identity has not changed.
     */
    if (editingExisting && !identityChanged) {
      await window.dmAPI.updateEntity(
        originalType,
        originalId,
        entity
      );
    }

    /*
     * Existing entity changed type or ID.
     * Save the replacement first.
     */
    else if (editingExisting && identityChanged) {
      const confirmed = confirm(
        `Change stored entity identity?\n\n` +
        `${originalType} / ${originalId}\n` +
        `becomes\n` +
        `${entity.entity_type} / ${entity.id}`
      );

      if (!confirmed) return;

      if (targetEntity) {
        await window.dmAPI.updateEntity(
          entity.entity_type,
          entity.id,
          entity
        );
      } else {
        await window.dmAPI.createEntity(
          entity
        );
      }

      /*
       * Confirm the replacement exists before touching
       * the original record.
       */
      const replacement =
        await window.dmAPI.getEntity(
          entity.entity_type,
          entity.id
        );

      if (!replacement) {
        throw new Error(
          "Replacement entity could not be verified. The original entity was left untouched."
        );
      }

      /*
       * Never delete when source and destination are
       * actually identical.
       */
      const sameIdentity =
        originalType === entity.entity_type &&
        originalId === entity.id;

      if (!sameIdentity) {
        await window.dmAPI.deleteEntity(
          originalType,
          originalId
        );

        const originalStillExists =
          await window.dmAPI.getEntity(
            originalType,
            originalId
          );

        if (originalStillExists) {
          throw new Error(
            `The new entity was saved, but the old ${originalType}/${originalId} record could not be removed.`
          );
        }
      }
    }

    /*
     * Brand-new entity.
     */
    else {
      if (targetEntity) {
        await window.dmAPI.updateEntity(
          entity.entity_type,
          entity.id,
          entity
        );
      } else {
        await window.dmAPI.createEntity(
          entity
        );
      }
    }

    const verification =
      await window.dmAPI.getEntity(
        entity.entity_type,
        entity.id
      );

    if (!verification) {
      throw new Error(
        `${entity.entity_type}/${entity.id} could not be loaded after saving.`
      );
    }

    entityBuilderState.activeEntity =
      verification;

    entityBuilderState.activeEntityId =
      verification.id;

    entityBuilderState.activeEntityType =
      verification.entity_type;

    entityBuilderState.originalEntityId =
      verification.id;

    entityBuilderState.originalEntityType =
      verification.entity_type;

    currentlySelectedEntity =
      verification;

    if (verification.entity_type === "faction") {
      entityBuilderState.factionHierarchyBaseline = clonePlannedEncounterValue(
        getFactionHierarchyApi().normaliseFactionHierarchy(verification.data_json)
      );
      entityBuilderState.factionHierarchyDirty = false;
      entityBuilderState.factionHierarchyEditorDirty = false;
      hierarchyBeforeSaveAttempt = null;
    }

    await loadEntityDebugPanel();
    if (["faction", "ability_pack"].includes(verification.entity_type)) {
      showGenericEntityBuilder(verification);
    } else {
      await showEntityDebugDetails(verification);
    }

    alert("Entity saved.");
  } catch (error) {
    if (hierarchyBeforeSaveAttempt) {
      entityBuilderState.factionHierarchy = hierarchyBeforeSaveAttempt;
      entityBuilderState.factionHierarchyDirty = true;
      entityBuilderState.factionHierarchyEditorDirty = true;
    }
    console.error(
      "SAVE GENERIC ENTITY FAILED:",
      {
        originalType,
        originalId,
        targetType: entity.entity_type,
        targetId: entity.id,
        error
      }
    );

    alert(
      error?.message ||
      "Entity could not be saved."
    );
  }
}

async function deleteGenericEntityFromBuilder() {
  const editedEntity =
    collectGenericEntityFromBuilder();

  const targetType =
    entityBuilderState.originalEntityType ||
    editedEntity.entity_type;

  const targetId =
    entityBuilderState.originalEntityId ||
    editedEntity.id;

  if (!targetType || !targetId) {
    alert("No saved entity selected.");
    return;
  }

  if (!window.dmAPI.deleteEntity) {
    alert("Delete entity API is unavailable.");
    return;
  }

  const confirmed = confirm(
    `Delete ${editedEntity.name || targetId}?\n\n` +
    `Stored identity: ${targetType} / ${targetId}`
  );

  if (!confirmed) return;

  try {
    await window.dmAPI.deleteEntity(
      targetType,
      targetId
    );

    const stillExists =
      window.dmAPI.getEntity
        ? await window.dmAPI.getEntity(
            targetType,
            targetId
          )
        : null;

    if (stillExists) {
      throw new Error(
        `${targetType}/${targetId} still exists after deletion.`
      );
    }

    entityBuilderState.activeEntity = null;
    entityBuilderState.activeEntityId = null;
    entityBuilderState.activeEntityType = "faction";

    entityBuilderState.originalEntityId = null;
    entityBuilderState.originalEntityType = null;

    currentlySelectedEntity = null;

    await loadEntityDebugPanel();

    alert("Entity deleted.");
  } catch (error) {
    console.error(
      "DELETE GENERIC ENTITY FAILED:",
      {
        targetType,
        targetId,
        error
      }
    );

    alert(
      error?.message ||
      "Entity could not be deleted."
    );
  }
}
async function renderEntityDebugRelationships(container, relationships, selectedEntity) {
  if (!relationships || relationships.length === 0) {
    container.innerHTML = `
      <div class="relationshipEmptyState">
        <h3>No relationships yet</h3>
        <p>This entity is not linked to anything else yet.</p>
      </div>
    `;
    return;
  }

  const cards = [];

  for (const relationship of relationships) {
    const selectedIsSource =
      relationship.from_type === selectedEntity.entity_type &&
      relationship.from_id === selectedEntity.id;

    const otherType = selectedIsSource
      ? relationship.to_type
      : relationship.from_type;

    const otherId = selectedIsSource
      ? relationship.to_id
      : relationship.from_id;

    const otherEntity = await window.dmAPI.getEntity(otherType, otherId);
    const otherName = otherEntity?.name || otherId;

    const relationshipLabel = formatRelationshipLabel(
  relationship.relationship,
  selectedIsSource ? "outgoing" : "incoming"
);

    const sentence = selectedIsSource
      ? `${selectedEntity.name || selectedEntity.id} ${relationshipLabel.toLowerCase()} ${otherName}`
      : `${otherName} ${relationshipLabel.toLowerCase()} ${selectedEntity.name || selectedEntity.id}`;

    cards.push(`
      <div class="relationshipStoryCard">
        <div class="relationshipStoryMain">
          <div class="relationshipStoryIcon">
            ${getEntityTreeIcon(otherType)}
          </div>

          <div class="relationshipStoryBody">
            <div class="relationshipStoryMeta">
              <span>${selectedIsSource ? "Outgoing" : "Incoming"}</span>
              <span>${escapeHtml(formatEntityTypeLabel(otherType))}</span>
            </div>

            <h3>${escapeHtml(sentence)}</h3>

            ${
              relationship.notes
                ? `<p>${escapeHtml(relationship.notes)}</p>`
                : `<p class="forgeEmptyState">No notes added.</p>`
            }

            <details class="relationshipAdvancedBox">
              <summary>Technical details</summary>
              <p><small>ID: ${escapeHtml(relationship.id || "No relationship ID")}</small></p>
              <p><small>Engine value: ${escapeHtml(relationship.relationship || "")}</small></p>
              <p><small>${escapeHtml(relationship.from_type)}:${escapeHtml(relationship.from_id)} → ${escapeHtml(relationship.to_type)}:${escapeHtml(relationship.to_id)}</small></p>
            </details>
          </div>
        </div>

        <div class="relationshipStoryActions">
          <button
            class="viewUniversalRelationshipBtn"
            type="button"
            data-relationship-id="${escapeHtml(relationship.id || "")}"
          >
            View Relationship
          </button>
          <button
            class="openEntityRelationshipTargetBtn"
            type="button"
            data-entity-type="${escapeHtml(otherType)}"
            data-entity-id="${escapeHtml(otherId)}"
          >
            Open
          </button>
        </div>
      </div>
    `);
  }

  container.innerHTML = cards.join("");

  container.querySelectorAll(".openEntityRelationshipTargetBtn").forEach(button => {
  button.onclick = async event => {
    event.preventDefault();
    event.stopPropagation();

    const type = button.dataset.entityType;
    const id = button.dataset.entityId;

    console.log("Opening relationship target:", {
      type,
      id
    });

    if (!type || !id) {
      alert("Relationship target is missing type or ID.");
      return;
    }

    if (type === "npc") {
      await openNpcEntityInBuilder(id);
      return;
    }

    let entity = null;

    try {
      entity = await window.dmAPI.getEntity(type, id);
    } catch (error) {
      console.warn("Could not open relationship target:", {
        type,
        id,
        error
      });
    }

    if (!entity) {
      alert(`Target entity not found: ${type}:${id}`);
      return;
    }

    activateMainPanel(
      document.querySelector('.tab[data-tab="entities"]'),
      document.querySelector("#entities")
    );

    await showEntityDebugDetails(entity);
    renderEntityIndexResults();
  };
});

  container.querySelectorAll(".viewUniversalRelationshipBtn").forEach(button => {
    button.onclick = async event => {
      event.preventDefault();
      event.stopPropagation();

      const relationship = relationships.find(item =>
        String(item.id || "") === String(button.dataset.relationshipId || "")
      );

      if (!relationship) {
        console.warn("Could not find relationship for read-only view:", button.dataset.relationshipId);
        return;
      }

      await showUniversalRelationshipBuilder(selectedEntity, relationship);
    };
  });
}

function closeRelationshipTree() {
  const relationshipTreePanel = document.getElementById("entityRelationshipTreePanel");
  const relationshipWorkspace = document.getElementById("entityRelationshipWorkspace");

  if (relationshipTreeFocusMode) {
    exitRelationshipTreeFocusMode();
  }

  if (relationshipWorkspace) {
    relationshipWorkspace.classList.remove("tree-open");
  }

  if (relationshipTreePanel) {
    relationshipTreePanel.classList.remove("is-visible");
    relationshipTreePanel.classList.add("hidden");
  }
}

function updateRelationshipTreeButton(
  relationships,
  {
    preserveTreeOpen = false
  } = {}
) {
  const showButton = document.getElementById("showRelationshipTreeBtn");
  const treePanel = document.getElementById("entityRelationshipTreePanel");
  const workspace = document.getElementById("entityRelationshipWorkspace");

  if (!showButton) return;

  if (relationships && relationships.length > 0) {
    showButton.classList.remove("hidden");
    showButton.textContent = `🌳 Show Trees (${relationships.length})`;
  } else {
    showButton.classList.add("hidden");

    if (workspace && !preserveTreeOpen) {
      workspace.classList.remove("tree-open");
    }

    if (treePanel && !preserveTreeOpen) {
      treePanel.classList.remove("is-visible");
      treePanel.classList.add("hidden");
    }
  }
}

function formatEntityTypeLabel(type) {
  const labels = {
  npc: "NPC",
  pc: "PC",
  faction: "Faction",
  vehicle: "Vehicle",
  ship: "Vehicle",
  location: "Location",
  settlement: "Settlement",
  item: "Item",
  quest: "Quest",
  event: "Event",
  creature: "Creature",
  organisation: "Organisation",
  party: "Party",
  party_group: "Party Group",
  ability_pack: "Ability Pack"
};

  return labels[type] || String(type || "Entity");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.findWeatherByRoll = findWeatherByRoll;

// =====================================================
// MasterForge Studio v0.3.0-alpha
// Relationship Engine Basic Tree Viewer
// =====================================================

async function loadEntityTreeViewer() {
  const treeContainer = document.getElementById("entity-debug-tree");

  if (!treeContainer) {
    return;
  }

  if (!currentlySelectedEntity) {
    treeContainer.innerHTML = `<p class="muted">Select an entity first.</p>`;
    return;
  }

  treeContainer.innerHTML = `<p class="muted">Loading relationship tree...</p>`;

  try {
    const graphRenderer =
      window.MasterForgeRelationshipGraphRenderer;

    if (typeof graphRenderer?.render === "function") {
      console.log("Using relationship graph renderer");

      await graphRenderer.render({
        container: treeContainer,
        entity: currentlySelectedEntity,
        mode: activeRelationshipTreeMode,
        scope: activeRelationshipTreeScope,
        onSelectTreeEntity: async entity => {
          currentlySelectedEntity = entity;

          await showEntityDebugDetails(entity, {
            preserveTreeOpen: true
          });

          await loadEntityTreeViewer();
        },
        onOpenEntity: entity =>
          showEntityDebugDetails(entity),
        onOpenNpc: entity =>
          openNpcEntityInBuilder(entity),
        onOpenFactionHierarchy: async (faction, nodeId) => {
          const freshFaction = await window.dmAPI.getEntity("faction", faction.id);
          if (!freshFaction) return;
          showGenericEntityBuilder(freshFaction, { factionTab: "hierarchy" });
          entityBuilderState.factionHierarchyFocusNodeId = nodeId || null;
        },
        resolveFactionMemberDisplayTitle: (member, faction) =>
          resolveFactionMemberDisplayTitle(member, {
            factionId: faction.id,
            visibilityMode: "gm"
          }),
        showSecretRelationships: true
      });

      return;
    }

    console.log("Using legacy relationship tree fallback");

    const tree = await buildFocusedEntityTree(currentlySelectedEntity);
    treeContainer.innerHTML = "";
    treeContainer.appendChild(tree);
  } catch (error) {
    console.error("Failed to load entity tree viewer:", error);
    treeContainer.innerHTML = `<p class="error">Failed to load relationship tree.</p>`;
  }
}
function createEntityTreeContext() {
  return {
    rendered: new Set()
  };
}

async function buildFocusedEntityTree(entity) {
  const treeContext = createEntityTreeContext();

  if (activeRelationshipTreeMode === "command") {
    const parentShip = entity.entity_type === "ship"
      ? entity
      : await findTopLevelShipForEntity(entity);

    if (parentShip) {
      return buildEntityTreeNode(parentShip, new Set(), treeContext);
    }

    return buildEntityTreeNode(entity, new Set());
  }

  if (activeRelationshipTreeMode === "faction") {
    const parentFaction = await findTopLevelFactionForEntity(entity);

    if (parentFaction) {
      return buildEntityTreeNode(parentFaction, new Set());
    }

    return buildEntityTreeNode(entity, new Set());
  }

  if (activeRelationshipTreeMode === "all") {
    return buildAllLinksTree(entity);
  }

  return buildEntityTreeNode(entity, new Set());
}

async function findTopLevelShipForEntity(entity) {
  const visited = new Set();
  let current = entity;

  for (let i = 0; i < 10; i++) {
    const key = `${current.entity_type}:${current.id}`;

    if (visited.has(key)) {
      return null;
    }

    visited.add(key);

    if (current.entity_type === "ship") {
      return current;
    }

    const relationships = await window.dmAPI.getEntityRelationships(
      current.entity_type,
      current.id
    );

    const parentCandidates = relationships
      .map((relationship) => {
        const currentIsSource =
          relationship.from_type === current.entity_type &&
          relationship.from_id === current.id;

        const currentIsTarget =
          relationship.to_type === current.entity_type &&
          relationship.to_id === current.id;

        if (!currentIsSource && !currentIsTarget) {
          return null;
        }

        // Branna answers_to Captain
        // Bosun answers_to Captain
        // Quartermaster answers_to Captain
        if (currentIsSource && relationship.relationship === "answers_to") {
          return {
            relationship,
            nextType: relationship.to_type,
            nextId: relationship.to_id,
            priority: 1
          };
        }

        // Captain commands Crew
        if (currentIsSource && relationship.relationship === "commands") {
          return {
            relationship,
            nextType: relationship.to_type,
            nextId: relationship.to_id,
            priority: 2
          };
        }

        // Crew operates_from Ship
        if (currentIsSource && relationship.relationship === "operates_from") {
          return {
            relationship,
            nextType: relationship.to_type,
            nextId: relationship.to_id,
            priority: 3
          };
        }

        // Optional fallback links
        if (currentIsSource && relationship.relationship === "member_of") {
          return {
            relationship,
            nextType: relationship.to_type,
            nextId: relationship.to_id,
            priority: 4
          };
        }

        // Secret links should be lowest priority for the normal command tree.
        if (currentIsSource && relationship.relationship === "secretly_member_of") {
          return {
            relationship,
            nextType: relationship.to_type,
            nextId: relationship.to_id,
            priority: 9
          };
        }

        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.priority - b.priority);

    const parentLink = parentCandidates[0];

    if (!parentLink) {
      return null;
    }

    current = await window.dmAPI.getEntity(
      parentLink.nextType,
      parentLink.nextId
    );

    if (!current) {
      return null;
    }
  }

  return null;
}

async function findTopLevelFactionForEntity(entity) {
  const visited = new Set();
  let current = entity;

  for (let i = 0; i < 10; i++) {
    const key = `${current.entity_type}:${current.id}`;

    if (visited.has(key)) {
      return null;
    }

    visited.add(key);

    if (current.entity_type === "faction") {
      return current;
    }

    const relationships = await window.dmAPI.getEntityRelationships(
      current.entity_type,
      current.id
    );

    const factionLink = relationships.find((relationship) => {
      const currentIsSource =
        relationship.from_type === current.entity_type &&
        relationship.from_id === current.id;

      return (
        currentIsSource &&
        ["member_of", "secretly_member_of"].includes(relationship.relationship)
      );
    });

    if (!factionLink) {
      return null;
    }

    current = await window.dmAPI.getEntity(
      factionLink.to_type,
      factionLink.to_id
    );

    if (!current) {
      return null;
    }
  }

  return null;
}

async function buildAllLinksTree(entity) {
  const wrapper = document.createElement("div");
  wrapper.className = "entity-tree-node";

  const header = document.createElement("div");
  header.className = "entity-tree-header";

  header.innerHTML = `
    <span class="entity-tree-icon">${getEntityTreeIcon(entity.entity_type)}</span>
    <strong>${escapeHtml(entity.name)}</strong>
    <span class="entity-tree-type">${escapeHtml(entity.entity_type)}</span>
  `;

  wrapper.appendChild(header);

  const relationships = await window.dmAPI.getEntityRelationships(
    entity.entity_type,
    entity.id
  );

  if (!relationships || relationships.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No relationships found.";
    wrapper.appendChild(empty);
    return wrapper;
  }

  const childrenContainer = document.createElement("div");
  childrenContainer.className = "entity-tree-children";

  for (const relationship of relationships) {
    const selectedIsSource =
      relationship.from_type === entity.entity_type &&
      relationship.from_id === entity.id;

    const otherType = selectedIsSource
      ? relationship.to_type
      : relationship.from_type;

    const otherId = selectedIsSource
      ? relationship.to_id
      : relationship.from_id;

    const otherEntity = await window.dmAPI.getEntity(otherType, otherId);

    if (!otherEntity) {
      continue;
    }

    const relationLabel = document.createElement("div");
    relationLabel.className = "entity-tree-relation";

    relationLabel.textContent = selectedIsSource
      ? formatRelationshipLabel(relationship.relationship, "outgoing")
      : formatRelationshipLabel(relationship.relationship, "incoming");

    const childHeader = document.createElement("div");
    childHeader.className = "entity-tree-header";

    childHeader.innerHTML = `
      <span class="entity-tree-icon">${getEntityTreeIcon(otherEntity.entity_type)}</span>
      <strong>${escapeHtml(otherEntity.name)}</strong>
      <span class="entity-tree-type">${escapeHtml(otherEntity.entity_type)}</span>
    `;

    childHeader.addEventListener("click", () => {
      showEntityDebugDetails(otherEntity);
    });

    childrenContainer.appendChild(relationLabel);
    childrenContainer.appendChild(childHeader);
  }

  wrapper.appendChild(childrenContainer);

  return wrapper;
}

async function buildEntityTreeNode(entity, visited, treeContext = createEntityTreeContext()) {
  const nodeKey = `${entity.entity_type}:${entity.id}`;

  const wrapper = document.createElement("div");
  wrapper.className = "entity-tree-node";

  const header = document.createElement("div");
  header.className = "entity-tree-header";

  header.innerHTML = `
    <span class="entity-tree-icon">${getEntityTreeIcon(entity.entity_type)}</span>
    <strong>${escapeHtml(entity.name)}</strong>
    <span class="entity-tree-type">${escapeHtml(entity.entity_type)}</span>
  `;

  header.addEventListener("click", async () => {
    if (entity.entity_type === "npc") {
      await openNpcEntityInBuilder(entity);
      return;
    }

    showEntityDebugDetails(entity);
  });

  wrapper.appendChild(header);

  if (visited.has(nodeKey)) {
    const loopNotice = document.createElement("div");
    loopNotice.className = "entity-tree-children";
    loopNotice.innerHTML = `<p class="muted">Already shown in this branch.</p>`;
    wrapper.appendChild(loopNotice);
    return wrapper;
  }

  if (treeContext.rendered.has(nodeKey)) {
  return null;
}

  visited.add(nodeKey);
  treeContext.rendered.add(nodeKey);

  const children = await getEntityTreeChildren(entity);

  if (children.length > 0) {
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "entity-tree-children";

    const groupedChildren = groupEntityTreeChildren(children);

    for (const group of groupedChildren) {
      const relationLabel = document.createElement("div");
      relationLabel.className = "entity-tree-relation";
      relationLabel.textContent = group.label;

      const groupContainer = document.createElement("div");
      groupContainer.className = "entity-tree-group";

      for (const childLink of group.children) {
  const childNode = await buildEntityTreeNode(
    childLink.entity,
    new Set(visited),
    treeContext
  );

  if (childNode) {
    groupContainer.appendChild(childNode);
  }
}

if (groupContainer.children.length) {
  childrenContainer.appendChild(relationLabel);
  childrenContainer.appendChild(groupContainer);
}
    }

    wrapper.appendChild(childrenContainer);
  }

  return wrapper;
}

function isVehicleEntityType(entityType = "") {
  return ["ship", "vehicle", "airship", "cart", "caravan"].includes(
    String(entityType || "").toLowerCase()
  );
}

function getVehicleCrewId(vehicleEntity) {
  return window.dmStorage.slugify(
    `${vehicleEntity.id || vehicleEntity.name}-crew`
  );
}

async function ensureVehicleCrewEntity(vehicleEntity) {
  if (!vehicleEntity?.id || !vehicleEntity?.entity_type) {
    return null;
  }

  if (!isVehicleEntityType(vehicleEntity.entity_type)) {
    return null;
  }

  const crewId = getVehicleCrewId(vehicleEntity);

  let existingCrew = null;

  try {
    existingCrew = await window.dmAPI.getEntity("faction", crewId);
  } catch (error) {
    console.warn("Could not check existing vehicle crew:", crewId, error);
  }

  if (existingCrew) {
    await ensureVehicleCrewOperatesFromRelationship(existingCrew, vehicleEntity);
    return existingCrew;
  }

  const vehicleContext =
    typeof getEntityContext === "function"
      ? getEntityContext(vehicleEntity)
      : {};

  const crewEntity = {
    id: crewId,
    entity_type: "faction",
    name: `${vehicleEntity.name || vehicleEntity.id} Crew`,
    description: `Crew assigned to ${vehicleEntity.name || vehicleEntity.id}.`,

    data_json: {
      source: "vehicle-crew-auto",
      vehicleType: vehicleEntity.entity_type,
      vehicleId: vehicleEntity.id,
      systemId: vehicleContext.systemId || getCurrentSystemId(),
      scope: vehicleContext.scope || getCurrentScope(),
      currentPosition: vehicleContext.currentPosition || getCurrentPositionFromState(),
      visibility: normaliseVisibility({})
    }
  };

  await window.dmAPI.createEntity(crewEntity);
  await ensureVehicleCrewOperatesFromRelationship(crewEntity, vehicleEntity);

  return crewEntity;
}

async function ensureVehicleCrewOperatesFromRelationship(crewEntity, vehicleEntity) {
  if (!crewEntity?.id || !vehicleEntity?.id) return;

  const relationshipId = window.dmStorage.slugify(
    `relationship-${crewEntity.id}-operates-from-${vehicleEntity.entity_type}-${vehicleEntity.id}`
  );

  let existing = [];

  try {
    existing = await window.dmAPI.getEntityRelationships(
      crewEntity.entity_type,
      crewEntity.id
    );
  } catch (error) {
    console.warn("Could not check crew relationships:", error);
  }

  const alreadyLinked = existing.some(rel => {
    return (
      rel.from_type === crewEntity.entity_type &&
      rel.from_id === crewEntity.id &&
      rel.relationship === "operates_from" &&
      rel.to_type === vehicleEntity.entity_type &&
      rel.to_id === vehicleEntity.id
    );
  });

  if (alreadyLinked) return;

  await window.dmAPI.createRelationship({
    id: relationshipId,
    from_type: crewEntity.entity_type,
    from_id: crewEntity.id,
    relationship: "operates_from",
    to_type: vehicleEntity.entity_type,
    to_id: vehicleEntity.id,
    notes: `${crewEntity.name} operates from ${vehicleEntity.name || vehicleEntity.id}.`
  });
}

async function getEntityTreeChildren(entity) {
  const relationships = await getRelationshipsForEntityPanel(entity);

  const childLinks = [];

  for (const relationship of relationships) {
    const selectedEntityIsTarget =
      relationship.to_type === entity.entity_type &&
      relationship.to_id === entity.id;

    const selectedEntityIsSource =
      relationship.from_type === entity.entity_type &&
      relationship.from_id === entity.id;

    // Incoming relationships:
    // Example:
    // Commander Rourke aboard USS Resolute
    if (selectedEntityIsTarget) {
      const childEntity = await window.dmAPI.getEntity(
        relationship.from_type,
        relationship.from_id
      );

      if (childEntity) {
        childLinks.push({
          relationship,
          entity: childEntity,
          direction: "incoming"
        });
      }
    }

    // Do not expand outgoing links here yet.
    // It prevents loops and duplicate tree branches.
    if (selectedEntityIsSource) {
      continue;
    }
  }

  return sortEntityTreeChildren(childLinks);
}
function sortEntityTreeChildren(childLinks) {
  const priority = {
  operates_from: 1,
  commands: 2,
  answers_to: 3,
  member_of: 4,
  secretly_member_of: 5,
  aboard: 20
};

  return childLinks.sort((a, b) => {
    const aPriority = priority[a.relationship.relationship] || 99;
    const bPriority = priority[b.relationship.relationship] || 99;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return a.entity.name.localeCompare(b.entity.name);
  });
}

function groupEntityTreeChildren(childLinks) {
  const groups = [];

  childLinks.forEach((childLink) => {
    const label = formatRelationshipLabel(
      childLink.relationship.relationship,
      childLink.direction
    );

    let group = groups.find((existingGroup) => existingGroup.label === label);

    if (!group) {
      group = {
        label,
        children: []
      };

      groups.push(group);
    }

    group.children.push(childLink);
  });

  return groups;
}

function getEntityTreeIcon(entityType) {
  const icons = {
    ship: "🚢",
    faction: "🏴",
    npc: "🧍",
    location: "🗺",
    settlement: "🏘",
    item: "💎",
    quest: "📜",
    event: "⚡",
    creature: "🐲"
  };

  return icons[entityType] || "🔗";
}

function formatRelationshipLabel(relationship, direction = "incoming") {
  const labels = {
    commands: {
      incoming: "Commanded By / Leader",
      outgoing: "Commands"
    },
    operates_from: {
      incoming: "Operated By",
      outgoing: "Operates From"
    },
    answers_to: {
      incoming: "Reports To Them",
      outgoing: "Answers To"
    },
    member_of: {
      incoming: "Members",
      outgoing: "Member Of"
    },
    secretly_member_of: {
      incoming: "Secret Members / Agents",
      outgoing: "Secretly Member Of"
    },
    allied_with: {
      incoming: "Allied With",
      outgoing: "Allied With"
    },
    owns: {
      incoming: "Owned By",
      outgoing: "Owns"
    },
    located_in: {
      incoming: "Contains",
      outgoing: "Located In"
    },
    aboard: {
  incoming: "Crew / Aboard",
  outgoing: "Aboard / Assigned To"
}
  };

  if (labels[relationship] && labels[relationship][direction]) {
    return labels[relationship][direction];
  }

  return String(relationship || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
// ===========================
// FORGE TOPBAR SEARCH MODULE
// ===========================

let activeForgeSearchType = "all";

function setupForgeSearchModule() {
  const input = document.querySelector("#forgeGlobalSearchInput");
  const results = document.querySelector("#forgeGlobalSearchResults");

  if (!input || !results) {
    console.warn("Forge Search topbar not found, skipping.");
    return;
  }

  input.oninput = debounce(renderForgeGlobalSearchResults, 180);

  input.onfocus = () => {
    if (input.value.trim().length >= 3) {
      renderForgeGlobalSearchResults();
    }
  };

  document.addEventListener("click", event => {
    const wrapper = document.querySelector("#forgeTopSearch");

    if (!wrapper) return;

    if (!wrapper.contains(event.target)) {
      results.classList.add("hidden");
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      results.classList.add("hidden");
      input.blur();
    }
  });
}
async function openCharacterFromForgeSearch(characterId) {
  const partyTab = document.querySelector('.tab[data-tab="party"]');
  const partyPanel = document.querySelector("#party");

  activateMainPanel(partyTab, partyPanel);

  await renderParty();

  const targetCard = document.querySelector(
    `.characterMiniCard[data-character-id="${characterId}"]`
  );

  if (targetCard) {
    targetCard.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    targetCard.classList.add("forgeSearchHighlight");

    setTimeout(() => {
      targetCard.classList.remove("forgeSearchHighlight");
    }, 1800);
  }
}

async function renderForgeGlobalSearchResults() {
  const input = document.querySelector("#forgeGlobalSearchInput");
  const output = document.querySelector("#forgeGlobalSearchResults");

  if (!input || !output) return;

  const searchTerm = input.value.trim();

  if (searchTerm.length < 3) {
    output.classList.add("hidden");
    output.innerHTML = `<p class="forgeEmptyState">Type at least 3 letters to search.</p>`;
    return;
  }

  if (!window.forgeSearch?.getAllSearchResults) {
    output.classList.remove("hidden");
    output.innerHTML = `<p class="forgeEmptyState">Forge Search is not loaded.</p>`;
    return;
  }

  output.classList.remove("hidden");
  output.innerHTML = `<p class="forgeEmptyState">Searching...</p>`;

  let results = [];

try {
  results = await window.forgeSearch.getAllSearchResults({
    searchTerm,
    type: activeForgeSearchType
  });
} catch (error) {
  console.error("Forge Search failed:", error);

  output.innerHTML = `
    <p class="forgeEmptyState">
      Forge Search hit an error. Check the console.
    </p>
  `;

  return;
}

  if (!results.length) {
    output.innerHTML = `<p class="forgeEmptyState">No results found.</p>`;
    return;
  }

  output.innerHTML = `
    <div class="forgeTopSearchResultCount">
      ${results.length} result${results.length === 1 ? "" : "s"}
    </div>

    <div class="forgeTopSearchResultList">
      ${results.slice(0, 12).map(result => {
  const imageOrIcon = result.image
    ? `<img src="${result.image}" alt="" class="forgeSearchResultImage">`
    : escapeHtml(result.icon || "🔎");

  return `
    <button
      class="forgeTopSearchResultItem"
      type="button"
      data-result-type="${escapeHtml(result.type)}"
      data-result-id="${escapeHtml(result.id)}"
    >
      <div class="forgeSearchResultIcon">
        ${imageOrIcon}
      </div>

      <div class="forgeSearchResultBody">
        <strong>${escapeHtml(result.title)}</strong>
        <span>
          <em class="forgeSearchTypeBadge">${escapeHtml(formatSearchResultType(result.type))}</em>
          ${escapeHtml(result.subtitle || "")}
        </span>
      </div>
    </button>
  `;
}).join("")}
    </div>
  `;

  output.querySelectorAll(".forgeTopSearchResultItem").forEach(button => {
    button.onclick = async () => {
      const opened = await openForgeSearchResult(
        button.dataset.resultType,
        button.dataset.resultId
      );

      if (opened === false) return;

      input.value = "";
      output.classList.add("hidden");
    };
  });
}

function formatSearchResultType(type) {
  const labels = {
    creatures: "Creature",
    characters: "Character",
    sessions: "Session",
    "planned-encounters": "Planned Encounter",
    locations: "Location",
    entities: "Entity"
  };

  return labels[type] || "Result";
}

async function openForgeSearchResult(type, id) {
  if (type === "planned-encounters") {
    return openPlannedEncounterFromForgeSearch(id);
  }
  if (type === "characters") {
  await openCharacterFromForgeSearch(id);
  return;
}
  if (type === "creatures") {
    await openCreatureFromRegionOverview(id);
    return;
  }

  if (type === "sessions") {
    await openSessionFromForgeSearch(id);
    return;
  }

  if (type === "locations") {
    await openLocationFromForgeSearch(id);
    return;
  }

  if (type === "entities") {
    await openEntityFromForgeSearch(id);
    return;
  }
}

async function openPlannedEncounterFromForgeSearch(encounterId) {
  const encounterTab = document.querySelector('#tabs [data-workspace-group="pre-game"] .tab[data-tab="encounters"]');
  const encounterPanel = document.querySelector("#encounters");
  if (!encounterTab || !encounterPanel) return false;
  if (!activateMainPanel(encounterTab, encounterPanel)) return false;

  await renderPlannedEncounterWorkspace({ preserveSelection: true });
  return selectPlannedEncounter(encounterId);
}

async function openSessionFromForgeSearch(sessionId) {
  const sessionTab = document.querySelector('.tab[data-tab="session"]');
  const sessionPanel = document.querySelector("#session");

  activateMainPanel(sessionTab, sessionPanel);

  await loadSessionPrep(sessionId);
}

async function openLocationFromForgeSearch(locationId) {
  const locations = await window.forgeSearch.getAllLocationsForSearch();
  const location = locations.find(item => item.id === locationId);

  const setValue = (selector, value) => {
  const field = document.querySelector(selector);

  if (field) {
    field.value = arrayToTextarea(value);
  }
};

setValue("#worldBuilderLocationEnvironmentInput", location.environment);
setValue("#worldBuilderLocationPoliticsInput", location.politics);
setValue("#worldBuilderLocationCultureInput", location.culture);
setValue("#worldBuilderLocationFactionsInput", location.factions);
setValue("#worldBuilderLocationHazardsInput", location.travelHazards || location.hazards);
setValue("#worldBuilderLocationRumoursInput", location.rumours);
setValue("#worldBuilderLocationSecretsInput", location.dmSecrets || location.gmSecrets);
setValue("#worldBuilderLocationToneInput", location.dmTone);

  if (!location) {
    alert("Location not found.");
    return;
  }

  window.dmState.current.region = location.regionId;
  window.dmState.current.location = location.id;

  saveUiState();

  await setupStateBar();
  await renderRegionInfo();
  await applyCurrentTheme();

  const regionTab = document.querySelector('.tab[data-tab="region"]');
  const regionPanel = document.querySelector("#region");

  activateMainPanel(regionTab, regionPanel);
}

async function openEntityFromForgeSearch(entityId) {
  const entityTab = document.querySelector('.tab[data-tab="entities"]');
  const entityPanel = document.querySelector("#entities");

  activateMainPanel(entityTab, entityPanel);

  if (!entityIndexCache?.length) {
    await loadEntityDebugPanel();
  }

  const entity = entityIndexCache.find(item => item.id === entityId);

  if (!entity) {
    alert("Entity not found.");
    return;
  }

  await showEntityDebugDetails(entity);
}

async function openCampaignAtlasOnStartup() {
  const campaignAtlasTab =
    document.querySelector('.tab[data-tab="world"]');

  const campaignAtlasPanel =
    document.querySelector("#world");

  if (!campaignAtlasTab || !campaignAtlasPanel) {
    console.warn("Campaign Atlas tab or panel not found on startup.");
    return;
  }

  activateMainPanel(campaignAtlasTab, campaignAtlasPanel);

  if (typeof renderCampaignAtlas === "function") {
    await renderCampaignAtlas();
  }
}

function activateMainPanel(tab, panel) {
  if (tab?.closest?.("#legacyTabs")) {
    tab = document.querySelector(`#tabs .tab[data-tab="${tab.dataset.tab}"]`) || tab;
  }
  if (!tab || !panel) {
    console.warn("activateMainPanel missing tab or panel", { tab, panel });
    return false;
  }

  if (panel.id !== "entities" && entityBuilderState.activeEntityType === "faction" && hasUnsavedFactionHierarchyChanges()) {
    if (!confirmDiscardFactionHierarchyChanges()) return false;
    discardUnsavedFactionHierarchyChanges();
  }

  if (panel.id !== "encounters" && isPlannedEncounterWorkspaceActive() && plannedEncounterUiState.dirty) {
    if (!confirmDiscardPlannedEncounterChanges()) return false;
    discardCurrentPlannedEncounterEditorState();
  }

  document.querySelectorAll("#tabs .tab").forEach(item => {
    item.classList.remove("active");
    item.removeAttribute("aria-current");
  });

  document.querySelectorAll(".panel").forEach(item => {
    item.classList.remove("active-panel");
    item.style.display = "none";
  });

  tab.classList.add("active");
  tab.setAttribute("aria-current", "page");
  panel.classList.add("active-panel");
  panel.style.display = "block";

  panel.scrollTop = 0;
  const workspaceGroup = tab.closest?.("[data-workspace-group]")?.dataset.workspaceGroup || null;
  if (workspaceGroup) setActiveWorkflowGroup(workspaceGroup);
  else if (panel.id === "home") setActiveWorkflowGroup(null, { persist: false });
  const actionConsole = window.MasterForgeActionConsole;
  if (actionConsole) {
    if (panel.id === "settings" || panel.id === "home") actionConsole.clear();
    else {
      actionConsole.setActiveWorkspace(panel.id, {
        workspaceGroup,
        pageId: panel.id,
        recordType: panel.id === "encounters" ? "planned-encounter" : panel.id === "region" ? "location" : null,
        recordId: panel.id === "encounters" ? plannedEncounterUiState.selectedId : panel.id === "region" ? window.dmState?.current?.location : null,
        selectionType: null,
        selectionId: null
      });
    }
  }
  return true;
}

function debounce(fn, delay = 200) {
  let timeout = null;

  return (...args) => {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

// ===========================
// CREATURE BUILDER MODULE
// Forge Builder Framework v0.1
// ===========================

let creatureBuilderState = {
  currentCreatureId: null,
  activeWorkspace: "overview",
  activeCreature: null,
  creatures: []
};
let activeCreatureScopeFilter = "current-system";

async function syncCreatureToEntity(creature) {
  if (!creature?.id) {
    throw new Error("Creature ID is required for entity synchronisation.");
  }

  const existing = await window.dmAPI.getEntity("creature", creature.id);
  const existingData = existing?.data_json || {};
  const existingVisibility = normaliseVisibility(
    existingData.visibility || existing?.visibility || {}
  );
  const creatureVisibility = creature.visibility
    ? normaliseVisibility(creature.visibility)
    : null;
  const visibility = {
    ...existingVisibility,
    ...(creatureVisibility || {}),
    archived: existingVisibility.archived || creatureVisibility?.archived || false
  };
  const scope = creature.scope || existingData.scope || {
    campaignId: creature.campaign || window.dmState.current.campaign || "",
    worldId: creature.world || window.dmState.current.world || "",
    regionId: creature.region || window.dmState.current.region || "",
    locationId:
      creature.locationId ||
      creature.location ||
      window.dmState.current.location ||
      ""
  };
  const currentPosition = creature.currentPosition || existingData.currentPosition || {
    mode: "location",
    worldId: scope.worldId || "",
    regionId: scope.regionId || "",
    locationId: scope.locationId || "",
    entityType: "",
    entityId: "",
    notes: ""
  };
  const entity = {
    ...(existing || {}),
    id: creature.id,
    entity_type: "creature",
    name: creature.name || existing?.name || "Unnamed Creature",
    description: creature.description || "",
    data_json: {
      ...existingData,
      source: "creature-builder",
      creatureId: creature.id,
      systemId: creature.systemId || existingData.systemId || getCurrentSystemId(),
      scope,
      currentPosition,
      visibility,
      size: creature.size || "",
      type: creature.type || "",
      alignment: creature.alignment || "",
      cr: creature.cr || "",
      status: creature.status || existingData.status || "",
      tags: creature.tags || existingData.tags || ""
    }
  };

  if (existing) {
    return window.dmAPI.updateEntity("creature", creature.id, entity);
  }

  return window.dmAPI.createEntity(entity);
}

async function migrateCreatureEntities() {
  let creatures = [];

  try {
    creatures = await window.dmAPI.getAllRecordsInCollection("creatures");
  } catch (error) {
    console.warn("Could not load all Creature records for migration:", error);
  }

  if (!creatures.length) {
    creatures = await getCreatures();
  }

  for (const creature of creatures) {
    try {
      await syncCreatureToEntity(creature);
    } catch (error) {
      console.warn(
        "Could not migrate Creature to generic entity:",
        creature?.id,
        error
      );
    }
  }
}

const creatureWorkspaceRenderers = {
  overview: renderCreatureOverviewWorkspace,
  traits: renderCreatureTraitsWorkspace,
  actions: renderCreatureActionsWorkspace,
  bonus: renderCreatureBonusActionsWorkspace,
  reactions: renderCreatureReactionsWorkspace,
  legendary: renderCreatureLegendaryWorkspace,
  lair: renderCreatureLairWorkspace,
  loot: renderCreatureLootWorkspace,
  notes: renderCreatureNotesWorkspace,
  entityLinks: renderCreatureEntityLinksWorkspace
};

function setupCreatureModule() {
  const root = document.querySelector("#creatureBuilderRoot");

  if (!root) {
    console.warn("Creature Builder root not found, skipping.");
    return;
  }

  root.innerHTML = renderCreatureBuilderShell();

  document.querySelector("#newCreatureBtn").onclick = newCreature;
  document.querySelector("#saveCreatureBtn").onclick = saveCreature;
  document.querySelector("#deleteCreatureBtn").onclick = deleteCreature;
  document.querySelector("#changeCreatureImageBtn").onclick = () => {
  document.querySelector("#creaturePortraitInput").click();
};

document.querySelector("#creaturePortraitInput").onchange = handleCreaturePortraitSelected;

document.querySelector("#removeCreatureImageBtn").onclick = () => {
  if (!creatureBuilderState.activeCreature) return;

  creatureBuilderState.activeCreature.image = {
    ...(creatureBuilderState.activeCreature.image || {}),
    portrait: ""
  };

  renderCreatureImagePreview("");
};

  const searchInput = document.querySelector("#creatureSearchInput");
const filterInput = document.querySelector("#creatureFilterInput");
const creatureScopeFilterInput = document.querySelector("#creatureScopeFilterInput");

if (searchInput) {
  searchInput.oninput = renderCreatureList;
}

if (filterInput) {
  filterInput.onchange = renderCreatureList;
}

if (creatureScopeFilterInput) {
  creatureScopeFilterInput.value = activeCreatureScopeFilter;

  creatureScopeFilterInput.onchange = () => {
    activeCreatureScopeFilter = creatureScopeFilterInput.value;
    renderCreatureList();
  };
}

  document.querySelectorAll(".mf-workspace-tab").forEach(tab => {
    tab.onclick = () => switchCreatureWorkspace(tab.dataset.workspace);
  });

  document.querySelector("#creatureNameInput").oninput = () => {
    const name = document.querySelector("#creatureNameInput").value || "New Creature";
    document.querySelector("#creatureEditorTitle").innerText = name;
  };

  renderCreatureList();
  newCreature();
  migrateCreatureEntities()
    .then(() => {
      if (typeof loadEntityDebugPanel === "function") {
        return loadEntityDebugPanel();
      }
      return null;
    })
    .catch(error => {
      console.warn("Creature entity migration could not start:", error);
    });
}
function handleCreaturePortraitSelected(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    if (!creatureBuilderState.activeCreature) {
      creatureBuilderState.activeCreature = getDefaultCreature();
    }

    creatureBuilderState.activeCreature.image = {
      ...(creatureBuilderState.activeCreature.image || {}),
      portrait: reader.result
    };

    renderCreatureImagePreview(reader.result);
  };

  reader.readAsDataURL(file);
}

function renderCreatureImagePreview(src) {
  const preview = document.querySelector("#creatureImagePreview");

  if (!preview) return;

  if (!src) {
    preview.innerHTML = `<span>No Image</span>`;
    return;
  }

  preview.innerHTML = `
    <img
      src="${src}"
      alt="Creature portrait"
      class="creaturePortraitPreview"
    >
  `;
}
function renderCreatureBuilderShell() {
  return `
    <div class="forgeBuilderShell">

      <aside class="forgeBuilderSidebar infoCard">

        <div class="forgeSidebarHeader">
          <h1>🦀 Creature Builder</h1>
          <button id="newCreatureBtn">+ New</button>
        </div>

        <input id="creatureSearchInput" placeholder="Search creatures...">
<div id="creatureSearchSuggestions" class="forgeSearchSuggestions hidden"></div>

<select id="creatureScopeFilterInput">
  ${renderLibraryScopeOptions(activeCreatureScopeFilter)}
</select>

<select id="creatureFilterInput">
          <option value="all">All Sources</option>
<option value="homebrew">Homebrew</option>
<option value="campaign">Campaign</option>
<option value="adventure-pack">Adventure Pack</option>
<option value="official-reference">Official Reference</option>
        </select>

        <div id="creatureList" class="forgeBuilderList"></div>

        <div class="forgeSidebarFooter">
          <span id="creatureCount">0 Creatures</span>
        </div>

      </aside>

      <main class="forgeBuilderMain infoCard">

        <header class="forgeBuilderHeader">

          <div>
            <h1>
              <span id="creatureEditorTitle">New Creature</span>
              ${renderSourceBadge("homebrew", "creatureSourceBadge")}
            </h1>
          </div>

          <div class="forgeHeaderActions">
  <button id="saveCreatureBtn">💾 Save Creature</button>
  <button id="duplicateCreatureBtn" disabled>Duplicate</button>
  <button id="exportCreatureBtn" disabled>Export</button>
  <button id="deleteCreatureBtn" class="dangerBtn">Delete</button>
</div>

        </header>

        <input id="creatureIdInput" type="hidden">

        <section class="forgeMetadataStrip">

          <div>
            <label>Name</label>
            <input id="creatureNameInput">
          </div>

          <div>
            <label>Size</label>
            <select id="creatureSizeInput">
              <option>Tiny</option>
              <option>Small</option>
              <option>Medium</option>
              <option>Large</option>
              <option>Huge</option>
              <option>Gargantuan</option>
            </select>
          </div>

          <div>
            <label>Type</label>
            <select id="creatureTypeInput">
              <option>Aberration</option>
              <option>Beast</option>
              <option>Celestial</option>
              <option>Construct</option>
              <option>Dragon</option>
              <option>Elemental</option>
              <option>Fey</option>
              <option>Fiend</option>
              <option>Giant</option>
              <option>Humanoid</option>
              <option>Monstrosity</option>
              <option>Ooze</option>
              <option>Plant</option>
              <option>Undead</option>
            </select>
          </div>

          <div>
            <label>Alignment</label>
            <select id="creatureAlignmentInput">
              <option>Unaligned</option>
              <option>Lawful Good</option>
              <option>Neutral Good</option>
              <option>Chaotic Good</option>
              <option>Lawful Neutral</option>
              <option>Neutral</option>
              <option>Chaotic Neutral</option>
              <option>Lawful Evil</option>
              <option>Neutral Evil</option>
              <option>Chaotic Evil</option>
            </select>
          </div>

          <div>
            <label>CR</label>
            <input id="creatureCrInput" placeholder="3">
          </div>

          <div>
            <label>XP</label>
            <input id="creatureXpInput" type="number">
          </div>

          <div>
            <label>Prof</label>
            <input id="creatureProficiencyInput" placeholder="+2">
          </div>

        </section>

        <section class="forgeStatSummary">

          <div class="forgeImageBlock">
            <div id="creatureImagePreview">
              <span>No Image</span>
            </div>

            <div class="forgeImageActions">
  <button id="changeCreatureImageBtn" type="button">Change Image</button>
  <button id="removeCreatureImageBtn" type="button">Remove</button>
  <input id="creaturePortraitInput" type="file" accept="image/*" hidden>
</div>
          </div>

          <div class="forgeCoreStats">
            <label>Armor Class</label>
            <input id="creatureAcInput">

            <label>Hit Points</label>
            <input id="creatureHpInput">

            <label>Speed</label>
            <input id="creatureSpeedInput">
          </div>

          <div class="forgeAbilityPanel">

            <div class="forgeAbilityGrid">
              <div><label>STR</label><input id="creatureStrInput" type="number"></div>
              <div><label>DEX</label><input id="creatureDexInput" type="number"></div>
              <div><label>CON</label><input id="creatureConInput" type="number"></div>
              <div><label>INT</label><input id="creatureIntInput" type="number"></div>
              <div><label>WIS</label><input id="creatureWisInput" type="number"></div>
              <div><label>CHA</label><input id="creatureChaInput" type="number"></div>
            </div>

            <div class="forgeSmallStatGrid">
              <div>
                <label>Saving Throws</label>
                <input id="creatureSavingThrowsInput" placeholder="STR +6, CON +4">
              </div>

              <div>
                <label>Skills</label>
                <input id="creatureSkillsInput" placeholder="Perception +2">
              </div>

              <div>
                <label>Senses</label>
                <input id="creatureSensesInput" placeholder="passive Perception 12">
              </div>

              <div>
                <label>Languages</label>
                <input id="creatureLanguagesInput" placeholder="—">
              </div>
            </div>

          </div>

        </section>

        <nav class="forgeWorkspaceTabs">
          <button class="mf-workspace-tab active" data-workspace="overview">Overview</button>
          <button class="mf-workspace-tab" data-workspace="traits">Traits</button>
          <button class="mf-workspace-tab" data-workspace="actions">Actions</button>
          <button class="mf-workspace-tab" data-workspace="bonus">Bonus Actions</button>
          <button class="mf-workspace-tab" data-workspace="reactions">Reactions</button>
          <button class="mf-workspace-tab" data-workspace="legendary">Legendary</button>
          <button class="mf-workspace-tab" data-workspace="lair">Lair</button>
          <button class="mf-workspace-tab" data-workspace="loot">Loot</button>
          <button class="mf-workspace-tab" data-workspace="notes">Notes</button>
          <button class="mf-workspace-tab" data-workspace="entityLinks">Entity Links</button>
        </nav>

        <section id="creatureWorkspaceMount" class="forgeWorkspaceMount"></section>
        <section class="canonicalDmWorkspaceHost" data-canonical-dm-workspace-host="creature"></section>

      </main>

    </div>
  `;
}

function getDefaultCreature() {
  return {
    id: null,
    name: "New Creature",
    source: "homebrew",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    cr: "",
    xp: "",
    proficiencyBonus: "+2",

    image: {
      portrait: "",
      token: "",
      background: ""
    },

    stats: {
      ac: "",
      hp: "",
      speed: "",
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10
    },

    savingThrows: "",
    skills: "",
    senses: "passive Perception 10",
    languages: "—",

    description: "",
    environment: "",
    source: "Homebrew",
    tags: "",

    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    lairActions: [],

    loot: [],

    notes: {
      campaign: "",
      dm: "",
      adventure: ""
    },

    flags: {
      homebrew: true,
      legendaryCreature: false,
      hasLair: false
    },

    campaign: "",
    world: window.dmState.current.world,
    region: window.dmState.current.region,
    location: window.dmState.current.location,

    foundInLocationIds: window.dmState.current.location
      ? [window.dmState.current.location]
      : []
  };
}

function normaliseCreature(creature) {
  const base = getDefaultCreature();
  const merged = {
    ...base,
    ...creature,source: normaliseSourceValue(creature?.source || base.source || "homebrew"),
    image: {
      ...base.image,
      ...(creature?.image || {})
    },
    stats: {
      ...base.stats,
      ...(creature?.stats || {}),
      ...(creature?.abilities || {})
    },
    notes: {
      ...base.notes,
      ...(typeof creature?.notes === "object" ? creature.notes : { dm: creature?.notes || "" })
    },
    flags: {
      ...base.flags,
      ...(creature?.flags || {})
    }
  };

  merged.traits = normaliseCreatureEntries(creature?.traits, "trait");
  merged.actions = normaliseCreatureEntries(creature?.actions, "action");
  merged.loot = normaliseCreatureEntries(creature?.loot, "loot");

  merged.bonusActions = Array.isArray(creature?.bonusActions) ? creature.bonusActions : [];
merged.reactions = Array.isArray(creature?.reactions) ? creature.reactions : [];
merged.legendaryActions = Array.isArray(creature?.legendaryActions) ? creature.legendaryActions : [];
merged.lairActions = Array.isArray(creature?.lairActions) ? creature.lairActions : [];

const existingFoundInLocationIds = Array.isArray(creature?.foundInLocationIds)
  ? creature.foundInLocationIds
  : [];

const fallbackLocationIds = [
  creature?.locationId,
  creature?.location,
  creature?.defaultLocationId,
  creature?.currentLocationId
].filter(Boolean);

merged.foundInLocationIds = [
  ...new Set([
    ...existingFoundInLocationIds,
    ...fallbackLocationIds
  ].map(String))
];

return merged;
}
async function renderCreatureLocationChecklist(creature) {
  const selected = Array.isArray(creature?.foundInLocationIds)
    ? creature.foundInLocationIds
    : [];

  let worlds = [];

  try {
    worlds = await window.dmAPI.listWorlds();
  } catch (error) {
    console.warn("Could not load worlds for creature locations:", error);
  }

  if (!worlds.length) {
    return `<p class="forgeEmptyState">No worlds loaded.</p>`;
  }

  const worldBlocks = [];

  for (const world of worlds) {
    let regions = [];

    try {
      regions = await window.dmAPI.listRegions(world.id);
    } catch (error) {
      console.warn("Could not load regions for world:", world.id, error);
    }

    if (!regions.length) {
      worldBlocks.push(`
        <details class="forgeLocationRegionGroup">
          <summary>
            <span>${escapeHtml(world.name || world.id)}</span>
            <small>No regions</small>
          </summary>

          <p class="forgeChecklistEmpty">No regions in this world.</p>
        </details>
      `);

      continue;
    }

    const regionBlocks = [];

    for (const region of regions) {
      let locations = [];

      try {
        locations = await window.dmAPI.listLocations(region.id);
      } catch (error) {
        console.warn("Could not load locations for region:", region.id, error);
      }

      const regionHasSelectedLocation = locations.some(location =>
        selected.includes(location.id)
      );

      const locationHtml = locations.length
        ? locations.map(location => {
            const checked = selected.includes(location.id) ? "checked" : "";

            return `
              <label class="forgeChecklistItem forgeChecklistChild">
                <input
                  type="checkbox"
                  class="creatureFoundLocationInput"
                  value="${escapeHtml(location.id)}"
                  data-world-id="${escapeHtml(world.id)}"
                  data-region-id="${escapeHtml(region.id)}"
                  ${checked}
                >
                <span>${escapeHtml(location.name || location.id)}</span>
              </label>
            `;
          }).join("")
        : `<p class="forgeChecklistEmpty">No locations in this region.</p>`;

      regionBlocks.push(`
        <details class="forgeLocationRegionGroup" ${regionHasSelectedLocation ? "open" : ""}>
          <summary>
            <span>${escapeHtml(region.name || region.id)}</span>
            <small>${locations.length} location${locations.length === 1 ? "" : "s"}</small>
          </summary>

          <div class="forgeLocationRegionLocations">
            ${locationHtml}
          </div>
        </details>
      `);
    }

    const worldHasSelectedLocation = selected.length
      ? regionBlocks.some(block => block.includes(" open>"))
      : world.id === window.dmState.current.world;

    worldBlocks.push(`
      <details class="forgeLocationWorldGroup" ${worldHasSelectedLocation ? "open" : ""}>
        <summary>
          <span>${escapeHtml(world.name || world.id)}</span>
          <small>${regions.length} region${regions.length === 1 ? "" : "s"}</small>
        </summary>

        <div class="forgeLocationWorldRegions">
          ${regionBlocks.join("")}
        </div>
      </details>
    `);
  }

  return worldBlocks.join("");
}

function normaliseCreatureEntries(value, type) {
  if (Array.isArray(value)) return value;

  if (!value) return [];

  if (typeof value === "string") {
    return [{
      id: `${type}-${Date.now()}`,
      name: type === "loot" ? "Loot" : "Entry",
      description: value,
      notes: type === "loot" ? value : ""
    }];
  }

  return [];
}

async function getCreatures() {
  let creatures = [];

  try {
    if (window.dmAPI.getAllRecordsInCollection) {
      creatures = await window.dmAPI.getAllRecordsInCollection("creatures");
    }
  } catch (error) {
    console.warn("Could not load all creatures:", error);
  }

  if (!creatures.length) {
    const current = window.dmState.current || {};

    const fallbackScopes = [
      current.campaign,
      current.world,
      current.region,
      current.location,
      "testing"
    ].filter(Boolean);

    const byId = new Map();

    for (const scope of fallbackScopes) {
      try {
        const scopedCreatures = await window.dmAPI.getRecords("creatures", scope);

        scopedCreatures.forEach(creature => {
          if (!creature?.id) return;

          byId.set(creature.id, {
            ...creature,
            scope
          });
        });
      } catch (error) {
        console.warn("Could not load creatures for scope:", scope, error);
      }
    }

    creatures = [...byId.values()];
  }

  const currentWorld = window.dmState.current.world;

  return creatures
    .map(creature => ({
      ...creature,
      _loadedFrom: creature.scope || creature._loadedFrom || "unknown"
    }))
    .filter(creature => {
      // Keep legacy/testing creatures visible while we stabilise.
      if (creature.scope === "testing") return true;

      // Show creatures with no world yet.
      if (!creature.world) return true;

      // Show creatures for the current world.
      return creature.world === currentWorld;
    });
}

async function renderCreatureList() {
  const list = document.querySelector("#creatureList");
  const count = document.querySelector("#creatureCount");
  const searchInput = document.querySelector("#creatureSearchInput");
  const filterInput = document.querySelector("#creatureFilterInput");
  const creatureScopeFilterInput =
  document.querySelector("#creatureScopeFilterInput");
  

  if (!list) return;

  const searchTerm =
    searchInput?.value?.trim() || "";

  const sourceFilter =
    filterInput?.value || "all";

  const creatures =
  await getCreatures();

creatureBuilderState.creatures = creatures;

const scopedCreatures = creatures.filter(creature =>
  recordMatchesLibraryScope(creature, activeCreatureScopeFilter)
);

const filtered =
  window.forgeSearch.searchCreatures(scopedCreatures, {
    searchTerm,
    filters: {
      source: sourceFilter
    }
  });

  if (count) {
    count.innerText =
      `${filtered.length} of ${creatures.length} Creature${creatures.length === 1 ? "" : "s"} · ${getGameSystemName(getCurrentSystemId())}`;
  }

  if (!filtered.length) {
  list.innerHTML = `<p>No matching creatures.</p>`;
  return;
}
  renderCreatureSearchSuggestions(scopedCreatures, searchTerm);

  list.innerHTML = filtered.map(creature => {
    const portrait =
      creature.image?.portrait ||
      creature.portrait ||
      "";

    const thumbHtml = portrait
      ? `<img src="${portrait}" alt="" class="forgeListThumbImage">`
      : `<span>🐲</span>`;

    return `
      <button class="forgeListItem ${creature.id === creatureBuilderState.currentCreatureId ? "active" : ""}" data-id="${creature.id}">
        <div class="forgeListThumb">${thumbHtml}</div>
        <div>
          <strong>${escapeHtml(creature.name || "Unnamed Creature")}</strong>
          <span>CR ${escapeHtml(creature.cr || "?")} · ${escapeHtml(creature.size || "")} ${escapeHtml(creature.type || "")}</span>
        </div>
      </button>
    `;
  }).join("");

  list.querySelectorAll(".forgeListItem").forEach(btn => {
    btn.onclick = async () => {
      syncCreatureFormToState();

      const creatures = await getCreatures();
      const creature = creatures.find(c => c.id === btn.dataset.id);

      fillCreatureForm(creature);
    };
  });
}

function renderCreatureSearchSuggestions(creatures, searchTerm) {
  const box = document.querySelector("#creatureSearchSuggestions");

  if (!box) return;

  const suggestions = window.forgeSearch.getSearchSuggestions(creatures, {
    searchTerm,
    fields: ["name", "type", "tags", "environment"],
    limit: 6
  });

  if (!suggestions.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  box.classList.remove("hidden");

  box.innerHTML = suggestions.map(value => `
    <button
      type="button"
      class="forgeSearchSuggestion"
      data-search-value="${escapeHtml(value)}"
    >
      ${escapeHtml(value)}
    </button>
  `).join("");

  box.querySelectorAll(".forgeSearchSuggestion").forEach(button => {
    button.onclick = () => {
      const input = document.querySelector("#creatureSearchInput");
      input.value = button.dataset.searchValue;
      box.classList.add("hidden");
      renderCreatureList();
    };
  });
}

function newCreature() {
  const creature = getDefaultCreature();

  creatureBuilderState.currentCreatureId = null;
  creatureBuilderState.activeCreature = creature;

  fillCreatureForm(creature);
}

function fillCreatureForm(creature) {
  const normalised = normaliseCreature(creature || getDefaultCreature());

  creatureBuilderState.currentCreatureId = normalised.id || null;
  creatureBuilderState.activeCreature = normalised;

  document.querySelector("#creatureEditorTitle").innerText =
    normalised.name || "New Creature";

  document.querySelector("#creatureIdInput").value = normalised.id || "";
  document.querySelector("#creatureNameInput").value = normalised.name || "";
  document.querySelector("#creatureSizeInput").value = normalised.size || "Medium";
  document.querySelector("#creatureTypeInput").value = normalised.type || "Beast";
  document.querySelector("#creatureAlignmentInput").value = normalised.alignment || "Unaligned";
  document.querySelector("#creatureCrInput").value = normalised.cr || "";
  document.querySelector("#creatureXpInput").value = normalised.xp || "";
  document.querySelector("#creatureProficiencyInput").value = normalised.proficiencyBonus || "";
  
  document.querySelector("#creatureAcInput").value = normalised.stats?.ac || "";
  document.querySelector("#creatureHpInput").value = normalised.stats?.hp || "";
  document.querySelector("#creatureSpeedInput").value = normalised.stats?.speed || "";

  document.querySelector("#creatureStrInput").value = normalised.stats?.str || "";
  document.querySelector("#creatureDexInput").value = normalised.stats?.dex || "";
  document.querySelector("#creatureConInput").value = normalised.stats?.con || "";
  document.querySelector("#creatureIntInput").value = normalised.stats?.int || "";
  document.querySelector("#creatureWisInput").value = normalised.stats?.wis || "";
  document.querySelector("#creatureChaInput").value = normalised.stats?.cha || "";

  document.querySelector("#creatureSavingThrowsInput").value = normalised.savingThrows || "";
document.querySelector("#creatureSkillsInput").value = normalised.skills || "";
document.querySelector("#creatureSensesInput").value = normalised.senses || "";
document.querySelector("#creatureLanguagesInput").value = normalised.languages || "";

renderCreatureImagePreview(normalised.image?.portrait || "");

updateSourceBadge(
  "#creatureSourceBadge",
  normalised.source || "homebrew"
);

switchCreatureWorkspace(creatureBuilderState.activeWorkspace || "overview", false);
renderCreatureList();
void mountCanonicalDmWorkspace("creature", normalised, "creature").catch(error => console.warn("Creature DM Workspace could not be mounted:", error));
}

function syncCreatureFormToState() {
  const creature = creatureBuilderState.activeCreature || getDefaultCreature();

  creature.id = creatureBuilderState.currentCreatureId;
  creature.name = document.querySelector("#creatureNameInput")?.value.trim() || "";
  creature.size = document.querySelector("#creatureSizeInput")?.value || "Medium";
  creature.type = document.querySelector("#creatureTypeInput")?.value || "Beast";
  creature.alignment = document.querySelector("#creatureAlignmentInput")?.value || "Unaligned";
  creature.cr = document.querySelector("#creatureCrInput")?.value || "";
  creature.xp = Number(document.querySelector("#creatureXpInput")?.value || 0);
  creature.proficiencyBonus = document.querySelector("#creatureProficiencyInput")?.value || "";
  creature.source = normaliseSourceValue(
  document.querySelector("#creatureSourceInput")?.value ||
  creature.source ||
  "homebrew"
);

  creature.stats = {
    ac: document.querySelector("#creatureAcInput")?.value || "",
    hp: document.querySelector("#creatureHpInput")?.value || "",
    speed: document.querySelector("#creatureSpeedInput")?.value || "",
    str: Number(document.querySelector("#creatureStrInput")?.value || 10),
    dex: Number(document.querySelector("#creatureDexInput")?.value || 10),
    con: Number(document.querySelector("#creatureConInput")?.value || 10),
    int: Number(document.querySelector("#creatureIntInput")?.value || 10),
    wis: Number(document.querySelector("#creatureWisInput")?.value || 10),
    cha: Number(document.querySelector("#creatureChaInput")?.value || 10)
  };

  creature.savingThrows = document.querySelector("#creatureSavingThrowsInput")?.value || "";
  creature.skills = document.querySelector("#creatureSkillsInput")?.value || "";
  creature.senses = document.querySelector("#creatureSensesInput")?.value || "";
  creature.languages = document.querySelector("#creatureLanguagesInput")?.value || "";

  syncActiveCreatureWorkspace();

  creature.campaign = window.dmState.current.campaign;
  creature.world = window.dmState.current.world;
  creature.region = window.dmState.current.region;
  creature.location = window.dmState.current.location;
  if (!Array.isArray(creature.foundInLocationIds)) {
  creature.foundInLocationIds = creature.location ? [creature.location] : [];
}
  creature.updated = new Date().toISOString();
creature.image = {
  ...(creature.image || {}),
  portrait: creature.image?.portrait || "",
  token: creature.image?.token || "",
  background: creature.image?.background || ""
};
  creatureBuilderState.activeCreature = creature;

  return creature;
}

function syncActiveCreatureWorkspace() {
  const creature = creatureBuilderState.activeCreature;
  if (!creature) return;

  const workspace = creatureBuilderState.activeWorkspace;

  if (workspace === "overview") {
  const mode =
    document.querySelector("#npcLocationModeInput")?.value || "location";

  const worldId =
    document.querySelector("#npcLocationWorldInput")?.value ||
    window.dmState.current.world;

  const regionId =
    document.querySelector("#npcLocationRegionInput")?.value ||
    window.dmState.current.region;

  const locationId =
    document.querySelector("#npcLocationLocationInput")?.value ||
    window.dmState.current.location;

  const entityTypeInput =
  document.querySelector(
    "#npcLocationEntityTypeInput"
  );

const entityIdInput =
  document.querySelector(
    "#npcLocationEntityIdInput"
  );

const selectedEntityOption =
  entityIdInput?.selectedOptions?.[0];

const entityType =
  selectedEntityOption?.dataset?.entityType ||
  entityTypeInput?.value ||
  "";

  const entityId =
    document.querySelector("#npcLocationEntityIdInput")?.value || "";

  const notes =
    document.querySelector("#npcLocationNotesInput")?.value || "";

  npc.overview = {
    summary: document.querySelector("#npcSummaryInput")?.value || "",
    currentLocation: notes,
    firstMet: document.querySelector("#npcFirstMetInput")?.value || ""
  };

  npc.locationState = {
    mode,
    worldId,
    regionId,
    locationId,
    entityType: mode === "entity" ? entityType : "",
    entityId: mode === "entity" ? entityId : "",
    notes
  };

  npc.replaceOldLocationRelationships =
  document.querySelector("#npcReplaceLocationRelationshipsInput")?.checked !== false;

  if (mode === "location") {
  npc.world = worldId;
  npc.region = regionId;
  npc.locationId = locationId;
}

if (mode === "entity") {
  npc.world = worldId;
  npc.region = regionId;
  npc.locationId = locationId; // fallback only; Region Overview resolves the entity location live
}

  npc.flags = {
    ...(npc.flags || {}),
    isVendor: document.querySelector("#npcIsVendorInput")?.checked || false,
    isBoss: document.querySelector("#npcIsBossInput")?.checked || false,
    legendaryNpc: document.querySelector("#npcLegendaryInput")?.checked || false,
    hasLair: document.querySelector("#npcHasLairInput")?.checked || false
  };
}

  if (workspace === "traits") {
    creature.traits = collectSimpleCards("trait");
  }

  if (workspace === "actions") {
  creature.actions = collectActionCards(".creatureActionCard");
}

if (workspace === "bonus") {
  creature.bonusActions = collectActionCards(".creatureBonusActionCard");
}

if (workspace === "reactions") {
  creature.reactions = collectActionCards(".creatureReactionCard");
}

if (workspace === "legendary") {
  creature.flags = {
    ...(creature.flags || {}),
    legendaryCreature: document.querySelector("#creatureLegendaryEnabledInput")?.checked || false
  };

  creature.legendaryActions = collectActionCards(".creatureLegendaryActionCard");
}

if (workspace === "lair") {
  creature.flags = {
    ...(creature.flags || {}),
    hasLair: document.querySelector("#creatureHasLairInput")?.checked || false
  };

  creature.lairActions = collectActionCards(".creatureLairActionCard");
}

  if (workspace === "loot") {
    creature.loot = collectLootCards();
  }

  if (workspace === "notes") {
    creature.notes = {
      campaign: document.querySelector("#creatureCampaignNotesInput")?.value || "",
      dm: document.querySelector("#creatureDmNotesInput")?.value || "",
      adventure: document.querySelector("#creatureAdventureNotesInput")?.value || ""
    };
  }
}

function switchCreatureWorkspace(workspaceKey, shouldSync = true) {
  if (shouldSync) {
    syncCreatureFormToState();
  }

  creatureBuilderState.activeWorkspace = workspaceKey;

  document.querySelectorAll(".mf-workspace-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.workspace === workspaceKey);
  });

  const mount = document.querySelector("#creatureWorkspaceMount");
  if (!mount) return;

  mount.innerHTML = "";

  const renderer = creatureWorkspaceRenderers[workspaceKey];

  if (!renderer) {
    mount.innerHTML = `<div class="forgeEmptyState">Workspace not found.</div>`;
    return;
  }

  mount.appendChild(renderer(creatureBuilderState.activeCreature, workspaceKey));
}

function renderCreatureOverviewWorkspace(creature) {
  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  wrapper.innerHTML = `
    <div class="forgeWorkspaceGrid two">
      <div class="forgeWorkspaceCard">
        <h2>Description</h2>
        <textarea id="creatureDescriptionInput">${escapeHtml(creature.description || "")}</textarea>
      </div>

      <div class="forgeWorkspaceCard">
        <h2>Classification</h2>

        <label>Environment</label>
        <input id="creatureEnvironmentInput" value="${escapeHtml(creature.environment || "")}" placeholder="Coastal, Underwater">

        <label>Source</label>
<select id="creatureSourceInput">
  ${renderSourceOptions(creature?.source || "homebrew")}
</select>

        <label>Tags</label>
<input id="creatureTagsInput" value="${escapeHtml(creature.tags || "")}" placeholder="Beast, Aquatic, Coastal">

<h3>Found In Locations</h3>
<div id="creatureFoundInLocations" class="forgeLocationChecklist">
  <p class="forgeEmptyState">Loading world locations...</p>
</div>
    </div>
  `;
renderCreatureLocationChecklist(creature).then(html => {
  const box = wrapper.querySelector("#creatureFoundInLocations");
  if (box) {
    box.innerHTML = html;
  }
});
setTimeout(() => {
  const creatureSourceInput = wrapper.querySelector("#creatureSourceInput");

  if (creatureSourceInput) {
    creatureSourceInput.value = normaliseSourceValue(
      creature?.source || "homebrew"
    );

    creatureSourceInput.onchange = () => {
      if (creatureBuilderState.activeCreature) {
        creatureBuilderState.activeCreature.source =
          normaliseSourceValue(creatureSourceInput.value);
      }

      updateSourceBadge(
        "#creatureSourceBadge",
        creatureSourceInput.value
      );
    };

    updateSourceBadge(
      "#creatureSourceBadge",
      creatureSourceInput.value
    );
  }
}, 0);
  return wrapper;
}

function renderCreatureTraitsWorkspace(creature) {
  return renderSimpleCardWorkspace({
    title: "Traits",
    addLabel: "+ Add Trait",
    type: "trait",
    items: creature.traits || [],
    emptyText: "No traits yet."
  });
}

function renderCreatureActionsWorkspace(creature) {
  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  wrapper.innerHTML = `
    <div class="forgeWorkspaceHeader">
      <div>
        <h2>Actions</h2>
        <p>Each action is stored as its own structured object.</p>
      </div>
      <button id="addCreatureActionBtn">+ Add Action</button>
    </div>

    <div id="creatureActionCardList" class="forgeCardList"></div>
  `;

  const list = wrapper.querySelector("#creatureActionCardList");

  const actions = creature.actions || [];

  if (!actions.length) {
    list.innerHTML = `<p class="forgeEmptyState">No actions yet.</p>`;
  } else {
    actions.forEach(action => {
      list.appendChild(renderActionCard(action));
    });
  }

  wrapper.querySelector("#addCreatureActionBtn").onclick = () => {
    const card = renderActionCard({
      id: "action-" + Date.now(),
      name: "",
      attackBonus: "",
      reach: "",
      targets: "",
      damage: "",
      damageType: "",
      recharge: "",
      description: ""
    });

    list.querySelector(".forgeEmptyState")?.remove();
    list.appendChild(card);
  };

  return wrapper;
}
function renderCreatureBonusActionsWorkspace(creature) {
  return renderActionFamilyWorkspace({
    title: "Bonus Actions",
    description: "Bonus actions use the same structured action framework.",
    addLabel: "+ Add Bonus Action",
    listId: "creatureBonusActionCardList",
    buttonId: "addCreatureBonusActionBtn",
    cardClass: "creatureBonusActionCard",
    items: creature.bonusActions || []
  });
}

function renderCreatureReactionsWorkspace(creature) {
  return renderActionFamilyWorkspace({
    title: "Reactions",
    description: "Reactions trigger from conditions during play.",
    addLabel: "+ Add Reaction",
    listId: "creatureReactionCardList",
    buttonId: "addCreatureReactionBtn",
    cardClass: "creatureReactionCard",
    items: creature.reactions || []
  });
}

function renderCreatureLegendaryWorkspace(creature) {
  const wrapper = renderActionFamilyWorkspace({
    title: "Legendary Actions",
    description: "Used by major creatures at the end of another creature's turn.",
    addLabel: "+ Add Legendary Action",
    listId: "creatureLegendaryActionCardList",
    buttonId: "addCreatureLegendaryActionBtn",
    cardClass: "creatureLegendaryActionCard",
    items: creature.legendaryActions || []
  });

const toggle = document.createElement("div");
toggle.className = "forgeWorkspaceToggle forgeWorkspaceToggleCompact";
toggle.innerHTML = `
  <label class="forgeSwitchLine">
    <span>
      <strong>Legendary Creature</strong>
      <small>Enable legendary action tracking for this creature.</small>
    </span>

    <input
      id="creatureLegendaryEnabledInput"
      type="checkbox"
      ${creature.flags?.legendaryCreature ? "checked" : ""}
    >
  </label>
`;

wrapper.prepend(toggle);

  return wrapper;
}

function renderCreatureLairWorkspace(creature) {
  const wrapper = renderActionFamilyWorkspace({
    title: "Lair Actions",
    description: "Used when the creature controls a lair or regional battlefield.",
    addLabel: "+ Add Lair Action",
    listId: "creatureLairActionCardList",
    buttonId: "addCreatureLairActionBtn",
    cardClass: "creatureLairActionCard",
    items: creature.lairActions || []
  });

const toggle = document.createElement("div");
toggle.className = "forgeWorkspaceToggle forgeWorkspaceToggleCompact";
toggle.innerHTML = `
  <label class="forgeSwitchLine">
    <span>
      <strong>Has Lair</strong>
      <small>Enable lair actions for this creature.</small>
    </span>

    <input
      id="creatureHasLairInput"
      type="checkbox"
      ${creature.flags?.hasLair ? "checked" : ""}
    >
  </label>
`;

wrapper.prepend(toggle);

  return wrapper;
}
function renderActionFamilyWorkspace({
  title,
  description,
  addLabel,
  listId,
  buttonId,
  cardClass,
  items
}) {
  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  wrapper.innerHTML = `
    <div class="forgeWorkspaceHeader">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
      </div>
      <button id="${buttonId}">${escapeHtml(addLabel)}</button>
    </div>

    <div id="${listId}" class="forgeCardList"></div>
  `;

  const list = wrapper.querySelector(`#${listId}`);

  if (!items.length) {
    list.innerHTML = `<p class="forgeEmptyState">No ${escapeHtml(title.toLowerCase())} yet.</p>`;
  } else {
    items.forEach(action => {
      list.appendChild(renderActionCard(action, cardClass));
    });
  }

  wrapper.querySelector(`#${buttonId}`).onclick = () => {
    const card = renderActionCard({
      id: `${cardClass}-${Date.now()}`,
      name: "",
      attackBonus: "",
      reach: "",
      targets: "",
      damage: "",
      damageType: "",
      recharge: "",
      description: ""
    }, cardClass);

    list.querySelector(".forgeEmptyState")?.remove();
    list.appendChild(card);
  };

  return wrapper;
}
function renderActionFamilyWorkspace({
  title,
  description,
  addLabel,
  listId,
  buttonId,
  cardClass,
  items
}) {
  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  wrapper.innerHTML = `
    <div class="forgeWorkspaceHeader">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
      </div>
      <button id="${buttonId}">${escapeHtml(addLabel)}</button>
    </div>

    <div id="${listId}" class="forgeCardList"></div>
  `;

  const list = wrapper.querySelector(`#${listId}`);

  if (!items.length) {
    list.innerHTML = `<p class="forgeEmptyState">No ${escapeHtml(title.toLowerCase())} yet.</p>`;
  } else {
    items.forEach(action => {
      list.appendChild(renderActionCard(action, cardClass));
    });
  }

  wrapper.querySelector(`#${buttonId}`).onclick = () => {
    const card = renderActionCard({
      id: `${cardClass}-${Date.now()}`,
      name: "",
      attackBonus: "",
      reach: "",
      targets: "",
      damage: "",
      damageType: "",
      recharge: "",
      description: ""
    }, cardClass);

    list.querySelector(".forgeEmptyState")?.remove();
    list.appendChild(card);
  };

  return wrapper;
}
function renderCreatureLootWorkspace(creature) {
  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  wrapper.innerHTML = `
    <div class="forgeWorkspaceHeader">
      <div>
        <h2>Harvest / Loot</h2>
        <p>Creature loot is now a mini app, not a textarea.</p>
      </div>
      <button id="addCreatureLootBtn">+ Add Harvest Item</button>
    </div>

    <div id="creatureLootCardList" class="forgeCardList"></div>
  `;

  const list = wrapper.querySelector("#creatureLootCardList");

  const loot = creature.loot || [];

  if (!loot.length) {
    list.innerHTML = `<p class="forgeEmptyState">No loot yet.</p>`;
  } else {
    loot.forEach(item => {
      list.appendChild(renderLootCard(item));
    });
  }

  wrapper.querySelector("#addCreatureLootBtn").onclick = () => {
    const card = renderLootCard({
      id: "loot-" + Date.now(),
      name: "",
      quantity: "",
      weight: "",
      value: "",
      cookable: false,
      spoils: false,
      requiresTool: "",
      dc: "",
      producesItem: "",
      notes: ""
    });

    list.querySelector(".forgeEmptyState")?.remove();
    list.appendChild(card);
  };

  return wrapper;
}

function renderCreatureNotesWorkspace(creature) {
  const notes = creature.notes || {};

  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  wrapper.innerHTML = `
    <div class="forgeWorkspaceGrid three">
      <div class="forgeWorkspaceCard">
        <h2>Campaign Notes</h2>
        <textarea id="creatureCampaignNotesInput">${escapeHtml(notes.campaign || "")}</textarea>
      </div>

      <div class="forgeWorkspaceCard">
        <h2>GM Notes</h2>
        <textarea id="creatureDmNotesInput">${escapeHtml(notes.dm || "")}</textarea>
      </div>

      <div class="forgeWorkspaceCard">
        <h2>Adventure Notes</h2>
        <textarea id="creatureAdventureNotesInput">${escapeHtml(notes.adventure || "")}</textarea>
      </div>
    </div>
  `;

  return wrapper;
}

function renderConfiguredEntityLinksWorkspace({
  sourceEntity,
  quickRelationshipTypes,
  quickTargetType
}) {
  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";
  wrapper.innerHTML = `
    <div class="forgeWorkspaceHeader">
      <div>
        <h2>Entity Links</h2>
        <p>Connect ${escapeHtml(sourceEntity.name || "this entity")} to the shared Relationship Engine.</p>
      </div>
      <button id="refreshCreatureEntityLinksBtn" type="button">Refresh Links</button>
    </div>
    <div id="creatureEntityLinksStatus" class="forgeSmallHelp" role="status" aria-live="polite"></div>
    <div class="forgeWorkspaceGrid two">
      <section class="forgeWorkspaceCard">
        <h3>Generic Entity</h3>
        <p id="creatureEntitySyncState">Checking linked entity…</p>
        <code>${escapeHtml(sourceEntity.id || "Not saved yet")}</code>
        <button id="syncCreatureEntityBtn" type="button" ${sourceEntity.id ? "" : "disabled"}>Sync Creature</button>
        <button id="openCreatureUniversalRelationshipBtn" type="button" ${sourceEntity.id ? "" : "disabled"}>Open Universal Relationship Builder</button>
      </section>
      <section class="forgeWorkspaceCard">
        <h3>Create Faction Relationship</h3>
        <label>Relationship
          <select id="creatureQuickRelationshipTypeInput">
            ${quickRelationshipTypes.map(type => `
              <option value="${escapeHtml(type)}">${escapeHtml(
                type === "member_of" ? "Member Of" : "Secretly Member Of"
              )}</option>
            `).join("")}
          </select>
        </label>
        <p id="creatureQuickRelationshipHelp" class="forgeSmallHelp"></p>
        <label>Faction
          <select id="creatureRelationshipFactionInput">
            <option value="">Loading factions…</option>
          </select>
        </label>
        <label>Optional notes
          <textarea id="creatureRelationshipNotesInput" rows="3"></textarea>
        </label>
        <button id="createCreatureFactionRelationshipBtn" type="button">Create Relationship</button>
      </section>
    </div>
    <section class="forgeWorkspaceCard">
      <h3>Existing Relationships</h3>
      <div id="creatureEntityRelationshipsList"><p class="muted">Loading relationships…</p></div>
    </section>
  `;

  setupConfiguredEntityLinksWorkspace(wrapper, {
    sourceEntity,
    quickRelationshipTypes,
    quickTargetType
  }).catch(error => {
    const status = wrapper.querySelector("#creatureEntityLinksStatus");
    if (status) status.textContent = error.message || "Could not load Entity Links.";
  });

  return wrapper;
}

function renderCreatureEntityLinksWorkspace(creature) {
  return renderConfiguredEntityLinksWorkspace({
    sourceEntity: creature || getDefaultCreature(),
    quickRelationshipTypes: ["member_of", "secretly_member_of"],
    quickTargetType: "faction"
  });
}

async function refreshCreatureRelationshipViews(creature) {
  if (typeof loadEntityDebugPanel === "function") {
    await loadEntityDebugPanel();
  }

  if (currentlySelectedEntity?.entity_type && currentlySelectedEntity?.id) {
    const selectedEntity = await window.dmAPI.getEntity(
      currentlySelectedEntity.entity_type,
      currentlySelectedEntity.id
    );
    if (selectedEntity) {
      currentlySelectedEntity = selectedEntity;
      await showEntityDebugDetails(selectedEntity, {
        preserveTreeOpen: true
      });
    }
  }

  const treePanel = document.querySelector("#entityRelationshipTreePanel");
  if (treePanel && !treePanel.classList.contains("hidden")) {
    await loadEntityTreeViewer();
  }
}

async function setupConfiguredEntityLinksWorkspace(wrapper, {
  sourceEntity,
  quickRelationshipTypes,
  quickTargetType
}) {
  const engine = window.MasterForgeRelationshipEngine;
  const status = wrapper.querySelector("#creatureEntityLinksStatus");
  const syncState = wrapper.querySelector("#creatureEntitySyncState");
  const relationshipInput = wrapper.querySelector("#creatureQuickRelationshipTypeInput");
  const help = wrapper.querySelector("#creatureQuickRelationshipHelp");
  const factionInput = wrapper.querySelector("#creatureRelationshipFactionInput");
  const createButton = wrapper.querySelector("#createCreatureFactionRelationshipBtn");
  const list = wrapper.querySelector("#creatureEntityRelationshipsList");

  const setStatus = message => {
    if (status) status.textContent = message;
  };
  const updateHelp = () => {
    help.textContent = relationshipInput.value === "secretly_member_of"
      ? "This creature has a hidden allegiance or membership that may not be known publicly."
      : "This creature is openly connected to a faction, pack, cult, army, organisation or similar group.";
  };

  updateHelp();
  relationshipInput.onchange = updateHelp;

  if (!sourceEntity.id) {
    syncState.textContent = "Save this Creature before creating relationships.";
    factionInput.innerHTML = `<option value="">Save Creature first</option>`;
    createButton.disabled = true;
    return;
  }

  let genericEntity = await window.dmAPI.getEntity("creature", sourceEntity.id);
  syncState.textContent = genericEntity
    ? `Linked as creature:${sourceEntity.id}`
    : "Not linked to the generic Entity Library yet.";

  const factions = (await window.dmAPI.getEntitiesByType(quickTargetType))
    .filter(faction => {
      const visibility = getEntityEffectiveContext(faction).visibility || {};
      return !visibility.archived;
    });
  factionInput.innerHTML = factions.length
    ? factions.map(faction => `
        <option value="${escapeHtml(faction.id)}">${escapeHtml(faction.name || faction.id)}</option>
      `).join("")
    : `<option value="">No factions found</option>`;
  createButton.disabled = !factions.length;

  const renderRelationships = async () => {
    genericEntity = await window.dmAPI.getEntity("creature", sourceEntity.id);
    if (!genericEntity) {
      list.innerHTML = `<p class="forgeEmptyState">Sync this Creature to view relationships.</p>`;
      return;
    }

    const relationships = (
      await engine.getRelationshipsForEntity("creature", sourceEntity.id)
    ).map(value => engine.normaliseRelationshipRecord(value));
    const resolved = [];

    for (const relationship of relationships) {
      const sourceIsCreature =
        relationship.sourceEntityType === "creature" &&
        relationship.sourceEntityId === sourceEntity.id;
      const otherType = sourceIsCreature
        ? relationship.targetEntityType
        : relationship.sourceEntityType;
      const otherId = sourceIsCreature
        ? relationship.targetEntityId
        : relationship.sourceEntityId;
      const otherEntity = await engine.getEntity(otherType, otherId);
      if (!otherEntity) continue;
      resolved.push({
        relationship,
        otherEntity,
        direction: sourceIsCreature ? "outgoing" : "incoming"
      });
    }

    list.innerHTML = resolved.length
      ? resolved.map(item => `
          <article class="relationshipStoryCard" data-relationship-id="${escapeHtml(item.relationship.id)}">
            <div>
              <strong>${escapeHtml(
                window.MasterForgeRelationshipTypes?.getLabel?.(
                  item.relationship.relationshipType,
                  item.direction
                ) || formatUniversalRelationshipTypeLabel(item.relationship.relationshipType)
              )}</strong>
              <p>${escapeHtml(item.otherEntity.name || item.otherEntity.id)} · ${escapeHtml(formatEntityTypeLabel(item.otherEntity.entity_type))}</p>
              ${item.relationship.notes ? `<p>${escapeHtml(item.relationship.notes)}</p>` : ""}
              <small>${escapeHtml(item.relationship.visibility || "gm")} · ${escapeHtml(item.relationship.status || "active")}</small>
            </div>
            <div class="relationshipStoryActions">
              <button type="button" data-open-related="${escapeHtml(item.otherEntity.entity_type)}:${escapeHtml(item.otherEntity.id)}">Open Related Entity</button>
              <button type="button" data-view-relationship="${escapeHtml(item.relationship.id)}">View Relationship</button>
            </div>
          </article>
        `).join("")
      : `<p class="forgeEmptyState">No direct relationships yet.</p>`;

    list.querySelectorAll("[data-open-related]").forEach(button => {
      button.onclick = async () => {
        const [entityType, entityId] = button.dataset.openRelated.split(":");
        const entity = await window.dmAPI.getEntity(entityType, entityId);
        if (!entity) return;
        activateMainPanel(
          document.querySelector('.tab[data-tab="entities"]'),
          document.querySelector("#entities")
        );
        currentlySelectedEntity = entity;
        await showEntityDebugDetails(entity);
      };
    });

    list.querySelectorAll("[data-view-relationship]").forEach(button => {
      button.onclick = async () => {
        const item = resolved.find(value =>
          value.relationship.id === button.dataset.viewRelationship
        );
        if (!item) return;
        activateMainPanel(
          document.querySelector('.tab[data-tab="entities"]'),
          document.querySelector("#entities")
        );
        currentlySelectedEntity = genericEntity;
        await showUniversalRelationshipBuilder(
          genericEntity,
          item.relationship
        );
      };
    });
  };

  wrapper.querySelector("#syncCreatureEntityBtn").onclick = async () => {
    try {
      genericEntity = await syncCreatureToEntity(sourceEntity);
      syncState.textContent = `Linked as creature:${sourceEntity.id}`;
      setStatus("Creature synchronized with the Entity Library.");
      await renderRelationships();
    } catch (error) {
      setStatus(error.message || "Creature could not be synchronized.");
    }
  };

  wrapper.querySelector("#refreshCreatureEntityLinksBtn").onclick = async () => {
    setStatus("Refreshing relationships…");
    await renderRelationships();
    setStatus("Relationships refreshed.");
  };

  wrapper.querySelector("#openCreatureUniversalRelationshipBtn").onclick = async () => {
    genericEntity = await syncCreatureToEntity(sourceEntity);
    activateMainPanel(
      document.querySelector('.tab[data-tab="entities"]'),
      document.querySelector("#entities")
    );
    currentlySelectedEntity = genericEntity;
    await showUniversalRelationshipBuilder(genericEntity);
  };

  createButton.onclick = async () => {
    const relationshipType = relationshipInput.value;
    const factionId = factionInput.value;
    const notes = wrapper.querySelector("#creatureRelationshipNotesInput")?.value.trim() || "";

    if (!quickRelationshipTypes.includes(relationshipType) || !factionId) {
      setStatus("Choose a relationship and faction.");
      return;
    }

    try {
      createButton.disabled = true;
      genericEntity = await syncCreatureToEntity(sourceEntity);
      const faction = await window.dmAPI.getEntity("faction", factionId);
      if (!faction) throw new Error("Selected Faction could not be loaded.");
      const relationships = (
        await engine.getRelationshipsForEntity("creature", sourceEntity.id)
      ).map(value => engine.normaliseRelationshipRecord(value));
      const duplicate = relationships.some(relationship => (
        relationship.sourceEntityType === "creature" &&
        relationship.sourceEntityId === sourceEntity.id &&
        relationship.relationshipType === relationshipType &&
        relationship.targetEntityType === "faction" &&
        relationship.targetEntityId === factionId
      ));

      if (duplicate) {
        setStatus("That Creature-to-Faction relationship already exists.");
        return;
      }

      await engine.createRelationship({
        id: window.dmStorage.slugify([
          "creature",
          sourceEntity.id,
          relationshipType,
          "faction",
          factionId
        ].join("-")),
        sourceEntityType: "creature",
        sourceEntityId: sourceEntity.id,
        relationshipType,
        targetEntityType: "faction",
        targetEntityId: factionId,
        notes
      });
      setStatus("Faction relationship created.");
      await renderRelationships();
      await refreshCreatureRelationshipViews(sourceEntity);
    } catch (error) {
      setStatus(error.message || "Relationship could not be created.");
    } finally {
      if (createButton.isConnected) createButton.disabled = !factions.length;
    }
  };

  await renderRelationships();
}

async function debugFindAllCreatures() {
  const current = window.dmState.current || {};

  const ownersToCheck = [
    current.campaign,
    current.world,
    current.region,
    current.location
  ];

  const atlasRecords =
    typeof getCampaignAtlasRecords === "function"
      ? getCampaignAtlasRecords()
      : {};

  Object.values(atlasRecords || {}).forEach(record => {
    [
      record.id,
      record.name,
      record.primaryWorldId,
      record.currentWorldId,
      record.currentRegionId,
      record.currentLocationId
    ].forEach(value => {
      if (value) ownersToCheck.push(value);
    });
  });

  const uniqueOwners = [...new Set(ownersToCheck.filter(Boolean))];

  const results = [];

  for (const ownerId of uniqueOwners) {
    try {
      const creatures = await window.dmAPI.getRecords("creatures", ownerId);

      results.push({
        ownerId,
        count: creatures.length,
        creatures: creatures.map(creature => ({
          id: creature.id,
          name: creature.name,
          world: creature.world,
          region: creature.region,
          location: creature.location,
          campaign: creature.campaign
        }))
      });
    } catch (error) {
      results.push({
        ownerId,
        count: "ERROR",
        error: String(error)
      });
    }
  }

  console.table(results.map(row => ({
    ownerId: row.ownerId,
    count: row.count
  })));

  console.log("Full creature storage scan:", results);

  return results;
}

window.debugFindAllCreatures = debugFindAllCreatures;

function renderCreaturePlaceholderWorkspace(creature, workspaceKey) {
  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  wrapper.innerHTML = `
    <div class="forgeEmptyState">
      <h2>${escapeHtml(formatWorkspaceTitle(workspaceKey))}</h2>
      <p>This workspace is reserved for the next pass.</p>
    </div>
  `;

  return wrapper;
}

function renderSimpleCardWorkspace({ title, addLabel, type, items, emptyText }) {
  const wrapper = document.createElement("div");
  wrapper.className = "forgeWorkspace";

  wrapper.innerHTML = `
    <div class="forgeWorkspaceHeader">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>Each ${type} is stored as its own object.</p>
      </div>
      <button id="addSimpleCreatureCardBtn">${escapeHtml(addLabel)}</button>
    </div>

    <div id="simpleCreatureCardList" class="forgeCardList"></div>
  `;

  const list = wrapper.querySelector("#simpleCreatureCardList");

  if (!items.length) {
    list.innerHTML = `<p class="forgeEmptyState">${escapeHtml(emptyText)}</p>`;
  } else {
    items.forEach(item => {
      list.appendChild(renderSimpleCard(type, item));
    });
  }

  wrapper.querySelector("#addSimpleCreatureCardBtn").onclick = () => {
    const card = renderSimpleCard(type, {
      id: `${type}-${Date.now()}`,
      name: "",
      description: ""
    });

    list.querySelector(".forgeEmptyState")?.remove();
    list.appendChild(card);
  };

  return wrapper;
}

function renderSimpleCard(type, item) {
  const card = document.createElement("div");
  card.className = "forgeObjectCard";
  card.dataset.type = type;
  card.dataset.id = item.id || `${type}-${Date.now()}`;

  card.innerHTML = `
    <div class="forgeObjectHeader">
      <input class="forgeObjectName" value="${escapeHtml(item.name || "")}" placeholder="${type} name">
      <button class="forgeRemoveObjectBtn">Remove</button>
    </div>

    <textarea class="forgeObjectDescription" placeholder="Description">${escapeHtml(item.description || "")}</textarea>
  `;

  card.querySelector(".forgeRemoveObjectBtn").onclick = () => card.remove();

  return card;
}

function renderActionCard(action, extraClass = "creatureActionCard") {
  const card = document.createElement("div");
  card.className = `forgeObjectCard ${extraClass}`;
  card.dataset.id = action.id || "action-" + Date.now();

  card.innerHTML = `
    <div class="forgeObjectHeader">
      <input class="actionName" value="${escapeHtml(action.name || "")}" placeholder="Action name">
      <button class="forgeRemoveObjectBtn">Remove</button>
    </div>

    <div class="forgeActionGrid">
      <div>
        <label>Attack Bonus</label>
        <input class="actionAttackBonus" value="${escapeHtml(action.attackBonus || "")}" placeholder="+6">
      </div>

      <div>
        <label>Reach</label>
        <input class="actionReach" value="${escapeHtml(action.reach || "")}" placeholder="5 ft.">
      </div>

      <div>
        <label>Targets</label>
        <input class="actionTargets" value="${escapeHtml(action.targets || "")}" placeholder="One target">
      </div>

      <div>
        <label>Damage</label>
        <input class="actionDamage" value="${escapeHtml(action.damage || "")}" placeholder="13 (2d8 + 4)">
      </div>

      <div>
        <label>Damage Type</label>
        <input class="actionDamageType" value="${escapeHtml(action.damageType || "")}" placeholder="bludgeoning">
      </div>

      <div>
        <label>Recharge</label>
        <input class="actionRecharge" value="${escapeHtml(action.recharge || "")}" placeholder="Recharge 5-6">
      </div>
    </div>

    <label>Description</label>
    <textarea class="actionDescription">${escapeHtml(action.description || "")}</textarea>
  `;

  card.querySelector(".forgeRemoveObjectBtn").onclick = () => card.remove();

  return card;
}

function renderLootCard(item) {
  const card = document.createElement("div");
  card.className = "forgeObjectCard creatureLootCard";
  card.dataset.id = item.id || "loot-" + Date.now();

  card.innerHTML = `
    <div class="forgeObjectHeader">
      <input class="lootName" value="${escapeHtml(item.name || "")}" placeholder="Harvest item name">
      <button class="forgeRemoveObjectBtn">Remove</button>
    </div>

    <div class="forgeActionGrid">
      <div>
        <label>Quantity</label>
        <input class="lootQuantity" value="${escapeHtml(item.quantity || "")}">
      </div>

      <div>
        <label>Weight</label>
        <input class="lootWeight" value="${escapeHtml(item.weight || "")}">
      </div>

      <div>
        <label>Value</label>
        <input class="lootValue" value="${escapeHtml(item.value || "")}">
      </div>

      <div>
        <label>Requires Tool</label>
        <input class="lootRequiresTool" value="${escapeHtml(item.requiresTool || "")}">
      </div>

      <div>
        <label>DC</label>
        <input class="lootDc" value="${escapeHtml(item.dc || "")}">
      </div>

      <div>
        <label>Produces Item</label>
        <input class="lootProducesItem" value="${escapeHtml(item.producesItem || "")}">
      </div>
    </div>

    <div class="forgeToggleRow">
      <label><input class="lootCookable" type="checkbox" ${item.cookable ? "checked" : ""}> Cookable</label>
      <label><input class="lootSpoils" type="checkbox" ${item.spoils ? "checked" : ""}> Spoils</label>
    </div>

    <label>Notes</label>
    <textarea class="lootNotes">${escapeHtml(item.notes || "")}</textarea>
  `;

  card.querySelector(".forgeRemoveObjectBtn").onclick = () => card.remove();

  return card;
}

function collectSimpleCards(type) {
  return [...document.querySelectorAll(`.forgeObjectCard[data-type="${type}"]`)].map(card => ({
    id: card.dataset.id,
    name: card.querySelector(".forgeObjectName")?.value || "",
    description: card.querySelector(".forgeObjectDescription")?.value || ""
  }));
}

function collectActionCards(selector = ".creatureActionCard") {
  return [...document.querySelectorAll(selector)].map(card => ({
    id: card.dataset.id,
    name: card.querySelector(".actionName")?.value || "",
    attackBonus: card.querySelector(".actionAttackBonus")?.value || "",
    reach: card.querySelector(".actionReach")?.value || "",
    targets: card.querySelector(".actionTargets")?.value || "",
    damage: card.querySelector(".actionDamage")?.value || "",
    damageType: card.querySelector(".actionDamageType")?.value || "",
    recharge: card.querySelector(".actionRecharge")?.value || "",
    description: card.querySelector(".actionDescription")?.value || ""
  }));
}

function collectLootCards() {
  return [...document.querySelectorAll(".creatureLootCard")].map(card => ({
    id: card.dataset.id,
    name: card.querySelector(".lootName")?.value || "",
    quantity: card.querySelector(".lootQuantity")?.value || "",
    weight: card.querySelector(".lootWeight")?.value || "",
    value: card.querySelector(".lootValue")?.value || "",
    cookable: card.querySelector(".lootCookable")?.checked || false,
    spoils: card.querySelector(".lootSpoils")?.checked || false,
    requiresTool: card.querySelector(".lootRequiresTool")?.value || "",
    dc: card.querySelector(".lootDc")?.value || "",
    producesItem: card.querySelector(".lootProducesItem")?.value || "",
    notes: card.querySelector(".lootNotes")?.value || ""
  }));
}

async function saveCreature() {
  const creature = syncCreatureFormToState();

  if (!creature.name) {
    alert("Creature name is required.");
    return;
  }

  creature.id =
    creatureBuilderState.currentCreatureId ||
    window.dmStorage.slugify(creature.name || "new-creature");

  const selectedLocationIds = [
    ...document.querySelectorAll(".creatureFoundLocationInput:checked")
  ].map(input => input.value);

  creature.foundInLocationIds = [
    ...new Set(selectedLocationIds.map(String))
  ];

  creatureBuilderState.currentCreatureId = creature.id;
  creatureBuilderState.activeCreature = creature;

  creature.world = creature.world || window.dmState.current.world;
  creature.region = creature.region || window.dmState.current.region;
  creature.location =
    creature.foundInLocationIds[0] ||
    creature.location ||
    window.dmState.current.location;

  creature.campaign = "";

  creature.systemId = creature.systemId || getCurrentSystemId();

creature.scope = {
  campaignId: creature.campaign || window.dmState.current.campaign || "",
  worldId: creature.world || window.dmState.current.world || "",
  regionId: creature.region || window.dmState.current.region || "",
  locationId:
    creature.locationId ||
    creature.location ||
    window.dmState.current.location ||
    ""
};

creature.visibility = normaliseVisibility(creature.visibility || {});

  await window.dmAPI.saveRecord(
    "creatures",
    creature.id,
    creature,
    creature.world || window.dmState.current.world
  );

  await syncCreatureToEntity(creature);
  await mountCanonicalDmWorkspace("creature", creature, "creature");

  await renderCreatureList();
  await renderRegionInfo();

  alert("Creature saved.");
}

async function deleteCreature() {
  if (!creatureBuilderState.currentCreatureId) {
    alert("No creature selected.");
    return;
  }

  const confirmed = confirm("Delete this creature permanently?");
  if (!confirmed) return;

  await window.dmStorage.deleteDbRecord(creatureBuilderState.currentCreatureId);

  creatureBuilderState.currentCreatureId = null;
  creatureBuilderState.activeCreature = null;

  await renderCreatureList();
  newCreature();
}

function formatWorkspaceTitle(value) {
  return String(value || "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

initialiseApp();
