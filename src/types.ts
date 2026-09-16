export type AppTab = 'game' | 'code' | 'guide';

export type WeaponId = 'pistol' | 'shotgun' | 'rifle' | 'rocket' | 'sniper' | 'plasma' | 'minigun';

export type ZombieType = 'walker' | 'runner' | 'tank' | 'toxic' | 'leaper';

export interface ZombieTypeInfo {
  type: ZombieType;
  name: string;
  badge: string;
  color: string;
  hexColor: number;
  secondaryHex: number;
  eyeHex: number;
  description: string;
  baseHealth: number;
  baseSpeed: number;
  damage: number;
  attackInterval: number;
  scale: number;
  scoreValue: number;
}

export interface WeaponData {
  id: WeaponId;
  name: string;
  category: string;
  damage: number;
  fireRate: number; // segundos entre disparos
  bulletSpeed: number;
  pellets: number; // para escopeta
  spread: number;
  color: string;
  modelColor: number;
  description: string;
  keyNum: string;
  ammoCap: string;
  splashRadius?: number;
}

export interface GameStats {
  kills: number;
  wave: number;
  health: number;
  maxHealth: number;
  ammo: number;
  maxAmmo: number;
  isGameOver: boolean;
  score: number;
  currentWeapon: WeaponId;
}

export interface ControlSettings {
  mouseSensitivity: number;
  soundEnabled: boolean;
  cameraDistance: 'close' | 'normal' | 'far';
  difficulty: 'normal' | 'hard' | 'nightmare';
}
