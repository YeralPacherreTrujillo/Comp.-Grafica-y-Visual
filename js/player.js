import * as THREE from 'three';
import { CFG } from './config.js';

// Jugador en primera persona: cámara, movimiento WASD, colisiones y efectos de inyecciones
export function createPlayer(camera, dom, world) {
  const pos = new THREE.Vector3();                  // posición de los pies
  const st = { yaw: 0, pitch: 0, bob: 0, speedT: 0, shieldT: 0, shields: 0, ammoPacks: 0 };
  const keys = {};
  camera.rotation.order = 'YXZ';

  addEventListener('keydown', e => { keys[e.code] = true; });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement !== dom) return;
    st.yaw -= e.movementX * 0.0022;
    st.pitch = THREE.MathUtils.clamp(st.pitch - e.movementY * 0.0022, -1.5, 1.5);
  });
  addEventListener('mousedown', e => { if (e.button === 2 && document.pointerLockElement === dom) useShield(); });
  addEventListener('contextmenu', e => e.preventDefault());

  function useShield() {   // clic derecho: consume una inyección y activa el escudo por tiempo limitado
    if (st.shields > 0 && st.shieldT <= 0) { st.shields--; st.shieldT = CFG.SHIELD_TIME; }
  }
  function teleport(c) { pos.set(c.x, c.y, c.z); st.yaw = c.yaw; st.pitch = 0; }
  teleport(CFG.START);

  return {
    pos, st, teleport,
    addShield() { st.shields++; },
    boost() { st.speedT = CFG.BOOST_TIME; },
    get shielded() { return st.shieldT > 0; },     // la parte 3 lo usará para ignorar el ataque de los zombis
    reset() { st.shields = 0; st.speedT = 0; st.shieldT = 0; st.ammoPacks = 0; teleport(CFG.START); },
    update(dt) {
      st.speedT = Math.max(0, st.speedT - dt); st.shieldT = Math.max(0, st.shieldT - dt);
      const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      if (f || r) {
        const k = CFG.WALK * (st.speedT > 0 ? CFG.BOOST : 1) * dt / Math.hypot(f, r), sn = Math.sin(st.yaw), cs = Math.cos(st.yaw);
        const dx = (-sn * f + cs * r) * k, dz = (-cs * f - sn * r) * k;
        if (!world.blocked(pos.x + dx, pos.z, pos.y)) pos.x += dx;     // ejes por separado: se desliza por las paredes
        if (!world.blocked(pos.x, pos.z + dz, pos.y)) pos.z += dz;
        st.bob += dt * 9 * (st.speedT > 0 ? 1.4 : 1);
      }
      pos.y = world.floorY(pos.x, pos.z, pos.y);
      camera.position.set(pos.x, pos.y + CFG.EYE + (f || r ? Math.sin(st.bob) * 0.035 : 0), pos.z);
      camera.rotation.set(st.pitch, st.yaw, 0);
    }
  };
}
