#!/usr/bin/env python3
"""PDF del "Spider — reto anual de calentamiento" (BanetMasa): dos caras A4, enero-junio y julio-diciembre.

El diseño (cabecera, tarjetas de los meses, bloque de progreso) son dos plantillas hechas con ChatGPT con el
interior de las tarjetas EN BLANCO (chat "Ejercicio de guitarra araña", 2026-10-25): cuando ChatGPT dibujaba
también las tablas salían combinaciones imposibles (4-4-1-2, 3-3-3-0), días repetidos o saltados y QR de adorno,
y no clavaba el número de filas (12 en vez de las 16 que pide un mes de 31 días). Así que aquí solo se pone la
plantilla de fondo y TODO lo que es dato va en vectorial encima: la secuencia del mes, la tabla día/combinación/BPM
con los días reales del año (febrero 28 o 29), el año y un QR de verdad al canal.

Orden de las 24 combinaciones (decisión 2026-10-25, revisada con ChatGPT): de menos a más salto entre dedos
y con la pareja anular-meñique al final de cada grupo; el día N del mes es la combinación N y del 25 al final
del mes se repasa la que cada uno lleve peor. Cada mes cambia la forma de tocarlas (la "secuencia").

Requiere: pip3 install --user reportlab pillow
Dos QR (decisión de Alberto 2026-10-25): la cara 1 lleva a BanetMasa (dónde se explica cada secuencia) y la
cara 2 a TodoRitmos (las pistas de tempo fijo y progresivo con las que se practica el reto), cada uno con su rótulo.

Uso:
  python3 scripts/generate-spider-pdf.py --year 2026 [--out <pdf>] [--url-banetmasa …] [--url-todoritmos …]
"""
import argparse
import calendar
from pathlib import Path

from PIL import Image
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ASSETS = Path('~/guitar-visualizer-assets/spider').expanduser()

COMBINACIONES = ['1-2-3-4', '4-3-2-1', '1-2-4-3', '2-1-3-4', '3-4-2-1', '4-3-1-2', '1-3-4-2', '1-4-3-2',
                 '2-1-4-3', '2-3-4-1', '2-4-3-1', '3-4-1-2', '1-3-2-4', '3-1-2-4', '3-2-1-4', '4-1-2-3',
                 '4-2-1-3', '4-2-3-1', '1-4-2-3', '2-3-1-4', '3-2-4-1', '4-1-3-2', '2-4-1-3', '3-1-4-2']

# (nombre, instrucción) de cada mes; textos de la revisión con ChatGPT del 2026-10-25.
SECUENCIAS = [
    ('Cuerda a cuerda', 'Recorre las seis cuerdas y vuelve.'),
    ('Diagonal ascendente', 'Sube un traste en cada cuerda.'),
    ('Salto de una cuerda', 'Alterna cuerdas dejando una intermedia.'),
    ('Araña en dos cuerdas', 'Alterna dedos entre cuerdas vecinas.'),
    ('Ligados ascendentes', 'Pulsa la primera nota y liga las demás.'),
    ('Ligados descendentes', 'Tira suavemente de cada dedo al bajar.'),
    ('Desplazamiento por el mástil', 'Sube una posición en cada pasada.'),
    ('Tresillos', 'Tres notas por pulso, con metrónomo.'),
    ('Semicorcheas acentuadas', 'Acentúa la primera nota de cada grupo.'),
    ('Salto de dos cuerdas', 'Salta dos cuerdas sin perder precisión.'),
    ('Púa alterna y apagado', 'Primero púa alterna; luego añade palm mute.'),
    ('Repaso combinado', 'Combina técnicas sin perder limpieza.'),
]

# Geometría medida sobre las plantillas (1054x1492 px; ver el comentario de la cabecera). Por tarjeta:
# x de la columna (izq/der), y de la franja de la secuencia (arriba, abajo) y y del borde inferior.
COLS = [(28, 512), (542, 1026)]
FILAS = {
    1: [(257, 289, 613), (672, 703, 1029), (1087, 1118, 1415)],
    2: [(126, 157, 476), (530, 561, 869), (925, 956, 1242)],
}
QR_BOX = {1: (866, 16, 1028, 177), 2: (875, 1259, 1028, 1419)}
YEAR_BOX = (683, 76, 826, 141)
# La plantilla trae un segundo recuadro rojo alrededor del año, dentro del que ya enmarca "AÑO" y el número;
# Alberto 2026-10-25: sobra. Se tapa con blanco (el fondo ahí es blanco liso) un poco más grande que YEAR_BOX.
YEAR_TAPA = (678, 71, 831, 146)

