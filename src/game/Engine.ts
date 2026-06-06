import * as THREE from "three";
import { PlayerStats, WeaponConfig, Zombie, BulletTrace, HitMarker, PowerUpDrop, InteractiveObject } from "../types";
import { sfx } from "../sound";
import { WEAPONS_DATABASE, PERKS_DATABASE, MAPS, getPackAPunchedWeapon, STARTING_WEAPON_ID, MapDefinition } from "./MapConfig";

export class GameEngine {
  private container: HTMLDivElement;
  private mapDef: MapDefinition;
  private onStatsUpdate: (stats: PlayerStats) => void;
  private onPromptUpdate: (prompt: string | null) => void;
  
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private gunMesh!: THREE.Group;
  private muzzleFlash!: THREE.PointLight;
  private muzzleFlashMesh!: THREE.Group;
  private dustParticles!: THREE.Points;
  private bloodParticles: { mesh: THREE.Points, velocities: Float32Array, life: number }[] = [];
  private gibs: { mesh: THREE.Mesh, velocity: THREE.Vector3, life: number, rotSpeed: THREE.Vector3 }[] = [];
  private renderer!: THREE.WebGLRenderer;
  private clock!: THREE.Clock;
  private animationFrameId: number | null = null;
  private isDestroyed = false;

  private floorTexture!: THREE.CanvasTexture;
  private wallTexture!: THREE.CanvasTexture;

  private stats: PlayerStats = {
    points: 500, health: 100, maxHealth: 100, round: 1, kills: 0, headshots: 0,
    perks: [], weapons: [{ ...WEAPONS_DATABASE[STARTING_WEAPON_ID] }],
    currentWeaponIndex: 0, isPowerOn: false, isDead: false, isADS: false
  };

  private playerPos = new THREE.Vector3(0, 1.0, 10); // Start outside PaP
  private playerVelocity = new THREE.Vector3();
  private yaw = 0.0; private pitch = 0.0; private targetPitchRecoil = 0.0;
  private bobTime = 0.0;
  private cameraHeight = 1.65;
  private isADS = false; 
  private isSprinting = false;
  private isTriggerDown = false;
  private lastFireTime = 0;
  private isReloading = false;
  private heartbeatTimer = 0;
  private ambientEventTimer = 0;
  private reloadTimeoutId: any = null;
  private stamina = 100.0;
  private keys: { [key: string]: boolean } = {};
  private lastPointerLockExitTime = 0;

  private zombiesList: Zombie[] = [];
  private bulletTraces: BulletTrace[] = [];
  private hitMarkers: HitMarker[] = [];
  private powerupsList: PowerUpDrop[] = [];
  private interactives: InteractiveObject[] = [];
  private doorMeshes: { [id: string]: THREE.Mesh } = {};
  private barrierState: { [id: string]: { planks: number; meshes: THREE.Mesh[] } } = {};
  private repairTimer = 0.0;
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private packAPunchMesh!: THREE.Group;
  private papCrystal!: THREE.Mesh;

  // Mystery Box Visual and Logic state
  private mysteryBoxGroup: THREE.Group | null = null;
  private mysteryBoxLidGroup: THREE.Group | null = null;
  private mysteryBoxLight: THREE.PointLight | null = null;
  private mysteryBoxState: "idle" | "rolling" | "ready" = "idle";
  private mysteryBoxWeaponIdOnOffer: string | null = null;
  private mysteryBoxRollTimer = 0.0;
  private mysteryBoxCycleTimer = 0.0;
  private mysteryBoxRollDuration = 2.5;
  private mysteryBoxWaitingTimer = 0.0;
  private mysteryBoxWaitingDuration = 10.0;
  private mysteryBoxFloatingGroup: THREE.Group | null = null;

  // Power switch animation refs
  private powerSwitchLeverGroup: THREE.Group | null = null;
  private powerIndicatorLightMesh: THREE.Mesh | null = null;

  private powerupTimers = { insta_kill: 0, double_points: 0 };
  private isRoundTransition = false;
  private roundCooldownRemaining = 5000;
  private zombiesRemainingToSpawn = 0;
  private zombieMaxHealthThisRound = 60;
  private zombieSpeedThisRound = 1.2;
  private zombieSpawnTimer = 0;
  private muzzleFlashTimer = 0;
  private flashlight!: THREE.SpotLight;
  private timeSinceLastDamage = 0.0;

