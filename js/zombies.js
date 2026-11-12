import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CFG } from './config.js';

// Respaldo articulado si no cargase el archivo
export async function createZombies(scene, world, player) {
  const Z = CFG.ZOMBIE;
  let riggedTemplate = null;

  const zombieModelPath = 'models/zombie.glb';

  try {
    const gltf = await new GLTFLoader().loadAsync(Z.file);
    riggedTemplate = buildRiggedZombieMesh(gltf, Z.height);
  } catch (err) {
    console.warn('No se pudo cargar el archivo GLB:', Z.file, err);
  }

  // Respaldo articulado si no cargase el archivo
  if (!riggedTemplate) {
    riggedTemplate = buildFallbackRiggedMesh(Z.height);
  }

  const hitGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.85, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  const zs = CFG.ZOMBIES.map(([x, y, z], i) => {
    const g = new THREE.Group();
    const body = new THREE.Group();

    // Clonar el modelo 3D original con su esqueleto
    const model = SkeletonUtils.clone(riggedTemplate.root);

    const z0 = {
      g,
      body,
      start: [x, y, z],
      speed: i % 4 === 3 ? Z.fast : Z.speed,
      strideFreq: (i % 4 === 3 ? 7.6 : 6.2) + (i % 3) * 0.35,
      seed: Math.random() * 10,
      walkTime: 0,
      idleTime: 0,
      stagger: 0,
      flashT: 0,
      dying: false,
      deathT: 0,
      armReach: 0, // Transición suave para estirar los brazos al acercarse
      model,
      rootBone: model.getObjectByName('rootBone'),
      spine: model.getObjectByName('spineBone'),
      head: model.getObjectByName('headBone'),
      leftUpperArm: model.getObjectByName('leftUpperArm'),
      leftForearm: model.getObjectByName('leftForearm'),
      rightUpperArm: model.getObjectByName('rightUpperArm'),
      rightForearm: model.getObjectByName('rightForearm'),
      leftThigh: model.getObjectByName('leftThigh'),
      leftShin: model.getObjectByName('leftShin'),
      rightThigh: model.getObjectByName('rightThigh'),
      rightShin: model.getObjectByName('rightShin')
    };

    // Materiales individuales para destello al recibir balazos
    const mats = [];
    model.traverse(ch => {
      if (ch.isMesh && ch.material) {
        ch.material = ch.material.clone();
        mats.push({
          mat: ch.material,
          origEmissive: ch.material.emissive ? ch.material.emissive.clone() : new THREE.Color(0, 0, 0)
        });
      }
    });
    z0.materials = mats;

    body.add(model);
    g.add(body);

    z0.hit = new THREE.Mesh(hitGeo, hitMat);
    z0.hit.position.y = 0.92;
    z0.hit.userData.z = z0;
    g.add(z0.hit);

    scene.add(g);
    reset(z0);
    return z0;
  });

  function reset(z) {
    z.g.position.set(...z.start);
    z.hp = Z.hp;
    z.alive = true;
    z.active = false;
    z.dying = false;
    z.deathT = 0;
    z.stagger = 0;
    z.flashT = 0;
    z.walkTime = 0;
    z.idleTime = 0;
    z.armReach = 0;

    z.body.rotation.set(0, 0, 0);
    z.body.position.set(0, 0, 0);

    if (z.rootBone) {
      z.rootBone.position.set(0, 0.92, 0);
      z.rootBone.rotation.set(0, 0, 0);
    }
    if (z.leftThigh) z.leftThigh.rotation.set(0, 0, 0);
    if (z.rightThigh) z.rightThigh.rotation.set(0, 0, 0);
    if (z.leftShin) z.leftShin.rotation.set(0, 0, 0);
    if (z.rightShin) z.rightShin.rotation.set(0, 0, 0);
    if (z.spine) z.spine.rotation.set(0, 0, 0);

    // Brazos relajados a los costados
    if (z.leftUpperArm) z.leftUpperArm.rotation.set(0, 0.1, 1.35);
    if (z.rightUpperArm) z.rightUpperArm.rotation.set(0, -0.1, -1.35);
    if (z.leftForearm) z.leftForearm.rotation.set(0, 0, 0);
    if (z.rightForearm) z.rightForearm.rotation.set(0, 0, 0);

    for (const m of z.materials) {
      if (m.mat.emissive) m.mat.emissive.copy(m.origEmissive);
    }
  }

  return {
    hit(rc) {
      const targets = [...zs.filter(z => z.alive).map(z => z.hit), ...world.walls];
      const hits = rc.intersectObjects(targets, false);
      if (!hits.length) return { hit: false };

      const h = hits[0];
      const z = h.object.userData.z;

      if (z) {
        z.active = true;
        z.stagger = 0.22;
        z.flashT = 0.12;

        const killed = (--z.hp <= 0);
        if (killed) {
          z.alive = false;
          z.dying = true;
          z.deathT = 0;
        }

        return {
          hit: true,
          type: 'zombie',
          point: h.point.clone(),
          normal: h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0),
          zombie: z,
          killed
        };
      } else {
        return {
          hit: true,
          type: 'wall',
          point: h.point.clone(),
          normal: h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0),
          object: h.object
        };
      }
    },

    reset() {
      zs.forEach(reset);
    },

    update(dt) {
      const p = player.pos;

      for (const z of zs) {
        // Muerte: colapso hacia el suelo
        if (!z.alive) {
          if (z.dying) {
            z.deathT += dt * 2.8;
            const prog = Math.min(1, z.deathT);
            const ease = 1 - Math.pow(1 - prog, 3);

            if (z.rootBone) {
              z.rootBone.position.y = 0.92 * (1 - ease) + 0.12 * ease;
              z.leftThigh.rotation.x = THREE.MathUtils.lerp(z.leftThigh.rotation.x, -1.2, ease);
              z.rightThigh.rotation.x = THREE.MathUtils.lerp(z.rightThigh.rotation.x, -1.2, ease);
              z.leftShin.rotation.x = THREE.MathUtils.lerp(z.leftShin.rotation.x, 1.9, ease);
              z.rightShin.rotation.x = THREE.MathUtils.lerp(z.rightShin.rotation.x, 1.9, ease);
              z.spine.rotation.x = THREE.MathUtils.lerp(z.spine.rotation.x, 0.75, ease);
              if (z.leftUpperArm) z.leftUpperArm.rotation.set(0.2, 0.1, 1.4);
              if (z.rightUpperArm) z.rightUpperArm.rotation.set(0.2, -0.1, -1.4);
            } else {
              z.body.rotation.x = -Math.PI / 2 * ease;
            }

            if (prog >= 1) z.dying = false;
          }
          continue;
        }

        const pos = z.g.position;
        const dx = p.x - pos.x, dz = p.z - pos.z;
        const d = Math.hypot(dx, dz), dy = Math.abs(p.y - pos.y);

        // Activación por cercanía
        if (!z.active && d < CFG.DETECT && dy < 2.5) {
          z.active = true;
        }

        // Destello rojo al recibir daño
        if (z.flashT > 0) {
          z.flashT -= dt;
          for (const m of z.materials) {
            if (m.mat.emissive) m.mat.emissive.setHex(0xcc1111);
          }
        } else {
          for (const m of z.materials) {
            if (m.mat.emissive) m.mat.emissive.copy(m.origEmissive);
          }
        }

        if (z.stagger > 0) {
          z.stagger -= dt;
        }

        // Si está inactivo: postura quieta esperando
        if (!z.active) {
          z.idleTime += dt;
          if (z.spine) z.spine.rotation.x = Math.sin(z.idleTime * 1.8 + z.seed) * 0.02;
          // Brazos quietos a los costados
          if (z.leftUpperArm) z.leftUpperArm.rotation.set(0, 0.1, 1.35);
          if (z.rightUpperArm) z.rightUpperArm.rotation.set(0, -0.1, -1.35);
          continue;
        }

        // Orientación 100% DE FRENTE hacia el jugador
        z.g.rotation.y = Math.atan2(dx, dz);

        // Movimiento físico de avance hacia el jugador
        let isMoving = false;
        if (d > 0.6) {
          const effectiveSpeed = z.stagger > 0 ? z.speed * 0.25 : z.speed;
          const k = effectiveSpeed * dt / d;
          const mx = dx * k, mz = dz * k;
          let movedX = false, movedZ = false;

          if (!world.blocked(pos.x + mx, pos.z, pos.y)) { pos.x += mx; movedX = true; }
          if (!world.blocked(pos.x, pos.z + mz, pos.y)) { pos.z += mz; movedZ = true; }
          pos.y = world.floorY(pos.x, pos.z, pos.y);
          isMoving = movedX || movedZ;
        }

        // El cuerpo permanece firme en el suelo (sin saltar ni tambalearse lateralmente)
        z.body.position.y = 0;
        z.body.rotation.z = 0;

        // 1. ANIMACIÓN DE LAS PIERNAS (Caminata de avance limpia)
        if (isMoving) {
          z.walkTime += dt * (z.speed * 2.3);
          const cycle = z.walkTime * z.strideFreq;
          const swing = Math.sin(cycle);

          // Columna erguida hacia el frente
          if (z.spine) {
            z.spine.rotation.x = z.stagger > 0 ? -0.22 : 0.06;
          }

          // Balanceo de muslos y flexión de rodillas al dar pasos
          if (z.leftThigh && z.rightThigh) {
            z.leftThigh.rotation.x = swing * 0.46;
            z.rightThigh.rotation.x = -swing * 0.46;

            z.leftShin.rotation.x = Math.max(0, -swing) * 0.72;
            z.rightShin.rotation.x = Math.max(0, swing) * 0.72;
          }
        } else {
          // Detenido
          if (z.leftThigh && z.rightThigh) {
            z.leftThigh.rotation.x = 0.05;
            z.rightThigh.rotation.x = -0.05;
            z.leftShin.rotation.x = 0.08;
            z.rightShin.rotation.x = 0.08;
          }
        }

        // 2. COMPORTAMIENTO DE LOS BRAZOS:
        // - De lejos: abajo a los costados naturalmente.
        // - Al estar cerca (d < 3.5m): se estiran al frente estáticos hacia ti SIN MOVERSE.
        const isNear = (d < 3.6);
        const targetReach = isNear ? 1.0 : 0.0;
        z.armReach = THREE.MathUtils.lerp(z.armReach, targetReach, dt * 5.0);
        const t = z.armReach;

        if (z.leftUpperArm && z.rightUpperArm) {
          // Brazo izquierdo: de reposo (costado Z=1.35) a estirado al frente (Z=0.08, Y=1.45)
          z.leftUpperArm.rotation.z = THREE.MathUtils.lerp(1.35, 0.08, t);
          z.leftUpperArm.rotation.y = THREE.MathUtils.lerp(0.1, 1.45, t);
          z.leftUpperArm.rotation.x = 0; // FIRME, SIN MOVERLO

          // Brazo derecho: de reposo (costado Z=-1.35) a estirado al frente (Z=-0.08, Y=-1.45)
          z.rightUpperArm.rotation.z = THREE.MathUtils.lerp(-1.35, -0.08, t);
          z.rightUpperArm.rotation.y = THREE.MathUtils.lerp(-0.1, -1.45, t);
          z.rightUpperArm.rotation.x = 0; // FIRME, SIN MOVERLO

          // Antebrazos rectos al frente
          if (z.leftForearm) z.leftForearm.rotation.set(0, 0.08 * t, 0);
          if (z.rightForearm) z.rightForearm.rotation.set(0, -0.08 * t, 0);
        }

        // Contacto con el jugador
        if (d < Z.reach && dy < 1.5 && !player.shielded) {
          return true;
        }
      }

      return false;
    }
  };
}

