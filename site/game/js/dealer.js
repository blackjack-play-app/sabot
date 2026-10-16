// Croupier 3D procédural : tenues, respiration, clignements, regard, bras avec IK pour distribuer.
import * as THREE from 'three';

export const DEALER_SKINS = {
  classique: { label: 'Classique', vest: '#1a1a1d', shirt: '#f2f0ea', tie: '#111', sleeves: 'shirt', hair: '#2b1d14', skin: '#e2b48f', hairStyle: 'short', trim: '#8a7a55' },
  montecarlo: { label: 'Monte-Carlo', vest: '#0c0c0e', shirt: '#f6f5f0', tie: '#0c0c0e', sleeves: 'vest', hair: '#4a3626', skin: '#d9a07a', hairStyle: 'slick', trim: '#2a2a2a', lapel: true },
  vegas: { label: 'Las Vegas', vest: '#8e1b25', shirt: '#f4f1e8', tie: '#1a1a1a', sleeves: 'shirt', hair: '#141210', skin: '#a9714c', hairStyle: 'short', trim: '#d4af37' },
  croupiere: { label: 'Croupière', vest: '#4b1a2a', shirt: '#f4f0ea', tie: '#c9a24a', sleeves: 'shirt', hair: '#5a2e1b', skin: '#eac2a0', hairStyle: 'bun', trim: '#c9a24a' },
  clubprive: { label: 'Club privé', vest: '#1d3b2c', shirt: '#efece4', tie: '#6d1820', sleeves: 'shirt', hair: '#9c9a96', skin: '#d8ab88', hairStyle: 'short', trim: '#b89a5a', glasses: true },
  macao: { label: 'Macao', vest: '#1e2a4a', shirt: '#f3f2ee', tie: '#c9a24a', sleeves: 'vest', hair: '#0f0e0d', skin: '#efcfae', hairStyle: 'bob', trim: '#c9a24a', lapel: true },
};

const mat = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });

export class Dealer {
  constructor(skinKey = 'classique') {
    this.root = new THREE.Group();
    this.time = 0;
    this.blinkT = 2;
    this.talk = 0;
    this.lookTarget = new THREE.Vector3(0, 1.3, 1.5);
    this.headYaw = 0; this.headPitch = 0;
    this.arms = {};
    this.tableY = 0.86;
    this.build(skinKey);
  }

