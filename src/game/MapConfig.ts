import { WeaponConfig, Perk, InteractiveObject } from "../types";

export const STARTING_WEAPON_ID = "colt_m1911";

export const WEAPONS_DATABASE: { [id: string]: WeaponConfig } = {
  colt_m1911: {
    id: "colt_m1911",
    name: "M1911",
    damage: 20,
    headshotMultiplier: 3.0,
    maxReserve: 80,
    currentReserve: 80,
    maxMag: 8,
    currentMag: 8,
    fireRate: 200,
    reloadTime: 1.5,
    cost: 50,
    description: "Standard issue starting pistol.",
    isPackAPunched: false,
    recoil: 0.12,
    spread: 0.015,
    color: "#71717a",
    fireMode: "semi",
    adsZoom: 0.8,
    ammoTypeName: ".45 ACP"
  },
  olympia: {
    id: "olympia",
    name: "Olympia Double-Barrel",
    damage: 150,
    headshotMultiplier: 1.5,
    maxReserve: 38,
    currentReserve: 38,
    maxMag: 2,
    currentMag: 2,
    fireRate: 250,
    reloadTime: 2.5,
    cost: 500,
    description: "Fires two devastating buckshot shells.",
    isPackAPunched: false,
    recoil: 0.5,
    spread: 0.08,
    color: "#78350f",
    fireMode: "semi",
    adsZoom: 0.85,
    ammoTypeName: "12 Gauge"
  },
  mp5: {
    id: "mp5",
    name: "MP5 SMG",
    damage: 30,
    headshotMultiplier: 2.0,
    maxReserve: 120,
    currentReserve: 120,
    maxMag: 30,
    currentMag: 30,
    fireRate: 80,
    reloadTime: 2.2,
    cost: 1000,
    description: "Fast-firing, highly mobile SMG.",
    isPackAPunched: false,
    recoil: 0.1,
    spread: 0.025,
    color: "#1e293b",
    fireMode: "auto",
    adsZoom: 0.75,
    ammoTypeName: "9mm"
  },
  galil: {
    id: "galil",
    name: "Galil AR",
    damage: 50,
    headshotMultiplier: 2.5,
    maxReserve: 315,
    currentReserve: 315,
    maxMag: 35,
    currentMag: 35,
    fireRate: 110,
    reloadTime: 2.8,
    cost: 1500,
    description: "Heavy assault rifle with excellent damage.",
    isPackAPunched: false,
    recoil: 0.15,
    spread: 0.018,
    color: "#451a03",
    fireMode: "auto",
    adsZoom: 0.7,
    ammoTypeName: "5.56mm"
  },
  ray_gun: {
    id: "ray_gun",
    name: "Ray Gun",
    damage: 400,
    headshotMultiplier: 1.0,
    maxReserve: 160,
    currentReserve: 160,
    maxMag: 20,
    currentMag: 20,
    fireRate: 180,
    reloadTime: 2.2,
    cost: 2500,
    description: "Wonder weapon firing explosive plasma.",
    isPackAPunched: false,
    recoil: 0.05,
    spread: 0.002,
    color: "#dc2626",
    fireMode: "auto",
    adsZoom: 0.8,
    ammoTypeName: "Cold Fusion Cells"
  },
  m14: {
    id: "m14",
    name: "M14 Rifle",
    damage: 65,
    headshotMultiplier: 3.5,
    maxReserve: 92,
    currentReserve: 92,
    maxMag: 10,
    currentMag: 10,
    fireRate: 200,
    reloadTime: 1.8,
    cost: 500,
    description: "Accurate, semi-automatic wood-stocked rifle.",
    isPackAPunched: false,
    recoil: 0.16,
    spread: 0.012,
    color: "#a0522d",
    fireMode: "semi",
    adsZoom: 0.72,
    ammoTypeName: "7.62x51mm NATO"
  },
  remington_870: {
    id: "remington_870",
    name: "Remington 870",
    damage: 180,
    headshotMultiplier: 1.5,
    maxReserve: 48,
    currentReserve: 48,
    maxMag: 6,
    currentMag: 6,
    fireRate: 500,
    reloadTime: 2.8,
    cost: 1000,
    description: "Reliable pump-action shotgun with tight spread.",
    isPackAPunched: false,
    recoil: 0.42,
    spread: 0.06,
    color: "#4a4a4a",
    fireMode: "semi",
    adsZoom: 0.82,
    ammoTypeName: "12 Gauge"
  },
  m16: {
    id: "m16",
    name: "M16 Rifle",
    damage: 38,
    headshotMultiplier: 2.2,
    maxReserve: 150,
    currentReserve: 150,
    maxMag: 30,
    currentMag: 30,
    fireRate: 90,
    reloadTime: 2.0,
    cost: 1200,
    description: "Highly accurate and stable military rifle.",
    isPackAPunched: false,
    recoil: 0.12,
    spread: 0.018,
    color: "#2f3e46",
    fireMode: "auto",
    adsZoom: 0.75,
    ammoTypeName: "5.56x45mm NATO"
  }
};

