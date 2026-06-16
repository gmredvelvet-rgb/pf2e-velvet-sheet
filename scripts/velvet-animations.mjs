/**
 * Velvet Animations — AAA-quality animation system for pf2e-velvet-sheet
 * Powered by GSAP 3 (global `gsap`) and Anime.js 3 (global `anime`)
 */

const VA = {
  /** Safety wrapper — returns gsap or null */
  get gsap() { return typeof gsap !== "undefined" ? gsap : null; },
  get anime() { return typeof anime !== "undefined" ? anime : null; },

  // ─────────────────────────────────────────────────────────────────────────
  // SHEET ENTRANCE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called once when the sheet first renders.
   * @param {jQuery} html
   */
  sheetEnter(html) {
    const g = this.gsap;
    if (!g) return;

    const sheet  = html[0];
    const tl = g.timeline({ defaults: { ease: "power3.out" } });

    // Force initial invisible state to prevent FOUC
    g.set(sheet.querySelector(".velvet-sidebar"),   { x: -28, opacity: 0 });
    g.set(sheet.querySelector(".center"),           { scale: 0.96, opacity: 0 });
    g.set(sheet.querySelector(".velvet-panel"),     { x: 28, opacity: 0 });
    g.set(sheet.querySelectorAll(".nav-item"),      { x: -12, opacity: 0 });
    g.set(sheet.querySelectorAll(".stat"),          { y: 14, opacity: 0 });
    g.set(sheet.querySelectorAll(".attr-quick-box"), { y: -10, opacity: 0 });
    g.set(sheet.querySelectorAll(".hp-fill, .sp-fill"), { scaleX: 0 });

    tl
      .to(sheet.querySelector(".velvet-sidebar"),  { x: 0, opacity: 1, duration: 0.45 })
      .to(sheet.querySelector(".center"),          { scale: 1, opacity: 1, duration: 0.4 }, "-=0.30")
      .to(sheet.querySelector(".velvet-panel"),    { x: 0, opacity: 1, duration: 0.45 }, "-=0.35")
      .to(sheet.querySelector(".char-name"),       { opacity: 1, y: 0, duration: 0.3, from: { y: -8, opacity: 0 } }, "-=0.25")
      .to(sheet.querySelectorAll(".nav-item"),     { x: 0, opacity: 1, stagger: 0.045, duration: 0.3 }, "-=0.2")
      .to(sheet.querySelectorAll(".attr-quick-box"), { y: 0, opacity: 1, stagger: 0.05, duration: 0.3, ease: "back.out(1.4)" }, "-=0.2")
      .to(sheet.querySelectorAll(".stat"),         { y: 0, opacity: 1, stagger: 0.04, duration: 0.28, ease: "power2.out" }, "-=0.25")
      .to(sheet.querySelectorAll(".hp-fill, .sp-fill"), {
          scaleX: 1, transformOrigin: "left center",
          duration: 0.55, stagger: 0.08, ease: "power2.out"
        }, "-=0.15")
      .add(() => this._startAmbientParticles(html), "-=0.2");
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TAB SWITCH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Animate the newly shown tab panel in.
   * @param {Element} panelEl  — the tab content element that was just made visible
   * @param {number}  dir      — +1 = going right / forward, -1 = going left / back
   */
  tabSwitch(panelEl, dir = 1) {
    const g = this.gsap;
    if (!g || !panelEl) return;
    g.fromTo(panelEl,
      { opacity: 0, x: dir * 16 },
      { opacity: 1, x: 0, duration: 0.22, ease: "power2.out" }
    );
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ROLL / ACTION BUTTON
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Elastic bounce + glow flash on any click-to-roll button.
   * @param {Element} btn
   */
  rollButtonClick(btn) {
    const g = this.gsap;
    if (!g || !btn) return;
    g.timeline()
      .to(btn, { scale: 0.80, duration: 0.07, ease: "power2.in" })
      .to(btn, { scale: 1.10, duration: 0.13, ease: "back.out(3.5)" })
      .to(btn, { scale: 1.00, duration: 0.10, ease: "power2.inOut" });

    g.to(btn, {
      boxShadow: "0 0 18px rgba(200,168,78,0.9), 0 0 36px rgba(200,168,78,0.45)",
      duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut"
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STRIKE ATTACK BUTTON
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * More dramatic animation for melee/ranged attack buttons.
   * @param {Element} btn
   */
  strikeRoll(btn) {
    const g = this.gsap;
    if (!g || !btn) return;
    g.timeline()
      .to(btn, { x: -5, duration: 0.06, ease: "power2.in" })
      .to(btn, { x: 3,  duration: 0.08, ease: "power2.out" })
      .to(btn, { x: -2, duration: 0.06, ease: "power2.in" })
      .to(btn, { x: 0,  duration: 0.12, ease: "elastic.out(1, 0.4)" })
      .to(btn, {
          scale: 1.06,
          boxShadow: "0 0 20px rgba(200,140,60,0.8)",
          duration: 0.10, yoyo: true, repeat: 1
        }, "<");
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HP BAR TWEEN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Smoothly animate HP fill bar, spawning a floating damage/heal number.
   * @param {jQuery} html
   * @param {number} newPct   — 0-100
   * @param {number} delta    — negative = damage, positive = healing
   */
  hpChange(html, newPct, delta) {
    const g = this.gsap;
    if (!g) return;

    const fill = html[0].querySelector(".hp-fill");
    if (!fill) return;

    const isDamage = delta < 0;
    g.to(fill, {
      width: `${Math.max(0, Math.min(100, newPct))}%`,
      duration: isDamage ? 0.55 : 0.80,
      ease: isDamage ? "power3.in" : "power2.out"
    });

    // Flash the bar
    g.to(fill, {
      filter: isDamage
        ? "brightness(2.2) saturate(0.3)"
        : "brightness(1.6) saturate(1.6)",
      duration: 0.12, yoyo: true, repeat: 1
    });

    // Shake sheet on damage
    if (isDamage) this._damageShake(html[0]);

    // Floating number
    this._floatNumber(html, delta);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONDITION PIP TOGGLE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {Element} pip
   * @param {boolean} filled
   */
  conditionPipToggle(pip, filled) {
    const g = this.gsap;
    if (!g || !pip) return;
    if (filled) {
      g.fromTo(pip,
        { scale: 0, rotation: -120 },
        { scale: 1, rotation: 0, duration: 0.38, ease: "back.out(2.5)" }
      );
    } else {
      g.to(pip, { scale: 0.5, opacity: 0.25, duration: 0.18, ease: "power2.in" });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HERO POINT CHANGE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {Element} pip
   * @param {boolean} gained
   */
  heroPointChange(pip, gained) {
    const g = this.gsap;
    if (!g || !pip) return;
    if (gained) {
      g.fromTo(pip,
        { scale: 2.2, opacity: 0.6, rotation: 30 },
        { scale: 1, opacity: 1, rotation: 0, duration: 0.55, ease: "back.out(2)" }
      );
    } else {
      g.timeline()
        .to(pip, { scale: 1.3, rotation: -30, duration: 0.1 })
        .to(pip, { scale: 0.8, opacity: 0.3, rotation: 0, duration: 0.2, ease: "power2.in" });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NAV ITEM CLICK
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {Element} navItem
   */
  navItemClick(navItem) {
    const g = this.gsap;
    if (!g || !navItem) return;
    g.fromTo(navItem,
      { x: -7 },
      { x: 0, duration: 0.35, ease: "elastic.out(1, 0.45)" }
    );
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INVENTORY / FEAT / SPELL ROW HOVER REVEAL
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Stagger-reveal items when a tab first becomes visible.
   * @param {jQuery} html
   * @param {string} selector
   */
  staggerReveal(html, selector) {
    const g = this.gsap;
    if (!g) return;
    const els = html[0].querySelectorAll(selector);
    if (!els.length) return;
    g.fromTo(els,
      { opacity: 0, x: 8 },
      { opacity: 1, x: 0, stagger: 0.025, duration: 0.22, ease: "power2.out" }
    );
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LOOT ITEM ADDED  (inventory row add)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {Element} rowEl
   */
  itemAdded(rowEl) {
    const g = this.gsap;
    if (!g || !rowEl) return;
    g.fromTo(rowEl,
      { backgroundColor: "rgba(200,168,78,0.35)", x: 10, opacity: 0 },
      { backgroundColor: "rgba(200,168,78,0)", x: 0, opacity: 1,
        duration: 0.55, ease: "power2.out" }
    );
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DYING PIPS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called when dying value increases — dramatic red flash.
   * @param {jQuery} html
   */
  dyingIncreased(html) {
    const g = this.gsap;
    if (!g) return;
    const sheet = html[0];
    g.to(sheet, {
      filter: "brightness(1.5) sepia(0.6) saturate(3)",
      duration: 0.15, yoyo: true, repeat: 3, ease: "power1.inOut"
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL: DAMAGE SHAKE
  // ─────────────────────────────────────────────────────────────────────────

  _damageShake(sheetEl) {
    const g = this.gsap;
    if (!g || !sheetEl) return;
    g.timeline()
      .to(sheetEl, { x: -6, duration: 0.04 })
      .to(sheetEl, { x:  5, duration: 0.04 })
      .to(sheetEl, { x: -4, duration: 0.04 })
      .to(sheetEl, { x:  2, duration: 0.04 })
      .to(sheetEl, { x:  0, duration: 0.06, ease: "power2.out" });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL: FLOATING NUMBER
  // ─────────────────────────────────────────────────────────────────────────

  _floatNumber(html, delta) {
    const g = this.gsap;
    if (!g || !delta) return;
    const container = html[0].querySelector(".center") || html[0];
    const el = document.createElement("div");
    el.className = "velvet-float-num " + (delta < 0 ? "velvet-float-dmg" : "velvet-float-heal");
    el.textContent = (delta > 0 ? "+" : "") + delta;
    // Random horizontal scatter
    const scatter = (Math.random() - 0.5) * 60;
    g.set(el, { x: 60 + scatter, y: 80, opacity: 1, scale: 0.8 });
    container.appendChild(el);
    g.timeline({ onComplete: () => el.remove() })
      .to(el, { scale: 1.4, duration: 0.12, ease: "back.out(2)" })
      .to(el, { y: -20, opacity: 0, scale: 1, duration: 1.2, ease: "power1.out" }, "+=0.2");
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL: AMBIENT EMBER PARTICLES
  // ─────────────────────────────────────────────────────────────────────────

  _ambientInterval: null,

  _startAmbientParticles(html) {
    const g = this.gsap;
    if (!g) return;
    const container = html[0].querySelector(".center");
    if (!container) return;
    container.style.position = "relative";
    container.style.overflow = "hidden";

    if (this._ambientInterval) clearInterval(this._ambientInterval);

    const spawn = () => {
      if (!container.isConnected) { clearInterval(this._ambientInterval); return; }
      const p = document.createElement("div");
      p.className = "velvet-ember";
      const size   = 2 + Math.random() * 3;
      const startX = Math.random() * 100;
      const driftX = (Math.random() - 0.5) * 50;
      const dur    = 3.5 + Math.random() * 3;
      g.set(p, {
        position: "absolute",
        bottom: "5%",
        left: startX + "%",
        width: size + "px",
        height: size + "px",
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(220,180,80,0.9) 0%, rgba(180,80,20,0.4) 60%, transparent 100%)`,
        pointerEvents: "none",
        opacity: 0,
        zIndex: 9
      });
      container.appendChild(p);
      g.timeline({ onComplete: () => p.remove() })
        .to(p, { opacity: 0.55 + Math.random() * 0.35, duration: dur * 0.25, ease: "power1.in" })
        .to(p, {
            y: -(160 + Math.random() * 100),
            x: driftX,
            opacity: 0,
            scale: 0.3,
            duration: dur * 0.75,
            ease: "power1.out"
          });
    };

    spawn();
    this._ambientInterval = setInterval(spawn, 900 + Math.random() * 400);
  },

  stopAmbientParticles() {
    if (this._ambientInterval) {
      clearInterval(this._ambientInterval);
      this._ambientInterval = null;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LEVEL UP BURST
  // ─────────────────────────────────────────────────────────────────────────

  levelUpBurst(html) {
    const g = this.gsap;
    if (!g) return;
    const sheet = html[0];
    // Golden flash overlay
    const overlay = document.createElement("div");
    overlay.className = "velvet-levelup-overlay";
    g.set(overlay, { opacity: 0 });
    sheet.appendChild(overlay);
    g.timeline({ onComplete: () => overlay.remove() })
      .to(overlay, { opacity: 0.7, duration: 0.15 })
      .to(overlay, { opacity: 0,   duration: 0.85, ease: "power2.out" });

    // Burst all stats
    sheet.querySelectorAll(".stat").forEach((el, i) => {
      g.to(el, {
        scale: 1.15,
        boxShadow: "0 0 20px rgba(200,168,78,0.9)",
        delay: i * 0.05,
        duration: 0.25, yoyo: true, repeat: 1, ease: "back.out(1.5)"
      });
    });
  }
};

// Export so velvet-sheet.mjs can import it
export default VA;

// Also expose on window for non-module usage
window.VelvetAnimations = VA;
