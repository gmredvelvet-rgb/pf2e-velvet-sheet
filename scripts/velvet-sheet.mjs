/**
 * Velvet PF2e Sheet — Foundry VTT Module
 * Custom RPG-style ActorSheet for Pathfinder 2e characters
 */

import VA from "./velvet-animations.mjs";

class VelvetCharacterSheet extends ActorSheet {

  /** Cached reference to PF2e's internal AttributeBuilder class */
  static _AttributeBuilderClass = null;

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["pf2e", "sheet", "actor", "velvet-sheet"],
      template: "modules/pf2e-velvet-sheet/templates/velvet-character-sheet.hbs",
      width: 900,
      height: 720,
      resizable: true,
      tabs: [],
      dragDrop: [{ dragSelector: "[data-item-id]", dropSelector: "" }],
      scrollY: [".velvet-panel .tab"]
    });
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const context = await super.getData(options);
    const actor = this.actor;
    const system = actor.system;

    context.system = system;
    context.flags = actor.flags;
    context.rollData = actor.getRollData();
    context.isEditable = this.isEditable;
    context.isOwner = actor.isOwner;

    // Abilities (str, dex, con, int, wis, cha)
    const ABILITY_LABELS = {
      str: { abbr: "STR", full: "Strength" },
      dex: { abbr: "DEX", full: "Dexterity" },
      con: { abbr: "CON", full: "Constitution" },
      int: { abbr: "INT", full: "Intelligence" },
      wis: { abbr: "WIS", full: "Wisdom" },
      cha: { abbr: "CHA", full: "Charisma" }
    };
    context.abilities = {};
    for (const [key, labels] of Object.entries(ABILITY_LABELS)) {
      const ability = system.abilities?.[key];
      if (!ability) continue;
      const mod = ability.mod ?? 0;
      context.abilities[key] = {
        key,
        label: labels.abbr,
        fullLabel: labels.full,
        value: ability.value ?? (10 + mod * 2),
        mod,
        modStr: (mod >= 0 ? "+" : "") + mod
      };
    }

    // HP
    const hp = system.attributes?.hp ?? {};
    context.hp = {
      value: hp.value ?? 0,
      max: hp.max ?? 0,
      temp: hp.temp ?? 0,
      pct: hp.max > 0 ? Math.clamp(Math.round((hp.value / hp.max) * 100), 0, 100) : 0
    };

    // Dying / Wounded / Doomed
    const dying = system.attributes?.dying ?? {};
    context.dying = {
      value: dying.value ?? 0,
      max: dying.max ?? 4,
      pips: Array.from({ length: dying.max ?? 4 }, (_, i) => ({ filled: i < (dying.value ?? 0), index: i }))
    };
    const wounded = system.attributes?.wounded ?? {};
    context.wounded = {
      value: wounded.value ?? 0,
      max: wounded.max ?? 3,
      pips: Array.from({ length: wounded.max ?? 3 }, (_, i) => ({ filled: i < (wounded.value ?? 0), index: i }))
    };
    const doomed = system.attributes?.doomed ?? {};
    context.doomed = {
      value: doomed.value ?? 0,
      max: doomed.max ?? 3,
      pips: Array.from({ length: doomed.max ?? 3 }, (_, i) => ({ filled: i < (doomed.value ?? 0), index: i }))
    };

    // AC
    context.ac = system.attributes?.ac?.value ?? "—";

    // Speed
    context.speed = {
      land: system.attributes?.speed?.value ?? 0,
      otherSpeeds: (system.attributes?.speed?.otherSpeeds ?? []).map(s => ({
        type: s.type,
        label: s.type.charAt(0).toUpperCase() + s.type.slice(1),
        value: s.total ?? s.value ?? 0
      }))
    };

    // Perception
    const perception = system.perception ?? actor.perception ?? {};
    context.perception = {
      mod: perception.mod ?? perception.totalModifier ?? 0,
      rank: perception.rank ?? 0,
      rankLabel: this._rankLabel(perception.rank ?? 0)
    };
    context.perceptionStr = ((context.perception.mod >= 0) ? "+" : "") + context.perception.mod;

    // Level
    context.level = system.details?.level?.value ?? 0;

    // Class / Ancestry / Heritage / Background
    context.className = actor.class?.name ?? system.details?.class?.name ?? "—";
    context.ancestryName = actor.ancestry?.name ?? system.details?.ancestry?.name ?? "—";
    context.heritageName = actor.heritage?.name ?? system.details?.heritage?.name ?? "";
    context.backgroundName = actor.background?.name ?? "—";

    // Key Ability
    context.keyAbility = system.details?.keyability?.value ?? "—";

    // Manual attribute mode
    context.isManualMode = system.build?.attributes?.manual ?? false;

    // Attribute boosts allocated check
    context.attributeBoostsAllocated = (() => {
      const build = system.build;
      if (!build?.attributes || build.attributes.manual) return true;
      const allowedBoosts = build.attributes.allowedBoosts ?? {};
      const boosts = build.attributes.boosts ?? {};
      for (const level of [1, 5, 10, 15, 20]) {
        const allowed = allowedBoosts[level] ?? 0;
        const selected = boosts[level]?.length ?? 0;
        if (allowed > selected) return false;
      }
      return true;
    })();

    // Hero Points
    const heroPoints = system.resources?.heroPoints ?? { value: 0, max: 3 };
    context.heroPoints = {
      value: heroPoints.value ?? 0,
      max: heroPoints.max ?? 3,
      pips: [1, 2, 3].map(n => ({ filled: n <= (heroPoints.value ?? 0), index: n }))
    };

    // Focus Points
    const focus = system.resources?.focus ?? { value: 0, max: 0 };
    context.focusPoints = {
      value: focus.value ?? 0,
      max: focus.max ?? 0,
      hasFocus: (focus.max ?? 0) > 0,
      pips: Array.from({ length: focus.max ?? 0 }, (_, i) => ({ filled: i < (focus.value ?? 0), index: i }))
    };

    // XP
    const xp = system.details?.xp ?? { value: 0, max: 1000 };
    context.xp = { value: xp.value ?? 0, max: xp.max ?? 1000 };
    context.xpPct = context.xp.max > 0 ? Math.round((context.xp.value / context.xp.max) * 100) : 0;

    // Saves (Fortitude, Reflex, Will)
    context.saves = this._prepareSaves(system);

    // Skills
    context.skills = this._prepareSkills(system, actor);

    // Inventory
    context.inventory = this._prepareInventory(actor);

    // Spellcasting
    context.spellcasting = this._prepareSpellcasting(actor);

    // Feats / Features / Actions
    context.feats = this._prepareFeats(actor);
    context.actions = this._prepareActions(actor);

    // Toggles (Raise a Shield, Parry, Sniper Aim, Taunt, etc.)
    context.toggles = this._prepareToggles(actor);

    // Exploration Activities
    context.explorationActivities = this._prepareExplorationActivities(actor);

    // Effects / Conditions
    context.effects = this._prepareEffects(actor);

    // Currency (PF2e uses coins object on inventory)
    const coins = actor.inventory?.coins ?? {};
    context.currency = {
      pp: coins.pp ?? 0,
      gp: coins.gp ?? 0,
      sp: coins.sp ?? 0,
      cp: coins.cp ?? 0
    };

    // Custom background image flag
    context.bgImage = actor.getFlag("pf2e-velvet-sheet", "bgImage") ?? "";
    context.bgOpacity = actor.getFlag("pf2e-velvet-sheet", "bgOpacity") ?? 80;

    // Biography
    const bio = system.details?.biography ?? {};
    context.biography = {
      appearance: await TextEditor.enrichHTML(bio.appearance ?? "", { secrets: actor.isOwner, async: true, relativeTo: actor }),
      backstory: await TextEditor.enrichHTML(bio.backstory ?? "", { secrets: actor.isOwner, async: true, relativeTo: actor }),
      campaignNotes: await TextEditor.enrichHTML(bio.campaignNotes ?? "", { secrets: actor.isOwner, async: true, relativeTo: actor }),
      allies: await TextEditor.enrichHTML(bio.allies ?? "", { secrets: actor.isOwner, async: true, relativeTo: actor }),
      enemies: await TextEditor.enrichHTML(bio.enemies ?? "", { secrets: actor.isOwner, async: true, relativeTo: actor }),
      organizations: await TextEditor.enrichHTML(bio.organizations ?? "", { secrets: actor.isOwner, async: true, relativeTo: actor })
    };
    context.bioDetails = {
      age: bio.age?.value ?? system.details?.age?.value ?? "",
      height: bio.height?.value ?? system.details?.height?.value ?? "",
      weight: bio.weight?.value ?? system.details?.weight?.value ?? "",
      gender: bio.gender?.value ?? system.details?.gender?.value ?? "",
      ethnicity: bio.ethnicity?.value ?? system.details?.ethnicity?.value ?? "",
      nationality: bio.nationality?.value ?? system.details?.nationality?.value ?? "",
      birthPlace: bio.birthPlace ?? ""
    };

    // Senses
    const senses = actor.perception?.senses?.contents ?? system.perception?.senses ?? [];
    context.senses = senses.map(s => ({
      label: s.label ?? s.type ?? "Unknown",
      acuity: s.acuity ?? "",
      range: s.range ?? null
    }));

    // Resistances, Immunities, Weaknesses
    context.immunities = (system.attributes?.immunities ?? []).map(i => i.label ?? i.type ?? "");
    context.resistances = (system.attributes?.resistances ?? []).map(r => `${r.label ?? r.type ?? ""} ${r.value ?? ""}`);
    context.weaknesses = (system.attributes?.weaknesses ?? []).map(w => `${w.label ?? w.type ?? ""} ${w.value ?? ""}`);

    // Languages
    const languages = system.details?.languages?.value ?? [];
    context.languages = languages.map(l => {
      const cfg = CONFIG.PF2E?.languages?.[l];
      const raw = typeof cfg === "string" ? cfg : (cfg?.label ?? l);
      return game.i18n.localize(raw);
    });

    // Bulk / Encumbrance
    const bulk = actor.inventory?.bulk ?? {};
    context.bulk = {
      value: bulk.value?.normal ?? 0,
      encumberedAt: bulk.encumberedAt ?? 0,
      max: bulk.max ?? 0,
      pct: (bulk.max ?? 0) > 0 ? Math.clamp(Math.round(((bulk.value?.normal ?? 0) / (bulk.max ?? 0)) * 100), 0, 100) : 0,
      isEncumbered: bulk.isEncumbered ?? false
    };

    // Class / Ancestry / Heritage / Background items
    context.classItem = actor.class ? { id: actor.class.id, name: actor.class.name, img: actor.class.img } : null;
    context.ancestryItem = actor.ancestry ? { id: actor.ancestry.id, name: actor.ancestry.name, img: actor.ancestry.img } : null;
    context.heritageItem = actor.heritage ? { id: actor.heritage.id, name: actor.heritage.name, img: actor.heritage.img } : null;
    context.backgroundItem = actor.background ? { id: actor.background.id, name: actor.background.name, img: actor.background.img } : null;
    context.deityItem = actor.deity ? { id: actor.deity.id, name: actor.deity.name, img: actor.deity.img } : null;

    // Whether the portrait is a video file (WEBM, MP4, OGG) — needs <video> tag instead of <img>
    context.portraitIsVideo = /\.(webm|mp4|ogg)$/i.test(actor.img ?? "");

    // Proficiencies (attacks, defenses, class DCs, spellcasting)
    context.proficiencies = this._prepareProficiencies(system, actor);

    // Class DC (primary)
    const classDCs = system.proficiencies?.classDCs ?? {};
    const primaryClassDC = Object.values(classDCs).find(dc => dc?.primary) ?? Object.values(classDCs)[0];
    if (primaryClassDC && primaryClassDC.rank > 0) {
      context.classDC = {
        label: primaryClassDC.label ?? context.className ?? "Class DC",
        value: primaryClassDC.dc ?? primaryClassDC.value ?? 0,
        rank: primaryClassDC.rank ?? 0,
        rankLabel: this._rankLabel(primaryClassDC.rank ?? 0)
      };
    } else {
      context.classDC = null;
    }

    // Strikes
    context.strikes = this._prepareStrikes(actor);

    // Paper Doll
    context.paperDoll = this._preparePaperDoll(actor);

    return context;
  }

  /* -------------------------------------------- */
  /*  Heartbeat Portrait Overlay                  */
  /* -------------------------------------------- */

  /** Blood stain images for splatter effect */
  static BLOOD_IMAGES = Array.from({ length: 11 }, (_, i) =>
    `modules/pf2e-velvet-sheet/images/BloodStains/Blood_${String(i + 1).padStart(2, "0")}.png`
  );

  /** Sound paths */
  static HEARTBEAT_SFX = "modules/pf2e-velvet-sheet/sounds/heartbeat_sfx.mp3";
  static MASSIVE_DAMAGE_SFX = "modules/pf2e-velvet-sheet/sounds/ear_ringing_sfx.mp3";

  /** Active heartbeat sound reference (shared across renders) */
  _heartbeatSound = null;

  /**
   * Set up the heartbeat blood overlay on the portrait.
   * Tracks HP changes and shows blood overlay, damage flash, splatters, and sounds.
   */
  _setupHeartbeatOverlay(html) {
    const actor = this.actor;
    const hp = actor.system.attributes?.hp;
    if (!hp || !hp.max) return;

    const pct = hp.value / hp.max; // 1 = full, 0 = dead
    const portraitWrap = html.find(".portrait-wrap");
    const bloodOverlay = html.find(".velvet-blood-overlay");
    const damageFlash = html.find(".velvet-damage-flash");
    const splatterContainer = html.find(".velvet-splatter-container");

    // ── Persistent blood overlay (scales with missing HP) ──
    const startThreshold = 0.5;
    if (pct < startThreshold && pct > 0) {
      const intensity = Math.min(0.55, (1 - pct / startThreshold) * 0.55);
      bloodOverlay.css("opacity", intensity);
    } else if (pct <= 0) {
      bloodOverlay.css("opacity", 0.7);
    } else {
      bloodOverlay.css("opacity", 0);
    }

    // ── Heartbeat pulse at very low HP (≤15%) ──
    if (pct > 0 && pct <= 0.15) {
      bloodOverlay.addClass("heartbeat-pulse");
    } else {
      bloodOverlay.removeClass("heartbeat-pulse");
    }

    // ── Death state (0 HP) ──
    if (pct <= 0) {
      portraitWrap.addClass("velvet-death");
    } else {
      portraitWrap.removeClass("velvet-death");
    }

    // ── Heartbeat Sound (loop while HP ≤ 15%) ──
    this._updateHeartbeatSound(pct);

    // ── Damage flash + splatters on HP change ──
    const prevHP = this._velvetPrevHP;
    this._velvetPrevHP = hp.value;

    if (prevHP !== undefined && prevHP !== hp.value) {
      const delta = hp.value - prevHP;

      // Flash color
      if (delta < 0) {
        damageFlash.css("background", "radial-gradient(circle, rgba(255,255,255,0%) 20%, rgba(145,0,0,0.8) 100%)");
      } else {
        damageFlash.css("background", "radial-gradient(circle, rgba(255,255,255,0%) 20%, rgba(0,145,25,0.7) 100%)");
      }

      // Trigger flash animation
      damageFlash.removeClass("flash-active");
      void damageFlash[0]?.offsetWidth;
      damageFlash.addClass("flash-active");

      // Portrait shake on damage
      if (delta < 0) {
        portraitWrap.removeClass("velvet-shake");
        void portraitWrap[0]?.offsetWidth;
        portraitWrap.addClass("velvet-shake");
        setTimeout(() => portraitWrap.removeClass("velvet-shake"), 400);
      }

      // Blood splatters on significant damage (≥20% of max HP lost)
      if (delta < 0) {
        const damagePct = Math.abs(delta) / hp.max;
        if (damagePct >= 0.2) {
          this._spawnPortraitSplatter(splatterContainer);
        }
        // Extra splatters + ear ringing on massive damage or death
        if (damagePct >= 0.5 || hp.value <= 0) {
          this._spawnPortraitSplatter(splatterContainer);
          this._spawnPortraitSplatter(splatterContainer);
          this._playMassiveDamageSound();
        }
      }
    }
  }

  /**
   * Start or stop the looping heartbeat sound based on HP percentage.
   */
  _updateHeartbeatSound(pct) {
    const shouldPlay = pct > 0 && pct <= 0.15;

    if (shouldPlay && !this._heartbeatSound) {
      // Start looping heartbeat
      const src = VelvetCharacterSheet.HEARTBEAT_SFX;
      foundry.audio.AudioHelper.play({ src, volume: 0.15, loop: true, autoplay: true }, false).then(sound => {
        this._heartbeatSound = sound;
      });
    } else if (!shouldPlay && this._heartbeatSound) {
      // Stop heartbeat
      this._heartbeatSound.stop();
      this._heartbeatSound = null;
    }
  }

  /**
   * Play the massive damage / ear ringing sound once.
   */
  _playMassiveDamageSound() {
    foundry.audio.AudioHelper.play({
      src: VelvetCharacterSheet.MASSIVE_DAMAGE_SFX,
      volume: 0.08,
      loop: false,
      autoplay: true
    }, false);
  }

  /**
   * Spawn a random blood splatter image on the portrait.
   */
  _spawnPortraitSplatter(container) {
    if (!container.length) return;
    const images = VelvetCharacterSheet.BLOOD_IMAGES;
    const src = images[Math.floor(Math.random() * images.length)];

    const img = document.createElement("img");
    img.src = src;

    // Random position within portrait
    const x = Math.random() * 60 + 5;  // 5-65%
    const y = Math.random() * 60 + 10; // 10-70%
    const rotation = Math.random() * 360;
    const scale = 0.4 + Math.random() * 0.8;

    img.style.left = `${x}%`;
    img.style.top = `${y}%`;
    img.style.transform = `rotate(${rotation}deg) scale(${scale})`;
    img.style.opacity = "1";
    img.style.width = "120px";
    img.style.height = "120px";

    container[0].appendChild(img);

    // Fade out and remove after 20 seconds
    setTimeout(() => { img.style.opacity = "0"; }, 100);
    setTimeout(() => { img.remove(); }, 20000);
  }

  /* -------------------------------------------- */

  _prepareSaves(system) {
    const SAVE_MAP = {
      fortitude: { label: "Fortitude", short: "Fort" },
      reflex: { label: "Reflex", short: "Ref" },
      will: { label: "Will", short: "Will" }
    };
    const saves = [];
    for (const [key, labels] of Object.entries(SAVE_MAP)) {
      const save = system.saves?.[key];
      if (!save) continue;
      const mod = save.mod ?? save.totalModifier ?? save.value ?? 0;
      saves.push({
        key,
        label: labels.label,
        short: labels.short,
        mod,
        modStr: (mod >= 0 ? "+" : "") + mod,
        rank: save.rank ?? 0,
        rankLabel: this._rankLabel(save.rank ?? 0)
      });
    }
    return saves;
  }

  /* -------------------------------------------- */

  _prepareSkills(system, actor) {
    const skills = [];
    const systemSkills = system.skills ?? {};
    for (const [key, skill] of Object.entries(systemSkills)) {
      const mod = skill.mod ?? skill.totalModifier ?? skill.value ?? 0;
      const label = skill.label ?? CONFIG.PF2E?.skills?.[key]?.label ?? key;
      skills.push({
        key,
        label: typeof label === "string" ? label : key,
        mod,
        modStr: (mod >= 0 ? "+" : "") + mod,
        rank: skill.rank ?? 0,
        rankLabel: this._rankLabel(skill.rank ?? 0),
        attribute: skill.attribute ?? skill.ability ?? "",
        lore: skill.lore ?? false,
        armor: skill.armor ?? false
      });
    }
    return skills.sort((a, b) => a.label.localeCompare(b.label));
  }

  /* -------------------------------------------- */

  _prepareInventory(actor) {
    const inventory = {
      weapons: { label: "Weapons", type: "weapon", items: [] },
      armor: { label: "Armor", type: "armor", items: [] },
      shields: { label: "Shields", type: "shield", items: [] },
      equipment: { label: "Equipment", type: "equipment", items: [] },
      consumables: { label: "Consumables", type: "consumable", items: [] },
      ammo: { label: "Ammo", type: "ammo", items: [] },
      treasure: { label: "Treasure", type: "treasure", items: [] },
      books: { label: "Books", type: "book", items: [] },
      containers: { label: "Containers", type: "backpack", items: [] }
    };

    for (const item of actor.items) {
      if (!["weapon", "armor", "shield", "equipment", "consumable", "ammo", "treasure", "book", "backpack"].includes(item.type)) continue;
      const ctx = {
        id: item.id,
        name: item.name,
        img: item.img,
        type: item.type,
        quantity: item.system.quantity ?? 1,
        bulk: item.system.bulk?.value ?? "—",
        equipped: item.isEquipped ?? item.system.equipped?.carryType === "worn" ?? false,
        invested: item.isInvested ?? false,
        isInvestable: item.isInvested !== null && item.isInvested !== undefined,
        identified: item.system.identification?.status !== "unidentified",
        rarity: item.system.traits?.rarity ?? "common",
        uses: item.system.uses ?? null,
        price: item.system.price?.value?.gp ?? 0,
        hasSound: _velvetItemHasSound(actor, item) || !!(item.getFlag("pf2e-velvet-sheet", "soundTrack"))
      };

      switch (item.type) {
        case "weapon": inventory.weapons.items.push(ctx); break;
        case "armor": inventory.armor.items.push(ctx); break;
        case "shield": inventory.shields.items.push(ctx); break;
        case "equipment": inventory.equipment.items.push(ctx); break;
        case "consumable": inventory.consumables.items.push(ctx); break;
        case "ammo": inventory.ammo.items.push(ctx); break;
        case "treasure": inventory.treasure.items.push(ctx); break;
        case "book": inventory.books.items.push(ctx); break;
        case "backpack": inventory.containers.items.push(ctx); break;
      }
    }
    return inventory;
  }

  /* -------------------------------------------- */

  _prepareSpellcasting(actor) {
    const entries = [];
    for (const item of actor.items) {
      if (item.type !== "spellcastingEntry") continue;
      const spells = [];
      for (const spell of actor.items) {
        if (spell.type !== "spell") continue;
        const loc = spell.system.location?.value;
        if (loc !== item.id) continue;
        spells.push({
          id: spell.id,
          name: spell.name,
          img: spell.img,
          level: spell.level ?? spell.system.level?.value ?? 0,
          rank: spell.rank ?? spell.system.level?.value ?? 0,
          traits: (spell.system.traits?.value ?? []).join(", "),
          isFocus: spell.system.category?.value === "focus",
          isCantrip: spell.isCantrip ?? spell.system.level?.value === 0,
          hasSound: _velvetItemHasSound(actor, spell) || !!(spell.getFlag("pf2e-velvet-sheet", "soundTrack"))
        });
      }
      spells.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

      // Group spells by rank (focus spells get their own group keyed as "focus")
      const byRank = {};
      for (const sp of spells) {
        const r = sp.isFocus ? "focus" : (sp.isCantrip ? 0 : sp.rank);
        if (!byRank[r]) byRank[r] = {
          rank: r,
          label: r === "focus" ? "Focus" : (r === 0 ? "Cantrips" : `Rank ${r}`),
          spells: []
        };
        byRank[r].spells.push(sp);
      }

      // Spell slots
      const slotData = item.system.slots ?? {};
      const slots = [];
      for (let i = 1; i <= 10; i++) {
        const key = `slot${i}`;
        const slot = slotData[key];
        if (slot && slot.max > 0) {
          const pips = [];
          for (let p = 0; p < slot.max; p++) {
            pips.push({ filled: p < (slot.value ?? 0), index: p });
          }
          slots.push({ rank: i, key, value: slot.value ?? 0, max: slot.max, pips, label: `Rank ${i}` });
        }
      }

      // Preparation grid for prepared casters
      const isPrepared = item.system.prepared?.value === "prepared";
      const isFlexible = isPrepared && !!item.system.prepared?.flexible;
      const prepGrid = [];
      if (isPrepared && !isFlexible) {
        for (let i = 0; i <= 10; i++) {
          const key = `slot${i}`;
          const slotInfo = slotData[key];
          if (!slotInfo || (i > 0 && (slotInfo.max ?? 0) === 0)) continue;
          // For cantrips (slot0), max might be 0 but prepared might have entries
          const preparedArr = slotInfo.prepared ?? [];
          if (i === 0 && preparedArr.length === 0 && (slotInfo.max ?? 0) === 0) continue;
          const prepSlots = [];
          const count = i === 0 ? preparedArr.length : (slotInfo.max ?? 0);
          for (let s = 0; s < count; s++) {
            const p = preparedArr[s];
            const spellItem = p?.id ? actor.items.get(p.id) : null;
            prepSlots.push({
              slotIndex: s,
              spellId: p?.id ?? null,
              expended: i === 0 ? false : (p?.expended ?? false),
              isCantrip: i === 0,
              name: spellItem?.name ?? null,
              img: spellItem?.img ?? null,
              empty: !p?.id,
              hasSound: (spellItem ? _velvetItemHasSound(actor, spellItem) : false) || !!(spellItem?.getFlag?.("pf2e-velvet-sheet", "soundTrack") || spellItem?.getFlag?.("pf2e-velvet-sheet", "sounds"))
            });
          }
          prepGrid.push({
            rank: i,
            key,
            label: i === 0 ? "Cantrips" : `Rank ${i}`,
            slots: prepSlots
          });
        }
      }

      entries.push({
        id: item.id,
        name: item.name,
        tradition: item.system.tradition?.value ?? "",
        type: item.system.prepared?.value ?? "spontaneous",
        isPrepared,
        isFlexible,
        dc: item.system.spelldc?.dc ?? item.statistic?.dc?.value ?? "—",
        attack: item.system.spelldc?.value ?? item.statistic?.check?.mod ?? "—",
        attackStr: typeof (item.statistic?.check?.mod) === "number"
          ? ((item.statistic.check.mod >= 0 ? "+" : "") + item.statistic.check.mod)
          : "—",
        spellsByRank: Object.values(byRank).sort((a, b) => {
          if (a.rank === "focus") return 1;
          if (b.rank === "focus") return -1;
          return a.rank - b.rank;
        }),
        availableRanks: Object.keys(byRank).sort((a, b) => {
          if (a === "focus") return 1;
          if (b === "focus") return -1;
          return Number(a) - Number(b);
        }),
        slots,
        hasSlots: slots.length > 0,
        prepGrid,
        hasPrepGrid: prepGrid.length > 0
      });
    }
    return entries;
  }

  /* -------------------------------------------- */

  _prepareFeats(actor) {
    const feats = {
      ancestry: { label: "Ancestry Feats", items: [] },
      class: { label: "Class Feats", items: [] },
      skill: { label: "Skill Feats", items: [] },
      general: { label: "General Feats", items: [] },
      bonus: { label: "Bonus Feats", items: [] }
    };

    for (const item of actor.items) {
      if (item.type !== "feat") continue;
      const ctx = {
        id: item.id,
        name: item.name,
        img: item.img,
        level: item.system.level?.value ?? 0,
        traits: (item.system.traits?.value ?? []).join(", "),
        actionCost: item.system.actionType?.value ?? item.actionCost?.type ?? "",
        description: item.system.description?.value ?? "",
        uses: item.system.frequency ?? null,
        category: item.system.category ?? "bonus",
        hasSound: _velvetItemHasSound(actor, item) || !!(item.getFlag("pf2e-velvet-sheet", "soundTrack"))
      };

      switch (ctx.category) {
        case "ancestry":
        case "ancestryfeature": feats.ancestry.items.push(ctx); break;
        case "class":
        case "classfeature": feats.class.items.push(ctx); break;
        case "skill": feats.skill.items.push(ctx); break;
        case "general": feats.general.items.push(ctx); break;
        default: feats.bonus.items.push(ctx); break;
      }
    }
    return feats;
  }

  /* -------------------------------------------- */

  _prepareActions(actor) {
    const actions = {
      actions: { label: "Actions", items: [] },
      reactions: { label: "Reactions", items: [] },
      free: { label: "Free Actions", items: [] }
    };

    for (const item of actor.items) {
      // Mirror PF2e's #prepareAbilities(): include action-type items and feats
      // that have an actionCost (i.e. not passive). Use item.actionCost which is
      // the authoritative PF2e getter — it returns null for passive items.
      const isAction = item.type === "action";
      const isFeatWithCost = item.type === "feat" && !!item.actionCost;
      if (!isAction && !isFeatWithCost) continue;

      // Skip items suppressed by conditions or rule elements
      if (item.suppressed) continue;

      // Items with "exploration" or "downtime" traits are shown in their own
      // dedicated sections — don't duplicate them here in the encounter section.
      const traits = item.system.traits?.value ?? [];
      if (traits.includes("exploration") || traits.includes("downtime")) continue;

      // Determine the action cost type using the PF2e API getter.
      // Falls back to "free" when not set (matches PF2e's own behaviour).
      const actionCostType = item.actionCost?.type ?? "free";

      // Frequency data (e.g. 1/day, 1/turn) – used for usage tracking in the UI.
      const freq = item.system.frequency ?? null;
      const frequency = freq ? {
        value: freq.value ?? freq.max ?? 0,
        max:   freq.max ?? 0,
        per:   freq.per ?? "",
        label: _velvetFrequencyLabel(freq)
      } : null;

      // "usable" means the item should show a prominent USE button rather than
      // just a passive roll icon (mirrors PF2e's createAbilityViewData logic).
      const usable = !!(item.system.selfEffect || freq || item.crafting);

      const ctx = {
        id: item.id,
        name: item.name,
        img: item.img,
        actionType: actionCostType,
        actionCost: actionCostType,
        actions: item.actionCost?.value ?? null,
        traits: traits.join(", "),
        description: item.system.description?.value ?? "",
        frequency,
        usable,
        hasSound: _velvetItemHasSound(actor, item) || !!(item.getFlag("pf2e-velvet-sheet", "soundTrack"))
      };

      if (actionCostType === "reaction") {
        actions.reactions.items.push(ctx);
      } else if (actionCostType === "free") {
        actions.free.items.push(ctx);
      } else {
        actions.actions.items.push(ctx);
      }
    }

    // Sort each bucket alphabetically (matches PF2e standard sheet ordering)
    for (const bucket of Object.values(actions)) {
      bucket.items.sort((a, b) => a.name.localeCompare(b.name));
    }

    return actions;
  }

  /* -------------------------------------------- */

  /**
   * Prepare PF2e system toggles (Raise a Shield, Parry, Sniper Aim, Taunt, etc.)
   * These are auto-generated by PF2e based on equipped items, feats, and class features.
   */
  _prepareToggles(actor) {
    // actor.synthetics.toggles is { domain: { option: RollOptionToggle } }
    // Flatten all toggles and filter to only those with placement "actions"
    const synthToggles = actor.synthetics?.toggles ?? {};
    const all = Object.values(synthToggles).flatMap(domain => Object.values(domain));
    return all
      .filter(t => (t.placement ?? "actions") === "actions")
      .map(t => ({
        domain: t.domain ?? "",
        option: t.option ?? "",
        itemId: t.itemId ?? null,
        placement: t.placement ?? "actions",
        label: t.label ?? t.option ?? "Toggle",
        checked: t.checked ?? false,
        enabled: t.enabled ?? true,
        alwaysActive: t.alwaysActive ?? false,
        suboptions: (t.suboptions ?? []).map(s => ({
          label: s.label,
          value: s.value,
          selected: s.selected ?? false
        }))
      }));
  }

  /* -------------------------------------------- */

  /**
   * Prepare exploration activities available to the character.
   * In PF2e, these are action items with the "exploration" trait.
   * Active exploration activities are stored in actor.system.exploration.
   */
  _prepareExplorationActivities(actor) {
    const activeIds = actor.system.exploration ?? [];
    const activities = [];
    for (const item of actor.items) {
      const traits = item.system.traits?.value ?? [];
      if (!traits.includes("exploration")) continue;
      activities.push({
        id: item.id,
        name: item.name,
        img: item.img,
        active: activeIds.includes(item.id)
      });
    }
    return activities.sort((a, b) => a.name.localeCompare(b.name));
  }

  /* -------------------------------------------- */

  _prepareEffects(actor) {
    const effects = [];
    for (const effect of actor.items) {
      if (!["effect", "condition"].includes(effect.type)) continue;
      effects.push({
        id: effect.id,
        name: effect.name,
        img: effect.img,
        type: effect.type,
        isExpired: effect.isExpired ?? false,
        badge: effect.badge?.value ?? null,
        duration: effect.system.duration?.value ?? null
      });
    }
    // Also add ActiveEffects
    for (const ae of actor.effects) {
      effects.push({
        id: ae.id,
        name: ae.name,
        img: ae.img,
        type: "activeEffect",
        isExpired: ae.disabled,
        badge: null,
        duration: null
      });
    }
    return effects;
  }

  /* -------------------------------------------- */

  _prepareProficiencies(system, actor) {
    const profs = { attacks: [], defenses: [], classDCs: [], spellcasting: null };

    // Attack proficiencies
    const attacks = system.proficiencies?.attacks ?? {};
    for (const [key, atk] of Object.entries(attacks)) {
      if (!atk || atk.rank === 0) continue;
      profs.attacks.push({
        key,
        label: atk.label ?? key,
        rank: atk.rank ?? 0,
        rankLabel: this._rankLabel(atk.rank ?? 0),
        value: atk.value ?? 0
      });
    }

    // Defense proficiencies
    const defenses = system.proficiencies?.defenses ?? {};
    for (const [key, def] of Object.entries(defenses)) {
      if (!def || def.rank === 0) continue;
      profs.defenses.push({
        key,
        label: def.label ?? key,
        rank: def.rank ?? 0,
        rankLabel: this._rankLabel(def.rank ?? 0),
        value: def.value ?? 0
      });
    }

    // Class DCs
    const classDCs = system.proficiencies?.classDCs ?? {};
    for (const [key, dc] of Object.entries(classDCs)) {
      if (!dc || dc.rank === 0) continue;
      profs.classDCs.push({
        key,
        label: dc.label ?? key,
        rank: dc.rank ?? 0,
        rankLabel: this._rankLabel(dc.rank ?? 0),
        value: dc.value ?? 0
      });
    }

    // Spellcasting proficiency
    const sc = system.proficiencies?.spellcasting;
    if (sc && sc.rank > 0) {
      profs.spellcasting = {
        rank: sc.rank ?? 0,
        rankLabel: this._rankLabel(sc.rank ?? 0),
        value: sc.value ?? 0
      };
    }

    return profs;
  }

  /* -------------------------------------------- */

  _prepareStrikes(actor) {
    const strikes = actor.system.actions ?? [];
    return strikes.map((s, idx) => {
      // Ammunition data
      const ammo = s.ammunition ?? null;
      const selectedAmmoId = s.item?.system?.selectedAmmoId ?? null;
      let compatibleAmmo = [];
      if (ammo?.compatible) {
        compatibleAmmo = ammo.compatible.map(a => {
          const item = actor.items.get(typeof a === "string" ? a : a.id);
          return item ? {
            id: item.id,
            name: item.name,
            quantity: item.system.quantity ?? 1,
            selected: item.id === selectedAmmoId
          } : null;
        }).filter(Boolean);
      }
      return {
        label: s.label ?? "Strike",
        img: s.item?.img ?? "icons/svg/sword.svg",
        totalModifier: s.totalModifier ?? 0,
        modStr: ((s.totalModifier ?? 0) >= 0 ? "+" : "") + (s.totalModifier ?? 0),
        traits: (s.weaponTraits ?? s.traits ?? []).map(t => t.label ?? t.name ?? t).join(", "),
        ready: s.ready ?? true,
        slug: s.slug ?? "",
        index: idx,
        hasAmmo: compatibleAmmo.length > 0,
        selectedAmmoId,
        compatibleAmmo,
        weaponId: s.item?.id ?? null,
        hasSound: (() => {
          if (!s.item) return false;
          // Check actor-level storage first
          if (_velvetItemHasSound(actor, s.item)) return true;
          // Legacy fallback: check item flags
          if (!s.item.getFlag) return false;
          const sounds = s.item.getFlag("pf2e-velvet-sheet", "sounds");
          if (sounds) return Object.values(sounds).some(c => c?.playlist && c?.track);
          return !!(s.item.getFlag("pf2e-velvet-sheet", "soundTrack"));
        })()
      };
    });
  }

  /* -------------------------------------------- */

  _preparePaperDoll(actor) {
    const SLOT_DEFS = {
      head:     { label: "Head",      img: "icons/equipment/head/helm-barbute-engraved-steel.webp",     filter: ["armor", "equipment"] },
      cape:     { label: "Cape",      img: "icons/equipment/back/cape-layered-red.webp",                filter: ["equipment"] },
      body:     { label: "Body",      img: "icons/equipment/chest/breastplate-layered-steel.webp",      filter: ["armor", "equipment"] },
      gloves:   { label: "Gloves",    img: "icons/equipment/hand/glove-frayed-cloth-grey.webp",         filter: ["armor", "equipment"] },
      belt:     { label: "Belt",      img: "icons/equipment/waist/belt-buckle-leather.webp",            filter: ["equipment"] },
      boots:    { label: "Boots",     img: "icons/equipment/feet/boots-armored-layered-steel.webp",     filter: ["armor", "equipment"] },
      trinket1: { label: "Trinket",   img: "icons/tools/laboratory/alembic-glass-ball-blue.webp",       filter: ["equipment", "treasure"] },
      trinket2: { label: "Trinket",   img: "icons/tools/laboratory/alembic-glass-ball-blue.webp",       filter: ["equipment", "treasure"] },
      pendant:  { label: "Pendant",   img: "icons/equipment/neck/pendant-rough-red.webp",               filter: ["equipment"] },
      ring1:    { label: "Ring",      img: "icons/equipment/finger/ring-band-gold.webp",                filter: ["equipment"] },
      ring2:    { label: "Ring",      img: "icons/equipment/finger/ring-band-gold.webp",                filter: ["equipment"] },
      backpack: { label: "Backpack",  img: "icons/containers/bags/pack-leather-tan.webp",               filter: ["backpack", "equipment"] },
      mainHand: { label: "Main Hand", img: "icons/weapons/swords/shortsword-winged.webp",               filter: ["weapon"] },
      offHand:  { label: "Off Hand",  img: "icons/weapons/shields/buckler-wooden-boss-steel.webp",      filter: ["weapon", "armor", "equipment"] },
      ranged:   { label: "Ranged",    img: "icons/weapons/bows/shortbow-recurve-bone.webp",             filter: ["weapon"] },
      ammo:     { label: "Ammo",      img: "icons/weapons/ammunition/arrow-broadhead-pointed-orange.webp", filter: ["consumable", "treasure"] },
    };
    const equipped = actor.getFlag("pf2e-velvet-sheet", "paperDollSlots") ?? {};
    const slots = {};
    for (const [key, def] of Object.entries(SLOT_DEFS)) {
      const itemId = equipped[key];
      const item = itemId ? actor.items.get(itemId) : null;
      slots[key] = {
        key,
        label: def.label,
        defaultImg: def.img,
        img: item ? item.img : def.img,
        itemId: item ? item.id : null,
        itemName: item ? item.name : def.label,
        empty: !item,
        filter: def.filter
      };
    }
    return {
      slots,
      left: ["head", "cape", "body", "gloves", "belt", "boots"],
      right: ["trinket1", "trinket2", "pendant", "ring1", "ring2", "backpack"],
      bottom: ["mainHand", "offHand", "ranged", "ammo"]
    };
  }

  /* -------------------------------------------- */

  _rankLabel(rank) {
    const labels = ["Untrained", "Trained", "Expert", "Master", "Legendary"];
    return labels[rank] ?? "Untrained";
  }

  _rankClass(rank) {
    return `rank-${rank ?? 0}`;
  }

  /* -------------------------------------------- */
  /*  Event Listeners                             */
  /* -------------------------------------------- */

  /** @override — stop heartbeat sound and ambient particles when sheet closes */
  async close(options) {
    if (this._heartbeatSound) {
      this._heartbeatSound.stop();
      this._heartbeatSound = null;
    }
    VA.stopAmbientParticles();
    this._velvetEntered = false;
    return super.close(options);
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Manual tab navigation
    html.find(".nav-item").click(ev => {
      const tab = ev.currentTarget.dataset.tab;
      if (!tab) return;
      const prevTab = this._activeTab;
      const tabOrder = ["attributes","skills","actions","inventory","spells","feats","biography","effects"];
      const dir = tabOrder.indexOf(tab) > tabOrder.indexOf(prevTab ?? "") ? 1 : -1;
      html.find(".nav-item").removeClass("active");
      $(ev.currentTarget).addClass("active");
      html.find(".velvet-panel > .tab").removeClass("active");
      const newPanel = html.find(`.velvet-panel > .tab[data-tab="${tab}"]`).addClass("active")[0];
      this._activeTab = tab;
      VA.navItemClick(ev.currentTarget);
      VA.tabSwitch(newPanel, dir);
      VA.staggerReveal($(newPanel), ".inv-entry, .feat-entry, .spell-entry, .effect-entry, .action-entry");
    });

    // Restore last active tab
    if (this._activeTab) {
      html.find(".nav-item").removeClass("active");
      html.find(`.nav-item[data-tab="${this._activeTab}"]`).addClass("active");
      html.find(".velvet-panel > .tab").removeClass("active");
      html.find(`.velvet-panel > .tab[data-tab="${this._activeTab}"]`).addClass("active");
    }

    // Inventory category filter
    html.find(".inv-filter").click(ev => {
      const filter = ev.currentTarget.dataset.filter;
      html.find(".inv-filter").removeClass("active");
      $(ev.currentTarget).addClass("active");
      if (filter === "all") {
        html.find(".inventory-category").show();
      } else {
        html.find(".inventory-category").hide();
        html.find(`.inventory-category[data-category="${filter}"]`).show();
      }
      this._activeInvFilter = filter;
    });
    if (this._activeInvFilter && this._activeInvFilter !== "all") {
      html.find(".inv-filter").removeClass("active");
      html.find(`.inv-filter[data-filter="${this._activeInvFilter}"]`).addClass("active");
      html.find(".inventory-category").hide();
      html.find(`.inventory-category[data-category="${this._activeInvFilter}"]`).show();
    }

    // Inventory slot popup — click to open above the tile, click outside to close
    html.find(".inv-slot").click(ev => {
      // If the click landed on an action button, let it pass through without toggling
      if ($(ev.target).closest(".inv-slot-actions").length) return;
      const $slot = $(ev.currentTarget);
      const wasOpen = $slot.hasClass("inv-slot--open");
      html.find(".inv-slot--open").removeClass("inv-slot--open inv-slot--open-down");
      if (!wasOpen) {
        // Detect whether there's room above; if not, flip popup downward
        const panel = html.find(".velvet-panel")[0];
        const panelRect = panel ? panel.getBoundingClientRect() : { top: 0 };
        const slotRect = $slot[0].getBoundingClientRect();
        const spaceAbove = slotRect.top - panelRect.top;
        $slot.addClass("inv-slot--open");
        if (spaceAbove < 110) $slot.addClass("inv-slot--open-down");
      }
      ev.stopPropagation();
    });

    // Close the popup when clicking anywhere on the sheet that isn't a slot
    html[0].addEventListener("click", () => {
      html.find(".inv-slot--open").removeClass("inv-slot--open");
    }, false);

    // Also close after any action button is activated
    html.find(".inv-slot-actions span").click(() => {
      html.find(".inv-slot--open").removeClass("inv-slot--open");
    });

    // HP low-health pulse
    const hp = this.actor.system.attributes?.hp;
    if (hp && hp.max > 0 && (hp.value / hp.max) <= 0.25) {
      html.find(".hp-fill").addClass("hp-low");
    }

    // ── Heartbeat Portrait Overlay System ──
    this._setupHeartbeatOverlay(html);

    // Parallax effect
    html.find(".dnd-sheet")[0]?.addEventListener("mousemove", ev => {
      const rect = ev.currentTarget.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width - 0.5) * 10;
      const y = ((ev.clientY - rect.top) / rect.height - 0.5) * 10;
      const bg = ev.currentTarget.querySelector(".bg");
      if (bg) bg.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
    });

    // Background media
    const bgDiv = html.find(".bg")[0];
    if (bgDiv) {
      const bgSrc = bgDiv.dataset.bg;
      if (bgSrc) {
        const ext = bgSrc.split(".").pop().toLowerCase();
        if (["webm", "mp4"].includes(ext)) {
          const video = document.createElement("video");
          video.className = "bg-media";
          video.src = bgSrc;
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          bgDiv.appendChild(video);
        } else {
          const img = document.createElement("img");
          img.className = "bg-media";
          img.src = bgSrc;
          bgDiv.appendChild(img);
        }
      }
    }

    // Panel opacity
    const panelOpacity = (this.actor.getFlag("pf2e-velvet-sheet", "bgOpacity") ?? 80) / 100;
    const sheet = html.find(".dnd-sheet")[0];
    if (sheet) sheet.style.setProperty("--velvet-panel-opacity", panelOpacity);

    // Everything below only for owners
    if (!this.isEditable) return;

    // Background settings dialog
    html.find(".bg-picker").click(ev => {
      const currentBg = this.actor.getFlag("pf2e-velvet-sheet", "bgImage") ?? "";
      const currentOp = this.actor.getFlag("pf2e-velvet-sheet", "bgOpacity") ?? 80;
      const dlgContent = `
        <form class="velvet-bg-settings">
          <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:4px;font-weight:600;color:#c8a84e;">Background Image / Video</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="text" name="bgPath" value="${currentBg}" style="flex:1;background:#1a1a1a;border:1px solid #444;color:#ccc;padding:4px 6px;" placeholder="Path to image or video...">
              <button type="button" class="velvet-bg-browse" style="padding:4px 10px;cursor:pointer;"><i class="fas fa-folder-open"></i></button>
            </div>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:600;color:#c8a84e;">Panel Darkness: <span class="velvet-op-val">${currentOp}%</span></label>
            <input type="range" name="bgOpacity" min="10" max="100" step="5" value="${currentOp}" style="width:100%;">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#888;"><span>Transparent</span><span>Opaque</span></div>
          </div>
        </form>
      `;
      const dlg = new Dialog({
        title: "Background Settings",
        content: dlgContent,
        buttons: {
          save: {
            icon: '<i class="fas fa-check"></i>',
            label: "Save",
            callback: html => {
              const form = html.find("form")[0];
              const path = form.bgPath.value.trim();
              const opacity = parseInt(form.bgOpacity.value);
              this.actor.setFlag("pf2e-velvet-sheet", "bgImage", path);
              this.actor.setFlag("pf2e-velvet-sheet", "bgOpacity", opacity);
            }
          },
          clear: {
            icon: '<i class="fas fa-trash"></i>',
            label: "Clear BG",
            callback: () => this.actor.setFlag("pf2e-velvet-sheet", "bgImage", "")
          }
        },
        default: "save",
        render: dlgHtml => {
          dlgHtml.find(".velvet-bg-browse").click(() => {
            const fp = new FilePicker({
              type: "imagevideo",
              current: dlgHtml.find("[name=bgPath]").val(),
              callback: path => dlgHtml.find("[name=bgPath]").val(path)
            });
            fp.browse();
          });
          dlgHtml.find("[name=bgOpacity]").on("input", e => {
            const val = e.target.value;
            dlgHtml.find(".velvet-op-val").text(val + "%");
            const s = this.element.find(".dnd-sheet")[0];
            if (s) s.style.setProperty("--velvet-panel-opacity", val / 100);
          });
        }
      });
      dlg.render(true);
    });

    // Ability checks — click to roll via PF2e statistic
    html.find(".stat").click(ev => {
      const ability = ev.currentTarget.dataset.ability;
      if (!ability) return;
      const nativeEvent = ev.originalEvent ?? ev;
      const stat = this.actor.getStatistic?.(ability) ?? this.actor.abilities?.[ability];
      if (stat?.roll) stat.roll({ event: nativeEvent });
    });

    // Saving throw roll
    html.find(".save-row").click(ev => {
      VA.rollButtonClick(ev.currentTarget);
      const save = ev.currentTarget.dataset.save;
      if (!save) return;
      const nativeEvent = ev.originalEvent ?? ev;
      const stat = this.actor.saves?.[save];
      if (stat?.roll) stat.roll({ event: nativeEvent });
    });

    // Skill roll
    html.find(".skill-row").click(ev => {
      VA.rollButtonClick(ev.currentTarget);
      const skill = ev.currentTarget.dataset.skill;
      if (!skill) return;
      const nativeEvent = ev.originalEvent ?? ev;
      const stat = this.actor.skills?.[skill];
      if (stat?.roll) stat.roll({ event: nativeEvent });
    });

    // Perception roll
    html.find(".perception-roll").click(ev => {
      VA.rollButtonClick(ev.currentTarget);
      const nativeEvent = ev.originalEvent ?? ev;
      const stat = this.actor.perception;
      if (stat?.roll) stat.roll({ event: nativeEvent });
    });

    // Strike attack rolls (with MAP variants)
    html.find(".strike-attack").click(ev => {
      VA.strikeRoll(ev.currentTarget);
      const idx = Number(ev.currentTarget.dataset.strikeIdx);
      const variantIdx = Number(ev.currentTarget.dataset.variant) || 0;
      const nativeEvent = ev.originalEvent ?? ev;
      const strike = this.actor.system.actions?.[idx];
      if (strike?.variants?.[variantIdx]?.roll) {
        strike.variants[variantIdx].roll({ event: nativeEvent });
      }
    });

    // Strike damage roll
    html.find(".strike-damage").click(ev => {
      VA.rollButtonClick(ev.currentTarget);
      const idx = Number(ev.currentTarget.dataset.strikeIdx);
      const nativeEvent = ev.originalEvent ?? ev;
      const strike = this.actor.system.actions?.[idx];
      if (strike?.damage) strike.damage({ event: nativeEvent });
    });

    // Strike critical damage roll
    html.find(".strike-critical").click(ev => {
      VA.rollButtonClick(ev.currentTarget);
      const idx = Number(ev.currentTarget.dataset.strikeIdx);
      const nativeEvent = ev.originalEvent ?? ev;
      const strike = this.actor.system.actions?.[idx];
      if (strike?.critical) strike.critical({ event: nativeEvent });
    });

    // Ammunition select for strikes
    html.find(".ammo-select").change(ev => {
      const idx = Number(ev.currentTarget.dataset.strikeIdx);
      const strike = this.actor.system.actions?.[idx];
      const weapon = strike?.item;
      const ammoId = ev.currentTarget.value || null;
      if (weapon) weapon.update({ "system.selectedAmmoId": ammoId });
    });

    // Toggle change handler — matches the original PF2e sheet's ul[data-option-toggles] pattern
    html.find("ul[data-option-toggles]").on("change", ev => {
      if (!this.isEditable) return;
      const toggleRow = ev.target.closest("[data-item-id][data-domain][data-option]");
      if (!toggleRow) return;
      const checkbox = toggleRow.querySelector("input[data-action='toggle-roll-option']");
      const suboptionsSelect = toggleRow.querySelector("select[data-action='set-suboption']");
      const { domain, option, itemId } = toggleRow.dataset;
      const suboption = suboptionsSelect?.value ?? null;
      if (checkbox && domain && option) {
        this.actor.toggleRollOption(domain, option, itemId ?? null, checkbox.checked, suboption);
      }
    });

    // Exploration activity toggle
    html.find(".exploration-entry").click(ev => {
      if (!this.isEditable) return;
      const itemId = ev.currentTarget.dataset.itemId;
      if (!itemId) return;
      const current = this.actor.system.exploration ?? [];
      let updated;
      if (current.includes(itemId)) {
        updated = current.filter(id => id !== itemId);
      } else {
        updated = [...current, itemId];
      }
      this.actor.update({ "system.exploration": updated });
    });

    // Item use — for items with selfEffect / frequency (action macros like Lucky Break,
    // Psi Strikes, Unleash Psyche, Raise a Shield, etc.)
    // game.pf2e.rollItemMacro() is the correct PF2e-native entry point: it calls
    // createUseActionMessage() which handles frequency decrement, self-effect
    // application, and sends the full ability chat card (with "Apply Effect" button).
    // Neither AbilityItemPF2e nor FeatPF2e expose a use() method — that only exists
    // on game.pf2e.actions objects.
    html.find(".item-use").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;
      const nativeEvent = ev.originalEvent ?? ev;
      if (typeof game.pf2e?.rollItemMacro === "function") {
        game.pf2e.rollItemMacro(item.uuid, nativeEvent);
      } else if (item.toMessage) {
        item.toMessage(nativeEvent);
      }
    });

    // Item roll / send to chat (passive items without a use mechanic)
    html.find(".item-roll").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const item = this.actor.items.get(itemId);
      const nativeEvent = (ev.originalEvent ?? ev);
      if (item?.toMessage) item.toMessage(nativeEvent);
      else if (item?.toChat) item.toChat(nativeEvent);
    });

    // Item edit
    html.find(".item-edit").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) item.sheet.render(true);
    });

    // Item delete
    html.find(".item-delete").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) {
        Dialog.confirm({
          title: `Delete ${item.name}?`,
          content: `<p>Are you sure you want to delete <strong>${item.name}</strong>?</p>`,
          yes: () => item.delete()
        });
      }
    });

    // Item sound config — open VelvetSoundConfig form
    html.find(".item-sound-config").click(ev => {
      ev.stopPropagation();
      const el = ev.currentTarget;
      const itemId = el.closest("[data-item-id]")?.dataset.itemId
                  ?? el.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item) return;
      const isStrike = !!el.closest(".strike-entry");
      new VelvetSoundConfig(item, { isStrike }).render(true);
    });

    // Spell use — cast via PF2e spellcasting entry
    html.find(".spell-use").click(async (ev) => {
      ev.stopPropagation();
      const el = ev.currentTarget;
      // Get spell item ID
      const itemId = el.dataset.itemId ?? el.closest("[data-item-id]")?.dataset.itemId;
      const spell = this.actor.items.get(itemId);
      if (!spell) return;
      // Find the spellcasting entry that owns this spell
      const entryId = el.dataset.entryId
                    ?? el.closest("[data-entry-id]")?.dataset.entryId
                    ?? spell.system.location?.value;
      const entry = entryId ? this.actor.items.get(entryId) : null;
      // Get the rank context (from prep slot or spell level group)
      const groupEl = el.closest(".spell-level-group");
      const rank = Number(groupEl?.dataset.level ?? spell.rank ?? spell.system.level?.value ?? 0);
      // Preferred: use PF2e's entry.cast()
      if (entry?.cast) {
        await entry.cast(spell, { rank });
      } else if (spell.toMessage) {
        await spell.toMessage();
      } else if (spell.toChat) {
        await spell.toChat();
      }
    });

    // Toggle invested
    html.find(".item-invest").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      if (itemId) this.actor.toggleInvested?.(itemId);
    });

    // Hero Points
    html.find(".hero-pip").click(ev => {
      if (!this.isEditable) return;
      const current = this.actor.system.resources?.heroPoints?.value ?? 0;
      if (current > 0) this.actor.update({ "system.resources.heroPoints.value": current - 1 });
    });
    html.find(".hero-pip").contextmenu(ev => {
      ev.preventDefault();
      if (!this.isEditable) return;
      const current = this.actor.system.resources?.heroPoints?.value ?? 0;
      const max = this.actor.system.resources?.heroPoints?.max ?? 3;
      if (current < max) this.actor.update({ "system.resources.heroPoints.value": current + 1 });
    });

    // Focus Points
    html.find(".focus-pip").click(ev => {
      if (!this.isEditable) return;
      const current = this.actor.system.resources?.focus?.value ?? 0;
      if (current > 0) this.actor.update({ "system.resources.focus.value": current - 1 });
    });
    html.find(".focus-pip").contextmenu(ev => {
      ev.preventDefault();
      if (!this.isEditable) return;
      const current = this.actor.system.resources?.focus?.value ?? 0;
      const max = this.actor.system.resources?.focus?.max ?? 0;
      if (current < max) this.actor.update({ "system.resources.focus.value": current + 1 });
    });

    // Spell slot pips
    html.find(".slot-pip").click(ev => {
      const entryId = ev.currentTarget.dataset.entryId;
      const slotKey = ev.currentTarget.dataset.slotKey;
      const entry = this.actor.items.get(entryId);
      if (!entry) return;
      const current = entry.system.slots?.[slotKey]?.value ?? 0;
      if (current > 0) entry.update({ [`system.slots.${slotKey}.value`]: current - 1 });
    });
    html.find(".slot-pip").contextmenu(ev => {
      ev.preventDefault();
      const entryId = ev.currentTarget.dataset.entryId;
      const slotKey = ev.currentTarget.dataset.slotKey;
      const entry = this.actor.items.get(entryId);
      if (!entry) return;
      const current = entry.system.slots?.[slotKey]?.value ?? 0;
      const max = entry.system.slots?.[slotKey]?.max ?? 0;
      if (current < max) entry.update({ [`system.slots.${slotKey}.value`]: current + 1 });
    });

    // Spell preparation - open SpellPreparationSheet
    html.find(".spell-prep-btn").click(async (ev) => {
      const entryId = ev.currentTarget.dataset.entryId;
      const entry = this.actor.items.get(entryId);
      if (!entry) return;
      // Try using the PF2e native SpellPreparationSheet
      if (entry.spells?.openSpellPreparationSheet) {
        entry.spells.openSpellPreparationSheet();
      } else {
        // Fallback: open the native PF2e character sheet to the spells tab
        const nativeSheetClass = CONFIG.Actor.sheetClasses?.character?.["pf2e.CharacterSheetPF2e"]?.cls;
        if (nativeSheetClass) {
          const nativeSheet = new nativeSheetClass(this.actor, { tab: "spellcasting" });
          nativeSheet.render(true);
        } else {
          ui.notifications.info("Open the default PF2e sheet to prepare spells.");
        }
      }
    });

    // Prep slot click - toggle expended/unexpended (not cantrips)
    html.find(".prep-slot:not(.empty)").click(ev => {
      // Don't toggle if clicking on a control button
      if (ev.target.closest(".prep-slot-controls")) return;
      // Cantrips are at-will — never mark as expended
      if (ev.currentTarget.dataset.slotKey === "slot0") return;
      const entryId = ev.currentTarget.dataset.entryId;
      const slotKey = ev.currentTarget.dataset.slotKey;
      const slotIndex = Number.parseInt(ev.currentTarget.dataset.slotIndex);
      const entry = this.actor.items.get(entryId);
      if (!entry) return;
      const prepared = entry.system.slots?.[slotKey]?.prepared;
      if (!prepared?.[slotIndex]) return;
      const isExpended = prepared[slotIndex].expended;
      const newPrepared = foundry.utils.deepClone(prepared);
      newPrepared[slotIndex].expended = !isExpended;
      entry.update({ [`system.slots.${slotKey}.prepared`]: newPrepared });
    });

    // Prep slot right-click - unprepare (clear slot)
    html.find(".prep-slot:not(.empty)").contextmenu(ev => {
      ev.preventDefault();
      const entryId = ev.currentTarget.dataset.entryId;
      const slotKey = ev.currentTarget.dataset.slotKey;
      const slotIndex = Number.parseInt(ev.currentTarget.dataset.slotIndex);
      const entry = this.actor.items.get(entryId);
      if (!entry) return;
      const prepared = entry.system.slots?.[slotKey]?.prepared;
      if (!prepared) return;
      const newPrepared = foundry.utils.deepClone(prepared);
      newPrepared[slotIndex] = { id: null, expended: false };
      entry.update({ [`system.slots.${slotKey}.prepared`]: newPrepared });
    });

    // Prep slot drag start
    html.find(".prep-slot[draggable='true']").on("dragstart", ev => {
      const dt = ev.originalEvent.dataTransfer;
      const data = {
        type: "Item",
        uuid: this.actor.items.get(ev.currentTarget.dataset.spellId)?.uuid,
        fromSlot: {
          entryId: ev.currentTarget.dataset.entryId,
          slotKey: ev.currentTarget.dataset.slotKey,
          slotIndex: Number.parseInt(ev.currentTarget.dataset.slotIndex)
        }
      };
      dt.setData("text/plain", JSON.stringify(data));
    });

    // Prep slot drop - allow dropping spells into empty slots
    html.find(".prep-slot").on("dragover", ev => {
      ev.preventDefault();
      ev.originalEvent.dataTransfer.dropEffect = "copy";
    });
    html.find(".prep-slot").on("drop", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      let data;
      try { data = JSON.parse(ev.originalEvent.dataTransfer.getData("text/plain")); } catch { return; }
      if (data.type !== "Item") return;
      const entryId = ev.currentTarget.dataset.entryId;
      const slotKey = ev.currentTarget.dataset.slotKey;
      const slotIndex = Number.parseInt(ev.currentTarget.dataset.slotIndex);
      const entry = this.actor.items.get(entryId);
      if (!entry) return;

      // Resolve the spell item
      let spell;
      if (data.uuid) {
        spell = await fromUuid(data.uuid);
      } else if (data.data?._id) {
        spell = this.actor.items.get(data.data._id);
      }
      if (!spell || spell.type !== "spell") return;

      // If the spell isn't in this entry's collection, add it first
      let spellInEntry = this.actor.items.find(i => i.type === "spell" && i.system.location?.value === entryId && i.sourceId === spell.uuid);
      if (!spellInEntry) {
        spellInEntry = this.actor.items.find(i => i.type === "spell" && i.system.location?.value === entryId && i.name === spell.name);
      }

      const spellId = spellInEntry?.id ?? spell.id;
      const prepared = foundry.utils.deepClone(entry.system.slots?.[slotKey]?.prepared ?? []);
      const rank = Number.parseInt(slotKey.replace("slot", ""));
      
      // Ensure array is long enough
      while (prepared.length <= slotIndex) prepared.push({ id: null, expended: false });
      
      // If dragged from another slot in same entry, clear the old slot
      if (data.fromSlot && data.fromSlot.entryId === entryId) {
        const oldKey = data.fromSlot.slotKey;
        const oldIdx = data.fromSlot.slotIndex;
        if (oldKey === slotKey) {
          prepared[oldIdx] = { id: null, expended: false };
        } else {
          const oldPrepared = foundry.utils.deepClone(entry.system.slots?.[oldKey]?.prepared ?? []);
          oldPrepared[oldIdx] = { id: null, expended: false };
          await entry.update({ [`system.slots.${oldKey}.prepared`]: oldPrepared });
        }
      }

      prepared[slotIndex] = { id: spellId, expended: false };
      entry.update({ [`system.slots.${slotKey}.prepared`]: prepared });
    });

    // HP editing
    html.find(".hp-input").change(ev => {
      const value = parseInt(ev.target.value);
      if (!isNaN(value)) {
        const hp = this.actor.system.attributes?.hp;
        const oldValue = hp?.value ?? value;
        const max = hp?.max ?? 1;
        const delta = value - oldValue;
        const newPct = (value / max) * 100;
        VA.hpChange(html, newPct, delta);
        this.actor.update({ "system.attributes.hp.value": value });
      }
    });
    html.find(".hp-temp-input").change(ev => {
      const value = parseInt(ev.target.value) || 0;
      this.actor.update({ "system.attributes.hp.temp": value });
    });

    // Dying / Wounded / Doomed condition pips
    html.find(".condition-pip").click(ev => {
      if (!this.isEditable) return;
      const condition = ev.currentTarget.dataset.condition;
      if (!condition) return;
      const current = this.actor.system.attributes?.[condition]?.value ?? 0;
      const max = this.actor.system.attributes?.[condition]?.max ?? 4;
      if (current < max) {
        VA.conditionPipToggle(ev.currentTarget, true);
        if (condition === "dying") VA.dyingIncreased(html);
        const existing = this.actor.getCondition?.(condition);
        if (existing) {
          this.actor.increaseCondition?.(condition);
        } else {
          this.actor.increaseCondition?.(condition) ?? this.actor.update({ [`system.attributes.${condition}.value`]: current + 1 });
        }
      }
    });
    html.find(".condition-pip").contextmenu(ev => {
      ev.preventDefault();
      if (!this.isEditable) return;
      const condition = ev.currentTarget.dataset.condition;
      if (!condition) return;
      const current = this.actor.system.attributes?.[condition]?.value ?? 0;
      if (current > 0) {
        VA.conditionPipToggle(ev.currentTarget, false);
        this.actor.decreaseCondition?.(condition) ?? this.actor.update({ [`system.attributes.${condition}.value`]: current - 1 });
      }
    });

    // XP editing
    html.find(".xp-input").change(ev => {
      const value = parseInt(ev.target.value) || 0;
      this.actor.update({ "system.details.xp.value": value });
    });

    // Level editing
    html.find(".level-input").change(ev => {
      const value = parseInt(ev.target.value);
      if (!isNaN(value) && value >= 0 && value <= 30) {
        const oldLevel = this.actor.system.details?.level?.value ?? 0;
        if (value > oldLevel) VA.levelUpBurst(html);
        this.actor.update({ "system.details.level.value": value });
      }
    });

    // Ability score manual editing (when in manual mode)
    html.find(".ability-input").change(ev => {
      const ability = ev.currentTarget.dataset.ability;
      const value = parseInt(ev.target.value);
      if (ability && !isNaN(value)) {
        this.actor.update({ [`system.abilities.${ability}.value`]: value });
      }
    });

    // Edit Attribute Boosts button — opens PF2e's built-in AttributeBuilder
    html.find(".edit-boosts-btn").click(ev => {
      ev.preventDefault();

      // 1. Check if an AttributeBuilder is already open for this actor
      const existing = Object.values(this.actor.apps).find(a => a.constructor.name === "AttributeBuilder");
      if (existing) {
        existing.render(true, { focus: true });
        return;
      }

      // 2. If we previously cached the class, use it directly
      if (VelvetCharacterSheet._AttributeBuilderClass) {
        new VelvetCharacterSheet._AttributeBuilderClass(this.actor).render(true);
        return;
      }

      // 3. Open PF2e's native sheet off-screen, auto-click the boost button, then close it
      const pf2eEntry = CONFIG.Actor.sheetClasses?.character?.["pf2e.CharacterSheetPF2e"];
      if (!pf2eEntry?.cls) {
        ui.notifications.warn("PF2e character sheet class not found. Use Manual Mode instead.");
        return;
      }
      const tempSheet = new pf2eEntry.cls(this.actor);
      const hookId = Hooks.on("renderActorSheet", (app, jqHtml) => {
        if (app !== tempSheet) return;
        Hooks.off("renderActorSheet", hookId);
        const el = jqHtml[0] ?? jqHtml;
        const btn = el.querySelector?.("[data-action='edit-attribute-boosts']");
        if (btn) {
          btn.click();
          // Cache the AttributeBuilder class for instant future use
          setTimeout(() => {
            const builder = Object.values(this.actor.apps).find(a => a.constructor.name === "AttributeBuilder");
            if (builder) VelvetCharacterSheet._AttributeBuilderClass = builder.constructor;
            tempSheet.close({ force: true });
          }, 150);
        } else {
          tempSheet.close({ force: true });
          ui.notifications.warn("Could not find Attribute Builder. Use Manual Mode instead.");
        }
      });
      tempSheet.render(true, { left: -9999, top: -9999, focus: false });
    });

    // Manual mode toggle
    html.find(".manual-mode-toggle").change(ev => {
      const manual = ev.target.checked;
      this.actor.update({ "system.build.attributes.manual": manual });
    });

    // Skill proficiency rank change (dropdown for all skills)
    html.find(".skill-rank-select").change(ev => {
      ev.stopPropagation();
      const skillKey = ev.currentTarget.dataset.skill;
      const newRank = Number(ev.currentTarget.value);
      const isLore = ev.currentTarget.dataset.isLore === "true";
      if (!skillKey || isNaN(newRank)) return;

      if (isLore) {
        // Lore skills are items of type "lore"
        const loreItem = this.actor.items.find(i =>
          i.type === "lore" && (i.system?.slug ?? i.slug ?? i.name.toLowerCase().replaceAll(/\s+/g, "-")) === skillKey
        );
        if (loreItem) loreItem.update({ "system.proficient.value": newRank });
      } else {
        // Core skills: update via system.skills path
        this.actor.update({ [`system.skills.${skillKey}.rank`]: newRank });
      }
    });

    // Feat/Feature filter
    html.find(".feat-filter").click(ev => {
      const filter = ev.currentTarget.dataset.filter;
      html.find(".feat-filter").removeClass("active");
      $(ev.currentTarget).addClass("active");
      if (filter === "all") {
        html.find(".feature-category").show();
      } else {
        html.find(".feature-category").hide();
        html.find(`.feature-category[data-category="${filter}"]`).show();
      }
      this._activeFeatFilter = filter;
    });
    if (this._activeFeatFilter && this._activeFeatFilter !== "all") {
      html.find(".feat-filter").removeClass("active");
      html.find(`.feat-filter[data-filter="${this._activeFeatFilter}"]`).addClass("active");
      html.find(".feature-category").hide();
      html.find(`.feature-category[data-category="${this._activeFeatFilter}"]`).show();
    }

    // Spell filter
    html.find(".spell-filter").click(ev => {
      const filter = ev.currentTarget.dataset.filter;
      html.find(".spell-filter").removeClass("active");
      $(ev.currentTarget).addClass("active");
      if (filter === "all") {
        html.find(".spell-level-group").show();
      } else {
        html.find(".spell-level-group").hide();
        html.find(`.spell-level-group[data-level="${filter}"]`).show();
      }
      this._activeSpellFilter = filter;
    });
    if (this._activeSpellFilter && this._activeSpellFilter !== "all") {
      html.find(".spell-filter").removeClass("active");
      html.find(`.spell-filter[data-filter="${this._activeSpellFilter}"]`).addClass("active");
      html.find(".spell-level-group").hide();
      html.find(`.spell-level-group[data-level="${this._activeSpellFilter}"]`).show();
    }

    // Create item
    html.find(".item-create").click(ev => {
      const type = ev.currentTarget.dataset.type;
      if (!type) return;
      const typeName = type.charAt(0).toUpperCase() + type.slice(1);
      this.actor.createEmbeddedDocuments("Item", [{ name: `New ${typeName}`, type }]);
    });

    // ABC item edit  
    html.find(".abc-edit").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) item.sheet.render(true);
    });

    // Effect toggle
    html.find(".effect-toggle").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) {
        if (item.type === "condition") item.delete();
        else if (item.isExpired !== undefined) item.update({ "system.expired": !item.isExpired });
      }
    });

    // Effect delete
    html.find(".effect-delete").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) item.delete();
    });

    // Rest actions
    html.find(".rest-action").click(ev => {
      const restType = ev.currentTarget.dataset.rest;
      if (restType === "long") game.pf2e?.actions?.restForTheNight?.({ actors: this.actor });
    });

    // Initiative roll — with skill selection like the original PF2e sheet
    html.find(".initiative-roll").click(ev => {
      ev.preventDefault();
      const nativeEvent = ev.originalEvent ?? ev;

      // Build a list of available initiative statistics
      const options = [];

      // Perception (default)
      const perception = this.actor.perception;
      if (perception) {
        const mod = perception.mod ?? perception.totalModifier ?? 0;
        const modStr = (mod >= 0 ? "+" : "") + mod;
        options.push({ slug: "perception", label: `Perception (${modStr})`, stat: perception });
      }

      // Skills that can be used for initiative (all skills, as PF2e allows any with feats)
      const skills = this.actor.skills ?? {};
      for (const [key, skill] of Object.entries(skills)) {
        if (!skill) continue;
        const mod = skill.mod ?? skill.totalModifier ?? 0;
        const modStr = (mod >= 0 ? "+" : "") + mod;
        const label = skill.label ?? CONFIG.PF2E?.skills?.[key]?.label ?? key;
        const displayLabel = typeof label === "string" ? label : key;
        options.push({ slug: key, label: `${displayLabel} (${modStr})`, stat: skill });
      }

      // If only perception available or fewer, just roll directly
      if (options.length <= 1 && options[0]?.stat) {
        if (this.actor.initiative?.roll) {
          this.actor.initiative.roll({ event: nativeEvent, statistic: options[0].slug });
        } else {
          this.actor.rollInitiative?.({ event: nativeEvent });
        }
        return;
      }

      // Build the skill selection dialog
      const listHtml = options.map(o =>
        `<div class="velvet-init-option" data-slug="${o.slug}" title="${o.label}">
          <span class="velvet-init-label">${o.label}</span>
        </div>`
      ).join("");

      const dlg = new Dialog({
        title: "Roll Initiative",
        content: `<div class="velvet-init-list" style="display:flex;flex-direction:column;gap:2px;max-height:400px;overflow-y:auto;">${listHtml}</div>`,
        buttons: { cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" } },
        default: "cancel",
        render: dlgHtml => {
          // Style the options
          dlgHtml.find(".velvet-init-option").css({
            padding: "6px 10px",
            cursor: "pointer",
            borderBottom: "1px solid rgba(200,168,78,0.12)",
            transition: "background 0.15s ease",
            fontFamily: "'Cinzel', serif",
            fontSize: "13px",
            letterSpacing: "0.3px"
          }).hover(
            function() { $(this).css({ background: "rgba(200,168,78,0.1)" }); },
            function() { $(this).css({ background: "transparent" }); }
          ).click(ev => {
            const slug = ev.currentTarget.dataset.slug;
            dlg.close();
            // Use PF2e's initiative.roll with the selected statistic
            if (this.actor.initiative?.roll) {
              this.actor.initiative.roll({ event: nativeEvent, statistic: slug });
            } else {
              // Fallback
              this.actor.rollInitiative?.({ event: nativeEvent });
            }
          });
        }
      });
      dlg.render(true);
    });

    // Portrait click to change
    html.find(".portrait").click(ev => {
      if (!this.isEditable) return;
      if (html.find(".paperdoll-overlay.active").length) return;
      const fp = new FilePicker({
        type: "imagevideo",
        current: this.actor.img,
        callback: path => this.actor.update({ img: path })
      });
      fp.browse();
    });

    // Paper Doll toggle
    html.find(".paperdoll-toggle").click(ev => {
      ev.stopPropagation();
      this._paperDollOpen = !this._paperDollOpen;
      html.find(".paperdoll-overlay").toggleClass("active", this._paperDollOpen);
    });
    if (this._paperDollOpen) {
      html.find(".paperdoll-overlay").addClass("active");
    }

    // Paper Doll slot click
    html.find(".pd-slot").click(ev => {
      ev.stopPropagation();
      if (!this.isEditable) return;
      const slotKey = ev.currentTarget.dataset.slot;
      const itemId = ev.currentTarget.dataset.itemId;
      if (itemId) {
        const item = this.actor.items.get(itemId);
        if (item) item.sheet.render(true);
      } else {
        this._showPaperDollPicker(slotKey, ev.currentTarget);
      }
    });

    // Paper Doll right-click unequip
    html.find(".pd-slot").contextmenu(async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!this.isEditable) return;
      const slotKey = ev.currentTarget.dataset.slot;
      const itemId = ev.currentTarget.dataset.itemId;
      if (itemId) {
        const slots = foundry.utils.deepClone(this.actor.getFlag("pf2e-velvet-sheet", "paperDollSlots") ?? {});
        delete slots[slotKey];
        await this.actor.unsetFlag("pf2e-velvet-sheet", "paperDollSlots");
        await this.actor.setFlag("pf2e-velvet-sheet", "paperDollSlots", slots);
      }
    });

    // Paper Doll drop handler
    html.find(".pd-slot").each((i, el) => {
      el.addEventListener("dragover", ev => { ev.preventDefault(); el.classList.add("pd-drag-over"); });
      el.addEventListener("dragleave", () => el.classList.remove("pd-drag-over"));
      el.addEventListener("drop", async ev => {
        ev.preventDefault();
        ev.stopPropagation();
        el.classList.remove("pd-drag-over");
        if (!this.isEditable) return;
        try {
          const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
          if (data.type !== "Item") return;
          const item = this.actor.items.get(data.uuid?.split(".").pop()) || await Item.implementation.fromDropData(data);
          if (!item || item.parent !== this.actor) return;
          const slotKey = el.dataset.slot;
          const slots = this.actor.getFlag("pf2e-velvet-sheet", "paperDollSlots") ?? {};
          slots[slotKey] = item.id;
          await this.actor.setFlag("pf2e-velvet-sheet", "paperDollSlots", slots);
        } catch (e) { /* ignore bad data */ }
      });
    });

    // Unequip All
    html.find(".pd-unequip-all").click(async ev => {
      ev.stopPropagation();
      if (!this.isEditable) return;
      await this.actor.unsetFlag("pf2e-velvet-sheet", "paperDollSlots");
    });

    // Item-use button on action entries
    html.find(".item-use, .action-use").click(ev => {
      VA.rollButtonClick(ev.currentTarget);
    });

    // ── Sheet Entrance Animation ──
    // Only run on first render (not re-renders from data updates)
    if (!this._velvetEntered) {
      this._velvetEntered = true;
      VA.sheetEnter(html);
    } else {
      // On data re-renders just restart ambient particles quietly
      VA._startAmbientParticles(html);
    }
  }

  /* -------------------------------------------- */

  _showPaperDollPicker(slotKey, element) {
    const dollData = this._preparePaperDoll(this.actor);
    const slotDef = dollData.slots[slotKey];
    if (!slotDef) return;
    const items = this.actor.items.filter(i => slotDef.filter.includes(i.type));
    if (!items.length) return ui.notifications.info("No items available for this slot.");
    const listHtml = items.map(i =>
      `<div class="pd-pick-item" data-id="${i.id}" title="${i.name}"><img src="${i.img}"><span>${i.name}</span></div>`
    ).join("");
    const dlg = new Dialog({
      title: `Equip — ${slotDef.label}`,
      content: `<div class="pd-pick-list">${listHtml}</div>`,
      buttons: { cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" } },
      default: "cancel",
      render: dlgHtml => {
        dlgHtml.find(".pd-pick-item").click(async ev => {
          const id = ev.currentTarget.dataset.id;
          const slots = this.actor.getFlag("pf2e-velvet-sheet", "paperDollSlots") ?? {};
          slots[slotKey] = id;
          await this.actor.setFlag("pf2e-velvet-sheet", "paperDollSlots", slots);
          dlg.close();
        });
      }
    });
    dlg.render(true);
  }
}

