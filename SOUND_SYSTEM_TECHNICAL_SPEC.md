# Sistema de Sonidos por Item — Especificación Técnica

## Objetivo
Integrar nativamente en la hoja de personaje un sistema de sonidos por item (acciones, spells, cantrips, ataques, etc.) que replique y mejore la funcionalidad de "Item Track" del módulo **Maestro**. Al usar/atacar/lanzar cualquier item, un sonido configurado se reproduce **para todos los jugadores conectados**.

---

## 1. ARQUITECTURA DE MAESTRO (Referencia)

### 1.1 Cómo almacena los sonidos
Maestro usa **flags de Foundry** en cada Item para guardar la asociación sonido-item:

```javascript
// Estructura de flags en el item:
item.flags.maestro = {
  playlist: "playlistId",   // ID de la playlist de Foundry
  track: "trackId"          // ID del sonido dentro de esa playlist
                            // O un modo especial: "random-track" | "play-all"
}
```

Se guardan con:
```javascript
await item.update({
  "flags.maestro.playlist": playlistId,
  "flags.maestro.track": trackId
});
```

### 1.2 Cómo detecta el uso del item
Maestro intercepta los **mensajes de chat** mediante el hook `renderChatMessage`:

1. Cuando un item se usa (atacar, lanzar spell, etc.), el sistema crea un ChatMessage
2. Maestro busca el atributo `data-item-id` en el HTML del mensaje
3. Extrae el `itemId`, busca el item en el actor, lee sus flags, y reproduce el sonido

```javascript
Hooks.on("renderChatMessage", (message, html, data) => {
  const itemCard = html.find("[data-item-id]");
  const itemId = itemCard.attr("data-item-id");
  // ... busca el item → lee flags → reproduce sonido
});
```

> **⚠️ LIMITACIÓN DE MAESTRO:** Este método SOLO funciona si el HTML del chat contiene `data-item-id`. PF2e en versiones recientes **NO** pone ese atributo en sus mensajes de chat. En su lugar usa `message.flags.pf2e.origin.uuid`. Nuestra implementación resuelve esto con múltiples métodos de detección (ver sección 2.2).

### 1.3 Cómo reproduce el sonido para todos
Usa la **Playlist API nativa de Foundry**:

```javascript
const playlist = game.playlists.get(playlistId);
const sound = playlist.sounds.get(trackId);
await playlist.playSound(sound);
```

`playlist.playSound()` es un método nativo de Foundry que **sincroniza la reproducción en todos los clientes** automáticamente. No necesita sockets ni lógica adicional.

### 1.4 Cómo evita reproducir duplicados
Marca el mensaje con un flag después de reproducir:

```javascript
await message.setFlag("maestro", "item-track-played", true);
```

Antes de reproducir, verifica:
```javascript
const trackPlayed = message.getFlag("maestro", "item-track-played");
if (trackPlayed) return; // Ya se reprodujo, no repetir
```

### 1.5 Solo el GM primero ejecuta la reproducción
Para evitar que múltiples clientes intenten reproducir al mismo tiempo:

```javascript
function isFirstGM() {
  return game.user === game.users.find(u => u.isGM && u.active);
}
// Solo el primer GM activo procesa el sonido
if (!isFirstGM()) return;
```

### 1.6 UI de configuración (FormApplication)
Maestro usa un `FormApplication` con dos selects encadenados:
1. **Select de Playlist**: lista todas las playlists del mundo
2. **Select de Track**: lista los sonidos de la playlist seleccionada

Al cambiar la playlist, se re-renderiza el formulario mostrando los tracks de esa playlist.

---

## 2. PLAN DE IMPLEMENTACIÓN — Sistema Nativo en la Hoja

### 2.1 Almacenamiento de datos

Usaremos flags bajo nuestro namespace de módulo en cada Item:

```javascript
// Namespace: "pf2e-velvet-sheet" (para PF2e) o "dnd5e-velvet-sheet" (para D&D 5e)
item.flags["pf2e-velvet-sheet"] = {
  soundPlaylist: "playlistId",    // ID de playlist de Foundry
  soundTrack: "trackId",          // ID de track específico, "random-track", o ""
  soundVolume: 0.8                // Volumen relativo (0.0 - 1.0) [MEJORA sobre Maestro]
}
```

**Método para guardar:**
```javascript
await item.update({
  "flags.pf2e-velvet-sheet.soundPlaylist": playlistId,
  "flags.pf2e-velvet-sheet.soundTrack": trackId,
  "flags.pf2e-velvet-sheet.soundVolume": volume
});
```

