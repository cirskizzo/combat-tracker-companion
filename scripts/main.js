/**
 * Combat Tracker Companion
 * Entry point del modulo
 *
 * Estende il Combat Tracker di Foundry VTT con:
 * - Feature 1: Auto-play di playlist all'avvio del combat
 * - Feature 2: Visualizzazione risorsa secondaria nel tracker standard
 */

import { CombatMusic } from "./combat-music.js";
import { TrackerExtras } from "./tracker-extras.js";

/** Identificatore univoco del modulo (deve corrispondere a module.json id) */
export const MODULE_ID = "combat-tracker-companion";

/** Identificatore del modulo Carousel di TheRipper93 (dipendenza opzionale) */
export const CAROUSEL_ID = "combat-tracker-dock";

/** Helper per logging consistente */
export const log = (...args) => console.log(`[${MODULE_ID}]`, ...args);
export const warn = (...args) => console.warn(`[${MODULE_ID}]`, ...args);
export const error = (...args) => console.error(`[${MODULE_ID}]`, ...args);

/**
 * Verifica se il modulo Carousel è installato e attivo.
 * @returns {boolean}
 */
export function isCarouselActive() {
  const mod = game.modules.get(CAROUSEL_ID);
  return mod?.active === true;
}

// ============================================================================
// HOOK INIT — Registra le settings
// ============================================================================
Hooks.once("init", () => {
  log("Init: registrazione settings");

  CombatMusic.registerSettings();
  TrackerExtras.registerSettings();

  log("Init completato");
});

// ============================================================================
// HOOK READY — Tutto è caricato, possiamo agganciare gli eventi
// ============================================================================
Hooks.once("ready", () => {
  log(`Pronto. Carousel attivo: ${isCarouselActive()}`);

  CombatMusic.registerHooks();
  TrackerExtras.registerHooks();
});