/* ============================================= */
/*  Sound System — Item Sound Configuration      */
/* ============================================= */

const VELVET_MODULE_ID = "pf2e-velvet-sheet";

/**
 * Convert a PF2e frequency interval slug to a short human-readable label.
 * e.g. "day" → "day", "turn" → "turn", "encounter" → "encounter"
 */
function _velvetFrequencyLabel(freq) {
  if (!freq) return "";
  const PER_LABELS = {
    turn:      "turn",
    round:     "round",
    encounter: "encounter",
    minute:    "min",
    hour:      "hr",
    day:       "day",
    week:      "week",
    month:     "month",
    year:      "year"
  };
  const perLabel = PER_LABELS[freq.per] ?? freq.per ?? "";
  return perLabel ? `/${perLabel}` : "";
}

/**
 * Generate a stable key for an item that survives PF2e item rebuild/re-import.
 * Uses sourceId (compendium origin) first, then slug, then type:name as fallback.
 * Dots are replaced with underscores to be safe for Foundry flag dot-notation.
 */
function _velvetSoundKey(item) {
  const raw = item.sourceId
    ?? item.flags?.core?.sourceId
    ?? item.system?.slug
    ?? item.slug
    ?? `${item.type}:${item.name}`;
  // Replace dots with underscores to avoid issues with Foundry's setFlag dot-notation
  return raw.replaceAll(".", "_");
}

