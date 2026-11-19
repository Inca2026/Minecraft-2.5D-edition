// Core Game Constants, Seeded PRNG, Items, Recipes & Presets

const WORLD_SIZE = 60;
const TILE_W = 48;
const TILE_H = 38;
const BLOCK_DEPTH = 14;

const WORLDS_INDEX_KEY = 'pmc_25d_worlds_index_v1';
const PROFILE_KEY = 'pmc_25d_profile_v1';
const SETTINGS_KEY = 'pmc_25d_settings_v1';

class SeededRandom {
  constructor(seedStr) {
    let h = 2166136261 >>> 0;
    const str = String(seedStr || Math.floor(Math.random() * 999999));
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    this.state = h >>> 0;
  }
  next() {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

const TERRAIN = {
  WATER: 0,
  SAND: 1,
  GRASS: 2,
  FOREST: 3,
  SNOW: 4,
  FLOOR_WOOD: 5,
  STONE_FLOOR: 6,
  DEEPSLATE: 7,
  SCULK: 8,
  NETHERRACK: 9,
  LAVA: 10,
  END_STONE: 11,
  VOID: 12
};

const OBJ = {
  NONE: 0,
  TREE: 1,
  PINE_TREE: 2,
  CACTUS: 3,
  ROCK: 4,
  COAL_ORE: 5,
  IRON_ORE: 6,
  GOLD_ORE: 7,
  DIAMOND_ORE: 8,
  OBSIDIAN: 9,
  QUARTZ_ORE: 10,
  ANCIENT_DEBRIS: 11,
  BERRY_BUSH: 12,
  STUMP: 13,
  WALL_WOOD: 14,
  WALL_STONE: 15,
  DOOR_WOOD: 16,
  FURNACE: 17,
  CAMPFIRE: 18,
  TORCH: 19,
  BED: 20,
  CAVE_DOWN: 21,
  CAVE_UP: 22,
  NETHER_PORTAL: 23,
  END_PORTAL: 24,
  END_CRYSTAL: 25,
  SCULK_SENSOR: 26,
  ANCIENT_CHEST: 27
};

const ITEMS = {
  wood:            { name: 'Oak Log',         type: 'mat',   stack: 99 },
  planks:          { name: 'Wood Planks',     type: 'mat',   stack: 99 },
  sticks:          { name: 'Sticks',          type: 'mat',   stack: 99 },
  cobble:          { name: 'Cobblestone',     type: 'mat',   stack: 99 },
  sand:            { name: 'Sand',            type: 'mat',   stack: 99 },
  glass:           { name: 'Glass',           type: 'mat',   stack: 99 },
  coal:            { name: 'Coal',            type: 'mat',   stack: 99 },
  iron_ore:        { name: 'Raw Iron',        type: 'mat',   stack: 99 },
  iron_ingot:      { name: 'Iron Ingot',      type: 'mat',   stack: 99 },
  gold_ore:        { name: 'Raw Gold',        type: 'mat',   stack: 99 },
  gold_ingot:      { name: 'Gold Ingot',      type: 'mat',   stack: 99 },
  diamond:         { name: 'Diamond',         type: 'mat',   stack: 99 },
  obsidian:        { name: 'Obsidian',        type: 'mat',   stack: 99 },
  quartz:          { name: 'Nether Quartz',   type: 'mat',   stack: 99 },
  ancient_debris:  { name: 'Ancient Debris',  type: 'mat',   stack: 99 },
  netherite_scrap: { name: 'Netherite Scrap', type: 'mat',   stack: 99 },
  netherite_ingot: { name: 'Netherite Ingot', type: 'mat',   stack: 99 },
  leather:         { name: 'Leather',         type: 'mat',   stack: 99 },
  wool:            { name: 'Wool',            type: 'mat',   stack: 99 },
  blaze_rod:       { name: 'Blaze Rod',       type: 'mat',   stack: 99 },
  blaze_powder:    { name: 'Blaze Powder',    type: 'mat',   stack: 99 },
  ender_pearl:     { name: 'Ender Pearl',     type: 'mat',   stack: 99 },
  eye_of_ender:    { name: 'Eye of Ender',    type: 'mat',   stack: 99 },
  dragon_egg:      { name: 'Dragon Egg',      type: 'mat',   stack: 1 },

  apple:           { name: 'Apple',           type: 'food',  hunger: 4,  heal: 2,  stack: 99 },
  berries:         { name: 'Sweet Berries',   type: 'food',  hunger: 3,  heal: 1,  stack: 99 },
  raw_meat:        { name: 'Raw Beef',        type: 'food',  hunger: 3,  heal: 1,  stack: 99 },
  cooked_meat:     { name: 'Cooked Steak',    type: 'food',  hunger: 9,  heal: 5,  stack: 99 },
  golden_apple:    { name: 'Golden Apple',    type: 'food',  hunger: 12, heal: 14, stack: 99 },

  wood_pick:       { name: 'Wood Pickaxe',    type: 'tool',  toolType: 'pick',  tier: 1, power: 2.0, dmg: 3,  stack: 1 },
  wood_axe:        { name: 'Wood Axe',        type: 'tool',  toolType: 'axe',   tier: 1, power: 2.5, dmg: 4,  stack: 1 },
  stone_pick:      { name: 'Stone Pickaxe',   type: 'tool',  toolType: 'pick',  tier: 2, power: 3.3, dmg: 4,  stack: 1 },
  stone_sword:     { name: 'Stone Sword',     type: 'tool',  toolType: 'sword', tier: 2, power: 1.2, dmg: 6,  stack: 1 },
  bow:             { name: 'Bow',             type: 'bow',   dmg: 6, stack: 1 },
  iron_pick:       { name: 'Iron Pickaxe',    type: 'tool',  toolType: 'pick',  tier: 3, power: 4.8, dmg: 5,  stack: 1 },
  iron_sword:      { name: 'Iron Sword',      type: 'tool',  toolType: 'sword', tier: 3, power: 1.4, dmg: 8,  stack: 1 },
  diamond_pick:    { name: 'Diamond Pickaxe', type: 'tool',  toolType: 'pick',  tier: 4, power: 7.0, dmg: 6,  stack: 1 },
  diamond_sword:   { name: 'Diamond Sword',   type: 'tool',  toolType: 'sword', tier: 4, power: 1.6, dmg: 11, stack: 1 },
  netherite_sword: { name: 'Netherite Sword', type: 'tool',  toolType: 'sword', tier: 5, power: 2.0, dmg: 15, stack: 1 },

  leather_armor:   { name: 'Leather Tunic',   type: 'armor', defense: 0.22, stack: 1 },
  iron_armor:      { name: 'Iron Chestplate', type: 'armor', defense: 0.45, stack: 1 },
  diamond_armor:   { name: 'Diamond Armor',   type: 'armor', defense: 0.65, stack: 1 },
  netherite_armor: { name: 'Netherite Armor', type: 'armor', defense: 0.80, stack: 1 },

  wood_wall:       { name: 'Wood Planks Wall',type: 'place', placeObj: OBJ.WALL_WOOD, stack: 99 },
  stone_wall:      { name: 'Cobble Wall',     type: 'place', placeObj: OBJ.WALL_STONE, stack: 99 },
  wood_door:       { name: 'Oak Door',        type: 'place', placeObj: OBJ.DOOR_WOOD, stack: 99 },
  wood_floor:      { name: 'Wood Floor',      type: 'place', placeTerrain: TERRAIN.FLOOR_WOOD, stack: 99 },
  wood_roof:       { name: 'Wood Roof',       type: 'place', placeRoof: true, stack: 99 },
  furnace:         { name: 'Furnace',         type: 'place', placeObj: OBJ.FURNACE, stack: 99 },
  campfire:        { name: 'Campfire',        type: 'place', placeObj: OBJ.CAMPFIRE, stack: 99 },
  torch:           { name: 'Torch',           type: 'place', placeObj: OBJ.TORCH, stack: 99 },
  bed:             { name: 'Red Bed',         type: 'place', placeObj: OBJ.BED, stack: 99 },
  cave_ladder:     { name: 'Mine Shaft',      type: 'place', placeObj: OBJ.CAVE_DOWN, stack: 99 },
  nether_portal:   { name: 'Nether Portal',   type: 'place', placeObj: OBJ.NETHER_PORTAL, stack: 99 },
  end_portal:      { name: 'End Portal',      type: 'place', placeObj: OBJ.END_PORTAL, stack: 99 }
};

const RECIPES = [
  { out: 'planks',          count: 4, cat: 'tools',   cost: { wood: 1 },                    desc: 'Crafting material' },
  { out: 'sticks',          count: 4, cat: 'tools',   cost: { planks: 2 },                  desc: 'Handles for tools' },
  { out: 'wood_pick',       count: 1, cat: 'tools',   cost: { planks: 3, sticks: 2 },       desc: 'Mines Stone & Coal' },
  { out: 'wood_axe',        count: 1, cat: 'tools',   cost: { planks: 3, sticks: 2 },       desc: 'Chops trees fast' },
  { out: 'stone_pick',      count: 1, cat: 'tools',   cost: { cobble: 3, sticks: 2 },       desc: 'Mines Iron Ore' },
  { out: 'stone_sword',     count: 1, cat: 'tools',   cost: { cobble: 2, sticks: 1 },       desc: '6 Attack Damage' },
  { out: 'bow',             count: 1, cat: 'tools',   cost: { sticks: 3, wool: 2 },         desc: 'Ranged bow attack' },
  { out: 'leather_armor',   count: 1, cat: 'tools',   cost: { leather: 4 },                 desc: '22% Armor Defense' },
  { out: 'iron_pick',       count: 1, cat: 'tools',   cost: { iron_ingot: 3, sticks: 2 },   desc: 'Mines Gold & Diamond' },
  { out: 'iron_sword',      count: 1, cat: 'tools',   cost: { iron_ingot: 2, sticks: 1 },   desc: '8 Attack Damage' },
  { out: 'iron_armor',      count: 1, cat: 'tools',   cost: { iron_ingot: 5 },              desc: '45% Armor Defense' },
  { out: 'diamond_pick',    count: 1, cat: 'tools',   cost: { diamond: 3, sticks: 2 },      desc: 'Mines Obsidian & Debris' },
  { out: 'diamond_sword',   count: 1, cat: 'tools',   cost: { diamond: 2, sticks: 1 },      desc: '11 Attack Damage' },
  { out: 'diamond_armor',   count: 1, cat: 'tools',   cost: { diamond: 5 },                 desc: '65% Armor Defense' },
  { out: 'netherite_ingot', count: 1, cat: 'tools',   cost: { netherite_scrap: 2, gold_ingot: 2 }, desc: 'Netherite alloy' },
  { out: 'netherite_sword', count: 1, cat: 'tools',   cost: { diamond_sword: 1, netherite_ingot: 1 }, desc: '15 Attack Damage' },
  { out: 'netherite_armor', count: 1, cat: 'tools',   cost: { diamond_armor: 1, netherite_ingot: 1 }, desc: '80% Armor Defense' },
  { out: 'golden_apple',    count: 1, cat: 'tools',   cost: { apple: 1, gold_ingot: 4 },    desc: 'Heals +14 HP' },

  { out: 'wood_wall',       count: 2, cat: 'build',   cost: { planks: 4 },                  desc: '2.5D Wooden Wall' },
  { out: 'stone_wall',      count: 2, cat: 'build',   cost: { cobble: 4 },                  desc: '2.5D Stone Wall' },
  { out: 'wood_door',       count: 1, cat: 'build',   cost: { planks: 4 },                  desc: 'Right-click to toggle' },
  { out: 'wood_floor',      count: 2, cat: 'build',   cost: { planks: 2 },                  desc: 'Wooden floorboards' },
  { out: 'wood_roof',       count: 2, cat: 'build',   cost: { planks: 3 },                  desc: 'Sheltered HP regen' },
  { out: 'furnace',         count: 1, cat: 'build',   cost: { cobble: 8 },                  desc: 'Smelt ores & meat' },
  { out: 'bed',             count: 1, cat: 'build',   cost: { planks: 3, wool: 3 },         desc: 'Sleep & set spawn' },
  { out: 'campfire',        count: 1, cat: 'build',   cost: { wood: 3, coal: 1 },           desc: 'Warm light & healing' },
  { out: 'torch',           count: 4, cat: 'build',   cost: { sticks: 1, coal: 1 },         desc: 'Light source' },

  { out: 'iron_ingot',      count: 1, cat: 'smelt',   needFurnace: true, cost: { iron_ore: 1 },       desc: 'Smelt Raw Iron' },
  { out: 'gold_ingot',      count: 1, cat: 'smelt',   needFurnace: true, cost: { gold_ore: 1 },       desc: 'Smelt Raw Gold' },
  { out: 'cooked_meat',     count: 1, cat: 'smelt',   needFurnace: true, cost: { raw_meat: 1 },       desc: 'Cook Steak (+9 Food)' },
  { out: 'glass',           count: 1, cat: 'smelt',   needFurnace: true, cost: { sand: 1 },           desc: 'Smelt Sand' },
  { out: 'netherite_scrap', count: 1, cat: 'smelt',   needFurnace: true, cost: { ancient_debris: 1 }, desc: 'Smelt Debris' },

  { out: 'cave_ladder',     count: 1, cat: 'portals', cost: { planks: 6, sticks: 4 },     desc: 'Enter Caves/Deep Dark' },
  { out: 'nether_portal',   count: 1, cat: 'portals', cost: { obsidian: 6, iron_ingot: 1 }, desc: 'Enter The Nether' },
  { out: 'blaze_powder',    count: 2, cat: 'portals', cost: { blaze_rod: 1 },             desc: 'Nether alchemy dust' },
  { out: 'eye_of_ender',    count: 1, cat: 'portals', cost: { ender_pearl: 1, blaze_powder: 1 }, desc: 'Unlocks End Portal' },
  { out: 'end_portal',      count: 1, cat: 'portals', cost: { eye_of_ender: 4, obsidian: 4 }, desc: 'Enter The End' }
];

const SKIN_PRESETS = {
  Steve:    { skin: '#d9a077', hair: '#4a2e16', eyes: '#3b2f8f', shirt: '#00a8a8', pants: '#3b4990' },
  Alex:     { skin: '#f1c29b', hair: '#c95b1e', eyes: '#2e7d32', shirt: '#5b9e38', pants: '#4d3b2b' },
  Knight:   { skin: '#d9a077', hair: '#2c3e50', eyes: '#0984e3', shirt: '#95a5a6', pants: '#576574' },
  Creeper:  { skin: '#4cd137', hair: '#2f8c22', eyes: '#111111', shirt: '#44bd32', pants: '#2f8c22' },
  Enderman: { skin: '#181818', hair: '#111111', eyes: '#e056fd', shirt: '#222222', pants: '#141414' }
};

const DEFAULT_PROFILE = {
  username: 'Steve',
  skin: { ...SKIN_PRESETS.Steve }
};

const DEFAULT_SETTINGS = {
  zoom: 100,
  brightness: 78,
  renderDistance: 14,
  volume: 70,
  showMinimap: true,
  showCoords: true,
  dynamicLighting: true,
  autoSave: true
};
