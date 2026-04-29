# Combat Tracker Companion

Modulo personale per **Foundry VTT v14** che estende il Combat Tracker con due funzionalità:

1. **🎵 Auto-play di playlist all'avvio del combattimento** — fino a 3 playlist configurabili, con popup di selezione, pausa intelligente della musica corrente e ripristino esatto (stessa traccia, stesso punto) alla fine del combat.
2. **🛡️ Risorsa secondaria nel Combat Tracker standard** — mostra la CA (o altro attributo configurato) accanto ai PF, leggendo configurazione e colori dal modulo Carousel Combat Tracker (`combat-tracker-dock`) di TheRipper93.

> Pensato per uso personale in campagne D&D 5e 2024 con sessioni live in-person.

---

## Compatibilità

- **Foundry VTT:** v13–v14 (verified su v14)
- **Sistema:** indipendente, ma testato su D&D 5e 2024
- **Dipendenza opzionale:** [Carousel Combat Tracker](https://foundryvtt.com/packages/combat-tracker-dock) di TheRipper93

Senza Carousel installato, la Feature 2 mostra solo la risorsa primaria (PF) con colore di default.

---

## Installazione

### Manuale (consigliato in fase di sviluppo)

1. Clona questo repo nella cartella moduli di Foundry:
   ```bash
   cd "$HOME/Library/Application Support/FoundryVTT/Data/modules"
   git clone https://github.com/cirskizzo/combat-tracker-companion.git
   ```
2. Riavvia Foundry e attiva il modulo nel mondo.

### Tramite manifest URL (quando ci sarà una release)

```
https://github.com/cirskizzo/combat-tracker-companion/releases/latest/download/module.json
```

---

## Configurazione

Una volta attivato il modulo, vai in **Game Settings → Configure Settings → Combat Tracker Companion**:

| Setting | Descrizione |
|---|---|
| Abilita musica di combattimento | Toggle per la Feature 1 |
| Metti in pausa solo il canale Music | Se ON, pausa solo playlist con channel "music" |
| Playlist di combattimento | Menu per scegliere fino a 3 playlist |
| Mostra risorsa secondaria nel tracker | Toggle per la Feature 2 |

### Workflow Feature 1

1. Configura 1–3 playlist nel menu "Playlist di combattimento"
2. All'avvio di un combat:
   - Se hai 1 playlist → parte automaticamente
   - Se ne hai più di una → popup di scelta
   - Se annulli → la musica corrente continua invariata
3. Le playlist con channel "Music" attualmente in riproduzione vengono messe in pausa
4. Alla fine del combat → ripresa esatta dalla traccia e dal timestamp salvati

### Workflow Feature 2

1. Configura il **Tracked Resource** nel Combat Tracker core di Foundry (es. `attributes.hp.value`)
2. Configura il **Secondary Resource** nel Carousel di TheRipper93 (es. `attributes.ac.value`)
3. Personalizza i colori in Carousel: **Attribute Color** e **Secondary Attribute Color**
4. Apri il Combat Tracker standard → vedrai i valori accanto al nome del combatant, colorati come da Carousel

---

## Sviluppo

### Struttura

```
combat-tracker-companion/
├── module.json              # Manifest
├── scripts/
│   ├── main.js              # Entry point + helpers
│   ├── combat-music.js      # Feature 1
│   └── tracker-extras.js    # Feature 2
├── templates/
│   └── playlist-config.hbs  # Form configurazione playlist
├── styles/
│   └── module.css
├── lang/
│   ├── it.json
│   └── en.json
├── README.md
└── LICENSE
```

### Workflow di sviluppo locale

```bash
# Clona il repo dove preferisci
git clone https://github.com/cirskizzo/combat-tracker-companion.git
cd combat-tracker-companion

# Crea symlink alla cartella Foundry per dev veloce
ln -s "$(pwd)" "$HOME/Library/Application Support/FoundryVTT/Data/modules/combat-tracker-companion"

# Modifica i file con VS Code / Claude Code
code .

# Reload del modulo in Foundry: F5 (o Cmd+R)
```

### Debug

Apri DevTools in Foundry con `Cmd + Option + I` (Mac).

Tutti i log del modulo sono prefissati con `[combat-tracker-companion]` per filtrarli facilmente nella Console.

---

## Roadmap

- [x] v0.1.0 — MVP delle 2 feature
- [ ] v0.2.0 — Configurazione "tracked attributes" personalizzabile (oltre a quello di Carousel)
- [ ] v0.3.0 — Pop-up con preview della traccia che parte
- [ ] v1.0.0 — Polish, testing su sessione live, eventuale pubblicazione

---

## License

MIT — vedi [LICENSE](LICENSE).