function _velvetNormalizeSpellName(name) {
  return String(name ?? "").trim().toLocaleLowerCase();
}

function _velvetIsPreparedNonFlexibleEntry(entry) {
  return entry?.type === "spellcastingEntry"
    && entry.system.prepared?.value === "prepared"
    && !entry.system.prepared?.flexible;
}

function _velvetGetPreparedSpellIds(actor) {
  const preparedSpellIds = new Set();

  for (const entry of actor?.items ?? []) {
    if (!_velvetIsPreparedNonFlexibleEntry(entry)) continue;

    const slotData = entry.system.slots ?? {};
    for (let rank = 0; rank <= 10; rank++) {
      const prepared = slotData[`slot${rank}`]?.prepared ?? [];
      for (const slot of prepared) {
        if (slot?.id) preparedSpellIds.add(slot.id);
      }
    }
  }

  return preparedSpellIds;
}

function _velvetGetPreparedSpellGroup(actor, item) {
  if (!actor || item?.type !== "spell") return [item].filter(Boolean);

  const targetName = _velvetNormalizeSpellName(item.name);
  if (!targetName) return [item];

  const preparedSpellIds = _velvetGetPreparedSpellIds(actor);

  const matches = actor.items.filter(candidate => {
    if (candidate.type !== "spell") return false;
    if (!preparedSpellIds.has(candidate.id)) return false;
    return _velvetNormalizeSpellName(candidate.name) === targetName;
  });

  if (!matches.some(candidate => candidate.id === item.id)) {
    matches.push(item);
  }

  return matches;
}

