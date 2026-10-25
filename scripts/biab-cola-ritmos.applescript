-- ============================================================
--  BiaB - Biblioteca de renders AIFF a tempo constante
--  Trabaja sobre la cancion abierta. Compases fijos.
-- ============================================================

property appName : "Band-in-a-Box"

-- ==================== CONFIGURACION ====================
-- COLA (2026-10-25): si no esta vacia, se ignoran los valores de abajo y se procesa cada ritmo:
-- {nombre, bpmInicial, bpmFinal, incremento}. Abre carpetaRitmos/<nombre>.SGU (con su bateria y compas
-- ya guardados; los crea scripts/make-biab-sgu.py) y deja los AIFF en fuentes-descargas/<nombre>/.
property cola : {{"BluesRock128", 45, 120, 5}, {"SalsaBachata", 90, 145, 5}, {"Salsa", 80, 135, 5}, {"MerengueAlex", 105, 165, 5}, {"Tango", 80, 140, 5}, {"DjembeKeitaEv16", 60, 130, 5}}
property carpetaRitmos : "/Volumes/BanetMasa/CanalGuitarra/BandInABox/Ritmos/"
property carpetaBase : "/Users/alberto/guitar-visualizer-assets/fuentes-descargas/"

property temposManual : {}
-- Solo se usan si temposManual esta vacio: {}
property bpmInicial : 45
property bpmFinal : 120
property incremento : 5

property compases : 200

property carpetaSalida : "/Users/alberto/guitar-visualizer-assets/fuentes-descargas/BluesRock128/"
property prefijoManual : "BluesRock128"
property sufijo : "_Render"
property rellenarCeros : false
property timeoutRender : 1800
-- =======================================================

property logTxt : ""
property logPath : ""

on run
	if (count of cola) is 0 then
		my renderLote()
		return
	end if
	set resumen to ""
	repeat with r in cola
		set nombre to item 1 of r
		set prefijoManual to nombre
		set bpmInicial to item 2 of r
		set bpmFinal to item 3 of r
		set incremento to item 4 of r
		set carpetaSalida to carpetaBase & nombre & "/"
		set temposManual to {}
		try
			my abrirCancion(carpetaRitmos & nombre & ".SGU", nombre)
			set res to my renderLote()
		on error e
			set res to "FALLO abriendo " & nombre & ".SGU: " & e
		end try
		set resumen to resumen & nombre & ": " & res & return
		-- un fallo en un ritmo no para la cola: se apunta y se sigue con el siguiente
	end repeat
	set logTxt to resumen
	try
		my writeText(resumen, (POSIX path of (path to downloads folder)) & "biab_cola_resumen.txt")
	end try
	display dialog "Cola terminada:" & return & return & resumen buttons {"OK"} default button 1
end run

on abrirCancion(ruta, nombre)
	do shell script "test -f " & quoted form of ruta
	do shell script "open -a " & quoted form of "/Applications/Band-in-a-Box/Band-in-a-Box.app" & " " & quoted form of ruta
	repeat 30 times
		delay 1
		if my tituloVentana() contains ("[" & nombre & ".SGU]") then
			delay 2
			my soloDrums()
			return
		end if
	end repeat
	error "BiaB no mostro la cancion (titulo: " & my tituloVentana() & ")"
end abrirCancion

-- Boton "S" (solo) de la pista Drums: BiaB no lo guarda en el .SGU y al abrir otra cancion vuelve a sonar
-- todo (comprobado 2026-10-25), asi que se pulsa en cada cancion recien abierta. La lista de pistas esta
-- dibujada a medida (sin accesibilidad): posicion medida con el raton respecto a la esquina de la ventana
-- principal (ventana en 1004,113 de 1500x982). Si se cambia el tamano de la ventana de BiaB, volver a medir.
property soloDrumsDX : 232
property soloDrumsDY : 337

on soloDrums()
	tell application appName to activate
	delay 0.8
	set wx to missing value
	tell application "System Events"
		tell process appName
			repeat with w in windows
				if (name of w as text) contains "Band-in-a-Box [" then
					set {wx, wy} to position of w
					exit repeat
				end if
			end repeat
		end tell
	end tell
	if wx is missing value then error "No encuentro la ventana principal para pulsar la S de Drums"
	-- clic de raton real: el "click at" de System Events no llega a los botones de BiaB
	do shell script "osascript -l JavaScript " & quoted form of "/Users/alberto/guitar-visualizer/scripts/biab-clic.js" & " " & ((wx + soloDrumsDX) as integer) & " " & ((wy + soloDrumsDY) as integer)
	delay 1
