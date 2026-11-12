import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CFG } from './config.js';

/**
 * Módulo de Armas:
 * - Pistola y Escopeta en primera persona con modelos GLTF/GLB.
 * - Salida de bala visible: Fogonazo en boca de cañón (muzzle flash) y luz dinámica.
 * - Trazadores de bala 3D visibles en tiempo real surcando el espacio.
 * - Dispersión de perdigones (spread) para la escopeta.
 * - Impactos visuales con sangre 3D en zombis y chispas/humo/marcas en paredes.
 * - Retroceso visual del arma y retroceso en la cámara del jugador.
 */
export async function createWeapons(scene, camera, world, zombies, fx, player, isPlaying, toast, onHit) {
  const loader = new GLTFLoader();
  const rc = new THREE.Raycaster();
  rc.far = 85;

  const list = [];
  let cur = 0;
  let ammo = CFG.WEAPONS.map(w => w.ammo);

  // Cargar y calibrar los modelos 3D de las armas
  for (const w of CFG.WEAPONS) {
    let model;
    try {
      model = (await loader.loadAsync(w.file)).scene;
    } catch {
      console.warn('No se cargó', w.file, '→ arma de reemplazo');
      model = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.14, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      );
    }

    const box = new THREE.Box3().setFromObject(model);
    const sz = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3())); // Centrar el modelo en su origen

    const pivot = new THREE.Group();
    pivot.add(model);
    if (sz.x > sz.z) pivot.rotation.y = Math.PI / 2; // Alinear cañón al eje Z
    pivot.rotation.y += w.rot;
    pivot.scale.setScalar(w.size / Math.max(sz.x, sz.y, sz.z));

    // Punto de salida exacto del cañón para el fogonazo y los trazadores
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.04, -w.size * 0.68);
    pivot.add(muzzle);

    const holder = new THREE.Group();
    holder.add(pivot);
    holder.position.set(...w.pos);
    holder.visible = false;

    camera.add(holder);
    list.push({
      holder,
      pivot,
      muzzle,
      basePos: holder.position.clone(),
      baseRot: pivot.rotation.clone()
    });
  }

  const select = i => {
    cur = i;
    list.forEach((o, j) => {
      o.holder.visible = j === i;
      o.holder.position.copy(o.basePos);
      o.pivot.rotation.copy(o.baseRot);
    });
  };
  select(0);

  // Controles de cambio de arma y disparo
  addEventListener('keydown', e => {
    if (!isPlaying()) return;
    if (e.code === 'Digit1') select(0);
    if (e.code === 'Digit2') select(1);
  });

  addEventListener('mousedown', e => {
    if (e.button === 0 && isPlaying()) shoot();
  });

  function shoot() {
    if (ammo[cur] <= 0) {
      toast('Sin munición: busca una caja de munición');
      try {
        // Sonido de clic seco sin balas
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.frequency.setValueAtTime(160, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.04);
        g.gain.setValueAtTime(0.15, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.04);
        osc.connect(g).connect(ac.destination);
        osc.start(); osc.stop(ac.currentTime + 0.04);
      } catch (e) {}
      return;
    }

    ammo[cur]--;
    const isShotgun = (cur === 1);

    // 1. Sonido avanzado de disparo
    fx.sound.shoot(isShotgun);

    // 2. Retroceso físico del arma
    const active = list[cur];
    active.holder.position.z += isShotgun ? 0.12 : 0.07;
    active.pivot.rotation.x -= isShotgun ? 0.16 : 0.08;

    // 3. Retroceso en la cámara (screen punch)
    if (player && player.st) {
      player.st.pitch = Math.min(1.48, player.st.pitch + (isShotgun ? 0.04 : 0.02));
    }

    // 4. Ubicación mundial de la boca del cañón
    camera.updateMatrixWorld(true);
    const muzzlePos = new THREE.Vector3();
    active.muzzle.getWorldPosition(muzzlePos);

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);

    // 5. Fogonazo visual y luz de disparo
    fx.muzzleFlash(muzzlePos, camDir, isShotgun);

    // 6. Proyectiles y Raycasting
    if (!isShotgun) {
      // PISTOLA: 1 disparo de alta precisión y trazador veloz
      rc.setFromCamera({ x: 0, y: 0 }, camera);
      const hit = zombies.hit(rc);
      const target = hit.hit ? hit.point : rc.ray.origin.clone().addScaledVector(rc.ray.direction, 80);

      fx.spawnBulletTracer(muzzlePos, target, 240, () => {
        if (hit.hit) {
          if (hit.type === 'zombie') {
            fx.bloodImpact(hit.point, hit.normal);
            onHit(hit);
          } else if (hit.type === 'wall') {
            fx.wallImpact(hit.point, hit.normal);
          }
        }
      });
    } else {
      // ESCOPETA: 6 perdigones con cono de dispersión (spread)
      const pelletCount = 6;
      for (let p = 0; p < pelletCount; p++) {
        // Dispersión radial controlada
        const angle = (p / pelletCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const radius = Math.random() * 0.065;
        const spreadX = Math.cos(angle) * radius;
        const spreadY = Math.sin(angle) * radius;

        rc.setFromCamera({ x: spreadX, y: spreadY }, camera);
        const hit = zombies.hit(rc);
        const target = hit.hit ? hit.point : rc.ray.origin.clone().addScaledVector(rc.ray.direction, 70);

        fx.spawnBulletTracer(muzzlePos, target, 180 + Math.random() * 30, () => {
          if (hit.hit) {
            if (hit.type === 'zombie') {
              fx.bloodImpact(hit.point, hit.normal);
              onHit(hit);
            } else if (hit.type === 'wall') {
              fx.wallImpact(hit.point, hit.normal);
            }
          }
        });
      }
    }
  }

  return {
    update(dt) {
      // Suave retorno de retroceso del arma hacia su posición base
      for (const o of list) {
        o.holder.position.lerp(o.basePos, Math.min(1, dt * 14));
        o.pivot.rotation.x = THREE.MathUtils.lerp(o.pivot.rotation.x, o.baseRot.x, Math.min(1, dt * 14));
      }
    },
    addAmmo() {
      CFG.WEAPONS.forEach((w, i) => ammo[i] += w.pack);
    },
    reset() {
      ammo = CFG.WEAPONS.map(w => w.ammo);
      select(0);
    },
    label: () => `${CFG.WEAPONS[cur].name} · ${ammo[cur]}`
  };
}
