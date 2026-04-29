/**
 * Combat Music
 * Gestisce l'auto-play di playlist all'avvio del combat e
 * il ripristino della musica precedente alla fine.
 */

import { MODULE_ID, log, warn } from "./main.js";

const FLAG_PREVIOUS_STATE = "previousMusicState";
const FLAG_ACTIVE_PLAYLIST = "activeCombatPlaylist";

export const CombatMusic = {
  // ==========================================================================
  // SETTINGS
  // ==========================================================================
  registerSettings() {
    // Lista delle playlist di combat (max 3)
    game.settings.register(MODULE_ID, "combatPlaylists", {
      name: game.i18n.localize("CTC.settings.combatPlaylists.name"),
      hint: game.i18n.localize("CTC.settings.combatPlaylists.hint"),
      scope: "world",
      config: false, // Configurato via menu custom
      type: Array,
      default: [],
    });

    // Menu di configurazione delle playlist
    game.settings.registerMenu(MODULE_ID, "combatPlaylistsMenu", {
      name: game.i18n.localize("CTC.settings.combatPlaylistsMenu.name"),
      label: game.i18n.localize("CTC.settings.combatPlaylistsMenu.label"),
      hint: game.i18n.localize("CTC.settings.combatPlaylistsMenu.hint"),
      icon: "fas fa-music",
      type: PlaylistConfigApp,
      restricted: true,
    });

    // Toggle: abilita/disabilita feature
    game.settings.register(MODULE_ID, "musicEnabled", {
      name: game.i18n.localize("CTC.settings.musicEnabled.name"),
      hint: game.i18n.localize("CTC.settings.musicEnabled.hint"),
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
    });

    // Toggle: pausa solo channel "music" o tutto?
    game.settings.register(MODULE_ID, "pauseOnlyMusic", {
      name: game.i18n.localize("CTC.settings.pauseOnlyMusic.name"),
      hint: game.i18n.localize("CTC.settings.pauseOnlyMusic.hint"),
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
    });
  },

  // ==========================================================================
  // HOOKS
  // ==========================================================================
  registerHooks() {
    Hooks.on("combatStart", this.onCombatStart.bind(this));
    Hooks.on("deleteCombat", this.onCombatEnd.bind(this));
    log("CombatMusic: hooks registrati");
  },

  // ==========================================================================
  // CALLBACK: Inizio combat
  // ==========================================================================
  async onCombatStart(combat) {
    if (!game.user.isGM) return; // Solo il GM gestisce la musica
    if (!game.settings.get(MODULE_ID, "musicEnabled")) return;

    log("Combat iniziato, gestione musica...");

    const playlistIds = game.settings.get(MODULE_ID, "combatPlaylists") || [];
    const validPlaylists = playlistIds
      .map((id) => game.playlists.get(id))
      .filter((p) => p);

    if (validPlaylists.length === 0) {
      log("Nessuna playlist di combat configurata");
      return;
    }

    // Selezione playlist
    let chosen;
    if (validPlaylists.length === 1) {
      chosen = validPlaylists[0];
    } else {
      chosen = await this.showPlaylistPicker(validPlaylists);
      if (!chosen) {
        log("Utente ha annullato la selezione, nessun cambio musica");
        return;
      }
    }

    // 1. Salva stato corrente
    const previousState = this.captureCurrentMusicState();
    await combat.setFlag(MODULE_ID, FLAG_PREVIOUS_STATE, previousState);

    // 2. Pause della musica corrente
    await this.pauseCurrentMusic();

    // 3. Avvia playlist combat
    await chosen.playAll();
    await combat.setFlag(MODULE_ID, FLAG_ACTIVE_PLAYLIST, chosen.id);

    log(`Avviata playlist combat: ${chosen.name}`);
  },

  // ==========================================================================
  // CALLBACK: Fine combat
  // ==========================================================================
  async onCombatEnd(combat) {
    if (!game.user.isGM) return;
    if (!game.settings.get(MODULE_ID, "musicEnabled")) return;

    const activePlaylistId = combat.getFlag(MODULE_ID, FLAG_ACTIVE_PLAYLIST);
    const previousState = combat.getFlag(MODULE_ID, FLAG_PREVIOUS_STATE);

    if (!activePlaylistId && !previousState) {
      log("Nessuno stato musicale da ripristinare");
      return;
    }

    log("Combat finito, ripristino musica precedente...");

    // 1. Stop playlist combat
    if (activePlaylistId) {
      const combatPlaylist = game.playlists.get(activePlaylistId);
      if (combatPlaylist) await combatPlaylist.stopAll();
    }

    // 2. Ripristina stato precedente
    if (previousState && previousState.length > 0) {
      await this.restoreMusicState(previousState);
    }

    log("Ripristino musica completato");
  },

  // ==========================================================================
  // HELPER: Cattura stato musica corrente
  // ==========================================================================
  /**
   * Cattura lo stato di tutte le playlist correntemente in riproduzione,
   * filtrando per channel "music" se richiesto. Il ripristino fa ripartire
   * ogni traccia dall'inizio (non salviamo l'offset).
   * @returns {Array<{playlistId, soundId}>}
   */
  captureCurrentMusicState() {
    const onlyMusic = game.settings.get(MODULE_ID, "pauseOnlyMusic");
    const state = [];

    for (const playlist of game.playlists) {
      if (!playlist.playing) continue;
      if (onlyMusic && playlist.channel !== "music") continue;

      for (const sound of playlist.sounds) {
        if (!sound.playing) continue;
        state.push({
          playlistId: playlist.id,
          soundId: sound.id,
        });
      }
    }

    log(`Stato musicale catturato: ${state.length} suoni in riproduzione`);
    return state;
  },

  // ==========================================================================
  // HELPER: Pausa musica corrente
  // ==========================================================================
  async pauseCurrentMusic() {
    const onlyMusic = game.settings.get(MODULE_ID, "pauseOnlyMusic");

    for (const playlist of game.playlists) {
      if (!playlist.playing) continue;
      if (onlyMusic && playlist.channel !== "music") continue;

      await playlist.stopAll();
    }
  },

  // ==========================================================================
  // HELPER: Ripristina stato musicale
  // ==========================================================================
  /**
   * Ripristina le playlist allo stato salvato facendo ripartire ogni traccia
   * dall'inizio.
   * @param {Array} state - Stato catturato da captureCurrentMusicState()
   */
  async restoreMusicState(state) {
    const byPlaylist = new Map();
    for (const entry of state) {
      if (!byPlaylist.has(entry.playlistId)) {
        byPlaylist.set(entry.playlistId, []);
      }
      byPlaylist.get(entry.playlistId).push(entry);
    }

    for (const [playlistId, sounds] of byPlaylist) {
      const playlist = game.playlists.get(playlistId);
      if (!playlist) {
        warn(`Playlist ${playlistId} non trovata, salto`);
        continue;
      }

      for (const entry of sounds) {
        const sound = playlist.sounds.get(entry.soundId);
        if (!sound) continue;

        try {
          await playlist.playSound(sound);
        } catch (e) {
          warn(`Errore nel ripristino suono ${entry.soundId}:`, e);
        }
      }
    }
  },

  // ==========================================================================
  // HELPER: Popup di scelta playlist
  // ==========================================================================
  /**
   * Mostra un popup per scegliere la playlist da avviare.
   * @param {Array<Playlist>} playlists
   * @returns {Promise<Playlist|null>} La playlist scelta o null se annullato
   */
  async showPlaylistPicker(playlists) {
    const buttons = playlists.map((p, i) => ({
      action: `p${i}`,
      icon: "fas fa-music",
      label: p.name,
      callback: () => p,
    }));

    buttons.push({
      action: "cancel",
      icon: "fas fa-times",
      label: game.i18n.localize("CTC.dialog.cancel"),
      callback: () => null,
    });

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("CTC.dialog.choosePlaylist.title") },
      content: `<p>${game.i18n.localize("CTC.dialog.choosePlaylist.content")}</p>`,
      buttons,
      default: "p0",
      rejectClose: false,
    });

    return result ?? null;
  },
};

