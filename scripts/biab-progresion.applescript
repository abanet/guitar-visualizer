-- Teclea una progresión en la hoja de acordes de Band-in-a-Box (la canción que esté abierta).
--
-- Por qué así (2026-10-26): los selectores de estilo de BiaB están dibujados a medida y no se pueden manejar
-- desde fuera, pero la hoja de acordes sí acepta teclado: escribir el acorde + Return lo pone en la celda y
-- avanza MEDIO compás. Así que Alberto deja abierta una canción base con el estilo, el tempo y la tonalidad
-- (p. ej. CambioArpegioPlantilla.SGU: Smooth Jazz Poppy, C, 80 bpm) y este script solo escribe los acordes.
-- Inicio (Home) lleva el cursor al compás 1; no hace falta clic.
--
-- Uso: osascript scripts/biab-progresion.applescript <vueltas> "<acorde>:<medios compases>,…" [<acorde final>]
--   p. ej. osascript scripts/biab-progresion.applescript 8 "C7:4,F7:4" C7
--   → C7 2 compases, F7 2 compases, 8 vueltas (compases 1-32) y C7 en el compás 33.
-- No toques el teclado mientras escribe. Después: guardar con otro nombre y exportar las 12 tonalidades.

on run argv
	set vueltas to (item 1 of argv) as integer
	set AppleScript's text item delimiters to ","
	set pasos to text items of (item 2 of argv)
	set acordeFinal to ""
	if (count of argv) > 2 then set acordeFinal to item 3 of argv
	tell application "System Events"
		set frontmost of process "Band-in-a-Box-x64" to true
		delay 0.4
		key code 115 -- Inicio: compás 1, tiempo 1
		delay 0.3
		repeat vueltas times
			repeat with paso in pasos
				set AppleScript's text item delimiters to ":"
				set acorde to text item 1 of (paso as text)
				set medios to (text item 2 of (paso as text)) as integer
				keystroke acorde
				delay 0.1
				key code 36
				delay 0.1
				repeat (medios - 1) times
					key code 36
					delay 0.08
				end repeat
			end repeat
		end repeat
		if acordeFinal is not "" then
			keystroke acordeFinal
			delay 0.1
			key code 36
		end if
		key code 115
	end tell
	return "Progresión escrita: " & vueltas & " vueltas de " & (item 2 of argv)
end run