/**
 * Get the sound config for an item from actor-level storage.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {object|null} Sound config object or null
 */
function _velvetGetActorSoundConfig(actor, item) {
  if (!actor || !item) return null;
  const allSounds = actor.getFlag(VELVET_MODULE_ID, "itemSounds") ?? {};
  const key = _velvetSoundKey(item);
  return allSounds[key] ?? null;
}

/**
 * Save a sound config for an item to actor-level storage.
 * @param {Actor} actor
 * @param {Item} item
 * @param {object} config — the sound config to save
 */
async function _velvetSetActorSoundConfig(actor, item, config) {
  if (!actor || !item) return;
  const key = _velvetSoundKey(item);
  // Use dot-notation to update only the specific key within the itemSounds object
  await actor.setFlag(VELVET_MODULE_ID, `itemSounds.${key}`, config);
}

/* ── Action Image helpers (actor-level, keyed like sounds) ── */

function _velvetGetActorImageConfig(actor, item) {
  if (!actor || !item) return null;
  const allImages = actor.getFlag(VELVET_MODULE_ID, "itemImages") ?? {};
  return allImages[_velvetSoundKey(item)] ?? null;
}

async function _velvetSetActorImageConfig(actor, item, images) {
  if (!actor || !item) return;
  await actor.setFlag(VELVET_MODULE_ID, `itemImages.${_velvetSoundKey(item)}`, images);
}

