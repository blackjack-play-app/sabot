// Croupier réaliste : avatars Microsoft Rocketbox (MIT), animés procéduralement sur le squelette.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/meshopt_decoder.module.js';

export const REAL_SKINS = {
  gilet: { label: 'Gilet gris', file: 'gilet', female: false, height: 1.78 },
  smoking: { label: 'Costume noir', file: 'smoking', female: false, height: 1.8 },
  chemise: { label: 'Chemise blanche', file: 'chemise', female: false, height: 1.78 },
  marine: { label: 'Costume marine', file: 'marine', female: false, height: 1.79 },
  croupiere: { label: 'Croupière', file: 'croupiere', female: true, height: 1.68 },
  bordeaux: { label: 'Veste bordeaux', file: 'bordeaux', female: true, height: 1.66 },
};

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

// Oriente `bone` pour que la direction vers son enfant pointe vers `worldDir`.
function aimBone(bone, childLocalDir, worldDir, weight = 1) {
  bone.updateWorldMatrix(true, false);
  const wq = bone.getWorldQuaternion(_q1);
  const cur = _v1.copy(childLocalDir).applyQuaternion(wq).normalize();
  const delta = _q2.setFromUnitVectors(cur, _v2.copy(worldDir).normalize());
  if (weight < 1) delta.slerp(new THREE.Quaternion(), 1 - weight);
  const newWorld = delta.multiply(wq);
  const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentQ.invert().multiply(newWorld));
  bone.updateWorldMatrix(false, true);
}

// Applique une rotation exprimée dans le repère monde à un os.
function rotateWorld(bone, axis, angle) {
  bone.updateWorldMatrix(true, false);
  const wq = bone.getWorldQuaternion(new THREE.Quaternion());
  const r = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const nw = r.multiply(wq);
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(pq.multiply(nw));
  bone.updateWorldMatrix(false, true);
}

export class RealDealer {
  constructor() {
    this.root = new THREE.Group();
    this.time = 0;
    this.talk = 0;
    this.blinkT = 2.5;
    this.lookTarget = new THREE.Vector3(0, 1.2, 1.6);
    this.look = new THREE.Vector2(0, 0);
    this.tableY = 0.86;
    this.lean = 0; this.leanGoal = 0;
    this.arms = {
      1: { goal: new THREE.Vector3(), target: new THREE.Vector3() },
      [-1]: { goal: new THREE.Vector3(), target: new THREE.Vector3() },
    };
    this.ready = false;
    this.quality = 'hd';
  }

