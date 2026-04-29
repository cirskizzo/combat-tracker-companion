/**
 * Tracker Extras
 * Visualizza una risorsa secondaria (es. AC) accanto alla primaria (HP)
 * nel Combat Tracker standard di Foundry, leggendo le configurazioni dal
 * modulo Carousel Combat Tracker (combat-tracker-dock) di TheRipper93.
 */

import { MODULE_ID, CAROUSEL_ID, log, warn, isCarouselActive } from "./main.js";

export const TrackerExtras = {
  // ==========================================================================
  // SETTINGS
  // ==========================================================================
  registerSettings() {
    // Toggle: abilita/disabilita feature
    game.settings.register(MODULE_ID, "trackerExtrasEnabled", {
      name: game.i18n.localize("CTC.settings.trackerExtrasEnabled.name"),
      hint: game.i18n.localize("CTC.settings.trackerExtrasEnabled.hint"),
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      onChange: () => {
        // Re-render del combat tracker per applicare il cambiamento
        ui.combat?.render(true);
      },
    });
  },

  // ==========================================================================
  // HOOKS
  // ==========================================================================
  registerHooks() {
    // Hook generico che funziona sia per CombatTracker (v1) sia per
    // ApplicationV2 (v14)
    Hooks.on("renderCombatTracker", this.onRenderTracker.bind(this));

    log("TrackerExtras: hooks registrati");
  },

  // ==========================================================================
  // HELPER: Lettura configurazione
  // ==========================================================================
  /**
   * Legge il path della risorsa primaria dal core di Foundry.
   * Es: "attributes.hp.value"
   */
  getPrimaryResource() {
    try {
      const config = game.settings.get("core", "combatTrackerConfig");
      return config?.resource || null;
    } catch (e) {
      warn("Impossibile leggere combatTrackerConfig:", e);
      return null;
    }
  },

  /**
   * Legge il path della risorsa secondaria dal modulo Carousel.
   * Es: "attributes.ac.value"
   */
  getSecondaryResource() {
    if (!isCarouselActive()) return null;

    try {
      return game.settings.get(CAROUSEL_ID, "resource") || null;
    } catch (e) {
      warn("Impossibile leggere resource da Carousel:", e);
      return null;
    }
  },

  /**
   * Legge il colore della risorsa primaria dal modulo Carousel.
   * @returns {string} Colore CSS (default verde se non disponibile)
   */
  getPrimaryColor() {
    const fallback = "#41a53d"; // verde default

    if (!isCarouselActive()) return fallback;

    try {
      const color = game.settings.get(CAROUSEL_ID, "attributeColor");
      return this._colorToCss(color, fallback);
    } catch (e) {
      return fallback;
    }
  },

  /**
   * Legge il colore della risorsa secondaria dal modulo Carousel.
   * @returns {string} Colore CSS (default giallo se non disponibile)
   */
  getSecondaryColor() {
    const fallback = "#ffcc40"; // giallo default

    if (!isCarouselActive()) return fallback;

    try {
      const color = game.settings.get(CAROUSEL_ID, "attributeColor2");
      return this._colorToCss(color, fallback);
    } catch (e) {
      return fallback;
    }
  },

  /**
   * Converte un valore Color (oggetto Foundry) o stringa in CSS hex.
   * @private
   */
  _colorToCss(color, fallback) {
    if (!color) return fallback;
    if (typeof color === "string") return color;
    // Foundry Color object: ha metodo .css o .toString()
    if (color.css) return color.css;
    if (typeof color.toString === "function") {
      const str = color.toString();
      if (str.startsWith("#")) return str;
    }
    return fallback;
  },

  // ==========================================================================
  // CALLBACK: Rendering del tracker
  // ==========================================================================
  /**
   * Callback eseguito ogni volta che il Combat Tracker viene renderizzato.
   * Inietta i valori delle risorse primaria e secondaria accanto al nome
   * di ogni combatant.
   *
   * @param {Application} app - L'Application del CombatTracker
   * @param {jQuery|HTMLElement} html - Il contenuto HTML del tracker
   * @param {Object} data - I dati passati al template
   */
  onRenderTracker(app, html, data) {
    if (!game.user.isGM) return; // Solo GM
    if (!game.settings.get(MODULE_ID, "trackerExtrasEnabled")) return;

    // Normalizza html: in v14 può essere HTMLElement, in v13 jQuery
    const $html = html instanceof jQuery ? html : $(html);

    const primaryPath = this.getPrimaryResource();
    const secondaryPath = this.getSecondaryResource();

    if (!primaryPath && !secondaryPath) {
      log("Nessun path risorsa configurato, skip");
      return;
    }

    const primaryColor = this.getPrimaryColor();
    const secondaryColor = this.getSecondaryColor();

    // data.combats[].turns oppure data.turns a seconda della versione/struttura
    const turns = data?.turns || data?.combats?.[0]?.turns || [];

    if (turns.length === 0) {
      // Nessun combatant da processare
      return;
    }

    for (const turn of turns) {
      this._injectResourcesIntoCombatant({
        $html,
        turn,
        primaryPath,
        secondaryPath,
        primaryColor,
        secondaryColor,
      });
    }
  },

  /**
   * Inietta i valori delle risorse nell'HTML di un singolo combatant.
   * @private
   */
  _injectResourcesIntoCombatant({
    $html,
    turn,
    primaryPath,
    secondaryPath,
    primaryColor,
    secondaryColor,
  }) {
    // Trova l'elemento del combatant nel DOM
    const $combatant = $html.find(`[data-combatant-id="${turn.id}"]`);
    if ($combatant.length === 0) return;

    // Recupera l'actor per leggere i valori attuali
    const combat = game.combat;
    const combatant = combat?.combatants?.get(turn.id);
    const actor = combatant?.actor;
    if (!actor) return;

    const primaryValue = primaryPath
      ? foundry.utils.getProperty(actor.system, primaryPath)
      : null;
    const secondaryValue = secondaryPath
      ? foundry.utils.getProperty(actor.system, secondaryPath)
      : null;

    // Costruisci HTML
    const parts = [];
    if (primaryValue !== null && primaryValue !== undefined) {
      parts.push(
        `<span class="ctc-resource ctc-primary" style="color: ${primaryColor};">${primaryValue}</span>`
      );
    }
    if (secondaryValue !== null && secondaryValue !== undefined) {
      parts.push(
        `<span class="ctc-resource ctc-secondary" style="color: ${secondaryColor};">${secondaryValue}</span>`
      );
    }

    if (parts.length === 0) return;

    const $injection = $(
      `<div class="ctc-resources">${parts.join(" / ")}</div>`
    );

    // Rimuovi vecchie injection (se re-render)
    $combatant.find(".ctc-resources").remove();

    // Trova il punto di inserimento.
    // Strategia robusta: dopo il nome del combatant.
    // Selettori comuni: .token-name, .combatant-name, h4, h3
    let $target = $combatant.find(".token-name").first();
    if ($target.length === 0) $target = $combatant.find(".combatant-name").first();
    if ($target.length === 0) $target = $combatant.find("h4").first();
    if ($target.length === 0) $target = $combatant.find("h3").first();

    if ($target.length > 0) {
      $target.append($injection);
    } else {
      // Fallback: appendi al combatant
      $combatant.append($injection);
    }
  },
};