**Método para leer:**
```javascript
const flags = item.getFlag("pf2e-velvet-sheet") ?? {};
const playlistId = flags.soundPlaylist;
const trackId = flags.soundTrack;
const volume = flags.soundVolume ?? 0.8;
```

### 2.2 Detección de uso del item (Multi-método)

> **PROBLEMA:** Cada sistema de juego (PF2e, dnd5e) almacena la referencia del item de forma diferente en el ChatMessage. Además, Foundry v12+ puede pasar `html` como HTMLElement o jQuery dependiendo de la versión. Nuestra implementación usa **4 métodos de detección** en cascada + un **hook de respaldo** para máxima compatibilidad.

#### Helper: Resolver actor desde speaker

```javascript
function _velvetResolveActor(speaker) {
  if (!speaker) return null;
  // Método 1: Token en escena (funciona con tokens linked y unlinked)
  if (speaker.scene && speaker.token) {
    const scene = game.scenes.get(speaker.scene);
    const token = scene?.tokens?.get(speaker.token);
    if (token?.actor) return token.actor;
  }
  // Método 2: Actor directo
  if (speaker.actor) return game.actors.get(speaker.actor);
  return null;
}
```

> **Nota:** NO usar `await fromUuid()` para resolver tokens — es lento y síncrono basta aquí. `scene.tokens.get()` es instantáneo.

#### Hook principal: renderChatMessage (4 métodos de detección)

```javascript
Hooks.on("renderChatMessage", async (message, html, data) => {
  if (!isFirstGM()) return;
  if (message.getFlag(MODULE_ID, "soundPlayed")) return;

  let item = null;

  // --- Método 1: Flags del sistema (PF2e: origin UUID) ---
  // PF2e guarda la referencia en message.flags.pf2e.origin.uuid
  // D&D 5e puede usar: message.flags.dnd5e?.roll?.itemUuid o similar
  const originUuid = message.flags?.pf2e?.origin?.uuid;  // ← ADAPTAR POR SISTEMA
  if (originUuid) {
    try {
      item = await fromUuid(originUuid);
    } catch (e) { /* ignore */ }
  }

  // --- Método 2: Casting ID del sistema (PF2e: spells) ---
  if (!item) {
    const castingId = message.flags?.pf2e?.casting?.id;  // ← ADAPTAR POR SISTEMA
    if (castingId) {
      const actor = _velvetResolveActor(message.speaker);
      if (actor) item = actor.items.get(castingId);
    }
  }

  // --- Método 3: HTML [data-item-id] (universal, estándar Foundry) ---
  // Importante: html puede ser HTMLElement (v12+) o jQuery (v11-)
  if (!item) {
    try {
      const el = (html instanceof HTMLElement) ? html : (html[0] ?? html);
      const itemEl = el?.querySelector?.("[data-item-id]");
      if (itemEl) {
        const itemId = itemEl.dataset.itemId;
        const actor = _velvetResolveActor(message.speaker);
        if (actor && itemId) item = actor.items.get(itemId);
      }
    } catch (e) { /* ignore */ }
  }

  // --- Método 4: HTML [data-item-uuid] (Foundry v12+) ---
  if (!item) {
    try {
      const el = (html instanceof HTMLElement) ? html : (html[0] ?? html);
      const uuidEl = el?.querySelector?.("[data-item-uuid]");
      if (uuidEl) item = await fromUuid(uuidEl.dataset.itemUuid);
    } catch (e) { /* ignore */ }
  }

  if (!item) return;

  // Leer flags de sonido
  const playlistId = item.getFlag(MODULE_ID, "soundPlaylist");
  const trackId = item.getFlag(MODULE_ID, "soundTrack");
  if (!playlistId || !trackId) return;

  const volume = item.getFlag(MODULE_ID, "soundVolume") ?? 0.8;

  // Reproducir
  await playItemSound(playlistId, trackId, volume);

  // Marcar como reproducido
  await message.setFlag(MODULE_ID, "soundPlayed", true);
});
```

#### Hook de respaldo: createChatMessage (sin HTML)

El hook `renderChatMessage` depende de que el mensaje ya esté renderizado. `createChatMessage` se dispara **exactamente una vez** cuando el mensaje se crea, no necesita HTML, y es más fiable:

```javascript
Hooks.on("createChatMessage", async (message, options, userId) => {
  if (!isFirstGM()) return;
  if (message.getFlag(MODULE_ID, "soundPlayed")) return;

  let item = null;

  // Flags del sistema (no hay HTML disponible aquí)
  const originUuid = message.flags?.pf2e?.origin?.uuid;  // ← ADAPTAR POR SISTEMA
  if (originUuid) {
    try { item = await fromUuid(originUuid); } catch (e) { /* ignore */ }
  }

  if (!item) {
    const castingId = message.flags?.pf2e?.casting?.id;  // ← ADAPTAR POR SISTEMA
    if (castingId) {
      const actor = _velvetResolveActor(message.speaker);
      if (actor) item = actor.items.get(castingId);
    }
  }

  if (!item) return;

  const playlistId = item.getFlag(MODULE_ID, "soundPlaylist");
  const trackId = item.getFlag(MODULE_ID, "soundTrack");
  if (!playlistId || !trackId) return;

  const volume = item.getFlag(MODULE_ID, "soundVolume") ?? 0.8;

  await playItemSound(playlistId, trackId, volume);
  await message.setFlag(MODULE_ID, "soundPlayed", true);
});
```

> **Ambos hooks usan el flag `soundPlayed`** para evitar doble reproducción. Si `createChatMessage` se dispara primero y reproduce el sonido, `renderChatMessage` lo ignora, y viceversa.

### 2.3 Reproducción del sonido

```javascript
async function playItemSound(playlistId, trackId) {
  const playlist = game.playlists.get(playlistId);
  if (!playlist) return;

  // Modo aleatorio
  if (trackId === "random-track") {
    const ids = playlist.sounds.map(s => s.id);
    trackId = ids[Math.floor(Math.random() * ids.length)];
  }

  // Modo "reproducir toda la playlist"
  if (trackId === "play-all") {
    return await playlist.playAll();
  }

  // Reproducir track específico
  const sound = playlist.sounds.get(trackId);
  if (!sound) return;

  await playlist.playSound(sound);
}
```

**¿Por qué `playlist.playSound()` funciona para todos?**
Porque Foundry sincroniza las acciones de Playlist/PlaylistSound a través de su sistema de documentos. Cuando el GM ejecuta `playSound()`, Foundry emite la actualización del documento a todos los clientes, que reproducen el sonido localmente.

### 2.4 UI — Botón de sonido en cada item de la hoja

#### Opción A: Icono inline en la lista de items
En el template HBS de la hoja, junto a cada item (acción, spell, ataque) añadimos un icono de nota musical:

```handlebars
{{!-- En la lista de items --}}
<li class="item" data-item-id="{{item._id}}">
  <span class="item-name">{{item.name}}</span>
  {{!-- Botón de configurar sonido --}}
  <a class="velvet-item-sound-config" data-item-id="{{item._id}}"
     title="Configure Sound">
    <i class="fas fa-music {{#if item.flags.pf2e-velvet-sheet.soundTrack}}active{{/if}}"></i>
  </a>
</li>
```

#### Opción B: Menú contextual (click derecho)
Al hacer click derecho en un item, aparece la opción "Configurar Sonido".

**Recomendación: Opción A** — es más visible e intuitivo.

### 2.5 Formulario de Configuración de Sonido

Un `Dialog` o `FormApplication` que aparece al clickear el icono de nota musical:

```javascript
class VelvetSoundConfig extends FormApplication {
  constructor(item, options = {}) {
    super(item, options);
    this.item = item;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "velvet-sound-config",
      title: "Item Sound Configuration",
      template: "modules/MODULE_ID/templates/velvet-sound-config.hbs",
      classes: ["velvet-sound-config"],
      width: 400,
      height: "auto"
    });
  }

  async getData() {
    const flags = this.item.flags[MODULE_ID] ?? {};
    return {
      playlists: game.playlists.contents,
      currentPlaylist: flags.soundPlaylist ?? "",
      currentTrack: flags.soundTrack ?? "",
      tracks: flags.soundPlaylist
        ? game.playlists.get(flags.soundPlaylist)?.sounds?.contents ?? []
        : [],
      volume: flags.soundVolume ?? 0.8
    };
  }

  async _updateObject(event, formData) {
    await this.item.update({
      [`flags.${MODULE_ID}.soundPlaylist`]: formData.playlist,
      [`flags.${MODULE_ID}.soundTrack`]: formData.track,
      [`flags.${MODULE_ID}.soundVolume`]: formData.volume
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    // Re-renderizar cuando cambia la playlist para actualizar la lista de tracks
    html.find("select[name='playlist']").on("change", ev => {
      const playlistId = ev.target.value;
      this.item.flags[MODULE_ID] = this.item.flags[MODULE_ID] ?? {};
      this.item.flags[MODULE_ID].soundPlaylist = playlistId;
      this.render();
    });

    // Botón de preview
    html.find(".velvet-sound-preview").on("click", () => {
      const playlistId = html.find("[name='playlist']").val();
      const trackId = html.find("[name='track']").val();
      if (playlistId && trackId) playItemSound(playlistId, trackId);
    });
  }
}
```