export function getPackAPunchedWeapon(weapon: WeaponConfig): WeaponConfig {
  return {
    ...weapon,
    id: `${weapon.id}_pap`,
    name: `PaP'd ${weapon.name}`,
    damage: Math.round(weapon.damage * 2.5),
    headshotMultiplier: weapon.headshotMultiplier * 5.0,
    maxMag: Math.round(weapon.maxMag * 3.0),
    currentMag: Math.round(weapon.maxMag * 1.5),
    maxReserve: Math.round(weapon.maxReserve * 1.5),
    currentReserve: Math.round(weapon.maxReserve * 1.5),
    fireRate: Math.max(40, weapon.fireRate * 3.0),
    reloadTime: weapon.reloadTime * 0.7,
    color: "#ec4899", // pink glow
    isPackAPunched: true,
    recoil: weapon.recoil * 0.5,
    spread: weapon.spread * 0.6,
    description: "Weapon fused with potent alien energy."
  };
}

export const PERKS_DATABASE: { [id: string]: Perk } = {
  juggernog: {
    id: "juggernog",
    name: "Juggernog",
    description: "Increases your max health to 250.",
    cost: 2500,
    color: "bg-red-600 border-red-400 text-red-100",
    textColor: "text-red-300",
    lightColor: 0xff0000
  },
  speed_cola: {
    id: "speed_cola",
    name: "Speed Cola",
    description: "Halves reload and swap times.",
    cost: 3000,
    color: "bg-emerald-600 border-emerald-400 text-emerald-100",
    textColor: "text-emerald-300",
    lightColor: 0x10b981
  },
  double_tap: {
    id: "double_tap",
    name: "Double Tap II",
    description: "Fires two bullets per shot, increasing RPM and damage.",
    cost: 2000,
    color: "bg-amber-600 border-amber-400 text-amber-100",
    textColor: "text-amber-300",
    lightColor: 0xf59e0b
  },
  stamin_up: {
    id: "stamin_up",
    name: "Stamin-Up",
    description: "Increases sprint speed and duration.",
    cost: 2000,
    color: "bg-orange-500 border-orange-300 text-orange-100",
    textColor: "text-orange-300",
    lightColor: 0xf97316
  }
};

export interface MapWall {
  x: number; z: number; width: number; depth: number; height: number; color: string;
  isWindow?: boolean;
}
export interface LavaZone {
  x: number; z: number; radius: number;
}
export interface MapDefinition {
  id: string;
  name: string;
  description: string;
  walls: MapWall[];
  lavaZones: LavaZone[];
  interactives: InteractiveObject[];
  playerStartPos: { x: number, y: number, z: number };
  zombieSpawns: { x: number, z: number }[];
  ambientLight: number;
  dirLight: number;
  fogColor: number;
  floorColor: number;
}

