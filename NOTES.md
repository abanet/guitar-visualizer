# Guitar Visualizer — contexto del proyecto

## Qué es
App web (guitar-visualizer-v4_3_13.html) que ayuda a guitarristas amateur a
practicar improvisación: fretboard interactivo, ejercicios (triadas,
arpegios, escalas), renderizado con SVG (no canvas de píxeles).
Actualmente ~10.000 líneas en un único archivo HTML con CSS y JS inline.

Forma parte de BanetMasa, canal de YouTube de guitarra (75k subs) que su
creador está convirtiendo en negocio (modelo freemium: biblioteca de
ejercicios + futura capa de personalización con IA).

## Decisión: reestructurar a ES Modules
El proyecto va a crecer bastante, así que en vez de una separación mínima
(solo sacar <style> y <script> a archivos aparte), se opta por dividir el
JS en módulos por función (audio.js, fretboard.js, library.js, etc.) usando
import/export nativos del navegador, sin bundler todavía (Vite queda como
opción futura si hace falta).

## Objetivo en exploración: generación automática de vídeo
Ahora mismo los vídeos de ejercicios se graban a mano con ScreenFlow
(captura de pantalla). Se quiere automatizar esto, generando vídeos
directamente desde la app — potencialmente para los ~700 ejercicios que ya
existen y los que se vayan añadiendo.

Se descartó ir directo a una app de escritorio: el problema es de
automatización de navegador + composición de vídeo, resoluble sin salir
del ecosistema web/Node.

Enfoque elegido para probar viabilidad (antes de comprometerse a nada):
**Playwright (Chrome headless) + ffmpeg**
- Cargar el HTML en un navegador sin interfaz.
- Avanzar la animación frame a frame de forma controlada (vía
  `page.evaluate()`, no en tiempo real) para evitar frames perdidos o
  desincronización.
- Capturar cada frame con `page.screenshot()`.
- Componer el vídeo final con ffmpeg (`ffmpeg -framerate 30 -i
  frame_%04d.png -c:v libx264 output.mp4`), mezclando audio aparte si hace
  falta.
- Corre como script Node normal, sin backend ni Electron. Sirve para
  generar en batch sin supervisión humana.

Otras opciones consideradas y descartadas por ahora:
- Captura en vivo en el propio navegador del usuario (MediaRecorder +
  canvas oculto pintado desde el SVG) — más frágil para generación en
  batch.
- Renderizado nativo en servidor (motor de dibujo portado a Node sin DOM)
  — el más rápido a gran escala, pero requiere tener antes la lógica de
  dibujo bien aislada tras la modularización.

## Siguiente paso
1. Dividir el HTML actual en módulos ES (ver arriba).
2. Prototipar la generación de vídeo con Playwright + ffmpeg sobre un
   ejercicio de ejemplo, y comparar calidad/tiempo contra ScreenFlow antes
   de decidir si esto sustituye la grabación manual.