end soloDrums

on renderLote()
	if carpetaSalida does not end with "/" then
		set carpetaSalida to carpetaSalida & "/"
	end if
	
	try
		do shell script "mkdir -p " & quoted form of carpetaSalida
	on error e
		return "No pude crear la carpeta: " & e
	end try
	
	tell application appName to activate
	delay 1.2
	
	set base to my prefijoCancion()
	if base is "" then
		return "Sin nombre de cancion"
	end if
	
	set logPath to (POSIX path of (path to downloads folder)) & "biab_export_log_" & prefijoManual & ".txt"
	set logTxt to "EXPORTACION BiaB - " & ((current date) as text) & return
	set logTxt to logTxt & "Prefijo: " & base & return
	set logTxt to logTxt & "Compases: " & (compases as text) & return
	set logTxt to logTxt & "Carpeta: " & carpetaSalida & return
	
	-- Compases: se fijan una sola vez, no dependen del tempo
	try
		my ponerCompases(compases)
	on error e
		my anotar("FALLO fijando compases: " & e)
		return my fin("Fallo fijando el numero de compases.")
	end try
	
	if (count of temposManual) is greater than 0 then
		set listaBpm to temposManual
	else
		set listaBpm to {}
		set t to bpmInicial
		repeat while t is less than or equal to bpmFinal
			set end of listaBpm to t
			set t to t + incremento
		end repeat
	end if
	set total to count of listaBpm
	set hechos to 0
	
	repeat with bpmRef in listaBpm
		set b to bpmRef as integer
		set nom to base & sufijo & "_" & my fmt(b) & ".aiff"
		set rutaFull to carpetaSalida & nom
		
		my anotar("")
		my anotar("=== " & (b as text) & " BPM  ->  " & nom & "   (" & ((hechos + 1) as text) & "/" & (total as text) & ")")
		
		try
			do shell script "rm -f " & quoted form of rutaFull
		end try
		
		try
			my ponerTempo(b)
		on error e
			my anotar("FALLO fijando tempo: " & e)
			return my fin("Fallo fijando el tempo a " & (b as text) & " BPM.")
		end try
		
		delay 1
		my anotar("    titulo: " & my tituloVentana())
		
		try
			my guardarAudio(nom)
		on error e
			my anotar("FALLO guardando: " & e)
			return my fin("Fallo en el dialogo de guardado a " & (b as text) & " BPM." & return & e)
		end try
		
		set res to my esperarRender(rutaFull)
		my anotar("    " & res)
		if res starts with "TIMEOUT" then
			return my fin("El render de " & nom & " no termino a tiempo.")
		end if
		
		set hechos to hechos + 1
		delay 1
	end repeat
	
	try
		my ponerTempo(bpmInicial)
	end try
	
	return my fin("Terminado: " & (hechos as text) & " ficheros generados.")
end renderLote


-- ---------- Ajustes de la cancion ----------
on ponerTempo(b)
	my clickMenu("Edit", "Tempo", "Set Tempo")
	my tecleaNumero(b)
end ponerTempo

on ponerCompases(n)
	my clickMenu("Edit", "Song Form", "Ends after")
	my tecleaNumero(n)
	delay 0.8
end ponerCompases

on tecleaNumero(v)
	delay 1.5
	tell application "System Events"
		keystroke "a" using command down
		delay 0.2
		repeat 6 times
			key code 51
		end repeat
		delay 0.2
		keystroke (v as text)
		delay 0.3
		key code 36
	end tell
	delay 1.2
end tecleaNumero


-- ---------- Lectura del titulo ----------
on tituloVentana()
	tell application "System Events"
		tell process appName
			repeat with w in windows
				try
					set nn to name of w as text
					if nn contains "Band-in-a-Box [" then
						return nn
					end if
				end try
			end repeat
			return "(no encontrada)"
		end tell
	end tell
end tituloVentana

