# Operación Extracción

FPS 3D en Three.js. Despiertas en el dormitorio del piso alto de una mansión infestada de zombis (estilo *Punto muerto* de Left 4 Dead). Baja por las escaleras, cruza la planta baja y el jardín, y entra al **refugio** para ponerte a salvo.

## Ejecutar
Requiere un servidor local (los módulos y los .glb no cargan con doble clic) y conexión a internet (Three.js por CDN).

```
cd extraccion
python -m http.server 8000
```
Abrir http://localhost:8000

## Modelos (carpeta `models/`)
- `arma1.glb`, `arma2.glb`, `zombie.glb`. Si falta alguno, el juego usa una forma articulada de reemplazo.
- Ajustes por modelo (tamaño, giro) en `js/config.js`.

### Importar Modelos 3D del Entorno (carpeta `models/env/`)
Ahora cuentas con un sistema listo para importar diseños 3D personalizados del mapa:
1. Guarda tus modelos en formato `.glb` o `.gltf` en `models/env/` (consulta `models/env/LEEME.txt` para sitios de descarga gratuita y coordenadas del mapa).
2. Abre `js/environmentModels.js` y añade tus objetos en la lista `ENV_CONFIG`.
3. Configurando `solid: true`, el juego crea automáticamente las colisiones para bloquear al jugador y zombis, y registra las superficies para que las balas reboten con chispas y marcas.

## Efectos y Animaciones
- **Zombis con Caminata Procedimental**: Animación dinámica de marcha con rebote vertical (bobbing), cojera lateral, arremetida hacia adelante, tambaleo al recibir balas (stagger), destello rojo de daño y caída suave al morir. Si el modelo GLB incluye animaciones esqueletales (`walk`/`run`), se reproducen automáticamente con `AnimationMixer`.
- **Diseño de Disparo y Balas Visibles**:
  - Fogonazo de boca de cañón (muzzle flash) con luz puntual dinámica que ilumina la habitación.
  - Proyectiles trazadores 3D dorados brillantes que surcan el aire en tiempo real desde el cañón del arma.
  - Escopeta con dispersión radial de perdigones múltiples.
- **Efectos de Impacto**:
  - En zombis: salpicadura 3D de partículas de sangre con gravedad y física, destello de impacto y retroceso.
  - En paredes/escenario: chispas brillantes con rebote, bocanada de humo y marcas de impacto (decals) en la superficie.
  - Sonido sintetizado en tiempo real con Web Audio API y respuesta en la mira (hitmarker).

## Controles
| Tecla | Acción |
|---|---|
| W A S D | Moverse |
| Ratón | Mirar |
| Clic izquierdo | Disparar (un disparo por clic) |
| 1 / 2 | Cambiar de arma |
| Clic derecho | Usar inyección de escudo (6 s) |
| T | Teletransporte de pruebas (quitar en la entrega final si se desea) |

## Mecánicas
- Cada arma tiene su munición; solo se recupera con cajas de munición del escenario.
- Zombis: inactivos hasta que entras en su rango (`DETECT`), mueren con 2 impactos (raycasting, las paredes bloquean disparos).
- Inyecciones: velocidad (8 s) y escudo (clic derecho, 6 s, inmune al contacto).
- Contacto con un zombi → GAME OVER (clic para reiniciar). Llegar al refugio → MISIÓN COMPLETADA.

## Recursos externos
- Three.js (MIT) — https://threejs.org
- Armas: _(completar fuente y licencia)_
- Zombi: _(completar fuente y licencia)_