async function _velvetRemoveActorImageConfig(actor, item) {
  if (!actor || !item) return;
  const all = foundry.utils.deepClone(actor.getFlag(VELVET_MODULE_ID, "itemImages") ?? {});
  delete all[_velvetSoundKey(item)];
  await actor.setFlag(VELVET_MODULE_ID, "itemImages", all);
}

function _velvetResolveImageConfig(item, message) {
  const actor = item.parent ?? item.actor ?? null;
  const cfg = actor ? _velvetGetActorImageConfig(actor, item) : null;
  if (!cfg) return null;
  if (cfg.images) {
    const rollType = _velvetDetectRollType(message);
    if (rollType && cfg.images[rollType]) return cfg.images[rollType];
    if (rollType?.startsWith("attack") && cfg.images.attack1) return cfg.images.attack1;
    if (rollType === "critical" && cfg.images.damage) return cfg.images.damage;
  }
  return cfg.image ?? null;
}

async function _velvetSetActorSoundConfigForItems(actor, items, config) {
  if (!actor || !items?.length) return;
  const updates = {};
  for (const item of items) {
    if (!item) continue;
    updates[_velvetSoundKey(item)] = config;
  }
  if (!Object.keys(updates).length) return;

  const existing = foundry.utils.deepClone(actor.getFlag(VELVET_MODULE_ID, "itemSounds") ?? {});
  await actor.setFlag(VELVET_MODULE_ID, "itemSounds", { ...existing, ...updates });
}

