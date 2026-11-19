// Procedural 16x16 Pixel-Art Texture Atlas & 2.5D Sprite Renderer

window.Textures = (() => {
  const terrainCache = {};
  const blockCache = {};
  const itemCache = {};
  const mobCache = {};

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function hash2D(x, y, seed = 1) {
    let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967296;
  }

  function shiftHex(hex, delta) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + delta));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + delta));
    const b = Math.max(0, Math.min(255, (num & 255) + delta));
    return `rgb(${r},${g},${b})`;
  }

  function createPixelTile(baseHex, accentHex, seed = 1, flecks = null) {
    const c = makeCanvas(16, 16);
    const ctx = c.getContext('2d');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = hash2D(x, y, seed);
        if (flecks && r > 0.84) {
          ctx.fillStyle = flecks;
        } else if (r > 0.65 && accentHex) {
          ctx.fillStyle = accentHex;
        } else {
          ctx.fillStyle = shiftHex(baseHex, Math.floor((r - 0.5) * 22));
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  function createPlankTile(baseHex, lineHex) {
    const c = makeCanvas(16, 16);
    const ctx = c.getContext('2d');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = hash2D(x, y, 9);
        ctx.fillStyle = (y % 4 === 0) ? lineHex : shiftHex(baseHex, Math.floor((r - 0.5) * 16));
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = lineHex;
    ctx.fillRect(7, 0, 1, 4);
    ctx.fillRect(14, 4, 1, 4);
    ctx.fillRect(4, 8, 1, 4);
    ctx.fillRect(11, 12, 1, 4);
    return c;
  }

  function buildTerrainTextures() {
    const dirtSide = createPixelTile('#79553a', '#5c3f2a', 2);
    const stoneSide = createPixelTile('#595d60', '#414447', 3);

    terrainCache[TERRAIN.GRASS] = {
      top: createPixelTile('#5d9e38', '#4d872d', 11),
      side: dirtSide
    };
    terrainCache[TERRAIN.FOREST] = {
      top: createPixelTile('#46822c', '#366920', 12),
      side: dirtSide
    };
    terrainCache[TERRAIN.SAND] = {
      top: createPixelTile('#dfd49a', '#cfc282', 13),
      side: createPixelTile('#bfb274', '#a89b60', 14)
    };
    terrainCache[TERRAIN.SNOW] = {
      top: createPixelTile('#eef5f8', '#d7e4ea', 15),
      side: dirtSide
    };
    terrainCache[TERRAIN.WATER] = {
      top: createPixelTile('#2d6fd6', '#3d82eb', 16),
      side: null
    };
    terrainCache[TERRAIN.FLOOR_WOOD] = {
      top: createPlankTile('#b58952', '#7d5b32'),
      side: createPlankTile('#8c6639', '#5c4121')
    };
    terrainCache[TERRAIN.STONE_FLOOR] = {
      top: createPixelTile('#7a7d80', '#636669', 17),
      side: stoneSide
    };
    terrainCache[TERRAIN.DEEPSLATE] = {
      top: createPixelTile('#3d4045', '#2c2e33', 18),
      side: createPixelTile('#26282c', '#1b1d20', 19)
    };
    terrainCache[TERRAIN.SCULK] = {
      top: createPixelTile('#0a2936', '#00a8a8', 20, '#00e5ff'),
      side: createPixelTile('#071d26', '#006064', 21)
    };
    terrainCache[TERRAIN.NETHERRACK] = {
      top: createPixelTile('#6e2b2b', '#4f1b1b', 22),
      side: createPixelTile('#4d1b1b', '#361111', 23)
    };
    terrainCache[TERRAIN.LAVA] = {
      top: createPixelTile('#e85d04', '#ffba08', 24, '#ffd166'),
      side: null
    };
    terrainCache[TERRAIN.END_STONE] = {
      top: createPixelTile('#dfd99e', '#c5be7e', 25),
      side: createPixelTile('#b5ae70', '#968f56', 26)
    };
    terrainCache[TERRAIN.VOID] = {
      top: createPixelTile('#09070d', '#120d1c', 27),
      side: null
    };
  }

  function buildBlockTextures() {
    const stoneTop = createPixelTile('#7d8082', '#646769', 30);
    const stoneFront = createPixelTile('#636669', '#4c4f52', 31);

    blockCache[OBJ.ROCK] = { top: stoneTop, front: stoneFront, height: 18 };
    blockCache[OBJ.COAL_ORE] = {
      top: createPixelTile('#7d8082', '#646769', 32, '#1a1a1a'),
      front: createPixelTile('#636669', '#4c4f52', 33, '#141414'),
      height: 18
    };
    blockCache[OBJ.IRON_ORE] = {
      top: createPixelTile('#7d8082', '#646769', 34, '#d8af93'),
      front: createPixelTile('#636669', '#4c4f52', 35, '#c49678'),
      height: 18
    };
    blockCache[OBJ.GOLD_ORE] = {
      top: createPixelTile('#7d8082', '#646769', 36, '#fcee4b'),
      front: createPixelTile('#636669', '#4c4f52', 37, '#e0c928'),
      height: 18
    };
    blockCache[OBJ.DIAMOND_ORE] = {
      top: createPixelTile('#7d8082', '#646769', 38, '#4aedd9'),
      front: createPixelTile('#636669', '#4c4f52', 39, '#2ec4b6'),
      height: 18
    };
    blockCache[OBJ.OBSIDIAN] = {
      top: createPixelTile('#1b122b', '#2e1d47', 40, '#5a388c'),
      front: createPixelTile('#120b1f', '#211436', 41, '#43286b'),
      height: 20
    };
    blockCache[OBJ.QUARTZ_ORE] = {
      top: createPixelTile('#6e2b2b', '#4f1b1b', 42, '#f5f3eb'),
      front: createPixelTile('#541e1e', '#3b1313', 43, '#e0ddd1'),
      height: 18
    };
    blockCache[OBJ.ANCIENT_DEBRIS] = {
      top: createPixelTile('#5c3c2e', '#40281e', 44, '#8c5a45'),
      front: createPixelTile('#452b20', '#2e1b13', 45, '#6e4534'),
      height: 18
    };
    blockCache[OBJ.WALL_WOOD] = {
      top: createPlankTile('#bd9157', '#856235'),
      front: createPlankTile('#967141', '#694d29'),
      height: 24
    };
    blockCache[OBJ.WALL_STONE] = {
      top: createPixelTile('#878a8c', '#696c6e', 46),
      front: createPixelTile('#686b6e', '#4c4f52', 47),
      height: 24
    };
    blockCache[OBJ.FURNACE] = {
      top: stoneTop,
      front: (() => {
        const c = createPixelTile('#636669', '#4c4f52', 48);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(4, 3, 8, 4);
        ctx.fillRect(4, 9, 8, 5);
        ctx.fillStyle = '#ff6b00';
        ctx.fillRect(5, 10, 6, 3);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(6, 11, 4, 2);
        return c;
      })(),
      height: 20
    };
    blockCache[OBJ.ANCIENT_CHEST] = {
      top: createPlankTile('#a87732', '#5c3e14'),
      front: (() => {
        const c = createPlankTile('#8f6326', '#4a310e');
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 4, 16, 1);
        ctx.fillStyle = '#e5e5e5';
        ctx.fillRect(7, 3, 2, 3);
        return c;
      })(),
      height: 15
    };
  }

  function buildItemIcons() {
    const drawPixelArt = (id, fn) => {
      const c = makeCanvas(16, 16);
      const ctx = c.getContext('2d');
      fn(ctx);
      itemCache[id] = c;
    };

    // Blocks & Raw Materials
    drawPixelArt('wood', (c) => {
      c.fillStyle = '#6b4c2a'; c.fillRect(3, 2, 10, 12);
      c.fillStyle = '#c89d66'; c.fillRect(4, 2, 8, 3);
      c.fillStyle = '#4e351b'; c.fillRect(5, 6, 1, 7); c.fillRect(10, 5, 1, 8);
    });
    drawPixelArt('planks', (c) => { c.drawImage(createPlankTile('#bd9157', '#7d5b32'), 2, 2, 12, 12); });
    drawPixelArt('sticks', (c) => {
      c.fillStyle = '#8b5a2b';
      for (let i = 0; i < 9; i++) c.fillRect(3 + i, 12 - i, 2, 2);
    });
    drawPixelArt('cobble', (c) => { c.drawImage(createPixelTile('#7d8082', '#4f5254', 30), 2, 2, 12, 12); });
    drawPixelArt('sand', (c) => { c.drawImage(createPixelTile('#dfd49a', '#bfb274', 13), 2, 2, 12, 12); });
    drawPixelArt('glass', (c) => {
      c.fillStyle = '#bce8f1'; c.fillRect(2, 2, 12, 12);
      c.fillStyle = '#ffffff'; c.fillRect(4, 4, 3, 1); c.fillRect(4, 5, 1, 2);
    });
    drawPixelArt('coal', (c) => {
      c.fillStyle = '#222222'; c.fillRect(4, 4, 8, 8);
      c.fillStyle = '#3d3d3d'; c.fillRect(5, 5, 3, 2);
    });
    const makeIngot = (id, main, hi) => drawPixelArt(id, (c) => {
      c.fillStyle = main; c.fillRect(3, 6, 10, 5); c.fillRect(4, 5, 8, 1);
      c.fillStyle = hi; c.fillRect(4, 6, 7, 2);
    });
    makeIngot('iron_ore', '#b88b6d', '#e3bfa6');
    makeIngot('iron_ingot', '#d8d8d8', '#ffffff');
    makeIngot('gold_ore', '#d4af37', '#fff066');
    makeIngot('gold_ingot', '#fcee4b', '#fff9a6');
    makeIngot('netherite_scrap', '#6e4534', '#9e6b55');
    makeIngot('netherite_ingot', '#443d42', '#6e646b');

    drawPixelArt('diamond', (c) => {
      c.fillStyle = '#2ec4b6'; c.fillRect(4, 4, 8, 8); c.fillRect(5, 3, 6, 10);
      c.fillStyle = '#a8fff6'; c.fillRect(5, 5, 3, 3);
    });
    drawPixelArt('obsidian', (c) => { c.drawImage(createPixelTile('#1b122b', '#43286b', 40), 2, 2, 12, 12); });
    drawPixelArt('quartz', (c) => {
      c.fillStyle = '#ece9df'; c.fillRect(4, 4, 8, 8);
      c.fillStyle = '#ffffff'; c.fillRect(5, 4, 4, 4);
    });
    drawPixelArt('ancient_debris', (c) => { c.drawImage(createPixelTile('#5c3c2e', '#8c5a45', 44), 2, 2, 12, 12); });
    drawPixelArt('leather', (c) => {
      c.fillStyle = '#b55d2b'; c.fillRect(3, 3, 10, 10);
      c.fillStyle = '#d47842'; c.fillRect(4, 4, 6, 6);
    });
    drawPixelArt('wool', (c) => {
      c.fillStyle = '#f1f2f6'; c.fillRect(2, 2, 12, 12);
      c.fillStyle = '#dfe4ea'; c.fillRect(4, 8, 8, 4);
    });
    drawPixelArt('blaze_rod', (c) => {
      c.fillStyle = '#ff9f1a';
      for (let i = 0; i < 10; i++) c.fillRect(3 + i, 12 - i, 2, 2);
      c.fillStyle = '#fff200'; c.fillRect(10, 3, 3, 3);
    });
    drawPixelArt('blaze_powder', (c) => {
      c.fillStyle = '#ff6b00'; c.fillRect(4, 6, 8, 6);
      c.fillStyle = '#ffd32a'; c.fillRect(6, 4, 4, 5);
    });
    drawPixelArt('ender_pearl', (c) => {
      c.fillStyle = '#0c594f'; c.fillRect(4, 4, 8, 8);
      c.fillStyle = '#38d9a9'; c.fillRect(5, 5, 5, 5);
      c.fillStyle = '#c3fae8'; c.fillRect(6, 6, 2, 2);
    });
    drawPixelArt('eye_of_ender', (c) => {
      c.fillStyle = '#20c997'; c.fillRect(4, 4, 8, 8);
      c.fillStyle = '#111111'; c.fillRect(7, 5, 2, 6);
      c.fillStyle = '#a9e34b'; c.fillRect(6, 6, 1, 3);
    });
    drawPixelArt('dragon_egg', (c) => {
      c.fillStyle = '#140c1c'; c.fillRect(5, 2, 6, 12); c.fillRect(4, 5, 8, 7);
      c.fillStyle = '#be2edd'; c.fillRect(6, 5, 2, 2); c.fillRect(8, 9, 2, 2);
    });

    // Foods
    drawPixelArt('apple', (c) => {
      c.fillStyle = '#e03131'; c.fillRect(4, 5, 8, 8); c.fillRect(5, 4, 6, 9);
      c.fillStyle = '#5c3c1e'; c.fillRect(7, 2, 2, 3);
      c.fillStyle = '#ff8787'; c.fillRect(5, 6, 2, 2);
    });
    drawPixelArt('golden_apple', (c) => {
      c.fillStyle = '#fcc419'; c.fillRect(4, 5, 8, 8); c.fillRect(5, 4, 6, 9);
      c.fillStyle = '#5c3c1e'; c.fillRect(7, 2, 2, 3);
      c.fillStyle = '#fff9db'; c.fillRect(5, 6, 2, 2);
    });
    drawPixelArt('berries', (c) => {
      c.fillStyle = '#2f9e44'; c.fillRect(4, 4, 8, 6);
      c.fillStyle = '#f03e3e'; c.fillRect(5, 6, 2, 2); c.fillRect(9, 7, 2, 2); c.fillRect(6, 10, 2, 2);
    });
    drawPixelArt('raw_meat', (c) => {
      c.fillStyle = '#c92a2a'; c.fillRect(3, 5, 10, 6);
      c.fillStyle = '#ffc9c9'; c.fillRect(4, 6, 4, 2);
    });
    drawPixelArt('cooked_meat', (c) => {
      c.fillStyle = '#7f4f24'; c.fillRect(3, 5, 10, 6);
      c.fillStyle = '#a47148'; c.fillRect(4, 6, 6, 3);
    });

    // Tools & Weapons
    const makePick = (id, headCol) => drawPixelArt(id, (c) => {
      c.fillStyle = '#8b5a2b';
      for (let i = 0; i < 8; i++) c.fillRect(3 + i, 12 - i, 2, 2);
      c.fillStyle = headCol;
      c.fillRect(4, 2, 8, 2); c.fillRect(11, 3, 2, 7); c.fillRect(3, 3, 2, 2);
    });
    makePick('wood_pick', '#b58952');
    makePick('stone_pick', '#868e96');
    makePick('iron_pick', '#e9ecef');
    makePick('diamond_pick', '#3bc9db');

    drawPixelArt('wood_axe', (c) => {
      c.fillStyle = '#8b5a2b';
      for (let i = 0; i < 8; i++) c.fillRect(3 + i, 12 - i, 2, 2);
      c.fillStyle = '#b58952';
      c.fillRect(8, 2, 5, 5); c.fillRect(10, 7, 3, 2);
    });

    const makeSword = (id, bladeCol) => drawPixelArt(id, (c) => {
      c.fillStyle = '#6b4c2a'; c.fillRect(2, 12, 2, 2);
      c.fillStyle = '#495057'; c.fillRect(3, 9, 4, 4);
      c.fillStyle = bladeCol;
      for (let i = 0; i < 8; i++) c.fillRect(5 + i, 10 - i, 2, 2);
    });
    makeSword('stone_sword', '#868e96');
    makeSword('iron_sword', '#f1f3f5');
    makeSword('diamond_sword', '#3bc9db');
    makeSword('netherite_sword', '#595057');

    drawPixelArt('bow', (c) => {
      c.fillStyle = '#8b5a2b';
      c.fillRect(4, 2, 2, 3); c.fillRect(6, 5, 2, 6); c.fillRect(4, 11, 2, 3);
      c.fillStyle = '#dee2e6'; c.fillRect(3, 3, 1, 10);
    });

    // Armor
    const makeArmor = (id, col) => drawPixelArt(id, (c) => {
      c.fillStyle = col;
      c.fillRect(3, 3, 10, 10);
      c.clearRect(6, 3, 4, 2);
      c.clearRect(3, 8, 2, 5);
      c.clearRect(11, 8, 2, 5);
    });
    makeArmor('leather_armor', '#b55d2b');
    makeArmor('iron_armor', '#dee2e6');
    makeArmor('diamond_armor', '#3bc9db');
    makeArmor('netherite_armor', '#4f464d');

    // Placeables
    drawPixelArt('wood_wall', (c) => { c.drawImage(blockCache[OBJ.WALL_WOOD].front, 2, 2, 12, 12); });
    drawPixelArt('stone_wall', (c) => { c.drawImage(blockCache[OBJ.WALL_STONE].front, 2, 2, 12, 12); });
    drawPixelArt('wood_door', (c) => {
      c.fillStyle = '#a67c46'; c.fillRect(4, 1, 8, 14);
      c.fillStyle = '#5c4121'; c.fillRect(6, 3, 4, 4); c.fillRect(10, 8, 1, 2);
    });
    drawPixelArt('wood_floor', (c) => { c.drawImage(terrainCache[TERRAIN.FLOOR_WOOD].top, 2, 3, 12, 10); });
    drawPixelArt('wood_roof', (c) => {
      c.fillStyle = '#8d5524'; c.fillRect(2, 6, 12, 6);
      c.fillStyle = '#a86932'; c.fillRect(4, 4, 8, 2);
    });
    drawPixelArt('furnace', (c) => { c.drawImage(blockCache[OBJ.FURNACE].front, 2, 2, 12, 12); });
    drawPixelArt('campfire', (c) => {
      c.fillStyle = '#6b4c2a'; c.fillRect(2, 11, 12, 3);
      c.fillStyle = '#ff6b00'; c.fillRect(5, 5, 6, 6);
      c.fillStyle = '#ffd32a'; c.fillRect(6, 7, 4, 4);
    });
    drawPixelArt('torch', (c) => {
      c.fillStyle = '#8b5a2b'; c.fillRect(7, 6, 2, 8);
      c.fillStyle = '#ff922b'; c.fillRect(6, 3, 4, 4);
      c.fillStyle = '#fff3bf'; c.fillRect(7, 4, 2, 2);
    });
    drawPixelArt('bed', (c) => {
      c.fillStyle = '#e03131'; c.fillRect(2, 6, 12, 6);
      c.fillStyle = '#ffffff'; c.fillRect(2, 6, 4, 6);
      c.fillStyle = '#6b4c2a'; c.fillRect(2, 12, 2, 2); c.fillRect(12, 12, 2, 2);
    });
    drawPixelArt('cave_ladder', (c) => {
      c.fillStyle = '#a67c46';
      c.fillRect(4, 2, 2, 12); c.fillRect(10, 2, 2, 12);
      c.fillRect(4, 4, 8, 2); c.fillRect(4, 8, 8, 2); c.fillRect(4, 12, 8, 2);
    });
    drawPixelArt('nether_portal', (c) => {
      c.fillStyle = '#1b122b'; c.fillRect(2, 1, 12, 14);
      c.fillStyle = '#ae3ec9'; c.fillRect(4, 3, 8, 10);
      c.fillStyle = '#e599f7'; c.fillRect(6, 5, 4, 6);
    });
    drawPixelArt('end_portal', (c) => {
      c.fillStyle = '#20c997'; c.fillRect(2, 2, 12, 12);
      c.fillStyle = '#0b132b'; c.fillRect(4, 4, 8, 8);
      c.fillStyle = '#66d9e8'; c.fillRect(6, 6, 2, 2);
    });
  }

  function buildMobSprites() {
    const makeMob = (kind, fn) => {
      const c = makeCanvas(24, 28);
      const ctx = c.getContext('2d');
      fn(ctx);
      mobCache[kind] = c;
    };

    makeMob('cow', (c) => {
      c.fillStyle = '#6d4c41'; c.fillRect(4, 10, 16, 11);
      c.fillStyle = '#eceff1'; c.fillRect(6, 12, 5, 4); c.fillRect(14, 15, 4, 4);
      c.fillStyle = '#4e342e'; c.fillRect(7, 4, 10, 8);
      c.fillStyle = '#bdbdbd'; c.fillRect(6, 3, 2, 3); c.fillRect(16, 3, 2, 3);
      c.fillStyle = '#111'; c.fillRect(9, 7, 2, 2); c.fillRect(13, 7, 2, 2);
    });
    makeMob('pig', (c) => {
      c.fillStyle = '#f48fb1'; c.fillRect(4, 11, 16, 10);
      c.fillStyle = '#f06292'; c.fillRect(7, 5, 10, 8);
      c.fillStyle = '#ec407a'; c.fillRect(9, 9, 6, 3);
      c.fillStyle = '#111'; c.fillRect(8, 7, 2, 2); c.fillRect(14, 7, 2, 2);
    });
    makeMob('sheep', (c) => {
      c.fillStyle = '#f8f9fa'; c.fillRect(3, 9, 18, 12);
      c.fillStyle = '#d7ccc8'; c.fillRect(7, 5, 10, 8);
      c.fillStyle = '#111'; c.fillRect(8, 7, 2, 2); c.fillRect(14, 7, 2, 2);
    });
    makeMob('zombie', (c) => {
      c.fillStyle = '#2b8a3e'; c.fillRect(7, 2, 10, 9);
      c.fillStyle = '#00a8a8'; c.fillRect(6, 11, 12, 9);
      c.fillStyle = '#3b4990'; c.fillRect(7, 20, 10, 6);
      c.fillStyle = '#111'; c.fillRect(9, 5, 2, 2); c.fillRect(13, 5, 2, 2);
    });
    makeMob('skeleton', (c) => {
      c.fillStyle = '#dee2e6'; c.fillRect(7, 2, 10, 9);
      c.fillStyle = '#ced4da'; c.fillRect(7, 11, 10, 15);
      c.fillStyle = '#111'; c.fillRect(9, 5, 2, 2); c.fillRect(13, 5, 2, 2);
    });
    makeMob('creeper', (c) => {
      c.fillStyle = '#40c057'; c.fillRect(7, 2, 10, 9); c.fillRect(8, 11, 8, 10);
      c.fillStyle = '#2f9e44'; c.fillRect(6, 21, 12, 5);
      c.fillStyle = '#111';
      c.fillRect(9, 4, 2, 2); c.fillRect(13, 4, 2, 2);
      c.fillRect(11, 6, 2, 3); c.fillRect(9, 8, 2, 2); c.fillRect(13, 8, 2, 2);
    });
    makeMob('enderman', (c) => {
      c.fillStyle = '#141414'; c.fillRect(8, 1, 8, 8); c.fillRect(9, 9, 6, 18);
      c.fillStyle = '#e056fd'; c.fillRect(9, 4, 2, 1); c.fillRect(13, 4, 2, 1);
    });
    makeMob('blaze', (c) => {
      c.fillStyle = '#f59f00'; c.fillRect(7, 3, 10, 9);
      c.fillStyle = '#ffd43b';
      c.fillRect(4, 13, 2, 9); c.fillRect(11, 14, 2, 10); c.fillRect(18, 13, 2, 9);
      c.fillStyle = '#111'; c.fillRect(9, 6, 2, 2); c.fillRect(13, 6, 2, 2);
    });
    makeMob('piglin', (c) => {
      c.fillStyle = '#e59866'; c.fillRect(7, 2, 10, 9);
      c.fillStyle = '#6e2c00'; c.fillRect(6, 11, 12, 14);
      c.fillStyle = '#fcee4b'; c.fillRect(7, 2, 10, 2);
      c.fillStyle = '#fff'; c.fillRect(9, 5, 2, 2); c.fillRect(13, 5, 2, 2);
    });
    makeMob('warden', (c) => {
      c.fillStyle = '#0b2533'; c.fillRect(4, 4, 16, 22);
      c.fillStyle = '#00e5ff';
      c.fillRect(2, 2, 3, 5); c.fillRect(19, 2, 3, 5);
      c.fillRect(8, 12, 8, 6);
    });
    makeMob('ender_dragon', (c) => {
      c.fillStyle = '#18141c'; c.fillRect(6, 4, 12, 16);
      c.fillStyle = '#2d2436'; c.fillRect(0, 7, 6, 8); c.fillRect(18, 7, 6, 8);
      c.fillStyle = '#e056fd'; c.fillRect(8, 7, 2, 2); c.fillRect(14, 7, 2, 2);
    });
  }

  function init() {
    buildTerrainTextures();
    buildBlockTextures();
    buildItemIcons();
    buildMobSprites();
  }

  function drawPlayerSprite(ctx, x, y, skin, angle, walkPhase, swingProg, armorId, activeItemId) {
    ctx.save();
    ctx.translate(x, y);

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.abs(Math.sin(walkPhase)) * 2.5;
    const legSwing = Math.sin(walkPhase) * 3;

    // Legs (Pants)
    ctx.fillStyle = skin.pants;
    ctx.fillRect(-7, -9 + legSwing, 6, 10);
    ctx.fillRect(1, -9 - legSwing, 6, 10);

    // Torso (Shirt or Armor)
    const armorColors = {
      leather_armor: '#b55d2b',
      iron_armor: '#dee2e6',
      diamond_armor: '#3bc9db',
      netherite_armor: '#4f464d'
    };
    ctx.fillStyle = armorId && armorColors[armorId] ? armorColors[armorId] : skin.shirt;
    ctx.fillRect(-8, -21 - bob, 16, 13);

    // Arms
    ctx.fillStyle = skin.skin;
    ctx.fillRect(-12, -20 - bob - legSwing * 0.5, 4, 10);
    ctx.fillRect(8, -20 - bob + legSwing * 0.5, 4, 10);

    // Head
    ctx.fillStyle = skin.skin;
    ctx.fillRect(-8, -35 - bob, 16, 14);

    // Hair cap
    ctx.fillStyle = skin.hair;
    ctx.fillRect(-8, -36 - bob, 16, 5);
    ctx.fillRect(-8, -32 - bob, 2, 4);
    ctx.fillRect(6, -32 - bob, 2, 4);

    // Eyes (shift slightly toward aim direction)
    const lookX = Math.cos(angle) * 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5 + lookX, -28 - bob, 4, 2);
    ctx.fillRect(1 + lookX, -28 - bob, 4, 2);
    ctx.fillStyle = skin.eyes;
    ctx.fillRect(-4 + lookX, -28 - bob, 2, 2);
    ctx.fillRect(2 + lookX, -28 - bob, 2, 2);

    // Held Item & Swing Arc
    const swingOffset = swingProg > 0 ? Math.sin(swingProg * Math.PI) * 1.2 - 0.4 : 0;
    const handAngle = angle + swingOffset;

    if (swingProg > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -14, 26, angle - 0.65, angle + 0.65);
      ctx.stroke();
    }

    if (activeItemId && itemCache[activeItemId]) {
      ctx.save();
      ctx.translate(Math.cos(handAngle) * 18, -14 + Math.sin(handAngle) * 14);
      ctx.drawImage(itemCache[activeItemId], -10, -10, 20, 20);
      ctx.restore();
    }

    ctx.restore();
  }

  return {
    init,
    getTerrain: (t) => terrainCache[t] || terrainCache[TERRAIN.GRASS],
    getBlock: (obj) => blockCache[obj] || null,
    getItemCanvas: (id) => itemCache[id] || null,
    getMobCanvas: (kind) => mobCache[kind] || null,
    drawPlayerSprite
  };
})();