  async setSkin(key, quality = this.quality) {
    const skin = REAL_SKINS[key] || REAL_SKINS.gilet;
    this.quality = quality;
    this.skinKey = key;
    this.female = skin.female;
    const url = `models/${skin.file}_${quality}.glb`;
    let gltf = cache.get(url);
    if (!gltf) {
      gltf = await loader.loadAsync(url);
      cache.set(url, gltf);
    }
    if (this.model) this.root.remove(this.model);
    const model = gltf.scene;
    this.model = model;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        if (o.material.map) o.material.map.anisotropy = 8;
      }
    });
    // Mise à l'échelle et orientation (+z vers les joueurs)
    model.scale.setScalar(1);
    model.rotation.set(0, 0, 0);
    model.position.set(0, 0, 0);
    this.root.add(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    const s = skin.height / h;
    model.scale.setScalar(s);
    model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model);
    model.position.y -= box2.min.y;

    const B = (n) => model.getObjectByName(n) || model.getObjectByName(n.replace(/ /g, '_'));
    this.bones = {
      pelvis: B('Bip01 Pelvis'), spine: B('Bip01 Spine'), spine1: B('Bip01 Spine1'), spine2: B('Bip01 Spine2'),
      neck: B('Bip01 Neck'), head: B('Bip01 Head'), jaw: B('Bip01 MJaw'),
      lEye: B('Bip01 LEye'), rEye: B('Bip01 REye'),
      blink: ['Bip01 LEyeBlinkTop', 'Bip01 REyeBlinkTop'].map(B).filter(Boolean),
      blinkB: ['Bip01 LEyeBlinkBottom', 'Bip01 REyeBlinkBottom'].map(B).filter(Boolean),
      L: { clav: B('Bip01 L Clavicle'), upper: B('Bip01 L UpperArm'), fore: B('Bip01 L Forearm'), hand: B('Bip01 L Hand'), finger: B('Bip01 L Finger2') },
      R: { clav: B('Bip01 R Clavicle'), upper: B('Bip01 R UpperArm'), fore: B('Bip01 R Forearm'), hand: B('Bip01 R Hand'), finger: B('Bip01 R Finger2') },
    };
    // Pose de référence et directions vers les enfants
    this.rest = new Map();
    model.traverse((o) => { if (o.isBone) this.rest.set(o, { q: o.quaternion.clone(), p: o.position.clone() }); });
    for (const side of ['L', 'R']) {
      const c = this.bones[side];
      c.upperDir = c.fore.position.clone().normalize();
      c.foreDir = c.hand.position.clone().normalize();
      c.handDir = c.finger ? c.finger.position.clone().normalize() : new THREE.Vector3(1, 0, 0);
      model.updateMatrixWorld(true);
      const pU = c.upper.getWorldPosition(new THREE.Vector3());
      const pF = c.fore.getWorldPosition(new THREE.Vector3());
      const pH = c.hand.getWorldPosition(new THREE.Vector3());
      c.a = pU.distanceTo(pF); c.b = pF.distanceTo(pH);
      // Côté monde : le bras gauche du personnage est en +x lorsqu'il regarde +z
      c.worldSide = Math.sign(pH.x - this.root.position.x) || (side === 'L' ? 1 : -1);
    }
    // Si le modèle regarde -z, on le retourne (la main gauche doit être en +x)
    if (this.bones.L.worldSide < 0) {
      model.rotation.y = Math.PI;
      model.updateMatrixWorld(true);
      for (const side of ['L', 'R']) this.bones[side].worldSide *= -1;
    }
    // Bras gauche du personnage = côté +x
    this.sideMap = { 1: this.bones.L.worldSide > 0 ? 'L' : 'R', [-1]: this.bones.L.worldSide > 0 ? 'R' : 'L' };
    this.jawDir = this.bones.jaw ? this.bones.jaw.position.clone() : null;
    this.ready = true;
    this.restArms(true);
    return this;
  }

  restArms(snap = false) {
    const z = this.root.position.z + 0.34;
    for (const side of [-1, 1]) {
      const a = this.arms[side];
      a.goal.set(this.root.position.x + side * 0.15, this.tableY + 0.025, z);
      if (snap) a.target.copy(a.goal);
    }
    this.leanGoal = 0;
  }

  reach(side, worldPoint) {
    this.arms[side].goal.copy(worldPoint);
    const d = Math.hypot(worldPoint.x - this.root.position.x, worldPoint.z - this.root.position.z);
    this.leanGoal = THREE.MathUtils.clamp((d - 0.45) * 0.45, 0, 0.22);
  }

  lookAt(p) { this.lookTarget.copy(p); }
  speak(ms) { this.talk = Math.max(this.talk, ms / 1000); }

  resetPose() {
    for (const [b, r] of this.rest) { b.quaternion.copy(r.q); b.position.copy(r.p); }
    this.model.updateMatrixWorld(true);
  }

  solveArm(side) {
    const c = this.bones[this.sideMap[side]];
    if (!c.upper) return;
    const T = this.arms[side].target;
    const S = c.upper.getWorldPosition(new THREE.Vector3());
    const d = T.clone().sub(S);
    let L = d.length();
    const a = c.a, b = c.b;
    L = THREE.MathUtils.clamp(L, Math.abs(a - b) + 0.02, a + b - 0.004);
    const dir = d.normalize();
    const cosA = (a * a + L * L - b * b) / (2 * a * L);
    const alpha = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
    // Coude vers l'extérieur, le bas et l'arrière
    const pole = new THREE.Vector3(side * 0.9, -1, -0.5).normalize();
    const n = new THREE.Vector3().crossVectors(dir, pole).normalize();
    // Rotation autour de (dir × pole) d'un angle positif : le bras s'écarte vers le pôle, donc le coude part vers l'extérieur
    const upperDir = dir.clone().applyAxisAngle(n, alpha);
    aimBone(c.upper, c.upperDir, upperDir);
    const E = c.fore.getWorldPosition(new THREE.Vector3());
    aimBone(c.fore, c.foreDir, T.clone().sub(E));
    // Main : doigts vers l'avant et légèrement vers le bas
    const fwd = new THREE.Vector3(T.x - S.x, 0, T.z - S.z).normalize();
    fwd.y = -0.45;
    aimBone(c.hand, c.handDir, fwd, 0.85);
  }

  update(dt) {
    if (!this.ready) return;
    this.time += dt;
    this.resetPose();
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    const bn = this.bones;

    // Penché vers la table + respiration
    this.lean += (this.leanGoal - this.lean) * Math.min(1, dt * 4);
    const breathe = Math.sin(this.time * 1.5) * 0.012;
    if (bn.spine) rotateWorld(bn.spine, right, 0.06 + this.lean * 0.5);
    if (bn.spine1) rotateWorld(bn.spine1, right, 0.03 + this.lean * 0.3 + breathe);
    if (bn.spine2) rotateWorld(bn.spine2, up, Math.sin(this.time * 0.33) * 0.025);

    // Regard
    const head = bn.head.getWorldPosition(new THREE.Vector3());
    const to = this.lookTarget.clone().sub(head);
    const yaw = THREE.MathUtils.clamp(Math.atan2(to.x, to.z), -0.85, 0.85);
    const pitch = THREE.MathUtils.clamp(Math.atan2(-to.y, Math.hypot(to.x, to.z)), -0.3, 0.6);
    const k = Math.min(1, dt * 5);
    this.look.x += (yaw - this.look.x) * k;
    this.look.y += (pitch - this.look.y) * k;
    const idleY = Math.sin(this.time * 0.7) * 0.02, idleP = Math.sin(this.time * 0.9 + 1) * 0.015;
    if (bn.neck) { rotateWorld(bn.neck, up, this.look.x * 0.4); rotateWorld(bn.neck, right, this.look.y * 0.4); }
    rotateWorld(bn.head, up, this.look.x * 0.6 + idleY);
    rotateWorld(bn.head, right, this.look.y * 0.6 + idleP);

    // Bras
    for (const side of [-1, 1]) {
      const arm = this.arms[side];
      arm.target.lerp(arm.goal, Math.min(1, dt * 8));
      this.solveArm(side);
    }

    // Mâchoire : bouge quand le croupier parle
    if (bn.jaw) {
      let open = 0;
      if (this.talk > 0) {
        this.talk -= dt;
        open = (0.5 + 0.5 * Math.sin(this.time * 17)) * (0.6 + 0.4 * Math.sin(this.time * 5.3)) * 0.16;
      }
      if (open > 0) rotateWorld(bn.jaw, right, open);
    }
    // Clignement des yeux : paupière supérieure descend
    this.blinkT -= dt;
    let closed = 0;
    if (this.blinkT < 0.14) closed = 1 - Math.abs(this.blinkT - 0.07) / 0.07;
    if (this.blinkT < 0) this.blinkT = 2.2 + Math.random() * 4;
    if (closed > 0) {
      for (const b of bn.blink) {
        const r = this.rest.get(b);
        const wDown = new THREE.Vector3(0, -0.0085 * closed, 0.001 * closed);
        // Conversion d'un déplacement monde en local
        const parentInv = b.parent.matrixWorld.clone().invert();
        const wp = b.getWorldPosition(new THREE.Vector3()).add(wDown).applyMatrix4(parentInv);
        b.position.copy(wp);
        void r;
      }
    }
  }
}