ROJO = HexColor('#e1251b')
NEGRO = HexColor('#111111')
GRIS = HexColor('#9aa0a6')
GRIS_CLARO = Color(0.84, 0.85, 0.87)
FONDO_CAB = HexColor('#f1f2f4')


def main():
    p = argparse.ArgumentParser(description='PDF del reto Spider (dos caras A4).')
    p.add_argument('--year', type=int, required=True)
    p.add_argument('--url-banetmasa', default='https://www.youtube.com/@banetmasa')
    # Por id de canal: no depende de que TodoRitmos tenga o cambie su @handle.
    p.add_argument('--url-todoritmos', default='https://www.youtube.com/channel/UCX1bQckQd4PHm59dHg9zSKw')
    p.add_argument('--font', default='~/Library/Fonts/Anton-Regular.ttf')
    p.add_argument('--out')
    args = p.parse_args()
    out = Path(args.out).expanduser() if args.out else ASSETS / f'BANETMASA_Spider_{args.year}.pdf'
    pdfmetrics.registerFont(TTFont('Anton', str(Path(args.font).expanduser())))

    W, H = A4
    c = canvas.Canvas(str(out), pagesize=A4)
    c.setTitle(f'BanetMasa Spider — Reto anual de calentamiento {args.year}')
    c.setAuthor('BanetMasa')
    for cara in (1, 2):
        plantilla = Image.open(ASSETS / f'plantilla_cara{cara}.png').convert('RGB')
        pw, ph = plantilla.size
        k = W / pw  # puntos por píxel de plantilla
        # La plantilla es casi exactamente A4 (1054x1492): se escala al ancho y se centra en alto.
        dy = (H - ph * k) / 2
        px = lambda x: x * k
        py = lambda y: H - dy - y * k
        # Remuestreo a 2x para que los bordes del dibujo no se vean pixelados al imprimir.
        c.drawImage(ImageReader(plantilla.resize((pw * 2, ph * 2), Image.LANCZOS)), 0, dy, W, ph * k)

        for fila, (s_top, s_bot, card_bot) in enumerate(FILAS[cara]):
            for col, (x0, x1) in enumerate(COLS):
                mes = (cara - 1) * 6 + fila * 2 + col + 1
                nombre, instruccion = SECUENCIAS[mes - 1]
                # Franja de la secuencia: número en rojo + nombre en negrita + instrucción, en una sola línea;
                # el cuerpo de letra baja lo justo para que quepa la más larga ("Desplazamiento por el mástil").
                t, n, ins = f'SECUENCIA {mes}', nombre.upper(), '· ' + instruccion
                total = lambda s: (pdfmetrics.stringWidth(t, 'Helvetica-Bold', s) + pdfmetrics.stringWidth(n, 'Helvetica-Bold', s)
                                   + pdfmetrics.stringWidth(ins, 'Helvetica', s * 0.95) + 11)
                fs = min(8.6, 8.6 * (px(x1) - px(x0) - 14) / total(8.6))
                yb = py((s_top + s_bot) / 2) - fs * 0.36
                c.setFillColor(ROJO); c.setFont('Helvetica-Bold', fs)
                c.drawString(px(x0) + 7, yb, t)
                xt = px(x0) + 7 + c.stringWidth(t, 'Helvetica-Bold', fs) + 6
                c.setFillColor(NEGRO); c.drawString(xt, yb, n)
                xt += c.stringWidth(n, 'Helvetica-Bold', fs) + 5
                c.setFont('Helvetica', fs * 0.95); c.setFillColor(HexColor('#444444'))
                c.drawString(xt, yb, ins)
                tabla(c, px(x0), py(s_bot) - 4, px(x1), py(card_bot) + 5, args.year, mes)

        qx0, qy0, qx1, qy1 = QR_BOX[cara]
        url, rotulo = ((args.url_banetmasa, 'VÍDEOS · BANETMASA') if cara == 1
                       else (args.url_todoritmos, 'RITMOS · TODORITMOS'))
        qr(c, url, rotulo, px(qx0), py(qy1), px(qx1) - px(qx0), py(qy0) - py(qy1))
        if cara == 1:
            tx0, ty0, tx1, ty1 = YEAR_TAPA
            c.setFillColor(white); c.rect(px(tx0), py(ty1), px(tx1) - px(tx0), py(ty0) - py(ty1), stroke=0, fill=1)
            x0, y0, x1, y1 = YEAR_BOX
            c.setFillColor(NEGRO); c.setFont('Anton', 30)
            c.drawCentredString((px(x0) + px(x1)) / 2, (py(y0) + py(y1)) / 2 - 10.5, str(args.year))
        c.showPage()
    c.save()
    print(f'Listo: {out}')