### 2.6 Template del formulario

```handlebars
<form class="velvet-sound-config-form" autocomplete="off">
  <div class="form-group">
    <label>Playlist</label>
    <select name="playlist">
      <option value="">— None —</option>
      {{#each playlists}}
      <option value="{{this.id}}" {{#if (eq this.id ../currentPlaylist)}}selected{{/if}}>
        {{this.name}}
      </option>
      {{/each}}
    </select>
  </div>

  <div class="form-group">
    <label>Track</label>
    <select name="track">
      <option value="">— None —</option>
      <option value="random-track" {{#if (eq ../currentTrack "random-track")}}selected{{/if}}>
        🎲 Random Track
      </option>
      {{#each tracks}}
      <option value="{{this.id}}" {{#if (eq this.id ../../currentTrack)}}selected{{/if}}>
        {{this.name}}
      </option>
      {{/each}}
    </select>
  </div>

  <div class="form-group">
    <label>Volume</label>
    <input type="range" name="volume" min="0" max="1" step="0.05" value="{{volume}}">
  </div>

  <div class="form-group buttons">
    <button type="button" class="velvet-sound-preview">
      <i class="fas fa-play"></i> Preview
    </button>
    <button type="submit">
      <i class="fas fa-save"></i> Save
    </button>
  </div>
</form>
```

---

## 3. MEJORAS SOBRE MAESTRO

| Característica | Maestro | Velvet Nativo |
|---|---|---|
| Requiere módulo externo | Sí | No — viene integrado |
| UI de configuración | Botón en header del ItemSheet | Icono inline visible en la hoja |
| Control de volumen por item | No | Sí — slider individual |
| Preview del sonido | No | Sí — botón de preview |
| Indicador visual de sonido asignado | No | Sí — icono se ilumina |
| Soporte items eliminados | Sí (guarda en settings) | Sí (misma técnica) |
| Modos de reproducción | Single / Random / Play All | Single / Random / Play All |

---

## 4. ARCHIVOS A CREAR/MODIFICAR

### 4.1 Archivos nuevos
| Archivo | Propósito |
|---|---|
| `templates/velvet-sound-config.hbs` | Template del formulario de configuración de sonido |

### 4.2 Archivos a modificar
| Archivo | Cambios |
|---|---|
| `scripts/velvet-sheet.mjs` | Agregar: clase `VelvetSoundConfig`, función `playItemSound()`, función `isFirstGM()`, hook `renderChatMessage`, listeners para botón de sonido, icono en la lista de items |
| `templates/velvet-character-sheet.hbs` | Agregar icono de nota musical junto a cada item en listas de actions/spells/attacks |
| `styles/velvet-sheet.css` | Estilos para el icono de sonido y el formulario de configuración |
| `lang/en.json` | Traducciones de labels del sistema de sonido |
| `lang/es.json` | Traducciones en español |
| `module.json` | No requiere cambios (no hay dependencias nuevas) |

---

## 5. FLUJO COMPLETO (Diagrama de secuencia)

