// Clic de ratón real (CGEvent) en x,y de pantalla. Lo usa "Generar cola de ritmos.scpt" para pulsar la S de Drums
// en BiaB: el "click at" de System Events no llega a sus controles dibujados a medida (comprobado 2026-10-25).
// Uso: osascript -l JavaScript scripts/biab-clic.js <x> <y>
ObjC.import('CoreGraphics');
function run(argv){
  const x=+argv[0], y=+argv[1], p={x:x,y:y};
  $.CGEventPost(0, $.CGEventCreateMouseEvent(null, 5, p, 0)); delay(0.15);   // mover
  $.CGEventPost(0, $.CGEventCreateMouseEvent(null, 1, p, 0)); delay(0.08);   // pulsar
  $.CGEventPost(0, $.CGEventCreateMouseEvent(null, 2, p, 0));                // soltar
  return 'clic '+x+','+y;
}
