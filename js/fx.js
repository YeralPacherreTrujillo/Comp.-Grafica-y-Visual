import * as THREE from 'three';

/**
 * Gestor de efectos visuales (FX):
 * - Fogonazos de boca de cañón (muzzle flashes) con luz dinámica.
 * - Proyectiles trazadores 3D visibles en vuelo (bullet tracers).
 * - Impactos de sangre 3D al impactar zombis.
 * - Impactos de chispas, humo y marcas de impacto al chocar con paredes/entorno.
 * - Sonidos sintetizados avanzados por Web Audio API.
 */
export function createFX(scene) {
  const tracers = [];
  const particles = [];
  const decals = [];
  const flashes = [];

  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // Geometrías y materiales reutilizables para máximo rendimiento
  const tracerGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.45, 6);
  tracerGeo.rotateX(Math.PI / 2); // Alinear con el eje Z (dirección hacia adelante)
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xfff077 });

  const tracerGlowGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6);
  tracerGlowGeo.rotateX(Math.PI / 2);
  const tracerGlowMat = new THREE.MeshBasicMaterial({
    color: 0xff8811,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending
  });

  const bloodGeo = new THREE.DodecahedronGeometry(0.035, 0);
  const sparkGeo = new THREE.TetrahedronGeometry(0.025);
  const smokeGeo = new THREE.SphereGeometry(0.08, 6, 5);
  const decalGeo = new THREE.CircleGeometry(0.045, 8);

  const bloodMats = [
    new THREE.MeshStandardMaterial({ color: 0xa80e0e, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0x730505, roughness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0x470202, roughness: 0.4 })
  ];

  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0xffd24d,
    blending: THREE.AdditiveBlending
  });

  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });

  const decalMat = new THREE.MeshBasicMaterial({
    color: 0x141414,
    transparent: true,
    opacity: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });

  // Mesh de estrella luminosa para fogonazo
  function makeFlashMesh(size, color) {
    const grp = new THREE.Group();
    const planeGeo = new THREE.PlaneGeometry(size, size);
    const m = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const p1 = new THREE.Mesh(planeGeo, m);
    const p2 = new THREE.Mesh(planeGeo, m);
    p2.rotation.z = Math.PI / 4;
    grp.add(p1, p2);
    return grp;
  }

  // ---------- SONIDOS SINTETIZADOS ----------
  const sound = {
    shoot(isShotgun) {
      try {
        const ac = getAudio();
        const t = ac.currentTime;

        // Oscilador para cuerpo del disparo
        const osc = ac.createOscillator();
        const oscGain = ac.createGain();
        osc.type = isShotgun ? 'square' : 'sawtooth';
        osc.frequency.setValueAtTime(isShotgun ? 180 : 380, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + (isShotgun ? 0.25 : 0.12));
        oscGain.gain.setValueAtTime(0.35, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + (isShotgun ? 0.25 : 0.12));
        osc.connect(oscGain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + (isShotgun ? 0.25 : 0.12));

        // Ruido blanco para el chasquido inicial (punch)
        const bufferSize = ac.sampleRate * 0.08;
        const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        const noise = ac.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ac.createGain();
        noiseGain.gain.setValueAtTime(isShotgun ? 0.45 : 0.28, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        noise.connect(noiseGain).connect(ac.destination);
        noise.start(t);
      } catch (e) {}
    },

    fleshHit() {
      try {
        const ac = getAudio();
        const t = ac.currentTime;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(25, t + 0.09);
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.connect(g).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.09);
      } catch (e) {}
    },

    wallHit() {
      try {
        const ac = getAudio();
        const t = ac.currentTime;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.06);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(g).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.06);
      } catch (e) {}
    }
  };

  return {
    sound,

    /**
     * Genera el fogonazo de la boca del cañón al disparar.
     */
    muzzleFlash(pos, dir, isShotgun = false) {
      const size = isShotgun ? 0.36 : 0.24;
      const grp = makeFlashMesh(size, isShotgun ? 0xff9922 : 0xffea77);
      grp.position.copy(pos);
      grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      grp.rotateZ(Math.random() * Math.PI * 2);
      scene.add(grp);

      // Luz puntual momentánea (ilumina el entorno por ~50ms)
      const light = new THREE.PointLight(0xffaa44, isShotgun ? 24 : 16, 7);
      light.position.copy(pos);
      scene.add(light);

      flashes.push({
        grp,
        light,
        life: 0.055,
        maxLife: 0.055
      });
    },

    /**
     * Crea un proyectil trazador 3D visible que surca el aire desde la boca del cañón hasta el destino.
     */
    spawnBulletTracer(from, to, speed = 210, onReach = null) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(tracerGeo, tracerMat);
      const glow = new THREE.Mesh(tracerGlowGeo, tracerGlowMat);
      g.add(core, glow);

      g.position.copy(from);
      const dir = to.clone().sub(from);
      const dist = dir.length();
      if (dist > 0.001) {
        dir.normalize();
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
      }

      scene.add(g);
      tracers.push({
        g,
        from: from.clone(),
        to: to.clone(),
        dir,
        dist,
        traveled: 0,
        speed,
        onReach
      });
    },

    /**
     * Efecto de impacto en un Zombi: salpicadura 3D de sangre con física y desvanecimiento.
     */
    bloodImpact(point, normal) {
      sound.fleshHit();
      const count = 16;
      for (let i = 0; i < count; i++) {
        const mat = bloodMats[i % bloodMats.length];
        const p = new THREE.Mesh(bloodGeo, mat);
        p.position.copy(point);
        const s = 0.6 + Math.random() * 0.9;
        p.scale.setScalar(s);

        // Vector de velocidad hacia afuera y hacia atrás
        const vel = new THREE.Vector3(
          normal.x + (Math.random() - 0.5) * 1.5,
          normal.y + (Math.random() * 1.2 + 0.3),
          normal.z + (Math.random() - 0.5) * 1.5
        ).normalize().multiplyScalar(2.5 + Math.random() * 4.5);

        scene.add(p);
        particles.push({
          mesh: p,
          vel,
          gravity: 14,
          life: 0.35 + Math.random() * 0.25,
          maxLife: 0.6,
          shrink: true
        });
      }

      // Destello rojo fugaz en el punto de contacto
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff1111, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
      );
      flash.position.copy(point);
      scene.add(flash);
      particles.push({ mesh: flash, vel: new THREE.Vector3(), gravity: 0, life: 0.07, maxLife: 0.07, shrink: true });
    },

    /**
     * Efecto de impacto en Pared/Entorno: chispas brillantes, nube de humo y marca de impacto (decal).
     */
    wallImpact(point, normal) {
      sound.wallHit();

      // 1. Chispas brillantes
      const sparkCount = 12;
      for (let i = 0; i < sparkCount; i++) {
        const p = new THREE.Mesh(sparkGeo, sparkMat);
        p.position.copy(point);
        p.scale.setScalar(0.7 + Math.random() * 0.8);

        // Chispas rebotan en la normal
        const vel = new THREE.Vector3(
          normal.x + (Math.random() - 0.5) * 1.2,
          normal.y + (Math.random() - 0.5) * 1.2,
          normal.z + (Math.random() - 0.5) * 1.2
        ).normalize().multiplyScalar(4 + Math.random() * 6);

        scene.add(p);
        particles.push({
          mesh: p,
          vel,
          gravity: 12,
          life: 0.2 + Math.random() * 0.18,
          maxLife: 0.38,
          shrink: true
        });
      }

      // 2. Nube de polvo/humo
      const smoke = new THREE.Mesh(smokeGeo, smokeMat.clone());
      smoke.position.copy(point).addScaledVector(normal, 0.05);
      smoke.scale.setScalar(0.4);
      scene.add(smoke);
      particles.push({
        mesh: smoke,
        vel: normal.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.4, 0)),
        gravity: -0.2, // El humo sube suavemente
        life: 0.4,
        maxLife: 0.4,
        grow: true
      });

      // 3. Marca de bala en la superficie (decal)
      const decal = new THREE.Mesh(decalGeo, decalMat.clone());
      decal.position.copy(point).addScaledVector(normal, 0.008);
      decal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      decal.rotateZ(Math.random() * Math.PI * 2);
      scene.add(decal);
      decals.push({ mesh: decal, life: 6.0, maxLife: 6.0 });

      // Limitar cantidad máxima de marcas en paredes para cuidar la memoria
      if (decals.length > 50) {
        const old = decals.shift();
        scene.remove(old.mesh);
        old.mesh.geometry.dispose();
      }
    },

    /**
     * Actualiza todos los efectos en cada frame.
     */
    update(dt) {
      // 1. Actualizar trazadores de balas
      for (let i = tracers.length - 1; i >= 0; i--) {
        const tr = tracers[i];
        tr.traveled += tr.speed * dt;
        if (tr.traveled >= tr.dist) {
          // Ha llegado al objetivo
          tr.g.position.copy(tr.to);
          if (tr.onReach) tr.onReach(tr.to);
          scene.remove(tr.g);
          tracers.splice(i, 1);
        } else {
          tr.g.position.copy(tr.from).addScaledVector(tr.dir, tr.traveled);
        }
      }

      // 2. Actualizar fogonazos
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.life -= dt;
        if (f.life <= 0) {
          scene.remove(f.grp);
          scene.remove(f.light);
          flashes.splice(i, 1);
        } else {
          const ratio = f.life / f.maxLife;
          f.light.intensity = 20 * ratio;
          f.grp.scale.setScalar(1 + (1 - ratio) * 0.5);
        }
      }

      // 3. Actualizar partículas (sangre, chispas, humo)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          particles.splice(i, 1);
          continue;
        }

        // Física
        p.vel.y -= p.gravity * dt;
        p.mesh.position.addScaledVector(p.vel, dt);

        const progress = 1 - p.life / p.maxLife;
        if (p.shrink) {
          const s = Math.max(0.01, 1 - progress);
          p.mesh.scale.setScalar(s);
        }
        if (p.grow) {
          p.mesh.scale.setScalar(0.4 + progress * 1.6);
          if (p.mesh.material) p.mesh.material.opacity = (1 - progress) * 0.45;
        }
      }

      // 4. Actualizar desvanecimiento de marcas de bala
      for (let i = decals.length - 1; i >= 0; i--) {
        const d = decals[i];
        d.life -= dt;
        if (d.life <= 0) {
          scene.remove(d.mesh);
          decals.splice(i, 1);
        } else if (d.life < 1.5) {
          d.mesh.material.opacity = (d.life / 1.5) * 0.85;
        }
      }
    }
  };
}