```
=== CONFIGURACIÓN ===

1. GM/Jugador abre la hoja de personaje
2. Ve sus items (ataques, spells, acciones) con un icono 🎵 junto a cada uno
3. Clickea el icono 🎵 → se abre VelvetSoundConfig (formulario)
4. Selecciona Playlist → se cargan los tracks de esa playlist
5. Selecciona un Track (o "Random") → opcionalmente ajusta volumen
6. Clickea "Preview" para escuchar → clickea "Save"
7. Los flags se guardan en el Item: flags.MODULE_ID.soundPlaylist, .soundTrack, .soundVolume
8. El icono 🎵 se ilumina indicando que tiene sonido configurado

=== REPRODUCCIÓN (cuando se usa el item) ===

 9. Jugador clickea "Atacar" / "Usar" / "Lanzar" en la hoja
10. Foundry crea un ChatMessage
11. DOS hooks se disparan en paralelo:

    ┌─ createChatMessage (PRIMERO, sin HTML) ─────────────────┐
    │ a. ¿Es primer GM activo? → Sí                           │
    │ b. ¿Flag soundPlayed existe? → No                       │
    │ c. Lee message.flags.pf2e.origin.uuid (o dnd5e equiv.)  │
    │ d. Resuelve el item con fromUuid()                      │
    │ e. Lee flags de sonido del item                         │
    │ f. Ejecuta playlist.playSound(sound)                    │
    │ g. Foundry sincroniza → TODOS los clientes lo escuchan  │
    │ h. Marca message con flag "soundPlayed" = true           │
    └─────────────────────────────────────────────────────────┘

    ┌─ renderChatMessage (DESPUÉS, con HTML) ─────────────────┐
    │ a. ¿Es primer GM activo? → Sí                           │
    │ b. ¿Flag soundPlayed existe? → SÍ (ya lo puso create)  │
    │ c. RETURN — no reproduce de nuevo                       │
    │                                                         │
    │ (Si createChatMessage falló, este hook es el respaldo   │
    │  con 4 métodos de detección incluyendo HTML parsing)    │
    └─────────────────────────────────────────────────────────┘

=== MÉTODOS DE DETECCIÓN (en orden de prioridad) ===

1. message.flags.pf2e.origin.uuid  → fromUuid() → Item
2. message.flags.pf2e.casting.id   → actor.items.get() → Item
3. HTML [data-item-id]             → actor.items.get() → Item
4. HTML [data-item-uuid]           → fromUuid() → Item
```

---

## 6. ADAPTACIÓN PARA D&D 5e

El sistema es **casi idéntico** pero requiere cambios en cómo se detecta el item en el ChatMessage.

### 6.1 Diferencias por sistema

| Aspecto | PF2e | D&D 5e |
|---|---|---|
| Namespace del módulo | `pf2e-velvet-sheet` | `dnd5e-velvet-sheet` |
| Sistema requerido | `pf2e` | `dnd5e` |
| **Flag de origin en ChatMessage** | `message.flags.pf2e.origin.uuid` | `message.flags.dnd5e.roll.itemUuid` o `message.flags.dnd5e.use.itemUuid` |
| **Flag de casting** | `message.flags.pf2e.casting.id` | N/A (dnd5e usa el mismo UUID) |
| **HTML data attributes** | Puede no tener `data-item-id` | `data-item-id` (más fiable en dnd5e) |
| Hook recomendado | `createChatMessage` (primario) | `createChatMessage` (primario) |
| Items que soportan sonido | actions, spells, feats, strikes | weapons, spells, features |
| jQuery vs HTMLElement | Foundry v12+ → HTMLElement | Foundry v12+ → HTMLElement |

### 6.2 Cambios específicos en el hook de detección

En el hook `createChatMessage` y `renderChatMessage`, cambiar los métodos 1 y 2:

```javascript
// ========== PF2e (actual) ==========
const originUuid = message.flags?.pf2e?.origin?.uuid;
const castingId = message.flags?.pf2e?.casting?.id;

// ========== D&D 5e (adaptar a) ==========
// dnd5e almacena el item UUID en varios lugares según la versión:
const originUuid = message.flags?.dnd5e?.use?.itemUuid    // dnd5e 3.x+
                ?? message.flags?.dnd5e?.roll?.itemUuid   // dnd5e 2.x
                ?? message.flags?.dnd5e?.itemId;          // dnd5e legacy

// Si itemId es un ID (no UUID), resolver manualmente:
if (originUuid && !originUuid.includes(".")) {
  // Es un ID simple, no un UUID — resolver desde el actor
  const actor = _velvetResolveActor(message.speaker);
  item = actor?.items?.get(originUuid);
} else if (originUuid) {
  item = await fromUuid(originUuid);
}
```

> **⚠️ IMPORTANTE:** Antes de implementar, inspeccionar en la consola de Foundry qué flags tiene un ChatMessage de dnd5e:
> ```javascript
> // En la consola del navegador (F12) después de usar un item:
> game.messages.contents.at(-1).flags
> ```
> Esto mostrará la estructura exacta de flags que usa tu versión de dnd5e.

### 6.3 Pasos para adaptar

1. **Copiar 1:1** (sin cambios):
   - `VelvetSoundConfig` (FormApplication) — es 100% genérica de Foundry
   - `_velvetPlayItemSound()` — usa Playlist API nativa
   - `_velvetIsFirstGM()` — es genérica de Foundry
   - `_velvetResolveActor()` — es genérica de Foundry
   - Template `velvet-sound-config.hbs`
   - CSS del formulario de configuración

