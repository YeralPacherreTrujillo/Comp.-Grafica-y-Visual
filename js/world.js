
import * as THREE from 'three';
import { CFG } from './config.js';

const DOOR_H = 2.6, H = 4;

export function createWorld(scene) {
  const cols = [], walls = [], pickups = [], lamps = [];
  const furnitureModels = [];
  const wallSegments = [];

  const mat = (c, o) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.9,
      ...o
    });

  // TEXTURAS
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;

  const g = cv.getContext('2d');
  g.fillStyle = '#5a3d27';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#35220f';

  for (let i = 0; i < 4; i++) {
    g.fillRect(0, i * 16, 64, 2);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const wallTex = new THREE.TextureLoader().load('models/pared.png');
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.colorSpace = THREE.SRGBColorSpace;

  const M = {
    floor: mat(0xffffff, { map: tex }),
    wall: mat(0xffffff, { map: wallTex, roughness: 0.85 }),
    ceiling: mat(0x524c44, { roughness: 0.95 }),
    wood: mat(0x4a2f1c),
    cloth: mat(0x6e2a2a),
    white: mat(0xcfcfc8),
    green: mat(0x1f5a35),
    conc: mat(0x77797c),
    grass: mat(0x1e3a22),
    fence: mat(0x2b2b2e),
    car: mat(0x3a4a5e),
    dark: mat(0x222222),
    path: mat(0x8a8478)
  };

  // HELPERS DE CONSTRUCCIÓN
  function plane(x0, x1, z0, z1, y, m, up = true, tile = 0) {
    const w = x1 - x0;
    const d = z1 - z0;
    const geo = new THREE.PlaneGeometry(w, d);

    if (tile) {
      const uv = geo.attributes.uv;

      for (let i = 0; i < uv.count; i++) {
        uv.setXY(
          i,
          uv.getX(i) * w / tile,
          uv.getY(i) * d / tile
        );
      }
    }

    const p = new THREE.Mesh(geo, m);
    p.rotation.x = up ? -Math.PI / 2 : Math.PI / 2;

    p.position.set(
      (x0 + x1) / 2,
      y,
      (z0 + z1) / 2
    );

    scene.add(p);
  }

  function block(x0, x1, y0, y1, z0, z1, m, solid = true) {
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;

    const geo = new THREE.BoxGeometry(w, h, d);

    if (m === M.wall && m.map) {
      const uv = geo.attributes.uv;
      const tile = 2.4;

      for (let i = 0; i < 8; i++) {
        uv.setXY(i, uv.getX(i) * d / tile, uv.getY(i) * h / tile);
      }

      for (let i = 8; i < 16; i++) {
        uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
      }

      for (let i = 16; i < 24; i++) {
        uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
      }
    }

    const b = new THREE.Mesh(geo, m);

    b.position.set(
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      (z0 + z1) / 2
    );

    scene.add(b);

    if (solid) {
      cols.push({ x0, x1, z0, z1, y0, y1 });
      walls.push(b);
    }

    return b;
  }

  // DETECCIÓN DE MUEBLES
  function nearWall(x, z, w, d, y, h) {
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;
    const margin = 0.65;

    return wallSegments.some(a => {
      if (y + h < a.y0 || y > a.y1) {
        return false;
      }

      if (a.axis === 'x') {
        const overlap =
          Math.min(x1, a.max) - Math.max(x0, a.min);

        return (
          overlap > Math.min(w, 1) * 0.35 &&
          Math.min(
            Math.abs(z0 - a.fixed),
            Math.abs(z1 - a.fixed)
          ) <= margin
        );
      }

      const overlap =
        Math.min(z1, a.max) - Math.max(z0, a.min);

      return (
        overlap > Math.min(d, 1) * 0.35 &&
        Math.min(
          Math.abs(x0 - a.fixed),
          Math.abs(x1 - a.fixed)
        ) <= margin
      );
    });
  }

  // CAMAS Y ARMARIOS 3D
  const furn = (x, z, w, d, h, m, y = 0) => {
    const x0 = x - w / 2;
    const x1 = x + w / 2;
    const z0 = z - d / 2;
    const z1 = z + d / 2;

    // Mantener el bloque hasta cargar el modelo GLB.
    const original = block(
      x0, x1,
      y, y + h,
      z0, z1,
      m
    );

    // Conservar coches y columnas originales.
    if (m === M.car || m === M.wall) {
      return original;
    }

    const byWall = nearWall(x, z, w, d, y, h);

    const lowRectangle =
      h <= 1.6 &&
      Math.max(w, d) >= 1.8 &&
      Math.min(w, d) >= 0.5 &&
      Math.max(w, d) / Math.min(w, d) >= 1.25;

    const type = byWall
      ? 'armario'
      : lowRectangle
        ? 'cama'
        : null;

    if (!type) {
      return original;
    }

    furnitureModels.push({
      id: `${type}_${furnitureModels.length + 1}`,
      file: `models/${type}.glb`,
      pos: [x, y, z],
      targetSize: [w, h, d],
      placeholder: original,
      solid: false
    });

    return original;
  };

  // PAREDES
  function wall(ax, az, bx, bz, y0, h, gaps = [], m = M.wall) {
    const alongX = az === bz;
    const T = 0.15;

    const a = alongX
      ? Math.min(ax, bx)
      : Math.min(az, bz);

    const b = alongX
      ? Math.max(ax, bx)
      : Math.max(az, bz);

    const f = alongX ? az : ax;

    const seg = (s0, s1, ya, yb, solid) => {
      const mesh = alongX
        ? block(s0, s1, ya, yb, f - T, f + T, m, solid)
        : block(f - T, f + T, ya, yb, s0, s1, m, solid);

      if (solid) {
        wallSegments.push({
          axis: alongX ? 'x' : 'z',
          min: s0,
          max: s1,
          fixed: f,
          y0: ya,
          y1: yb
        });
      }

      return mesh;
    };

    let p = a;

    for (const [g0, g1] of [...gaps].sort((u, v) => u[0] - v[0])) {
      if (g0 > p) {
        seg(p, g0, y0, y0 + h, true);
      }

      if (h > DOOR_H) {
        seg(g0, g1, y0 + DOOR_H, y0 + h, false);
      }

      p = g1;
    }

    if (p < b) {
      seg(p, b, y0, y0 + h, true);
    }
  }

  // LÁMPARAS
  function lamp(x, y, z, color = 0xffd9a0, i = 28, flicker = false) {
    // Solo el 12 % de la intensidad original.
    const intensity = i * 0.12;

    const l = new THREE.PointLight(
      color,
      intensity,
      10,
      2
    );

    l.position.set(x, y, z);
    scene.add(l);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color })
    );

    bulb.position.copy(l.position);
    scene.add(bulb);

    lamps.push({
      l,
      base: intensity,
      flicker,
      ph: Math.random() * 9
    });
  }

  // COLECCIONABLES
  function pickup(type, x, y, z) {
    const h = new THREE.Group();

    if (type === 'ammo') {
      h.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.3, 0.3),
          mat(0x4b5320)
        ),
        new THREE.Mesh(
          new THREE.BoxGeometry(0.52, 0.08, 0.32),
          mat(0xd4b200)
        )
      );
    } else {
      const c = type === 'speed' ? 0xffb300 : 0x00e5ff;
      const s = new THREE.Group();

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10),
        mat(c, {
          emissive: c,
          emissiveIntensity: 1.2
        })
      );

      const needle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.25, 6),
        M.white
      );

      needle.position.y = -0.3;

      const plunger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6),
        M.dark
      );

      plunger.position.y = 0.3;

      s.add(body, needle, plunger);
      s.rotation.z = Math.PI / 6;
      h.add(s);
    }

    h.position.set(x, y, z);
    scene.add(h);

    pickups.push({
      type,
      h,
      y,
      on: true
    });
  }

  // AMBIENTE NOCTURNO
  // Cielo casi negro
  scene.background = new THREE.Color(0x020307);

  // Niebla oscura
  scene.fog = new THREE.FogExp2(
    0x020307,
    0.055
  );

  // Luz ambiental
  scene.add(
    new THREE.HemisphereLight(
      0x34405a,
      0x080707,
      0.18
    )
  );

  // Luz de luna
  const moon = new THREE.DirectionalLight(
    0x6379a0,
    0.12
  );

  moon.position.set(-20, 40, -30);
  scene.add(moon);

  // SUELOS, TECHOS Y ENTREPISO
  plane(-24, 24, -12, 12, 0, M.floor, true, 3);
  plane(-90, 40, -45, 45, -0.03, M.grass);
  plane(-24, 24, -12, 12, 8, M.ceiling, false);

  for (const [a, b, c, d] of [
    [-24, 6, -12, 12],
    [6, 16, -12, -3],
    [6, 16, 3, 12],
    [16, 24, -12, 12]
  ]) {
    plane(a, b, c, d, 4, M.floor, true, 3);
    plane(a, b, c, d, 4, M.ceiling, false);
  }

  // PLANTA ALTA
  const U = 4;

  wall(-24, -12, 24, -12, U, H);
  wall(-24, 12, 24, 12, U, H);
  wall(-24, -12, -24, 12, U, H);
  wall(24, -12, 24, 12, U, H);

  wall(-24, -3, 6, -3, U, H, [[-19, -17], [-3, -1]]);
  wall(-24, 3, 6, 3, U, H, [[-19, -17], [-3, -1]]);

  wall(16, -3, 24, -3, U, H);
  wall(16, 3, 24, 3, U, H);
  wall(16, -3, 16, 3, U, H);

  wall(-8, -12, -8, -3, U, H);
  wall(-8, 3, -8, 12, U, H, [[7, 9]]);

  wall(6, -3, 16, -3, 0, 2 * H);
  wall(6, 3, 16, 3, 0, 2 * H);

  for (let i = 0; i < 20; i++) {
    const x = 6 + i * 0.5;

    block(
      x,
      x + 0.5,
      0,
      4 * (1 - (x + 0.25 - 6) / 10),
      -3,
      3,
      M.wood,
      false
    );
  }

  // Armarios de la planta alta
  for (let x = -4; x < 23; x += 4.5) {
    furn(x, -11.3, 2.5, 0.7, 3, M.wood, U);
  }

  // Muebles y camas
  furn(10, -7, 3.2, 1.6, 0.9, M.wood, U);
  furn(16, -5, 1, 3, 0.9, M.cloth, U);

  furn(-12, -2.4, 2, 0.5, 0.9, M.wood, U);
  furn(-6, 1.4, 0.8, 2.6, 1.6, M.wood, U);

  furn(-21, 10.5, 4, 1.6, 0.7, M.white, U);

  furn(10, 8, 3.4, 2, 0.9, M.green, U);
  furn(20, 6, 1, 4, 0.9, M.cloth, U);

  // PLANTA BAJA
  wall(-24, -12, 24, -12, 0, H);
  wall(-24, 12, 24, 12, 0, H);
  wall(24, -12, 24, 12, 0, H);

  wall(-24, -12, -24, 12, 0, H, [[-7.5, -4.5]]);

  wall(
    16, -12, 16, 12, 0, H,
    [[-9, -7], [-3, 3], [7, 9]]
  );

  wall(
    -8, -12, -8, 12, 0, H,
    [[-8.5, -5.5], [5.5, 8.5]]
  );

  wall(-24, 0, -8, 0, 0, H, [[-17, -15]]);

  wall(0, -12, 0, -6, 0, H);
  wall(0, 6, 0, 12, 0, H);

  // Muebles
  furn(21, -8, 3, 2, 1.1, M.dark);
  furn(21, 8, 1.4, 4, 1, M.wood);

  furn(8, -9, 6, 1.6, 0.9, M.wood);
  furn(9, 9.5, 1.2, 4, 0.9, M.cloth);

  // Columnas originales
  for (const z of [-6, 0, 6]) {
    furn(-5, z, 0.8, 0.8, 4, M.wall);
  }

  furn(-16, -11.2, 10, 1.2, 1, M.white);
  furn(-16, -5, 4, 1.4, 1, M.white);
  furn(-23, -1.5, 1.2, 1.2, 2, M.white);

  furn(-22, 6, 1, 8, 2.2, M.wood);
  furn(-16, 11, 5, 1, 1.5, M.wood);

  // JARDÍN Y REFUGIO
  const fence = (a, b, c, d) =>
    wall(a, b, c, d, 0, 2.6, [], M.fence);

  fence(-24, -30, -70, -30);
  fence(-24, 30, -70, 30);
  fence(-70, -30, -70, 30);
  fence(-24, -30, -24, -12);
  fence(-24, 12, -24, 30);

  plane(-44, -24, -7.5, -4.5, 0.01, M.path);

  // Coches originales
  furn(-31.5, -2.5, 4.4, 2, 1.4, M.car);
  furn(-37, -10, 4.4, 2, 1.4, M.car);
  furn(-40, 3, 2, 4.4, 1.4, M.car);

  // Árboles
  let s = 11;

  const rnd = () =>
    (s = s * 16807 % 2147483647) / 2147483647;

  const tg = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
  const lg = new THREE.ConeGeometry(1.6, 5, 7);
  const lm = mat(0x14301a);

  for (let i = 0; i < 18; i++) {
    const x = -28 - rnd() * 40;
    const z = (rnd() - 0.5) * 56;

    if (
      Math.abs(z + 6) < 5 ||
      (x < -42 && z > -14 && z < 2)
    ) {
      continue;
    }

    const t = new THREE.Mesh(tg, M.wood);
    const l = new THREE.Mesh(lg, lm);

    t.position.set(x, 1, z);
    l.position.set(x, 4.5, z);

    scene.add(t, l);

    cols.push({
      x0: x - 0.4,
      x1: x + 0.4,
      z0: z - 0.4,
      z1: z + 0.4,
      y0: 0,
      y1: 3
    });
  }

  // REFUGIO
  wall(
    -44, -12, -44, 0, 0, 3.5,
    [[-7.5, -4.5]],
    M.conc
  );

  wall(-56, -12, -56, 0, 0, 3.5, [], M.conc);
  wall(-56, -12, -44, -12, 0, 3.5, [], M.conc);
  wall(-56, 0, -44, 0, 0, 3.5, [], M.conc);

  block(
    -56.2, -43.8,
    3.5, 3.8,
    -12.2, 0.2,
    M.conc,
    false
  );

  plane(-56, -44, -12, 0, 0.02, M.dark);

  // Muebles del refugio
  furn(-54.5, -10.5, 1.4, 1.4, 1, M.wood);
  furn(-54.5, -2.5, 2, 3.4, 0.6, M.cloth);
  furn(-50, -11, 3, 0.8, 1.2, M.wood);

  // Letrero
  const sc = document.createElement('canvas');
  sc.width = 256;
  sc.height = 64;

  const sg = sc.getContext('2d');

  sg.fillStyle = '#0b3d1e';
  sg.fillRect(0, 0, 256, 64);

  sg.fillStyle = '#7dff9a';
  sg.font = 'bold 40px Arial';
  sg.textAlign = 'center';
  sg.fillText('REFUGIO', 128, 46);

  const st = new THREE.CanvasTexture(sc);
  st.colorSpace = THREE.SRGBColorSpace;

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 0.75),
    new THREE.MeshBasicMaterial({ map: st })
  );

  sign.position.set(-43.8, 3, -6);
  sign.rotation.y = Math.PI / 2;

  scene.add(sign);

  // Luna
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(5, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xdde6ff,
      fog: false
    })
  );

  moonMesh.position.set(-60, 60, -100);
  scene.add(moonMesh);

  // LUCES DEL MAPA
  lamp(-16, 7.5, -8);
  lamp(-12, 7.5, 0, 0xffd9a0, 28, true);
  lamp(4, 7.5, 0);
  lamp(8, 7.5, -8);
  lamp(8, 7.5, 8, 0xff9a70);

  lamp(20, 3.5, 0);
  lamp(4, 3.5, -8);
  lamp(4, 3.5, 8, 0xffd9a0, 28, true);
  lamp(-16, 3.5, -6, 0xffd9a0, 28, true);
  lamp(-16, 3.5, 6);

  lamp(-26, 3.2, -6, 0xffe6b0, 24);
  lamp(-50, 3, -6, 0x66ff99, 22);

  // COLECCIONABLES DEL MAPA
  pickup('shield', 10, 4.9, -9);
  pickup('shield', -3, 0.9, 2);
  pickup('shield', -36, 0.9, 6);

  pickup('speed', 18, 4.9, 8);
  pickup('speed', -28, 0.9, -10);

  [
    [-10, 4.9, -10],
    [20, 4.9, -9.5],
    [22.5, 0.9, 10.8],
    [-5, 0.9, -9],
    [-16, 1.4, -5],
    [-12, 0.9, 10.5],
    [-40, 0.9, 6]
  ].forEach(([x, y, z]) => {
    pickup('ammo', x, y, z);
  });

  // API DEL MUNDO
  const api = {
    onPickup: () => {},

    walls,
    cols,
    furnitureModels,

    // Colisiones
    blocked(x, z, y) {
      for (const c of cols) {
        if (
          y + 1.7 < c.y0 + 0.2 ||
          y > c.y1 - 0.2
        ) {
          continue;
        }

        const dx =
          x - Math.max(c.x0, Math.min(x, c.x1));

        const dz =
          z - Math.max(c.z0, Math.min(z, c.z1));

        if (
          dx * dx + dz * dz <
          CFG.RADIUS * CFG.RADIUS
        ) {
          return true;
        }
      }

      return false;
    },

    // Altura del suelo
    floorY(x, z, y) {
      if (
        x >= 6 &&
        x <= 16 &&
        z >= -3 &&
        z <= 3
      ) {
        return 4 * (1 - (x - 6) / 10);
      }

      return y > 2.5 ? 4 : 0;
    },

    // Actualización de coleccionables y luces
    update(dt, t, p) {
      for (const k of pickups) {
        if (!k.on) {
          continue;
        }

        k.h.rotation.y += dt * 2;

        k.h.position.y =
          k.y + Math.sin(t * 2 + k.y) * 0.08;

        if (
          Math.abs(k.h.position.x - p.x) < 1.2 &&
          Math.abs(k.h.position.z - p.z) < 1.2 &&
          Math.abs(k.y - (p.y + 1)) < 1.5
        ) {
          k.on = false;
          k.h.visible = false;

          api.onPickup(k.type);
        }
      }

      // Luces parpadeantes para generar suspenso
      for (const l of lamps) {
        if (l.flicker) {
          const flickerValue =
            Math.sin(t * 23 + l.ph) *
            Math.sin(t * 7.3 + l.ph);

          l.l.intensity =
            l.base * (
              flickerValue > 0.6 ? 0.2 : 1
            );
        }
      }
    },

    // Reiniciar coleccionables
    reset() {
      pickups.forEach(k => {
        k.on = true;
        k.h.visible = true;
      });
    }
  };

  return api;
}