/**
 * Remove a sound config for an item from actor-level storage.
 * @param {Actor} actor
 * @param {Item} item
 */
async function _velvetRemoveActorSoundConfig(actor, item) {
  if (!actor || !item) return;
  const key = _velvetSoundKey(item);
  // Use Foundry's unsetFlag with dot-notation to remove just this key
  try {
    await actor.update({ [`flags.${VELVET_MODULE_ID}.itemSounds.-=${key}`]: null });
  } catch {
    // Fallback: read-modify-write
    const allSounds = foundry.utils.deepClone(actor.getFlag(VELVET_MODULE_ID, "itemSounds") ?? {});
    if (key in allSounds) {
      delete allSounds[key];
      await actor.unsetFlag(VELVET_MODULE_ID, "itemSounds");
      if (Object.keys(allSounds).length > 0) {
        await actor.setFlag(VELVET_MODULE_ID, "itemSounds", allSounds);
      }
    }
  }
}

async function _velvetRemoveActorSoundConfigForItems(actor, items) {
  if (!actor || !items?.length) return;

  const allSounds = foundry.utils.deepClone(actor.getFlag(VELVET_MODULE_ID, "itemSounds") ?? {});
  let changed = false;

  for (const item of items) {
    if (!item) continue;
    const key = _velvetSoundKey(item);
    if (!(key in allSounds)) continue;
    delete allSounds[key];
    changed = true;
  }

  if (!changed) return;

  await actor.unsetFlag(VELVET_MODULE_ID, "itemSounds");
  if (Object.keys(allSounds).length > 0) {
    await actor.setFlag(VELVET_MODULE_ID, "itemSounds", allSounds);
  }
}