on prefijoCancion()
	if prefijoManual is not "" then
		return prefijoManual
	end if
	set t to my tituloVentana()
	set tid to AppleScript's text item delimiters
	try
		set AppleScript's text item delimiters to ".SGU]"
		if (count of text items of t) is less than 2 then
			error "sin .SGU"
		end if
		set pre to text item 1 of t
		set AppleScript's text item delimiters to "["
		set nombre to item -1 of (text items of pre)
		set AppleScript's text item delimiters to "-"
		set res to item 1 of (text items of nombre)
		set AppleScript's text item delimiters to tid
		return res
	on error
		set AppleScript's text item delimiters to tid
		return ""
	end try
end prefijoCancion


-- ---------- Guardado ----------
on guardarAudio(nom)
	my clickMenu("File", "Save Special", "Save Song as AIFF Audio [Choose Name]")
	
	set ok to false
	repeat 20 times
		delay 0.5
		tell application "System Events"
			tell process appName
				repeat with w in windows
					try
						if (name of w as text) contains "name" then
							set ok to true
							exit repeat
						end if
					end try
				end repeat
			end tell
		end tell
		if ok then
			exit repeat
		end if
	end repeat
	if not ok then
		error "No aparecio el panel de guardado"
	end if
	delay 0.8
	
	tell application "System Events"
		keystroke "g" using {command down, shift down}
		delay 1
		keystroke carpetaSalida
		delay 0.5
		key code 36
	end tell
	delay 1.5
	
	tell application "System Events"
		keystroke "a" using command down
		delay 0.3
		keystroke nom
	end tell
	delay 0.8
	
	set v to my valorFoco()
	if v does not contain nom then
		tell application "System Events" to key code 53
		error "El campo contenia [" & v & "] en vez de [" & nom & "]"
	end if
	
	tell application "System Events" to key code 36
	delay 1
end guardarAudio

on valorFoco()
	tell application "System Events"
		tell process appName
			try
				return (value of (value of attribute "AXFocusedUIElement")) as text
			on error
				return ""
			end try
		end tell
	end tell
end valorFoco

on esperarRender(ruta)
	set q to quoted form of ruta
	set prev to -1
	set estable to 0
	set seg to 0
	repeat
		delay 3
		set seg to seg + 3
		set sz to -1
		try
			set sz to (do shell script "stat -f%z " & q) as integer
		end try
		if sz is greater than 0 and sz is equal to prev then
			set estable to estable + 1
			if estable is greater than or equal to 3 then
				return "OK - " & (sz as text) & " bytes en ~" & (seg as text) & "s"
			end if
		else
			set estable to 0
		end if
		set prev to sz
		if seg is greater than timeoutRender then
			return "TIMEOUT tras " & (seg as text) & "s (tamano=" & (sz as text) & ")"
		end if
	end repeat
end esperarRender


-- ---------- Menus ----------
on clickMenu(menuName, itemPat, subPat)
	tell application "System Events"
		tell process appName
			tell menu bar item menuName of menu bar 1
				click
				delay 0.4
				set found to missing value
				repeat with mi in menu items of menu 1
					try
						if (name of mi as text) contains itemPat then
							set found to mi
							exit repeat
						end if
					end try
				end repeat
				if found is missing value then
					error "No encuentro '" & itemPat & "' en " & menuName
				end if
				click found
				delay 0.5
				set sf to missing value
				repeat with si in menu items of menu 1 of found
					try
						if (name of si as text) contains subPat then
							set sf to si
							exit repeat
						end if
					end try
				end repeat
				if sf is missing value then
					error "No encuentro subitem '" & subPat & "'"
				end if
				click sf
			end tell
		end tell
	end tell
end clickMenu


-- ---------- Utilidades ----------
on fmt(b)
	if rellenarCeros and b is less than 100 then
		return "0" & (b as text)
	end if
	return b as text
end fmt


-- ---------- Log ----------
on anotar(s)
	set logTxt to logTxt & s & return
	try
		my writeText(logTxt, logPath)
	end try
end anotar

on fin(msg)
	my anotar("")
	my anotar(msg)
	if (count of cola) is 0 then
		display dialog msg & return & return & "Log: " & logPath buttons {"OK"} default button 1
	end if
	return msg
end fin

on writeText(t, posixPath)
	set f to open for access (POSIX file posixPath) with write permission
	set eof f to 0
	write t to f
	close access f
end writeText
