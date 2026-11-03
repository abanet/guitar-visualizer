// Ejercicios de LECTURA RÍTMICA (prototipo, 11-02). Escritos por nosotros siguiendo la progresión de los métodos que
// recomendó el profe de Alberto (Benedict, "Sight Reading for the Classical Guitar", nivel 1; Leavitt para los niveles
// 2-3) y la de acentos del curso de Miky Moreno — sin copiar sus ejercicios.
//
// Notación de compases: "q q q q | h h | ..." — figuras: w (redonda), hd (blanca con puntillo), h (blanca),
// qd (negra con puntillo), q (negra), 8d, 8 (corchea), 16 (semicorchea). Sufijos: r = silencio ("qr"),
// ~ = ligada a la siguiente ("h~"), > = acento ("8>").
const E = (name, que, ts, bars, extra = {}) => ({ name, que, ts, bars, ...extra });

module.exports = {
  // ── NIVEL 1 · Primeras figuras (4 compases, 60 → 100 bpm) ─────────────────────────────────────────────────
  n1_01: E('La negra', 'La negra dura un pulso: una palmada en cada clic', [4, 4],
    'q q q q | q q q q | q q q q | q q q q', { how: 'Una <b>palmada</b> en cada <b>negra</b> (1 pulso) · cuenta en voz alta' }),
  n1_02: E('La blanca', 'La blanca dura dos pulsos: suena en el 1 y en el 3', [4, 4],
    'h h | q q h | h q q | h h', { how: '<b>Blanca</b> = 2 pulsos: da la palmada y sigue contando' }),
  n1_03: E('La redonda', 'La redonda ocupa el compás entero: cuatro pulsos', [4, 4],
    'w | h h | q q q q | w', { how: '<b>Redonda</b> = 4 pulsos: una palmada y cuenta hasta 4' }),
  n1_04: E('Negras, blancas y redondas', 'Las tres primeras figuras mezcladas', [4, 4],
    'q q h | h q q | q h q | w', { how: 'Mira la figura antes de tocarla · cuenta siempre los 4 pulsos' }),
  n1_05: E('El silencio de negra', 'Un pulso sin tocar: el silencio también se cuenta', [4, 4],
    'q qr q qr | q q q qr | qr q qr q | q q h', { how: 'En el <b>silencio</b> no toques, pero cuenta el pulso' }),
  n1_06: E('Silencios de blanca y redonda', 'Silencios largos sin perder la cuenta', [4, 4],
    'h hr | q q hr | hr h | wr', { how: 'Cuenta en voz alta durante los <b>silencios largos</b>' }),
  n1_07: E('La blanca con puntillo', 'El puntillo suma la mitad: tres pulsos', [4, 4],
    'hd q | q hd | hd qr | w', { how: '<b>Blanca con puntillo</b> = 3 pulsos' }),
  n1_08: E('En tres por cuatro', 'Compás de 3 pulsos: el 1 manda', [3, 4],
    'q q q | h q | q h | hd', { how: 'Compás de <b>3/4</b>: cuenta 1 2 3' }),
  n1_09: E('Las corcheas', 'Dos corcheas en cada pulso: "1 y 2 y"', [4, 4],
    '8 8 8 8 8 8 8 8 | q q 8 8 q | 8 8 q 8 8 q | h h', { how: '<b>Corcheas</b>: dos por pulso · cuenta "1 y 2 y"' }),
  n1_10: E('Corcheas y negras', 'Cambiar entre uno y dos golpes por pulso', [4, 4],
    'q 8 8 q 8 8 | 8 8 8 8 h | q q 8 8 8 8 | w', { how: 'Di la <b>"y"</b> en voz alta aunque no toques en ella' }),
  n1_11: E('El silencio de corchea', 'Tocar solo en la "y": el primer contratiempo', [4, 4],
    'q 8r 8 q 8r 8 | 8r 8 8r 8 h | q q 8r 8 q | w', { how: '<b>Silencio de corchea</b>: la palmada cae en la "y"' }),
  n1_12: E('Acentos en corcheas', 'Corcheas seguidas con el acento cambiando de sitio', [4, 4],
    '8> 8 8 8 8 8 8 8 | 8> 8 8 8 8> 8 8 8 | 8> 8 8> 8 8> 8 8> 8 | 8 8> 8 8> 8 8> 8 8>', { how: 'Toca todas las corcheas y <b>marca más fuerte</b> las del acento (&gt;)' }),
};
