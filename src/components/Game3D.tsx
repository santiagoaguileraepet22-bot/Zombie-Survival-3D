import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { soundManager } from '../utils/sound';
import { Crosshair, RotateCcw, Volume2, VolumeX, ShieldAlert, Award, Compass, Eye, Zap, Target, Skull, AlertTriangle, BookOpen, X, Flame } from 'lucide-react';
import { WeaponId, ZombieType } from '../types';
import { WEAPONS } from '../data/weapons';
import { ZOMBIE_TYPES, getSpawnZombieType } from '../data/zombies';
import { WeaponSelector } from './WeaponSelector';

interface Game3DProps {
  onUpdateStats?: (stats: { kills: number; wave: number; health: number }) => void;
}

export const Game3D: React.FC<Game3DProps> = ({ onUpdateStats }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Estados del juego
  const [health, setHealth] = useState(100);
  const [kills, setKills] = useState(0);
  const [wave, setWave] = useState(1);
  const [currentWeaponId, setCurrentWeaponId] = useState<WeaponId>('pistol');
  const [isGameOver, setIsGameOver] = useState(false);
  const [waveNotification, setWaveNotification] = useState<string | null>("¡OLEADA 1 COMIENZA!");
  const [weaponNotification, setWeaponNotification] = useState<string | null>(null);
  const [enemyAlert, setEnemyAlert] = useState<{ name: string; badge: string; color: string } | null>(null);
  const [showBestiary, setShowBestiary] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [cameraMode, setCameraMode] = useState<'normal' | 'close' | 'far'>('normal');
  const [takingDamage, setTakingDamage] = useState(false);
  const [isAimLockActive, setIsAimLockActive] = useState(false);
  const [lockedTarget, setLockedTarget] = useState<{
    dist: number;
    hp: number;
    type: ZombieType;
    name: string;
    badge: string;
    color: string;
  } | null>(null);

  // Estado del minijuego QTE cuando el Acechador (Leaper) embiste al jugador
  const [qteData, setQteData] = useState<{
    active: boolean;
    barPos: number; // 0 a 100
    targetMin: number; // 38%
    targetMax: number; // 62%
  } | null>(null);

  // Estado de contacto con charco de ácido tóxico
  const [inAcid, setInAcid] = useState(false);

  // Refs mutables para el loop de animación
  const stateRef = useRef({
    health: 100,
    kills: 0,
    wave: 1,
    isGameOver: false,
    cameraYaw: 0,
    cameraPitch: 0.25,
    cameraDistance: 7.5,
    cameraHeight: 2.8,
    keys: {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false,
      space: false,
      mouse0: false,
      mouse2: false,
    },
    aimLockToggle: false,
    isAimLockActive: false,
    toggleAimLock: () => {},
    attemptQteEscape: () => {},
    lastShotTime: 0,
    fireRate: 0.22,
    currentWeaponId: 'pistol' as WeaponId,
    soundEnabled: true,
    changeWeapon: (_id: WeaponId) => {},
  });

  stateRef.current.soundEnabled = soundEnabled;

  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (cameraMode === 'close') {
      stateRef.current.cameraDistance = 4.5;
      stateRef.current.cameraHeight = 2.0;
    } else if (cameraMode === 'far') {
      stateRef.current.cameraDistance = 11.0;
      stateRef.current.cameraHeight = 4.2;
    } else {
      stateRef.current.cameraDistance = 7.5;
      stateRef.current.cameraHeight = 2.8;
    }
  }, [cameraMode]);

  // Ciclo principal de Three.js
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Escena, Cámara y Renderizador
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10151a);
    scene.fog = new THREE.FogExp2(0x10151a, 0.018);

    const camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Iluminación ambiental y direccional
    const ambientLight = new THREE.AmbientLight(0x455565, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 2.2);
    dirLight.position.set(30, 45, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 120;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    scene.add(dirLight);

    // Luz secundaria azulada fría para atmósfera
    const rimLight = new THREE.DirectionalLight(0x306090, 0.8);
    rimLight.position.set(-30, 20, -30);
    scene.add(rimLight);

    // 3. Suelo con cuadrícula estilizada
    const groundGeo = new THREE.PlaneGeometry(160, 160, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1f2824,
      roughness: 0.85,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Cuadrícula visual
    const grid = new THREE.GridHelper(160, 80, 0x3d5c48, 0x223528);
    grid.position.y = 0.01;
    scene.add(grid);

    // Obstáculos / Cajas de cobertura
    const crateGeo = new THREE.BoxGeometry(1, 1, 1);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x6e5239, roughness: 0.7 });
    const obstacles: THREE.Mesh[] = [];

    for (let i = 0; i < 28; i++) {
      const scaleX = 1.6 + Math.random() * 2.2;
      const scaleY = 1.4 + Math.random() * 2.5;
      const scaleZ = 1.6 + Math.random() * 2.2;

      const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 10 + Math.random() * 45;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      const crate = new THREE.Mesh(crateGeo, crateMat);
      crate.scale.set(scaleX, scaleY, scaleZ);
      crate.position.set(x, scaleY / 2, z);
      crate.rotation.y = Math.random() * Math.PI;
      crate.castShadow = true;
      crate.receiveShadow = true;
      scene.add(crate);
      obstacles.push(crate);
    }

    // 4. Creación del Jugador (Personaje 3D estilizado)
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 0, 0);
    scene.add(playerGroup);

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.0, 0.5);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x1e56a0, roughness: 0.5 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.3;
    torso.castShadow = true;
    playerGroup.add(torso);

    // Cabeza
    const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf5c6aa, roughness: 0.6 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.05;
    head.castShadow = true;
    playerGroup.add(head);

    // Visor/Gafas tácticas
    const visorGeo = new THREE.BoxGeometry(0.42, 0.12, 0.2);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, roughness: 0.2, metalness: 0.8 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.08, 0.24);
    playerGroup.add(visor);

    // Piernas
    const legGeo = new THREE.BoxGeometry(0.3, 0.8, 0.35);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x222a35, roughness: 0.8 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.24, 0.4, 0);
    leftLeg.castShadow = true;
    playerGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.24, 0.4, 0);
    rightLeg.castShadow = true;
    playerGroup.add(rightLeg);

    // Brazos y Rifle táctico
    const armGeo = new THREE.BoxGeometry(0.22, 0.75, 0.25);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x1e56a0, roughness: 0.6 });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.55, 1.25, 0.15);
    leftArm.rotation.x = 0.4;
    leftArm.castShadow = true;
    playerGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.55, 1.25, 0.2);
    rightArm.rotation.x = -0.5;
    rightArm.castShadow = true;
    playerGroup.add(rightArm);

    // Arma base y Modelos de las 7 Armas
    const gunGroup = new THREE.Group();
    const gunModels: Record<WeaponId, THREE.Group> = {
      pistol: new THREE.Group(),
      shotgun: new THREE.Group(),
      rifle: new THREE.Group(),
      rocket: new THREE.Group(),
      sniper: new THREE.Group(),
      plasma: new THREE.Group(),
      minigun: new THREE.Group(),
    };

    // 1. Modelo Pistola (9mm compacta)
    const pistolBodyMat = new THREE.MeshStandardMaterial({ color: 0x242424, metalness: 0.8, roughness: 0.3 });
    const pistolBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.45), pistolBodyMat);
    const pistolSlide = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.48), new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.9, roughness: 0.2 }));
    pistolSlide.position.set(0, 0.08, 0.02);
    const pistolBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), pistolBodyMat);
    pistolBarrel.rotation.x = Math.PI / 2;
    pistolBarrel.position.set(0, 0.07, 0.32);
    gunModels.pistol.add(pistolBody, pistolSlide, pistolBarrel);

    // 2. Modelo Escopeta (Doble cañón robusta con culata de madera)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x603813, roughness: 0.7 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.85, roughness: 0.35 });
    const shotgunStock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.45), woodMat);
    shotgunStock.position.set(0, -0.05, -0.22);
    const shotgunReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.35), steelMat);
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), steelMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.04, 0.04, 0.45);
    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), steelMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.04, 0.04, 0.45);
    const pumpHandle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.22), woodMat);
    pumpHandle.position.set(0, -0.04, 0.35);
    gunModels.shotgun.add(shotgunStock, shotgunReceiver, barrelL, barrelR, pumpHandle);

    // 3. Modelo Fusil de Asalto M4 (Táctico con cargador curvo y mira)
    const rifleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.4 });
    const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.17, 0.75), rifleMat);
    const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), rifleMat);
    rifleBarrel.rotation.x = Math.PI / 2;
    rifleBarrel.position.set(0, 0.04, 0.58);
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.15), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    magazine.position.set(0, -0.16, 0.1);
    magazine.rotation.x = -0.3;
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.14, -0.05);
    gunModels.rifle.add(rifleBody, rifleBarrel, magazine, scope);

    // 4. Modelo Lanza-Cohetes RPG-7 (Tubo verde militar con ojiva frontal)
    const rpgTubeMat = new THREE.MeshStandardMaterial({ color: 0x223528, roughness: 0.6 });
    const rpgWarheadMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4, roughness: 0.4 });
    const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.15, 12), rpgTubeMat);
    rpgTube.rotation.x = Math.PI / 2;
    const warheadCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 12), rpgWarheadMat);
    warheadCone.rotation.x = Math.PI / 2;
    warheadCone.position.set(0, 0, 0.72);
    const warheadBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    warheadBase.rotation.x = Math.PI / 2;
    warheadBase.position.set(0, 0, 0.5);
    gunModels.rocket.add(rpgTube, warheadCone, warheadBase);

    // 5. Modelo Rifle Francotirador .50 BMG (Largo cañón, mira telescópica masiva y chasis morado)
    const sniperBodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.25 });
    const sniperAccentMat = new THREE.MeshStandardMaterial({ color: 0x581c87, metalness: 0.6, roughness: 0.4 });
    const sniperBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.95), sniperBodyMat);
    const sniperStock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.4), sniperAccentMat);
    sniperStock.position.set(0, -0.04, -0.45);
    const sniperBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8), sniperBodyMat);
    sniperBarrel.rotation.x = Math.PI / 2;
    sniperBarrel.position.set(0, 0.05, 0.95);
    const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.16), sniperAccentMat);
    muzzleBrake.position.set(0, 0.05, 1.55);
    const sniperScope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.45, 12), sniperAccentMat);
    sniperScope.rotation.x = Math.PI / 2;
    sniperScope.position.set(0, 0.18, 0.05);
    gunModels.sniper.add(sniperBody, sniperStock, sniperBarrel, muzzleBrake, sniperScope);

    // 6. Modelo Lanzallamas de Plasma Incandescente (Doble bobina energética verde y depósito)
    const plasmaBodyMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.5 });
    const plasmaGlowMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const plasmaBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.7), plasmaBodyMat);
    const plasmaCanister = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x047857 }));
    plasmaCanister.position.set(0, -0.22, 0.05);
    const plasmaNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.35, 10), plasmaBodyMat);
    plasmaNozzle.rotation.x = Math.PI / 2;
    plasmaNozzle.position.set(0, 0.02, 0.5);
    const coil1 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16), plasmaGlowMat);
    coil1.position.set(0, 0.02, 0.25);
    const coil2 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16), plasmaGlowMat);
    coil2.position.set(0, 0.02, 0.4);
    gunModels.plasma.add(plasmaBody, plasmaCanister, plasmaNozzle, coil1, coil2);

    // 7. Modelo Ametralladora Rotativa Vulcan (6 cañones giratorios y caja de munición)
    const minigunBodyMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.8, roughness: 0.3 });
    const minigunBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.6), minigunBodyMat);
    const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.25), new THREE.MeshStandardMaterial({ color: 0x713f12 }));
    ammoBox.position.set(-0.16, -0.15, -0.05);
    const minigunRotor = new THREE.Group();
    for (let b = 0; b < 6; b++) {
      const bAngle = (b * Math.PI * 2) / 6;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 8), new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9 }));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(Math.cos(bAngle) * 0.075, Math.sin(bAngle) * 0.075, 0.55);
      minigunRotor.add(barrel);
    }
    gunModels.minigun.add(minigunBody, ammoBox, minigunRotor);

    // Añadir todos los modelos a gunGroup y ocultar los no seleccionados
    (Object.keys(gunModels) as WeaponId[]).forEach((wId) => {
      gunModels[wId].visible = (wId === 'pistol');
      gunGroup.add(gunModels[wId]);
    });

    gunGroup.position.set(0.48, 1.15, 0.5);
    playerGroup.add(gunGroup);

    // Muzzle Flash
    const muzzleFlashGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 });
    const muzzleFlash = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
    muzzleFlash.position.set(0, 0.04, 0.85);
    gunGroup.add(muzzleFlash);

    // Función para cambiar de arma activa
    function switchWeapon(id: WeaponId) {
      if (!WEAPONS[id]) return;
      stateRef.current.currentWeaponId = id;
      stateRef.current.fireRate = WEAPONS[id].fireRate;
      setCurrentWeaponId(id);

      // Cambiar visibilidad de modelos 3D
      (Object.keys(gunModels) as WeaponId[]).forEach((wId) => {
        gunModels[wId].visible = (wId === id);
      });

      // Efecto sonoro de cambio de arma y animación ligera
      soundManager.playWeaponSwitch();
      gunGroup.rotation.x = 0.3;
      setTimeout(() => {
        gunGroup.rotation.x = 0;
      }, 90);

      setWeaponNotification(`Equipado: ${WEAPONS[id].name}`);
      setTimeout(() => setWeaponNotification(null), 1800);
    }

    stateRef.current.changeWeapon = switchWeapon;

    // 4.5. Retícula Holográfica de Fijación de Objetivo 3D (Aimlock Reticle)
    const lockReticleGroup = new THREE.Group();
    lockReticleGroup.visible = false;
    scene.add(lockReticleGroup);

    // Rombo exterior rotatorio
    const lockDiamondGeo = new THREE.RingGeometry(0.55, 0.62, 4);
    const lockDiamondMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const lockDiamond = new THREE.Mesh(lockDiamondGeo, lockDiamondMat);
    lockReticleGroup.add(lockDiamond);

    // Anillo interior pulsante
    const lockInnerGeo = new THREE.RingGeometry(0.2, 0.25, 16);
    const lockInnerMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const lockInner = new THREE.Mesh(lockInnerGeo, lockInnerMat);
    lockReticleGroup.add(lockInner);

    // 4 Marcadores de soporte en cruz
    const bracketMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.01), bracketMat);
      bracket.position.set(Math.cos(angle) * 0.72, Math.sin(angle) * 0.72, 0);
      bracket.rotation.z = angle;
      lockReticleGroup.add(bracket);
    }

    let currentLockedZombie: ZombieData | null = null;

    // 5. Estado dinámico de entidades
    interface BulletData {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      lifetime: number;
      damage: number;
      isRocket?: boolean;
      splashRadius?: number;
      isSniper?: boolean;
      piercedZombies?: ZombieData[];
    }
    const bullets: BulletData[] = [];

    interface ZombieData {
      group: THREE.Group;
      type: ZombieType;
      torso: THREE.Mesh;
      head: THREE.Mesh;
      leftArm: THREE.Mesh;
      rightArm: THREE.Mesh;
      leftLeg: THREE.Mesh;
      rightLeg: THREE.Mesh;
      speed: number;
      health: number;
      maxHealth: number;
      damage: number;
      attackInterval: number;
      lastAttackTime: number;
      hurtTimer: number;
      originalTorsoColor: number;
      originalHeadColor: number;
      // Para Saltador (Leaper):
      leapCooldown?: number;
      isLeaping?: boolean;
      leapProgress?: number;
      leapStartPos?: THREE.Vector3;
      leapTargetPos?: THREE.Vector3;
      // Para Tóxico (Acid spit):
      toxicSpitCooldown?: number;
    }
    const zombies: ZombieData[] = [];

    // Sistema de Manchas y Proyectiles de Ácido Tóxico
    interface AcidSpitProjectile {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      targetPos: THREE.Vector3;
      lifetime: number;
    }
    const acidSpits: AcidSpitProjectile[] = [];

    interface AcidPuddle {
      mesh: THREE.Mesh;
      bubbles: THREE.Mesh[];
      position: THREE.Vector3;
      radius: number;
      lifetime: number;
      maxLifetime: number;
    }
    const acidPuddles: AcidPuddle[] = [];

    function createAcidPuddle(pos: THREE.Vector3, radius: number = 3.8, duration: number = 10) {
      const pGeo = new THREE.CircleGeometry(radius, 24);
      const pMat = new THREE.MeshStandardMaterial({
        color: 0x84cc16,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.rotation.x = -Math.PI / 2;
      pMesh.position.set(pos.x, 0.025, pos.z);
      scene.add(pMesh);

      // Burbujas ácidas bioluminiscentes flotantes
      const bubbles: THREE.Mesh[] = [];
      const bMat = new THREE.MeshBasicMaterial({ color: 0xa3e635 });
      for (let i = 0; i < 6; i++) {
        const bGeo = new THREE.SphereGeometry(0.12 + Math.random() * 0.12, 8, 8);
        const b = new THREE.Mesh(bGeo, bMat);
        const bAngle = Math.random() * Math.PI * 2;
        const bDist = Math.random() * (radius * 0.7);
        b.position.set(pos.x + Math.cos(bAngle) * bDist, 0.08 + Math.random() * 0.15, pos.z + Math.sin(bAngle) * bDist);
        scene.add(b);
        bubbles.push(b);
      }

      acidPuddles.push({
        mesh: pMesh,
        bubbles,
        position: pos.clone(),
        radius,
        lifetime: duration,
        maxLifetime: duration,
      });
    }

    // Ref del Minijuego QTE de escape de Acechador
    const qteRef = {
      active: false,
      barPos: 50,
      direction: 1,
      speed: 130, // velocidad de la barra oscilante
      targetMin: 38,
      targetMax: 62,
      pinnedZombie: null as ZombieData | null,
      lastBiteTime: 0,
    };

    // Función para intentar liberarse en el minijuego de barra
    function attemptQteEscape() {
      if (!qteRef.active) return;
      const pos = qteRef.barPos;
      const isSuccess = pos >= qteRef.targetMin && pos <= qteRef.targetMax;

      if (isSuccess) {
        // Éxito: Patada de combate que repele al Acechador y lo hiere gravemente
        soundManager.playQteSuccess();
        const pZ = qteRef.pinnedZombie;
        if (pZ) {
          const kickDir = pZ.group.position.clone().sub(playerGroup.position).normalize();
          kickDir.y = 0.35;
          pZ.group.position.addScaledVector(kickDir, 8.5);
          pZ.health -= 65;
          pZ.hurtTimer = 0.5;
          pZ.lastAttackTime = (performance.now() / 1000) + 2.5;
          createParticleSparks(pZ.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xc084fc, 24);
          (pZ.torso.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
          (pZ.head.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
          if (pZ.health <= 0) {
            killZombie(zombies.indexOf(pZ), pZ);
          }
        }
        qteRef.active = false;
        qteRef.pinnedZombie = null;
        setQteData(null);
        setWeaponNotification('¡LIBERADO! Brutal patada de combate (+150 PTS)');
        setKills((k) => k + 1);
      } else {
        // Fallo: Mordisco letal con penalización de salud
        soundManager.playQteFail();
        soundManager.playPlayerHurt();
        stateRef.current.health = Math.max(0, stateRef.current.health - 12);
        setHealth(stateRef.current.health);
        setTakingDamage(true);
        setTimeout(() => setTakingDamage(false), 220);
        if (stateRef.current.health <= 0) {
          stateRef.current.isGameOver = true;
          setIsGameOver(true);
          soundManager.playGameOver();
          document.exitPointerLock?.();
          qteRef.active = false;
          setQteData(null);
        }
      }
    }
    stateRef.current.attemptQteEscape = attemptQteEscape;

    // Sistema de Suministros y Armas en el Mapa (Pedestales 3D con armas holográficas)
    interface WeaponPickup {
      group: THREE.Group;
      modelGroup: THREE.Group;
      light: THREE.PointLight;
      weaponId: WeaponId;
      position: THREE.Vector3;
      respawnTimer: number;
      active: boolean;
    }
    const weaponPickups: WeaponPickup[] = [];
    const pickupDefs: Array<{ pos: [number, number, number]; initialWeapon: WeaponId }> = [
      { pos: [18, 0, 18], initialWeapon: 'shotgun' },
      { pos: [-18, 0, 16], initialWeapon: 'rifle' },
      { pos: [20, 0, -20], initialWeapon: 'sniper' },
      { pos: [-17, 0, -18], initialWeapon: 'plasma' },
      { pos: [0, 0, 24], initialWeapon: 'minigun' },
    ];

    pickupDefs.forEach((def, pIdx) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(def.pos[0], 0, def.pos[2]);

      // Base cilíndrica metálica en el suelo con aro de luz
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.6, metalness: 0.8 });
      const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.22, 16), baseMat);
      baseMesh.position.y = 0.11;
      pGroup.add(baseMesh);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.04, 8, 24), ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.23;
      pGroup.add(ringMesh);

      // Modelo flotante rotatorio del arma
      const modelGroup = new THREE.Group();
      modelGroup.position.set(0, 1.15, 0);

      // Representación visual en cápsula holográfica con arma
      const holoCrate = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.35, 0.35),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 })
      );
      modelGroup.add(holoCrate);

      // Rombo superior flotante
      const diamondMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true })
      );
      diamondMesh.position.y = 0.55;
      modelGroup.add(diamondMesh);

      pGroup.add(modelGroup);

      // Luz puntual ambiental sobre el pedestal
      const pLight = new THREE.PointLight(0x38bdf8, 2.2, 8);
      pLight.position.set(0, 1.4, 0);
      pGroup.add(pLight);

      scene.add(pGroup);

      weaponPickups.push({
        group: pGroup,
        modelGroup,
        light: pLight,
        weaponId: def.initialWeapon,
        position: new THREE.Vector3(def.pos[0], 0, def.pos[2]),
        respawnTimer: 0,
        active: true,
      });
    });

    interface ParticleData {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      lifetime: number;
    }
    const particles: ParticleData[] = [];

    // Físicas del jugador
    const playerPhysics = {
      velocity: new THREE.Vector3(0, 0, 0),
      velocityY: 0,
      gravity: -22,
      jumpForce: 8.5,
      isGrounded: true,
      walkSpeed: 7.5,
      runSpeed: 12.0,
      targetRotationY: 0,
    };

    // Administrador de Oleadas
    let waveTotalZombies = 5;
    let waveSpawnedCount = 0;
    let waveSpawnTimer = 0;
    const waveSpawnInterval = 1.3;
    let lastAlertedType: ZombieType | null = null;

    function spawnZombie() {
      if (stateRef.current.isGameOver) return;

      const zType = getSpawnZombieType(stateRef.current.wave);
      const info = ZOMBIE_TYPES[zType];

      const angle = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 18;
      const spawnX = playerGroup.position.x + Math.cos(angle) * dist;
      const spawnZ = playerGroup.position.z + Math.sin(angle) * dist;

      const zGroup = new THREE.Group();
      zGroup.position.set(spawnX, 0, spawnZ);

      // Escalar según el arquetipo del zombie (Tank = 1.55x, Runner = 0.88x, etc.)
      const s = info.scale;
      zGroup.scale.set(s, s, s);

      // Torso
      const torsoWidth = zType === 'runner' ? 0.65 : zType === 'tank' ? 0.88 : 0.75;
      const torsoHeight = zType === 'runner' ? 0.85 : zType === 'tank' ? 1.05 : 0.95;
      const zTorsoGeo = new THREE.BoxGeometry(torsoWidth, torsoHeight, 0.45);
      const zTorsoMat = new THREE.MeshStandardMaterial({
        color: info.hexColor,
        roughness: zType === 'tank' ? 0.5 : 0.7,
        metalness: zType === 'tank' ? 0.3 : 0.05,
      });
      const zTorso = new THREE.Mesh(zTorsoGeo, zTorsoMat);
      zTorso.position.y = 1.25;
      if (zType === 'runner') {
        zTorso.rotation.x = 0.22; // Postura inclinada de velocidad
      }
      zTorso.castShadow = true;
      zGroup.add(zTorso);

      // Cabeza
      const headRadius = zType === 'runner' ? 0.25 : zType === 'tank' ? 0.34 : 0.28;
      const zHeadGeo = new THREE.SphereGeometry(headRadius, 12, 12);
      const zHeadMat = new THREE.MeshStandardMaterial({
        color: info.secondaryHex,
        roughness: 0.7,
      });
      const zHead = new THREE.Mesh(zHeadGeo, zHeadMat);
      zHead.position.y = 1.95;
      zHead.castShadow = true;
      zGroup.add(zHead);

      // Ojos con color temático según mutación
      const eyeSize = zType === 'runner' ? 0.075 : zType === 'tank' ? 0.07 : 0.06;
      const eyeGeo = new THREE.SphereGeometry(eyeSize, 8, 8);
      const eyeMat = new THREE.MeshBasicMaterial({ color: info.eyeHex });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.1, 1.98, 0.24);
      zGroup.add(leftEye);

      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.1, 1.98, 0.24);
      zGroup.add(rightEye);

      // Brazos estirados al frente
      const armLength = zType === 'tank' ? 0.85 : 0.7;
      const armThickness = zType === 'tank' ? 0.26 : 0.18;
      const zArmGeo = new THREE.BoxGeometry(armThickness, armLength, 0.2);
      const zArmMat = new THREE.MeshStandardMaterial({ color: info.hexColor, roughness: 0.7 });
      const zLeftArm = new THREE.Mesh(zArmGeo, zArmMat);
      zLeftArm.position.set(-(torsoWidth / 2 + 0.12), 1.35, 0.35);
      zLeftArm.rotation.x = -Math.PI / 2.2;
      zLeftArm.castShadow = true;
      zGroup.add(zLeftArm);

      const zRightArm = new THREE.Mesh(zArmGeo, zArmMat);
      zRightArm.position.set((torsoWidth / 2 + 0.12), 1.35, 0.35);
      zRightArm.rotation.x = -Math.PI / 2.2;
      zRightArm.castShadow = true;
      zGroup.add(zRightArm);

      // Piernas
      const legGeo = new THREE.BoxGeometry(0.26, 0.75, 0.3);
      const legMat = new THREE.MeshStandardMaterial({
        color: zType === 'tank' ? 0x1e293b : 0x223525,
        roughness: 0.9,
      });
      const zLeftLeg = new THREE.Mesh(legGeo, legMat);
      zLeftLeg.position.set(-0.2, 0.38, 0);
      zLeftLeg.castShadow = true;
      zGroup.add(zLeftLeg);

      const zRightLeg = new THREE.Mesh(legGeo, legMat);
      zRightLeg.position.set(0.2, 0.38, 0);
      zRightLeg.castShadow = true;
      zGroup.add(zRightLeg);

      // Accesorios visuales únicos por tipo
      if (zType === 'tank') {
        // Blindaje de hombreras de acero pesado
        const shoulderGeo = new THREE.BoxGeometry(0.38, 0.26, 0.38);
        const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
        const leftPlate = new THREE.Mesh(shoulderGeo, shoulderMat);
        leftPlate.position.set(-(torsoWidth / 2 + 0.14), 1.62, 0);
        zGroup.add(leftPlate);

        const rightPlate = new THREE.Mesh(shoulderGeo, shoulderMat);
        rightPlate.position.set((torsoWidth / 2 + 0.14), 1.62, 0);
        zGroup.add(rightPlate);

        // Placa reforzada en la cabeza
        const browGeo = new THREE.BoxGeometry(0.55, 0.16, 0.4);
        const browMesh = new THREE.Mesh(browGeo, shoulderMat);
        browMesh.position.set(0, 2.12, 0.08);
        zGroup.add(browMesh);
      } else if (zType === 'toxic') {
        // Pústulas fluorescentes bioluminiscentes en espalda y hombros
        const pustuleGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const pustuleMat = new THREE.MeshBasicMaterial({ color: 0x84cc16 });
        const p1 = new THREE.Mesh(pustuleGeo, pustuleMat);
        p1.position.set(-0.22, 1.55, -0.22);
        zGroup.add(p1);

        const p2 = new THREE.Mesh(pustuleGeo, pustuleMat);
        p2.position.set(0.2, 1.45, -0.2);
        zGroup.add(p2);

        const p3 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), pustuleMat);
        p3.position.set(0.34, 1.65, 0.05);
        zGroup.add(p3);
      } else if (zType === 'leaper') {
        // Acechador Saltador: Cresta espinosa en la espalda y garras afiladas
        const spineGeo = new THREE.ConeGeometry(0.06, 0.28, 4);
        const spineMat = new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.3 });
        for (let s = 0; s < 4; s++) {
          const spine = new THREE.Mesh(spineGeo, spineMat);
          spine.position.set(0, 1.1 + s * 0.18, -0.22);
          spine.rotation.x = -Math.PI / 2.5;
          zGroup.add(spine);
        }
        // Garras afiladas en los brazos
        const clawGeo = new THREE.ConeGeometry(0.035, 0.22, 4);
        const clawL = new THREE.Mesh(clawGeo, spineMat);
        clawL.position.set(0, -0.4, 0.1);
        clawL.rotation.x = Math.PI / 2;
        zLeftArm.add(clawL);

        const clawR = new THREE.Mesh(clawGeo, spineMat);
        clawR.position.set(0, -0.4, 0.1);
        clawR.rotation.x = Math.PI / 2;
        zRightArm.add(clawR);
      }

      scene.add(zGroup);

      // Alertas de mutación en combate
      if ((zType === 'tank' || zType === 'toxic' || zType === 'leaper') && lastAlertedType !== zType) {
        lastAlertedType = zType;
        setEnemyAlert({
          name: info.name,
          badge: info.badge,
          color: info.color,
        });
        if (zType === 'tank') {
          soundManager.playTankRoar();
        } else if (zType === 'leaper') {
          soundManager.playLeaperPounce();
        } else {
          soundManager.playRunnerScreech();
        }
        setTimeout(() => setEnemyAlert(null), 3200);
      }

      // Variabilidad individual de velocidad
      const calculatedSpeed = info.baseSpeed + (Math.random() * 0.4 - 0.2) + (stateRef.current.wave - 1) * 0.1;
      const calculatedHealth = info.baseHealth + (stateRef.current.wave - 1) * 12;

      zombies.push({
        group: zGroup,
        type: zType,
        torso: zTorso,
        head: zHead,
        leftArm: zLeftArm,
        rightArm: zRightArm,
        leftLeg: zLeftLeg,
        rightLeg: zRightLeg,
        speed: calculatedSpeed,
        health: calculatedHealth,
        maxHealth: calculatedHealth,
        damage: info.damage,
        attackInterval: info.attackInterval,
        lastAttackTime: 0,
        hurtTimer: 0,
        originalTorsoColor: info.hexColor,
        originalHeadColor: info.secondaryHex,
        leapCooldown: 0,
        isLeaping: false,
        leapProgress: 0,
        toxicSpitCooldown: 0,
      });

      waveSpawnedCount++;
    }

    function killZombie(zIdx: number, z: ZombieData) {
      const zPos = z.group.position.clone().add(new THREE.Vector3(0, 1.2 * (z.group.scale.y || 1), 0));

      // Si el zombie eliminado era quien tenía atrapado al jugador en el QTE, liberarlo
      if (qteRef.pinnedZombie === z) {
        qteRef.active = false;
        qteRef.pinnedZombie = null;
        setQteData(null);
      }

      if (z.type === 'toxic') {
        // DETONACIÓN TÓXICA EN ÁREA Y CHARCO DE ÁCIDO CORROSIVO
        soundManager.playToxicExplosion();
        createParticleSparks(zPos, 0x84cc16, 26);
        createParticleSparks(zPos, 0x22c55e, 18);
        createParticleSparks(zPos, 0xa3e635, 12);

        // Dejar charco corrosivo permanente en el suelo
        createAcidPuddle(z.group.position.clone(), 4.8, 12.0);

        // Daño de veneno radial al jugador si está cerca
        const toxicRadius = 5.2;
        const distToPlayer = playerGroup.position.distanceTo(z.group.position);
        if (distToPlayer <= toxicRadius && !stateRef.current.isGameOver) {
          const toxicDmg = Math.floor(20 * (1 - distToPlayer / toxicRadius));
          if (toxicDmg > 0) {
            stateRef.current.health = Math.max(0, stateRef.current.health - toxicDmg);
            setHealth(stateRef.current.health);
            setTakingDamage(true);
            soundManager.playPlayerHurt();
            setTimeout(() => setTakingDamage(false), 240);

            if (stateRef.current.health <= 0) {
              stateRef.current.isGameOver = true;
              setIsGameOver(true);
              soundManager.playGameOver();
              document.exitPointerLock?.();
            }
          }
        }

        // Reacción en cadena a otros zombies en el radio
        for (const otherZ of zombies) {
          if (otherZ !== z && otherZ.health > 0) {
            const d = z.group.position.distanceTo(otherZ.group.position);
            if (d <= toxicRadius) {
              const chainDmg = Math.floor(50 * (1 - d / toxicRadius));
              otherZ.health -= chainDmg;
              otherZ.hurtTimer = 0.22;
              (otherZ.torso.material as THREE.MeshStandardMaterial).color.setHex(0x84cc16);
              (otherZ.head.material as THREE.MeshStandardMaterial).color.setHex(0x84cc16);
            }
          }
        }
      } else if (z.type === 'leaper') {
        createParticleSparks(zPos, 0xc084fc, 24);
        createParticleSparks(zPos, 0x581c87, 16);
      } else if (z.type === 'tank') {
        createParticleSparks(zPos, 0x7f1d1d, 26);
        createParticleSparks(zPos, 0x475569, 16);
        soundManager.playTankRoar();
      } else if (z.type === 'runner') {
        createParticleSparks(zPos, 0xd97706, 18);
        createParticleSparks(zPos, 0x991111, 14);
      } else {
        createParticleSparks(zPos, 0x991111, 16);
      }

      if (currentLockedZombie === z) {
        currentLockedZombie = null;
        lockReticleGroup.visible = false;
        setLockedTarget(null);
      }

      scene.remove(z.group);
      zombies.splice(zIdx, 1);

      stateRef.current.kills += 1;
      setKills(stateRef.current.kills);
      onUpdateStats?.({
        kills: stateRef.current.kills,
        wave: stateRef.current.wave,
        health: stateRef.current.health,
      });
    }

    function createParticleSparks(pos: THREE.Vector3, colorVal: number, count = 10) {
      const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const pMat = new THREE.MeshBasicMaterial({ color: colorVal });
      for (let i = 0; i < count; i++) {
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.copy(pos);
        scene.add(pMesh);
        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 5 + 1,
          (Math.random() - 0.5) * 6
        );
        particles.push({ mesh: pMesh, velocity, lifetime: 0.35 });
      }
    }

    // 6. Sistema de Disparo Multi-Arma
    function shootBullet() {
      if (stateRef.current.isGameOver || stateRef.current.health <= 0) return;

      const now = performance.now() / 1000;
      const currentWeapon = WEAPONS[stateRef.current.currentWeaponId] || WEAPONS.pistol;

      if (now - stateRef.current.lastShotTime < currentWeapon.fireRate) return;
      stateRef.current.lastShotTime = now;

      // Posición del cañón del arma activa
      const barrelPos = new THREE.Vector3();
      gunGroup.getWorldPosition(barrelPos);
      barrelPos.y += 0.05;

      // Dirección del disparo alineada hacia la cámara o directamente al zombie si hay Aimlock fijado
      const baseDir = new THREE.Vector3();
      camera.getWorldDirection(baseDir);

      if (currentLockedZombie && currentLockedZombie.health > 0) {
        const targetAimPos = currentLockedZombie.group.position.clone().add(new THREE.Vector3(0, 1.25, 0));
        const aimDir = targetAimPos.sub(barrelPos).normalize();
        baseDir.copy(aimDir);
      }

      barrelPos.addScaledVector(baseDir, 0.4);

      // Disparar según el tipo de arma (Balística de proyectiles)
      if (currentWeapon.id === 'rocket') {
        // Cohete RPG
        const rGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8);
        const rMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 });
        const rMesh = new THREE.Mesh(rGeo, rMat);
        rMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), baseDir);
        rMesh.position.copy(barrelPos);
        scene.add(rMesh);

        bullets.push({
          mesh: rMesh,
          velocity: baseDir.clone().multiplyScalar(currentWeapon.bulletSpeed),
          lifetime: 3.0,
          damage: currentWeapon.damage,
          isRocket: true,
          splashRadius: currentWeapon.splashRadius || 7.0,
        });

        soundManager.playRocketLaunch();
        createParticleSparks(barrelPos, 0xff7700, 12);
      } else if (currentWeapon.id === 'sniper') {
        // Rifle Francotirador .50 BMG (Bala pesada de alta penetración hipersónica)
        const sGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8);
        const sMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
        const sMesh = new THREE.Mesh(sGeo, sMat);
        sMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), baseDir);
        sMesh.position.copy(barrelPos);
        scene.add(sMesh);

        bullets.push({
          mesh: sMesh,
          velocity: baseDir.clone().multiplyScalar(currentWeapon.bulletSpeed),
          lifetime: 2.0,
          damage: currentWeapon.damage,
          isSniper: true,
          piercedZombies: [],
        });

        soundManager.playSniper();
        createParticleSparks(barrelPos, 0xc084fc, 16);
      } else if (currentWeapon.id === 'plasma') {
        // Lanzallamas / Proyectil de Plasma Incandescente
        const pGeo = new THREE.SphereGeometry(0.24, 12, 12);
        const pMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.copy(barrelPos);
        scene.add(pMesh);

        bullets.push({
          mesh: pMesh,
          velocity: baseDir.clone().multiplyScalar(currentWeapon.bulletSpeed),
          lifetime: 2.5,
          damage: currentWeapon.damage,
          isRocket: true, // Daño splash de energía
          splashRadius: 4.5,
        });

        soundManager.playPlasma();
        createParticleSparks(barrelPos, 0x34d399, 14);
      } else if (currentWeapon.id === 'minigun') {
        // Ametralladora Rotativa Minigun (Ráfaga pesada dorada)
        const spreadDir = baseDir.clone();
        spreadDir.x += (Math.random() - 0.5) * currentWeapon.spread;
        spreadDir.y += (Math.random() - 0.5) * (currentWeapon.spread * 0.8);
        spreadDir.z += (Math.random() - 0.5) * currentWeapon.spread;
        spreadDir.normalize();

        const bGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const bMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const bMesh = new THREE.Mesh(bGeo, bMat);
        bMesh.position.copy(barrelPos);
        scene.add(bMesh);

        bullets.push({
          mesh: bMesh,
          velocity: spreadDir.multiplyScalar(currentWeapon.bulletSpeed),
          lifetime: 2.5,
          damage: currentWeapon.damage,
        });

        // Rotar cañones de la minigun
        if (gunModels.minigun.children[2]) {
          gunModels.minigun.children[2].rotation.z += 0.8;
        }

        soundManager.playMinigun();
        createParticleSparks(barrelPos, 0xfde047, 4);
      } else {
        // Armas balísticas (Pistola, Escopeta, Fusil)
        const pelletsCount = currentWeapon.pellets || 1;
        const bulletColor = currentWeapon.id === 'rifle' ? 0x38bdf8 : currentWeapon.id === 'shotgun' ? 0xf97316 : 0xfbbf24;
        const bulletRadius = currentWeapon.id === 'shotgun' ? 0.09 : 0.11;

        for (let i = 0; i < pelletsCount; i++) {
          const spreadDir = baseDir.clone();
          if (currentWeapon.spread > 0) {
            spreadDir.x += (Math.random() - 0.5) * currentWeapon.spread;
            spreadDir.y += (Math.random() - 0.5) * (currentWeapon.spread * 0.8);
            spreadDir.z += (Math.random() - 0.5) * currentWeapon.spread;
            spreadDir.normalize();
          }

          const bGeo = new THREE.SphereGeometry(bulletRadius, 8, 8);
          const bMat = new THREE.MeshBasicMaterial({ color: bulletColor });
          const bMesh = new THREE.Mesh(bGeo, bMat);
          bMesh.position.copy(barrelPos);
          scene.add(bMesh);

          bullets.push({
            mesh: bMesh,
            velocity: spreadDir.multiplyScalar(currentWeapon.bulletSpeed),
            lifetime: 2.5,
            damage: currentWeapon.damage,
            isRocket: false,
          });
        }

        if (currentWeapon.id === 'shotgun') {
          soundManager.playShotgun();
        } else if (currentWeapon.id === 'rifle') {
          soundManager.playRifle();
        } else {
          soundManager.playGunshot();
        }
      }

      // Retroceso y fogonazo
      const recoilDistance = currentWeapon.id === 'shotgun' ? 0.30 : currentWeapon.id === 'rocket' ? 0.26 : 0.42;
      gunGroup.position.z = recoilDistance;
      muzzleFlashMat.color.set(currentWeapon.id === 'rifle' ? 0x7dd3fc : 0xffaa00);
      muzzleFlashMat.opacity = 1;

      setTimeout(() => {
        muzzleFlashMat.opacity = 0;
        gunGroup.position.z = 0.5;
      }, 55);
    }

    // 7. Manejo de Eventos del Teclado y Ratón con Soporte de Aimlock
    function updateAimLockState() {
      const active = stateRef.current.aimLockToggle || stateRef.current.keys.mouse2;
      stateRef.current.isAimLockActive = active;
      setIsAimLockActive(active);
    }

    function toggleAimLock() {
      stateRef.current.aimLockToggle = !stateRef.current.aimLockToggle;
      updateAimLockState();
      const isActive = stateRef.current.isAimLockActive;
      if (isActive) {
        soundManager.playAimLock();
        setWeaponNotification('🎯 Aimlock Activado');
      } else {
        soundManager.playAimUnlock();
        setWeaponNotification('Aimlock Desactivado');
      }
      setTimeout(() => setWeaponNotification(null), 1400);
    }

    stateRef.current.toggleAimLock = toggleAimLock;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') stateRef.current.keys.w = true;
      if (key === 'a') stateRef.current.keys.a = true;
      if (key === 's') stateRef.current.keys.s = true;
      if (key === 'd') stateRef.current.keys.d = true;
      if (e.shiftKey) stateRef.current.keys.shift = true;
      if (e.code === 'Space') {
        stateRef.current.keys.space = true;
        // Si el jugador está sufriendo un QTE por el Acechador, intentar liberarse
        if (qteRef.active) {
          attemptQteEscape();
        } else if (playerPhysics.isGrounded && !stateRef.current.isGameOver) {
          // Salto regular
          playerPhysics.velocityY = playerPhysics.jumpForce;
          playerPhysics.isGrounded = false;
        }
      }
      // Fijación de Objetivo Aimlock: Tecla E o F
      if (key === 'e' || key === 'f') {
        toggleAimLock();
      }

      // Selección rápida de armas con teclas numéricas 1 a 7
      if (key === '1') switchWeapon('pistol');
      if (key === '2') switchWeapon('shotgun');
      if (key === '3') switchWeapon('rifle');
      if (key === '4') switchWeapon('rocket');
      if (key === '5') switchWeapon('sniper');
      if (key === '6') switchWeapon('plasma');
      if (key === '7') switchWeapon('minigun');

      if (key === 'r' && stateRef.current.isGameOver) {
        restartGame();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') stateRef.current.keys.w = false;
      if (key === 'a') stateRef.current.keys.a = false;
      if (key === 's') stateRef.current.keys.s = false;
      if (key === 'd') stateRef.current.keys.d = false;
      if (!e.shiftKey) stateRef.current.keys.shift = false;
      if (e.code === 'Space') stateRef.current.keys.space = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Clic Izquierdo: Disparo
        stateRef.current.keys.mouse0 = true;
        shootBullet();
      } else if (e.button === 2) {
        // Clic Derecho: Fijar/Mantener Aimlock
        e.preventDefault();
        stateRef.current.keys.mouse2 = true;
        updateAimLockState();
        if (!stateRef.current.aimLockToggle) {
          soundManager.playAimLock();
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        stateRef.current.keys.mouse0 = false;
      } else if (e.button === 2) {
        // Clic Derecho soltado
        e.preventDefault();
        stateRef.current.keys.mouse2 = false;
        updateAimLockState();
        if (!stateRef.current.aimLockToggle) {
          soundManager.playAimUnlock();
        }
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        const sensitivity = 0.0024;
        stateRef.current.cameraYaw -= e.movementX * sensitivity;
        stateRef.current.cameraPitch += e.movementY * sensitivity;

        // Limitar inclinación vertical (Pitch)
        stateRef.current.cameraPitch = Math.max(-0.25, Math.min(0.85, stateRef.current.cameraPitch));
      }
    };

    const onPointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === renderer.domElement);
    };

    const onCanvasClick = () => {
      if (document.pointerLockElement !== renderer.domElement && !stateRef.current.isGameOver) {
        renderer.domElement.requestPointerLock?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    renderer.domElement.addEventListener('click', onCanvasClick);

    // Función de reinicio de partida
    function restartGame() {
      // Limpiar zombies
      for (const z of zombies) {
        scene.remove(z.group);
      }
      zombies.length = 0;

      // Limpiar balas y partículas
      for (const b of bullets) scene.remove(b.mesh);
      bullets.length = 0;
      for (const p of particles) scene.remove(p.mesh);
      particles.length = 0;

      // Limpiar proyectiles de ácido y charcos corrosivos
      for (const s of acidSpits) scene.remove(s.mesh);
      acidSpits.length = 0;
      for (const p of acidPuddles) {
        scene.remove(p.mesh);
        for (const b of p.bubbles) scene.remove(b);
      }
      acidPuddles.length = 0;
      setInAcid(false);

      // Reactivar armas en el mapa
      for (const pk of weaponPickups) {
        pk.active = true;
        pk.group.visible = true;
        pk.respawnTimer = 0;
      }

      // Reiniciar estado QTE
      qteRef.active = false;
      qteRef.pinnedZombie = null;
      setQteData(null);

      // Resetear estados
      stateRef.current.health = 100;
      stateRef.current.kills = 0;
      stateRef.current.wave = 1;
      stateRef.current.isGameOver = false;

      waveTotalZombies = 6;
      waveSpawnedCount = 0;
      waveSpawnTimer = 0;

      playerGroup.position.set(0, 0, 0);
      playerGroup.rotation.set(0, 0, 0);
      playerPhysics.velocityY = 0;
      torso.material = torsoMat;

      setHealth(100);
      setKills(0);
      setWave(1);
      setIsGameOver(false);
      setWaveNotification("¡OLEADA 1 COMIENZA!");
      soundManager.playWaveStart();
    }

    // 8. Bucle de Render y Física (Delta Time)
    let animationFrameId: number;
    let lastTime = performance.now();
    let walkCycle = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // --- ACTUALIZACIÓN DE ESTADOS ESPECIALES ---
      // 1. Minijuego QTE del Acechador (Barra oscilante para liberarse)
      if (qteRef.active && !stateRef.current.isGameOver) {
        qteRef.barPos += qteRef.direction * qteRef.speed * dt;
        if (qteRef.barPos >= 100) {
          qteRef.barPos = 100;
          qteRef.direction = -1;
        } else if (qteRef.barPos <= 0) {
          qteRef.barPos = 0;
          qteRef.direction = 1;
        }
        setQteData({
          active: true,
          barPos: Math.round(qteRef.barPos),
          targetMin: qteRef.targetMin,
          targetMax: qteRef.targetMax,
        });

        // Mordiscos constantes del Acechador mientras te tiene atrapado
        const nowSec = currentTime / 1000;
        if (nowSec - qteRef.lastBiteTime > 0.65) {
          qteRef.lastBiteTime = nowSec;
          stateRef.current.health = Math.max(0, stateRef.current.health - 6);
          setHealth(stateRef.current.health);
          soundManager.playPlayerHurt();
          setTakingDamage(true);
          setTimeout(() => setTakingDamage(false), 160);

          if (stateRef.current.health <= 0) {
            stateRef.current.isGameOver = true;
            setIsGameOver(true);
            soundManager.playGameOver();
            document.exitPointerLock?.();
            qteRef.active = false;
            setQteData(null);
          }
        }

        // Fijar al Acechador abrazando agresivamente al jugador
        if (qteRef.pinnedZombie) {
          const pz = qteRef.pinnedZombie;
          pz.group.position.copy(playerGroup.position);
          pz.group.position.y += 0.35;
          pz.group.rotation.y = stateRef.current.cameraYaw + Math.PI;
        }
      }

      // 2. Charcos de Ácido Tóxico y Detección de Quemaduras Corrosivas
      let touchingAcid = false;
      for (let pIdx = acidPuddles.length - 1; pIdx >= 0; pIdx--) {
        const puddle = acidPuddles[pIdx];
        puddle.lifetime -= dt;

        // Desvanecimiento suave en los últimos 2 segundos
        if (puddle.lifetime < 2.0) {
          (puddle.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0.1, (puddle.lifetime / 2.0) * 0.8);
        }

        // Animación de burbujeo ácido
        for (let bIdx = 0; bIdx < puddle.bubbles.length; bIdx++) {
          const bubble = puddle.bubbles[bIdx];
          bubble.position.y = 0.08 + Math.sin(currentTime * 0.005 + bIdx) * 0.12;
        }

        // Detección de contacto con el jugador
        const dist = playerGroup.position.distanceTo(puddle.position);
        if (dist <= puddle.radius) {
          touchingAcid = true;
        }

        if (puddle.lifetime <= 0) {
          scene.remove(puddle.mesh);
          for (const b of puddle.bubbles) scene.remove(b);
          acidPuddles.splice(pIdx, 1);
        }
      }

      if (touchingAcid && !stateRef.current.isGameOver) {
        if (!inAcid) setInAcid(true);
        // Daño de quemadura química periódica
        if (Math.random() < 0.12) {
          soundManager.playAcidBurn();
          stateRef.current.health = Math.max(0, stateRef.current.health - 2);
          setHealth(stateRef.current.health);
          setTakingDamage(true);
          setTimeout(() => setTakingDamage(false), 140);
          if (stateRef.current.health <= 0) {
            stateRef.current.isGameOver = true;
            setIsGameOver(true);
            soundManager.playGameOver();
            document.exitPointerLock?.();
          }
        }
      } else if (inAcid && !touchingAcid) {
        setInAcid(false);
      }

      // 3. Proyectiles de Saliva de Ácido en el Aire
      for (let sIdx = acidSpits.length - 1; sIdx >= 0; sIdx--) {
        const spit = acidSpits[sIdx];
        spit.velocity.y -= 12 * dt;
        spit.mesh.position.addScaledVector(spit.velocity, dt);
        spit.lifetime -= dt;

        if (spit.mesh.position.y <= 0.1 || spit.lifetime <= 0) {
          createAcidPuddle(new THREE.Vector3(spit.mesh.position.x, 0, spit.mesh.position.z), 3.4, 9.0);
          soundManager.playToxicExplosion();
          createParticleSparks(spit.mesh.position, 0x84cc16, 14);
          scene.remove(spit.mesh);
          acidSpits.splice(sIdx, 1);
        }
      }

      // 4. Suministros y Pedestales de Armas en el Mapa
      for (const pk of weaponPickups) {
        if (!pk.active) {
          pk.respawnTimer -= dt;
          if (pk.respawnTimer <= 0) {
            pk.active = true;
            pk.group.visible = true;
          }
        } else {
          // Giro 3D y efecto levitación
          pk.modelGroup.rotation.y += 1.8 * dt;
          pk.modelGroup.position.y = 1.15 + Math.sin(currentTime * 0.003 + pk.position.x) * 0.12;

          // Colisión y recolección por parte del jugador
          const distToPlayer = playerGroup.position.distanceTo(pk.position);
          if (distToPlayer < 1.85 && !stateRef.current.isGameOver) {
            switchWeapon(pk.weaponId);
            soundManager.playWeaponPickup();
            createParticleSparks(pk.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x38bdf8, 24);
            pk.active = false;
            pk.group.visible = false;
            pk.respawnTimer = 22; // reaparece en 22 segundos
          }
        }
      }

      // A) Movimiento del Jugador basado en teclas WASD relativo a la cámara
      const isMoving =
        stateRef.current.keys.w ||
        stateRef.current.keys.s ||
        stateRef.current.keys.a ||
        stateRef.current.keys.d;

      if (!stateRef.current.isGameOver) {
        // Disparo continuo al mantener presionado el clic (bloqueado durante forcejeo QTE)
        if (stateRef.current.keys.mouse0 && !qteRef.active) {
          shootBullet();
        }

        const forward = new THREE.Vector3(
          -Math.sin(stateRef.current.cameraYaw),
          0,
          -Math.cos(stateRef.current.cameraYaw)
        ).normalize();

        const right = new THREE.Vector3(
          Math.cos(stateRef.current.cameraYaw),
          0,
          -Math.sin(stateRef.current.cameraYaw)
        ).normalize();

        const moveDir = new THREE.Vector3(0, 0, 0);
        // Si el Acechador tiene apresado al jugador, no puede caminar
        if (!qteRef.active) {
          if (stateRef.current.keys.w) moveDir.add(forward);
          if (stateRef.current.keys.s) moveDir.sub(forward);
          if (stateRef.current.keys.d) moveDir.add(right);
          if (stateRef.current.keys.a) moveDir.sub(right);
        }

        let currentSpeed = stateRef.current.keys.shift
          ? playerPhysics.runSpeed
          : playerPhysics.walkSpeed;

        // Reducción drástica de velocidad si está pisando charco corrosivo
        if (inAcid) {
          currentSpeed *= 0.55;
        }

        if (moveDir.lengthSq() > 0.001) {
          moveDir.normalize();
          playerGroup.position.addScaledVector(moveDir, currentSpeed * dt);

          // Rotación suave del modelo hacia la dirección de avance
          playerPhysics.targetRotationY = Math.atan2(moveDir.x, moveDir.z);
          playerGroup.rotation.y = THREE.MathUtils.lerp(
            playerGroup.rotation.y,
            playerPhysics.targetRotationY,
            12 * dt
          );

          // Animación de caminata (balanceo de piernas)
          walkCycle += dt * (stateRef.current.keys.shift ? 16 : 10);
          leftLeg.rotation.x = Math.sin(walkCycle) * 0.6;
          rightLeg.rotation.x = -Math.sin(walkCycle) * 0.6;
        } else {
          leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, 8 * dt);
          rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, 8 * dt);
        }

        // Físicas verticales (Gravedad y Salto)
        playerPhysics.velocityY += playerPhysics.gravity * dt;
        playerGroup.position.y += playerPhysics.velocityY * dt;

        if (playerGroup.position.y <= 0) {
          playerGroup.position.y = 0;
          playerPhysics.velocityY = 0;
          playerPhysics.isGrounded = true;
        }

        // Restringir jugador al cuadrilátero de la arena
        playerGroup.position.x = Math.max(-75, Math.min(75, playerGroup.position.x));
        playerGroup.position.z = Math.max(-75, Math.min(75, playerGroup.position.z));
      }

      // B) Posición de la Cámara en Tercera Persona (Orbital Rig)
      const targetPos = playerGroup.position.clone().add(new THREE.Vector3(0, 1.5, 0));

      // B.1) Sistema de Fijación Automática Aimlock (Auto-Target Lock)
      const isAimLocking = stateRef.current.isAimLockActive;
      if (isAimLocking && !stateRef.current.isGameOver && zombies.length > 0) {
        let bestTarget: ZombieData | null = null;
        let bestScore = Infinity;

        const forward = new THREE.Vector3(
          -Math.sin(stateRef.current.cameraYaw),
          0,
          -Math.cos(stateRef.current.cameraYaw)
        ).normalize();

        for (const z of zombies) {
          if (z.health <= 0) continue;
          const toZombie = z.group.position.clone().sub(playerGroup.position);
          const dist = toZombie.length();
          if (dist > 55) continue;

          toZombie.y = 0;
          const dir = toZombie.normalize();
          const dot = Math.max(-1, Math.min(1, forward.dot(dir)));
          // Score pondera distancia física y alineación visual con la mira
          const score = dist * 0.5 + (1 - dot) * 22;

          if (score < bestScore) {
            bestScore = score;
            bestTarget = z;
          }
        }

        if (bestTarget) {
          if (currentLockedZombie !== bestTarget) {
            soundManager.playAimLock();
          }
          currentLockedZombie = bestTarget;

          // Posicionar y orientar la retícula holográfica 3D sobre el zombie
          const targetChest = bestTarget.group.position.clone().add(new THREE.Vector3(0, 1.25, 0));
          lockReticleGroup.visible = true;
          lockReticleGroup.position.copy(targetChest);
          lockReticleGroup.lookAt(camera.position);
          lockDiamond.rotation.z += dt * 3.5;

          // Orientar la cámara automáticamente hacia el objetivo (Aimlock Smooth Tracking)
          const delta = targetChest.clone().sub(targetPos);
          const horizDist = Math.hypot(delta.x, delta.z);
          if (horizDist > 0.1) {
            const targetYaw = Math.atan2(-delta.x, -delta.z);
            const targetPitch = Math.max(-0.25, Math.min(0.65, -Math.atan2(delta.y - 0.35, horizDist) + 0.12));

            let diffYaw = targetYaw - stateRef.current.cameraYaw;
            while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
            while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;

            const trackingSpeed = 16.0 * dt;
            stateRef.current.cameraYaw += diffYaw * Math.min(1, trackingSpeed);
            stateRef.current.cameraPitch = THREE.MathUtils.lerp(
              stateRef.current.cameraPitch,
              targetPitch,
              Math.min(1, trackingSpeed)
            );
          }

          // Orientar el cuerpo del personaje hacia el objetivo
          playerPhysics.targetRotationY = Math.atan2(
            bestTarget.group.position.x - playerGroup.position.x,
            bestTarget.group.position.z - playerGroup.position.z
          );
          playerGroup.rotation.y = THREE.MathUtils.lerp(playerGroup.rotation.y, playerPhysics.targetRotationY, 14 * dt);

          const distM = Math.round(playerGroup.position.distanceTo(bestTarget.group.position));
          const hpPct = Math.round((bestTarget.health / bestTarget.maxHealth) * 100);
          const zInfo = ZOMBIE_TYPES[bestTarget.type];
          setLockedTarget({
            dist: distM,
            hp: hpPct,
            type: bestTarget.type,
            name: zInfo.name,
            badge: zInfo.badge,
            color: zInfo.color,
          });
        } else {
          currentLockedZombie = null;
          lockReticleGroup.visible = false;
          setLockedTarget(null);
        }
      } else {
        if (currentLockedZombie) {
          soundManager.playAimUnlock();
        }
        currentLockedZombie = null;
        lockReticleGroup.visible = false;
        setLockedTarget(null);
      }

      const camDist = stateRef.current.cameraDistance;
      const camHeight = stateRef.current.cameraHeight;

      // Calcular posición esférica de la cámara en 3ª persona
      const cx = targetPos.x + Math.sin(stateRef.current.cameraYaw) * Math.cos(stateRef.current.cameraPitch) * camDist;
      const cy = targetPos.y + Math.sin(stateRef.current.cameraPitch) * camDist + camHeight;
      const cz = targetPos.z + Math.cos(stateRef.current.cameraYaw) * Math.cos(stateRef.current.cameraPitch) * camDist;

      // Suavizado de seguimiento (Lerp)
      camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.22);
      camera.lookAt(targetPos.clone().add(new THREE.Vector3(0, 0.4, 0)));

      // C) Spawneo y Gestión de Oleadas
      if (!stateRef.current.isGameOver) {
        waveSpawnTimer += dt;
        if (waveSpawnTimer >= waveSpawnInterval && waveSpawnedCount < waveTotalZombies) {
          waveSpawnTimer = 0;
          spawnZombie();
        }

        // Verificar si la oleada concluyó
        if (waveSpawnedCount >= waveTotalZombies && zombies.length === 0) {
          stateRef.current.wave += 1;
          waveTotalZombies = Math.floor(waveTotalZombies * 1.5) + 2;
          waveSpawnedCount = 0;
          waveSpawnTimer = 0;
          setWave(stateRef.current.wave);
          setWaveNotification(`¡OLEADA ${stateRef.current.wave} COMIENZA!`);
          soundManager.playWaveStart();
          setTimeout(() => setWaveNotification(null), 3000);
        }
      }

      // D) IA de los Zombies (Persecución y Ataque según mutación)
      const nowSec = currentTime / 1000;
      for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];

        // Comportamiento del Saltador (Leaper) en fase de salto parabólico
        if (z.type === 'leaper' && z.isLeaping && z.leapStartPos && z.leapTargetPos) {
          z.leapProgress = (z.leapProgress || 0) + dt * 1.55;
          const t = Math.min(1, z.leapProgress);
          z.group.position.lerpVectors(z.leapStartPos, z.leapTargetPos, t);
          z.group.position.y = Math.sin(t * Math.PI) * 4.2; // Altura parabólica del salto
          z.group.rotation.x = THREE.MathUtils.lerp(0.35, 1.1, Math.sin(t * Math.PI));

          if (t >= 1) {
            z.isLeaping = false;
            z.group.position.y = 0;
            z.group.rotation.x = 0.35;
            createParticleSparks(z.group.position, 0xc084fc, 18);

            // Detección de impacto de embestida contra el jugador para activar QTE
            const landDist = playerGroup.position.distanceTo(z.group.position);
            if (landDist <= 2.8 && !qteRef.active && !stateRef.current.isGameOver) {
              qteRef.active = true;
              qteRef.barPos = 50;
              qteRef.direction = 1;
              qteRef.pinnedZombie = z;
              qteRef.lastBiteTime = nowSec;
              soundManager.playLeaperPounce();
              setWeaponNotification('⚠️ ¡EMBESTIDA! Presiona ESPACIO en la zona verde');
            }
          }
          continue;
        }

        const diff = playerGroup.position.clone().sub(z.group.position);
        diff.y = 0;
        const dist = diff.length();

        // Mirar hacia el jugador
        if (dist > 0.05) {
          const targetAngle = Math.atan2(diff.x, diff.z);
          z.group.rotation.y = THREE.MathUtils.lerp(z.group.rotation.y, targetAngle, 8 * dt);
        }

        // Habilidades especiales a media distancia
        if (z.type === 'leaper' && !stateRef.current.isGameOver) {
          z.leapCooldown = (z.leapCooldown || 0) - dt;
          if (dist >= 6.5 && dist <= 24.0 && z.leapCooldown <= 0 && !qteRef.active) {
            z.isLeaping = true;
            z.leapProgress = 0;
            z.leapStartPos = z.group.position.clone();
            z.leapTargetPos = playerGroup.position.clone();
            z.leapCooldown = 7.5;
            soundManager.playLeaperPounce();
            createParticleSparks(z.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xc084fc, 14);
            continue;
          }
        } else if (z.type === 'toxic' && !stateRef.current.isGameOver) {
          z.toxicSpitCooldown = (z.toxicSpitCooldown || 0) - dt;
          if (dist >= 7.0 && dist <= 26.0 && z.toxicSpitCooldown <= 0) {
            z.toxicSpitCooldown = 6.5;
            const spitGeo = new THREE.SphereGeometry(0.24, 8, 8);
            const spitMat = new THREE.MeshBasicMaterial({ color: 0x84cc16 });
            const spitMesh = new THREE.Mesh(spitGeo, spitMat);
            spitMesh.position.copy(z.group.position).add(new THREE.Vector3(0, 1.8, 0));
            scene.add(spitMesh);

            const targetGround = playerGroup.position.clone();
            const spitVel = targetGround.clone().sub(spitMesh.position).normalize().multiplyScalar(15);
            spitVel.y = 4.8;
            acidSpits.push({ mesh: spitMesh, velocity: spitVel, targetPos: targetGround, lifetime: 3.5 });
            soundManager.playRunnerScreech();
          }
        }

        // Persecución si está a más de 1.5 metros
        if (dist > 1.6 && !stateRef.current.isGameOver) {
          const dir = diff.normalize();
          z.group.position.addScaledVector(dir, z.speed * dt);

          // Animación de zancada zombie adaptada a la anatomía
          const cadence = z.type === 'runner' ? 2.2 : z.type === 'leaper' ? 1.8 : z.type === 'tank' ? 0.75 : 1.0;
          const zCycle = currentTime * 0.008 * (z.speed / 3) * cadence;
          z.leftLeg.rotation.x = Math.sin(zCycle) * 0.45;
          z.rightLeg.rotation.x = -Math.sin(zCycle) * 0.45;
          z.leftArm.rotation.x = -Math.PI / 2.2 + Math.sin(zCycle) * 0.15;
          z.rightArm.rotation.x = -Math.PI / 2.2 - Math.sin(zCycle) * 0.15;
        } else if (!stateRef.current.isGameOver) {
          // Ataque al jugador respetando cadencia e impacto del tipo
          if (nowSec - z.lastAttackTime > z.attackInterval) {
            z.lastAttackTime = nowSec;
            if (z.type === 'tank') {
              soundManager.playTankRoar();
            } else if (z.type === 'runner') {
              soundManager.playRunnerScreech();
            } else if (z.type === 'leaper') {
              soundManager.playLeaperPounce();
            } else {
              soundManager.playZombieGrowl();
            }
            soundManager.playPlayerHurt();

            // Daño calibrado al jugador según el tipo de mutación
            stateRef.current.health = Math.max(0, stateRef.current.health - z.damage);
            setHealth(stateRef.current.health);
            setTakingDamage(true);
            setTimeout(() => setTakingDamage(false), 200);

            if (stateRef.current.health <= 0) {
              stateRef.current.isGameOver = true;
              setIsGameOver(true);
              soundManager.playGameOver();
              document.exitPointerLock?.();
            }
          }
        }

        // Recuperar color original tras recibir impacto
        if (z.hurtTimer > 0) {
          z.hurtTimer -= dt;
          if (z.hurtTimer <= 0) {
            (z.torso.material as THREE.MeshStandardMaterial).color.setHex(z.originalTorsoColor);
            (z.head.material as THREE.MeshStandardMaterial).color.setHex(z.originalHeadColor);
          }
        }
      }

      // E) Balas: Desplazamiento y Detección de Colisiones
      for (let bIdx = bullets.length - 1; bIdx >= 0; bIdx--) {
        const b = bullets[bIdx];
        b.mesh.position.addScaledVector(b.velocity, dt);
        b.lifetime -= dt;

        // Proyectil Francotirador .50 BMG: Penetración lineal múltiple
        if (b.isSniper) {
          for (let zIdx = zombies.length - 1; zIdx >= 0; zIdx--) {
            const z = zombies[zIdx];
            if (b.piercedZombies && b.piercedZombies.includes(z)) continue;

            const distToZombie = b.mesh.position.distanceTo(
              z.group.position.clone().add(new THREE.Vector3(0, 1.2 * (z.group.scale.y || 1), 0))
            );

            if (distToZombie < 1.3 * (z.group.scale.y || 1)) {
              if (!b.piercedZombies) b.piercedZombies = [];
              b.piercedZombies.push(z);
              z.health -= b.damage;
              soundManager.playZombieHit();
              createParticleSparks(b.mesh.position, 0xc084fc, 14);

              z.hurtTimer = 0.2;
              (z.torso.material as THREE.MeshStandardMaterial).color.setHex(0xc084fc);
              (z.head.material as THREE.MeshStandardMaterial).color.setHex(0xc084fc);

              const pushDir = z.group.position.clone().sub(playerGroup.position).normalize();
              z.group.position.addScaledVector(pushDir, 0.6);

              if (z.health <= 0) {
                killZombie(zIdx, z);
              }

              if (b.piercedZombies.length >= 3) {
                scene.remove(b.mesh);
                bullets.splice(bIdx, 1);
                break;
              }
            }
          }

          if (b.lifetime <= 0 && bullets.includes(b)) {
            scene.remove(b.mesh);
            bullets.splice(bIdx, 1);
          }
          continue;
        }

        let bulletHit = false;

        // Si es un cohete o bola de plasma, dejar estela de partículas
        if (b.isRocket && Math.random() < 0.4) {
          createParticleSparks(b.mesh.position, 0xf97316, 2);
        }

        // Colisión con suelo si es cohete
        if (b.isRocket && b.mesh.position.y <= 0.2) {
          bulletHit = true;
        }

        // Colisión con Zombies
        for (let zIdx = zombies.length - 1; zIdx >= 0; zIdx--) {
          const z = zombies[zIdx];
          const distToZombie = b.mesh.position.distanceTo(
            z.group.position.clone().add(new THREE.Vector3(0, 1.2 * (z.group.scale.y || 1), 0))
          );

          if (distToZombie < (b.isRocket ? 1.6 : 1.1 * (z.group.scale.y || 1))) {
            bulletHit = true;
            break;
          }
        }

        if (bulletHit || b.lifetime <= 0) {
          if (b.isRocket) {
            // Explosión de cohete con daño en área (Splash)
            const explosionPos = b.mesh.position.clone();
            soundManager.playExplosion();
            createParticleSparks(explosionPos, 0xff4400, 24);
            createParticleSparks(explosionPos, 0xffcc00, 16);
            createParticleSparks(explosionPos, 0x444444, 12);

            const splash = b.splashRadius || 7.0;

            for (let zIdx = zombies.length - 1; zIdx >= 0; zIdx--) {
              const z = zombies[zIdx];
              const dist = explosionPos.distanceTo(z.group.position.clone().add(new THREE.Vector3(0, 1, 0)));

              if (dist <= splash) {
                const falloff = 1 - (dist / splash);
                const appliedDamage = Math.floor(b.damage * Math.max(0.35, falloff));
                z.health -= appliedDamage;

                // Empujón radial por onda expansiva
                const pushDir = z.group.position.clone().sub(explosionPos).normalize();
                pushDir.y = 0.5;
                z.group.position.addScaledVector(pushDir, (z.type === 'tank' ? 0.6 : 1.2) * falloff);

                z.hurtTimer = 0.25;
                (z.torso.material as THREE.MeshStandardMaterial).color.setHex(0xff3333);
                (z.head.material as THREE.MeshStandardMaterial).color.setHex(0xff3333);

                if (z.health <= 0) {
                  killZombie(zIdx, z);
                }
              }
            }
          } else if (bulletHit) {
            // Proyectil convencional (Pistola, Escopeta, Fusil, Minigun)
            for (let zIdx = zombies.length - 1; zIdx >= 0; zIdx--) {
              const z = zombies[zIdx];
              const distToZombie = b.mesh.position.distanceTo(
                z.group.position.clone().add(new THREE.Vector3(0, 1.2 * (z.group.scale.y || 1), 0))
              );

              if (distToZombie < 1.1 * (z.group.scale.y || 1)) {
                z.health -= b.damage;
                soundManager.playZombieHit();
                createParticleSparks(b.mesh.position, 0xbb1111, 8);

                z.hurtTimer = 0.14;
                (z.torso.material as THREE.MeshStandardMaterial).color.setHex(0xff1111);
                (z.head.material as THREE.MeshStandardMaterial).color.setHex(0xff1111);

                const pushForce = z.type === 'tank' ? 0.12 : 0.35;
                const pushDir = z.group.position.clone().sub(playerGroup.position).normalize();
                z.group.position.addScaledVector(pushDir, pushForce);

                if (z.health <= 0) {
                  killZombie(zIdx, z);
                }
                break;
              }
            }
          }

          scene.remove(b.mesh);
          bullets.splice(bIdx, 1);
        }
      }

      // F) Partículas de impacto
      for (let pIdx = particles.length - 1; pIdx >= 0; pIdx--) {
        const p = particles[pIdx];
        p.velocity.y -= 15 * dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.lifetime -= dt;
        p.mesh.scale.multiplyScalar(0.92);

        if (p.lifetime <= 0) {
          scene.remove(p.mesh);
          particles.splice(pIdx, 1);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 9. Manejo de redimensionamiento
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="relative w-full h-[640px] lg:h-[720px] rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 bg-neutral-950 select-none">
        {/* Canvas 3D de Three.js */}
        <div ref={mountRef} className="w-full h-full cursor-crosshair" />

      {/* Retícula / Crosshair en el centro de la pantalla con soporte visual para Aimlock */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative flex flex-col items-center justify-center">
          <div className="relative w-8 h-8 flex items-center justify-center">
            {/* Punto central dinámico */}
            <div
              className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
                isAimLockActive
                  ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] scale-125'
                  : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              }`}
            />
            <div
              className={`absolute -top-3 w-0.5 h-2 transition-colors ${
                isAimLockActive ? 'bg-red-500' : 'bg-amber-400/80'
              }`}
            />
            <div
              className={`absolute -bottom-3 w-0.5 h-2 transition-colors ${
                isAimLockActive ? 'bg-red-500' : 'bg-amber-400/80'
              }`}
            />
            <div
              className={`absolute -left-3 w-2 h-0.5 transition-colors ${
                isAimLockActive ? 'bg-red-500' : 'bg-amber-400/80'
              }`}
            />
            <div
              className={`absolute -right-3 w-2 h-0.5 transition-colors ${
                isAimLockActive ? 'bg-red-500' : 'bg-amber-400/80'
              }`}
            />

            {/* Brackets tácticos de fijación cuando Aimlock está encendido */}
            {isAimLockActive && (
              <div
                className={`absolute inset-0 border-2 rounded-md scale-125 transition-colors ${
                  lockedTarget ? 'border-red-500 animate-pulse' : 'border-red-500/40 border-dashed'
                }`}
              />
            )}
          </div>

          {/* Telemetría de objetivo fijado debajo de la retícula */}
          {isAimLockActive && (
            <div className="mt-4 px-3 py-1 bg-neutral-950/90 backdrop-blur-sm border border-red-500/70 rounded-lg text-[10px] font-mono font-bold tracking-wider text-red-400 flex items-center gap-2 shadow-xl">
              <span className={`w-1.5 h-1.5 rounded-full ${lockedTarget ? 'bg-red-500 animate-ping' : 'bg-amber-500'}`} />
              {lockedTarget ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${lockedTarget.color}`}>
                    {lockedTarget.badge}
                  </span>
                  <span className="text-neutral-100 font-semibold">{lockedTarget.name}</span>
                  <span className="text-neutral-500">•</span>
                  <span className="text-amber-300 font-mono">{lockedTarget.dist}M</span>
                  <span className="text-neutral-500">•</span>
                  <span className={lockedTarget.hp > 40 ? 'text-emerald-400 font-mono' : 'text-red-400 font-mono font-bold'}>
                    HP: {lockedTarget.hp}%
                  </span>
                </div>
              ) : (
                <span>AIMLOCK: RASTREANDO AMENAZAS...</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Efecto de daño: Destello rojo en pantalla */}
      {takingDamage && (
        <div className="absolute inset-0 bg-red-600/35 pointer-events-none transition-opacity duration-150 z-10" />
      )}

      {/* Efecto de Ácido Corrosivo en Pantalla */}
      {inAcid && (
        <div className="absolute inset-0 pointer-events-none border-4 border-lime-500/80 bg-lime-950/25 shadow-[inset_0_0_50px_rgba(132,204,22,0.5)] z-10 animate-pulse flex flex-col justify-end items-center pb-16">
          <div className="bg-neutral-950/90 border border-lime-500 px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(132,204,22,0.6)] flex items-center gap-2 text-lime-400 font-mono text-xs font-black">
            <Flame className="w-4 h-4 text-lime-400 animate-bounce" />
            <span>☣️ QUEMADURA DE ÁCIDO: VELOCIDAD -45% & DAÑO CONTINUO</span>
          </div>
        </div>
      )}

      {/* MINIJUEGO QTE: Forcejeo para liberarse del Acechador (Leaper) */}
      {qteData && qteData.active && (
        <div className="absolute inset-0 bg-purple-950/50 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-30 select-none animate-fadeIn">
          <div className="bg-neutral-950/95 border-2 border-purple-500/90 rounded-2xl p-5 max-w-sm w-full shadow-[0_0_35px_rgba(168,85,247,0.5)] flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2 text-purple-400">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider">¡ACECHADOR ENCIMA!</span>
            </div>

            <p className="text-xs text-neutral-300">
              ¡Detén la barra en la <b className="text-emerald-400 font-bold">ZONA VERDE</b> para liberarte de sus garras y aturdirlo!
            </p>

            {/* Barra oscilante interactiva del Minijuego */}
            <div className="relative w-full h-8 bg-neutral-900 rounded-full border-2 border-neutral-700 overflow-hidden shadow-inner flex items-center">
              {/* Zona verde de éxito */}
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/80 border-x-2 border-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.8)]"
                style={{
                  left: `${qteData.targetMin}%`,
                  width: `${qteData.targetMax - qteData.targetMin}%`,
                }}
              />

              {/* Aguja / Marcador móvil */}
              <div
                className="absolute top-0 bottom-0 w-3.5 bg-white rounded shadow-[0_0_12px_#ffffff] -translate-x-1/2 border border-neutral-300 transition-all duration-75"
                style={{ left: `${qteData.barPos}%` }}
              />
            </div>

            <button
              onClick={() => stateRef.current.attemptQteEscape?.()}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-black text-sm rounded-xl shadow-lg border border-purple-400/80 cursor-pointer flex items-center justify-center gap-2 animate-pulse"
            >
              <span>¡LIBERARSE!</span>
              <span className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono font-bold">[ESPACIO]</span>
            </button>
          </div>
        </div>
      )}

      {/* Barra de HUD Superior: Salud, Oleada y Bajas */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        {/* Salud del Jugador */}
        <div className="flex items-center gap-3 bg-neutral-900/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-neutral-700/60 shadow-lg">
          <ShieldAlert className={`w-5 h-5 ${health > 30 ? 'text-emerald-400' : 'text-red-500 animate-pulse'}`} />
          <div className="flex flex-col">
            <div className="flex justify-between items-center text-xs font-semibold tracking-wider text-neutral-300">
              <span>SALUD</span>
              <span className={health > 30 ? 'text-emerald-400 font-mono' : 'text-red-400 font-mono font-bold'}>
                {health}%
              </span>
            </div>
            <div className="w-36 sm:w-48 h-3 bg-neutral-950 rounded-full overflow-hidden border border-neutral-700/80 mt-1">
              <div
                className={`h-full transition-all duration-200 ${
                  health > 50
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : health > 25
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-red-600 to-rose-500'
                }`}
                style={{ width: `${health}%` }}
              />
            </div>
          </div>
        </div>

        {/* Oleada y Kills */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="bg-neutral-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-neutral-700/60 shadow-lg flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-neutral-400 font-medium hidden sm:inline">OLEADA</span>
            <span className="text-sm sm:text-base font-bold text-cyan-300 font-mono">#{wave}</span>
          </div>

          <div className="bg-neutral-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-neutral-700/60 shadow-lg flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-neutral-400 font-medium hidden sm:inline">BAJAS</span>
            <span className="text-sm sm:text-base font-bold text-amber-300 font-mono">{kills}</span>
          </div>
        </div>
      </div>

      {/* Controles rápidos (Esquina superior derecha flotante): Aimlock, Bestiario, Cámara, Sonido */}
      <div className="absolute top-20 right-4 flex flex-col gap-2 z-10 items-end">
        {/* Botón interactivo de Aimlock */}
        <button
          onClick={() => stateRef.current.toggleAimLock?.()}
          className={`px-3 py-1.5 rounded-xl border backdrop-blur-md transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
            isAimLockActive
              ? 'bg-red-500/25 text-red-300 border-red-500 shadow-[0_0_14px_rgba(239,68,68,0.5)] animate-pulse'
              : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 border-neutral-700/60'
          }`}
          title="Fijar objetivo automáticamente (Presiona E o mantén Clic Derecho)"
        >
          <Target className={`w-3.5 h-3.5 ${isAimLockActive ? 'text-red-400' : 'text-neutral-400'}`} />
          <span>AIMLOCK {isAimLockActive ? 'ACTIVO' : '[E]'}</span>
        </button>

        {/* Botón de Bestiario / Guía de Zombies */}
        <button
          onClick={() => setShowBestiary(true)}
          className="px-3 py-1.5 rounded-xl border border-neutral-700/60 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 text-xs font-bold backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
          title="Ver Guía y Tipos de Mutaciones Zombie"
        >
          <Skull className="w-3.5 h-3.5 text-emerald-400" />
          <span>ZOMBIES</span>
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl border border-neutral-700/60 backdrop-blur-md transition-colors cursor-pointer"
            title={soundEnabled ? 'Silenciar Efectos' : 'Activar Efectos'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-neutral-500" />}
          </button>

          <button
            onClick={() => {
              const next = cameraMode === 'normal' ? 'close' : cameraMode === 'close' ? 'far' : 'normal';
              setCameraMode(next);
            }}
            className="px-2.5 py-1.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold rounded-xl border border-neutral-700/60 backdrop-blur-md transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Distancia de cámara en 3ª persona"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="capitalize">{cameraMode}</span>
          </button>
        </div>
      </div>

      {/* Alerta de Mutación Peligrosa Detectada */}
      {enemyAlert && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-neutral-950/95 border border-red-500/80 px-4 py-2 rounded-full shadow-[0_0_24px_rgba(239,68,68,0.5)] flex items-center gap-2.5 z-20 animate-bounce pointer-events-none">
          <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase text-red-300">
            ¡MUTACIÓN: <span className="text-white underline">{enemyAlert.name}</span>!
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${enemyAlert.color}`}>
            {enemyAlert.badge}
          </span>
        </div>
      )}

      {/* Notificación de Oleada */}
      {waveNotification && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-amber-500/90 text-neutral-950 font-black tracking-wider px-6 py-2 rounded-full shadow-2xl animate-bounce pointer-events-none z-10">
          {waveNotification}
        </div>
      )}

      {/* Notificación de Cambio de Arma */}
      {weaponNotification && (
        <div className="absolute top-36 left-1/2 -translate-x-1/2 bg-neutral-900/90 text-amber-300 font-bold border border-amber-500/50 text-xs px-4 py-1.5 rounded-full shadow-xl pointer-events-none z-10 animate-fade-in flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>{weaponNotification}</span>
        </div>
      )}

      {/* Modal Bestiario de Mutaciones Zombie */}
      {showBestiary && (
        <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4 z-30 animate-fadeIn">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Skull className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white tracking-wide">
                  GUÍA DE MUTACIONES ZOMBIE
                </h3>
              </div>
              <button
                onClick={() => setShowBestiary(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {Object.values(ZOMBIE_TYPES).map((z) => (
                <div
                  key={z.type}
                  className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-3.5 flex flex-col gap-2 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-neutral-100">{z.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${z.color}`}>
                      {z.badge}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {z.description}
                  </p>

                  <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-neutral-800/80 text-[11px] font-mono">
                    <div className="bg-neutral-900/90 rounded px-1.5 py-1 text-center">
                      <span className="text-neutral-500 text-[9px] block">SALUD</span>
                      <span className="font-bold text-neutral-200">{z.baseHealth} HP</span>
                    </div>
                    <div className="bg-neutral-900/90 rounded px-1.5 py-1 text-center">
                      <span className="text-neutral-500 text-[9px] block">VELOCIDAD</span>
                      <span className="font-bold text-cyan-400">{z.baseSpeed} m/s</span>
                    </div>
                    <div className="bg-neutral-900/90 rounded px-1.5 py-1 text-center">
                      <span className="text-neutral-500 text-[9px] block">DAÑO</span>
                      <span className="font-bold text-red-400">{z.damage}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-neutral-950/90 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-400 flex items-start gap-2">
              <span className="text-amber-400 font-bold">CONSEJO TÁCTICO:</span>
              <span>
                Activa el <b className="text-red-400">Aimlock [E]</b> para priorizar a los <b>Corredores</b> veloces antes de que te alcancen, y usa el <b>Lanzacohetes [4]</b> contra los <b>Brutos Blindados</b>. ¡Cuidado con la explosión de los <b>Tóxicos</b>!
              </span>
            </div>
          </div>
        </div>
      )}

      {/* HUD de Arma Actual en Pantalla (Esquina inferior derecha) */}
      <div className="absolute bottom-4 right-4 bg-neutral-900/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-neutral-700/60 shadow-xl flex items-center gap-3 z-10 pointer-events-none">
        <div className="flex flex-col text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            {WEAPONS[currentWeaponId]?.category || 'Arma'}
          </span>
          <span className="text-xs sm:text-sm font-bold text-neutral-100">
            {WEAPONS[currentWeaponId]?.name}
          </span>
        </div>
        <div className="w-9 h-9 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center font-mono font-bold text-sm text-amber-400">
          {WEAPONS[currentWeaponId]?.keyNum}
        </div>
      </div>

      {/* Indicador de bloqueo de cursor / Instrucción de clic */}
      {!isPointerLocked && !isGameOver && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md border border-neutral-700 px-5 py-2 rounded-full text-xs text-neutral-300 flex items-center gap-2.5 shadow-xl z-10">
          <Crosshair className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Haz clic en la ventana para apuntar con el cursor</span>
        </div>
      )}

      {/* Guía rápida de controles en el HUD inferior izquierdo con Aimlock */}
      <div className="absolute bottom-4 left-4 bg-neutral-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-neutral-800/80 text-[11px] text-neutral-400 hidden md:flex items-center gap-2.5 z-10">
        <span><b className="text-neutral-200">WASD</b> Mover</span>
        <span>•</span>
        <span><b className="text-neutral-200">Clic Izq</b> Disparar</span>
        <span>•</span>
        <span><b className="text-red-400 font-bold">E / Clic Der</b> Aimlock</span>
        <span>•</span>
        <span><b className="text-amber-400 font-bold">1-7</b> Armas</span>
        <span>•</span>
        <span><b className="text-neutral-200">Espacio</b> Saltar / QTE</span>
      </div>

      {/* Pantalla Modal de Game Over */}
      {isGameOver && (
        <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-600/50 flex items-center justify-center text-red-500 mb-4 shadow-[0_0_25px_rgba(220,38,38,0.4)]">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-red-500 tracking-wider mb-2 font-mono">
            HAS SIDO ELIMINADO
          </h2>
          <p className="text-neutral-400 text-sm max-w-sm mb-6">
            Los zombies han superado tus defensas. Prepárate para la revancha y supera tu récord.
          </p>

          <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-6">
            <div className="bg-neutral-900/80 border border-neutral-800 p-3 rounded-xl">
              <span className="text-xs text-neutral-500 font-semibold block">OLEADA ALCANZADA</span>
              <span className="text-2xl font-bold font-mono text-cyan-400">#{wave}</span>
            </div>
            <div className="bg-neutral-900/80 border border-neutral-800 p-3 rounded-xl">
              <span className="text-xs text-neutral-500 font-semibold block">ZOMBIES MUERTOS</span>
              <span className="text-2xl font-bold font-mono text-amber-400">{kills}</span>
            </div>
          </div>

          <button
            onClick={() => {
              // Dispara reinicio al pulsar el botón o teclear R
              const event = new KeyboardEvent('keydown', { key: 'r' });
              window.dispatchEvent(event);
            }}
            className="px-6 py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-red-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reiniciar Partida (Presiona R)
          </button>
        </div>
      )}
    </div>

    {/* Selector de Armas interactivo en el HUD */}
    <WeaponSelector
      currentWeapon={currentWeaponId}
      onSelectWeapon={(wId) => {
        stateRef.current.changeWeapon(wId);
      }}
    />
  </div>
  );
};