  build(skinKey) {
    const s = DEALER_SKINS[skinKey] || DEALER_SKINS.classique;
    this.skin = s;
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    const M = {
      vest: mat(s.vest, 0.6), shirt: mat(s.shirt, 0.8), tie: mat(s.tie, 0.5), skin: mat(s.skin, 0.65),
      hair: mat(s.hair, 0.9), trim: mat(s.trim, 0.35, { metalness: 0.6 }), dark: mat('#151515', 0.5), pants: mat('#121214', 0.8),
      eye: mat('#1b1410', 0.3), white: mat('#f4f1ea', 0.3), lip: mat('#9a4f48', 0.6),
    };
    this.M = M;
    const shadow = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

    // Jambes / bassin (cachés par la table mais visibles en vue libre)
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.95, 20), M.pants);
    legs.position.y = 0.48; legs.scale.z = 0.7;
    this.root.add(legs);

    // Torse : profil tourné
    this.body = new THREE.Group();
    this.body.position.y = 0.9;
    this.root.add(this.body);
    const prof = [[0.0, 0], [0.17, 0], [0.18, 0.1], [0.17, 0.25], [0.19, 0.38], [0.215, 0.5], [0.2, 0.56], [0.12, 0.6], [0.06, 0.62], [0, 0.62]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const torsoGeo = new THREE.LatheGeometry(prof, 32);
    const shirt = new THREE.Mesh(torsoGeo, M.shirt);
    shirt.scale.z = 0.62;
    this.body.add(shirt);
    // Gilet : même forme légèrement plus large, ouvert en V à l'avant
    const vestProf = prof.slice(0, 7).map((v) => new THREE.Vector2(v.x + 0.006, v.y));
    const vestGeo = new THREE.LatheGeometry(vestProf, 32, Math.PI * 0.1, Math.PI * 1.8);
    const vest = new THREE.Mesh(vestGeo, M.vest.clone());
    vest.material.side = THREE.DoubleSide;
    vest.scale.z = 0.62;
    this.body.add(vest);
    // Boutons
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), M.trim);
      b.position.set(0, 0.12 + i * 0.08, 0.121);
      this.body.add(b);
    }
    if (s.lapel) {
      for (const side of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.01), M.dark);
        l.position.set(side * 0.06, 0.42, 0.115);
        l.rotation.z = side * 0.35;
        this.body.add(l);
      }
    }
    // Noeud papillon
    const bow = new THREE.Group();
    bow.position.set(0, 0.565, 0.085);
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.045, 4), M.tie);
      w.rotation.z = side * Math.PI / 2;
      w.position.x = side * 0.022;
      bow.add(w);
    }
    bow.add(new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), M.tie));
    this.body.add(bow);
    // Badge
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.004), M.trim);
    badge.position.set(-0.09, 0.42, 0.112);
    badge.rotation.y = -0.3;
    this.body.add(badge);

    // Cou + tête
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 16), M.skin);
    neck.position.y = 0.64;
    this.body.add(neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.7;
    this.body.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 24), M.skin);
    skull.scale.set(0.92, 1.12, 1.0);
    skull.position.y = 0.09;
    this.head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), M.skin);
    jaw.position.set(0, 0.03, 0.025);
    jaw.scale.set(1, 0.8, 1);
    this.head.add(jaw);
    // Oreilles
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), M.skin);
      e.scale.set(0.5, 1, 0.8);
      e.position.set(side * 0.092, 0.09, 0);
      this.head.add(e);
    }
    // Nez
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 10), M.skin);
    nose.position.set(0, 0.075, 0.1);
    nose.rotation.x = Math.PI / 2.4;
    this.head.add(nose);
    // Yeux
    this.eyes = [];
    for (const side of [-1, 1]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), M.white);
      white.position.set(side * 0.034, 0.105, 0.083);
      white.scale.z = 0.6;
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), M.eye);
      pupil.position.set(0, 0, 0.009);
      white.add(pupil);
      this.head.add(white);
      this.eyes.push(white);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.008), M.hair);
      brow.position.set(side * 0.035, 0.13, 0.09);
      brow.rotation.z = side * -0.12;
      this.head.add(brow);
    }
    // Bouche
    this.mouth = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.006, 0.006), M.lip);
    this.mouth.position.set(0, 0.035, 0.095);
    this.head.add(this.mouth);
    // Cheveux
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.106, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair);
    hairCap.scale.set(0.95, 1.1, 1.05);
    hairCap.position.set(0, 0.105, -0.01);
    hairCap.rotation.x = -0.25;
    this.head.add(hairCap);
    if (s.hairStyle === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), M.hair);
      bun.position.set(0, 0.17, -0.09);
      this.head.add(bun);
      const back = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), M.hair);
      back.position.set(0, 0.08, -0.03); back.scale.set(0.95, 1.05, 0.9);
      this.head.add(back);
    } else if (s.hairStyle === 'bob') {
      const bob = new THREE.Mesh(new THREE.SphereGeometry(0.112, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.75), M.hair);
      bob.position.set(0, 0.09, -0.015); bob.scale.set(1.0, 1.1, 1.0); bob.rotation.x = -0.5;
      this.head.add(bob);
    } else if (s.hairStyle === 'slick') {
      hairCap.scale.set(0.97, 1.05, 1.1);
    }
    if (s.glasses) {
      for (const side of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0025, 8, 24), M.dark);
        ring.position.set(side * 0.034, 0.105, 0.095);
        this.head.add(ring);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.003, 0.003), M.dark);
      bridge.position.set(0, 0.108, 0.097);
      this.head.add(bridge);
    }

    // Bras (épaule -> coude -> main)
    const sleeveMat = s.sleeves === 'vest' ? M.vest : M.shirt;
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.2, 0.52, 0);
      this.body.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.24, 6, 14), sleeveMat);
      upper.position.y = -0.15;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.22, 6, 14), sleeveMat);
      fore.position.y = -0.13;
      elbow.add(fore);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 14), s.sleeves === 'vest' ? M.shirt : M.trim);
      cuff.position.y = -0.255;
      elbow.add(cuff);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), M.skin);
      hand.scale.set(0.8, 1.25, 0.5);
      hand.position.y = -0.31;
      elbow.add(hand);
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.03, 4, 8), M.skin);
      thumb.position.set(side * -0.03, -0.3, 0.01);
      thumb.rotation.z = side * 0.6;
      elbow.add(thumb);
      this.arms[side] = {
        shoulder, elbow, side, upperLen: 0.3, foreLen: 0.31,
        target: new THREE.Vector3(side * 0.16, 0.8, 0.3),
        goal: new THREE.Vector3(side * 0.16, 0.8, 0.3),
      };
    }
    shadow(this.root);
    this.restArms();
  }

  setSkin(key) {
    const pos = this.root.position.clone();
    this.build(key);
    this.root.position.copy(pos);
    this.restArms(true);
  }

  // Position de repos : mains posées sur la table
  restArms(snap = false) {
    const z = this.root.position.z + 0.36;
    for (const side of [-1, 1]) {
      const a = this.arms[side];
      a.goal.set(this.root.position.x + side * 0.17, this.tableY + 0.035, z);
      if (snap) a.target.copy(a.goal);
    }
  }

  // Convertit un point monde en repère local du torse
  toBody(v) {
    this.root.updateMatrixWorld(true);
    return this.body.worldToLocal(v.clone());
  }

  // Oriente le bras pour que la main atteigne `goal` (repère monde), IK à deux os.
  solveArm(arm) {
    const target = this.toBody(arm.target);
    const sh = arm.shoulder.position;
    const d = target.clone().sub(sh);
    const a = arm.upperLen, b = arm.foreLen;
    let L = d.length();
    L = THREE.MathUtils.clamp(L, Math.abs(a - b) + 0.01, a + b - 0.005);
    const dir = d.clone().normalize();
    const cosA = (a * a + L * L - b * b) / (2 * a * L);
    const alpha = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
    // Le coude part vers l'extérieur et vers le bas
    const pole = new THREE.Vector3(arm.side * 1, -1.2, -0.4).normalize();
    let n = new THREE.Vector3().crossVectors(dir, pole);
    if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
    n.normalize();
    const upperDir = dir.clone().applyAxisAngle(n, alpha);
    const down = new THREE.Vector3(0, -1, 0);
    arm.shoulder.quaternion.setFromUnitVectors(down, upperDir);
    const elbowPos = sh.clone().add(upperDir.clone().multiplyScalar(a));
    const foreDir = target.clone().sub(elbowPos).normalize();
    const inv = arm.shoulder.quaternion.clone().invert();
    const localFore = foreDir.applyQuaternion(inv);
    arm.elbow.quaternion.setFromUnitVectors(down, localFore);
  }

  // Bras qui se déplace vers un point (monde) ; résolution via update()
  reach(side, worldPoint) {
    this.arms[side].goal.copy(worldPoint);
  }

  lookAt(worldPoint) { this.lookTarget.copy(worldPoint); }

  speak(durationMs) { this.talk = Math.max(this.talk, durationMs / 1000); }

  update(dt) {
    this.time += dt;
    // Respiration
    const br = Math.sin(this.time * 1.6) * 0.006;
    this.body.scale.set(1 + br * 0.5, 1 + br, 1 + br);
    this.body.rotation.y = Math.sin(this.time * 0.35) * 0.02;
    // Regard
    const local = this.toBody(this.lookTarget).sub(this.head.position);
    const yaw = Math.atan2(local.x, local.z);
    const pitch = -Math.atan2(local.y - 0.08, Math.hypot(local.x, local.z));
    this.headYaw += (THREE.MathUtils.clamp(yaw, -0.9, 0.9) - this.headYaw) * Math.min(1, dt * 4);
    this.headPitch += (THREE.MathUtils.clamp(pitch, -0.5, 0.3) - this.headPitch) * Math.min(1, dt * 4);
    this.head.rotation.set(this.headPitch + Math.sin(this.time * 0.9) * 0.015, this.headYaw, Math.sin(this.time * 0.5) * 0.02);
    // Clignement
    this.blinkT -= dt;
    let eyeScale = 1;
    if (this.blinkT < 0.12) eyeScale = Math.abs(this.blinkT - 0.06) / 0.06;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 4;
    for (const e of this.eyes) e.scale.y = Math.max(0.1, eyeScale);
    // Parole
    if (this.talk > 0) {
      this.talk -= dt;
      this.mouth.scale.y = 1 + Math.abs(Math.sin(this.time * 18)) * 2.6;
    } else this.mouth.scale.y = 1;
    // Bras : approche douce de la cible
    for (const side of [-1, 1]) {
      const arm = this.arms[side];
      arm.target.lerp(arm.goal, Math.min(1, dt * 9));
      this.solveArm(arm);
    }
  }
}
