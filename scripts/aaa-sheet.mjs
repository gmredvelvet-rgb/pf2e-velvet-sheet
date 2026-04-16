/**
 * AAA PF2e Character Sheet — Foundry VTT Module
 * Custom RPG-style ActorSheet for Pathfinder 2e characters
 */

class AAACharacterSheet extends ActorSheet {

  /** Cached reference to PF2e's internal AttributeBuilder class */
  static _AttributeBuilderClass = null;

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["pf2e", "sheet", "actor", "aaa-sheet"],
      template: "modules/pf2e-aaa-sheet/templates/aaa-character-sheet.hbs",
      width: 900,
      height: 720,
      resizable: true,
      tabs: [],
      dragDrop: [{ dragSelector: "[data-item-id]", dropSelector: null }],
      scrollY: [".aaa-panel .tab"]
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
    context.bgImage = actor.getFlag("pf2e-aaa-sheet", "bgImage") ?? "";
    context.bgOpacity = actor.getFlag("pf2e-aaa-sheet", "bgOpacity") ?? 80;

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
      equipment: { label: "Equipment", type: "equipment", items: [] },
      consumables: { label: "Consumables", type: "consumable", items: [] },
      treasure: { label: "Treasure", type: "treasure", items: [] },
      containers: { label: "Containers", type: "backpack", items: [] }
    };

    for (const item of actor.items) {
      if (!["weapon", "armor", "equipment", "consumable", "treasure", "backpack"].includes(item.type)) continue;
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
        price: item.system.price?.value?.gp ?? 0
      };

      switch (item.type) {
        case "weapon": inventory.weapons.items.push(ctx); break;
        case "armor": inventory.armor.items.push(ctx); break;
        case "equipment": inventory.equipment.items.push(ctx); break;
        case "consumable": inventory.consumables.items.push(ctx); break;
        case "treasure": inventory.treasure.items.push(ctx); break;
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
          isCantrip: spell.isCantrip ?? spell.system.level?.value === 0
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
              expended: p?.expended ?? false,
              name: spellItem?.name ?? null,
              img: spellItem?.img ?? null,
              empty: !p?.id
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
        category: item.system.category ?? "bonus"
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
      if (item.type !== "action") continue;
      const ctx = {
        id: item.id,
        name: item.name,
        img: item.img,
        actionType: item.system.actionType?.value ?? "",
        actionCost: item.actionCost?.type ?? item.system.actionType?.value ?? "",
        actions: item.actionCost?.value ?? item.system.actions?.value ?? null,
        traits: (item.system.traits?.value ?? []).join(", "),
        description: item.system.description?.value ?? ""
      };

      if (ctx.actionType === "reaction" || ctx.actionCost === "reaction") {
        actions.reactions.items.push(ctx);
      } else if (ctx.actionType === "free" || ctx.actionCost === "free") {
        actions.free.items.push(ctx);
      } else {
        actions.actions.items.push(ctx);
      }
    }
    return actions;
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
        weaponId: s.item?.id ?? null
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
    const equipped = actor.getFlag("pf2e-aaa-sheet", "paperDollSlots") ?? {};
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

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Manual tab navigation
    html.find(".nav-item").click(ev => {
      const tab = ev.currentTarget.dataset.tab;
      if (!tab) return;
      html.find(".nav-item").removeClass("active");
      $(ev.currentTarget).addClass("active");
      html.find(".aaa-panel > .tab").removeClass("active");
      html.find(`.aaa-panel > .tab[data-tab="${tab}"]`).addClass("active");
      this._activeTab = tab;
    });

    // Restore last active tab
    if (this._activeTab) {
      html.find(".nav-item").removeClass("active");
      html.find(`.nav-item[data-tab="${this._activeTab}"]`).addClass("active");
      html.find(".aaa-panel > .tab").removeClass("active");
      html.find(`.aaa-panel > .tab[data-tab="${this._activeTab}"]`).addClass("active");
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

    // HP low-health pulse
    const hp = this.actor.system.attributes?.hp;
    if (hp && hp.max > 0 && (hp.value / hp.max) <= 0.25) {
      html.find(".hp-fill").addClass("hp-low");
    }

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
    const panelOpacity = (this.actor.getFlag("pf2e-aaa-sheet", "bgOpacity") ?? 80) / 100;
    const sheet = html.find(".dnd-sheet")[0];
    if (sheet) sheet.style.setProperty("--aaa-panel-opacity", panelOpacity);

    // Everything below only for owners
    if (!this.isEditable) return;

    // Background settings dialog
    html.find(".bg-picker").click(ev => {
      const currentBg = this.actor.getFlag("pf2e-aaa-sheet", "bgImage") ?? "";
      const currentOp = this.actor.getFlag("pf2e-aaa-sheet", "bgOpacity") ?? 80;
      const dlgContent = `
        <form class="aaa-bg-settings">
          <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:4px;font-weight:600;color:#c8a84e;">Background Image / Video</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="text" name="bgPath" value="${currentBg}" style="flex:1;background:#1a1a1a;border:1px solid #444;color:#ccc;padding:4px 6px;" placeholder="Path to image or video...">
              <button type="button" class="aaa-bg-browse" style="padding:4px 10px;cursor:pointer;"><i class="fas fa-folder-open"></i></button>
            </div>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:600;color:#c8a84e;">Panel Darkness: <span class="aaa-op-val">${currentOp}%</span></label>
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
              this.actor.setFlag("pf2e-aaa-sheet", "bgImage", path);
              this.actor.setFlag("pf2e-aaa-sheet", "bgOpacity", opacity);
            }
          },
          clear: {
            icon: '<i class="fas fa-trash"></i>',
            label: "Clear BG",
            callback: () => this.actor.setFlag("pf2e-aaa-sheet", "bgImage", "")
          }
        },
        default: "save",
        render: dlgHtml => {
          dlgHtml.find(".aaa-bg-browse").click(() => {
            const fp = new FilePicker({
              type: "imagevideo",
              current: dlgHtml.find("[name=bgPath]").val(),
              callback: path => dlgHtml.find("[name=bgPath]").val(path)
            });
            fp.browse();
          });
          dlgHtml.find("[name=bgOpacity]").on("input", e => {
            const val = e.target.value;
            dlgHtml.find(".aaa-op-val").text(val + "%");
            const s = this.element.find(".dnd-sheet")[0];
            if (s) s.style.setProperty("--aaa-panel-opacity", val / 100);
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
      const save = ev.currentTarget.dataset.save;
      if (!save) return;
      const nativeEvent = ev.originalEvent ?? ev;
      const stat = this.actor.saves?.[save];
      if (stat?.roll) stat.roll({ event: nativeEvent });
    });

    // Skill roll
    html.find(".skill-row").click(ev => {
      const skill = ev.currentTarget.dataset.skill;
      if (!skill) return;
      const nativeEvent = ev.originalEvent ?? ev;
      const stat = this.actor.skills?.[skill];
      if (stat?.roll) stat.roll({ event: nativeEvent });
    });

    // Perception roll
    html.find(".perception-roll").click(ev => {
      const nativeEvent = ev.originalEvent ?? ev;
      const stat = this.actor.perception;
      if (stat?.roll) stat.roll({ event: nativeEvent });
    });

    // Strike attack rolls (with MAP variants)
    html.find(".strike-attack").click(ev => {
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
      const idx = Number(ev.currentTarget.dataset.strikeIdx);
      const nativeEvent = ev.originalEvent ?? ev;
      const strike = this.actor.system.actions?.[idx];
      if (strike?.damage) strike.damage({ event: nativeEvent });
    });

    // Strike critical damage roll
    html.find(".strike-critical").click(ev => {
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

    // Item roll / use
    html.find(".item-roll").click(ev => {
      const itemId = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const item = this.actor.items.get(itemId);
      const nativeEvent = (ev.originalEvent ?? ev);
      if (item?.toMessage) item.toMessage(nativeEvent);
      else if (item?.toChat) item.toChat(nativeEvent);
      else if (item?.use) item.use();
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

    // Prep slot click - toggle expended/unexpended
    html.find(".prep-slot:not(.empty)").click(ev => {
      // Don't toggle if clicking on a control button
      if (ev.target.closest(".prep-slot-controls")) return;
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
      if (!isNaN(value)) this.actor.update({ "system.attributes.hp.value": value });
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
        // PF2e tracks these via condition items — use the PF2e API if available
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
      if (AAACharacterSheet._AttributeBuilderClass) {
        new AAACharacterSheet._AttributeBuilderClass(this.actor).render(true);
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
            if (builder) AAACharacterSheet._AttributeBuilderClass = builder.constructor;
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

    // Initiative roll
    html.find(".initiative-roll").click(ev => {
      const nativeEvent = ev.originalEvent ?? ev;
      this.actor.initiative?.roll?.({ event: nativeEvent })
        ?? this.actor.rollInitiative?.({ event: nativeEvent });
    });

    // Portrait click to change
    html.find(".portrait").click(ev => {
      if (!this.isEditable) return;
      if (html.find(".paperdoll-overlay.active").length) return;
      const fp = new FilePicker({
        type: "image",
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
        const slots = foundry.utils.deepClone(this.actor.getFlag("pf2e-aaa-sheet", "paperDollSlots") ?? {});
        delete slots[slotKey];
        await this.actor.unsetFlag("pf2e-aaa-sheet", "paperDollSlots");
        await this.actor.setFlag("pf2e-aaa-sheet", "paperDollSlots", slots);
      }
    });

    // Paper Doll drop handler
    html.find(".pd-slot").each((i, el) => {
      el.addEventListener("dragover", ev => { ev.preventDefault(); el.classList.add("pd-drag-over"); });
      el.addEventListener("dragleave", () => el.classList.remove("pd-drag-over"));
      el.addEventListener("drop", async ev => {
        ev.preventDefault();
        el.classList.remove("pd-drag-over");
        if (!this.isEditable) return;
        try {
          const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
          if (data.type !== "Item") return;
          const item = this.actor.items.get(data.uuid?.split(".").pop()) || await Item.implementation.fromDropData(data);
          if (!item || item.parent !== this.actor) return;
          const slotKey = el.dataset.slot;
          const slots = this.actor.getFlag("pf2e-aaa-sheet", "paperDollSlots") ?? {};
          slots[slotKey] = item.id;
          await this.actor.setFlag("pf2e-aaa-sheet", "paperDollSlots", slots);
        } catch (e) { /* ignore bad data */ }
      });
    });

    // Unequip All
    html.find(".pd-unequip-all").click(async ev => {
      ev.stopPropagation();
      if (!this.isEditable) return;
      await this.actor.unsetFlag("pf2e-aaa-sheet", "paperDollSlots");
    });
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
          const slots = this.actor.getFlag("pf2e-aaa-sheet", "paperDollSlots") ?? {};
          slots[slotKey] = id;
          await this.actor.setFlag("pf2e-aaa-sheet", "paperDollSlots", slots);
          dlg.close();
        });
      }
    });
    dlg.render(true);
  }
}

/* ============================================= */
/*  Module Registration                          */
/* ============================================= */

Hooks.once("init", () => {
  Actors.registerSheet("pf2e", AAACharacterSheet, {
    types: ["character"],
    makeDefault: false,
    label: "AAA PF2e Character Sheet"
  });

  // Register Handlebars helpers
  Handlebars.registerHelper("eq", (a, b) => a === b);

  // Cache PF2e's AttributeBuilder class when it's first rendered from any sheet
  Hooks.on("renderApplication", (app) => {
    if (app.constructor.name === "AttributeBuilder" && !AAACharacterSheet._AttributeBuilderClass) {
      AAACharacterSheet._AttributeBuilderClass = app.constructor;
    }
  });

  console.log("AAA PF2e Character Sheet | Registered");
});
