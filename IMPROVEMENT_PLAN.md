# Velvet PF2e Sheet — AAA UI/UX Audit & Improvement Plan

> Audit date: 2026-07-02 · Scope: elevate presentation to AAA quality **without** changing
> architecture, APIs, business logic, or Foundry/PF2e compatibility.

---

## Post-Royal regression fix — Paper Doll toggle (both sheets)

The Royal overhaul raised `.paperdoll-overlay.active`'s z-index (to sit above the hero
plate), which pushed it above the standalone `.paperdoll-toggle` corner icon (z-index 5).
Once opened, the overlay covered the button and it could no longer be clicked to close —
worse, the button's top-left position also visually collided with the first equipment
slot in the left column.

**Fix**: the toggle button now lives inside `.pd-actions`, next to "Unequip All", in the
paper doll's center column — a position that structurally cannot collide with the left/
right equipment slots (different column entirely) and is never covered by anything.
Since a parent's CSS opacity can't be "undone" by a child, `.paperdoll-overlay` itself
is now always laid out (never `display:none`); only the leaf equipment groups
(`.pd-gradient`, `.pd-col.pd-left`, `.pd-col.pd-right`, `.pd-bottom`, `.pd-unequip-all`)
fade in/out individually via opacity + pointer-events, while the action cluster stays
permanently visible and clickable. Applied identically to `pf2e-velvet-sheet` and
`dnd-velvet-sheets` (same shared paper-doll markup/CSS pattern in both).

---

## 1. Architecture Audit (current state)

| Area | State |
|---|---|
| Rendering | Foundry AppV1 `ActorSheet` + single Handlebars template (878 lines). Solid, keep. |
| Scripts | `velvet-sheet.mjs` (3,018 ln: sheet + sound system + hooks), `velvet-animations.mjs` (GSAP wrapper `VA`), `license-client.mjs` (Patreon gate). |
| CSS | One 5,897-line file, **three stacked theme layers**: base "Grim Dark" (1–4311), "AAA Polish Layer" (4312–4577), "Dark Souls" override (4578–5897). Later layers override earlier ones by cascade order. |
| Animation | GSAP timelines: entrance, tab switch, roll feedback, HP tween, ambient embers, level-up burst, heartbeat/blood system. Quality is already high. |
| Layout | 3-column flex: sidebar (180px) / portrait center (300px) / tabbed panel (flex). 8 tabs with manual JS tab switching. |
| Design tokens | Good `--velvet-*` custom-property palette on `.velvet-sheet`, plus a parallel `--ds-*` set in the DS layer. |

### Strengths to preserve
- Cohesive dark-fantasy identity (Cinzel + Crimson Text, gold-on-void palette).
- Heartbeat/blood/death portrait system — genuinely AAA, unique.
- Motion system centralized in `VA` with null-safe GSAP guards.
- PF2e-native integrations (statistics `.roll()`, `entry.cast()`, `rollItemMacro`, AttributeBuilder reuse, toggles mirroring the system sheet).

