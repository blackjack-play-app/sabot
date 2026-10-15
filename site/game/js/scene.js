// Scène 3D : salle, table, sabot, croupier, cartes et jetons animés.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import {
  CARD_W, CARD_H, drawCardFace, drawCardBack, canvasTexture, drawFelt, CHIP_DENOMS,
  drawChipFace, drawChipEdge, drawCarpet, drawLeather, drawWood,
} from './textures.js';
import { Dealer } from './dealer.js';
import { RealDealer, REAL_SKINS } from './dealer3d.js';
import { RGBELoader } from '../vendor/RGBELoader.js';

export const TABLE_Y = 0.86;
const R = 1.15, BACK = 0.45, SPOT_R = 0.072;
const CARD_RADIUS = 0.64, BET_RADIUS = 0.86;
const DEALER_Z = -0.2;
const SHOE_POS = new THREE.Vector3(0.66, TABLE_Y, -0.3);
const DISCARD_POS = new THREE.Vector3(-0.66, TABLE_Y, -0.3);
const TRAY_POS = new THREE.Vector3(0, TABLE_Y, -0.36);
const CHIP_H = 0.0034, CHIP_R = 0.0195;

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

export const CAMERA_PRESETS = {
  joueur: { label: 'Joueur', pos: [0, 1.78, 2.12], target: [0, 1.02, 0.02] },
  plongee: { label: 'Vue du dessus', pos: [0, TABLE_Y + 2.05, 0.38], target: [0, TABLE_Y, 0.2] },
  croupier: { label: 'Croupier', pos: [0, TABLE_Y + 0.75, -1.2], target: [0, TABLE_Y, 0.35] },
  premiere: { label: 'Première base', pos: [1.35, TABLE_Y + 0.5, 0.95], target: [0, TABLE_Y, 0.0] },
  cinema: { label: 'Cinéma', pos: [-1.5, TABLE_Y + 0.9, 1.4], target: [0, TABLE_Y + 0.2, -0.2] },
};

export function spotAngle(i) { return Math.PI * 0.18 + i * (Math.PI * 0.64 / 4); }

export class TableScene {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = opts;
    this.speed = 1;
    this.tweens = [];
    this.cardObjs = new Map();   // handKey -> [cardObj]
    this.dealerCards = [];
    this.betStacks = new Map();  // key -> group
    this.discardCount = 0;
    this.onSpotClick = null;
    this.onSpotHover = null;
    this.hoverSpot = -1;
    this.style = { indices: 'fr', back: 'bordeaux', felt: 'vert', skin: opts.skin || 'gilet' };
    this.texRes = opts.texRes || '2k';
    this.faceTexCache = new Map();
    this.clock = new THREE.Clock();
    this.idleOrbit = false;