2. **Copiar y ADAPTAR** (cambiar flags del sistema):
   - Hook `createChatMessage` — cambiar `message.flags?.pf2e?.origin?.uuid` por el equivalente dnd5e
   - Hook `renderChatMessage` — mismos cambios + los métodos HTML (3 y 4) funcionan igual
   - `MODULE_ID` constante — cambiar a `"dnd5e-velvet-sheet"`

3. **Crear nuevo** (específico del sistema):
   - La hoja de personaje (template HBS y clase ActorSheet)
   - Los iconos 🎵 en las listas de items de dnd5e (weapons, spells, features)
   - Las funciones `_prepare*()` con el flag `hasSound`

### 6.4 Compatibilidad jQuery / HTMLElement

Foundry v12+ pasó de jQuery a HTMLElement en los hooks de renderizado. El código debe manejar ambos:

```javascript
// SIEMPRE usar este patrón para acceder al DOM del chat:
const el = (html instanceof HTMLElement) ? html : (html[0] ?? html);
const itemEl = el?.querySelector?.("[data-item-id]");

// NUNCA asumir jQuery:
// html.find("...")  ← FALLA en Foundry v12+ con HTMLElement
```

---

## 7. APIs DE FOUNDRY UTILIZADAS

| API | Propósito | Docs |
|---|---|---|
| `item.update({flags...})` | Guardar configuración de sonido | Document#update |
| `item.getFlag(scope, key)` | Leer configuración de sonido | Document#getFlag |
| `message.setFlag(scope, key, value)` | Marcar mensaje como procesado | Document#setFlag |
| `message.getFlag(scope, key)` | Verificar si ya se procesó | Document#getFlag |
| `game.playlists.get(id)` | Obtener playlist por ID | WorldCollection#get |
| `playlist.sounds.get(id)` | Obtener sound por ID | EmbeddedCollection#get |
| `playlist.playSound(sound)` | Reproducir (sincronizado a todos) | Playlist#playSound |
| `playlist.playAll()` | Reproducir toda la playlist | Playlist#playAll |
| `Hooks.on("renderChatMessage", fn)` | Interceptar mensajes renderizados | Hooks.on |
| `Hooks.on("createChatMessage", fn)` | Interceptar mensajes al crearse (más fiable) | Hooks.on |
| `FormApplication` | Formulario de configuración | FormApplication |
| `fromUuid(uuid)` | Resolver item/token/actor desde UUID | fromUuid |
| `scene.tokens.get(id)` | Resolver token desde escena (síncrono) | TokenDocument |

---

## 8. CONSIDERACIONES DE SEGURIDAD Y RENDIMIENTO

1. **Solo el primer GM procesa** — evita reproducción múltiple
2. **Flag de "ya reproducido"** — evita re-reproducción al re-renderizar el chat
3. **Doble hook con deduplicación** — `createChatMessage` + `renderChatMessage` con flag compartido `soundPlayed`
4. **Validación de IDs** — verificar que playlist y track existen antes de reproducir
5. **Null-safe** — usar optional chaining (`?.`) en toda la cadena de resolución
6. **No bloquea** — toda la reproducción es async, no bloquea la UI
7. **Sin sockets custom** — usa la sincronización nativa de Foundry (más robusto)
8. **jQuery/HTMLElement compatible** — `(html instanceof HTMLElement) ? html : (html[0] ?? html)` para Foundry v11-v14
9. **Actor resolver síncrono** — `scene.tokens.get()` en vez de `fromUuid()` para mejor rendimiento
10. **try/catch en cada método** — si un método falla, el siguiente lo intenta sin romper todo

---

## 9. CHANGELOG DE CORRECCIONES

### v1.1 — Fix: Sonido no se reproducía al usar items

**Problema:** El hook original usaba solo `html.find("[data-item-id]")` para detectar el item. PF2e no incluye `data-item-id` en el HTML de sus mensajes de chat. Además, `html.find()` fallaba en Foundry v12+ porque `html` es un HTMLElement, no jQuery.

**Solución:**
- Añadidos 4 métodos de detección en cascada (flags del sistema → casting ID → data-item-id → data-item-uuid)
- Añadido hook `createChatMessage` como respaldo (no depende de HTML)
- Extraída función `_velvetResolveActor()` para resolución síncrona de actores
- Compatibilidad jQuery/HTMLElement en parsing de HTML