export const MAPS: Record<string, MapDefinition> = {
  town: {
    id: "town",
    name: "Town",
    description: "Classic BO2 Survival Map with lava pits.",
    playerStartPos: { x: 0, y: 1.0, z: 10 },
    ambientLight: 0x332a24,
    dirLight: 0x221111,
    fogColor: 0x0a0502,
    floorColor: 0x080808,
    zombieSpawns: [
      { x: 22, z: 22 }, { x: -22, z: 22 }, { x: 22, z: -22 }, { x: -22, z: -22 }
    ],
    interactives: [
      { id: "door_bank", type: "door", cost: 1000, name: "Vault Building Door", description: "Unlocks Bank", position: [-10, 2.5, 8], size: [1, 5, 4] },
      { id: "door_bar", type: "door", cost: 750, name: "Tavern Entrance", description: "Unlocks Bar", position: [12, 2.5, -5], size: [1, 5, 4] },
      { id: "wallbuy_olympia", type: "wallbuy", cost: 500, name: "Olympia", description: "", position: [0, 2.0, 14.8], size: [2.0, 0.8, 0.2], extraId: "olympia" },
      { id: "wallbuy_mp5", type: "wallbuy", cost: 1000, name: "MP5", description: "", position: [-14.8, 2.0, 15], size: [0.2, 0.8, 2.0], extraId: "mp5" },
      { id: "wallbuy_galil", type: "wallbuy", cost: 1500, name: "Galil", description: "", position: [23.8, 2.0, -10], size: [0.2, 0.8, 2.0], extraId: "galil" },
      { id: "wallbuy_m14", type: "wallbuy", cost: 500, name: "M14", description: "", position: [0, 2.0, -23.8], size: [2.0, 0.8, 0.2], extraId: "m14" },
      { id: "wallbuy_remington", type: "wallbuy", cost: 1000, name: "Remington 870", description: "", position: [-23.8, 2.0, -5], size: [0.2, 0.8, 2.0], extraId: "remington_870" },
      { id: "wallbuy_m16", type: "wallbuy", cost: 1200, name: "M16", description: "", position: [23.8, 2.0, 5], size: [0.2, 0.8, 2.0], extraId: "m16" },
      { id: "perk_juggernog", type: "perk", cost: 2500, name: "Juggernog", description: "More Health", position: [18, 1.5, -2], size: [1.2, 3.0, 1.2], extraId: "juggernog" },
      { id: "perk_staminup", type: "perk", cost: 2000, name: "Stamin-Up", description: "Run Fast", position: [-18, 1.5, -12], size: [1.2, 3.0, 1.2], extraId: "stamin_up" },
      { id: "perk_speedcola", type: "perk", cost: 3000, name: "Speed Cola", description: "Fast Reload", position: [-16, 1.5, 20], size: [1.2, 3.0, 1.2], extraId: "speed_cola" },
      { id: "perk_doubletap", type: "perk", cost: 2000, name: "Double Tap", description: "Double Damage", position: [8, 1.5, 12], size: [1.2, 3.0, 1.2], extraId: "double_tap" },
      { id: "inter_power_switch", type: "power", cost: 0, name: "Power", description: "Turn on power", position: [2, 1.8, -20], size: [0.8, 1.2, 0.4] },
      { id: "inter_pack_a_punch", type: "pack_a_punch", cost: 5000, name: "Pack-A-Punch", description: "Upgrade Weapon", position: [0, 1.0, 0], size: [2.5, 2.0, 2.5] }
    ],
    walls: [
      { x: 0, z: -25, width: 50, depth: 2, height: 8, color: "#1c1917" },
      { x: 0, z: 25, width: 50, depth: 2, height: 8, color: "#1c1917" },
      { x: -25, z: 0, width: 2, depth: 50, height: 8, color: "#1c1917" },
      { x: 25, z: 0, width: 2, depth: 50, height: 8, color: "#1c1917" },
      { x: -15, z: 15, width: 10, depth: 10, height: 6, color: "#292524" },
      { x: 18, z: -10, width: 12, depth: 12, height: 6, color: "#451a03" },
      { x: -18, z: -15, width: 8, depth: 15, height: 7, color: "#27272a" },
      { x: 0, z: 16, width: 4, depth: 2, height: 5, color: "#3f3f46" },
    ],
    lavaZones: [
      { x: 0, z: 0, radius: 5.5 },
      { x: -8, z: -8, radius: 2.5 },
      { x: 8, z: 8, radius: 3.0 },
      { x: 15, z: 0, radius: 2.0 },
    ]
  },
  one_window: {
    id: "one_window",
    name: "One Window",
    description: "Compact room with one window. All perks and PaP available.",
    playerStartPos: { x: 0, y: 1.0, z: 6 },
    ambientLight: 0x1a1a22,
    dirLight: 0x111122,
    fogColor: 0x010103,
    floorColor: 0x050508,
    zombieSpawns: [
      { x: 0, z: -12 } // Behind the window
    ],
    interactives: [
      { id: "wallbuy_olympia", type: "wallbuy", cost: 500, name: "Olympia", description: "", position: [-4, 2.0, 8.8], size: [2.0, 0.8, 0.2], extraId: "olympia" },
      { id: "wallbuy_mp5", type: "wallbuy", cost: 1000, name: "MP5", description: "", position: [4, 2.0, 8.8], size: [2.0, 0.8, 0.2], extraId: "mp5" },
      { id: "wallbuy_galil", type: "wallbuy", cost: 1500, name: "Galil", description: "", position: [8.8, 2.0, 0], size: [0.2, 0.8, 2.0], extraId: "galil" },
      { id: "wallbuy_m14", type: "wallbuy", cost: 500, name: "M14", description: "", position: [-8.8, 2.0, 4], size: [0.2, 0.8, 2.0], extraId: "m14" },
      { id: "wallbuy_remington", type: "wallbuy", cost: 1000, name: "Remington 870", description: "", position: [8.8, 2.0, -4], size: [0.2, 0.8, 2.0], extraId: "remington_870" },
      { id: "wallbuy_m16", type: "wallbuy", cost: 1200, name: "M16", description: "", position: [-8.8, 2.0, -4], size: [0.2, 0.8, 2.0], extraId: "m16" },
      
      { id: "perk_juggernog", type: "perk", cost: 2500, name: "Juggernog", description: "More Health", position: [-8, 1.5, -8], size: [1.2, 3.0, 1.2], extraId: "juggernog" },
      { id: "perk_staminup", type: "perk", cost: 2000, name: "Stamin-Up", description: "Run Fast", position: [8, 1.5, -8], size: [1.2, 3.0, 1.2], extraId: "stamin_up" },
      { id: "perk_speedcola", type: "perk", cost: 3000, name: "Speed Cola", description: "Fast Reload", position: [-8, 1.5, 8], size: [1.2, 3.0, 1.2], extraId: "speed_cola" },
      { id: "perk_doubletap", type: "perk", cost: 2000, name: "Double Tap", description: "Double Damage", position: [8, 1.5, 8], size: [1.2, 3.0, 1.2], extraId: "double_tap" },
      
      { id: "inter_power_switch", type: "power", cost: 0, name: "Power", description: "Turn on power", position: [-9.0, 1.8, 0], size: [0.2, 1.2, 0.8] },
      { id: "mystery_box_1", type: "mystery_box", cost: 950, name: "Mystery Box", description: "Rolls a random weapon", position: [-4.0, 0.4, -8.6], size: [2.4, 0.8, 1.0] },
      { id: "inter_pack_a_punch", type: "pack_a_punch", cost: 5000, name: "Pack-A-Punch", description: "Upgrade Weapon", position: [0, 1.0, 4], size: [2.5, 2.0, 2.5] },
      { id: "barrier_window", type: "barrier", cost: 0, name: "Window Barrier", description: "Hold [E] to Repair Barrier (+10 pts per board)", position: [0, 1.0, -9.5], size: [3.0, 2.0, 0.5] }
    ],
    walls: [
      { x: 0, z: 10, width: 20, depth: 2, height: 8, color: "#222222" },  // South wall
      { x: -10, z: 0, width: 2, depth: 20, height: 8, color: "#222222" }, // West wall
      { x: 10, z: 0, width: 2, depth: 20, height: 8, color: "#222222" },  // East wall
      // The "Window" is at z: -9.5, x: 0. We leave a gap in the logic for zombies to come thru or just let them path
      // Actually we'll put a small barrier at the window
      { x: 0, z: -9.5, width: 3, depth: 0.5, height: 1.5, color: "#443322", isWindow: true }, // Wooden planks
      
      // Let's add extra collision walls so north wall isn't completely open
      { x: -5.75, z: -10, width: 8.5, depth: 2, height: 8, color: "#222222" }, // Left of window
      { x: 5.75, z: -10, width: 8.5, depth: 2, height: 8, color: "#222222" }, // Right of window
    ],
    lavaZones: []
  }
};