// ============================================================================
// APPLICATION: Configurazione playlist (menu)
// ============================================================================
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class PlaylistConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "ctc-playlist-config",
    tag: "form",
    window: {
      title: "CTC.settings.combatPlaylistsMenu.label",
      icon: "fas fa-music",
    },
    position: {
      width: 500,
      height: "auto",
    },
    form: {
      handler: PlaylistConfigApp._onSubmit,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      // Path inlined: MODULE_ID è in TDZ qui per via dell'import circolare con main.js
      template: "modules/combat-tracker-companion/templates/playlist-config.hbs",
    },
  };

  async _prepareContext() {
    const selected = game.settings.get(MODULE_ID, "combatPlaylists") || [];
    const allPlaylists = Array.from(game.playlists).map((p) => ({
      id: p.id,
      name: p.name,
    }));

    // 3 slot, ognuno con: numero per il label, lista di opzioni con flag
    // "selected" precalcolato. Tutto in JS così il template non dipende da
    // helper Handlebars custom (es. add, ifEquals) che non sono garantiti
    // come built-in di Foundry.
    const slots = [0, 1, 2].map((i) => {
      const selectedId = selected[i] || "";
      return {
        index: i,
        number: i + 1,
        selectedId,
        options: allPlaylists.map((p) => ({
          id: p.id,
          name: p.name,
          selected: p.id === selectedId,
        })),
      };
    });

    return { slots };
  }

  static async _onSubmit(event, form, formData) {
    const data = formData.object;
    const ids = [data.slot0, data.slot1, data.slot2].filter(
      (id) => id && id !== ""
    );

    await game.settings.set(MODULE_ID, "combatPlaylists", ids);
    log(`Playlist di combat salvate: ${ids.length}`);
  }
}
