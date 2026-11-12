
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Modelos adicionales opcionales. Los muebles se obtienen de world.js.
export const ENV_CONFIG = [];

export async function loadEnvironmentModels(scene, world) {
  const loader = new GLTFLoader();
  const loadedObjects = [];
  const models = [...ENV_CONFIG, ...(world.furnitureModels || [])];
  const cache = new Map();

  function getGLTF(file) {
    if (!cache.has(file)) cache.set(file, loader.loadAsync(file));
    return cache.get(file);
  }

  async function addModel(item) {
    try {
      const gltf = await getGLTF(item.file);
      const root = gltf.scene.clone(true);
      root.name = item.id || item.file;
      root.position.set(0, 0, 0);
      root.scale.set(1, 1, 1);

      if (item.targetSize) {
        root.updateMatrixWorld(true);
        const source = new THREE.Box3().setFromObject(root);
        const size = source.getSize(new THREE.Vector3());
        if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
          throw new Error('El modelo no tiene dimensiones válidas');
        }
        const [w, h, d] = item.targetSize;
        root.scale.set(w / size.x, h / size.y, d / size.z);
        root.updateMatrixWorld(true);
        const fitted = new THREE.Box3().setFromObject(root);
        root.position.set(
          item.pos[0] - (fitted.min.x + fitted.max.x) / 2,
          item.pos[1] - fitted.min.y,
          item.pos[2] - (fitted.min.z + fitted.max.z) / 2
        );
      } else {
        if (item.pos) root.position.set(...item.pos);
        if (Array.isArray(item.rot)) root.rotation.set(...item.rot);
        else if (typeof item.rot === 'number') root.rotation.y = item.rot;
        if (Array.isArray(item.scale)) root.scale.set(...item.scale);
        else if (typeof item.scale === 'number') root.scale.setScalar(item.scale);
      }
      root.updateMatrixWorld(true);

      root.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.isEnvModel = true;
        if (world.walls) world.walls.push(child);
      });

      // Solo después de cargar correctamente quitamos el bloque original.
      // Así nunca desaparecen los muebles si falla un archivo GLB.
      scene.add(root);
      if (item.placeholder) {
        scene.remove(item.placeholder);
        const index = world.walls?.indexOf(item.placeholder) ?? -1;
        if (index >= 0) world.walls.splice(index, 1);
        item.placeholder.geometry.dispose();
      } else if (item.solid && world.cols) {
        const box = new THREE.Box3().setFromObject(root);
        world.cols.push({
          x0: box.min.x, x1: box.max.x,
          y0: box.min.y, y1: box.max.y,
          z0: box.min.z, z1: box.max.z
        });
      }
      loadedObjects.push({ item, root });
      console.log(`[Entorno 3D] Cargado: ${root.name}`);
    } catch (error) {
      console.warn(`[Entorno 3D] No se pudo cargar ${item.file}. Se conserva el bloque original.`, error);
    }
  }

  // Carga en paralelo y sin bloquear el inicio del juego.
  // main.js puede seguir usando: await loadEnvironmentModels(scene, world)
  void Promise.allSettled(models.filter(item => item.file).map(addModel));
  return loadedObjects;
}