/**
 * Toma la malla 3D y texturas de zombie.glb (sin alterar el archivo en disco)
 * y le crea por código un esqueleto de 11 huesos articulados con hombros y codos independientes.
 */
function buildRiggedZombieMesh(gltf, targetHeight = 1.8) {
  gltf.scene.updateMatrixWorld(true);
  let origMesh = null;
  gltf.scene.traverse(c => {
    if (c.isMesh && !origMesh) origMesh = c;
  });

  if (!origMesh) return null;

  // 1. Extraer geometría y aplicar transformaciones previas
  const geom = origMesh.geometry.clone();
  geom.applyMatrix4(origMesh.matrixWorld);

  // 2. Corregir orientación al frente (+Z)
  geom.rotateY(-Math.PI / 2);

  // 3. Centrar en X y Z, pies en Y = 0
  geom.computeBoundingBox();
  const b0 = geom.boundingBox;
  geom.translate(-(b0.min.x + b0.max.x) / 2, -b0.min.y, -(b0.min.z + b0.max.z) / 2);

  // 4. Escalar a 1.8 m de altura
  geom.computeBoundingBox();
  const b1 = geom.boundingBox;
  const currentH = b1.max.y - b1.min.y;
  const s = targetHeight / (currentH > 0 ? currentH : 1.8);
  geom.scale(s, s, s);
  geom.computeBoundingBox();

  // 5. Jerarquía de huesos en código (THREE.Bone)
  const rootBone = new THREE.Bone();
  rootBone.name = 'rootBone';
  rootBone.position.set(0, 0.92, 0); // Pelvis

  const spineBone = new THREE.Bone();
  spineBone.name = 'spineBone';
  spineBone.position.set(0, 0.38, 0); // Columna/Tórax
  rootBone.add(spineBone);

  const headBone = new THREE.Bone();
  headBone.name = 'headBone';
  headBone.position.set(0, 0.28, 0); // Cabeza
  spineBone.add(headBone);

  // Brazo izquierdo: Hombro + Codo/Antebrazo
  const leftUpperArm = new THREE.Bone();
  leftUpperArm.name = 'leftUpperArm';
  leftUpperArm.position.set(-0.24, 0.12, 0);
  spineBone.add(leftUpperArm);

  const leftForearm = new THREE.Bone();
  leftForearm.name = 'leftForearm';
  leftForearm.position.set(-0.22, 0, 0);
  leftUpperArm.add(leftForearm);

  // Brazo derecho: Hombro + Codo/Antebrazo
  const rightUpperArm = new THREE.Bone();
  rightUpperArm.name = 'rightUpperArm';
  rightUpperArm.position.set(0.24, 0.12, 0);
  spineBone.add(rightUpperArm);

  const rightForearm = new THREE.Bone();
  rightForearm.name = 'rightForearm';
  rightForearm.position.set(0.22, 0, 0);
  rightUpperArm.add(rightForearm);

  // Pierna izquierda: Muslo + Rodilla/Pantorrilla
  const leftThigh = new THREE.Bone();
  leftThigh.name = 'leftThigh';
  leftThigh.position.set(-0.13, -0.05, 0);
  rootBone.add(leftThigh);

  const leftShin = new THREE.Bone();
  leftShin.name = 'leftShin';
  leftShin.position.set(0, -0.44, 0);
  leftThigh.add(leftShin);

  // Pierna derecha: Muslo + Rodilla/Pantorrilla
  const rightThigh = new THREE.Bone();
  rightThigh.name = 'rightThigh';
  rightThigh.position.set(0.13, -0.05, 0);
  rootBone.add(rightThigh);

  const rightShin = new THREE.Bone();
  rightShin.name = 'rightShin';
  rightShin.position.set(0, -0.44, 0);
  rightThigh.add(rightShin);

  const bones = [
    rootBone,      // 0: Pelvis
    spineBone,     // 1: Columna
    headBone,      // 2: Cabeza
    leftUpperArm,  // 3: Brazo Superior Izq
    leftForearm,   // 4: Antebrazo Izq
    rightUpperArm, // 5: Brazo Superior Der
    rightForearm,  // 6: Antebrazo Der
    leftThigh,     // 7: Muslo Izq
    leftShin,      // 8: Pantorrilla Izq
    rightThigh,    // 9: Muslo Der
    rightShin      // 10: Pantorrilla Der
  ];

  // 6. Asignar pesos de influencia a los vértices de zombie.glb
  const pos = geom.attributes.position;
  const count = pos.count;
  const skinIndices = [];
  const skinWeights = [];

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    let b0 = 0, b1 = 0, w0 = 1.0, w1 = 0.0;

    if (y >= 1.46) {
      // Cabeza
      b0 = 2; w0 = 1.0;
    } else if (y >= 0.88) {
      // Torso y brazos
      if (x < -0.20) {
        // Brazo izquierdo: separar bíceps y antebrazo
        if (x > -0.38) {
          b0 = 3; w0 = 1.0;
        } else if (x < -0.44) {
          b0 = 4; w0 = 1.0;
        } else {
          const t = (x - (-0.44)) / 0.06;
          b0 = 3; w0 = t;
          b1 = 4; w1 = 1 - t;
        }
      } else if (x > 0.20) {
        // Brazo derecho: separar bíceps y antebrazo
        if (x < 0.38) {
          b0 = 5; w0 = 1.0;
        } else if (x > 0.44) {
          b0 = 6; w0 = 1.0;
        } else {
          const t = (x - 0.38) / 0.06;
          b0 = 6; w0 = t;
          b1 = 5; w1 = 1 - t;
        }
      } else {
        // Torso central
        const t = Math.min(1, Math.max(0, (y - 0.88) / 0.48));
        b0 = 1; w0 = t;
        b1 = 0; w1 = 1 - t;
      }
    } else {
      // Piernas
      const isLeft = (x < 0);
      const thighIdx = isLeft ? 7 : 9;
      const shinIdx = isLeft ? 8 : 10;

      if (y < 0.38) {
        b0 = shinIdx; w0 = 1.0;
      } else if (y > 0.50) {
        b0 = thighIdx; w0 = 1.0;
      } else {
        const t = (y - 0.38) / 0.12;
        b0 = thighIdx; w0 = t;
        b1 = shinIdx; w1 = 1 - t;
      }
    }

    skinIndices.push(b0, b1, 0, 0);
    skinWeights.push(w0, w1, 0, 0);
  }

  geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  // 7. Crear SkinnedMesh con la textura y material original de zombie.glb
  const mat = origMesh.material.clone();
  if ('skinning' in mat) mat.skinning = true;
  mat.needsUpdate = true;

  const skinnedMesh = new THREE.SkinnedMesh(geom, mat);
  const skeleton = new THREE.Skeleton(bones);
  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);

  const root = new THREE.Group();
  root.add(skinnedMesh);

  return { root };
}