### Defects found (correctness)
1. **Blood overlay never loads** — template points at `modules/dnd-velvet-sheets/images/bloody.webp` (a different module's path). The entire persistent-blood HP feature is invisible.
2. **Currency inputs are broken** — bound to `name="system.details.pp.value"` etc. PF2e coins are treasure *items*; these paths write junk into actor data and never change coins. Must go through `actor.inventory.addCoins()/removeCoins()`.
3. **Initiative quick-box shows "Lvl X"** — labeled *Initiative* but displays character level; should show the initiative modifier.
4. **Double updates** — `level-input` and `ability-input` have both a `name` attribute (form submitOnChange) *and* a change handler calling `actor.update()`, causing two writes/renders per edit.

### Gaps found (UX / quality)
- **Responsiveness: none.** Zero `@media`/`@container` rules. At the 600px min-width the fixed 180px sidebar + 300px portrait crush the content panel.
- **Accessibility: minimal.** All interactive elements are `div`/`span` with click handlers — not keyboard reachable; no `:focus-visible` styles; no ARIA roles; no `prefers-reduced-motion` support (heavy GSAP + infinite ember particles always run).
- **No empty states** — an actor with no effects/spells/items renders blank voids or headers over empty grids.
- **No rarity color language** — `rarity` is already prepared in inventory data but never rendered; AAA RPG inventories live on rarity color.
- **CSS duplication** — e.g. `.level-input:focus` defined 3× across the three layers; many selectors restyled 2–3×. Works via cascade but is heavy debt.
- **Google Fonts `@import`** — external network dependency; sheet typography degrades entirely offline/air-gapped (common for Foundry).

---

## 2. Phased Improvement Plan

Every phase leaves the module fully working. One area at a time.

### Phase 1 — Correctness + Foundation (✅ done)
- Fix blood-overlay path, currency inputs (PF2e coin API), Initiative box (real modifier), double-update inputs.
- `prefers-reduced-motion`: CSS kill-switch + `VA` honors it (gsap getter returns null → all animations no-op safely).
- Keyboard access: `tabindex`/`role="button"` applied to interactive rows/pips at render, Enter/Space activation, gold `:focus-visible` ring.
- Rarity tokens (`--velvet-rarity-*`) + rarity ring/glow on inventory slots (uncommon/rare/unique).
- Handcrafted empty states for inventory categories, effects tab, spells tab.
- Container-query responsive layout: sidebar collapses to a 56px icon rail below ~860px sheet width; portrait column narrows below ~700px. Nothing clips at min size.

### Phase 2 — Component polish (✅ core items done)
- ✅ Typography scale tokens (`--velvet-fs-*`, line-heights) — defined; wider adoption ongoing.
- ✅ Pressed/disabled states normalized across buttons, filters, role="button" rows.
- ✅ Inventory hover card enriched: level · price · bulk meta line + traits, with PF2e-correct
  mystification (players see concealed name/rarity for unidentified items; GMs see all).
- ✅ Strikes: MAP buttons show real modifiers extracted from PF2e variant labels
  (respects agile −4/−8 automatically).
- ✅ Nav badge: live count of active (non-expired) effects on the Effects tab, rail-mode aware.
- ⏳ Deferred: CSS layer consolidation (needs in-Foundry visual regression pass),
  container nesting visualization, damage formula preview (PF2e exposes no cheap sync API).

### Phase 3 — Cinematic header & navigation (✅ done)
- ✅ Sidebar identity: level diamond emblem (rotated-square gold frame, editable, survives
  icon-rail mode as the identity marker).
- ✅ Attributes tab shows a pulsing amber alert dot when attribute boosts are unallocated.
- ✅ Quick search fields in Inventory / Spells / Feats — live client-side name filtering,
  query persists across re-renders, group headers dim while searching.
- ✅ Inventory tiles show a container badge when an item is stored inside a backpack/case.

### Phase 4 — Performance & packaging (✅ core done)
- ✅ Fonts self-hosted: 16 woff2 files (latin + latin-ext) in `fonts/`, declared in
  `styles/velvet-fonts.css`, loaded via `module.json`. Google Fonts `@import` removed —
  the sheet now renders identically offline.
- ✅ Ember particles: spawn skipped while the tab is hidden (prevents pile-up) and hard
  cap of 14 live particles.
- ⏳ Optional (needs in-Foundry visual regression pass first): consolidate the three CSS
  theme layers, split CSS into logical files, migrate box-shadow tweens to transform-only.

---

### Phase 5 — "Velvet Royal" full visual overhaul (✅ done)
A dedicated re-skin layer (R0–R20, ~650 lines, appended last so it owns the cascade)
that transforms the look of every component:
- **Cinematic hero plate** over the portrait: gradient-gold Cinzel Decorative name,
  ancestry/class/level subtitle, ornament flourish; auto-hides while the paper doll is open.
- **Proficiency rank colors** (trained azure / expert amethyst / master ember / legendary gold)
  applied to every `rank-*` element: save & skill gems, rank labels, class DC, selects — with glows.
- **Metalwork component language**: forged-metal gradients on quick-stat plates, ability
  medallions, filter pills (active = struck gold coin with dark engraving), strike buttons
  with a light-sweep shine on hover, jeweled inventory sockets with lift-on-hover.
- **Jeweled HP bar** (blood-red, glossy top light) and gold XP bar; retains the DS layer's
  angular clip and low-HP pulse.
- **Tradition-colored spellcasting entries** (arcane violet / divine gold / primal green /
  occult rose top rails + tinted labels) via `data-tradition`.
- **Engraved headers**: h2/h3 rebuilt with flanking gold rules and display typography,
  taking ownership from both earlier conflicting layers.
- **Global depth**: cathedral vignette on the sheet, filigree SVG corners on the content
  panel, gilded portrait top edge, colored condition-tracker omens, true-metal coin colors.

## 3. Design decisions of record
- **Container queries over media queries** — the sheet lives in a resizable Foundry window; viewport width is meaningless. `container-type: size` on `.dnd-sheet`.
- **Reduced motion via the `VA.gsap` getter** — one guard covers every animation because all `VA` methods already null-check gsap. Zero risk of half-animated states.
- **Attributes injected at render, not in template** — keeps the template diff minimal and guarantees a11y attrs exist even for conditionally rendered rows.
- **Rarity palette** follows PF2e convention (uncommon = ember orange, rare = sapphire, unique = royal purple) tuned for the dark-gold theme's contrast.
