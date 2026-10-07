#!/bin/sh
# Regeneración completa (fondo = notas del acorde que suena, tónica rojiza): 4 temas × 3 vídeos, uno detrás de otro.
S="$(cd "$(dirname "$0")" && pwd)"; B="/Volumes/BanetMasa/CanalGuitarra/Generador vídeos Claude/Triadas/temasConTriadas"
uno() { # carpeta, base, nombre, script, grupo, etiqueta de salida del script, nombre final
  rm -rf "$S/r_$3_$7"
  node "$S/$4" --xml "$B/$1/$2.XML" --audio "$B/$1/$2_Render.m4a" --out "$S/r_$3_$7" --groups $5 --invs 0 --width 1920 --height 1080 --vis-config "$S/vis-triadfull.json" > "$S/r_$3_$7.log" 2>&1 \
    && cp "$S/r_$3_$7/triads_$6_fundamental.mp4" "$B/$1/niveles/$3_$7.mp4" && echo "OK $3 $7" || echo "FALLO $3 $7"
}
tema() {
  uno "$1" "$2" "$3" nivel1-forma-fija.js 3 cuerdas321 nivel1_facil_cuerdas123
  uno "$1" "$2" "$3" nivel1-forma-fija.js 0 cuerdas432 nivel1_facil_cuerdas234
  uno "$1" "$2" "$3" nivel2-zona.js 3 cuerdas321 nivel2_intermedio
}
tema theRiver "BRUCE SPRINGSTEEN The river" TheRiver
tema _LetItBe "BEATLES Let it be" LetItBe
tema _Sultans "Sultans" Sultans
tema standbyme "BEN E. KING Stand by me" StandByMe
