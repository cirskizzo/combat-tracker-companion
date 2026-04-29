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
   * filtrando per channel "music" se richiesto.
   * @returns {Array<{playlistId, soundId, currentTime, mode}>}
   */
  captureCurrentMusicState() {
    const onlyMusic = game.settings.get(MODULE_ID, "pauseOnlyMusic");
    const state = [];

    for (const playlist of game.playlists) {
      if (!playlist.playing) continue;

      // Filtra per channel music se richiesto
      if (onlyMusic && playlist.channel !== "music") continue;

      // Salva ogni suono in playback con il timestamp
      for (const sound of playlist.sounds) {
        if (!sound.playing) continue;

        state.push({
          playlistId: playlist.id,
          soundId: sound.id,
          currentTime: sound.sound?.currentTime ?? 0,
          mode: playlist.mode,
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
   * Ripristina le playlist allo stato salvato, riprendendo dalla traccia
   * e dal timestamp esatti.
   * @param {Array} state - Stato catturato da captureCurrentMusicState()
   */
  async restoreMusicState(state) {
    // Raggruppa per playlist
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

      // Avvia ogni suono e poi setta il currentTime
      for (const entry of sounds) {
        const sound = playlist.sounds.get(entry.soundId);
        if (!sound) continue;

        try {
          await playlist.playSound(sound);

          // Aspetta che il suono sia pronto e setta il timestamp
          if (sound.sound && entry.currentTime > 0) {
            // Piccolo delay per assicurarsi che il sound sia caricato
            setTimeout(() => {
              if (sound.sound) {
                sound.sound.currentTime = entry.currentTime;
              }
            }, 100);
          }
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
    const buttons = {};

    playlists.forEach((p, i) => {
      buttons[`p${i}`] = {
        icon: '<i class="fas fa-music"></i>',
        label: p.name,
        callback: () => p,
      };
    });

    buttons.cancel = {
      icon: '<i class="fas fa-times"></i>',
      label: game.i18n.localize("CTC.dialog.cancel"),
      callback: () => null,
    };

    return new Promise((resolve) => {
      const dialog = new Dialog({
        title: game.i18n.localize("CTC.dialog.choosePlaylist.title"),
        content: `<p>${game.i18n.localize("CTC.dialog.choosePlaylist.content")}</p>`,
        buttons,
        default: "p0",
        close: () => resolve(null),
      });

      // Override callback per resolvere la promise
      const originalButtons = dialog.data.buttons;
      for (const key of Object.keys(originalButtons)) {
        const original = originalButtons[key].callback;
        originalButtons[key].callback = (html) => {
          const result = original(html);
          resolve(result);
        };
      }

      dialog.render(true);
    });
  },
};

// ============================================================================
// APPLICATION: Configurazione playlist (menu)
// ============================================================================
class PlaylistConfigApp extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "ctc-playlist-config",
      title: game.i18n.localize("CTC.settings.combatPlaylistsMenu.label"),
      template: `modules/${MODULE_ID}/templates/playlist-config.hbs`,
      width: 500,
      height: "auto",
      closeOnSubmit: true,
    });
  }

  getData() {
    const selected = game.settings.get(MODULE_ID, "combatPlaylists") || [];
    const allPlaylists = Array.from(game.playlists).map((p) => ({
      id: p.id,
      name: p.name,
    }));

    // 3 slot, ognuno con la playlist scelta o "" se vuoto
    const slots = [0, 1, 2].map((i) => ({
      index: i,
      selectedId: selected[i] || "",
    }));

    return {
      slots,
      allPlaylists,
    };
  }

  async _updateObject(event, formData) {
    const ids = [
      formData.slot0,
      formData.slot1,
      formData.slot2,
    ].filter((id) => id && id !== "");

    await game.settings.set(MODULE_ID, "combatPlaylists", ids);
    log(`Playlist di combat salvate: ${ids.length}`);
  }
}