  private zombieMaterialBody = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.8 });
  private zombieMaterialHead = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });

  constructor(
    container: HTMLDivElement,
    selectedMap: string,
    onStatsUpdate: (stats: PlayerStats) => void,
    onPromptUpdate: (prompt: string | null) => void
  ) {
    this.container = container;
    this.mapDef = MAPS[selectedMap] || MAPS["town"];
    this.playerPos = new THREE.Vector3(this.mapDef.playerStartPos.x, this.mapDef.playerStartPos.y, this.mapDef.playerStartPos.z);
    this.onStatsUpdate = onStatsUpdate; 
    this.onPromptUpdate = onPromptUpdate;
    this.initThree();
    this.initEnvironment();
    this.setupInputs();
    this.startRound(1);
    this.animate();
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);

    // Clean up particles
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      if (Array.isArray(p.mesh.material)) {
        p.mesh.material.forEach(m => m.dispose());
      } else {
        p.mesh.material.dispose();
      }
    });
    this.particles = [];

    // Clean up barriers
    Object.values(this.barrierState).forEach(state => {
      state.meshes.forEach(m => {
        this.scene.remove(m);
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach(mat => mat.dispose());
        } else {
          m.material.dispose();
        }
      });
    });
    this.barrierState = {};
  }

  private initThree() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.mapDef.fogColor);
    // Increase fog density for ambient horror effect, thick and claustrophobic
    this.scene.fog = new THREE.FogExp2(this.mapDef.fogColor, 0.045); 

    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100);
    
    // Add gun to camera
    this.gunMesh = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 })
    );
    barrel.position.set(0.2, -0.2, -0.6); // slight offset from center
    
    // Muzzle Flash Light
    this.muzzleFlash = new THREE.PointLight(0xffaa00, 0, 5);
    this.muzzleFlash.position.set(0, 0, -0.45); // Attach to end of barrel
    barrel.add(this.muzzleFlash);
    
    // Volumetric 3D Muzzle Flash Particle System
    this.muzzleFlashMesh = new THREE.Group();
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    // Core glow sphere
    const coreGeom = new THREE.SphereGeometry(0.12, 8, 8);
    const coreMesh = new THREE.Mesh(coreGeom, flashMat);
    this.muzzleFlashMesh.add(coreMesh);
    
    // 6-point star explosion using cones
    const coneGeom = new THREE.ConeGeometry(0.06, 0.4, 4);
    coneGeom.translate(0, 0.2, 0); // Put base at origin
    for (let i = 0; i < 6; i++) {
        const cone = new THREE.Mesh(coneGeom, flashMat);
        cone.rotation.z = (Math.PI * 2 / 6) * i;
        this.muzzleFlashMesh.add(cone);
    }
    
    // Large forward spike
    const forwardCone = new THREE.Mesh(coneGeom, flashMat);
    forwardCone.rotation.x = -Math.PI / 2;
    forwardCone.scale.set(1.5, 2.5, 1.5);
    this.muzzleFlashMesh.add(forwardCone);
    
    this.muzzleFlashMesh.position.set(0, 0, -0.45); // Attach to end of barrel
    barrel.add(this.muzzleFlashMesh);
    
    this.gunMesh.add(barrel);
    this.camera.add(this.gunMesh);

    // High fidelity survival flashlight on player's tactical head or helmet, pointing where they look
    this.flashlight = new THREE.SpotLight(0xffffff, 4.0, 55, Math.PI / 4.5, 0.5, 1.0);
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.width = 1024;
    this.flashlight.shadow.mapSize.height = 1024;
    this.flashlight.shadow.camera.near = 0.5;
    this.flashlight.shadow.camera.far = 40;
    this.flashlight.shadow.bias = -0.001;
    const targetNode = new THREE.Object3D();
    targetNode.position.set(0, 0, -1);
    this.camera.add(targetNode);
    this.flashlight.target = targetNode;
    this.camera.add(this.flashlight);

    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock();
  }

  private generateNoiseTexture(size: number, baseColor: string, noiseFactor: number) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size * size * 0.5; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * noiseFactor})`;
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * noiseFactor})`;
      ctx.fillRect(x, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(20, 20);
    return tex;
  }

  private initEnvironment() {
    this.floorTexture = this.generateNoiseTexture(512, "#111111", 0.08);
    this.wallTexture = this.generateNoiseTexture(512, "#333333", 0.1);
    this.wallTexture.repeat.set(4, 2);

    // Improve lighting and shadows
    const ambientLight = new THREE.AmbientLight(this.mapDef.ambientLight, 0.4); 
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x7a8ebf, 0x111111, 0.5); // Sky color, ground color, intensity
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(this.mapDef.dirLight, 0.85); 
    dirLight.position.set(20, 40, -20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // Floor (Dark burned asphalt)
    const floorGeo = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: this.mapDef.floorColor,
      map: this.floorTexture,
      roughness: 0.8,
      metalness: 0.1
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Render Lava Zones (Glowing fiery pits from BO2 Town)
    this.mapDef.lavaZones.forEach((lz) => {
      const lavaGeo = new THREE.CircleGeometry(lz.radius, 32);
      const lavaMat = new THREE.MeshStandardMaterial({ 
        color: 0xff4400, 
        emissive: 0xff2200,
        emissiveIntensity: 0.8,
        transparent: true, 
        opacity: 0.9,
        roughness: 0.3
      });
      const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
      lavaMesh.rotation.x = -Math.PI / 2;
      lavaMesh.position.set(lz.x, 0.03, lz.z);
      this.scene.add(lavaMesh);
      
      const lavaLight = new THREE.PointLight(0xff4400, 4.0, lz.radius * 3.0);
      lavaLight.position.set(lz.x, 2, lz.z);
      this.scene.add(lavaLight);
    });

    // Walls (Buildings like Bank, Bar, Auto shop)
    this.mapDef.walls.forEach((wall) => {
      if (wall.isWindow) return; // Skip rendering static window planks; we will render dynamic reformable board planks!
      const wallMat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(wall.color),
        map: this.wallTexture,
        roughness: 0.9,
        metalness: 0.05
      });
      const wallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(wall.width, wall.height, wall.depth),
        wallMat
      );
      wallMesh.position.set(wall.x, wall.height / 2, wall.z);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.scene.add(wallMesh);
    });

    // Spawn immersive street lamps with downwards spotlighting and volumetric cone glows
    if (this.mapDef.id === "town") {
      this.createStreetLamp(-10, -5);
      this.createStreetLamp(10, 5);
      this.createStreetLamp(-5, 10);
      this.createStreetLamp(5, -15);
    } else if (this.mapDef.id === "one_window") {
      this.createStreetLamp(-6, -6);
      this.createStreetLamp(6, 6);
      this.createStreetLamp(0, -8.5); // Positioned directly over the repairable window break!
    }

    // Interactives
    this.interactives = this.mapDef.interactives.map((io) => ({ ...io }));
    this.interactives.forEach((io) => {
      const geo = new THREE.BoxGeometry(io.size[0], io.size[1], io.size[2]);
      let mat: THREE.Material = new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: true });

      if (io.type === "door") {
        mat = new THREE.MeshStandardMaterial({ color: 0x4a2a12, roughness: 1.0, metalness: 0, map: this.wallTexture });
      } else if (io.type === "pack_a_punch") {
        // A.E.S.I.R. Pack-a-punch highly detailed Victorian model
        this.packAPunchMesh = new THREE.Group();

        const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, metalness: 0.9, roughness: 0.15 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, metalness: 0.85, roughness: 0.3 });
        const copperMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.1 });
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0xec4899,
          emissive: 0xec4899,
          emissiveIntensity: 2.0,
          roughness: 0.1
        });

        // 1. Heavy Victorian Cast Steel Pedestal/Base Cabinet
        const baseCabinetGeo = new THREE.BoxGeometry(io.size[0], io.size[1] * 0.45, io.size[2]);
        const baseCabinet = new THREE.Mesh(baseCabinetGeo, steelMat);
        baseCabinet.position.y = (io.size[1] * 0.45) / 2;
        this.packAPunchMesh.add(baseCabinet);

        // Heavy Base ornamental trim
        const trimGeo = new THREE.BoxGeometry(io.size[0] * 1.05, 0.12, io.size[2] * 1.05);
        const trimMesh = new THREE.Mesh(trimGeo, bronzeMat);
        trimMesh.position.y = 0.06;
        this.packAPunchMesh.add(trimMesh);

        // 2. Brass Upper Housing Frame
        const housingGeo = new THREE.BoxGeometry(io.size[0] * 0.9, io.size[1] * 0.45, io.size[2] * 0.9);
        const housing = new THREE.Mesh(housingGeo, bronzeMat);
        housing.position.y = (io.size[1] * 0.45) + (io.size[1] * 0.45) / 2;
        this.packAPunchMesh.add(housing);

        // 3. Central Weapon Slot Insert
        const slotGeo = new THREE.BoxGeometry(io.size[0] * 0.7, 0.16, io.size[2] * 0.1);
        const slotMesh = new THREE.Mesh(slotGeo, steelMat);
        slotMesh.position.set(0, io.size[1] * 0.6, io.size[2] * 0.44);
        this.packAPunchMesh.add(slotMesh);

        // Glowing slot rim
        const glowRimGeo = new THREE.BoxGeometry(io.size[0] * 0.65, 0.03, 0.03);
        const glowRim = new THREE.Mesh(glowRimGeo, glowMat);
        glowRim.position.set(0, io.size[1] * 0.6, io.size[2] * 0.491);
        this.packAPunchMesh.add(glowRim);

        // 4. Heavy Copper Pipelines (coiling vertically on both sides)
        const leftPipeGeo = new THREE.CylinderGeometry(0.04, 0.04, io.size[1] * 0.7, 8);
        const leftPipe = new THREE.Mesh(leftPipeGeo, copperMat);
        leftPipe.position.set(-io.size[0] * 0.45, io.size[1] * 0.45, 0);
        this.packAPunchMesh.add(leftPipe);

        const rightPipeGeo = new THREE.CylinderGeometry(0.04, 0.04, io.size[1] * 0.7, 8);
        const rightPipe = new THREE.Mesh(rightPipeGeo, copperMat);
        rightPipe.position.set(io.size[0] * 0.45, io.size[1] * 0.45, 0);
        this.packAPunchMesh.add(rightPipe);

        const topCrossoverPipeGeo = new THREE.CylinderGeometry(0.03, 0.03, io.size[0] * 0.9, 8);
        const topPipe = new THREE.Mesh(topCrossoverPipeGeo, copperMat);
        topPipe.rotation.z = Math.PI / 2;
        topPipe.position.set(0, io.size[1] * 0.8, 0);
        this.packAPunchMesh.add(topPipe);

        // 5. Classic Brass Pressure Dials
        for (let i = -1; i <= 1; i += 2) {
          const dialGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12);
          const dial = new THREE.Mesh(dialGeo, bronzeMat);
          dial.rotation.x = Math.PI / 2;
          dial.position.set(i * 0.25, io.size[1] * 0.7, io.size[2] * 0.46);
          this.packAPunchMesh.add(dial);

          const dialGlassGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.01, 12);
          const dialGlassMat = new THREE.MeshBasicMaterial({ color: i > 0 ? 0xccffaa : 0xffaacc });
          const glass = new THREE.Mesh(dialGlassGeo, dialGlassMat);
          glass.rotation.x = Math.PI / 2;
          glass.position.set(i * 0.25, io.size[1] * 0.7, io.size[2] * 0.481);
          this.packAPunchMesh.add(glass);
        }

        // 6. Glowing floating Aether Crystal inside the Reactor Core
        const chamberGeo = new THREE.BoxGeometry(io.size[0] * 0.45, io.size[1] * 0.2, io.size[2] * 0.45);
        const chamberMesh = new THREE.Mesh(chamberGeo, steelMat);
        chamberMesh.position.y = io.size[1] * 0.95;
        this.packAPunchMesh.add(chamberMesh);

        const crystalGeo = new THREE.OctahedronGeometry(0.14, 0);
        this.papCrystal = new THREE.Mesh(crystalGeo, glowMat);
        this.papCrystal.position.y = io.size[1] * 1.05;
        this.packAPunchMesh.add(this.papCrystal);

        // Glowing Point light for dark environments
        const papLight = new THREE.PointLight(0xec4899, 4, 8);
        papLight.position.y = io.size[1] * 1.05;
        this.packAPunchMesh.add(papLight);

        this.packAPunchMesh.position.set(io.position[0], 0, io.position[2]);
        this.scene.add(this.packAPunchMesh);
      } else if (io.type === "perk") {
        const pDb = io.extraId ? PERKS_DATABASE[io.extraId] : null;

        // Better perk machine model
        const perkGroup = new THREE.Group();
        perkGroup.position.set(io.position[0], io.position[1], io.position[2]);

        const bodyMat = new THREE.MeshStandardMaterial({ color: pDb ? pDb.lightColor : 0x111111, roughness: 0.7, metalness: 0.1 });
        const bodyGeo = new THREE.CylinderGeometry(io.size[0]/2, io.size[0]/2, io.size[1], 16);
        const bMesh = new THREE.Mesh(bodyGeo, bodyMat);
        perkGroup.add(bMesh);

        const topGeo = new THREE.SphereGeometry(io.size[0]/1.8, 16, 16);
        const topMat = new THREE.MeshBasicMaterial({ color: pDb ? pDb.lightColor : 0x111111 });
        const tMesh = new THREE.Mesh(topGeo, topMat);
        tMesh.position.y = io.size[1]/2;
        perkGroup.add(tMesh);

        // Add a glowing point light for the perk
        if (pDb) {
          const l = new THREE.PointLight(pDb.lightColor, 1.5, 4);
          l.position.set(0, io.size[1]/2 + 0.5, 0);
          perkGroup.add(l);
        }
        
        this.scene.add(perkGroup);

        // Map as door invisible proxy for raycasts / interactions
        mat = new THREE.MeshBasicMaterial({ visible: false });
      } else if (io.type === "barrier") {
        this.barrierState[io.id] = {
          planks: 6,
          meshes: []
        };
        this.syncBarrierMeshes(io);
        mat = new THREE.MeshBasicMaterial({ visible: false });
      } else if (io.type === "wallbuy") {
        const wallbuyModel = this.createWallbuyModel(io);
        this.scene.add(wallbuyModel);
        mat = new THREE.MeshBasicMaterial({ visible: false });
      } else if (io.type === "power") {
        const switchGroup = new THREE.Group();
        switchGroup.position.set(io.position[0], io.position[1], io.position[2]);

        const steelMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.85, roughness: 0.3 });
        const copperMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.2 });
        const leverOffMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.3, roughness: 0.6 });

        // Power cabinet box
        const boxGeo = new THREE.BoxGeometry(io.size[0], io.size[1], io.size[2]);
        const boxMesh = new THREE.Mesh(boxGeo, steelMat);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        switchGroup.add(boxMesh);

        // Decorative conduit pipes
        const pipeCylinder = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
        const topPipe = new THREE.Mesh(pipeCylinder, copperMat);
        topPipe.position.set(0, io.size[1] / 2 + 0.25, 0);
        switchGroup.add(topPipe);

        const bottomPipe = new THREE.Mesh(pipeCylinder, copperMat);
        bottomPipe.position.set(0, -io.size[1]/2 - 0.25, 0);
        switchGroup.add(bottomPipe);

        // Switch Lever pivot
        const leverPivot = new THREE.Group();
        leverPivot.position.set(0, 0, io.size[2]/2 + 0.01);
        
        const armGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
        const armMesh = new THREE.Mesh(armGeo, copperMat);
        armMesh.position.y = -0.15; // initially points down
        leverPivot.add(armMesh);

        const knobGeo = new THREE.SphereGeometry(0.06, 12, 12);
        const knobMesh = new THREE.Mesh(knobGeo, leverOffMat);
        knobMesh.position.y = -0.3;
        leverPivot.add(knobMesh);

        this.powerSwitchLeverGroup = leverPivot;
        switchGroup.add(leverPivot);

        // Small indicator light
        const indicatorGeo = new THREE.SphereGeometry(0.04, 8, 8);
        this.powerIndicatorLightMesh = new THREE.Mesh(indicatorGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
        this.powerIndicatorLightMesh.position.set(-io.size[0] * 0.3, io.size[1] * 0.3, io.size[2]/2 + 0.015);
        switchGroup.add(this.powerIndicatorLightMesh);

        // Orient power switch to point inward from the building wall it is attached to!
        const isFacingZ = io.size[0] > io.size[2];
        if (isFacingZ) {
          if (io.position[2] > 0) {
            switchGroup.rotation.y = Math.PI; // mount on South wall facing North
          } else {
            switchGroup.rotation.y = 0; // mount on North wall facing South
          }
        } else {
          if (io.position[0] > 0) {
            switchGroup.rotation.y = -Math.PI / 2; // mount on East wall facing West
          } else {
            switchGroup.rotation.y = Math.PI / 2; // mount on West wall facing East
          }
        }

        this.scene.add(switchGroup);
        mat = new THREE.MeshBasicMaterial({ visible: false });
      } else if (io.type === "mystery_box") {
        this.mysteryBoxGroup = new THREE.Group();
        this.mysteryBoxGroup.position.set(io.position[0], io.position[1], io.position[2]);

        const woodMat = new THREE.MeshStandardMaterial({ color: 0x422006, roughness: 0.9, metalness: 0.0 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4 });
        const glowingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

        // Base Chest
        const baseGeo = new THREE.BoxGeometry(io.size[0], 0.5, io.size[2]);
        const baseMesh = new THREE.Mesh(baseGeo, woodMat);
        baseMesh.position.y = 0.25;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        this.mysteryBoxGroup.add(baseMesh);

        // Straps
        const strapWidth = 0.12;
        const topStrapGeo = new THREE.BoxGeometry(io.size[0] + 0.02, 0.05, io.size[2] + 0.02);
        const topStrap = new THREE.Mesh(topStrapGeo, steelMat);
        topStrap.position.y = 0.48;
        this.mysteryBoxGroup.add(topStrap);

        for (let xOffset of [-io.size[0]/2, io.size[0]/2]) {
          for (let zOffset of [-io.size[2]/2, io.size[2]/2]) {
            const cornerStrapGeo = new THREE.BoxGeometry(strapWidth, 0.5, strapWidth);
            const strap = new THREE.Mesh(cornerStrapGeo, steelMat);
            strap.position.set(xOffset * 0.98, 0.25, zOffset * 0.98);
            this.mysteryBoxGroup.add(strap);
          }
        }

        // Decor runes representing question marks
        for (let xSign of [-0.5, 0.5]) {
          const runeGeo = new THREE.SphereGeometry(0.12, 8, 8);
          const rune = new THREE.Mesh(runeGeo, glowingMat);
          rune.position.set(xSign * 0.8, 0.25, io.size[2]/2 + 0.01);
          this.mysteryBoxGroup.add(rune);

          const runeTopGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 8);
          const runeTop = new THREE.Mesh(runeTopGeo, glowingMat);
          runeTop.position.set(xSign * 0.8, 0.35, io.size[2]/2 + 0.01);
          runeTop.rotation.x = Math.PI / 2;
          this.mysteryBoxGroup.add(runeTop);
        }

        // Lid
        this.mysteryBoxLidGroup = new THREE.Group();
        this.mysteryBoxLidGroup.position.set(0, 0.5, -io.size[2]/2);

        const lidGeo = new THREE.BoxGeometry(io.size[0] * 1.02, 0.25, io.size[2] * 1.02);
        const lidMesh = new THREE.Mesh(lidGeo, woodMat);
        lidMesh.position.set(0, 0.125, io.size[2]/2);
        lidMesh.castShadow = true;
        this.mysteryBoxLidGroup.add(lidMesh);

        const lidStrapGeo = new THREE.BoxGeometry(io.size[0] * 1.04, 0.06, strapWidth);
        for (let zFrac of [0.1, 0.9]) {
          const strap = new THREE.Mesh(lidStrapGeo, steelMat);
          strap.position.set(0, 0.125, io.size[2] * zFrac);
          this.mysteryBoxLidGroup.add(strap);
        }

        this.mysteryBoxGroup.add(this.mysteryBoxLidGroup);
        
        this.mysteryBoxLight = new THREE.PointLight(0x38bdf8, 0, 6);
        this.mysteryBoxLight.position.set(0, 0.6, 0);
        this.mysteryBoxGroup.add(this.mysteryBoxLight);

        this.scene.add(this.mysteryBoxGroup);
        mat = new THREE.MeshBasicMaterial({ visible: false });
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(io.position[0], io.position[1], io.position[2]);
      
      if (io.type === "door") this.doorMeshes[io.id] = mesh;
      if (io.type !== "pack_a_punch" && io.type !== "perk") {
        this.scene.add(mesh);
      }
    });

    // Subtle Ambient Glows scattered around the map
    const glowColors = [0x550000, 0x001155, 0x113311, 0x221144];
    for (let i = 0; i < 15; i++) {
        const clr = glowColors[Math.floor(Math.random() * glowColors.length)];
        const glow = new THREE.PointLight(clr, 1.5, 12);
        glow.position.set((Math.random() - 0.5) * 40, 1.0 + Math.random() * 2, (Math.random() - 0.5) * 40);
        this.scene.add(glow);
    }

    // Ambient Dust Particle System
    const dustCount = 600;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
       dustPos[i * 3] = (Math.random() - 0.5) * 80;
       dustPos[i * 3 + 1] = Math.random() * 10;
       dustPos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
       color: 0x888888, size: 0.1, transparent: true, opacity: 0.35,
       depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.dustParticles = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustParticles);

    // Initial wind and ambient audio
    setTimeout(() => {
       sfx.startAmbientDrone();
       sfx.startAmbientWind();
    }, 1000);
  }

  // Bind inputs as arrow functions to preserve `this` for cleanup
  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    if ((e.code === "Tab" || e.code === "KeyQ") && !this.isADS) { e.preventDefault(); this.switchWeapon(); }
    if (e.code === "KeyE") this.performInteractAction();
    if (e.code === "KeyR") this.startReload();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys[e.code] = false; };
  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - e.movementY * 0.0022));
  };
  private onMouseDown = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.renderer.domElement) {
      const now = Date.now();
      if (now - this.lastPointerLockExitTime < 1200) {
        console.warn("Suppressing requestPointerLock inside Engine due to cooldown.");
        return;
      }
      try {
        const promise = this.renderer.domElement.requestPointerLock() as any;
        if (promise && typeof promise.catch === "function") {
          promise.catch((err: any) => {
            console.warn("Pointer lock request was rejected in Engine:", err);
          });
        }
      } catch (err) {
        console.warn("Pointer lock request failed in Engine:", err);
      }
      sfx.init();
      return;
    }
    if (e.button === 0) {
      this.isTriggerDown = true;
      this.tryFire();
    }
    else if (e.button === 2) this.isADS = true;
  };
  private onMouseUp = (e: MouseEvent) => { 
    if (e.button === 2) this.isADS = false; 
    else if (e.button === 0) this.isTriggerDown = false;
  };
  private onPointerLockChange = () => {
    if (document.pointerLockElement !== this.renderer.domElement) {
      this.lastPointerLockExitTime = Date.now();
      this.onPromptUpdate("Click screen to lock cursor and play");
    } else {
      this.onPromptUpdate(null);
    }
  };

  private setupInputs() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.onPromptUpdate("Click screen to lock cursor and play");
  }

  // GAME LOOP
  private animate = () => {
    if (this.isDestroyed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);
    
    const dt = Math.min(this.clock.getDelta(), 0.1); // Cap delta to prevent huge jumps
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    if (this.stats.isDead) return;
    // Freeze all gameplay updates when game is paused or pointer lock is lost
    if (document.pointerLockElement !== this.renderer.domElement) return;

    this.updatePlayer(dt);
    this.updateZombies(dt);
    this.updateGameLogic(dt);

    // 2. Player-Zombie Collisions (solid entity blockages)
    this.zombiesList.forEach(z => {
      if (z.state === "dead") return;
      const pdx = this.playerPos.x - z.x;
      const pdz = this.playerPos.z - z.z;
      const pdist = Math.hypot(pdx, pdz);
      const minPdist = 0.82; // Player radius (approx 0.42) + Zombie radius (0.4)
      if (pdist < minPdist && pdist > 0) {
        const overlap = minPdist - pdist;
        this.playerPos.x += (pdx / pdist) * overlap;
        this.playerPos.z += (pdz / pdist) * overlap;
      }
    });

    // 3. Continuous Hold [E] Key Barrier Repair Handler
    let nearBarrier: InteractiveObject | null = null;
    this.interactives.forEach(io => {
      if (io.type === "barrier") {
        const dist = this.playerPos.distanceTo(new THREE.Vector3(io.position[0], io.position[1], io.position[2]));
        if (dist < 2.5) nearBarrier = io;
      }
    });

    if (nearBarrier && this.keys["KeyE"]) {
      const state = this.barrierState[nearBarrier.id];
      if (state && state.planks < 6) {
        this.repairTimer += dt;
        if (this.repairTimer >= 0.7) { // 0.7s per plank repaired
          state.planks++;
          this.syncBarrierMeshes(nearBarrier);
          sfx.playWoodBoardUp();
          this.stats.points += 10;
          this.onStatsUpdate({ ...this.stats });
          this.repairTimer = 0.0;
        }
      } else {
        this.repairTimer = 0.0;
      }
    } else {
      this.repairTimer = 0.0;
    }

    // 4. Update wood splinter debris physics
    this.particles = this.particles.filter(p => {
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= dt * 9.8; // gravity
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        if (Array.isArray(p.mesh.material)) {
          p.mesh.material.forEach(m => m.dispose());
        } else {
          p.mesh.material.dispose();
        }
        return false;
      }
      return true;
    });

    // Blood and Gibs Particle systems
    for (let i = this.bloodParticles.length - 1; i >= 0; i--) {
       const pb = this.bloodParticles[i];
       pb.life -= dt;
       if (pb.life <= 0) {
          this.scene.remove(pb.mesh);
          (pb.mesh.material as THREE.Material).dispose();
          pb.mesh.geometry.dispose();
          this.bloodParticles.splice(i, 1);
       } else {
          const positions = pb.mesh.geometry.attributes.position.array as Float32Array;
          for (let j = 0; j < pb.velocities.length; j += 3) {
             positions[j] += pb.velocities[j] * dt;
             positions[j+1] += pb.velocities[j+1] * dt;
             positions[j+2] += pb.velocities[j+2] * dt;
             pb.velocities[j+1] -= 9.8 * dt; // gravity
          }
          pb.mesh.geometry.attributes.position.needsUpdate = true;
          (pb.mesh.material as THREE.PointsMaterial).opacity = pb.life; // fade out
       }
    }
    
    for (let i = this.gibs.length - 1; i >= 0; i--) {
       const gib = this.gibs[i];
       gib.life -= dt;
       if (gib.life <= 0) {
          this.scene.remove(gib.mesh);
          (gib.mesh.material as THREE.Material).dispose();
          gib.mesh.geometry.dispose();
          this.gibs.splice(i, 1);
       } else {
          if (gib.mesh.position.y > 0.1) {
              gib.velocity.y -= 15 * dt; // strong gravity
              gib.mesh.position.x += gib.velocity.x * dt;
              gib.mesh.position.y += gib.velocity.y * dt;
              gib.mesh.position.z += gib.velocity.z * dt;
              gib.mesh.rotation.x += gib.rotSpeed.x * dt;
              gib.mesh.rotation.y += gib.rotSpeed.y * dt;
              gib.mesh.rotation.z += gib.rotSpeed.z * dt;
          } else {
              gib.mesh.position.y = 0.1;
              gib.velocity.set(0, 0, 0); // stop rolling
          }
          // shrink at end of life
          if (gib.life < 1.0) {
             const s = gib.life;
             gib.mesh.scale.set(s, s, s);
          }
       }
    }

    // Ambient Dust drift
    if (this.dustParticles) {
      this.dustParticles.rotation.y -= dt * 0.05;
      this.dustParticles.position.y = Math.sin(this.clock.getElapsedTime() * 0.2) * 2;
    }

    // Dynamic player health regeneration over time
    this.timeSinceLastDamage += dt;

    // Ambient threat and tension system
    let closestZombieDist = 1000;
    this.zombiesList.forEach(z => {
      if (z.state !== "dead") {
        const dist = Math.hypot(this.playerPos.x - z.x, this.playerPos.z - z.z);
        if (dist < closestZombieDist) closestZombieDist = dist;
      }
    });

    const isLowHealth = this.stats.health < this.stats.maxHealth * 0.4;
    const isThreatened = closestZombieDist < 10.0;
    
    // Play heartbeat 
    if (isLowHealth || isThreatened) {
       this.heartbeatTimer = (this.heartbeatTimer || 0) + dt;
       const bpm = isLowHealth ? 130 : 90;
       const interval = 60 / bpm;
       if (this.heartbeatTimer >= interval) {
           sfx.playHeartbeat();
           this.heartbeatTimer = 0;
       }
       // Camera anxiety sway
       this.yaw += (Math.random() - 0.5) * 0.002;
       this.pitch += (Math.random() - 0.5) * 0.002;
    }

    // Dynamic Drone tension scaling
    const tension = Math.max(
      isLowHealth ? 1.0 : 0, 
      Math.max(0, 1.0 - closestZombieDist / 20.0)
    );
    sfx.setAmbientDroneIntensity(tension);

    // Occasional Random Ambient events
    this.ambientEventTimer += dt;
    if (this.ambientEventTimer > 45) { // Try event every 45 secs
       if (Math.random() < 0.3) {
           sfx.playDistantScream();
       }
       this.ambientEventTimer = 0;
    }

    if (this.timeSinceLastDamage > 3.5 && this.stats.health < this.stats.maxHealth) {
      // Regenerate 35 health per second (approx. 3 seconds to recover fully)
      const healAmount = dt * 35;
      this.stats.health = Math.min(this.stats.maxHealth, Math.round(this.stats.health + healAmount));
      this.onStatsUpdate({ ...this.stats });
    }

    // Apply recoil recovery
    this.targetPitchRecoil = THREE.MathUtils.lerp(this.targetPitchRecoil, 0, dt * 6.0);
    
    // Set camera
    this.camera.position.copy(this.playerPos).setY(this.cameraHeight);
    const euler = new THREE.Euler(this.pitch + this.targetPitchRecoil, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    // Muzzle Flash Timer
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt * 1000;
      this.muzzleFlash.intensity = 2 + Math.random() * 2;
      
      const progress = Math.max(0, this.muzzleFlashTimer / 100);
      this.muzzleFlashMesh.children.forEach(c => {
         ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = progress;
      });

      if (this.muzzleFlashTimer <= 0) {
         this.muzzleFlash.intensity = 0;
         this.muzzleFlashMesh.children.forEach(c => {
            ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0;
         });
      }
    }

    // ADS
    const activeGun = this.getActiveWeapon();
    const targetFOV = this.isADS ? 75 * activeGun.adsZoom : 75;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, dt * 15.0);
    this.camera.updateProjectionMatrix();
    
    // Move Gun towards center when ADS
    const targetGunX = this.isADS ? 0 : 0.2;
    const targetGunY = this.isADS ? -0.1 : -0.2;
    this.gunMesh.children[0].position.x = THREE.MathUtils.lerp(this.gunMesh.children[0].position.x, targetGunX, dt * 15.0);
    this.gunMesh.children[0].position.y = THREE.MathUtils.lerp(this.gunMesh.children[0].position.y, targetGunY, dt * 15.0);
    
    // Update gun color
    if (this.gunMesh.children.length > 0) {
       ((this.gunMesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(parseInt(activeGun.color.replace('#', '0x')));
       
       if (activeGun.isPackAPunched) {
          ((this.gunMesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0x550055);
       } else {
          ((this.gunMesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
       }
    }

    // Animate Pack-a-Punch crystal rotation and hovering float
    if (this.papCrystal) {
      this.papCrystal.rotation.y += dt * 1.5;
      this.papCrystal.rotation.x += dt * 0.6;
      // Extract PaP base height from configurations or default to 1.5 height
      const papHeight = this.mapDef.interactives.find(io => io.type === "pack_a_punch")?.size[1] || 1.5;
      this.papCrystal.position.y = (papHeight * 1.05) + Math.sin(this.clock.getElapsedTime() * 3.5) * 0.05;
    }

    // Update Mystery Box visual animation state machine
    this.updateMysteryBox(dt);
  }

  private updateMysteryBox(dt: number) {
    if (!this.mysteryBoxGroup) return;

    if (this.mysteryBoxState === "rolling") {
      this.mysteryBoxRollTimer += dt;
      this.mysteryBoxCycleTimer += dt;

      // Rotate the floating weapon rapidly to indicate action!
      if (this.mysteryBoxFloatingGroup) {
         this.mysteryBoxFloatingGroup.rotation.y += dt * 4.0;
         // hover up and down slightly
         this.mysteryBoxFloatingGroup.position.y = 0.8 + Math.sin(this.mysteryBoxRollTimer * 10) * 0.15;
      }

      // Every 100ms, cycle to a random weapon visual to make it look incredibly dynamic!
      if (this.mysteryBoxCycleTimer >= 0.10) {
        this.mysteryBoxCycleTimer = 0;
        
        // Pick a random weapon visual (not starting weapon, just for show)
        const allWeps = Object.keys(WEAPONS_DATABASE).filter(id => id !== "colt_m1911");
        const cycleWep = allWeps[Math.floor(Math.random() * allWeps.length)];

        // Recreate the floating visual mesh!
        if (this.mysteryBoxFloatingGroup) {
          this.mysteryBoxGroup.remove(this.mysteryBoxFloatingGroup);
        }

        this.mysteryBoxFloatingGroup = new THREE.Group();
        this.mysteryBoxFloatingGroup.position.set(0, 0.8, 0); // floats over the box
        const gunModel = this.buildGunModelOnly(cycleWep);
        // orient nicely
        gunModel.rotation.y = Math.PI / 2;
        this.mysteryBoxFloatingGroup.add(gunModel);
        
        // Add a nice glowing light source with the floating gun!
        const gunLight = new THREE.PointLight(0x38bdf8, 2, 3);
        this.mysteryBoxFloatingGroup.add(gunLight);

        this.mysteryBoxGroup.add(this.mysteryBoxFloatingGroup);
        
        // Play rapid click sounds for the rolling wheel!
        sfx.playOutOfAmmo();
      }

      // Roll finishes!
      if (this.mysteryBoxRollTimer >= this.mysteryBoxRollDuration) {
        this.mysteryBoxState = "ready";
        this.mysteryBoxWaitingTimer = 0;

        // Finalise on the actual weapon
        if (this.mysteryBoxFloatingGroup) {
           this.mysteryBoxGroup.remove(this.mysteryBoxFloatingGroup);
        }

        const finalWepId = this.mysteryBoxWeaponIdOnOffer || "mp5";
        this.mysteryBoxFloatingGroup = new THREE.Group();
        this.mysteryBoxFloatingGroup.position.set(0, 0.9, 0); // sits stable and floats slightly
        const gunModel = this.buildGunModelOnly(finalWepId);
        gunModel.rotation.y = Math.PI / 2;
        this.mysteryBoxFloatingGroup.add(gunModel);

        // Bright green or pink magical highlight light inside the weapon!
        const highlightColor = finalWepId === "ray_gun" ? 0xdc2626 : 0xec4899;
        const gunLight = new THREE.PointLight(highlightColor, 4, 3);
        this.mysteryBoxFloatingGroup.add(gunLight);

        this.mysteryBoxGroup.add(this.mysteryBoxFloatingGroup);

        // Music tune jingle to celebrate!
        sfx.playPerkPurchase("speed_cola");
      }
    }
    else if (this.mysteryBoxState === "ready") {
      this.mysteryBoxWaitingTimer += dt;
      
      // Floating weapon rotates slowly and hovers on a wave
      if (this.mysteryBoxFloatingGroup) {
         this.mysteryBoxFloatingGroup.rotation.y += dt * 1.0;
         this.mysteryBoxFloatingGroup.position.y = 0.9 + Math.sin(this.mysteryBoxWaitingTimer * 3.0) * 0.08;
      }

      // Sinks back into the box if player doesn't pick it up in 10s
      if (this.mysteryBoxWaitingTimer >= this.mysteryBoxWaitingDuration) {
         this.mysteryBoxState = "idle";
         this.mysteryBoxWeaponIdOnOffer = null;

         // Close lid and dim light
         if (this.mysteryBoxLidGroup) {
           this.mysteryBoxLidGroup.rotation.x = 0;
         }
         if (this.mysteryBoxLight) {
           this.mysteryBoxLight.intensity = 0;
         }
         if (this.mysteryBoxFloatingGroup) {
           this.mysteryBoxGroup.remove(this.mysteryBoxFloatingGroup);
           this.mysteryBoxFloatingGroup = null;
         }
         sfx.playWoodTearDown(); // wood crash close/shut sound
      }
    }
  }

  private updatePlayer(dt: number) {
    if (this.isTriggerDown) {
      const gun = this.getActiveWeapon();
      if (gun.fireMode === "auto") {
        this.tryFire();
      }
    }

    const dir = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.yaw, 0));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.yaw, 0));

    if (this.keys["KeyW"]) dir.add(forward);
    if (this.keys["KeyS"]) dir.sub(forward);
    if (this.keys["KeyA"]) dir.sub(right);
    if (this.keys["KeyD"]) dir.add(right);
    dir.normalize();

    const isMoving = dir.lengthSq() > 0;
    
    // Sprint overrides ADS, or ADS overrides sprint?
    // Modern shooters: Sprint cancels ADS. We will say if holding sprint and moving, we can't ADS.
    this.isSprinting = this.keys["ShiftLeft"] && this.stamina > 0 && isMoving;
    
    if (this.isSprinting) {
      this.isADS = false; // Sprinting cancels ADS
    }

    // Update stats state for HUD
    if (this.stats.isADS !== this.isADS) {
      this.stats.isADS = this.isADS;
    }

    let speed = 3.5;
    if (this.isSprinting) {
      speed = 6.0;
    } else if (this.isADS) {
      speed = 2.0; // slower while aiming
    }

    // Check Lava Damage
    let inLava = false;
    this.mapDef.lavaZones.forEach(lz => {
      const dist = Math.hypot(this.playerPos.x - lz.x, this.playerPos.z - lz.z);
      if (dist < lz.radius) inLava = true;
    });

    if (inLava && Math.random() < 0.05) { // take burn damage
       this.damagePlayer(2);
    }

    if (isMoving) {
      if (this.isSprinting) {
        if (!this.stats.perks.includes("stamin_up")) this.stamina = Math.max(0, this.stamina - dt * 25);
      } else {
        this.stamina = Math.min(100, this.stamina + dt * 10);
      }
      this.playerPos.add(dir.multiplyScalar(speed * dt));
      this.resolveWallCollisions(this.playerPos, 0.4, false);
      
      // Advance bob time depending on speed
      this.bobTime += dt * (this.isSprinting ? 12 : 8);
    } else {
      this.stamina = Math.min(100, this.stamina + dt * 15);
      // smoothly bring bobBack to zero
      this.bobTime = THREE.MathUtils.lerp(this.bobTime, 0, dt * 10);
    }

    // Apply head bob to cameraHeight dynamically instead of fixed!
    const targetCameraHeight = 1.65 + Math.sin(this.bobTime) * (this.isSprinting ? 0.08 : 0.04) * (isMoving ? 1 : 0);
    this.cameraHeight = THREE.MathUtils.lerp(this.cameraHeight, targetCameraHeight, dt * 10);
  }

  private resolveWallCollisions(pos: THREE.Vector3, radius: number, isZombie: boolean = false) {
    this.mapDef.walls.forEach(wall => {
      if (wall.isWindow && isZombie) return; // Zombies can pass through windows

      const minX = wall.x - wall.width / 2; const maxX = wall.x + wall.width / 2;
      const minZ = wall.z - wall.depth / 2; const maxZ = wall.z + wall.depth / 2;
      const closestX = Math.max(minX, Math.min(pos.x, maxX));
      const closestZ = Math.max(minZ, Math.min(pos.z, maxZ));
      const dx = pos.x - closestX; const dz = pos.z - closestZ;
      const distSquared = dx * dx + dz * dz;
      
      if (distSquared === 0) {
        // Completely inside the wall! Push out to the closest edge.
        const distToMinX = pos.x - minX; const distToMaxX = maxX - pos.x;
        const distToMinZ = pos.z - minZ; const distToMaxZ = maxZ - pos.z;
        const minDist = Math.min(distToMinX, distToMaxX, distToMinZ, distToMaxZ);
        if (minDist === distToMinX) pos.x = minX - radius;
        else if (minDist === distToMaxX) pos.x = maxX + radius;
        else if (minDist === distToMinZ) pos.z = minZ - radius;
        else if (minDist === distToMaxZ) pos.z = maxZ + radius;
      } else if (distSquared < radius * radius) {
        const dist = Math.sqrt(distSquared);
        pos.x += (dx / dist) * (radius - dist);
        pos.z += (dz / dist) * (radius - dist);
      }
    });

    Object.values(this.interactives).forEach(io => {
       if (io.type === "door" && !io.isPurchased) {
          const minX = io.position[0] - io.size[0]/2; const maxX = io.position[0] + io.size[0]/2;
          const minZ = io.position[2] - io.size[2]/2; const maxZ = io.position[2] + io.size[2]/2;
          const closestX = Math.max(minX, Math.min(pos.x, maxX));
          const closestZ = Math.max(minZ, Math.min(pos.z, maxZ));
          const dx = pos.x - closestX; const dz = pos.z - closestZ;
          const distSquared = dx * dx + dz * dz;
          if (distSquared === 0) {
             const distToMinX = pos.x - minX; const distToMaxX = maxX - pos.x;
             const distToMinZ = pos.z - minZ; const distToMaxZ = maxZ - pos.z;
             const minDist = Math.min(distToMinX, distToMaxX, distToMinZ, distToMaxZ);
             if (minDist === distToMinX) pos.x = minX - radius;
             else if (minDist === distToMaxX) pos.x = maxX + radius;
             else if (minDist === distToMinZ) pos.z = minZ - radius;
             else if (minDist === distToMaxZ) pos.z = maxZ + radius;
          } else if (distSquared < radius * radius) {
             const dist = Math.sqrt(distSquared);
             pos.x += (dx / dist) * (radius - dist);
             pos.z += (dz / dist) * (radius - dist);
          }
       }
    });
  }

  private updateZombies(dt: number) {
    const now = Date.now();

    // 1. Zombie-Zombie collisions (pushing each other apart to prevent clump clipping)
    for (let i = 0; i < this.zombiesList.length; i++) {
      const z1 = this.zombiesList[i];
      if (z1.state === "dead") continue;
      for (let j = i + 1; j < this.zombiesList.length; j++) {
        const z2 = this.zombiesList[j];
        if (z2.state === "dead") continue;
        const cdx = z2.x - z1.x;
        const cdz = z2.z - z1.z;
        const cdist = Math.hypot(cdx, cdz);
        const minDist = 0.72; // zombie body diameter (approx 0.36 radius * 2)
        if (cdist < minDist && cdist > 0) {
          const overlap = minDist - cdist;
          const pushX = (cdx / cdist) * overlap * 0.5;
          const pushZ = (cdz / cdist) * overlap * 0.5;
          z1.x -= pushX;
          z1.z -= pushZ;
          z2.x += pushX;
          z2.z += pushZ;
        }
      }
    }

    this.zombiesList.forEach(z => {
      if (z.state === "dead") return;
      
      if (z.staggerDuration > 0) {
        z.staggerDuration -= dt * 1000;
        if (z.staggerDuration <= 0) z.state = "chasing";
        return;
      }

      // Check window barriers blocker
      let isBlockedByBarrier = false;
      const barrier = this.interactives.find(io => io.type === "barrier");
      if (barrier) {
        const state = this.barrierState[barrier.id];
        if (state && state.planks > 0) {
          // If zombie is behind the barrier (z.z < barrier_pos) and trying to cross into interior
          // barrier position is around z = -9.5, window x ranges from -1.5 to 1.5
          const windowZ = barrier.position[2];
          const windowX = barrier.position[0];
          const barrierRadiusX = 1.6;

          if (z.z < windowZ && Math.abs(z.x - windowX) < barrierRadiusX) {
            // Predict if moving forward passes the barrier
            const dx = this.playerPos.x - z.x;
            const dz = this.playerPos.z - z.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const nextZ = z.z + (dz / dist) * z.speed * dt;
            if (nextZ >= windowZ - 0.2) {
              isBlockedByBarrier = true;
              z.z = Math.min(z.z, windowZ - 0.25); // Clamp outside the window!

              // Accumulate tear down damage on planks
              if ((z as any).tearTimer === undefined) (z as any).tearTimer = 0;
              (z as any).tearTimer += dt;
              if ((z as any).tearTimer >= 2.0) { // 2 seconds per plank
                state.planks--;
                this.syncBarrierMeshes(barrier);
                sfx.playWoodTearDown();
                (z as any).tearTimer = 0;

                // Spawn cool dynamic wood splinter debris flying in!
                for (let i = 0; i < 8; i++) {
                  const pGeo = new THREE.BoxGeometry(0.08 + Math.random() * 0.1, 0.03, 0.03);
                  const pMat = new THREE.MeshBasicMaterial({ color: 0x8b5a2b });
                  const pMesh = new THREE.Mesh(pGeo, pMat);
                  pMesh.position.set(
                    barrier.position[0] + (Math.random() - 0.5) * 1.5,
                    barrier.position[1] + (Math.random() - 0.5) * 1.0,
                    barrier.position[2] + 0.1
                  );
                  this.scene.add(pMesh);
                  this.particles.push({
                    mesh: pMesh,
                    vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, 1.2 + Math.random() * 2), // Fly inside
                    life: 0.8
                  });
                }
              }
            }
          }
        }
      }

      const dx = this.playerPos.x - z.x;
      const dz = this.playerPos.z - z.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.4 && !isBlockedByBarrier) {
        if (now - z.lastAttackTime > 1200) {
          this.damagePlayer(z.damageValue);
          z.lastAttackTime = now;
        }
      } else if (!isBlockedByBarrier) {
        z.x += (dx / dist) * z.speed * dt;
        z.z += (dz / dist) * z.speed * dt;
        this.resolveWallCollisions(z as any as THREE.Vector3, 0.4, true); // Proxy cast
        
        // Basic mesh update
        if ((z as any).mesh) {
          (z as any).mesh.position.set(z.x, 0.05, z.z);
          (z as any).mesh.lookAt(this.playerPos.x, 0.05, this.playerPos.z);
        }
      } else {
        // blocked by barrier, still update rotation to face player
        if ((z as any).mesh) {
          (z as any).mesh.position.set(z.x, 0.05, z.z);
          (z as any).mesh.lookAt(this.playerPos.x, 0.05, this.playerPos.z);
        }
      }
    });
  }

  private damagePlayer(amount: number) {
    this.timeSinceLastDamage = 0.0;
    this.stats.health -= amount;
    sfx.playPlayerHurt();
    if (this.stats.health <= 0) {
      this.stats.isDead = true;
      document.exitPointerLock();
      sfx.playGameOver();
    }
    this.onStatsUpdate({ ...this.stats });
  }

  private updateGameLogic(dt: number) {
    if (this.powerupTimers.insta_kill > 0) this.powerupTimers.insta_kill -= dt * 1000;
    if (this.powerupTimers.double_points > 0) this.powerupTimers.double_points -= dt * 1000;

    if (this.isRoundTransition) {
      this.roundCooldownRemaining -= dt * 1000;
      if (this.roundCooldownRemaining <= 0) {
        this.startRound(this.stats.round + 1);
      }
    } else {
      if (this.zombiesRemainingToSpawn > 0) {
        this.zombieSpawnTimer -= dt * 1000;
        if (this.zombieSpawnTimer <= 0) {
          this.spawnSingleZombie();
          this.zombiesRemainingToSpawn--;
          this.zombieSpawnTimer = 1500;
        }
      }
    }
  }

  private startRound(round: number) {
    this.stats.round = round;
    this.isRoundTransition = false;
    this.zombiesRemainingToSpawn = Math.round(5 + Math.pow(round * 1.3, 1.8));
    this.zombieMaxHealthThisRound = Math.round(50 + Math.pow(round, 2.0) * 10);
    this.zombieSpeedThisRound = Math.min(4.0, 1.2 + (round - 1) * 0.2);
    sfx.playRoundStart();
    this.onStatsUpdate({ ...this.stats });
  }

  private spawnSingleZombie() {
    const spawns = this.mapDef.zombieSpawns;
    // If no zombie spawns are defined for this map, don't crash
    if (spawns.length === 0) return;
    const pt = spawns[Math.floor(Math.random() * spawns.length)];
    
    // Determine movement type based on round
    let r = Math.random();
    let type: "slow" | "normal" | "fast" | "crawler" = "normal";
    let speedMult = 1.0;
    const round = this.stats.round;
    
    let chanceSlow = 0, chanceNormal = 0, chanceFast = 0, chanceCrawler = 0;
    if (round < 3) { chanceSlow = 0.7; chanceNormal = 0.3; }
    else if (round < 5) { chanceSlow = 0.3; chanceNormal = 0.6; chanceFast = 0.1; }
    else if (round < 8) { chanceSlow = 0.1; chanceNormal = 0.5; chanceFast = 0.3; chanceCrawler = 0.1; }
    else { chanceNormal = 0.2; chanceFast = 0.6; chanceCrawler = 0.2; }

    const normalProb = chanceSlow + chanceNormal;
    const fastProb = normalProb + chanceFast;
    
    if (r < chanceSlow) { type = "slow"; speedMult = 0.6; }
    else if (r < normalProb) { type = "normal"; speedMult = 1.0; }
    else if (r < fastProb) { type = "fast"; speedMult = 1.5; }
    else { type = "crawler"; speedMult = 0.4; }
    
    const finalSpeed = this.zombieSpeedThisRound * speedMult;
    
    const group = new THREE.Group();
    group.position.set(pt.x, 0.05, pt.z);
    
    // Geometry calculations based on type
    const isCrawler = type === "crawler";
    const bHeight = isCrawler ? 0.4 : 1.2;
    const bPosY = isCrawler ? 0.2 : 0.8;
    const hPosY = isCrawler ? 0.6 : 1.6;
    const ePosY = isCrawler ? 0.65 : 1.65;
    
    // Torso
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, bHeight, 0.3), this.zombieMaterialBody);
    body.position.y = bPosY;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), this.zombieMaterialHead);
    head.position.y = hPosY;
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    // Glowing Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05), eyeMat);
    eyeL.position.set(-0.1, ePosY, -0.2);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05), eyeMat);
    eyeR.position.set(0.1, ePosY, -0.2);
    group.add(eyeR);

    this.scene.add(group);

    this.zombiesList.push({
      id: Math.random().toString(),
      x: pt.x, y: 0.05, z: pt.z,
      rotation: 0,
      movementType: type,
      speed: finalSpeed,
      maxHealth: this.zombieMaxHealthThisRound,
      health: this.zombieMaxHealthThisRound,
      state: "chasing", attackCooldown: 0, staggerDuration: 0, lastAttackTime: 0, meshIndex: 0, isSpecial: false,
      damageValue: 35,
      mesh: group
    } as any); // use any proxy to append mesh property
  }

  private getActiveWeapon() { return this.stats.weapons[this.stats.currentWeaponIndex]; }
  
  private cancelReload() {
    if (this.isReloading) {
      if (this.reloadTimeoutId !== null) clearTimeout(this.reloadTimeoutId);
      this.isReloading = false;
    }
  }

  private switchWeapon() {
    if (this.stats.weapons.length < 2) return;
    this.cancelReload();
    this.stats.currentWeaponIndex = (this.stats.currentWeaponIndex + 1) % this.stats.weapons.length;
    sfx.playReload();
    this.onStatsUpdate({ ...this.stats });
  }

  private startReload() {
    if (this.isReloading) return;
    const gun = this.getActiveWeapon();
    if (gun.currentMag === gun.maxMag || gun.currentReserve <= 0) return;
    
    this.isReloading = true;
    sfx.playReload();
    const reloadTimeMs = gun.reloadTime * 1000 * (this.stats.perks.includes("speed_cola") ? 0.5 : 1);
    
    this.reloadTimeoutId = setTimeout(() => {
      this.isReloading = false;
      const g = this.getActiveWeapon();
      const diff = g.maxMag - g.currentMag;
      const load = Math.min(diff, g.currentReserve);
      g.currentMag += load;
      g.currentReserve -= load;
      this.onStatsUpdate({ ...this.stats });
    }, reloadTimeMs);
  }

  private spawnBloodSplatter(pos: THREE.Vector3, dir: THREE.Vector3) {
    const count = 15 + Math.floor(Math.random() * 15);
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
       positions[i*3] = pos.x;
       positions[i*3+1] = pos.y;
       positions[i*3+2] = pos.z;
       
       // Splay outwards mostly in the direction of the hit
       const spread = 2.0;
       velocities[i*3] = dir.x * 2 + (Math.random() - 0.5) * spread;
       velocities[i*3+1] = dir.y * 2 + Math.random() * 3; // slight upward arc
       velocities[i*3+2] = dir.z * 2 + (Math.random() - 0.5) * spread;
    }
    
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
       color: 0x880000, 
       size: 0.15 + (Math.random()*0.1),
       transparent: true,
       opacity: 0.9,
       depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.bloodParticles.push({ mesh: points, velocities, life: 1.0 });
  }

  private spawnGibs(pos: THREE.Vector3) {
    const count = 6 + Math.floor(Math.random() * 6);
    const redMat = new THREE.MeshStandardMaterial({ color: 0x4a0000, roughness: 0.95, metalness: 0.1 });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xaa9580, roughness: 1.0 });
    
    for (let i = 0; i < count; i++) {
       const isBone = Math.random() > 0.7;
       const geo = new THREE.BoxGeometry(0.1 + Math.random()*0.2, 0.1 + Math.random()*0.2, 0.1 + Math.random()*0.2);
       const mesh = new THREE.Mesh(geo, isBone ? boneMat : redMat);
       
       mesh.position.copy(pos);
       mesh.position.y += Math.random() * 1.5;
       mesh.position.x += (Math.random() - 0.5) * 0.5;
       mesh.position.z += (Math.random() - 0.5) * 0.5;
       
       const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 4 + 2,
          (Math.random() - 0.5) * 6
       );
       const rotSpeed = new THREE.Vector3(
          Math.random() * 10, Math.random() * 10, Math.random() * 10
       );
       
       this.scene.add(mesh);
       this.gibs.push({ mesh, velocity, life: 3.0 + Math.random() * 3, rotSpeed });
    }
  }

  private tryFire() {
    if (this.isReloading) return;
    const gun = this.getActiveWeapon();
    const now = Date.now();
    if (now - this.lastFireTime >= gun.fireRate) {
      this.pullTrigger();
      // pullTrigger handles firing or failing
    }
  }

  private pullTrigger() {
    const gun = this.getActiveWeapon();
    if (gun.currentMag <= 0) { sfx.playOutOfAmmo(); this.startReload(); return; }
    
    this.lastFireTime = Date.now();
    
    gun.currentMag--;
    sfx.playShoot(gun.isPackAPunched);
    this.targetPitchRecoil += gun.recoil;
    this.muzzleFlashTimer = 100;

    // Dynamic Muzzle Flash Mesh Update
    const isAuto = gun.fireMode === "auto";
    const scaleMultiplier = (isAuto ? Math.max(0.7, 1.5 - (gun.fireRate / 400)) : 1.2) * (0.8 + Math.random() * 0.4);
    this.muzzleFlashMesh.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI; // randomize rotation for varied look
    
    const hexColor = gun.isPackAPunched ? 0xec4899 : 0xffaa00;
    this.muzzleFlashMesh.children.forEach(child => {
       const mesh = child as THREE.Mesh;
       (mesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
       (mesh.material as THREE.MeshBasicMaterial).color.setHex(hexColor);
    });

    const rayStart = this.playerPos.clone().setY(this.cameraHeight);
    const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    
    // Spread
    const truespread = this.isADS ? gun.spread * 0.2 : gun.spread;
    rayDir.x += (Math.random() - 0.5) * truespread;
    rayDir.y += (Math.random() - 0.5) * truespread;
    rayDir.z += (Math.random() - 0.5) * truespread;
    rayDir.normalize();

    let hitZomb = null;
    let mindist = 100;
    
    // Raycast vs zombies (simple cylinder)
    this.zombiesList.forEach(z => {
      if (z.state === 'dead') return;
      const isCrawler = z.movementType === "crawler";
      const maxHeight = isCrawler ? 0.9 : 2.0;
      
      const toZ = new THREE.Vector3(z.x - rayStart.x, 0, z.z - rayStart.z); // ignoring Y for simple radius check
      const proj = toZ.dot(rayDir);
      if (proj > 0 && proj < mindist) {
         // rough hit check
         const closestPt = rayStart.clone().add(rayDir.clone().multiplyScalar(proj));
         const horizDist = Math.hypot(closestPt.x - z.x, closestPt.z - z.z);
         if (horizDist < 0.6 && closestPt.y > 0 && closestPt.y < maxHeight) {
            mindist = proj;
            hitZomb = z;
         }
      }
    });

    // Render beautiful dynamic 3D bullet tracer line in scene
    const hitPoint = rayStart.clone().add(rayDir.clone().multiplyScalar(mindist < 100 ? mindist : 40));
    
    const isPaP = gun.isPackAPunched;
    const tracerStartPos = new THREE.Vector3();
    if (this.muzzleFlash) {
      this.muzzleFlash.color.setHex(isPaP ? 0xec4899 : 0xffaa00);
      this.muzzleFlash.updateMatrixWorld(true);
      tracerStartPos.setFromMatrixPosition(this.muzzleFlash.matrixWorld);
    } else {
      tracerStartPos.copy(rayStart).add(new THREE.Vector3(0.2, -0.2, -0.6).applyQuaternion(this.camera.quaternion));
    }

    const tracerGeo = new THREE.BufferGeometry().setFromPoints([tracerStartPos, hitPoint]);
    const tracerColor = isPaP ? 0xec4899 : 0xffaa00;
    const tracerMat = new THREE.LineBasicMaterial({
      color: tracerColor,
      transparent: true,
      opacity: 0.9,
      linewidth: 3
    });
    const tracerLine = new THREE.Line(tracerGeo, tracerMat);
    this.scene.add(tracerLine);

    // Fade and remove the bullet tracer smoothly over rapid consecutive frames
    let fadeTime = 0.9;
    const fadeTimer = setInterval(() => {
      fadeTime -= 0.20;
      if (this.isDestroyed || fadeTime <= 0) {
        clearInterval(fadeTimer);
        this.scene.remove(tracerLine);
        tracerGeo.dispose();
        tracerMat.dispose();
      } else {
        tracerMat.opacity = fadeTime;
      }
    }, 25);

    if (hitZomb) {
      this.spawnBloodSplatter(hitPoint, rayDir);
      
      const dmg = (this.powerupTimers.insta_kill > 0) ? hitZomb.maxHealth : gun.damage;
      hitZomb.health -= dmg * (this.stats.perks.includes("double_tap") ? 1.2 : 1);
      const isKill = hitZomb.health <= 0;
      sfx.playZombieHit(isKill);
      
      let pts = isKill ? 60 : 10;
      if (this.powerupTimers.double_points > 0) pts *= 2;
      this.stats.points += pts;
      
      this.hitMarkers.push({ id: Math.random().toString(), time: Date.now(), isKill, isHeadshot: false });
      setTimeout(() => { this.hitMarkers.shift() }, 400);

      if (isKill) {
        this.spawnGibs(new THREE.Vector3(hitZomb.x, 1.0, hitZomb.z));
        hitZomb.state = 'dead';
        if ((hitZomb as any).mesh) { this.scene.remove((hitZomb as any).mesh); }
        this.stats.kills++;
        
        // Powerup drop chance
        if (Math.random() < 0.05) {
           this.powerupTimers.double_points = 30000;
           sfx.playPowerUp("double_points");
        }

        // Check wave complete
        if (this.zombiesRemainingToSpawn === 0 && this.zombiesList.filter(z=>z.state!=='dead').length === 0) {
           this.isRoundTransition = true;
           this.roundCooldownRemaining = 5000;
           sfx.playRoundEnd();
        }
      } else {
        hitZomb.staggerDuration = 300;
      }
    }

    this.onStatsUpdate({ ...this.stats });
  }

  private performInteractAction() {
    let closestIO: InteractiveObject | null = null;
    let closestDist = 3.0;

    this.interactives.forEach((io) => {
      const dist = this.playerPos.distanceTo(new THREE.Vector3(io.position[0], io.position[1], io.position[2]));
      if (dist < closestDist) { closestDist = dist; closestIO = io; }
    });
    if (!closestIO) return;

    // For a ready mystery box, interaction cost is 0 since the draft has already been bought!
    const effectiveCost = (closestIO.type === "mystery_box" && this.mysteryBoxState === "ready") ? 0 : closestIO.cost;
    if (this.stats.points < effectiveCost) { sfx.playFail(); return; }

    if (closestIO.type === "door" && !closestIO.isPurchased) {
      this.stats.points -= closestIO.cost;
      closestIO.isPurchased = true;
      sfx.playBuy();
      const dm = this.doorMeshes[closestIO.id];
      if (dm) this.scene.remove(dm);
    } 
    else if (closestIO.type === "wallbuy") {
      const dbWeapon = WEAPONS_DATABASE[closestIO.extraId!];
      const existing = this.stats.weapons.find(w => w.id === dbWeapon.id);
      if (existing) {
         this.stats.points -= Math.round(closestIO.cost / 2);
         existing.currentReserve = existing.maxReserve;
      } else {
         this.stats.points -= closestIO.cost;
         if (this.stats.weapons.length < 2) {
           this.stats.weapons.push({ ...dbWeapon });
           this.stats.currentWeaponIndex = 1;
         } else {
           this.stats.weapons[this.stats.currentWeaponIndex] = { ...dbWeapon };
         }
      }
      sfx.playBuy();
    }
    else if (closestIO.type === "power" && !this.stats.isPowerOn) {
      this.stats.isPowerOn = true;
      sfx.playPowerOn();

      // Animate visual switch and indicator!
      if (this.powerSwitchLeverGroup) {
        this.powerSwitchLeverGroup.rotation.z = Math.PI; // Flip pointing UP!
      }
      if (this.powerIndicatorLightMesh) {
        (this.powerIndicatorLightMesh.material as THREE.MeshBasicMaterial).color.setHex(0x10b981); // Emerald green!
      }
    }
    else if (closestIO.type === "mystery_box") {
      if (this.mysteryBoxState === "idle") {
        this.stats.points -= closestIO.cost;

        this.mysteryBoxState = "rolling";
        this.mysteryBoxRollTimer = 0;
        this.mysteryBoxCycleTimer = 0;
        
        const possibleWeapons = Object.keys(WEAPONS_DATABASE).filter(id => id !== "colt_m1911");
        const randomWeaponId = possibleWeapons[Math.floor(Math.random() * possibleWeapons.length)];
        this.mysteryBoxWeaponIdOnOffer = randomWeaponId;

        sfx.playOutOfAmmo(); // clicking roller sounds
        
        if (this.mysteryBoxLidGroup) {
          this.mysteryBoxLidGroup.rotation.x = -Math.PI * 0.45; // open sesame
        }
        if (this.mysteryBoxLight) {
          this.mysteryBoxLight.intensity = 8.0; // bright blue shine
        }
      }
      else if (this.mysteryBoxState === "ready" && this.mysteryBoxWeaponIdOnOffer) {
        const rolledWeapon = WEAPONS_DATABASE[this.mysteryBoxWeaponIdOnOffer];
        const existing = this.stats.weapons.find(w => w.id === rolledWeapon.id);
        if (existing) {
          existing.currentReserve = existing.maxReserve;
        } else {
          if (this.stats.weapons.length < 2) {
            this.stats.weapons.push({ ...rolledWeapon });
            this.stats.currentWeaponIndex = 1;
          } else {
            this.stats.weapons[this.stats.currentWeaponIndex] = { ...rolledWeapon };
          }
        }
        sfx.playBuy();

        this.mysteryBoxState = "idle";
        this.mysteryBoxWeaponIdOnOffer = null;
        if (this.mysteryBoxLidGroup) {
          this.mysteryBoxLidGroup.rotation.x = 0; // shut lid
        }
        if (this.mysteryBoxLight) {
          this.mysteryBoxLight.intensity = 0;
        }
        if (this.mysteryBoxFloatingGroup) {
          this.mysteryBoxGroup!.remove(this.mysteryBoxFloatingGroup);
          this.mysteryBoxFloatingGroup = null;
        }
      }
    }
    else if (closestIO.type === "perk" && this.stats.isPowerOn) {
      if (!this.stats.perks.includes(closestIO.extraId as any)) {
        this.stats.points -= closestIO.cost;
        this.stats.perks.push(closestIO.extraId as any);
        if (closestIO.extraId === 'juggernog') {
           this.stats.maxHealth = 250; this.stats.health = 250;
        }
        sfx.playPerkPurchase(closestIO.extraId!);
      }
    }
    else if (closestIO.type === "pack_a_punch" && this.stats.isPowerOn) {
      const gun = this.getActiveWeapon();
      if (!gun.isPackAPunched) {
        this.stats.points -= closestIO.cost;
        sfx.playPackAPunch();
        this.stats.weapons[this.stats.currentWeaponIndex] = getPackAPunchedWeapon(gun);
      }
    }

    this.onStatsUpdate({ ...this.stats });
  }

  public getInteractionPrompt(): any {
    let closestIO: InteractiveObject | null = null;
    let closestDist = 3.0;

    this.interactives.forEach((io) => {
      const dist = this.playerPos.distanceTo(new THREE.Vector3(io.position[0], io.position[1], io.position[2]));
      if (dist < closestDist) { closestDist = dist; closestIO = io; }
    });
    if (!closestIO) return null;

    if (closestIO.type === "door" && !closestIO.isPurchased) {
      return { text: `Open ${closestIO.name}`, subtext: "Press [E] to unlock", cost: closestIO.cost };
    }
    if (closestIO.type === "wallbuy") {
      return { text: `Buy ${closestIO.name}`, subtext: "Press [E] to acquire/restock", cost: closestIO.cost };
    }
    if (closestIO.type === "power" && !this.stats.isPowerOn) {
      return { text: "Turn on Power", subtext: "Press [E] to power the room", cost: 0 };
    }
    if (closestIO.type === "mystery_box") {
      if (this.mysteryBoxState === "idle") {
        return { text: "Mystery Box", subtext: "Press [E] to roll a random weapon", cost: closestIO.cost };
      }
      if (this.mysteryBoxState === "rolling") {
        return { text: "Mystery Box rolling...", subtext: "Condensing Aether Energy", cost: 0 };
      }
      if (this.mysteryBoxState === "ready" && this.mysteryBoxWeaponIdOnOffer) {
        const weaponName = WEAPONS_DATABASE[this.mysteryBoxWeaponIdOnOffer].name;
        return { text: `Take ${weaponName}`, subtext: "Press [E] to trade active weapon", cost: 0 };
      }
    }
    if (closestIO.type === "perk") {
      return { text: `Buy ${closestIO.name}`, subtext: this.stats.isPowerOn ? "Press [E]" : "Requires Power", cost: closestIO.cost };
    }
    if (closestIO.type === "pack_a_punch") {
      return { text: "Pack-A-Punch Weapon", subtext: this.stats.isPowerOn ? "Press [E]" : "Requires Power", cost: closestIO.cost };
    }
    if (closestIO.type === "barrier") {
      const state = this.barrierState[closestIO.id];
      const planks = state ? state.planks : 0;
      if (planks >= 6) {
        return { text: "Barrier Fully Repaired", subtext: "The window is fully boarded up", cost: 0 };
      }
      return { text: "Repair Window Barrier", subtext: `Hold [E] to Board Up (${planks}/6 boards) (+10 pts)`, cost: 0 };
    }
    return null;
  }

  private syncBarrierMeshes(io: InteractiveObject) {
    const state = this.barrierState[io.id];
    if (!state) return;

    // Clear old meshes
    state.meshes.forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      if (Array.isArray(m.material)) {
        m.material.forEach(mat => mat.dispose());
      } else {
        m.material.dispose();
      }
    });
    state.meshes = [];

    // Create custom wooden boards
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b, // warm brown wood
      roughness: 0.9,
      metalness: 0.1
    });

    const width = io.size[0];
    const height = io.size[1];

    for (let i = 0; i < state.planks; i++) {
      const plankHeight = 0.18;
      const pGeo = new THREE.BoxGeometry(width * 1.15, plankHeight, 0.08);
      const pMesh = new THREE.Mesh(pGeo, woodMat);

      // Distribute boards vertically across the height of the window opening
      const yOffset = io.position[1] - height / 2 + (i + 0.5) * (height / 6);
      pMesh.position.set(io.position[0], yOffset, io.position[2]);

      // Give organic, non-uniform angle tilt for cobbled-together aesthetic
      pMesh.rotation.z = (i % 2 === 0 ? 0.045 : -0.045) * (i + 1);
      pMesh.rotation.y = (i % 2 === 0 ? 0.02 : -0.02);

      this.scene.add(pMesh);
      state.meshes.push(pMesh);
    }
  }

  private createStreetLamp(x: number, z: number) {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(x, 0, z);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff7c2 });

    // Vertical pole
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6, 8);
    const poleMesh = new THREE.Mesh(poleGeo, metalMat);
    poleMesh.position.y = 3;
    poleMesh.castShadow = true;
    poleMesh.receiveShadow = true;
    lampGroup.add(poleMesh);

    // Horizontal lamp arm
    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8);
    const armMesh = new THREE.Mesh(armGeo, metalMat);
    armMesh.rotation.z = Math.PI / 2;
    armMesh.position.set(0.5, 5.8, 0);
    armMesh.castShadow = true;
    armMesh.receiveShadow = true;
    lampGroup.add(armMesh);

    // Lamp shade head
    const headGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.4, 8);
    const headMesh = new THREE.Mesh(headGeo, metalMat);
    headMesh.position.set(1.0, 5.6, 0);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    lampGroup.add(headMesh);

    // Bright glowing bulb
    const bulbGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
    bulbMesh.position.set(1.0, 5.4, 0);
    lampGroup.add(bulbMesh);

    // Subtle Glowing Bloom effect (concentric additive-glow spheres representing light scattering on the lamp head)
    const bloomGlowGroup = new THREE.Group();
    bloomGlowGroup.position.set(1.0, 5.4, 0);
    
    const glowColors = [0xfff7c2, 0xffea88, 0xffd066];
    const glowOpacities = [0.22, 0.12, 0.05];
    const glowSizes = [0.4, 0.82, 1.5];

    for (let g = 0; g < 3; g++) {
      const glowGeo = new THREE.SphereGeometry(glowSizes[g], 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: glowColors[g],
        transparent: true,
        opacity: glowOpacities[g],
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      bloomGlowGroup.add(glowMesh);
    }
    lampGroup.add(bloomGlowGroup);

    this.scene.add(lampGroup);

    // Real light source calculated in world space for correct pointing and alignment!
    const worldLampX = x + 1.0;
    const worldLampY = 5.4;
    const worldLampZ = z;

    // Direct spotlight pointing downwards (originating from lamp head)
    const spotLight = new THREE.SpotLight(0xfff5ab, 15.0, 22, Math.PI / 3.5, 0.4, 1.0);
    spotLight.position.set(worldLampX, worldLampY, worldLampZ);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 512;
    spotLight.shadow.mapSize.height = 512;
    spotLight.shadow.camera.near = 0.5;
    spotLight.shadow.camera.far = 25;
    spotLight.shadow.bias = -0.0005;

    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(worldLampX, 0, worldLampZ);
    this.scene.add(spotTarget);
    spotLight.target = spotTarget;
    this.scene.add(spotLight);

    // Dynamic warm PointLight under the bulb casting soft surrounding area glow (Optimized: disabled shadow mapping for incredible FPS)
    const lampPointLight = new THREE.PointLight(0xfff5ab, 3.0, 10);
    lampPointLight.position.set(worldLampX, worldLampY - 0.2, worldLampZ);
    this.scene.add(lampPointLight);
  }

  private buildGunModelOnly(weaponId: string): THREE.Group {
    const gunModel = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4 });
    const darkGreyMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.5 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3317, metalness: 0.1, roughness: 0.8 });

    if (weaponId === "olympia") {
      // 1. Olympia stock (wood)
      const stockGeo = new THREE.BoxGeometry(0.5, 0.16, 0.08);
      const stock = new THREE.Mesh(stockGeo, woodMat);
      stock.position.set(-0.55, -0.06, 0);
      stock.rotation.z = -0.15;
      gunModel.add(stock);

      // Grip bridge
      const gripGeo = new THREE.BoxGeometry(0.2, 0.1, 0.06);
      const grip = new THREE.Mesh(gripGeo, woodMat);
      grip.position.set(-0.3, -0.05, 0);
      gunModel.add(grip);

      // 2. Action/Receiver (Steel)
      const actionGeo = new THREE.BoxGeometry(0.3, 0.12, 0.08);
      const action = new THREE.Mesh(actionGeo, steelMat);
      action.position.set(-0.1, 0.0, 0);
      gunModel.add(action);

      // 3. Double Barrel (Steel side-by-side)
      const barrelGeo1 = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8);
      const barrel1 = new THREE.Mesh(barrelGeo1, steelMat);
      barrel1.rotation.z = Math.PI / 2;
      barrel1.position.set(0.5, 0.02, 0.02);
      gunModel.add(barrel1);

      const barrelGeo2 = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8);
      const barrel2 = new THREE.Mesh(barrelGeo2, steelMat);
      barrel2.rotation.z = Math.PI / 2;
      barrel2.position.set(0.5, 0.02, -0.02);
      gunModel.add(barrel2);

      // Barrel fore-end grip (wood)
      const forendGeo = new THREE.BoxGeometry(0.4, 0.06, 0.08);
      const forend = new THREE.Mesh(forendGeo, woodMat);
      forend.position.set(0.25, -0.03, 0);
      gunModel.add(forend);

    } else if (weaponId === "mp5") {
      // 1. MP5 black receiver
      const recGeo = new THREE.BoxGeometry(0.5, 0.14, 0.08);
      const rec = new THREE.Mesh(recGeo, steelMat);
      rec.position.set(0, 0.04, 0);
      gunModel.add(rec);

      // 2. Handguard (Dark grey ribbed)
      const guardGeo = new THREE.BoxGeometry(0.32, 0.12, 0.09);
      const guard = new THREE.Mesh(guardGeo, darkGreyMat);
      guard.position.set(0.25, 0.02, 0);
      gunModel.add(guard);

      // 3. Barrel & front sight
      const bGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8);
      const bMesh = new THREE.Mesh(bGeo, steelMat);
      bMesh.rotation.z = Math.PI / 2;
      bMesh.position.set(0.48, 0.04, 0);
      gunModel.add(bMesh);

      const sightGeo = new THREE.BoxGeometry(0.04, 0.08, 0.03);
      const sight = new THREE.Mesh(sightGeo, steelMat);
      sight.position.set(0.56, 0.08, 0);
      gunModel.add(sight);

      // 4. Stock & Butt
      const stockGeo = new THREE.BoxGeometry(0.4, 0.03, 0.07);
      const stockUpper = new THREE.Mesh(stockGeo, steelMat);
      stockUpper.position.set(-0.4, 0.08, 0);
      gunModel.add(stockUpper);

      const stockButtGeo = new THREE.BoxGeometry(0.04, 0.18, 0.08);
      const stockButt = new THREE.Mesh(stockButtGeo, darkGreyMat);
      stockButt.position.set(-0.58, 0.02, 0);
      gunModel.add(stockButt);

      // 5. Pistol Grip & Mag
      const gripGeo = new THREE.BoxGeometry(0.08, 0.18, 0.06);
      const grip = new THREE.Mesh(gripGeo, darkGreyMat);
      grip.position.set(-0.15, -0.08, 0);
      grip.rotation.z = -0.32;
      gunModel.add(grip);

      const magGeo = new THREE.BoxGeometry(0.08, 0.25, 0.05);
      const mag = new THREE.Mesh(magGeo, steelMat);
      mag.position.set(0.12, -0.12, 0);
      mag.rotation.z = 0.2;
      gunModel.add(mag);

    } else if (weaponId === "galil") {
      // Galil Assault Rifle
      const recGeo = new THREE.BoxGeometry(0.65, 0.15, 0.09);
      const rec = new THREE.Mesh(recGeo, steelMat);
      rec.position.set(0, 0.05, 0);
      gunModel.add(rec);

      const guardGeo = new THREE.BoxGeometry(0.38, 0.13, 0.1);
      const guard = new THREE.Mesh(guardGeo, woodMat);
      guard.position.set(0.35, 0.04, 0);
      gunModel.add(guard);

      const bGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8);
      const bMesh = new THREE.Mesh(bGeo, steelMat);
      bMesh.rotation.z = Math.PI / 2;
      bMesh.position.set(0.72, 0.05, 0);
      gunModel.add(bMesh);

      const muzzleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8);
      const muzzle = new THREE.Mesh(muzzleGeo, steelMat);
      muzzle.rotation.z = Math.PI / 2;
      muzzle.position.set(0.95, 0.05, 0);
      gunModel.add(muzzle);

      const stockGeo1 = new THREE.BoxGeometry(0.5, 0.03, 0.04);
      const stockPart1 = new THREE.Mesh(stockGeo1, steelMat);
      stockPart1.position.set(-0.45, 0.09, 0);
      stockPart1.rotation.z = -0.12;
      gunModel.add(stockPart1);

      const stockGeo2 = new THREE.BoxGeometry(0.5, 0.03, 0.04);
      const stockPart2 = new THREE.Mesh(stockGeo2, steelMat);
      stockPart2.position.set(-0.45, -0.01, 0);
      stockPart2.rotation.z = 0.12;
      gunModel.add(stockPart2);

      const stockButtGeo = new THREE.BoxGeometry(0.04, 0.18, 0.07);
      const stockButt = new THREE.Mesh(stockButtGeo, darkGreyMat);
      stockButt.position.set(-0.7, 0.03, 0);
      gunModel.add(stockButt);

      const gripGeo = new THREE.BoxGeometry(0.08, 0.2, 0.07);
      const grip = new THREE.Mesh(gripGeo, darkGreyMat);
      grip.position.set(-0.24, -0.08, 0);
      grip.rotation.z = -0.35;
      gunModel.add(grip);

      const magGeo = new THREE.BoxGeometry(0.09, 0.3, 0.06);
      const mag = new THREE.Mesh(magGeo, steelMat);
      mag.position.set(0.18, -0.15, 0);
      mag.rotation.z = 0.35;
      gunModel.add(mag);

    } else if (weaponId === "m14") {
      // M14 Long Wood Rifle
      const stockGeo = new THREE.BoxGeometry(1.2, 0.12, 0.09);
      const stock = new THREE.Mesh(stockGeo, woodMat);
      stock.position.set(-0.15, -0.02, 0);
      gunModel.add(stock);

      const stockButtGeo = new THREE.BoxGeometry(0.4, 0.15, 0.09);
      const stockButt = new THREE.Mesh(stockButtGeo, woodMat);
      stockButt.position.set(-0.65, -0.05, 0);
      stockButt.rotation.z = -0.15;
      gunModel.add(stockButt);

      const recGeo = new THREE.BoxGeometry(0.4, 0.12, 0.08);
      const rec = new THREE.Mesh(recGeo, steelMat);
      rec.position.set(-0.05, 0.06, 0);
      gunModel.add(rec);

      const bGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8);
      const bMesh = new THREE.Mesh(bGeo, steelMat);
      bMesh.rotation.z = Math.PI / 2;
      bMesh.position.set(0.7, 0.07, 0);
      gunModel.add(bMesh);

      const frontSightGeo = new THREE.BoxGeometry(0.03, 0.06, 0.03);
      const sight = new THREE.Mesh(frontSightGeo, steelMat);
      sight.position.set(1.12, 0.12, 0);
      gunModel.add(sight);

      const magGeo = new THREE.BoxGeometry(0.08, 0.16, 0.06);
      const mag = new THREE.Mesh(magGeo, steelMat);
      mag.position.set(0.18, -0.12, 0);
      mag.rotation.z = 0.12;
      gunModel.add(mag);

    } else if (weaponId === "remington_870") {
      // Remington 870 Shotgun
      const stockGeo = new THREE.BoxGeometry(0.45, 0.15, 0.08);
      const stock = new THREE.Mesh(stockGeo, woodMat);
      stock.position.set(-0.55, -0.05, 0);
      stock.rotation.z = -0.15;
      gunModel.add(stock);

      const recGeo = new THREE.BoxGeometry(0.38, 0.14, 0.09);
      const rec = new THREE.Mesh(recGeo, steelMat);
      rec.position.set(-0.15, 0.01, 0);
      gunModel.add(rec);

      const bGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.95, 8);
      const bMesh = new THREE.Mesh(bGeo, steelMat);
      bMesh.rotation.z = Math.PI / 2;
      bMesh.position.set(0.48, 0.06, 0);
      gunModel.add(bMesh);

      const tGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.72, 8);
      const tMesh = new THREE.Mesh(tGeo, darkGreyMat);
      tMesh.rotation.z = Math.PI / 2;
      tMesh.position.set(0.35, 0.01, 0);
      gunModel.add(tMesh);

      const pumpGeo = new THREE.BoxGeometry(0.28, 0.08, 0.1);
      const pump = new THREE.Mesh(pumpGeo, woodMat);
      pump.position.set(0.26, 0.0, 0);
      gunModel.add(pump);

    } else if (weaponId === "m16") {
      // M16 Rifle
      const stockGeo = new THREE.BoxGeometry(0.44, 0.15, 0.08);
      const stock = new THREE.Mesh(stockGeo, darkGreyMat);
      stock.position.set(-0.52, 0.04, 0);
      gunModel.add(stock);

      const recGeo = new THREE.BoxGeometry(0.44, 0.15, 0.09);
      const rec = new THREE.Mesh(recGeo, steelMat);
      rec.position.set(-0.1, 0.06, 0);
      gunModel.add(rec);

      const handleGeo = new THREE.BoxGeometry(0.24, 0.06, 0.04);
      const handle = new THREE.Mesh(handleGeo, darkGreyMat);
      handle.position.set(-0.12, 0.16, 0);
      gunModel.add(handle);

      const guardGeo = new THREE.BoxGeometry(0.48, 0.14, 0.09);
      const guard = new THREE.Mesh(guardGeo, darkGreyMat);
      guard.position.set(0.32, 0.05, 0);
      gunModel.add(guard);

      const bGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.42, 8);
      const bMesh = new THREE.Mesh(bGeo, steelMat);
      bMesh.rotation.z = Math.PI / 2;
      bMesh.position.set(0.72, 0.06, 0);
      gunModel.add(bMesh);

      const aGeo = new THREE.BoxGeometry(0.04, 0.12, 0.03);
      const aFrame = new THREE.Mesh(aGeo, darkGreyMat);
      aFrame.position.set(0.85, 0.12, 0);
      gunModel.add(aFrame);

      const magGeo = new THREE.BoxGeometry(0.09, 0.22, 0.06);
      const mag = new THREE.Mesh(magGeo, steelMat);
      mag.position.set(0.12, -0.10, 0);
      mag.rotation.z = 0.1;
      gunModel.add(mag);

      const gripGeo = new THREE.BoxGeometry(0.07, 0.18, 0.06);
      const grip = new THREE.Mesh(gripGeo, darkGreyMat);
      grip.position.set(-0.18, -0.06, 0);
      grip.rotation.z = -0.35;
      gunModel.add(grip);

    } else if (weaponId === "ray_gun") {
      // Ray Gun - Legendary sci-fi model
      const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.9, roughness: 0.2 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.9, roughness: 0.25 });
      const blueGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

      // Body receiver (cylinder)
      const recGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 12);
      const rec = new THREE.Mesh(recGeo, redMat);
      rec.rotation.z = Math.PI / 2;
      rec.position.set(-0.05, 0.06, 0);
      gunModel.add(rec);

      // Alien rings
      for (let i = 0; i < 3; i++) {
        const ringGeo = new THREE.TorusGeometry(0.07, 0.015, 8, 24);
        const ring = new THREE.Mesh(ringGeo, goldMat);
        ring.rotation.y = Math.PI / 2;
        ring.position.set(0.1 + i * 0.08, 0.06, 0);
        gunModel.add(ring);
      }

      // Small barrel needle
      const bGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.35, 8);
      const bMesh = new THREE.Mesh(bGeo, steelMat);
      bMesh.rotation.z = Math.PI / 2;
      bMesh.position.set(0.2, 0.06, 0);
      gunModel.add(bMesh);

      // Spherical energy node at tip
      const bulbGeo = new THREE.SphereGeometry(0.022, 10, 10);
      const bulb = new THREE.Mesh(bulbGeo, blueGlowMat);
      bulb.position.set(0.36, 0.06, 0);
      gunModel.add(bulb);

      // Pistol grip (slilted retro angle)
      const gripGeo = new THREE.BoxGeometry(0.06, 0.16, 0.05);
      const grip = new THREE.Mesh(gripGeo, woodMat);
      grip.position.set(-0.16, -0.04, 0);
      grip.rotation.z = -0.45;
      gunModel.add(grip);

    } else {
      // generic pistol shape
      const recGeo = new THREE.BoxGeometry(0.3, 0.1, 0.07);
      const rec = new THREE.Mesh(recGeo, steelMat);
      rec.position.set(0, 0.05, 0);
      gunModel.add(rec);

      const gripGeo = new THREE.BoxGeometry(0.08, 0.18, 0.05);
      const grip = new THREE.Mesh(gripGeo, woodMat);
      grip.position.set(-0.08, -0.06, 0);
      grip.rotation.z = -0.25;
      gunModel.add(grip);
    }
    
    gunModel.scale.set(0.8, 0.8, 0.8);
    return gunModel;
  }

  private createWallbuyModel(io: InteractiveObject): THREE.Group {
    const group = new THREE.Group();
    group.position.set(io.position[0], io.position[1], io.position[2]);

    const isFacingZ = io.size[0] > io.size[2];
    
    // Create the backing plaque (polished mahogany wood)
    const plaqueMat = new THREE.MeshStandardMaterial({
      color: 0x3d2314, // dark mahogany wood
      roughness: 0.6,
      metalness: 0.1
    });
    
    const plaqueW = isFacingZ ? io.size[0] : io.size[2];
    const plaqueH = io.size[1];
    const plaqueD = 0.08;
    const plaqueGeo = new THREE.BoxGeometry(plaqueW, plaqueH, plaqueD);
    const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
    group.add(plaqueMesh);

    // Glowing chalk neon outline (Classic COD style!)
    const chalkColor = 0xffffff;
    const chalkMat = new THREE.MeshBasicMaterial({
      color: chalkColor,
      transparent: true,
      opacity: 0.35
    });
    
    const chalkOutlineGeo = new THREE.BoxGeometry(plaqueW * 0.94, plaqueH * 0.85, 0.02);
    const chalkOutlineMesh = new THREE.Mesh(chalkOutlineGeo, chalkMat);
    chalkOutlineMesh.position.z = 0.01; // slightly in front of plaque
    group.add(chalkOutlineMesh);

    // Build the gun model and add to plaque Group
    const gunModel = this.buildGunModelOnly(io.extraId || "");
    gunModel.position.set(0, 0, 0.08); // sit in front of plaque
    group.add(gunModel);

    // Orient wallbuy to point inward from the building wall it is attached to!
    if (isFacingZ) {
      if (io.position[2] > 0) {
        group.rotation.y = Math.PI; // faces inward (North) if mounted on South wall
      } else {
        group.rotation.y = 0; // faces inward (South) if mounted on North wall
      }
    } else {
      if (io.position[0] > 0) {
        group.rotation.y = -Math.PI / 2; // faces inward (West) if mounted on East wall
      } else {
        group.rotation.y = Math.PI / 2; // faces inward (East) if mounted on West wall
      }
    }

    return group;
  }

  public getStaminaPercent() { return this.stamina; }
  public getPowerupTimers() { return { insta_kill: Math.ceil(this.powerupTimers.insta_kill/1000), double_points: Math.ceil(this.powerupTimers.double_points/1000) }; }
  public getHitmarkers() { return this.hitMarkers; }

  public getRadarData() {
    return {
      player: { x: this.playerPos.x, z: this.playerPos.z, yaw: this.yaw },
      zombies: this.zombiesList.filter(z => z.state !== 'dead').map(z => ({ id: z.id, x: z.x, z: z.z }))
    };
  }
}