    this.geo = { R, back: BACK, spotR: SPOT_R, dealerZ: DEALER_Z, spots: [] };
    for (let i = 0; i < 5; i++) {
      const a = spotAngle(i);
      this.geo.spots.push({
        angle: a, x: Math.cos(a) * BET_RADIUS, z: Math.sin(a) * BET_RADIUS,
        cx: Math.cos(a) * CARD_RADIUS, cz: Math.sin(a) * CARD_RADIUS,
      });
    }
    this.initRenderer();
    this.buildRoom();
    this.buildTable();
    this.buildProps();
    this.dealer = new RealDealer();
    this.dealer.root.position.set(0, 0, -0.74);
    this.scene.add(this.dealer.root);
    this.dealerReady = this.loadDealer(this.style.skin);
    this.loadPBR();
    this.setView('joueur', true);
    this.bindPointer();
    this.loop = this.loop.bind(this);
    this.renderer.setAnimationLoop(this.loop);
  }

  // ---------------- Rendu ----------------
  initRenderer() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!this.opts.preserve });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0907');
    this.scene.fog = new THREE.FogExp2('#0b0907', 0.085);
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.28;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 60);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.35;
    this.controls.maxDistance = 4.5;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.zoomSpeed = 0.9;
    this.controls.rotateSpeed = 0.6;
    this.controls.panSpeed = 0.6;
    this.controls.screenSpacePanning = true;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // Sur écran étroit (téléphone vertical), on élargit le champ de vision.
    this.camera.fov = w / h < 0.9 ? 62 : w / h < 1.3 ? 50 : 42;
    this.camera.updateProjectionMatrix();
  }

  applyQuality(p, reload = false) {
    this.qprofile = p;
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
    r.shadowMap.enabled = p.shadows;
    this.lamp.castShadow = p.shadows;
    this.lamp.shadow.mapSize.set(p.shadowMap, p.shadowMap);
    if (this.lamp.shadow.map) { this.lamp.shadow.map.dispose(); this.lamp.shadow.map = null; }
    for (const b of this.bokeh) b.visible = p.bokeh;
    this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    this.resize();
    const tex = p.dealer === 'hd' ? '2k' : '1k';
    if (reload && tex !== this.texRes) {
      this.texRes = tex;
      this.loadPBR();
      this.dealerReady = this.loadDealer(this.style.skin);
    }
  }

  setQuality(q) {
    this.quality = q;
    const r = this.renderer;
    r.setPixelRatio(q === 'basse' ? 1 : Math.min(window.devicePixelRatio, q === 'haute' ? 2 : 1.5));
    r.shadowMap.enabled = q !== 'basse';
    this.lamp.shadow.mapSize.set(q === 'haute' ? 2048 : 1024, q === 'haute' ? 2048 : 1024);
    if (this.lamp.shadow.map) { this.lamp.shadow.map.dispose(); this.lamp.shadow.map = null; }
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }

  buildRoom() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#ffe9c9', '#1a0f0a', 0.45));

    // Lampe suspendue au-dessus de la table
    const lamp = this.lamp = new THREE.SpotLight('#ffe7c2', 38, 7, 0.78, 0.65, 1.4);
    lamp.position.set(0, 2.75, 0.15);
    lamp.target.position.set(0, TABLE_Y, 0.1);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.bias = -0.0004;
    lamp.shadow.normalBias = 0.01;
    lamp.shadow.radius = 4;
    lamp.shadow.camera.near = 0.5; lamp.shadow.camera.far = 4;
    s.add(lamp, lamp.target);
    const fill = new THREE.SpotLight('#ffd9a8', 6, 6, 0.9, 0.9, 1.5);
    fill.position.set(0, 1.9, 2.3);
    fill.target.position.set(0, TABLE_Y, -0.3);
    s.add(fill, fill.target);
    const rim = new THREE.PointLight('#ff9a52', 3.5, 5, 2);
    rim.position.set(-1.5, 1.8, -1.6);
    s.add(rim);

    // Abat-jour
    const shade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.5),
      new THREE.MeshStandardMaterial({ color: '#1c1410', roughness: 0.4, metalness: 0.5 }));
    shade.position.set(0, 2.85, 0.1);
    s.add(shade);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.42),
      new THREE.MeshBasicMaterial({ color: '#fff1d6' }));
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, 2.797, 0.1);
    s.add(glow);
    for (const x of [-0.6, 0.6]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.5), new THREE.MeshBasicMaterial({ color: '#111' }));
      cable.position.set(x, 3.6, 0.1);
      s.add(cable);
    }

    // Moquette
    const carpetTex = canvasTexture(drawCarpet(), this.renderer);
    carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
    carpetTex.repeat.set(14, 14);
    this.floorMat = new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    // Lumières lointaines (ambiance de salle)
    const dot = document.createElement('canvas');
    dot.width = dot.height = 64;
    const g = dot.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const dotTex = new THREE.CanvasTexture(dot);
    this.bokeh = [];
    const colors = ['#ffb56b', '#ffd28f', '#ff7a5a', '#ffe6b0', '#c9a24a'];
    for (let i = 0; i < 70; i++) {
      const m = new THREE.SpriteMaterial({ map: dotTex, color: colors[i % colors.length], transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const sp = new THREE.Sprite(m);
      const a = Math.PI * (0.9 + Math.random() * 1.2);
      const d = 6 + Math.random() * 8;
      sp.position.set(Math.cos(a) * d, 0.8 + Math.random() * 3, Math.sin(a) * d - 1);
      if (Math.random() < 0.4) sp.position.z = -6 - Math.random() * 6;
      const sc = 0.2 + Math.random() * 0.5;
      sp.scale.set(sc, sc, 1);
      sp.userData.phase = Math.random() * 10;
      s.add(sp);
      this.bokeh.push(sp);
    }
    // Silhouettes d'autres tables au loin
    const silMat = new THREE.MeshStandardMaterial({ color: '#0f2a1d', roughness: 1 });
    for (const [x, z] of [[-4.5, -4], [4.8, -3.5], [-6, 2], [6.5, 2.5], [0, -7]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 24, 1, false, 0, Math.PI), silMat);
      t.position.set(x, TABLE_Y, z);
      t.rotation.y = Math.atan2(x, z) + Math.PI / 2;
      s.add(t);
      const l = new THREE.PointLight('#ffcf8a', 2.2, 3, 2);
      l.position.set(x, 2.2, z);
      s.add(l);
    }
  }

  buildTable() {
    const shape = new THREE.Shape();
    shape.moveTo(-R, BACK);
    shape.lineTo(R, BACK);
    shape.lineTo(R, 0);
    shape.absarc(0, 0, R, 0, Math.PI, true);
    shape.lineTo(-R, BACK);

    // Feutre
    const feltGeo = new THREE.ShapeGeometry(shape, 64);
    const pos = feltGeo.attributes.position, uv = feltGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      uv.setXY(i, (x + R) / (2 * R), (y + R) / (R + BACK));
    }
    this.feltMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
    const felt = this.felt = new THREE.Mesh(feltGeo, this.feltMat);
    felt.rotation.x = -Math.PI / 2;
    felt.position.y = TABLE_Y;
    felt.receiveShadow = true;
    this.scene.add(felt);

    // Caisse en bois sous le feutre
    const woodTex = canvasTexture(drawWood(), this.renderer);
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(4, 1);
    const woodMat = this.woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.45, metalness: 0.05 });
    const outer = new THREE.Shape();
    outer.moveTo(-R - 0.1, BACK + 0.03);
    outer.lineTo(R + 0.1, BACK + 0.03);
    outer.lineTo(R + 0.1, 0);
    outer.absarc(0, 0, R + 0.1, 0, Math.PI, true);
    outer.lineTo(-R - 0.1, BACK + 0.03);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.1, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, curveSegments: 64 }), woodMat);
    body.rotation.x = -Math.PI / 2;
    body.position.y = TABLE_Y - 0.125;
    body.castShadow = body.receiveShadow = true;
    this.scene.add(body);
    // Pied
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, TABLE_Y - 0.12, 24), new THREE.MeshStandardMaterial({ color: '#1a120d', roughness: 0.5 }));
    pedestal.position.set(0, (TABLE_Y - 0.12) / 2, 0.25);
    pedestal.castShadow = true;
    this.scene.add(pedestal);

    // Rembourrage en cuir
    const leatherTex = canvasTexture(drawLeather(), this.renderer);
    leatherTex.wrapS = leatherTex.wrapT = THREE.RepeatWrapping;
    leatherTex.repeat.set(30, 2);
    const leather = this.leatherMat = new THREE.MeshStandardMaterial({ color: '#2a1a14', roughness: 0.55, bumpMap: leatherTex, bumpScale: 0.6 });
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(a) * (R + 0.05), TABLE_Y + 0.012, Math.sin(a) * (R + 0.05)));
    }
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.055, 18, false), leather);
    rail.scale.y = 0.75;
    rail.position.y = (TABLE_Y + 0.012) * 0.25;
    rail.castShadow = rail.receiveShadow = true;
    this.scene.add(rail);
    for (const x of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 12), leather);
      cap.scale.y = 0.75;
      cap.position.set(x * (R + 0.05), TABLE_Y + 0.009, 0);
      this.scene.add(cap);
    }
    // Liseré du côté croupier
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2 * R + 0.2, 0.03, 0.04), woodMat);
    trim.position.set(0, TABLE_Y + 0.004, -BACK - 0.01);
    trim.castShadow = true;
    this.scene.add(trim);

    // Zones cliquables des places
    this.spotMeshes = [];
    this.spotRings = [];
    const ringMat = new THREE.MeshBasicMaterial({ color: '#f3d58a', transparent: true, opacity: 0, depthWrite: false });
    this.geo.spots.forEach((sp, i) => {
      const hit = new THREE.Mesh(new THREE.CircleGeometry(SPOT_R * 1.4, 32), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.rotation.x = -Math.PI / 2;
      hit.position.set(sp.x, TABLE_Y + 0.002, sp.z);
      hit.userData.spot = i;
      this.scene.add(hit);
      this.spotMeshes.push(hit);
      const ring = new THREE.Mesh(new THREE.RingGeometry(SPOT_R * 1.02, SPOT_R * 1.18, 48), ringMat.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(sp.x, TABLE_Y + 0.0015, sp.z);
      this.scene.add(ring);
      this.spotRings.push(ring);
    });

    // Marqueur de main active
    this.activeMarker = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.085, 48), new THREE.MeshBasicMaterial({ color: '#f3d58a', transparent: true, opacity: 0, depthWrite: false }));
    this.activeMarker.rotation.x = -Math.PI / 2;
    this.scene.add(this.activeMarker);
  }

  buildProps() {
    // Sabot
    const shoe = new THREE.Group();
    const prof = new THREE.Shape();
    prof.moveTo(0, 0); prof.lineTo(0.36, 0); prof.lineTo(0.36, 0.11); prof.lineTo(0.05, 0.11); prof.lineTo(0, 0.04); prof.lineTo(0, 0);
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#101012', roughness: 0.25, metalness: 0.3 });
    const sides = new THREE.Mesh(new THREE.ExtrudeGeometry(prof, { depth: 0.12, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004 }), shoeMat);
    sides.position.set(-0.36, 0, -0.06);
    shoe.add(sides);
    this.shoeCards = new THREE.Mesh(new THREE.BoxGeometry(1, 0.075, 0.09), new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: 0.8 }));
    this.shoeCards.position.set(-0.17, 0.075, 0);
    shoe.add(this.shoeCards);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.12), new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.8, roughness: 0.3 }));
    lip.position.set(0.0, 0.012, 0);
    shoe.add(lip);
    shoe.position.copy(SHOE_POS);
    shoe.rotation.y = Math.PI / 2 + 0.35;
    shoe.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(shoe);
    this.shoe = shoe;
    this.setShoeLevel(1, 1);
    this.shoeMouth = new THREE.Vector3(SHOE_POS.x - 0.06, TABLE_Y + 0.03, SHOE_POS.z + 0.15);

    // Bac à défausse
    const tray = new THREE.Group();
    const glass = new THREE.MeshPhysicalMaterial({ color: '#d9e6ee', roughness: 0.05, transmission: 0.6, thickness: 0.01, transparent: true, opacity: 0.45 });
    const w = CARD_W + 0.014, dpt = CARD_H + 0.014, h = 0.11;
    for (const [sx, sy, sz, x, y, z] of [[w, 0.004, dpt, 0, 0, 0], [0.004, h, dpt, -w / 2, h / 2, 0], [0.004, h, dpt, w / 2, h / 2, 0], [w, h, 0.004, 0, h / 2, -dpt / 2]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), glass);
      m.position.set(x, y, z);
      tray.add(m);
    }
    this.discardPile = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, 1, CARD_H), [
      new THREE.MeshStandardMaterial({ color: '#efe9dc' }), new THREE.MeshStandardMaterial({ color: '#efe9dc' }),
      new THREE.MeshStandardMaterial({ color: '#7a1622' }), new THREE.MeshStandardMaterial({ color: '#efe9dc' }),
      new THREE.MeshStandardMaterial({ color: '#efe9dc' }), new THREE.MeshStandardMaterial({ color: '#efe9dc' }),
    ]);
    this.discardPile.visible = false;
    tray.add(this.discardPile);
    tray.position.copy(DISCARD_POS);
    tray.rotation.y = -0.35;
    this.scene.add(tray);
    this.discardTray = tray;

    // Rack de jetons du croupier
    const rack = new THREE.Group();
    const rackMat = new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.35, metalness: 0.2 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.11), rackMat);
    base.position.y = 0.015;
    rack.add(base);
    this.chipMats = new Map();
    const geo = new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 32);
    this.chipGeo = geo;
    for (const den of CHIP_DENOMS) {
      const face = canvasTexture(drawChipFace(den), this.renderer);
      const edge = canvasTexture(drawChipEdge(den), this.renderer);
      edge.wrapS = THREE.RepeatWrapping;
      const side = new THREE.MeshStandardMaterial({ map: edge, roughness: 0.4 });
      const top = new THREE.MeshStandardMaterial({ map: face, roughness: 0.35 });
      this.chipMats.set(den.v, [side, top, top]);
    }
    const order = [1000, 500, 100, 100, 25, 25, 5, 5, 1, 1];
    order.forEach((v, i) => {
      const col = new THREE.Group();
      for (let k = 0; k < 22; k++) {
        const c = new THREE.Mesh(geo, this.chipMats.get(v));
        c.position.y = k * CHIP_H;
        col.add(c);
      }
      col.rotation.x = Math.PI / 2;
      col.position.set(-0.24 + i * 0.053, 0.05, -0.037);
      rack.add(col);
    });
    rack.position.copy(TRAY_POS);
    rack.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(rack);

    this.cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
    this.applyStyle();
  }

  // ---------------- Ressources réalistes ----------------
  async loadDealer(key) {
    try {
      if (!(this.dealer instanceof RealDealer)) {
        this.scene.remove(this.dealer.root);
        this.dealer = new RealDealer();
        this.dealer.root.position.set(0, 0, -0.74);
        this.scene.add(this.dealer.root);
      }
      await this.dealer.setSkin(REAL_SKINS[key] ? key : 'gilet', this.texRes === '2k' ? 'hd' : 'sd');
    } catch (e) {
      console.warn('[Blackjack Play] croupier réaliste indisponible, version simplifiée : ' + (e && e.stack || e));
      this.scene.remove(this.dealer.root);
      this.dealer = new Dealer('classique');
      this.dealer.root.position.set(0, 0, -0.74);
      this.dealer.restArms(true);
      this.scene.add(this.dealer.root);
    }
    if (this.onDealerChange) this.onDealerChange(this.dealer);
    return this.dealer;
  }

  loadPBR() {
    const tl = new THREE.TextureLoader();
    const res = this.texRes;
    const load = (name, srgb = false, repeat = null) => new Promise((resolve) => {
      tl.load(`tex/${name}.webp`, (t) => {
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        if (repeat) t.repeat.set(repeat[0], repeat[1]);
        t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        resolve(t);
      }, undefined, () => resolve(null));
    });
    const r2 = (n) => (res === '2k' ? `${n}_2k` : `${n}_1k`);
    // Bois : noyer teinté acajou, vernis
    Promise.all([load(r2('walnut_diff'), true, [3, 1]), load(r2('walnut_nor'), false, [3, 1]), load(r2('walnut_rough'), false, [3, 1])]).then(([d, n, r]) => {
      if (d) { this.woodMat.map = d; this.woodMat.color.set('#5a2c18'); }
      if (n) this.woodMat.normalMap = n;
      if (r) { this.woodMat.roughnessMap = r; this.woodMat.roughness = 0.55; }
      this.woodMat.needsUpdate = true;
    });
    // Cuir du rembourrage
    Promise.all([load('leather_diff_1k', true, [24, 1.5]), load(r2('leather_nor'), false, [24, 1.5]), load('leather_rough_1k', false, [24, 1.5])]).then(([d, n, r]) => {
      if (d) { this.leatherMat.map = d; this.leatherMat.color.set('#4a2c22'); }
      if (n) { this.leatherMat.normalMap = n; this.leatherMat.bumpMap = null; }
      if (r) this.leatherMat.roughnessMap = r;
      this.leatherMat.needsUpdate = true;
    });
    // Feutre : relief de laine
    Promise.all([load(r2('wool_nor'), false, [5, 3.5]), load('wool_rough_1k', false, [5, 3.5])]).then(([n, r]) => {
      if (n) { this.feltMat.normalMap = n; this.feltMat.normalScale.set(0.35, 0.35); }
      if (r) { this.feltMat.roughnessMap = r; this.feltMat.roughness = 1; }
      this.feltMat.needsUpdate = true;
    });
    // Moquette
    Promise.all([load('carpet_nor_1k', false, [14, 14]), load('carpet_rough_1k', false, [14, 14])]).then(([n, r]) => {
      if (n) this.floorMat.normalMap = n;
      if (r) this.floorMat.roughnessMap = r;
      this.floorMat.needsUpdate = true;
    });
    // Éclairage d'ambiance HDRI (salon boisé)
    new RGBELoader().load('tex/lounge_1k.hdr', (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromEquirectangular(hdr).texture;
      this.scene.environmentIntensity = 0.32;
      this.scene.environmentRotation = new THREE.Euler(0, 1.2, 0);
      hdr.dispose(); pm.dispose();
    });
  }

  // ---------------- Style ----------------
  applyStyle(rules) {
    if (rules) this.rules = rules;
    const r = this.rules || { insurance: true, blackjackPays: 1.5, dealerHitsSoft17: false };
    if (this.feltMat.map) this.feltMat.map.dispose();
    this.feltMat.map = canvasTexture(drawFelt(this.geo, r, this.style.felt), this.renderer);
    this.feltMat.needsUpdate = true;
    if (this.backTex) this.backTex.dispose();
    this.backTex = canvasTexture(drawCardBack(this.style.back), this.renderer);
    this.backMat = new THREE.MeshStandardMaterial({ map: this.backTex, roughness: 0.55, transparent: true, alphaTest: 0.5 });
    const backColor = { bordeaux: '#7a1622', marine: '#16325c', noir: '#141414', emeraude: '#0f4a35' }[this.style.back];
    this.discardPile.material[2].color.set(backColor || '#7a1622');
    for (const tex of this.faceTexCache.values()) tex.dispose();
    this.faceTexCache.clear();
    // Remplace les textures des cartes déjà posées
    const all = [...this.dealerCards, ...[...this.cardObjs.values()].flat()];
    for (const c of all) { c.front.material = this.faceMat(c.card); c.back.material = this.backMat; }
  }

  setStyle(patch) {
    const skinChanged = patch.skin && patch.skin !== this.style.skin;
    Object.assign(this.style, patch);
    this.applyStyle();
    if (skinChanged) this.dealerReady = this.loadDealer(this.style.skin);
  }

  faceMat(card) {
    const key = card.rank + card.suit;
    let tex = this.faceTexCache.get(key);
    if (!tex) {
      tex = canvasTexture(drawCardFace(card.rank, card.suit, this.style.indices), this.renderer);
      this.faceTexCache.set(key, tex);
    }
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, transparent: true, alphaTest: 0.5 });
  }

  // ---------------- Animation ----------------
  tween(duration, onUpdate, easing = ease.outCubic) {
    const d = duration * this.speed;
    if (d <= 0.001) { onUpdate(1); return Promise.resolve(); }
    return new Promise((resolve) => {
      this.tweens.push({ t: 0, d, onUpdate, easing, resolve });
    });
  }

  wait(sec) {
    const d = sec * this.speed;
    if (d <= 0.001) return Promise.resolve();
    return this.tween(sec, () => {});
  }

  loop() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const now = this.clock.elapsedTime;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.d);
      tw.onUpdate(tw.easing(k));
      if (k >= 1) { this.tweens.splice(i, 1); tw.resolve(); }
    }
    for (const b of this.bokeh) b.material.opacity = 0.35 + Math.sin(now * 0.8 + b.userData.phase) * 0.12;
    if (this.activeMarker.material.opacity > 0) this.activeMarker.material.opacity = 0.55 + Math.sin(now * 4) * 0.3;
    this.spotRings.forEach((r, i) => {
      const goal = i === this.hoverSpot ? 0.85 : (this.highlighted?.has(i) ? 0.35 + Math.sin(now * 3) * 0.15 : 0);
      r.material.opacity += (goal - r.material.opacity) * Math.min(1, dt * 10);
    });
    if (this.idleOrbit) {
      const a = now * 0.08;
      this.camera.position.set(Math.sin(a) * 2.2, TABLE_Y + 0.9, Math.cos(a) * 2.2);
      this.controls.target.set(0, TABLE_Y, 0);
    }
    this.dealer.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.onFrame) this.onFrame(dt);
  }

  setView(name, instant = false) {
    const p = CAMERA_PRESETS[name];
    if (!p) return Promise.resolve();
    this.idleOrbit = false;
    const fromPos = this.camera.position.clone(), fromT = this.controls.target.clone();
    const toPos = new THREE.Vector3(...p.pos), toT = new THREE.Vector3(...p.target);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (name === 'joueur' && w / h < 0.9) toPos.set(0, TABLE_Y + 1.3, 1.9);
    if (instant) { this.camera.position.copy(toPos); this.controls.target.copy(toT); return Promise.resolve(); }
    const s = this.speed; this.speed = 1;
    const pr = this.tween(0.9, (k) => {
      this.camera.position.lerpVectors(fromPos, toPos, k);
      this.controls.target.lerpVectors(fromT, toT, k);
    }, ease.inOutCubic);
    this.speed = s;
    return pr;
  }

  // ---------------- Interaction ----------------
  bindPointer() {
    const el = this.renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt = null;
    const pick = (e) => {
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      const hit = ray.intersectObjects(this.spotMeshes)[0];
      return hit ? hit.object.userData.spot : -1;
    };
    el.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6;
      downAt = null;
      if (moved) return;
      const s = pick(e);
      if (s >= 0 && this.onSpotClick) this.onSpotClick(s, e.button === 2 || e.shiftKey ? 'remove' : 'add');
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointermove', (e) => {
      const s = pick(e);
      if (s !== this.hoverSpot) {
        this.hoverSpot = this.spotsEnabled ? s : -1;
        el.style.cursor = this.hoverSpot >= 0 ? 'pointer' : '';
        if (this.onSpotHover) this.onSpotHover(this.hoverSpot);
      }
    });
  }

  setSpotsEnabled(on, highlighted = []) {
    this.spotsEnabled = on;
    this.highlighted = new Set(on ? highlighted : []);
    if (!on) this.hoverSpot = -1;
  }

  project(v) {
    const p = v.clone().project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 && p.z > -1 };
  }

  // ---------------- Géométrie des mains ----------------
  handFrame(seat, splitIndex = 0, nHands = 1) {
    const a = spotAngle(seat);
    const radial = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const toCenter = radial.clone().negate();
    const right = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
    const spacing = nHands > 3 ? 0.088 : nHands > 2 ? 0.096 : 0.106;
    const off = ((nHands - 1) / 2 - splitIndex) * spacing;
    const base = radial.clone().multiplyScalar(CARD_RADIUS).add(right.clone().multiplyScalar(off));
    base.y = TABLE_Y;
    return { base, right, toCenter, radial, yaw: Math.PI / 2 - a };
  }

  cardSlot(seat, splitIndex, nHands, cardIndex, doubled = false) {
    const f = this.handFrame(seat, splitIndex, nHands);
    const j = cardIndex;
    const p = f.base.clone()
      .add(f.right.clone().multiplyScalar(0.017 * j - 0.008))
      .add(f.toCenter.clone().multiplyScalar(0.024 * j));
    p.y = TABLE_Y + 0.0012 + j * 0.0006;
    const yaw = doubled ? f.yaw + Math.PI / 2 : f.yaw;
    return { pos: p, yaw };
  }

  dealerSlot(i) {
    return { pos: new THREE.Vector3(-0.042 + i * 0.058, TABLE_Y + 0.0012 + i * 0.0006, DEALER_Z), yaw: 0 };
  }

  handLabelPos(seat, splitIndex, nHands) {
    const f = this.handFrame(seat, splitIndex, nHands);
    return f.base.clone().add(f.toCenter.clone().multiplyScalar(0.115)).setY(TABLE_Y + 0.02);
  }

  betPos(seat, splitIndex = 0, nHands = 1) {
    const f = this.handFrame(seat, splitIndex, nHands);
    return f.base.clone().add(f.radial.clone().multiplyScalar(BET_RADIUS - CARD_RADIUS)).setY(TABLE_Y);
  }

  dealerLabelPos() { return new THREE.Vector3(0.0, TABLE_Y + 0.02, DEALER_Z + 0.075); }

  // ---------------- Cartes ----------------
  makeCard(card, faceUp) {
    const pivot = new THREE.Group();     // position + lacet
    const flipper = new THREE.Group();   // retournement
    pivot.add(flipper);
    const front = new THREE.Mesh(this.cardGeo, this.faceMat(card));
    const back = new THREE.Mesh(this.cardGeo, this.backMat);
    back.rotation.y = Math.PI;
    front.castShadow = back.castShadow = true;
    front.receiveShadow = back.receiveShadow = true;
    flipper.add(front, back);
    flipper.rotation.x = faceUp ? -Math.PI / 2 : Math.PI / 2;
    this.scene.add(pivot);
    return { pivot, flipper, front, back, card, faceUp };
  }

  // Animation de distribution depuis le sabot
  async dealTo(card, slot, faceUp, side = 1) {
    const obj = this.makeCard(card, false);
    const from = this.shoeMouth.clone();
    obj.pivot.position.copy(from);
    obj.pivot.rotation.y = 0.35;
    // Le croupier tend la main vers le sabot puis vers la cible
    this.dealer.reach(1, from.clone().add(new THREE.Vector3(-0.04, 0.02, 0.02)));
    const reachSide = slot.pos.x < -0.1 ? -1 : 1;
    this.dealer.lookAt(slot.pos.clone().setY(TABLE_Y + 0.3));
    await this.wait(0.07);
    if (this.onSound) this.onSound('slide');
    const to = slot.pos.clone();
    const y0 = from.y, lift = 0.05;
    const yawFrom = 0.35;
    // Toutes les cartes partent face cachée et se retournent pendant le vol
    const flipTo = faceUp ? -Math.PI / 2 : Math.PI / 2;
    this.dealer.reach(reachSide, from.clone().lerp(to, 0.45).setY(TABLE_Y + 0.05));
    await this.tween(0.36, (k) => {
      obj.pivot.position.lerpVectors(from, to, k);
      obj.pivot.position.y = y0 + (to.y - y0) * k + Math.sin(k * Math.PI) * lift;
      obj.pivot.rotation.y = yawFrom + (slot.yaw - yawFrom) * k;
      obj.flipper.rotation.x = Math.PI / 2 + (flipTo - Math.PI / 2) * Math.min(1, k * 1.25);
    }, ease.outCubic);
    obj.faceUp = faceUp;
    if (this.onSound) this.onSound('place');
    this.dealer.restArms();
    return obj;
  }

  async flip(obj, faceUp = true) {
    const from = obj.flipper.rotation.x, to = faceUp ? -Math.PI / 2 : Math.PI / 2;
    const y = obj.pivot.position.y;
    this.dealer.reach(1, obj.pivot.position.clone().setY(TABLE_Y + 0.03));
    if (this.onSound) this.onSound('flip');
    await this.tween(0.32, (k) => {
      obj.flipper.rotation.x = from + (to - from) * k;
      obj.pivot.position.y = y + Math.sin(k * Math.PI) * 0.03;
    }, ease.inOutCubic);
    obj.faceUp = faceUp;
    this.dealer.restArms();
  }

  async moveCard(obj, slot, dur = 0.3) {
    const from = obj.pivot.position.clone(), yaw0 = obj.pivot.rotation.y;
    await this.tween(dur, (k) => {
      obj.pivot.position.lerpVectors(from, slot.pos, k);
      obj.pivot.rotation.y = yaw0 + (slot.yaw - yaw0) * k;
    });
  }

  async dealToHand(card, hand, nHands, faceUp = true) {
    const key = hand.id;
    if (!this.cardObjs.has(key)) this.cardObjs.set(key, []);
    const list = this.cardObjs.get(key);
    const doubled = hand.doubled && list.length === 2;
    const slot = this.cardSlot(hand.seat, hand.splitIndex, nHands, list.length, doubled);
    if (doubled) slot.pos.add(new THREE.Vector3(0, 0.0005, 0));
    const obj = await this.dealTo(card, slot, faceUp);
    list.push(obj);
    return obj;
  }

  async dealToDealer(card, faceUp) {
    const slot = this.dealerSlot(this.dealerCards.length);
    const obj = await this.dealTo(card, slot, faceUp);
    this.dealerCards.push(obj);
    return obj;
  }

  // Carte brûlée : directement dans la défausse
  async burnCard(card) {
    const slot = { pos: DISCARD_POS.clone().add(new THREE.Vector3(0, 0.03 + this.discardCount * 0.0003, 0)), yaw: -0.35 };
    const obj = await this.dealTo(card, slot, false);
    this.scene.remove(obj.pivot);
    obj.front.material.dispose();
    this.setDiscard(this.discardCount + 1);
  }

  // Le croupier vérifie discrètement sa carte cachée
  async peekHole() {
    const obj = this.dealerCards[1];
    if (!obj) return;
    this.dealer.reach(1, obj.pivot.position.clone().setY(TABLE_Y + 0.03));
    this.dealer.lookAt(obj.pivot.position.clone());
    const r0 = obj.flipper.rotation.x;
    await this.tween(0.35, (k) => { obj.flipper.rotation.x = r0 - Math.sin(k * Math.PI) * 0.35; });
    this.dealer.restArms();
    this.lookAtPlayers();
  }

  async revealHole() {
    const obj = this.dealerCards[1];
    if (obj && !obj.faceUp) await this.flip(obj, true);
  }

  // Après séparation : déplace la carte vers la nouvelle main et réorganise la place
  async relayoutSeat(seat, hands) {
    const n = hands.length;
    // Associe chaque carte (objet unique) à son objet 3D, quelle que soit la main d'origine
    const byCard = new Map();
    for (const h of hands) for (const obj of this.cardObjs.get(h.id) || []) byCard.set(obj.card, obj);
    const moves = [];
    for (const h of hands) {
      const list = h.cards.map((c) => byCard.get(c)).filter(Boolean);
      this.cardObjs.set(h.id, list);
      list.forEach((obj, j) => moves.push(this.moveCard(obj, this.cardSlot(h.seat, h.splitIndex, n, j, h.doubled && j === 2), 0.35)));
    }
    await Promise.all(moves);
  }

  setActive(hand, nHands) {
    if (!hand) { this.activeMarker.material.opacity = 0; return; }
    const f = this.handFrame(hand.seat, hand.splitIndex, nHands);
    this.activeMarker.position.copy(f.base).setY(TABLE_Y + 0.001);
    this.activeMarker.material.opacity = 0.6;
    this.dealer.lookAt(f.base.clone().add(f.radial.clone().multiplyScalar(0.8)).setY(TABLE_Y + 0.45));
  }

  lookAtPlayers() { this.dealer.lookAt(new THREE.Vector3(0, TABLE_Y + 0.4, 1.6)); }

  // Ramasse toutes les cartes vers la défausse
  async collectCards() {
    const all = [...[...this.cardObjs.values()].flat(), ...this.dealerCards];
    if (!all.length) return;
    this.dealer.reach(-1, new THREE.Vector3(-0.3, TABLE_Y + 0.04, 0.1));
    if (this.onSound) this.onSound('sweep');
    const target = DISCARD_POS.clone().add(new THREE.Vector3(0, 0.02 + this.discardCount * 0.0003, 0));
    const moves = all.map((obj, i) => {
      const from = obj.pivot.position.clone(), yaw0 = obj.pivot.rotation.y, fl0 = obj.flipper.rotation.x;
      return this.wait(i * 0.025).then(() => this.tween(0.45, (k) => {
        obj.pivot.position.lerpVectors(from, target, k);
        obj.pivot.position.y += Math.sin(k * Math.PI) * 0.06;
        obj.pivot.rotation.y = yaw0 + (-0.35 - yaw0) * k;
        obj.flipper.rotation.x = fl0 + (Math.PI / 2 - fl0) * k;
      }, ease.inOutCubic));
    });
    await Promise.all(moves);
    for (const obj of all) {
      this.scene.remove(obj.pivot);
      obj.front.material.dispose();
    }
    this.cardObjs.clear();
    this.dealerCards = [];
    this.dealer.restArms();
  }

  clearCardsInstant() {
    const all = [...[...this.cardObjs.values()].flat(), ...this.dealerCards];
    for (const obj of all) { this.scene.remove(obj.pivot); obj.front.material.dispose(); }
    this.cardObjs.clear();
    this.dealerCards = [];
  }

  setDiscard(count) {
    this.discardCount = count;
    const h = count * 0.0003;
    this.discardPile.visible = count > 0;
    this.discardPile.scale.y = Math.max(0.0001, h);
    this.discardPile.position.y = 0.004 + h / 2;
  }

  setShoeLevel(remaining, total) {
    const frac = Math.max(0.02, remaining / total);
    const len = 0.3 * frac;
    this.shoeCards.scale.x = len;
    this.shoeCards.position.x = -0.04 - len / 2 - (0.3 - len) * 0.15;
  }

  async shuffleAnim() {
    if (this.onSound) this.onSound('shuffle');
    this.dealer.reach(-1, DISCARD_POS.clone().add(new THREE.Vector3(0.05, 0.06, 0.1)));
    this.dealer.reach(1, SHOE_POS.clone().add(new THREE.Vector3(-0.1, 0.08, 0.1)));
    const pile = this.discardPile;
    const h0 = pile.scale.y;
    await this.tween(1.2, (k) => {
      pile.scale.y = Math.max(0.0001, h0 * (1 - k));
      pile.position.y = 0.004 + pile.scale.y / 2;
    }, ease.inOutCubic);
    this.setDiscard(0);
    this.dealer.restArms();
  }

  // ---------------- Jetons ----------------
  static decompose(amount) {
    const out = [];
    let left = Math.round(amount * 2) / 2;
    for (const den of [...CHIP_DENOMS].reverse()) {
      while (left >= den.v - 1e-9 && out.length < 60) { out.push(den.v); left -= den.v; }
    }
    if (left > 0.01) out.push(1); // demi-unités (paiement 3:2) arrondies visuellement
    return out;
  }

  buildStack(amount) {
    const g = new THREE.Group();
    const chips = TableScene.decompose(amount);
    let col = 0, h = 0;
    chips.forEach((v, i) => {
      if (h >= 18) { col++; h = 0; }
      const m = new THREE.Mesh(this.chipGeo, this.chipMats.get(v));
      m.position.set(col * CHIP_R * 2.1, CHIP_H / 2 + h * CHIP_H, 0);
      m.rotation.y = Math.random() * Math.PI * 2;
      m.position.x += (Math.random() - 0.5) * 0.0015;
      m.position.z += (Math.random() - 0.5) * 0.0015;
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      h++;
    });
    return g;
  }

  setStack(key, amount, pos) {
    const old = this.betStacks.get(key);
    if (old) this.scene.remove(old);
    if (!amount) { this.betStacks.delete(key); return null; }
    const g = this.buildStack(amount);
    g.position.copy(pos).setY(TABLE_Y + 0.0005);
    this.scene.add(g);
    this.betStacks.set(key, g);
    return g;
  }

  removeStack(key) { this.setStack(key, 0); }

  async moveStack(key, toPos, remove = false, dur = 0.45) {
    const g = this.betStacks.get(key);
    if (!g) return;
    const from = g.position.clone();
    await this.tween(dur, (k) => {
      g.position.lerpVectors(from, toPos, k);
      g.position.y = TABLE_Y + 0.0005 + Math.sin(k * Math.PI) * 0.05;
    }, ease.inOutCubic);
    if (remove) { this.scene.remove(g); this.betStacks.delete(key); }
  }

  // Paiement : une pile part du rack et vient se poser à côté de la mise
  async payStack(key, amount, toPos) {
    const g = this.buildStack(amount);
    const from = TRAY_POS.clone().setY(TABLE_Y + 0.05);
    g.position.copy(from);
    this.scene.add(g);
    this.betStacks.set(key, g);
    this.dealer.reach(toPos.x >= 0 ? 1 : -1, from.clone().lerp(toPos, 0.4));
    await this.tween(0.45, (k) => {
      g.position.lerpVectors(from, toPos, k);
      g.position.y = TABLE_Y + 0.0005 + Math.sin(k * Math.PI) * 0.06;
    }, ease.inOutCubic);
    this.dealer.restArms();
  }

  trayPos() { return TRAY_POS.clone().setY(TABLE_Y + 0.04); }

  clearStacks() {
    for (const g of this.betStacks.values()) this.scene.remove(g);
    this.betStacks.clear();
  }

  screenshot() { return this.renderer.domElement.toDataURL('image/png'); }
}