def tabla(c, x0, ytop, x1, ybot, year, mes):
    """Dos columnas de 16 filas (días 1-16 y 17-fin) con cabecera DÍA · COMBINACIÓN · BPM MÁX."""
    dias = calendar.monthrange(year, mes)[1]
    gap = 10
    wcol = (x1 - x0 - gap) / 2
    filas = 16
    hcab = 11
    h = (ytop - ybot - hcab) / filas
    for j in range(2):
        cx = x0 + j * (wcol + gap)
        w_dia, w_bpm = wcol * 0.17, wcol * 0.36
        w_comb = wcol - w_dia - w_bpm
        # Cabecera.
        c.setFillColor(FONDO_CAB); c.rect(cx, ytop - hcab, wcol, hcab, stroke=0, fill=1)
        c.setFillColor(HexColor('#333333')); c.setFont('Helvetica-Bold', 6.3)
        c.drawCentredString(cx + w_dia / 2, ytop - hcab + 3.4, 'DÍA')
        c.drawCentredString(cx + w_dia + w_comb / 2, ytop - hcab + 3.4, 'COMBINACIÓN')
        c.drawCentredString(cx + w_dia + w_comb + w_bpm / 2, ytop - hcab + 3.4, 'BPM MÁX.')
        y = ytop - hcab
        for i in range(filas):
            d = j * 16 + i + 1
            yr = y - (i + 1) * h
            if i % 2 == 1:
                c.setFillColor(HexColor('#f7f7f8')); c.rect(cx, yr, wcol, h, stroke=0, fill=1)
            c.setStrokeColor(GRIS_CLARO); c.setLineWidth(0.4)
            c.line(cx, yr, cx + wcol, yr)
            if d > dias:
                continue
            ym = yr + h / 2 - 2.9
            c.setFillColor(NEGRO); c.setFont('Helvetica-Bold', 8.2)
            c.drawCentredString(cx + w_dia / 2, ym, str(d))
            if d <= 24:
                c.setFont('Helvetica-Bold', 8.6)
                c.drawCentredString(cx + w_dia + w_comb / 2, ym, COMBINACIONES[d - 1])
            else:
                # Solo "R" (Alberto 2026-10-25): así queda casi toda la celda para escribir qué combinación se repasa.
                c.setFillColor(ROJO); c.setFont('Helvetica-Bold', 7.5)
                c.drawString(cx + w_dia + 4, ym + 0.2, 'R')
                c.setStrokeColor(GRIS); c.setLineWidth(0.5)
                c.line(cx + w_dia + 4 + c.stringWidth('R', 'Helvetica-Bold', 7.5) + 3, ym - 1,
                       cx + w_dia + w_comb - 4, ym - 1)
            # Hueco para escribir el BPM.
            c.setStrokeColor(GRIS); c.setLineWidth(0.5)
            c.line(cx + w_dia + w_comb + 6, ym - 1, cx + wcol - 6, ym - 1)
        # Separadores verticales de las columnas.
        c.setStrokeColor(GRIS_CLARO); c.setLineWidth(0.4)
        for xv in (cx + w_dia, cx + w_dia + w_comb):
            c.line(xv, ybot, xv, ytop)
        c.rect(cx, ybot, wcol, ytop - ybot, stroke=1, fill=0)
    # Línea roja punteada entre las dos mitades, como en el diseño original.
    c.setStrokeColor(ROJO); c.setLineWidth(0.8); c.setDash(1.5, 2)
    xm = x0 + wcol + gap / 2
    c.line(xm, ybot, xm, ytop)
    c.setDash()


def qr(c, url, rotulo, x, y, w, h):
    """QR vectorial de verdad (reportlab) en el recuadro blanco de la plantilla, con su rótulo debajo."""
    c.setFillColor(NEGRO); c.setFont('Helvetica-Bold', 6)
    c.drawCentredString(x + w / 2, y + 6, rotulo)
    lado = min(w, h) - 24
    y += 6
    widget = QrCodeWidget(url, barLevel='M')
    bx0, by0, bx1, by1 = widget.getBounds()
    d = Drawing(lado, lado, transform=[lado / (bx1 - bx0), 0, 0, lado / (by1 - by0), 0, 0])
    d.add(widget)
    renderPDF.draw(d, c, x + (w - lado) / 2, y + (h - 6 - lado) / 2 + 2)


if __name__ == '__main__':
    main()
