
import * as THREE from 'three';
import { CFG } from './config.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createZombies } from './zombies.js';
import { createWeapons } from './weapons.js';
import { createFX } from './fx.js';
import { loadEnvironmentModels } from './environmentModels.js';

// ESCENA Y RENDERIZADO
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.05,
  300
);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

// Tonos cinematográficos para una atmósfera de terror
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.75;

document.body.appendChild(renderer.domElement);

// MUNDO Y JUGADOR
const world = createWorld(scene);
const fx = createFX(scene);

// Las armas son hijas de la cámara
scene.add(camera);

const player = createPlayer(
  camera,
  renderer.domElement,
  world
);

const $ = id => document.getElementById(id);

let state = 'menu';
let cp = 0;
let toastT = 0;

const toast = msg => {
  $('toast').textContent = msg;
  $('toast').style.opacity = 1;
  toastT = 2.5;
};

// LINTERNA TÁCTICA
function createWeaponFlashlight(camera) {

  const group = new THREE.Group();

  // Posición en la parte inferior derecha de la cámara,
  // simulando una linterna instalada bajo el arma.
  group.position.set(0.22, -0.19, -0.42);

  camera.add(group);

  // Material metálico oscuro
  const metal = new THREE.MeshStandardMaterial({
    color: 0x202329,
    metalness: 0.75,
    roughness: 0.35
  });

  // Cuerpo de la linterna
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.038,
      0.043,
      0.20,
      16
    ),
    metal
  );

  body.rotation.x = Math.PI / 2;
  group.add(body);

  // Cabezal
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.052,
      0.043,
      0.055,
      16
    ),
    metal
  );

  head.rotation.x = Math.PI / 2;
  head.position.z = -0.12;
  group.add(head);

  // Cristal de la linterna
  const lensMaterial = new THREE.MeshBasicMaterial({
    color: 0xeaf4ff
  });

  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.042, 20),
    lensMaterial
  );

  lens.position.z = -0.15;
  group.add(lens);

  // Luz principal
  const light = new THREE.SpotLight(
    0xe5efff,
    22,
    35,
    Math.PI / 9,
    0.5,
    1.5
  );

  light.position.set(0, 0, -0.16);

  // El objetivo está delante de la cámara.
  const target = new THREE.Object3D();
  target.position.set(-0.22, 0.19, -15);

  group.add(light);
  group.add(target);

  light.target = target;

  // Luz secundaria para suavizar la iluminación cercana
  const fillLight = new THREE.PointLight(
    0xb9d3ff,
    0.3,
    2.5,
    2
  );

  fillLight.position.set(0, 0, -0.14);
  group.add(fillLight);

  let enabled = true;

  function setEnabled(value) {
    enabled = value;
    light.visible = enabled;
    fillLight.visible = enabled;
    lensMaterial.color.setHex(
      enabled ? 0xeaf4ff : 0x28303a
    );
  }

  return {
    light,
    group,

    toggle() {
      setEnabled(!enabled);
      return enabled;
    },

    isEnabled() {
      return enabled;
    },

    reset() {
      setEnabled(true);
    }
  };
}

const flashlight = createWeaponFlashlight(camera);

// ZOMBIS Y ARMAS
const zombies = await createZombies(
  scene,
  world,
  player
);

const weapons = await createWeapons(
  scene,
  camera,
  world,
  zombies,
  fx,
  player,

  () => state === 'playing',

  toast,

  hit => {
    const c = $('cross');
    c.classList.add('hit');

    setTimeout(() => {
      c.classList.remove('hit');
    }, 120);
  }
);

// MODELOS 3D
await loadEnvironmentModels(scene, world);

// COLECCIONABLES
world.onPickup = type => {

  if (type === 'shield') {
    player.addShield();

    toast(
      'Inyección de ESCUDO recogida: clic derecho para usarla'
    );

  } else if (type === 'speed') {

    player.boost();
    toast('¡Inyección de VELOCIDAD activada!');

  } else {

    weapons.addAmmo();
    toast('Caja de munición recogida');

  }
};