/**
 * Check if an item has a sound config on the actor.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {boolean}
 */
function _velvetItemHasSound(actor, item) {
  const cfg = _velvetGetActorSoundConfig(actor, item);
  if (!cfg) return false;
  // Strike mode: check if any roll type has playlist+track
  if (cfg.sounds) {
    return Object.values(cfg.sounds).some(c => c?.playlist && c?.track);
  }
  // Simple mode: check playlist+track
  return !!(cfg.playlist && cfg.track);
}

function _velvetIsFirstGM() {
  return game.user === game.users.find(u => u.isGM && u.active);
}

async function _velvetPlayItemSound(playlistId, trackId, volume = 0.8) {
  const playlist = game.playlists.get(playlistId);
  if (!playlist) return;

  if (trackId === "random-track") {
    const ids = playlist.sounds.map(s => s.id);
    if (!ids.length) return;
    trackId = ids[Math.floor(Math.random() * ids.length)];
  }

  const sound = playlist.sounds.get(trackId);
  if (!sound) return;

  // Store original volume, play, then restore (volume is per-sound in Foundry)
  const origVolume = sound.volume;
  if (Math.abs(origVolume - volume) > 0.01) {
    await sound.update({ volume });
  }
  await playlist.playSound(sound);
  // Restore original volume after a short delay so it doesn't affect the playlist permanently
  if (Math.abs(origVolume - volume) > 0.01) {
    setTimeout(() => sound.update({ volume: origVolume }), 500);
  }
}

class VelvetSoundConfig extends FormApplication {
  /**
   * @param {Item} item
   * @param {object} options
   * @param {boolean} options.isStrike — true to show per-roll-type tabs
   */
  constructor(item, options = {}) {
    super(item, options);
    this.item = item;
    this.actor = item.parent ?? item.actor ?? null;
    this.isStrike = options.isStrike ?? false;
    this._activeTab = "attack1";

    // Load from actor-level storage, with legacy item-flag fallback
    const actorCfg = this.actor ? _velvetGetActorSoundConfig(this.actor, item) : null;

    if (this.isStrike) {
      const sounds = actorCfg?.sounds ?? item.getFlag(VELVET_MODULE_ID, "sounds") ?? {};
      this._tabPlaylists = {};
      for (const key of VelvetSoundConfig.ROLL_TYPES) {
        this._tabPlaylists[key] = sounds[key]?.playlist ?? "";
      }
    } else {
      this._selectedPlaylist = actorCfg?.playlist
        ?? item.getFlag(VELVET_MODULE_ID, "soundPlaylist") ?? "";
    }
  }

  static ROLL_TYPES = ["attack1", "attack2", "attack3", "damage", "critical"];

  static ROLL_LABELS = {
    attack1:  "1st Attack",
    attack2:  "2nd Attack (MAP -5)",
    attack3:  "3rd Attack (MAP -10)",
    damage:   "Damage",
    critical: "Critical"
  };

  static ROLL_ICONS = {
    attack1:  "fas fa-dice-d20",
    attack2:  "fas fa-dice-d20",
    attack3:  "fas fa-dice-d20",
    damage:   "fas fa-bolt",
    critical: "fas fa-skull-crossbones"
  };

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "velvet-sound-config",
      title: "Item Sound Configuration",
      template: `modules/${VELVET_MODULE_ID}/templates/velvet-sound-config.hbs`,
      classes: ["velvet-sound-config"],
      width: 420,
      height: "auto"
    });
  }

  async getData() {
    const allPlaylists = game.playlists.contents;
    const actorCfg = this.actor ? _velvetGetActorSoundConfig(this.actor, this.item) : null;
    const imageCfg = this.actor ? _velvetGetActorImageConfig(this.actor, this.item) : null;

    if (this.isStrike) {
      const sounds = actorCfg?.sounds ?? this.item.getFlag(VELVET_MODULE_ID, "sounds") ?? {};
      const tabs = VelvetSoundConfig.ROLL_TYPES.map(key => {
        const cfg = sounds[key] ?? {};
        const playlistId = this._tabPlaylists[key] ?? cfg.playlist ?? "";
        const trackId = cfg.track ?? "";
        const volume = cfg.volume ?? 0.8;
        const playlist = playlistId ? game.playlists.get(playlistId) : null;
        return {
          key,
          label: VelvetSoundConfig.ROLL_LABELS[key],
          icon: VelvetSoundConfig.ROLL_ICONS[key],
          active: key === this._activeTab,
          playlistId,
          trackId,
          volume,
          volumePct: Math.round(volume * 100),
          tracks: playlist ? playlist.sounds.contents : [],
          hasSound: !!(playlistId && trackId),
          actionImage: imageCfg?.images?.[key] ?? ""
        };
      });
      return { isStrike: true, tabs, playlists: allPlaylists, activeTab: this._activeTab };
    }

    // Simple mode (non-strike items)
    const playlistId = this._selectedPlaylist;
    const trackId = actorCfg?.track ?? this.item.getFlag(VELVET_MODULE_ID, "soundTrack") ?? "";
    const volume = actorCfg?.volume ?? this.item.getFlag(VELVET_MODULE_ID, "soundVolume") ?? 0.8;
    const playlist = playlistId ? game.playlists.get(playlistId) : null;
    return {
      isStrike: false,
      playlists: allPlaylists,
      currentPlaylist: playlistId,
      currentTrack: trackId,
      tracks: playlist ? playlist.sounds.contents : [],
      volume,
      volumePct: Math.round(volume * 100),
      actionImage: imageCfg?.image ?? ""
    };
  }

  async _updateObject(event, formData) {
    if (this.isStrike) {
      // Build sounds and images objects from all tabs
      const sounds = {};
      const images = {};
      for (const key of VelvetSoundConfig.ROLL_TYPES) {
        sounds[key] = {
          playlist: formData[`${key}.playlist`] || "",
          track: formData[`${key}.track`] || "",
          volume: Number.parseFloat(formData[`${key}.volume`]) || 0.8
        };
        const img = formData[`${key}.actionImage`] ?? "";
        if (img) images[key] = img;
      }
      if (this.actor) {
        await _velvetSetActorSoundConfig(this.actor, this.item, { sounds });
        const existingImg = _velvetGetActorImageConfig(this.actor, this.item) ?? {};
        await _velvetSetActorImageConfig(this.actor, this.item, { ...existingImg, images });
      }
      await this.item.setFlag(VELVET_MODULE_ID, "sounds", sounds);
      ui.notifications.info(`Strike sounds saved for ${this.item.name}`);
    } else {
      const config = {
        playlist: formData.playlist || "",
        track: formData.track || "",
        volume: Number.parseFloat(formData.volume) || 0.8
      };
      const linkedItems = this.item.type === "spell"
        ? _velvetGetPreparedSpellGroup(this.actor, this.item)
        : [this.item];
      if (this.actor) {
        await _velvetSetActorSoundConfigForItems(this.actor, linkedItems, config);
        const existingImg = _velvetGetActorImageConfig(this.actor, this.item) ?? {};
        await _velvetSetActorImageConfig(this.actor, this.item, { ...existingImg, image: formData.actionImage ?? "" });
      }
      await Promise.all(linkedItems.map(linkedItem => linkedItem.update({
        [`flags.${VELVET_MODULE_ID}.soundPlaylist`]: config.playlist,
        [`flags.${VELVET_MODULE_ID}.soundTrack`]: config.track,
        [`flags.${VELVET_MODULE_ID}.soundVolume`]: config.volume
      })));
      const affectedCount = linkedItems.length;
      ui.notifications.info(
        affectedCount > 1
          ? `Sound saved for ${affectedCount} prepared copies of ${this.item.name}`
          : `Sound saved for ${this.item.name}`
      );
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    if (this.isStrike) {
      // Tab switching
      html.find(".velvet-sound-tab").on("click", ev => {
        this._activeTab = ev.currentTarget.dataset.tab;
        this.render();
      });

      // Playlist change per tab
      html.find("select[data-field='playlist']").on("change", ev => {
        const tab = ev.currentTarget.closest("[data-tab-panel]").dataset.tabPanel;
        this._tabPlaylists[tab] = ev.target.value;
        this.render();
      });

      // Volume slider label per tab
      html.find("input[data-field='volume']").on("input", ev => {
        const panel = ev.currentTarget.closest("[data-tab-panel]");
        panel.querySelector(".velvet-vol-val").textContent = Math.round(ev.target.value * 100) + "%";
      });

      // Preview per tab
      html.find(".velvet-sound-preview").on("click", ev => {
        const panel = ev.currentTarget.closest("[data-tab-panel]");
        const playlistId = panel.querySelector("[data-field='playlist']").value;
        const trackId = panel.querySelector("[data-field='track']").value;
        const volume = parseFloat(panel.querySelector("[data-field='volume']").value) || 0.8;
        if (playlistId && trackId) {
          _velvetPlayItemSound(playlistId, trackId, volume);
        } else {
          ui.notifications.warn("Select a playlist and track first.");
        }
      });

      // Clear per tab
      html.find(".velvet-sound-tab-clear").on("click", async ev => {
        const tab = ev.currentTarget.dataset.clearTab;
        this._tabPlaylists[tab] = "";
        const sounds = this.item.getFlag(VELVET_MODULE_ID, "sounds") ?? {};
        sounds[tab] = { playlist: "", track: "", volume: 0.8 };
        await this.item.setFlag(VELVET_MODULE_ID, "sounds", sounds);
        // Also update actor-level storage
        if (this.actor) {
          await _velvetSetActorSoundConfig(this.actor, this.item, { sounds });
        }
        ui.notifications.info(`${VelvetSoundConfig.ROLL_LABELS[tab]} sound cleared.`);
        this.render();
      });

      // Clear ALL
      html.find(".velvet-sound-clear-all").on("click", async () => {
        const empty = {};
        for (const key of VelvetSoundConfig.ROLL_TYPES) {
          empty[key] = { playlist: "", track: "", volume: 0.8 };
          this._tabPlaylists[key] = "";
        }
        await this.item.setFlag(VELVET_MODULE_ID, "sounds", empty);
        if (this.actor) {
          await _velvetRemoveActorSoundConfig(this.actor, this.item);
        }
        ui.notifications.info(`All strike sounds cleared for ${this.item.name}`);
        this.render();
      });

      // Action image — per-tab FilePicker
      html.find(".velvet-action-img-pick[data-tab-key]").on("click", ev => {
        const tabKey = ev.currentTarget.dataset.tabKey;
        const panel = html.find(`[data-tab-panel="${tabKey}"]`)[0];
        const hidden = panel?.querySelector(`[name="${tabKey}.actionImage"]`);
        const preview = panel?.querySelector(".velvet-action-img-preview");
        new FilePicker({
          type: "image",
          current: hidden?.value || "",
          callback: path => {
            if (hidden) hidden.value = path;
            if (preview) { preview.src = path; preview.style.display = ""; }
          }
        }).browse();
      });

      html.find(".velvet-action-img-clear-img[data-tab-key]").on("click", ev => {
        const tabKey = ev.currentTarget.dataset.tabKey;
        const panel = html.find(`[data-tab-panel="${tabKey}"]`)[0];
        const hidden = panel?.querySelector(`[name="${tabKey}.actionImage"]`);
        const preview = panel?.querySelector(".velvet-action-img-preview");
        if (hidden) hidden.value = "";
        if (preview) { preview.src = ""; preview.style.display = "none"; }
      });

    } else {
      // Simple mode listeners (non-strike items)
      html.find("select[name='playlist']").on("change", ev => {
        this._selectedPlaylist = ev.target.value;
        this.render();
      });

      html.find("input[name='volume']").on("input", ev => {
        html.find(".velvet-vol-val").text(Math.round(ev.target.value * 100) + "%");
      });

      html.find(".velvet-sound-preview").on("click", () => {
        const playlistId = html.find("[name='playlist']").val();
        const trackId = html.find("[name='track']").val();
        const volume = parseFloat(html.find("[name='volume']").val()) || 0.8;
        if (playlistId && trackId) {
          _velvetPlayItemSound(playlistId, trackId, volume);
        } else {
          ui.notifications.warn("Select a playlist and track first.");
        }
      });

      html.find(".velvet-sound-clear").on("click", async () => {
        const linkedItems = this.item.type === "spell"
          ? _velvetGetPreparedSpellGroup(this.actor, this.item)
          : [this.item];
        await Promise.all(linkedItems.map(linkedItem => linkedItem.update({
          [`flags.${VELVET_MODULE_ID}.soundPlaylist`]: "",
          [`flags.${VELVET_MODULE_ID}.soundTrack`]: "",
          [`flags.${VELVET_MODULE_ID}.soundVolume`]: 0.8
        })));
        if (this.actor) {
          await _velvetRemoveActorSoundConfigForItems(this.actor, linkedItems);
        }
        const affectedCount = linkedItems.length;
        ui.notifications.info(
          affectedCount > 1
            ? `Sound cleared for ${affectedCount} prepared copies of ${this.item.name}`
            : `Sound cleared for ${this.item.name}`
        );
        this._selectedPlaylist = "";
        this.render();
      });

      // Action image — simple mode FilePicker
      html.find(".velvet-action-img-pick:not([data-tab-key])").on("click", () => {
        const hidden = html.find("[name='actionImage']")[0];
        const preview = html.find(".velvet-action-img-preview")[0];
        new FilePicker({
          type: "image",
          current: hidden?.value || "",
          callback: path => {
            if (hidden) hidden.value = path;
            if (preview) { preview.src = path; preview.style.display = ""; }
          }
        }).browse();
      });

      html.find(".velvet-action-img-clear-img:not([data-tab-key])").on("click", () => {
        const hidden = html.find("[name='actionImage']")[0];
        const preview = html.find(".velvet-action-img-preview")[0];
        if (hidden) hidden.value = "";
        if (preview) { preview.src = ""; preview.style.display = "none"; }
      });
    }
  }
}

