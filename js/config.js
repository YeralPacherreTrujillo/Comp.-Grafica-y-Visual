// Constantes del juego y datos del nivel
export const CFG = {
  WALK: 4.2, BOOST: 1.7, BOOST_TIME: 8, SHIELD_TIME: 6,
  EYE: 1.65, RADIUS: 0.35,
  WEAPONS: [
    { name: 'Pistola',  file: 'models/arma1.glb', ammo: 12, pack: 8, size: 0.45, rot: 0, pos: [0.25, -0.24, -0.55] },
    { name: 'Escopeta', file: 'models/arma2.glb', ammo: 6,  pack: 4, size: 0.85, rot: 0, pos: [0.25, -0.26, -0.6] }
  ],
  ZOMBIE: {
    file: 'models/zombie.glb',
    height: 1.8,
    hp: 2,
    speed: 2.2,
    fast: 3.4,
    reach: 0.9
  },
  DETECT: 12,
  START: { x: -18, y: 4, z: -8, yaw: Math.PI },        // Dormitorio de inicio (planta alta)
  SAFE: { x0: -55.5, x1: -45, z0: -11.5, z1: -0.5 },   // Interior del refugio
  CHECKPOINTS: [                                       // Tecla T (pruebas)
    { x: -18, y: 4, z: -8, yaw: Math.PI },              // Dormitorio
    { x: 4, y: 4, z: 0, yaw: -Math.PI / 2 },            // Cima de las escaleras
    { x: 20, y: 0, z: 0, yaw: Math.PI / 2 },            // Vestíbulo
    { x: -12, y: 0, z: -7, yaw: Math.PI / 2 },          // Cocina
    { x: -28, y: 0, z: -6, yaw: Math.PI / 2 }           // Jardín
  ],
  // Posiciones originales de los zombis en la mansión y el jardín
  ZOMBIES: [
    [-6, 4, 1], [12, 4, -8], [18, 4, -6], [6, 4, 9], [16, 4, 9],
    [21, 0, -9], [21, 0, 8], [10, 0, -9], [4, 0, -5], [4, 0, 8], [10, 0, 9], [-4, 0, -9], [-4, 0, 3],
    [-14, 0, -9], [-20, 0, -3], [-14, 0, 8], [-21, 0, 5],
    [-28, 0, -10], [-34, 0, -6], [-38, 0, -3], [-40, 0, -10]
  ]
};