// ZONAS
const inSafe = p =>
  p.x > CFG.SAFE.x0 &&
  p.x < CFG.SAFE.x1 &&
  p.z > CFG.SAFE.z0 &&
  p.z < CFG.SAFE.z1;

const zone = p =>
  inSafe(p)
    ? 'Refugio'
    : p.x < -24
      ? 'Jardín'
      : p.y > 2.5
        ? 'Planta alta'
        : 'Planta baja';

// PANTALLA Y ESTADOS
$('overlay').addEventListener('click', () => {

  if (state === 'won' || state === 'dead') {

    player.reset();
    world.reset();
    zombies.reset();
    weapons.reset();
    flashlight.reset();

  }

  renderer.domElement.requestPointerLock();

});

document.addEventListener(
  'pointerlockchange',
  () => {

    if (
      document.pointerLockElement ===
      renderer.domElement
    ) {

      state = 'playing';
      $('overlay').style.display = 'none';

    } else if (state === 'playing') {

      state = 'paused';

      $('ov-title').textContent = 'PAUSA';

      $('ov-text').textContent =
        'Clic para continuar';

      $('overlay').style.display = 'grid';

    }
  }
);

// CONTROLES
addEventListener('keydown', e => {

  // Evitar repeticiones al mantener pulsada la tecla
  if (e.repeat) return;

  // Encender / apagar linterna
  if (
    e.code === 'KeyF' &&
    state === 'playing'
  ) {

    const enabled = flashlight.toggle();

    toast(
      enabled
        ? 'Linterna encendida'
        : 'Linterna apagada'
    );

  }

  // Teletransporte original
  if (
    e.code === 'KeyT' &&
    state === 'playing'
  ) {

    player.teleport(
      CFG.CHECKPOINTS[
        cp++ % CFG.CHECKPOINTS.length
      ]
    );

  }

});

// VICTORIA
function win() {

  state = 'won';

  $('ov-title').textContent =
    '¡MISIÓN COMPLETADA!';

  $('ov-text').textContent =
    'Has llegado a la zona de extracción';

  $('overlay')
    .querySelector('p:last-child')
    .innerHTML =
      '<b>Clic para jugar de nuevo</b>';

  $('overlay').style.display = 'grid';

  document.exitPointerLock();

}

// DERROTA
function over() {

  state = 'dead';

  $('ov-title').textContent = 'GAME OVER';

  $('ov-text').textContent =
    'Un zombi te atrapó';

  $('overlay')
    .querySelector('p:last-child')
    .innerHTML =
      '<b>Clic para reiniciar</b>';

  $('overlay').style.display = 'grid';

  document.exitPointerLock();

}

// BUCLE PRINCIPAL
const clock = new THREE.Clock();

player.update(0);

renderer.setAnimationLoop(() => {

  const dt = Math.min(
    clock.getDelta(),
    0.05
  );

  const t = clock.elapsedTime;
  const st = player.st;

  if (state === 'playing') {

    player.update(dt);
    weapons.update(dt);

    if (zombies.update(dt)) {

      over();

    } else if (inSafe(player.pos)) {

      win();

    }

  }

  fx.update(dt);

  world.update(
    dt,
    t,
    player.pos
  );

  if (
    toastT > 0 &&
    (toastT -= dt) <= 0
  ) {
    $('toast').style.opacity = 0;
  }

  $('zone').textContent =
    zone(player.pos);

  $('shields').textContent =
    st.shields;

  $('ammo').textContent =
    weapons.label();

  $('shieldfx').textContent =
    st.shieldT > 0
      ? `· Escudo ${st.shieldT.toFixed(1)}s`
      : '';

  $('speedfx').textContent =
    st.speedT > 0
      ? `· Velocidad ${st.speedT.toFixed(1)}s`
      : '';

  $('shield').classList.toggle(
    'on',
    st.shieldT > 0
  );

  renderer.render(
    scene,
    camera
  );

});

// AJUSTAR PANTALLA
addEventListener('resize', () => {

  camera.aspect =
    innerWidth / innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    innerWidth,
    innerHeight
  );

});
