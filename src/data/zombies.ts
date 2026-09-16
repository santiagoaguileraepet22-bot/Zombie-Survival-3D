import { ZombieType, ZombieTypeInfo } from '../types';

export const ZOMBIE_TYPES: Record<ZombieType, ZombieTypeInfo> = {
  walker: {
    type: 'walker',
    name: 'Infectado Común',
    badge: 'WALKER',
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    hexColor: 0x3d7443,
    secondaryHex: 0x4a8c51,
    eyeHex: 0xff3300,
    description: 'Zombie estándar balanceado. Amenazante en grupos densos.',
    baseHealth: 100,
    baseSpeed: 3.4,
    damage: 14,
    attackInterval: 1.1,
    scale: 1.0,
    scoreValue: 100,
  },
  runner: {
    type: 'runner',
    name: 'Corredor Rabioso',
    badge: 'RUNNER',
    color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    hexColor: 0x7c8a78,
    secondaryHex: 0x93a38f,
    eyeHex: 0xfacc15,
    description: 'Frenético y súper veloz. Corre a sprint máximo para acorralar al jugador velozmente.',
    baseHealth: 65,
    baseSpeed: 10.4, // Aumentado significativamente para ser una amenaza rápida
    damage: 10,
    attackInterval: 0.65,
    scale: 0.88,
    scoreValue: 150,
  },
  tank: {
    type: 'tank',
    name: 'Bruto Blindado',
    badge: 'TANK',
    color: 'text-red-400 border-red-500/40 bg-red-500/10',
    hexColor: 0x27362c,
    secondaryHex: 0x1f2c23,
    eyeHex: 0xdc2626,
    description: 'Coloso acorazado con blindaje pesado. Absorbe enorme daño y sus golpes son letales.',
    baseHealth: 320,
    baseSpeed: 2.1,
    damage: 32,
    attackInterval: 1.4,
    scale: 1.55,
    scoreValue: 350,
  },
  toxic: {
    type: 'toxic',
    name: 'Mutante Tóxico',
    badge: 'TOXIC',
    color: 'text-lime-400 border-lime-500/40 bg-lime-500/10',
    hexColor: 0x15803d,
    secondaryHex: 0x22c55e,
    eyeHex: 0x84cc16,
    description: 'Escupe y derrama charcos de ácido hirviente en el suelo. Detona en nube letal al morir.',
    baseHealth: 85,
    baseSpeed: 4.1,
    damage: 18,
    attackInterval: 1.0,
    scale: 1.08,
    scoreValue: 200,
  },
  leaper: {
    type: 'leaper',
    name: 'Acechador Saltador',
    badge: 'LEAPER',
    color: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
    hexColor: 0x3b0764,
    secondaryHex: 0x581c87,
    eyeHex: 0xc084fc,
    description: '¡Se lanza por los aires sobre ti! Si te atrapa, deberás superar el minijuego de barra central para zafarte.',
    baseHealth: 95,
    baseSpeed: 5.6,
    damage: 20,
    attackInterval: 1.2,
    scale: 0.96,
    scoreValue: 280,
  },
};

/**
 * Selecciona el tipo de zombie a generar según la oleada actual
 */
export function getSpawnZombieType(currentWave: number): ZombieType {
  const rand = Math.random();

  if (currentWave === 1) {
    // Oleada 1: Caminantes y veloces corredores
    return rand < 0.65 ? 'walker' : 'runner';
  } else if (currentWave === 2) {
    // Oleada 2: Aparecen corredores, tóxicos y saltadores
    if (rand < 0.40) return 'walker';
    if (rand < 0.70) return 'runner';
    if (rand < 0.88) return 'toxic';
    return 'leaper';
  } else if (currentWave === 3) {
    // Oleada 3: Aparece el Bruto Tanque y saltadores agresivos
    if (rand < 0.30) return 'walker';
    if (rand < 0.55) return 'runner';
    if (rand < 0.72) return 'toxic';
    if (rand < 0.88) return 'leaper';
    return 'tank';
  } else {
    // Oleadas 4+: Mezcla táctica intensa con todas las mutaciones
    if (rand < 0.22) return 'walker';
    if (rand < 0.45) return 'runner';
    if (rand < 0.65) return 'leaper';
    if (rand < 0.82) return 'toxic';
    return 'tank';
  }
}
