# Velvet PF2e Sheet

Custom RPG-style character sheet for **Pathfinder 2e** and **Starfinder 2e** on Foundry VTT.  
Animated UI, parallax portrait effects, and a cinematic look designed to complement the VN Dialogues Enhanced module.

---

## Compatibility

| System | Status |
|--------|--------|
| Pathfinder 2e (`pf2e`) | ✅ Fully supported |
| Starfinder 2e (`starfinder2e`) | ✅ Tested & working |

**Foundry VTT:** v12 – v14

---

## Features

- Animated, game-inspired character sheet UI (GSAP + Anime.js)
- Parallax portrait with paper doll overlay
- Tab navigation: Attributes, Skills, Actions, Inventory, Spells, Feats, Biography, Effects
- Per-item sound effects system (strike sounds, damage sounds, critical sounds)
- Action image configuration for VN Combat overlay integration
- Full dark-themed aesthetic with golden filigree accents

---

## Requirements

| Requirement | Detail |
|---|---|
| Foundry VTT | **v12** minimum, **v13** verified. |
| Game system | **Pathfinder 2e** (`pf2e`) or **Starfinder 2e** (`starfinder2e`). |
| Subscription | An **active, qualifying Patreon** subscription to [GM RedVelvet](https://www.patreon.com/gmredvelvet), for as long as you use the module — see [Licensing](#licensing). Only the **GM** authorises; players never see a prompt. |
| Internet | Required while playing. The licence is verified periodically against a licence server. |

One subscription unlocks all the modules:
- [VN Dialogues Enhanced](https://github.com/gmredvelvet-rgb/vnd-enhanced)
- Velvet PF2e Sheet ← this module
- [AAA D&D Sheet](https://github.com/gmredvelvet-rgb/dnd-Velvet-sheet)
- [Velvet Mobile](https://github.com/gmredvelvet-rgb/velvet-mobile)

---

## Licensing

Velvet PF2e Sheet requires an active, qualifying **Patreon** subscription to [GM RedVelvet](https://www.patreon.com/gmredvelvet).

**Only the GM authorises.** On their first load the GM is prompted to connect their Patreon account, which unlocks the module for everyone in the world. Players never see a prompt and never need an account of their own. If popups are blocked — common on phones — use the **auth-code** flow instead: connect on any device, copy the code, and paste it in.

### What happens if the subscription lapses

**Please read this before subscribing.** This is a subscription, not a one-off purchase, and the module re-checks it periodically against a licence server. Plainly:

- **If the subscription lapses, the sheet locks.** It is covered by an activation panel and cannot be used until the subscription is active again.
- **Your characters are not locked.** The sheet is registered alongside the system's default one, never in place of it, so you can switch any actor back through *Sheet Configuration* and keep playing immediately.
- **Nothing is altered or lost.** Foundry, your world, your actors, your items and your settings are untouched — your characters remain ordinary PF2e actors, readable by every other module. No data is withheld and no content becomes unopenable. Resubscribing turns the sheet straight back on.
- **An internet connection is required while playing.** Verification is periodic, so a client that cannot reach the licence server locks the sheet until it can. Fully offline or air-gapped games are not supported.

If a perpetual licence is what you need, this is not that today. I would rather say so here than have anyone find out mid-campaign.

---

## Installation

Paste the manifest URL in Foundry's **Add-on Modules** installer:

```
https://raw.githubusercontent.com/gmredvelvet-rgb/pf2e-velvet-sheet/main/module.json
```

---

## FAQ

**Do my players need their own subscription?**
No. Only the GM authorises, and that unlocks the world for everyone connected.

**If I stop subscribing, do I lose my characters?**
No. Your actors are ordinary PF2e actors and are never modified. Only the sheet locks — switch back to the default sheet in *Sheet Configuration* and everything is there.

**Can I use it offline?**
No. The licence is verified periodically over the internet, and a client that cannot reach the licence server locks the sheet until it can.

**Does it work with Starfinder 2e?**
Yes. SF2e is a fork of PF2e that kept the data model whole, so the same sheet serves both.

---

## Author

**GM RedVelvet** · [Patreon](https://www.patreon.com/gmredvelvet) · Discord: `gmredvelvet`
