# Guitar Visualizer — notas para Claude

App web de un solo fichero (`guitarvisualizer.html`) para practicar guitarra y generar los vídeos
del canal BanetMasa. Mapa del código: `MAPA_CODIGO.md`. Contexto general: `NOTES.md`.

## Convenciones
- Todo en español (UI, comentarios, mensajes). En texto nuevo, "triada" sin tilde.
- Comentarios largos que explican el **porqué** (bug reportado, decisión de Alberto); seguir ese estilo.
- Cada cambio de comportamiento sube `APP_VERSION` (constante en el primer `<script>`).
- Nada de `localStorage` para funciones nuevas: los datos van horneados en el HTML o en la sesión.
- Ampliar de forma retrocompatible: una funcionalidad nueva no puede cambiar el resultado de las
  existentes (comprobarlo con un test de regresión contra `master`).
- Solo commit/merge/push cuando Alberto lo pide.

## Verificación
- Syntax check de todos los `<script>` y tests con jsdom (`npm i` instala jsdom como devDependency).
  La app entera carga en jsdom (`runScripts:'dangerously'`, `alert`/`confirm` sustituidos); para
  importar un XML: `loadXML({files:[new window.File([texto],'x.xml')]})`.
- `node tools/test-drop2-cycle.js` — syntax check + drop 2 por ciclos + regresión de tríadas.

## Funcionalidades recientes
### Drop 2 por ciclos (Goodrick) — v4.4.0
Pestaña Tríadas → tarjeta "Drop 2 por ciclos (Goodrick)". Cuatriadas drop 2 en cuerdas 4-3-2-1
encadenadas por el ciclo 4 diatónico (2 notas comunes, 2 voces bajan un grado), calculado desde los
acordes reales del XML (vale en cualquier tonalidad). Decisiones de Alberto (2026-10-14): cada vuelta
reinicia en el voicing inicial (el ciclo baja ~6-7 trastes por vuelta), los compases vacíos mantienen
el último acorde, bloque dentro de la pestaña Tríadas (excluyente con sus 6 estrategias), sin
persistencia de opciones (como el resto de la pestaña). Se reproduce por la ruta de tríadas sin
cambios. Detalle de funciones en `MAPA_CODIGO.md`.

v4.5.0: los 6 ciclos (2-7) y modo automático (por defecto en la UI: el ciclo sale de los acordes;
con un XML de ciclo 4 da lo mismo que la v4.4.0). Regla común: notas comunes quietas, el resto un
grado en el mismo sentido — 2/4/6 bajan, 3/5/7 suben. Opción "Destacar notas guía (3ª y 7ª)": anillo dorado,
apagada por defecto (sin ella los frames son idénticos).

Siguientes fases previstas (no hechas): otros
juegos de cuerdas (2-5, 3-6 → `DROP2_STRING_SETS`), drop 3, menor melódica/armónica, modo
bloque ↔ arpegio, tramo de ciclo dentro de un ii-V-I, contrapunto a 2 voces.