/**
 * Respaldo procedural si zombie.glb no estuviese en la carpeta.
 */
function buildFallbackRiggedMesh(targetHeight = 1.8) {
  const root = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x3d6642, roughness: 0.8 });
  const clothesMat = new THREE.MeshStandardMaterial({ color: 0x243028, roughness: 0.9 });

  const rootBone = new THREE.Bone();
  rootBone.name = 'rootBone';
  rootBone.position.set(0, 0.92, 0);
  root.add(rootBone);

  const spineBone = new THREE.Bone();
  spineBone.name = 'spineBone';
  spineBone.position.set(0, 0.35, 0);
  rootBone.add(spineBone);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.28), clothesMat);
  torso.position.y = -0.15;
  spineBone.add(torso);

  const headBone = new THREE.Bone();
  headBone.name = 'headBone';
  headBone.position.set(0, 0.25, 0);
  spineBone.add(headBone);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  head.position.y = 0.12;
  headBone.add(head);

  const leftUpperArm = new THREE.Bone();
  leftUpperArm.name = 'leftUpperArm';
  leftUpperArm.position.set(-0.25, 0.12, 0);
  const armMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.12), skinMat);
  armMeshL.position.y = -0.15;
  leftUpperArm.add(armMeshL);
  spineBone.add(leftUpperArm);

  const leftForearm = new THREE.Bone();
  leftForearm.name = 'leftForearm';
  leftForearm.position.set(0, -0.3, 0);
  const foreMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), skinMat);
  foreMeshL.position.y = -0.15;
  leftForearm.add(foreMeshL);
  leftUpperArm.add(leftForearm);

  const rightUpperArm = new THREE.Bone();
  rightUpperArm.name = 'rightUpperArm';
  rightUpperArm.position.set(0.25, 0.12, 0);
  const armMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.12), skinMat);
  armMeshR.position.y = -0.15;
  rightUpperArm.add(armMeshR);
  spineBone.add(rightUpperArm);

  const rightForearm = new THREE.Bone();
  rightForearm.name = 'rightForearm';
  rightForearm.position.set(0, -0.3, 0);
  const foreMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), skinMat);
  foreMeshR.position.y = -0.15;
  rightForearm.add(foreMeshR);
  rightUpperArm.add(rightForearm);

  const leftThigh = new THREE.Bone();
  leftThigh.name = 'leftThigh';
  leftThigh.position.set(-0.13, -0.05, 0);
  const thighMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.15), clothesMat);
  thighMeshL.position.y = -0.2;
  leftThigh.add(thighMeshL);
  rootBone.add(leftThigh);

  const leftShin = new THREE.Bone();
  leftShin.name = 'leftShin';
  leftShin.position.set(0, -0.42, 0);
  const shinMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), clothesMat);
  shinMeshL.position.y = -0.2;
  leftShin.add(shinMeshL);
  leftThigh.add(leftShin);

  const rightThigh = new THREE.Bone();
  rightThigh.name = 'rightThigh';
  rightThigh.position.set(0.13, -0.05, 0);
  const thighMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.15), clothesMat);
  thighMeshR.position.y = -0.2;
  rightThigh.add(thighMeshR);
  rootBone.add(rightThigh);

  const rightShin = new THREE.Bone();
  rightShin.name = 'rightShin';
  rightShin.position.set(0, -0.42, 0);
  const shinMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), clothesMat);
  shinMeshR.position.y = -0.2;
  rightShin.add(shinMeshR);
  rightThigh.add(rightShin);

  return { root };
}
