# Operación Extracción

FPS 3D de supervivencia desarrollado con Three.js, inspirado en *Left 4 Dead*. Despiertas en el segundo piso de una mansión infestada de zombis. Tu objetivo es bajar las escaleras, atravesar la planta baja y el jardín, y llegar al **refugio** para completar la misión.

## Ejecutar

Requiere un servidor local y conexión a internet para cargar Three.js.

```bash
cd extraccion
python -m http.server 8000
```

Abrir http://localhost:8000

También puede ejecutarse utilizando Live Server en Visual Studio Code.

## Escenario

- **Mansión:** dos plantas con habitaciones, pasillos, escaleras y mobiliario 3D, incluyendo camas y armarios.
- **Ambientación:** iluminación oscura, luces parpadeantes y linterna para explorar las zonas con poca visibilidad.
- **Jardín:** zona exterior con obstáculos y zombis.
- **Refugio:** destino final para completar la misión.

## Controles

| Tecla | Acción |
|---|---|
| W A S D | Moverse |
| Ratón | Mirar y apuntar |
| Clic izquierdo | Disparar |
| 1 / 2 | Cambiar de arma |
| Clic derecho | Usar inyección de escudo |
| F | Encender/apagar linterna |
| Esc | Pausar |
| T | Teletransporte de pruebas |

## Mecánicas

- **Armas:** dos armas disponibles con munición limitada y efectos de disparo.
- **Zombis:** detectan y persiguen al jugador cuando se encuentra cerca. Pueden eliminarse con disparos.
- **Munición:** cajas distribuidas por el escenario para recuperar balas.
- **Inyección de velocidad:** aumenta la velocidad durante 8 segundos.
- **Inyección de escudo:** protege del contacto con zombis durante 6 segundos.
- **Game Over:** ocurre cuando un zombi alcanza al jugador sin protección.
- **Misión completada:** se consigue al llegar al refugio.

## Modelos 3D

El juego incorpora modelos de armas, zombis y mobiliario, incluyendo camas y armarios, para mejorar la ambientación del escenario.

Los modelos se encuentran en la carpeta `models/`.

## Recursos externos

- Three.js (MIT) — https://threejs.org
- Modelos 3D de armas, zombis y mobiliario.

## Autor

**Yeral Francesco Pacherre Trujillo**

Proyecto académico de Computación Gráfica y Visual.
