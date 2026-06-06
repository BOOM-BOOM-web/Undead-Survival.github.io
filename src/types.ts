export type FireMode = "semi" | "auto";

export interface WeaponConfig {
  id: string;
  name: string;
  damage: number;
  headshotMultiplier: number;
  maxReserve: number;
  currentReserve: number;
  maxMag: number;
  currentMag: number;
  fireRate: number; // millisecond delay between shots
  reloadTime: number; // seconds
  cost: number;
  description: string;
  isPackAPunched: boolean;
  recoil: number;
  spread: number;
  color: string;
  fireMode: FireMode;
  adsZoom: number; // FOV multiplier e.g. 0.75
  ammoTypeName: string;
}

export type PerkType = "juggernog" | "speed_cola" | "double_tap" | "stamin_up";

export interface Perk {
  id: PerkType;
  name: string;
  description: string;
  cost: number;
  color: string; // Tailwind color e.g., "bg-red-600"
  textColor: string;
  lightColor: number; // hex color for 3D glow
}

export type InteractiveType = "door" | "wallbuy" | "perk" | "power" | "pack_a_punch" | "barrier" | "mystery_box";

export interface InteractiveObject {
  id: string;
  type: InteractiveType;
  cost: number;
  name: string;
  description: string;
  position: [number, number, number]; // [x, y, z]
  size: [number, number, number]; // [width, height, depth]
  extraId?: string; // weaponId for wallbuys, perkId for perks
  isPurchased?: boolean;
}

export interface Zombie {
  id: string;
  x: number;
  z: number;
  y: number;
  rotation: number;
  speed: number;
  maxHealth: number;
  health: number;
  state: "spawning" | "chasing" | "attacking" | "staggered" | "dead";
  movementType?: "slow" | "normal" | "fast" | "crawler"; // Added movementType
  attackCooldown: number; // ms countdown
  staggerDuration: number; // ms countdown
  lastAttackTime: number;
  meshIndex: number;
  isSpecial: boolean; // e.g. runner/dog
  damageValue: number;
}

export interface BulletTrace {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  duration: number; // ms remaining
  isPackAPunched: boolean;
}

export interface HitMarker {
  id: string;
  time: number;
  isHeadshot: boolean;
  isKill: boolean;
}

export type PowerUpType = "max_ammo" | "insta_kill" | "double_points" | "nuke";

export interface PowerUpDrop {
  id: string;
  type: PowerUpType;
  position: [number, number, number];
  rotY: number;
  duration: number; // ms remaining
}

export interface PlayerStats {
  points: number;
  health: number;
  maxHealth: number;
  round: number;
  kills: number;
  headshots: number;
  perks: PerkType[];
  weapons: WeaponConfig[];
  currentWeaponIndex: number;
  isPowerOn: boolean;
  isDead: boolean;
  isADS: boolean;
}
