// Main Engine: Menus, Multi-World Manager, Audio Synth, 2.5D Renderer & Gameplay

(() => {
  Textures.init();

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const miniCanvas = document.getElementById('minimap');
  const miniCtx = miniCanvas.getContext('2d');
  const lightCanvas = document.createElement('canvas');
  const lightCtx = lightCanvas.getContext('2d');

  function resizeCanvas() {
    const w = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 800);
    const h = Math.max(240, window.innerHeight || document.documentElement.clientHeight || 600);
    canvas.width = w;
    canvas.height = h;
    lightCanvas.width = w;
    lightCanvas.height = h;
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ==================== WEB AUDIO RETRO SYNTH ====================
  const Sound = (() => {
    let audioCtx = null;
    function ensureCtx() {
      if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }
    function play(freq, type = 'square', duration = 0.08, endFreq = null) {
      if (settings.volume <= 0) return;
      ensureCtx();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
      const vol = (settings.volume / 100) * 0.12;
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    }
    return {
      hit: () => play(170, 'square', 0.07, 90),
      breakBlock: () => play(120, 'triangle', 0.12, 55),
      place: () => play(240, 'square', 0.06, 310),
      hurt: () => play(140, 'sawtooth', 0.16, 65),
      eat: () => play(320, 'sine', 0.09, 440),
      portal: () => play(280, 'sine', 0.35, 620),
      click: () => play(420, 'square', 0.04)
    };
  })();

  // ==================== PROFILE & GLOBAL SETTINGS ====================
  let profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') || structuredClone(DEFAULT_PROFILE);
  let settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {}) };

  function saveProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    document.getElementById('menu-username-label').textContent = profile.username;
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  // ==================== WORLD GENERATOR & MULTI-WORLD SAVE ====================
  function createEmptyGrid(val) {
    return Array.from({ length: WORLD_SIZE }, () => Array(WORLD_SIZE).fill(val));
  }

  function setDimObject(dim, tx, ty, type, state = 0) {
    dim.objects[ty][tx] = type;
    dim.objState[ty][tx] = state;
    const hpMap = {
      [OBJ.TREE]: 35, [OBJ.PINE_TREE]: 35, [OBJ.CACTUS]: 20, [OBJ.STUMP]: 18,
      [OBJ.ROCK]: 45, [OBJ.COAL_ORE]: 55, [OBJ.IRON_ORE]: 75, [OBJ.GOLD_ORE]: 95,
      [OBJ.DIAMOND_ORE]: 130, [OBJ.OBSIDIAN]: 200, [OBJ.QUARTZ_ORE]: 65,
      [OBJ.ANCIENT_DEBRIS]: 180, [OBJ.BERRY_BUSH]: 12,
      [OBJ.WALL_WOOD]: 90, [OBJ.WALL_STONE]: 220, [OBJ.DOOR_WOOD]: 80,
      [OBJ.FURNACE]: 100, [OBJ.CAMPFIRE]: 60, [OBJ.TORCH]: 15, [OBJ.BED]: 50,
      [OBJ.END_CRYSTAL]: 40, [OBJ.SCULK_SENSOR]: 30, [OBJ.ANCIENT_CHEST]: 25
    };
    const hp = hpMap[type] || 0;
    dim.objHp[ty][tx] = hp;
    dim.objMaxHp[ty][tx] = hp;
  }

  function clearSafeArea(dim, tx, ty, radius, floorType) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = tx + dx, ny = ty + dy;
        if (nx > 1 && ny > 1 && nx < WORLD_SIZE - 2 && ny < WORLD_SIZE - 2) {
          dim.terrain[ny][nx] = floorType;
          dim.objects[ny][nx] = OBJ.NONE;
        }
      }
    }
  }

  function buildDimensionsFromSeed(seedStr) {
    const rng = new SeededRandom(seedStr);
    const cx = Math.floor(WORLD_SIZE / 2);
    const cy = Math.floor(WORLD_SIZE / 2);
    const phaseX = rng.next() * 20;
    const phaseY = rng.next() * 20;

    // 1. Overworld
    const ow = {
      terrain: createEmptyGrid(TERRAIN.GRASS),
      objects: createEmptyGrid(OBJ.NONE),
      roof: createEmptyGrid(false),
      objHp: createEmptyGrid(0),
      objMaxHp: createEmptyGrid(0),
      objState: createEmptyGrid(0),
      mobs: []
    };

    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        if (x <= 1 || y <= 1 || x >= WORLD_SIZE - 2 || y >= WORLD_SIZE - 2) {
          ow.terrain[y][x] = TERRAIN.WATER;
          continue;
        }
        const temp = Math.sin((x + phaseX) * 0.11) + Math.cos((y + phaseY) * 0.09);
        const moist = Math.cos((x - phaseX) * 0.08 - y * 0.1);
        const distSpawn = Math.hypot(x - cx, y - cy);

        if (distSpawn < 5) ow.terrain[y][x] = TERRAIN.GRASS;
        else if (Math.hypot(x - 14, y - 15) < 4.5 || Math.hypot(x - 45, y - 44) < 5) ow.terrain[y][x] = TERRAIN.WATER;
        else if (temp > 0.78) ow.terrain[y][x] = TERRAIN.SAND;
        else if (temp < -0.78) ow.terrain[y][x] = TERRAIN.SNOW;
        else if (moist > 0.32) ow.terrain[y][x] = TERRAIN.FOREST;
        else ow.terrain[y][x] = TERRAIN.GRASS;

        if (distSpawn < 4) continue;
        const r = rng.next();
        const t = ow.terrain[y][x];
        if (t === TERRAIN.GRASS) {
          if (r < 0.08) setDimObject(ow, x, y, OBJ.TREE);
          else if (r < 0.12) setDimObject(ow, x, y, OBJ.ROCK);
          else if (r < 0.14) setDimObject(ow, x, y, OBJ.COAL_ORE);
          else if (r < 0.16) setDimObject(ow, x, y, OBJ.BERRY_BUSH);
        } else if (t === TERRAIN.FOREST) {
          if (r < 0.21) setDimObject(ow, x, y, OBJ.TREE);
          else if (r < 0.24) setDimObject(ow, x, y, OBJ.BERRY_BUSH);
          else if (r < 0.26) setDimObject(ow, x, y, OBJ.ROCK);
        } else if (t === TERRAIN.SNOW) {
          if (r < 0.14) setDimObject(ow, x, y, OBJ.PINE_TREE);
          else if (r < 0.18) setDimObject(ow, x, y, OBJ.COAL_ORE);
        } else if (t === TERRAIN.SAND) {
          if (r < 0.07) setDimObject(ow, x, y, OBJ.CACTUS);
          else if (r < 0.10) setDimObject(ow, x, y, OBJ.ROCK);
        }
      }
    }

    const caveSpots = [{ x: cx + 6, y: cy - 4 }, { x: 16, y: 40 }, { x: 44, y: 16 }];
    for (const cs of caveSpots) {
      ow.terrain[cs.y][cs.x] = TERRAIN.GRASS;
      setDimObject(ow, cs.x, cs.y, OBJ.CAVE_DOWN);
    }

    // 2. Caves & Deep Dark
    const caves = {
      terrain: createEmptyGrid(TERRAIN.STONE_FLOOR),
      objects: createEmptyGrid(OBJ.NONE),
      roof: createEmptyGrid(false),
      objHp: createEmptyGrid(0),
      objMaxHp: createEmptyGrid(0),
      objState: createEmptyGrid(0),
      mobs: []
    };
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        const isDeepDark = y > 37;
        caves.terrain[y][x] = isDeepDark ? TERRAIN.DEEPSLATE : TERRAIN.STONE_FLOOR;
        if (x <= 1 || y <= 1 || x >= WORLD_SIZE - 2 || y >= WORLD_SIZE - 2) {
          setDimObject(caves, x, y, OBJ.ROCK);
          continue;
        }
        const open = Math.sin((x + phaseX) * 0.22) * Math.cos((y + phaseY) * 0.22) + Math.sin((x + y) * 0.12);
        if (open < -0.52) {
          setDimObject(caves, x, y, OBJ.ROCK);
          continue;
        }
        const r = rng.next();
        if (isDeepDark) {
          if (r < 0.24) caves.terrain[y][x] = TERRAIN.SCULK;
          if (r < 0.03) setDimObject(caves, x, y, OBJ.SCULK_SENSOR);
          else if (r < 0.055) setDimObject(caves, x, y, OBJ.DIAMOND_ORE);
          else if (r < 0.068) setDimObject(caves, x, y, OBJ.ANCIENT_CHEST);
        } else {
          if (r < 0.045) setDimObject(caves, x, y, OBJ.COAL_ORE);
          else if (r < 0.085) setDimObject(caves, x, y, OBJ.IRON_ORE);
          else if (r < 0.105) setDimObject(caves, x, y, OBJ.GOLD_ORE);
          else if (r < 0.12) setDimObject(caves, x, y, OBJ.DIAMOND_ORE);
          else if (r < 0.132) caves.terrain[y][x] = TERRAIN.LAVA;
          else if (r < 0.145) setDimObject(caves, x, y, OBJ.OBSIDIAN);
        }
      }
    }
    for (const cs of caveSpots) {
      clearSafeArea(caves, cs.x, cs.y, 2, TERRAIN.STONE_FLOOR);
      setDimObject(caves, cs.x, cs.y, OBJ.CAVE_UP);
    }
    clearSafeArea(caves, 30, 48, 3, TERRAIN.SCULK);
    setDimObject(caves, 30, 48, OBJ.ANCIENT_CHEST);
    setDimObject(caves, 28, 47, OBJ.SCULK_SENSOR);

    // 3. The Nether
    const nether = {
      terrain: createEmptyGrid(TERRAIN.NETHERRACK),
      objects: createEmptyGrid(OBJ.NONE),
      roof: createEmptyGrid(false),
      objHp: createEmptyGrid(0),
      objMaxHp: createEmptyGrid(0),
      objState: createEmptyGrid(0),
      mobs: []
    };
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        if (x <= 1 || y <= 1 || x >= WORLD_SIZE - 2 || y >= WORLD_SIZE - 2) {
          nether.terrain[y][x] = TERRAIN.LAVA;
          continue;
        }
        if (Math.sin((x + phaseX) * 0.16) + Math.cos((y + phaseY) * 0.16) > 1.15) {
          nether.terrain[y][x] = TERRAIN.LAVA;
          continue;
        }
        const r = rng.next();
        if (r < 0.05) setDimObject(nether, x, y, OBJ.QUARTZ_ORE);
        else if (r < 0.068) setDimObject(nether, x, y, OBJ.ANCIENT_DEBRIS);
        else if (r < 0.09) setDimObject(nether, x, y, OBJ.OBSIDIAN);
      }
    }

    // 4. The End
    const end = {
      terrain: createEmptyGrid(TERRAIN.VOID),
      objects: createEmptyGrid(OBJ.NONE),
      roof: createEmptyGrid(false),
      objHp: createEmptyGrid(0),
      objMaxHp: createEmptyGrid(0),
      objState: createEmptyGrid(0),
      mobs: []
    };
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        if (Math.hypot(x - cx, y - cy) < 18 + Math.sin(x * 0.4) * 1.5) {
          end.terrain[y][x] = TERRAIN.END_STONE;
        }
      }
    }
    const pillars = [{ x: cx - 8, y: cy - 8 }, { x: cx + 8, y: cy - 8 }, { x: cx - 8, y: cy + 8 }, { x: cx + 8, y: cy + 8 }];
    for (const p of pillars) {
      end.terrain[p.y][p.x] = TERRAIN.END_STONE;
      setDimObject(end, p.x, p.y, OBJ.END_CRYSTAL);
    }
    clearSafeArea(end, cx, cy + 13, 2, TERRAIN.END_STONE);
    setDimObject(end, cx, cy + 13, OBJ.END_PORTAL);
    end.mobs.push({
      kind: 'ender_dragon', x: cx * TILE_W, y: (cy - 4) * TILE_H,
      vx: 0, vy: 0, radius: 24, hp: 200, maxHp: 200, speed: 115, timer: 0, boss: true
    });

    return { overworld: ow, caves, nether, end };
  }

  // ==================== WORLD STORAGE MANAGEMENT ====================
  function getWorldsIndex() {
    return JSON.parse(localStorage.getItem(WORLDS_INDEX_KEY) || '[]');
  }
  function saveWorldsIndex(list) {
    localStorage.setItem(WORLDS_INDEX_KEY, JSON.stringify(list));
  }
  function worldStorageKey(id) {
    return `pmc_25d_world_${id}`;
  }

  function createNewWorldData(opts) {
    const id = 'w_' + Date.now();
    const seed = opts.seed.trim() || String(Math.floor(100000 + Math.random() * 900000));
    const cx = Math.floor(WORLD_SIZE / 2);
    const cy = Math.floor(WORLD_SIZE / 2);
    const inventory = Array(24).fill(null);

    if (opts.bonusChest) {
      inventory[0] = { id: 'wood_axe', count: 1 };
      inventory[1] = { id: 'wood_pick', count: 1 };
      inventory[2] = { id: 'apple', count: 5 };
      inventory[3] = { id: 'planks', count: 12 };
    } else {
      inventory[0] = { id: 'apple', count: 2 };
    }

    const worldData = {
      id,
      name: opts.name.trim() || 'New Survival World',
      seed,
      gameMode: opts.gameMode, // 'survival' | 'creative'
      difficulty: opts.difficulty, // 'peaceful' | 'easy' | 'normal' | 'hard'
      keepInventory: opts.keepInventory,
      daylightCycle: true,
      currentDim: 'overworld',
      worldTime: 0.22,
      dayCount: 1,
      lastPlayed: Date.now(),
      player: {
        x: (cx + 0.5) * TILE_W,
        y: (cy + 0.5) * TILE_H,
        spawnDim: 'overworld',
        spawnX: (cx + 0.5) * TILE_W,
        spawnY: (cy + 0.5) * TILE_H,
        radius: 12,
        speed: 185,
        hp: 20,
        maxHp: 20,
        hunger: 20,
        maxHunger: 20,
        armor: null,
        selectedSlot: 0,
        angle: 0,
        walkPhase: 0,
        swingTimer: 0,
        swingDuration: 0.22,
        invulnTimer: 0,
        isDead: false,
        dragonSlain: false
      },
      inventory,
      dims: buildDimensionsFromSeed(seed)
    };

    localStorage.setItem(worldStorageKey(id), JSON.stringify(worldData));
    const idx = getWorldsIndex();
    idx.unshift({
      id,
      name: worldData.name,
      gameMode: worldData.gameMode,
      difficulty: worldData.difficulty,
      seed: worldData.seed,
      dayCount: 1,
      lastPlayed: Date.now()
    });
    saveWorldsIndex(idx);
    return worldData;
  }

  // ==================== ACTIVE GAME STATE ====================
  let activeWorld = null;
  let isPlaying = false;
  let selectedWorldId = null;
  let editingWorldId = null;

  // Background panoramic preview world for Main Menu
  const menuPanoramaWorld = {
    currentDim: 'overworld',
    worldTime: 0.22,
    dims: buildDimensionsFromSeed('WelcomeTo25D'),
    player: { x: 30 * TILE_W, y: 30 * TILE_H }
  };

  function persistActiveWorld() {
    if (!activeWorld) return;
    activeWorld.lastPlayed = Date.now();
    localStorage.setItem(worldStorageKey(activeWorld.id), JSON.stringify(activeWorld));
    const idx = getWorldsIndex();
    const entry = idx.find((w) => w.id === activeWorld.id);
    if (entry) {
      entry.name = activeWorld.name;
      entry.gameMode = activeWorld.gameMode;
      entry.difficulty = activeWorld.difficulty;
      entry.dayCount = activeWorld.dayCount;
      entry.lastPlayed = activeWorld.lastPlayed;
      saveWorldsIndex(idx);
    }
  }

  function launchWorld(worldId) {
    const raw = localStorage.getItem(worldStorageKey(worldId));
    if (!raw) return;
    activeWorld = JSON.parse(raw);
    isPlaying = true;
    craftOpen = false;
    pauseOpen = false;

    document.querySelectorAll('.menu-screen').forEach((s) => s.classList.remove('active'));
    document.getElementById('hud-layer').classList.remove('hidden');
    document.getElementById('modal-craft').classList.add('hidden');
    document.getElementById('modal-pause').classList.add('hidden');
    document.getElementById('modal-death').classList.add('hidden');

    resizeCanvas();
    camera.x = activeWorld.player.x;
    camera.y = activeWorld.player.y;
    renderInventoryUI();
    updatePauseWorldButtons();
  }

  // ==================== SCREEN & MENU CONTROLLERS ====================
  function showScreen(id) {
    document.querySelectorAll('.menu-screen').forEach((s) => s.classList.remove('active'));
    if (id) document.getElementById(id).classList.add('active');
  }

  // Main Menu buttons
  document.getElementById('menu-username-label').textContent = profile.username;
  document.getElementById('btn-goto-worlds').onclick = () => {
    Sound.click();
    renderWorldList();
    showScreen('screen-worlds');
  };
  document.getElementById('btn-goto-skin').onclick = () => {
    Sound.click();
    openSkinEditor();
  };
  let optionsReturnToPause = false;
  document.getElementById('btn-goto-options').onclick = () => {
    Sound.click();
    optionsReturnToPause = false;
    syncOptionsUI();
    showScreen('screen-options');
  };

  // World Select Screen
  function renderWorldList() {
    const listEl = document.getElementById('world-list');
    const worlds = getWorldsIndex();
    listEl.innerHTML = '';

    if (worlds.length === 0) {
      listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-size:11px;">No worlds yet. Click "Create New World" to start!</div>';
      selectedWorldId = null;
    } else {
      if (!selectedWorldId || !worlds.some((w) => w.id === selectedWorldId)) {
        selectedWorldId = worlds[0].id;
      }
      for (const w of worlds) {
        const div = document.createElement('div');
        div.className = 'world-item' + (w.id === selectedWorldId ? ' selected' : '');
        const dateStr = new Date(w.lastPlayed).toLocaleDateString();
        div.innerHTML = `
          <div>
            <div class="world-item-title">${w.name}</div>
            <div class="world-item-meta">${w.gameMode.toUpperCase()} • ${w.difficulty.toUpperCase()} • Day ${w.dayCount} • Seed: ${w.seed}</div>
          </div>
          <div class="world-item-meta">${dateStr}</div>
        `;
        div.onclick = () => {
          Sound.click();
          selectedWorldId = w.id;
          renderWorldList();
        };
        div.ondblclick = () => launchWorld(w.id);
        listEl.appendChild(div);
      }
    }

    const hasSel = Boolean(selectedWorldId);
    document.getElementById('btn-play-selected').disabled = !hasSel;
    document.getElementById('btn-edit-world').disabled = !hasSel;
    document.getElementById('btn-delete-world').disabled = !hasSel;
  }

  document.getElementById('btn-play-selected').onclick = () => {
    if (selectedWorldId) { Sound.click(); launchWorld(selectedWorldId); }
  };
  document.getElementById('btn-worlds-back').onclick = () => {
    Sound.click();
    showScreen('screen-main-menu');
  };
  document.getElementById('btn-delete-world').onclick = () => {
    if (!selectedWorldId) return;
    Sound.click();
    localStorage.removeItem(worldStorageKey(selectedWorldId));
    saveWorldsIndex(getWorldsIndex().filter((w) => w.id !== selectedWorldId));
    selectedWorldId = null;
    renderWorldList();
  };

  // Create / Edit World Screen
  let draftMode = 'survival';
  let draftDiff = 'normal';
  let draftBonus = false;
  let draftKeepInv = false;

  const modes = ['survival', 'creative'];
  const diffs = ['peaceful', 'easy', 'normal', 'hard'];

  function syncCreateWorldButtons() {
    document.getElementById('btn-toggle-gamemode').textContent = `Mode: ${draftMode[0].toUpperCase() + draftMode.slice(1)}`;
    document.getElementById('btn-toggle-difficulty').textContent = `Difficulty: ${draftDiff[0].toUpperCase() + draftDiff.slice(1)}`;
    document.getElementById('btn-toggle-bonus').textContent = `Bonus Chest: ${draftBonus ? 'ON' : 'OFF'}`;
    document.getElementById('btn-toggle-keepinv').textContent = `Keep Inventory: ${draftKeepInv ? 'ON' : 'OFF'}`;
  }

  document.getElementById('btn-open-create-world').onclick = () => {
    Sound.click();
    editingWorldId = null;
    document.getElementById('create-world-title').textContent = 'Create New World';
    document.getElementById('btn-confirm-create-world').textContent = 'Create New World';
    document.getElementById('input-world-name').value = 'New Survival World';
    document.getElementById('input-world-seed').value = '';
    document.getElementById('input-world-seed').disabled = false;
    draftMode = 'survival';
    draftDiff = 'normal';
    draftBonus = false;
    draftKeepInv = false;
    syncCreateWorldButtons();
    showScreen('screen-create-world');
  };

  document.getElementById('btn-edit-world').onclick = () => {
    if (!selectedWorldId) return;
    const raw = localStorage.getItem(worldStorageKey(selectedWorldId));
    if (!raw) return;
    const w = JSON.parse(raw);
    Sound.click();
    editingWorldId = w.id;
    document.getElementById('create-world-title').textContent = 'Edit World Settings';
    document.getElementById('btn-confirm-create-world').textContent = 'Save Changes';
    document.getElementById('input-world-name').value = w.name;
    document.getElementById('input-world-seed').value = w.seed;
    document.getElementById('input-world-seed').disabled = true;
    draftMode = w.gameMode;
    draftDiff = w.difficulty;
    draftBonus = false;
    draftKeepInv = Boolean(w.keepInventory);
    syncCreateWorldButtons();
    showScreen('screen-create-world');
  };

  document.getElementById('btn-toggle-gamemode').onclick = () => {
    Sound.click();
    draftMode = modes[(modes.indexOf(draftMode) + 1) % modes.length];
    syncCreateWorldButtons();
  };
  document.getElementById('btn-toggle-difficulty').onclick = () => {
    Sound.click();
    draftDiff = diffs[(diffs.indexOf(draftDiff) + 1) % diffs.length];
    syncCreateWorldButtons();
  };
  document.getElementById('btn-toggle-bonus').onclick = () => {
    Sound.click();
    draftBonus = !draftBonus;
    syncCreateWorldButtons();
  };
  document.getElementById('btn-toggle-keepinv').onclick = () => {
    Sound.click();
    draftKeepInv = !draftKeepInv;
    syncCreateWorldButtons();
  };
  document.getElementById('btn-cancel-create-world').onclick = () => {
    Sound.click();
    showScreen('screen-worlds');
  };
  document.getElementById('btn-confirm-create-world').onclick = () => {
    Sound.click();
    if (editingWorldId) {
      const raw = localStorage.getItem(worldStorageKey(editingWorldId));
      if (raw) {
        const w = JSON.parse(raw);
        w.name = document.getElementById('input-world-name').value.trim() || w.name;
        w.gameMode = draftMode;
        w.difficulty = draftDiff;
        w.keepInventory = draftKeepInv;
        localStorage.setItem(worldStorageKey(editingWorldId), JSON.stringify(w));
        const idx = getWorldsIndex();
        const item = idx.find((x) => x.id === editingWorldId);
        if (item) {
          item.name = w.name;
          item.gameMode = w.gameMode;
          item.difficulty = w.difficulty;
          saveWorldsIndex(idx);
        }
      }
      renderWorldList();
      showScreen('screen-worlds');
    } else {
      const created = createNewWorldData({
        name: document.getElementById('input-world-name').value,
        seed: document.getElementById('input-world-seed').value,
        gameMode: draftMode,
        difficulty: draftDiff,
        bonusChest: draftBonus,
        keepInventory: draftKeepInv
      });
      launchWorld(created.id);
    }
  };

  // Skin & Profile Customizer
  const skinPreviewCanvas = document.getElementById('skin-preview-canvas');
  const skinPreviewCtx = skinPreviewCanvas.getContext('2d');
  let skinPreviewRaf = null;

  function openSkinEditor() {
    document.getElementById('input-username').value = profile.username;
    document.getElementById('col-skin').value = profile.skin.skin;
    document.getElementById('col-hair').value = profile.skin.hair;
    document.getElementById('col-eyes').value = profile.skin.eyes;
    document.getElementById('col-shirt').value = profile.skin.shirt;
    document.getElementById('col-pants').value = profile.skin.pants;

    const presetsEl = document.getElementById('skin-presets');
    presetsEl.innerHTML = '';
    for (const [name, cols] of Object.entries(SKIN_PRESETS)) {
      const chip = document.createElement('button');
      chip.className = 'preset-chip';
      chip.textContent = name;
      chip.onclick = () => {
        Sound.click();
        profile.skin = { ...cols };
        document.getElementById('col-skin').value = cols.skin;
        document.getElementById('col-hair').value = cols.hair;
        document.getElementById('col-eyes').value = cols.eyes;
        document.getElementById('col-shirt').value = cols.shirt;
        document.getElementById('col-pants').value = cols.pants;
      };
      presetsEl.appendChild(chip);
    }

    ['skin', 'hair', 'eyes', 'shirt', 'pants'].forEach((part) => {
      document.getElementById(`col-${part}`).oninput = (e) => {
        profile.skin[part] = e.target.value;
      };
    });

    showScreen('screen-skin');
    let phase = 0;
    const renderPreview = () => {
      if (!document.getElementById('screen-skin').classList.contains('active')) return;
      phase += 0.06;
      skinPreviewCtx.clearRect(0, 0, 160, 190);
      skinPreviewCtx.save();
      skinPreviewCtx.scale(2.5, 2.5);
      Textures.drawPlayerSprite(skinPreviewCtx, 32, 64, profile.skin, Math.sin(phase * 0.5) * 0.5, phase, 0, null, 'diamond_sword');
      skinPreviewCtx.restore();

      const nameVal = document.getElementById('input-username').value.trim() || 'Player';
      skinPreviewCtx.font = 'bold 11px Silkscreen, monospace';
      skinPreviewCtx.textAlign = 'center';
      skinPreviewCtx.fillStyle = '#ffff55';
      skinPreviewCtx.fillText(nameVal, 80, 22);
      skinPreviewRaf = requestAnimationFrame(renderPreview);
    };
    if (skinPreviewRaf) cancelAnimationFrame(skinPreviewRaf);
    renderPreview();
  }

  document.getElementById('btn-save-skin').onclick = () => {
    Sound.click();
    profile.username = document.getElementById('input-username').value.trim() || 'Steve';
    saveProfile();
    showScreen('screen-main-menu');
  };

  // Global Options Menu
  function syncOptionsUI() {
    document.getElementById('opt-zoom').value = settings.zoom;
    document.getElementById('lbl-zoom').textContent = `${settings.zoom}%`;
    document.getElementById('opt-brightness').value = settings.brightness;
    document.getElementById('lbl-brightness').textContent = settings.brightness > 70 ? 'Bright' : settings.brightness < 40 ? 'Moody' : `${settings.brightness}%`;
    document.getElementById('opt-render').value = settings.renderDistance;
    document.getElementById('lbl-render').textContent = `${settings.renderDistance} tiles`;
    document.getElementById('opt-volume').value = settings.volume;
    document.getElementById('lbl-volume').textContent = `${settings.volume}%`;

    document.getElementById('btn-opt-minimap').textContent = `Minimap: ${settings.showMinimap ? 'ON' : 'OFF'}`;
    document.getElementById('btn-opt-coords').textContent = `Coordinates: ${settings.showCoords ? 'ON' : 'OFF'}`;
    document.getElementById('btn-opt-lighting').textContent = `Dynamic Lighting: ${settings.dynamicLighting ? 'ON' : 'OFF'}`;
    document.getElementById('btn-opt-autosave').textContent = `Auto-Save: ${settings.autoSave ? 'ON' : 'OFF'}`;
  }

  document.getElementById('opt-zoom').oninput = (e) => {
    settings.zoom = Number(e.target.value);
    syncOptionsUI();
  };
  document.getElementById('opt-brightness').oninput = (e) => {
    settings.brightness = Number(e.target.value);
    syncOptionsUI();
  };
  document.getElementById('opt-render').oninput = (e) => {
    settings.renderDistance = Number(e.target.value);
    syncOptionsUI();
  };
  document.getElementById('opt-volume').oninput = (e) => {
    settings.volume = Number(e.target.value);
    syncOptionsUI();
  };
  document.getElementById('btn-opt-minimap').onclick = () => {
    settings.showMinimap = !settings.showMinimap;
    document.getElementById('minimap').classList.toggle('hidden', !settings.showMinimap);
    syncOptionsUI();
  };
  document.getElementById('btn-opt-coords').onclick = () => {
    settings.showCoords = !settings.showCoords;
    document.getElementById('hud-coords').classList.toggle('hidden', !settings.showCoords);
    syncOptionsUI();
  };
  document.getElementById('btn-opt-lighting').onclick = () => {
    settings.dynamicLighting = !settings.dynamicLighting;
    syncOptionsUI();
  };
  document.getElementById('btn-opt-autosave').onclick = () => {
    settings.autoSave = !settings.autoSave;
    syncOptionsUI();
  };
  document.getElementById('btn-options-done').onclick = () => {
    Sound.click();
    saveSettings();
    if (optionsReturnToPause) {
      showScreen(null);
      document.getElementById('modal-pause').classList.remove('hidden');
    } else {
      showScreen('screen-main-menu');
    }
  };

  // ==================== IN-GAME INPUT, CRAFTING & PAUSE ====================
  const keys = {};
  const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };
  let craftOpen = false;
  let pauseOpen = false;
  let activeCategory = 'all';

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (!isPlaying || !activeWorld) return;

    if (e.code >= 'Digit1' && e.code <= 'Digit9') {
      activeWorld.player.selectedSlot = parseInt(e.code.replace('Digit', ''), 10) - 1;
      renderInventoryUI();
    }
    if ((e.code === 'KeyE' || e.code === 'KeyC') && !pauseOpen && !activeWorld.player.isDead) {
      toggleCraftModal();
    }
    if (e.code === 'Escape') {
      if (craftOpen) toggleCraftModal(false);
      else if (!activeWorld.player.isDead) togglePauseModal();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  window.addEventListener('wheel', (e) => {
    if (!isPlaying || craftOpen || pauseOpen || !activeWorld) return;
    const p = activeWorld.player;
    p.selectedSlot = e.deltaY > 0 ? (p.selectedSlot + 1) % 9 : (p.selectedSlot + 8) % 9;
    renderInventoryUI();
  });

  canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!isPlaying || craftOpen || pauseOpen || !activeWorld || activeWorld.player.isDead) return;
    if (e.button === 0) {
      mouse.down = true;
      handlePrimaryAction();
    } else if (e.button === 2) {
      handleSecondaryAction();
    }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  document.getElementById('btn-hud-craft').onclick = () => toggleCraftModal();
  document.getElementById('btn-close-craft').onclick = () => toggleCraftModal(false);
  document.getElementById('btn-hud-pause').onclick = () => togglePauseModal();
  document.getElementById('btn-resume').onclick = () => togglePauseModal(false);

  document.getElementById('btn-pause-options').onclick = () => {
    Sound.click();
    optionsReturnToPause = true;
    document.getElementById('modal-pause').classList.add('hidden');
    syncOptionsUI();
    showScreen('screen-options');
  };

  function updatePauseWorldButtons() {
    if (!activeWorld) return;
    document.getElementById('btn-world-diff').textContent = `Difficulty: ${activeWorld.difficulty.toUpperCase()}`;
    document.getElementById('btn-world-mode').textContent = `Mode: ${activeWorld.gameMode.toUpperCase()}`;
    document.getElementById('btn-world-keepinv').textContent = `Keep Inv: ${activeWorld.keepInventory ? 'ON' : 'OFF'}`;
    document.getElementById('btn-world-daycycle').textContent = `Day Cycle: ${activeWorld.daylightCycle ? 'ON' : 'OFF'}`;
  }

  document.getElementById('btn-world-diff').onclick = () => {
    activeWorld.difficulty = diffs[(diffs.indexOf(activeWorld.difficulty) + 1) % diffs.length];
    updatePauseWorldButtons();
  };
  document.getElementById('btn-world-mode').onclick = () => {
    activeWorld.gameMode = modes[(modes.indexOf(activeWorld.gameMode) + 1) % modes.length];
    updatePauseWorldButtons();
    renderInventoryUI();
  };
  document.getElementById('btn-world-keepinv').onclick = () => {
    activeWorld.keepInventory = !activeWorld.keepInventory;
    updatePauseWorldButtons();
  };
  document.getElementById('btn-world-daycycle').onclick = () => {
    activeWorld.daylightCycle = !activeWorld.daylightCycle;
    updatePauseWorldButtons();
  };
  document.getElementById('btn-set-day').onclick = () => { activeWorld.worldTime = 0.22; Sound.click(); };
  document.getElementById('btn-set-night').onclick = () => { activeWorld.worldTime = 0.75; Sound.click(); };

  document.getElementById('btn-save-quit').onclick = () => {
    Sound.click();
    persistActiveWorld();
    isPlaying = false;
    activeWorld = null;
    document.getElementById('hud-layer').classList.add('hidden');
    document.getElementById('modal-pause').classList.add('hidden');
    showScreen('screen-main-menu');
  };

  document.getElementById('btn-respawn').onclick = () => {
    const p = activeWorld.player;
    p.isDead = false;
    p.hp = p.maxHp;
    p.hunger = p.maxHunger;
    activeWorld.currentDim = p.spawnDim;
    p.x = p.spawnX;
    p.y = p.spawnY;
    document.getElementById('modal-death').classList.add('hidden');
  };
  document.getElementById('btn-death-title').onclick = () => {
    document.getElementById('btn-save-quit').click();
  };

  function toggleCraftModal(force) {
    craftOpen = typeof force === 'boolean' ? force : !craftOpen;
    document.getElementById('modal-craft').classList.toggle('hidden', !craftOpen);
    mouse.down = false;
    if (craftOpen) renderInventoryUI();
  }

  function togglePauseModal(force) {
    pauseOpen = typeof force === 'boolean' ? force : !pauseOpen;
    document.getElementById('modal-pause').classList.toggle('hidden', !pauseOpen);
    mouse.down = false;
    if (pauseOpen) updatePauseWorldButtons();
  }

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      renderInventoryUI();
    };
  });

  // ==================== INVENTORY & CRAFTING UI ====================
  function addItem(id, count = 1) {
    const def = ITEMS[id];
    if (!def || !activeWorld) return false;
    const inv = activeWorld.inventory;
    if (def.stack > 1) {
      for (let i = 0; i < inv.length; i++) {
        if (inv[i] && inv[i].id === id && inv[i].count < def.stack) {
          const add = Math.min(count, def.stack - inv[i].count);
          inv[i].count += add;
          count -= add;
          if (count <= 0) { renderInventoryUI(); return true; }
        }
      }
    }
    for (let i = 0; i < inv.length; i++) {
      if (!inv[i]) {
        const add = Math.min(count, def.stack);
        inv[i] = { id, count: add };
        count -= add;
        if (count <= 0) { renderInventoryUI(); return true; }
      }
    }
    renderInventoryUI();
    return count === 0;
  }

  function countItem(id) {
    if (!activeWorld) return 0;
    if (activeWorld.gameMode === 'creative') return 999;
    let total = 0;
    for (const s of activeWorld.inventory) if (s && s.id === id) total += s.count;
    return total;
  }

  function removeItem(id, count) {
    if (!activeWorld || activeWorld.gameMode === 'creative') return;
    const inv = activeWorld.inventory;
    for (let i = inv.length - 1; i >= 0; i--) {
      if (inv[i] && inv[i].id === id) {
        const take = Math.min(count, inv[i].count);
        inv[i].count -= take;
        count -= take;
        if (inv[i].count <= 0) inv[i] = null;
        if (count <= 0) break;
      }
    }
    renderInventoryUI();
  }

  function isNearFurnace() {
    if (!activeWorld) return false;
    if (activeWorld.gameMode === 'creative') return true;
    const dim = activeWorld.dims[activeWorld.currentDim];
    const ptx = Math.floor(activeWorld.player.x / TILE_W);
    const pty = Math.floor(activeWorld.player.y / TILE_H);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = ptx + dx, ny = pty + dy;
        if (nx >= 0 && ny >= 0 && nx < WORLD_SIZE && ny < WORLD_SIZE) {
          if (dim.objects[ny][nx] === OBJ.FURNACE) return true;
        }
      }
    }
    return false;
  }

  function appendItemIconToSlot(slotEl, itemId) {
    const iconCanvas = Textures.getItemCanvas(itemId);
    if (!iconCanvas) return;
    const clone = document.createElement('canvas');
    clone.width = 16;
    clone.height = 16;
    clone.getContext('2d').drawImage(iconCanvas, 0, 0);
    slotEl.appendChild(clone);
  }

  function renderInventoryUI() {
    if (!activeWorld) return;
    const inv = activeWorld.inventory;
    const p = activeWorld.player;

    const hotbarEl = document.getElementById('hotbar');
    hotbarEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = inv[i];
      const div = document.createElement('div');
      div.className = 'slot' + (i === p.selectedSlot ? ' active' : '');
      div.innerHTML = `<span class="slot-key">${i + 1}</span>`;
      if (slot) {
        appendItemIconToSlot(div, slot.id);
        if (slot.count > 1) div.innerHTML += `<span class="slot-count">${slot.count}</span>`;
      }
      div.onclick = () => { p.selectedSlot = i; renderInventoryUI(); };
      hotbarEl.appendChild(div);
    }

    const activeSlot = inv[p.selectedSlot];
    document.getElementById('hotbar-label').textContent = activeSlot ? ITEMS[activeSlot.id].name : 'Hand';

    const backpackEl = document.getElementById('backpack-grid');
    backpackEl.innerHTML = '';
    for (let i = 9; i < inv.length; i++) {
      const slot = inv[i];
      const div = document.createElement('div');
      div.className = 'slot';
      if (slot) {
        appendItemIconToSlot(div, slot.id);
        if (slot.count > 1) div.innerHTML += `<span class="slot-count">${slot.count}</span>`;
      }
      div.onclick = () => {
        const tmp = inv[p.selectedSlot];
        inv[p.selectedSlot] = inv[i];
        inv[i] = tmp;
        renderInventoryUI();
      };
      backpackEl.appendChild(div);
    }

    const isCreative = activeWorld.gameMode === 'creative';
    document.getElementById('tab-creative').classList.toggle('hidden', !isCreative);

    const nearFurnace = isNearFurnace();
    document.getElementById('furnace-badge').textContent = nearFurnace ? 'Furnace Ready' : 'Need Furnace to Smelt';

    const recipeListEl = document.getElementById('recipe-list');
    recipeListEl.innerHTML = '';

    if (activeCategory === 'creative' && isCreative) {
      for (const [id, def] of Object.entries(ITEMS)) {
        const card = document.createElement('div');
        card.className = 'recipe-card can-craft';
        const left = document.createElement('div');
        left.className = 'recipe-left';
        appendItemIconToSlot(left, id);
        left.innerHTML += `<div><div class="recipe-name">${def.name}</div><div class="recipe-desc">Creative Item</div></div>`;
        card.appendChild(left);
        card.innerHTML += `<div class="recipe-cost">+${def.stack > 1 ? 16 : 1}</div>`;
        card.onclick = () => { Sound.click(); addItem(id, def.stack > 1 ? 16 : 1); };
        recipeListEl.appendChild(card);
      }
      return;
    }

    for (const rec of RECIPES) {
      if (activeCategory !== 'all' && rec.cat !== activeCategory) continue;
      const outDef = ITEMS[rec.out];
      let canCraft = isCreative || (!rec.needFurnace || nearFurnace);
      const costLines = [];
      for (const [matId, amt] of Object.entries(rec.cost)) {
        const have = countItem(matId);
        if (have < amt) canCraft = false;
        costLines.push(`${ITEMS[matId].name}: ${isCreative ? '∞' : have}/${amt}`);
      }

      const card = document.createElement('div');
      card.className = 'recipe-card ' + (canCraft ? 'can-craft' : 'locked');
      const left = document.createElement('div');
      left.className = 'recipe-left';
      appendItemIconToSlot(left, rec.out);
      left.innerHTML += `<div><div class="recipe-name">${outDef.name} ${rec.count > 1 ? `x${rec.count}` : ''}</div><div class="recipe-desc">${rec.desc}</div></div>`;
      card.appendChild(left);
      card.innerHTML += `<div class="recipe-cost">${costLines.join('<br>')}</div>`;

      if (canCraft) {
        card.onclick = () => {
          Sound.click();
          for (const [matId, amt] of Object.entries(rec.cost)) removeItem(matId, amt);
          addItem(rec.out, rec.count);
        };
      }
      recipeListEl.appendChild(card);
    }
  }

  // ==================== COLLISION & GAMEPLAY ACTIONS ====================
  const projectiles = [];
  const particles = [];
  const floatingTexts = [];
  const objShake = createEmptyGrid(0);

  function addFloatingText(x, y, text, color = '#fff') {
    floatingTexts.push({ x, y, text, color, life: 1.0 });
  }

  function spawnParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 35 + Math.random() * 90;
      particles.push({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 0.35 + Math.random() * 0.2, size: 3 + Math.random() * 3, color
      });
    }
  }

  function isTileSolid(dim, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_SIZE || ty >= WORLD_SIZE) return true;
    const t = dim.terrain[ty][tx];
    if (t === TERRAIN.WATER || t === TERRAIN.LAVA || t === TERRAIN.VOID) return true;
    const obj = dim.objects[ty][tx];
    if (obj === OBJ.DOOR_WOOD) return dim.objState[ty][tx] === 0;
    return [
      OBJ.TREE, OBJ.PINE_TREE, OBJ.CACTUS, OBJ.ROCK, OBJ.COAL_ORE, OBJ.IRON_ORE,
      OBJ.GOLD_ORE, OBJ.DIAMOND_ORE, OBJ.OBSIDIAN, OBJ.QUARTZ_ORE, OBJ.ANCIENT_DEBRIS,
      OBJ.WALL_WOOD, OBJ.WALL_STONE, OBJ.FURNACE
    ].includes(obj);
  }

  function resolveCircleCollision(dim, entity) {
    const minTx = Math.floor((entity.x - entity.radius) / TILE_W) - 1;
    const maxTx = Math.floor((entity.x + entity.radius) / TILE_W) + 1;
    const minTy = Math.floor((entity.y - entity.radius) / TILE_H) - 1;
    const maxTy = Math.floor((entity.y + entity.radius) / TILE_H) + 1;

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!isTileSolid(dim, tx, ty)) continue;
        const left = tx * TILE_W, right = left + TILE_W;
        const top = ty * TILE_H, bottom = top + TILE_H;
        const cx = Math.max(left, Math.min(entity.x, right));
        const cy = Math.max(top, Math.min(entity.y, bottom));
        const dx = entity.x - cx, dy = entity.y - cy;
        const dSq = dx * dx + dy * dy;
        if (dSq < entity.radius * entity.radius) {
          const dist = Math.sqrt(dSq) || 0.001;
          const overlap = entity.radius - dist;
          entity.x += (dx / dist) * overlap;
          entity.y += (dy / dist) * overlap;
        }
      }
    }
  }

  function isPlayerSheltered() {
    const dim = activeWorld.dims[activeWorld.currentDim];
    const ptx = Math.floor(activeWorld.player.x / TILE_W);
    const pty = Math.floor(activeWorld.player.y / TILE_H);
    if (dim.roof[pty] && dim.roof[pty][ptx]) return true;
    let wallDirs = 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      for (let step = 1; step <= 4; step++) {
        const nx = ptx + dx * step, ny = pty + dy * step;
        if (nx < 0 || ny < 0 || nx >= WORLD_SIZE || ny >= WORLD_SIZE) break;
        const o = dim.objects[ny][nx];
        if (o === OBJ.WALL_WOOD || o === OBJ.WALL_STONE || o === OBJ.DOOR_WOOD) { wallDirs++; break; }
      }
    }
    return wallDirs >= 4;
  }

  function getTargetTile() {
    const tx = Math.floor(mouse.worldX / TILE_W);
    const ty = Math.floor(mouse.worldY / TILE_H);
    if (tx < 0 || ty < 0 || tx >= WORLD_SIZE || ty >= WORLD_SIZE) return null;
    const cx = (tx + 0.5) * TILE_W;
    const cy = (ty + 0.5) * TILE_H;
    const reach = activeWorld.gameMode === 'creative' ? 240 : 115;
    if (Math.hypot(cx - activeWorld.player.x, cy - activeWorld.player.y) > reach) return null;
    return { tx, ty, cx, cy };
  }

  function handlePrimaryAction() {
    const p = activeWorld.player;
    if (p.swingTimer > 0) return;
    const dim = activeWorld.dims[activeWorld.currentDim];
    const slot = activeWorld.inventory[p.selectedSlot];
    const itemDef = slot ? ITEMS[slot.id] : null;
    const isCreative = activeWorld.gameMode === 'creative';

    if (itemDef && itemDef.type === 'armor') {
      const old = p.armor;
      p.armor = { id: slot.id, name: itemDef.name, defense: itemDef.defense };
      activeWorld.inventory[p.selectedSlot] = old ? { id: old.id, count: 1 } : null;
      renderInventoryUI();
      Sound.place();
      addFloatingText(p.x, p.y - 26, `Equipped ${itemDef.name}`, '#74b9ff');
      return;
    }

    if (itemDef && itemDef.type === 'food') {
      if (p.hunger < p.maxHunger || p.hp < p.maxHp) {
        p.hunger = Math.min(p.maxHunger, p.hunger + itemDef.hunger);
        p.hp = Math.min(p.maxHp, p.hp + itemDef.heal);
        if (!isCreative) {
          slot.count--;
          if (slot.count <= 0) activeWorld.inventory[p.selectedSlot] = null;
          renderInventoryUI();
        }
        Sound.eat();
        addFloatingText(p.x, p.y - 24, `+${itemDef.hunger} Food`, '#fdcb6e');
      }
      return;
    }

    if (itemDef && itemDef.type === 'bow') {
      p.swingTimer = 0.28;
      Sound.hit();
      projectiles.push({
        dim: activeWorld.currentDim, friendly: true,
        x: p.x + Math.cos(p.angle) * 16, y: p.y - 12 + Math.sin(p.angle) * 16,
        vx: Math.cos(p.angle) * 440, vy: Math.sin(p.angle) * 440,
        dmg: itemDef.dmg, life: 1.4, color: '#ffeaa7'
      });
      return;
    }

    if (itemDef && itemDef.type === 'place') {
      const target = getTargetTile();
      if (!target) return;
      const { tx, ty, cx, cy } = target;
      const t = dim.terrain[ty][tx];
      const liquid = t === TERRAIN.WATER || t === TERRAIN.LAVA || t === TERRAIN.VOID;

      if (itemDef.placeRoof) {
        if (!liquid && !dim.roof[ty][tx]) {
          dim.roof[ty][tx] = true;
          if (!isCreative) { slot.count--; if (slot.count <= 0) activeWorld.inventory[p.selectedSlot] = null; renderInventoryUI(); }
          Sound.place();
        }
        return;
      }
      if (itemDef.placeTerrain !== undefined) {
        if (!liquid && dim.objects[ty][tx] === OBJ.NONE && t !== itemDef.placeTerrain) {
          dim.terrain[ty][tx] = itemDef.placeTerrain;
          if (!isCreative) { slot.count--; if (slot.count <= 0) activeWorld.inventory[p.selectedSlot] = null; renderInventoryUI(); }
          Sound.place();
        }
        return;
      }
      if (itemDef.placeObj !== undefined) {
        const overlaps = Math.hypot(cx - p.x, cy - p.y) < p.radius + 16;
        if (!liquid && dim.objects[ty][tx] === OBJ.NONE && !overlaps) {
          setDimObject(dim, tx, ty, itemDef.placeObj, 0);
          if (!isCreative) { slot.count--; if (slot.count <= 0) activeWorld.inventory[p.selectedSlot] = null; renderInventoryUI(); }
          Sound.place();
        }
        return;
      }
    }

    // Melee Swing
    p.swingTimer = p.swingDuration;
    const dmg = isCreative ? 50 : (itemDef && itemDef.dmg ? itemDef.dmg : 2);

    for (let i = dim.mobs.length - 1; i >= 0; i--) {
      const m = dim.mobs[i];
      const dx = m.x - p.x, dy = m.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 68 + m.radius) {
        const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - p.angle), Math.cos(Math.atan2(dy, dx) - p.angle)));
        if (diff < 1.25) {
          damageMob(dim, i, dmg, dx / (dist || 1), dy / (dist || 1));
          return;
        }
      }
    }

    const target = getTargetTile();
    if (!target) return;
    const { tx, ty, cx, cy } = target;
    const obj = dim.objects[ty][tx];
    if ([OBJ.NONE, OBJ.CAVE_DOWN, OBJ.CAVE_UP, OBJ.NETHER_PORTAL, OBJ.END_PORTAL].includes(obj)) return;

    const toolType = itemDef ? itemDef.toolType : null;
    const tier = isCreative ? 5 : (itemDef ? (itemDef.tier || 0) : 0);
    const power = isCreative ? 99 : (itemDef ? itemDef.power : 1);

    if ((obj === OBJ.IRON_ORE && tier < 2) ||
        ((obj === OBJ.GOLD_ORE || obj === OBJ.DIAMOND_ORE) && tier < 3) ||
        ((obj === OBJ.OBSIDIAN || obj === OBJ.ANCIENT_DEBRIS) && tier < 4)) {
      addFloatingText(cx, cy - 16, 'Need Better Pickaxe!', '#ff7675');
      objShake[ty][tx] = 0.14;
      Sound.hit();
      return;
    }

    let blockDmg = 10;
    if ([OBJ.TREE, OBJ.PINE_TREE, OBJ.STUMP].includes(obj)) blockDmg = toolType === 'axe' ? 14 * power : 10;
    else if (obj === OBJ.END_CRYSTAL) blockDmg = 45;
    else blockDmg = toolType === 'pick' ? 13 * power : 8;

    dim.objHp[ty][tx] -= blockDmg;
    objShake[ty][tx] = 0.14;
    Sound.hit();
    spawnParticles(cx, cy - 8, '#dfe6e9', 4);

    if (dim.objHp[ty][tx] <= 0) {
      Sound.breakBlock();
      harvestDimObject(dim, tx, ty, cx, cy, obj);
    }
  }

  function damageMob(dim, idx, dmg, nx, ny) {
    const m = dim.mobs[idx];
    if (m.kind === 'ender_dragon') {
      let crystals = 0;
      for (let y = 0; y < WORLD_SIZE; y++)
        for (let x = 0; x < WORLD_SIZE; x++)
          if (dim.objects[y][x] === OBJ.END_CRYSTAL) crystals++;
      if (crystals > 0) {
        addFloatingText(m.x, m.y - 30, 'Break End Crystals First!', '#ff79c6');
        return;
      }
    }
    Sound.hit();
    m.hp -= dmg;
    m.vx += nx * (m.boss ? 50 : 200);
    m.vy += ny * (m.boss ? 50 : 200);
    spawnParticles(m.x, m.y - 10, '#ff7675', 7);
    addFloatingText(m.x, m.y - 20, `-${dmg}`, '#ff7675');

    if (m.hp <= 0) {
      dim.mobs.splice(idx, 1);
      const drops = {
        cow: [['raw_meat', 2], ['leather', 2]],
        pig: [['raw_meat', 2]],
        sheep: [['wool', 2], ['raw_meat', 1]],
        zombie: [['iron_ingot', 1]],
        skeleton: [['coal', 2]],
        creeper: [['coal', 3]],
        enderman: [['ender_pearl', 1]],
        blaze: [['blaze_rod', 1]],
        piglin: [['gold_ingot', 2]],
        warden: [['diamond', 4], ['golden_apple', 1]],
        ender_dragon: [['dragon_egg', 1], ['diamond', 8]]
      };
      for (const [id, amt] of (drops[m.kind] || [])) addItem(id, amt);
      if (m.kind === 'ender_dragon') {
        activeWorld.player.dragonSlain = true;
        addFloatingText(activeWorld.player.x, activeWorld.player.y - 40, 'ENDER DRAGON SLAIN!', '#ffd32a');
      }
    }
  }

  function harvestDimObject(dim, tx, ty, cx, cy, obj) {
    dim.objects[ty][tx] = OBJ.NONE;
    const loot = {
      [OBJ.TREE]:           () => { addItem('wood', 3); if (Math.random() < 0.45) addItem('apple', 1); setDimObject(dim, tx, ty, OBJ.STUMP); },
      [OBJ.PINE_TREE]:      () => { addItem('wood', 3); setDimObject(dim, tx, ty, OBJ.STUMP); },
      [OBJ.STUMP]:          () => { addItem('wood', 1); },
      [OBJ.CACTUS]:         () => { addItem('wood', 2); },
      [OBJ.ROCK]:           () => { addItem('cobble', 3); if (dim.terrain[ty][tx] === TERRAIN.SAND) addItem('sand', 1); },
      [OBJ.COAL_ORE]:       () => { addItem('coal', 3); addItem('cobble', 1); },
      [OBJ.IRON_ORE]:       () => { addItem('iron_ore', 2); },
      [OBJ.GOLD_ORE]:       () => { addItem('gold_ore', 2); },
      [OBJ.DIAMOND_ORE]:    () => { addItem('diamond', 2); },
      [OBJ.OBSIDIAN]:       () => { addItem('obsidian', 1); },
      [OBJ.QUARTZ_ORE]:     () => { addItem('quartz', 3); },
      [OBJ.ANCIENT_DEBRIS]: () => { addItem('ancient_debris', 1); },
      [OBJ.BERRY_BUSH]:     () => { addItem('berries', 2); },
      [OBJ.ANCIENT_CHEST]:  () => { addItem('diamond', 3); addItem('golden_apple', 1); addItem('iron_ingot', 4); },
      [OBJ.WALL_WOOD]:      () => { addItem('wood_wall', 1); },
      [OBJ.WALL_STONE]:     () => { addItem('stone_wall', 1); },
      [OBJ.DOOR_WOOD]:      () => { addItem('wood_door', 1); },
      [OBJ.FURNACE]:        () => { addItem('furnace', 1); },
      [OBJ.CAMPFIRE]:       () => { addItem('campfire', 1); },
      [OBJ.TORCH]:          () => { addItem('torch', 1); },
      [OBJ.BED]:            () => { addItem('bed', 1); }
    };
    if (loot[obj]) loot[obj]();
  }

  function handleSecondaryAction() {
    const dim = activeWorld.dims[activeWorld.currentDim];
    const p = activeWorld.player;
    const target = getTargetTile();
    if (!target) return;
    const { tx, ty, cx, cy } = target;
    const obj = dim.objects[ty][tx];

    if (obj === OBJ.DOOR_WOOD) {
      dim.objState[ty][tx] = dim.objState[ty][tx] === 0 ? 1 : 0;
      Sound.place();
      return;
    }
    if (obj === OBJ.BED) {
      p.spawnDim = activeWorld.currentDim;
      p.spawnX = cx;
      p.spawnY = cy;
      if (activeWorld.worldTime > 0.55 || activeWorld.worldTime < 0.12) {
        activeWorld.worldTime = 0.22;
        activeWorld.dayCount++;
        p.hp = Math.min(p.maxHp, p.hp + 6);
        addFloatingText(cx, cy - 22, 'Slept! Respawn Set', '#74b9ff');
      } else {
        addFloatingText(cx, cy - 22, 'Respawn Point Set!', '#74b9ff');
      }
      Sound.place();
      return;
    }
    if (obj === OBJ.CAVE_DOWN && activeWorld.currentDim === 'overworld') {
      activeWorld.currentDim = 'caves';
      clearSafeArea(activeWorld.dims.caves, tx, ty, 2, TERRAIN.STONE_FLOOR);
      setDimObject(activeWorld.dims.caves, tx, ty, OBJ.CAVE_UP);
      p.x = (tx + 0.5) * TILE_W; p.y = (ty + 0.5) * TILE_H;
      Sound.portal();
      return;
    }
    if (obj === OBJ.CAVE_UP && activeWorld.currentDim === 'caves') {
      activeWorld.currentDim = 'overworld';
      clearSafeArea(activeWorld.dims.overworld, tx, ty, 1, TERRAIN.GRASS);
      setDimObject(activeWorld.dims.overworld, tx, ty, OBJ.CAVE_DOWN);
      p.x = (tx + 0.5) * TILE_W; p.y = (ty + 0.5) * TILE_H;
      Sound.portal();
      return;
    }
    if (obj === OBJ.NETHER_PORTAL) {
      const toNether = activeWorld.currentDim === 'overworld';
      activeWorld.currentDim = toNether ? 'nether' : 'overworld';
      const dest = activeWorld.dims[activeWorld.currentDim];
      clearSafeArea(dest, tx, ty, 2, toNether ? TERRAIN.NETHERRACK : TERRAIN.GRASS);
      setDimObject(dest, tx, ty, OBJ.NETHER_PORTAL);
      p.x = (tx + 0.5) * TILE_W; p.y = (ty + 0.5) * TILE_H;
      Sound.portal();
      return;
    }
    if (obj === OBJ.END_PORTAL) {
      const mid = Math.floor(WORLD_SIZE / 2);
      if (activeWorld.currentDim === 'overworld') {
        activeWorld.currentDim = 'end';
        p.x = (mid + 0.5) * TILE_W; p.y = (mid + 13.5) * TILE_H;
      } else {
        activeWorld.currentDim = 'overworld';
        p.x = p.spawnX; p.y = p.spawnY;
      }
      Sound.portal();
      return;
    }

    if (dim.roof[ty][tx]) {
      dim.roof[ty][tx] = false;
      addItem('wood_roof', 1);
      Sound.breakBlock();
      return;
    }
    if ([OBJ.WALL_WOOD, OBJ.WALL_STONE, OBJ.FURNACE, OBJ.CAMPFIRE, OBJ.TORCH, OBJ.BED].includes(obj)) {
      harvestDimObject(dim, tx, ty, cx, cy, obj);
      Sound.breakBlock();
    }
  }

  // ==================== UPDATE LOOP ====================
  const camera = { x: 30 * TILE_W, y: 30 * TILE_H };
  let mobSpawnTimer = 0;
  let comfortTick = 0;
  let autoSaveTimer = 0;

  function applyPlayerDamage(rawDmg) {
    const p = activeWorld.player;
    if (activeWorld.gameMode === 'creative' || activeWorld.difficulty === 'peaceful' || p.invulnTimer > 0) return;
    const diffMult = { easy: 0.7, normal: 1.0, hard: 1.5 }[activeWorld.difficulty] || 1.0;
    const reduction = p.armor ? p.armor.defense : 0;
    const dmg = Math.max(1, Math.round(rawDmg * diffMult * (1 - reduction)));
    p.hp -= dmg;
    p.invulnTimer = 0.8;
    Sound.hurt();
    addFloatingText(p.x, p.y - 26, `-${dmg} HP`, '#ff4757');
  }

  function update(dt) {
    if (!isPlaying || !activeWorld) return;
    const p = activeWorld.player;
    if (p.isDead || pauseOpen) return;

    const dim = activeWorld.dims[activeWorld.currentDim];
    const isCreative = activeWorld.gameMode === 'creative';

    if (settings.autoSave) {
      autoSaveTimer += dt;
      if (autoSaveTimer >= 25) { autoSaveTimer = 0; persistActiveWorld(); }
    }

    if (activeWorld.daylightCycle) {
      activeWorld.worldTime += dt / 100;
      if (activeWorld.worldTime >= 1) { activeWorld.worldTime -= 1; activeWorld.dayCount++; }
    }
    const sun = Math.sin(activeWorld.worldTime * Math.PI * 2);
    const isNight = activeWorld.currentDim === 'overworld' && sun < -0.15;

    // Movement
    let mx = 0, my = 0;
    if (!craftOpen) {
      if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) my += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
    }
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
      const spd = isCreative ? p.speed * 1.45 : p.speed;
      p.x += mx * spd * dt;
      p.y += my * spd * dt;
      p.walkPhase += dt * 11;
      if (!isCreative) resolveCircleCollision(dim, p);
      else {
        p.x = Math.max(TILE_W, Math.min((WORLD_SIZE - 1) * TILE_W, p.x));
        p.y = Math.max(TILE_H, Math.min((WORLD_SIZE - 1) * TILE_H, p.y));
      }
    }

    camera.x += (p.x - camera.x) * Math.min(1, dt * 10);
    camera.y += (p.y - camera.y) * Math.min(1, dt * 10);

    const zoomScale = settings.zoom / 100;
    mouse.worldX = (mouse.x - canvas.width / 2) / zoomScale + camera.x;
    mouse.worldY = (mouse.y - canvas.height / 2) / zoomScale + camera.y;
    p.angle = Math.atan2(mouse.worldY - p.y, mouse.worldX - p.x);

    if (mouse.down && !craftOpen && p.swingTimer <= 0) handlePrimaryAction();
    if (p.swingTimer > 0) p.swingTimer = Math.max(0, p.swingTimer - dt);
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);

    const sheltered = isPlayerSheltered();
    if (!isCreative) {
      if (activeWorld.difficulty !== 'peaceful') {
        p.hunger = Math.max(0, p.hunger - dt * 0.08);
        if (p.hunger <= 0) p.hp -= dt * 0.6;
      } else {
        p.hunger = p.maxHunger;
      }
      comfortTick += dt;
      if (comfortTick >= 1.2) {
        comfortTick = 0;
        if ((sheltered || activeWorld.difficulty === 'peaceful') && p.hunger > 6 && p.hp < p.maxHp) {
          p.hp = Math.min(p.maxHp, p.hp + 1);
        }
      }
    } else {
      p.hp = p.maxHp;
      p.hunger = p.maxHunger;
    }

    // Update HUD
    document.getElementById('hp-fill').style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    document.getElementById('hp-text').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    document.getElementById('hunger-fill').style.width = `${Math.max(0, (p.hunger / p.maxHunger) * 100)}%`;
    document.getElementById('hunger-text').textContent = `${Math.ceil(p.hunger)} / ${p.maxHunger}`;
    document.getElementById('hud-armor').textContent = p.armor ? `Armor: ${Math.round(p.armor.defense * 100)}%` : 'Armor: 0%';
    document.getElementById('hud-shelter').textContent = sheltered ? 'Sheltered' : 'Outdoors';
    document.getElementById('hud-dim').textContent =
      activeWorld.currentDim === 'overworld' ? 'Overworld' :
      activeWorld.currentDim === 'caves' ? 'Caves / Deep Dark' :
      activeWorld.currentDim === 'nether' ? 'The Nether' : 'The End';
    document.getElementById('hud-time').textContent = `Day ${activeWorld.dayCount} (${isNight ? 'Night' : 'Day'})`;
    document.getElementById('hud-coords').textContent = `XYZ: ${Math.floor(p.x / TILE_W)}, ${Math.floor(p.y / TILE_H)}`;

    if (p.hp <= 0 && !isCreative) {
      p.isDead = true;
      if (!activeWorld.keepInventory) activeWorld.inventory = Array(24).fill(null);
      document.getElementById('death-summary').textContent = `Survived ${activeWorld.dayCount} Day${activeWorld.dayCount > 1 ? 's' : ''}`;
      document.getElementById('modal-death').classList.remove('hidden');
      return;
    }

    for (let y = 0; y < WORLD_SIZE; y++)
      for (let x = 0; x < WORLD_SIZE; x++)
        if (objShake[y][x] > 0) objShake[y][x] = Math.max(0, objShake[y][x] - dt);

    // Mob spawning
    mobSpawnTimer -= dt;
    if (mobSpawnTimer <= 0 && dim.mobs.length < 13) {
      mobSpawnTimer = 3.2;
      const a = Math.random() * Math.PI * 2;
      const sx = p.x + Math.cos(a) * 360;
      const sy = p.y + Math.sin(a) * 360;
      const tx = Math.floor(sx / TILE_W), ty = Math.floor(sy / TILE_H);
      if (tx > 2 && ty > 2 && tx < WORLD_SIZE - 2 && ty < WORLD_SIZE - 2 && !isTileSolid(dim, tx, ty) && !dim.roof[ty][tx]) {
        const peaceful = activeWorld.difficulty === 'peaceful';
        if (activeWorld.currentDim === 'overworld') {
          if (!isNight) {
            const kind = ['cow', 'pig', 'sheep'][Math.floor(Math.random() * 3)];
            dim.mobs.push({ kind, x: sx, y: sy, vx: 0, vy: 0, radius: 11, hp: 10, maxHp: 10, speed: 42, timer: 0, hostile: false });
          } else if (!peaceful && !sheltered) {
            const kind = ['zombie', 'skeleton', 'creeper', 'enderman'][Math.floor(Math.random() * 4)];
            dim.mobs.push({ kind, x: sx, y: sy, vx: 0, vy: 0, radius: 12, hp: 20, maxHp: 20, speed: 78, timer: 0, hostile: true });
          }
        } else if (activeWorld.currentDim === 'caves' && !peaceful) {
          if (ty > 37 && !dim.mobs.some((m) => m.kind === 'warden')) {
            dim.mobs.push({ kind: 'warden', x: sx, y: sy, vx: 0, vy: 0, radius: 18, hp: 150, maxHp: 150, speed: 88, timer: 0, hostile: true, boss: true });
          } else {
            const kind = Math.random() < 0.5 ? 'zombie' : 'skeleton';
            dim.mobs.push({ kind, x: sx, y: sy, vx: 0, vy: 0, radius: 12, hp: 20, maxHp: 20, speed: 80, timer: 0, hostile: true });
          }
        } else if (activeWorld.currentDim === 'nether' && !peaceful) {
          const kind = Math.random() < 0.5 ? 'blaze' : 'piglin';
          dim.mobs.push({ kind, x: sx, y: sy, vx: 0, vy: 0, radius: 12, hp: 24, maxHp: 24, speed: 84, timer: 0, hostile: true });
        } else if (activeWorld.currentDim === 'end' && !peaceful) {
          dim.mobs.push({ kind: 'enderman', x: sx, y: sy, vx: 0, vy: 0, radius: 12, hp: 30, maxHp: 30, speed: 95, timer: 0, hostile: true });
        }
      }
    }

    // Update Mobs
    let activeBoss = null;
    for (let i = dim.mobs.length - 1; i >= 0; i--) {
      const m = dim.mobs[i];
      if (m.boss) activeBoss = m;
      m.timer += dt;
      const dx = p.x - m.x, dy = p.y - m.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (m.kind === 'ender_dragon') {
        const oa = m.timer * 0.85;
        const tx = (WORLD_SIZE / 2) * TILE_W + Math.cos(oa) * 230;
        const ty = (WORLD_SIZE / 2) * TILE_H + Math.sin(oa) * 200;
        const bdx = tx - m.x, bdy = ty - m.y, bd = Math.hypot(bdx, bdy) || 1;
        m.x += (bdx / bd) * m.speed * dt;
        m.y += (bdy / bd) * m.speed * dt;
        if (m.timer % 2.5 < dt && activeWorld.difficulty !== 'peaceful') {
          projectiles.push({ dim: 'end', friendly: false, x: m.x, y: m.y, vx: (dx / dist) * 260, vy: (dy / dist) * 260, dmg: 6, life: 2.2, color: '#e056fd' });
        }
      } else if (!m.hostile) {
        if (Math.floor(m.timer) % 3 === 0) {
          const wa = Math.sin(m.timer * 1.5) * Math.PI;
          m.x += Math.cos(wa) * m.speed * dt;
          m.y += Math.sin(wa) * m.speed * dt;
        }
        resolveCircleCollision(dim, m);
      } else {
        if (activeWorld.difficulty === 'peaceful') { dim.mobs.splice(i, 1); continue; }
        if (m.kind === 'creeper' && dist < 62) {
          m.fuse = (m.fuse || 0) + dt;
          if (m.fuse >= 1.1) {
            spawnParticles(m.x, m.y, '#40c057', 20);
            if (dist < 105) applyPlayerDamage(11);
            dim.mobs.splice(i, 1);
            continue;
          }
        } else {
          m.fuse = 0;
          const stop = (m.kind === 'skeleton' || m.kind === 'blaze') ? 175 : 0;
          if (dist > stop) {
            m.x += ((dx / dist) * m.speed + m.vx) * dt;
            m.y += ((dy / dist) * m.speed + m.vy) * dt;
          }
        }
        if ((m.kind === 'skeleton' || m.kind === 'blaze') && dist < 320 && m.timer % 2.4 < dt) {
          projectiles.push({
            dim: activeWorld.currentDim, friendly: false, x: m.x, y: m.y - 10,
            vx: (dx / dist) * 250, vy: (dy / dist) * 250, dmg: 4, life: 1.8,
            color: m.kind === 'blaze' ? '#ff9f1a' : '#f1f3f5'
          });
        }
        if (dist < p.radius + m.radius) applyPlayerDamage(m.kind === 'warden' ? 10 : 4);
        resolveCircleCollision(dim, m);
      }
      m.vx *= Math.pow(0.05, dt);
      m.vy *= Math.pow(0.05, dt);
    }

    const bossWrap = document.getElementById('boss-bar-wrap');
    if (activeBoss) {
      bossWrap.classList.remove('hidden');
      document.getElementById('boss-name').textContent = activeBoss.kind === 'warden' ? 'THE WARDEN' : 'ENDER DRAGON';
      document.getElementById('boss-bar-fill').style.width = `${Math.max(0, (activeBoss.hp / activeBoss.maxHp) * 100)}%`;
    } else {
      bossWrap.classList.add('hidden');
    }

    // Projectiles & Particles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      if (pr.dim !== activeWorld.currentDim) { projectiles.splice(i, 1); continue; }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (pr.life <= 0) { projectiles.splice(i, 1); continue; }
      const tx = Math.floor(pr.x / TILE_W), ty = Math.floor(pr.y / TILE_H);
      if (isTileSolid(dim, tx, ty)) {
        if (pr.friendly && dim.objects[ty] && dim.objects[ty][tx] === OBJ.END_CRYSTAL) {
          dim.objects[ty][tx] = OBJ.NONE;
          spawnParticles(pr.x, pr.y, '#e056fd', 15);
        }
        projectiles.splice(i, 1);
        continue;
      }
      if (pr.friendly) {
        for (let j = dim.mobs.length - 1; j >= 0; j--) {
          const m = dim.mobs[j];
          if (Math.hypot(pr.x - m.x, pr.y - m.y) < m.radius + 8) {
            damageMob(dim, j, pr.dmg, pr.vx / 400, pr.vy / 400);
            projectiles.splice(i, 1);
            break;
          }
        }
      } else if (Math.hypot(pr.x - p.x, pr.y - p.y) < p.radius + 8) {
        applyPlayerDamage(pr.dmg);
        projectiles.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y -= 24 * dt; ft.life -= dt;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  // ==================== 2.5D DEPTH-SORTED RENDERER ====================
  function renderWorldScene(worldObj, isPanorama) {
    const dim = worldObj.dims[worldObj.currentDim];
    const p = worldObj.player;
    const zoom = isPanorama ? 1.1 : (settings.zoom / 100);

    ctx.fillStyle = '#0c1014';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camera.x, -camera.y);

    const halfW = (canvas.width / 2) / zoom;
    const halfH = (canvas.height / 2) / zoom;
    const maxTiles = settings.renderDistance;
    const ptx = Math.floor(camera.x / TILE_W);
    const pty = Math.floor(camera.y / TILE_H);

    const startTx = Math.max(0, Math.max(ptx - maxTiles, Math.floor((camera.x - halfW) / TILE_W) - 1));
    const endTx = Math.min(WORLD_SIZE - 1, Math.min(ptx + maxTiles, Math.ceil((camera.x + halfW) / TILE_W) + 1));
    const startTy = Math.max(0, Math.max(pty - maxTiles, Math.floor((camera.y - halfH) / TILE_H) - 1));
    const endTy = Math.min(WORLD_SIZE - 1, Math.min(pty + maxTiles, Math.ceil((camera.y + halfH) / TILE_H) + 1));

    const lightSources = [{ x: p.x, y: p.y - 10, r: 165 }];

    // Pass 1: Ground Terrain + 2.5D Cliff Edges
    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const px = tx * TILE_W, py = ty * TILE_H;
        const t = dim.terrain[ty][tx];
        const tex = Textures.getTerrain(t);
        ctx.drawImage(tex.top, px, py, TILE_W + 0.5, TILE_H + 0.5);

        // Draw 2.5D vertical cliff face if tile below is depressed liquid/void
        if (tex.side && ty + 1 < WORLD_SIZE) {
          const below = dim.terrain[ty + 1][tx];
          if (below === TERRAIN.WATER || below === TERRAIN.LAVA || below === TERRAIN.VOID) {
            ctx.drawImage(tex.side, px, py + TILE_H - 4, TILE_W + 0.5, BLOCK_DEPTH);
          }
        }
        if (t === TERRAIN.LAVA) lightSources.push({ x: px + TILE_W / 2, y: py + TILE_H / 2, r: 110 });
      }
    }

    // Placement target highlight
    if (!isPanorama && !craftOpen && !pauseOpen) {
      const slot = worldObj.inventory[p.selectedSlot];
      const def = slot ? ITEMS[slot.id] : null;
      if (def && def.type === 'place') {
        const target = getTargetTile();
        if (target) {
          ctx.strokeStyle = '#ffff55';
          ctx.lineWidth = 2;
          ctx.strokeRect(target.tx * TILE_W + 2, target.ty * TILE_H + 2, TILE_W - 4, TILE_H - 4);
        }
      }
    }

    // Pass 2: Depth-Sorted 2.5D Blocks, Mobs & Player (Row by Row)
    const entitiesByRow = Array.from({ length: WORLD_SIZE }, () => []);
    for (const m of dim.mobs) {
      const ry = Math.max(0, Math.min(WORLD_SIZE - 1, Math.floor(m.y / TILE_H)));
      entitiesByRow[ry].push({ type: 'mob', data: m, y: m.y });
    }
    if (!isPanorama) {
      const pry = Math.max(0, Math.min(WORLD_SIZE - 1, Math.floor(p.y / TILE_H)));
      entitiesByRow[pry].push({ type: 'player', data: p, y: p.y });
    }

    for (let ty = startTy; ty <= endTy; ty++) {
      // Draw blocks in this row
      for (let tx = startTx; tx <= endTx; tx++) {
        const obj = dim.objects[ty][tx];
        if (obj === OBJ.NONE) continue;
        const shake = objShake[ty][tx] > 0 ? (Math.random() - 0.5) * 4 : 0;
        const px = tx * TILE_W + shake;
        const py = ty * TILE_H;
        const cx = px + TILE_W / 2;
        const cy = py + TILE_H / 2;

        draw25DObject(ctx, obj, px, py, cx, cy, dim.objState[ty][tx], lightSources);

        if (dim.objHp[ty][tx] > 0 && dim.objHp[ty][tx] < dim.objMaxHp[ty][tx]) {
          const pct = dim.objHp[ty][tx] / dim.objMaxHp[ty][tx];
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(px + 6, py - 18, TILE_W - 12, 4);
          ctx.fillStyle = '#5c8a36';
          ctx.fillRect(px + 6, py - 18, (TILE_W - 12) * pct, 4);
        }
      }

      // Draw entities sorted by Y within this row
      const rowEnts = entitiesByRow[ty].sort((a, b) => a.y - b.y);
      for (const ent of rowEnts) {
        if (ent.type === 'mob') {
          const m = ent.data;
          const spr = Textures.getMobCanvas(m.kind);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(m.x, m.y + 2, m.radius, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          if (spr) {
            const scale = m.boss ? 2.2 : 1.5;
            ctx.drawImage(spr, m.x - (12 * scale), m.y - (26 * scale), 24 * scale, 28 * scale);
          }
        } else if (ent.type === 'player') {
          const slot = worldObj.inventory[p.selectedSlot];
          const swingProg = p.swingTimer > 0 ? 1 - p.swingTimer / p.swingDuration : 0;
          Textures.drawPlayerSprite(
            ctx, p.x, p.y, profile.skin, p.angle, p.walkPhase, swingProg,
            p.armor ? p.armor.id : null, slot ? slot.id : null
          );
          // Username nameplate above player
          ctx.font = 'bold 10px Silkscreen, monospace';
          ctx.textAlign = 'center';
          const nameW = ctx.measureText(profile.username).width + 8;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.fillRect(p.x - nameW / 2, p.y - 54, nameW, 13);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(profile.username, p.x, p.y - 44);
        }
      }
    }

    // Pass 3: Overhead 2.5D Roofs
    if (!isPanorama) {
      const playerTx = Math.floor(p.x / TILE_W);
      const playerTy = Math.floor(p.y / TILE_H);
      const underRoof = dim.roof[playerTy] && dim.roof[playerTy][playerTx];
      ctx.globalAlpha = underRoof ? 0.25 : 0.95;
      const roofTex = Textures.getBlock(OBJ.WALL_WOOD);
      for (let ty = startTy; ty <= endTy; ty++) {
        for (let tx = startTx; tx <= endTx; tx++) {
          if (!dim.roof[ty][tx]) continue;
          const px = tx * TILE_W, py = ty * TILE_H - 22;
          ctx.drawImage(roofTex.top, px, py, TILE_W, TILE_H);
          ctx.drawImage(roofTex.front, px, py + TILE_H, TILE_W, 8);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Pass 4: Projectiles, Particles & Floating Text
    for (const pr of projectiles) {
      if (pr.dim !== worldObj.currentDim) continue;
      ctx.fillStyle = pr.color;
      ctx.fillRect(pr.x - 3, pr.y - 3, 6, 6);
    }
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.font = 'bold 11px Silkscreen, monospace';
    ctx.textAlign = 'center';
    for (const ft of floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.fillStyle = '#000';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Pass 5: Dynamic Lighting & Brightness Setting
    const sun = Math.sin(worldObj.worldTime * Math.PI * 2);
    const gammaReduce = (settings.brightness / 100) * 0.35;
    let darkness = 0;
    if (worldObj.currentDim === 'overworld') darkness = Math.max(0, Math.min(0.84, (-sun + 0.12) * 0.78 - gammaReduce));
    else if (worldObj.currentDim === 'caves') darkness = Math.max(0.25, 0.80 - gammaReduce);
    else if (worldObj.currentDim === 'nether') darkness = Math.max(0.05, 0.28 - gammaReduce);
    else if (worldObj.currentDim === 'end') darkness = Math.max(0.10, 0.36 - gammaReduce);

    if (settings.dynamicLighting && darkness > 0.02) {
      lightCtx.globalCompositeOperation = 'source-over';
      lightCtx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
      lightCtx.fillStyle = `rgba(8, 12, 24, ${darkness})`;
      lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

      lightCtx.globalCompositeOperation = 'destination-out';
      for (const ls of lightSources) {
        const sx = (ls.x - camera.x) * zoom + canvas.width / 2;
        const sy = (ls.y - camera.y) * zoom + canvas.height / 2;
        const sr = ls.r * zoom;
        const grad = lightCtx.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        lightCtx.fillStyle = grad;
        lightCtx.beginPath();
        lightCtx.arc(sx, sy, sr, 0, Math.PI * 2);
        lightCtx.fill();
      }
      ctx.drawImage(lightCanvas, 0, 0);
    }

    if (!isPanorama && settings.showMinimap) drawMinimap(dim, p);
  }

  function draw25DObject(ctx, obj, px, py, cx, cy, state, lightSources) {
    const blk = Textures.getBlock(obj);
    if (blk) {
      const h = blk.height;
      // 2.5D Front Vertical Face + Lit Top Face
      ctx.drawImage(blk.front, px, py + TILE_H - h, TILE_W, h);
      ctx.drawImage(blk.top, px, py - h, TILE_W, TILE_H);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py - h, TILE_W, TILE_H + h);
      return;
    }

    if (obj === OBJ.TREE || obj === OBJ.PINE_TREE) {
      // Trunk
      ctx.fillStyle = '#5c3c1e';
      ctx.fillRect(cx - 5, cy - 18, 10, 24);
      // 2.5D Leaf Canopy
      const leafMain = obj === OBJ.PINE_TREE ? '#2b6e3f' : '#3d8c2c';
      const leafTop = obj === OBJ.PINE_TREE ? '#3b8c52' : '#57ab41';
      ctx.fillStyle = leafMain;
      ctx.fillRect(px + 4, py - 34, TILE_W - 8, 22);
      ctx.fillStyle = leafTop;
      ctx.fillRect(px + 4, py - 46, TILE_W - 8, 14);
      ctx.strokeStyle = '#1b4322';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 4, py - 46, TILE_W - 8, 34);
    } else if (obj === OBJ.CACTUS) {
      ctx.fillStyle = '#2b8a3e';
      ctx.fillRect(cx - 8, cy - 26, 16, 30);
      ctx.fillStyle = '#40c057';
      ctx.fillRect(cx - 8, cy - 32, 16, 8);
    } else if (obj === OBJ.STUMP) {
      ctx.fillStyle = '#6b4c2a';
      ctx.fillRect(cx - 8, cy - 4, 16, 10);
      ctx.fillStyle = '#c89d66';
      ctx.fillRect(cx - 8, cy - 10, 16, 7);
    } else if (obj === OBJ.BERRY_BUSH) {
      ctx.fillStyle = '#2f9e44';
      ctx.fillRect(px + 8, py + 4, TILE_W - 16, TILE_H - 12);
      ctx.fillStyle = '#f03e3e';
      ctx.fillRect(cx - 6, cy - 2, 4, 4);
      ctx.fillRect(cx + 3, cy + 2, 4, 4);
    } else if (obj === OBJ.DOOR_WOOD) {
      ctx.fillStyle = '#a67c46';
      if (state === 0) ctx.fillRect(px + 2, py - 14, TILE_W - 4, 28);
      else ctx.fillRect(px + 2, py - 14, 10, TILE_H + 10);
    } else if (obj === OBJ.CAMPFIRE) {
      lightSources.push({ x: cx, y: cy, r: 220 });
      ctx.fillStyle = '#5c3c1e';
      ctx.fillRect(cx - 12, cy, 24, 6);
      const flk = Math.sin(performance.now() * 0.015) * 3;
      ctx.fillStyle = '#ff6b00';
      ctx.fillRect(cx - 8, cy - 12 - flk, 16, 14 + flk);
      ctx.fillStyle = '#ffd32a';
      ctx.fillRect(cx - 4, cy - 8 - flk * 0.5, 8, 9);
    } else if (obj === OBJ.TORCH) {
      lightSources.push({ x: cx, y: cy, r: 155 });
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(cx - 2, cy - 10, 4, 14);
      ctx.fillStyle = '#ffd32a';
      ctx.fillRect(cx - 4, cy - 15, 8, 6);
    } else if (obj === OBJ.BED) {
      ctx.fillStyle = '#e03131';
      ctx.fillRect(px + 4, py + 4, TILE_W - 8, TILE_H - 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 4, py + 4, 12, TILE_H - 10);
    } else if (obj === OBJ.CAVE_DOWN || obj === OBJ.CAVE_UP) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(px + 6, py + 4, TILE_W - 12, TILE_H - 8);
      ctx.strokeStyle = '#a67c46';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 6, py + 4, TILE_W - 12, TILE_H - 8);
      ctx.fillStyle = '#ffff55';
      ctx.font = 'bold 9px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(obj === OBJ.CAVE_DOWN ? 'CAVE' : 'EXIT', cx, cy + 3);
    } else if (obj === OBJ.NETHER_PORTAL || obj === OBJ.END_PORTAL) {
      lightSources.push({ x: cx, y: cy, r: 185 });
      ctx.fillStyle = obj === OBJ.NETHER_PORTAL ? '#ae3ec9' : '#20c997';
      ctx.fillRect(px + 4, py - 14, TILE_W - 8, TILE_H + 10);
      ctx.strokeStyle = '#1b122b';
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 4, py - 14, TILE_W - 8, TILE_H + 10);
    } else if (obj === OBJ.END_CRYSTAL) {
      lightSources.push({ x: cx, y: cy, r: 165 });
      const bob = Math.sin(performance.now() * 0.006) * 4;
      ctx.fillStyle = '#e056fd';
      ctx.fillRect(cx - 9, cy - 22 + bob, 18, 18);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(cx - 9, cy - 22 + bob, 18, 18);
    } else if (obj === OBJ.SCULK_SENSOR) {
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(cx - 8, cy - 4, 16, 10);
    }
  }

  function drawMinimap(dim, p) {
    const scale = miniCanvas.width / WORLD_SIZE;
    miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    for (let y = 0; y < WORLD_SIZE; y++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        const obj = dim.objects[y][x];
        const t = dim.terrain[y][x];
        if (obj === OBJ.CAVE_DOWN || obj === OBJ.CAVE_UP) miniCtx.fillStyle = '#ff9f1a';
        else if (obj === OBJ.NETHER_PORTAL || obj === OBJ.END_PORTAL) miniCtx.fillStyle = '#e056fd';
        else if (obj === OBJ.WALL_WOOD || obj === OBJ.WALL_STONE) miniCtx.fillStyle = '#ffeaa7';
        else if (t === TERRAIN.WATER) miniCtx.fillStyle = '#2d6fd6';
        else if (t === TERRAIN.LAVA) miniCtx.fillStyle = '#e85d04';
        else if (t === TERRAIN.SAND) miniCtx.fillStyle = '#dfd49a';
        else if (t === TERRAIN.SNOW) miniCtx.fillStyle = '#eef5f8';
        else if (t === TERRAIN.SCULK) miniCtx.fillStyle = '#00e5ff';
        else if (t === TERRAIN.NETHERRACK) miniCtx.fillStyle = '#6e2b2b';
        else if (t === TERRAIN.END_STONE) miniCtx.fillStyle = '#dfd99e';
        else if (t === TERRAIN.VOID) miniCtx.fillStyle = '#09070d';
        else miniCtx.fillStyle = '#5d9e38';
        miniCtx.fillRect(x * scale, y * scale, scale + 0.5, scale + 0.5);
      }
    }
    miniCtx.fillStyle = '#ffffff';
    miniCtx.fillRect((p.x / TILE_W) * scale - 2, (p.y / TILE_H) * scale - 2, 4, 4);
  }

  // ==================== MAIN ANIMATION LOOP ====================
  let lastTime = performance.now();
  function mainLoop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (isPlaying && activeWorld) {
      update(dt);
      renderWorldScene(activeWorld, false);
    } else {
      // Gentle panoramic camera pan behind Main Menu
      camera.x = (30 + Math.cos(now * 0.00025) * 6) * TILE_W;
      camera.y = (30 + Math.sin(now * 0.0002) * 5) * TILE_H;
      renderWorldScene(menuPanoramaWorld, true);
    }
    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);
})();