/* ============================================= */
/*  Module Registration                          */
/* ============================================= */

Hooks.once("init", () => {
  Actors.registerSheet("pf2e", VelvetCharacterSheet, {
    types: ["character"],
    makeDefault: false,
    label: "Velvet PF2e Sheet"
  });

  // Register Handlebars helpers
  Handlebars.registerHelper("eq", (a, b) => a === b);

  // Cache PF2e's AttributeBuilder class when it's first rendered from any sheet
  Hooks.on("renderApplication", (app) => {
    if (app.constructor.name === "AttributeBuilder" && !VelvetCharacterSheet._AttributeBuilderClass) {
      VelvetCharacterSheet._AttributeBuilderClass = app.constructor;
    }
  });

  console.log("Velvet PF2e Sheet | Registered");
});

/* ============================================= */
/*  Migration: Item flags → Actor-level storage  */
/* ============================================= */

/**
 * Migrate legacy item-level sound flags to actor-level storage.
 * Runs once per actor when Foundry is ready.
 */
Hooks.once("ready", () => {
  // Only the first GM runs migration
  if (!_velvetIsFirstGM()) return;

  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    // Skip if already migrated
    if (actor.getFlag(VELVET_MODULE_ID, "soundsMigrated")) continue;

    const batch = {};
    let hasMigration = false;

    for (const item of actor.items) {
      const key = _velvetSoundKey(item);

      // Check for strike-mode sounds on item
      const sounds = item.getFlag(VELVET_MODULE_ID, "sounds");
      if (sounds && Object.values(sounds).some(c => c?.playlist && c?.track)) {
        batch[key] = { sounds };
        hasMigration = true;
        continue;
      }

      // Check for simple-mode sounds on item
      const playlist = item.getFlag(VELVET_MODULE_ID, "soundPlaylist");
      const track = item.getFlag(VELVET_MODULE_ID, "soundTrack");
      if (playlist && track) {
        batch[key] = {
          playlist,
          track,
          volume: item.getFlag(VELVET_MODULE_ID, "soundVolume") ?? 0.8
        };
        hasMigration = true;
      }
    }

    if (hasMigration) {
      // Merge with any existing actor-level sounds
      const existing = actor.getFlag(VELVET_MODULE_ID, "itemSounds") ?? {};
      const merged = { ...existing, ...batch };
      actor.setFlag(VELVET_MODULE_ID, "itemSounds", merged).then(() => {
        actor.setFlag(VELVET_MODULE_ID, "soundsMigrated", true);
        console.log(`Velvet Sound | Migrated ${Object.keys(batch).length} item sounds to actor ${actor.name}`);
      });
    } else {
      actor.setFlag(VELVET_MODULE_ID, "soundsMigrated", true);
    }
  }
});

/* ============================================= */
/*  Sound Playback on Item Use (Chat Hook)       */
/* ============================================= */

/**
 * Determine the roll-type key from a PF2e ChatMessage for per-roll-type sound.
 * Returns: "attack1" | "attack2" | "attack3" | "damage" | "critical" | null
 */
function _velvetDetectRollType(message) {
  const ctx = message.flags?.pf2e?.context;
  if (!ctx) return null;

  const type = ctx.type;         // "attack-roll", "damage-roll", "spell-attack-roll"...

  // Damage rolls
  if (type === "damage-roll") {
    // Check if the outcome on the originating attack was a critical
    const outcomeType = ctx.outcome ?? message.flags?.pf2e?.context?.outcome;
    if (outcomeType === "criticalSuccess") return "critical";
    // Also check if the roll itself is flagged as critical damage
    if (message.flags?.pf2e?.origin?.rollOptions?.some?.(o => o === "check:outcome:critical-success")) return "critical";
    return "damage";
  }

  // Attack rolls (including spell attack rolls)
  if (type === "attack-roll" || type === "spell-attack-roll") {
    const mapIncreases = ctx.mapIncreases ?? ctx["map-increases"] ?? 0;
    if (mapIncreases === 0) return "attack1";
    if (mapIncreases === 1) return "attack2";
    if (mapIncreases >= 2) return "attack3";
    return "attack1";
  }

  return null;
}

/**
 * Resolve the sound config {playlist, track, volume} for an item + message.
 * Looks up from actor-level storage first, falls back to legacy item flags.
 */
function _velvetResolveSoundConfig(item, message) {
  // Get the owning actor
  const actor = item.parent ?? item.actor ?? null;
  const actorCfg = actor ? _velvetGetActorSoundConfig(actor, item) : null;

  // 1) Try actor-level per-roll-type sounds (strikes)
  const sounds = actorCfg?.sounds ?? item.getFlag(VELVET_MODULE_ID, "sounds");
  if (sounds) {
    const rollType = _velvetDetectRollType(message);
    if (rollType && sounds[rollType]) {
      const cfg = sounds[rollType];
      if (cfg.playlist && cfg.track) {
        console.log("Velvet Sound | Roll type:", rollType);
        return { playlist: cfg.playlist, track: cfg.track, volume: cfg.volume ?? 0.8 };
      }
    }
    // If we have a sounds object but no match for this specific roll type,
    // fall back to attack1 as default for any attack, or damage as default
    if (rollType) {
      const fallbackKey = rollType.startsWith("attack") ? "attack1" : "damage";
      const fb = sounds[fallbackKey];
      if (fb?.playlist && fb?.track) {
        console.log("Velvet Sound | Roll type fallback:", rollType, "→", fallbackKey);
        return { playlist: fb.playlist, track: fb.track, volume: fb.volume ?? 0.8 };
      }
    }
  }

  // 2) Actor-level simple sound
  if (actorCfg?.playlist && actorCfg?.track) {
    return {
      playlist: actorCfg.playlist,
      track: actorCfg.track,
      volume: actorCfg.volume ?? 0.8
    };
  }

  // 3) Legacy item-flag fallback (for data saved before migration)
  const playlistId = item.getFlag(VELVET_MODULE_ID, "soundPlaylist");
  const trackId = item.getFlag(VELVET_MODULE_ID, "soundTrack");
  if (playlistId && trackId) {
    return {
      playlist: playlistId,
      track: trackId,
      volume: item.getFlag(VELVET_MODULE_ID, "soundVolume") ?? 0.8
    };
  }

  return null;
}

Hooks.on("renderChatMessageHTML", async (message, html, data) => {
  // Only the first active GM processes sound playback
  if (!_velvetIsFirstGM()) return;

  // Skip if already played
  if (message.getFlag(VELVET_MODULE_ID, "soundPlayed")) return;

  let item = null;

  // --- Method 1: PF2e origin UUID (strikes, spells, actions) ---
  const originUuid = message.flags?.pf2e?.origin?.uuid;
  if (originUuid) {
    try {
      item = await fromUuid(originUuid);
      // fromUuid() returns null for PF2e synthetic items (e.g. xxPF2ExUNARMEDxx unarmed attack).
      // Fall back to resolving from the owning actor's items collection directly.
      if (!item) {
        const m = originUuid.match(/^Actor\.([^.]+)\.Item\.(.+)$/);
        if (m) {
          const actor = game.actors.get(m[1]);
          if (actor) item = actor.items.get(m[2]) ?? null;
        }
      }
      if (item) console.log("Velvet Sound | Item via origin UUID:", item.name, originUuid);
    } catch (e) {
      console.warn("Velvet Sound | Could not resolve origin UUID:", originUuid, e);
    }
  }

  // --- Method 2: PF2e casting / item embedded in message ---
  if (!item) {
    const castingId = message.flags?.pf2e?.casting?.id;
    if (castingId) {
      try {
        const speaker = message.speaker;
        const actor = _velvetResolveActor(speaker);
        if (actor) item = actor.items.get(castingId);
        if (item) console.log("Velvet Sound | Item via casting id:", item?.name);
      } catch (e) { /* ignore */ }
    }
  }

  // --- Method 3: HTML [data-item-id] (item card / description posts) ---
  if (!item) {
    try {
      const el = (html instanceof HTMLElement) ? html : (html[0] ?? html);
      const itemEl = el?.querySelector?.("[data-item-id]");
      if (itemEl) {
        const itemId = itemEl.dataset.itemId;
        const actor = _velvetResolveActor(message.speaker);
        if (actor && itemId) {
          item = actor.items.get(itemId);
          if (item) console.log("Velvet Sound | Item via data-item-id:", item?.name);
        }
      }
    } catch (e) { /* ignore */ }
  }

  // --- Method 4: HTML [data-item-uuid] fallback ---
  if (!item) {
    try {
      const el = (html instanceof HTMLElement) ? html : (html[0] ?? html);
      const uuidEl = el?.querySelector?.("[data-item-uuid]");
      if (uuidEl) {
        item = await fromUuid(uuidEl.dataset.itemUuid);
        if (item) console.log("Velvet Sound | Item via data-item-uuid:", item?.name);
      }
    } catch (e) { /* ignore */ }
  }

  if (!item) return;

  // Resolve the correct sound config (per-roll-type or legacy)
  const soundCfg = _velvetResolveSoundConfig(item, message);
  if (!soundCfg) return;

  console.log("Velvet Sound | Playing:", item.name, "| Playlist:", soundCfg.playlist, "| Track:", soundCfg.track, "| Vol:", soundCfg.volume);

  // Play the sound (synced to all clients via Foundry Playlist API)
  await _velvetPlayItemSound(soundCfg.playlist, soundCfg.track, soundCfg.volume);

  // Mark as played to prevent duplicate playback
  await message.setFlag(VELVET_MODULE_ID, "soundPlayed", true);
});

/** Resolve an actor from a ChatMessage speaker object */
function _velvetResolveActor(speaker) {
  if (!speaker) return null;
  if (speaker.scene && speaker.token) {
    const scene = game.scenes.get(speaker.scene);
    const token = scene?.tokens?.get(speaker.token);
    if (token?.actor) return token.actor;
  }
  if (speaker.actor) return game.actors.get(speaker.actor);
  return null;
}

/* ============================================= */
/*  Backup: createChatMessage hook               */
/*  Fires once when message is created (no HTML) */
/* ============================================= */

Hooks.on("createChatMessage", async (message, options, userId) => {
  if (!_velvetIsFirstGM()) return;
  if (message.getFlag(VELVET_MODULE_ID, "soundPlayed")) return;

  let item = null;

  // PF2e origin UUID
  const originUuid = message.flags?.pf2e?.origin?.uuid;
  if (originUuid) {
    try { item = await fromUuid(originUuid); } catch (e) { /* ignore */ }
  }

  // Casting ID fallback
  if (!item) {
    const castingId = message.flags?.pf2e?.casting?.id;
    if (castingId) {
      const actor = _velvetResolveActor(message.speaker);
      if (actor) item = actor.items.get(castingId);
    }
  }

  if (!item) return;

  const soundCfg = _velvetResolveSoundConfig(item, message);
  if (!soundCfg) return;

  console.log("Velvet Sound (create) | Playing:", item.name, "| Playlist:", soundCfg.playlist, "| Track:", soundCfg.track);

  await _velvetPlayItemSound(soundCfg.playlist, soundCfg.track, soundCfg.volume);
  await message.setFlag(VELVET_MODULE_ID, "soundPlayed", true);
});

// Action image hook — no GM guard, fires on all clients so every player sees the overlay.
Hooks.on("createChatMessage", async (message) => {
  try {
    let item = null;
    const originUuid = message.flags?.pf2e?.origin?.uuid;
    if (originUuid) {
      try { item = await fromUuid(originUuid); } catch (e) { /* ignore */ }
    }
    if (!item) {
      const castingId = message.flags?.pf2e?.casting?.id;
      if (castingId) {
        const actor = _velvetResolveActor(message.speaker);
        if (actor) item = actor.items.get(castingId);
      }
    }
    if (!item) return;

    const imagePath = _velvetResolveImageConfig(item, message);
    if (!imagePath) return;

    const actor = item.parent ?? item.actor ?? _velvetResolveActor(message.speaker);
    const pf2eType = _velvetDetectRollType(message);
    const rollType = pf2eType === "critical" ? "critical"
      : pf2eType === "damage" ? "damage"
      : pf2eType?.startsWith("attack") ? "attack"
      : "attack";

    Hooks.callAll("vnd-enhanced.actionImage", {
      imagePath,
      actorName: actor?.name ?? message.speaker?.alias ?? "",
      actorImg: actor?.img ?? "",
      actionName: item.name ?? "",
      rollType
    });
  } catch (e) {
    console.warn("Velvet Sheet | createChatMessage image error:", e);
  }
});
