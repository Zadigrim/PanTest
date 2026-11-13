"""Stamp motifs, one per stop. Local box 320 x 220, ground line at y = 216. Solid ink with paper knockouts.

Berlin motifs only. The Munich and Stockholm motifs live in the project doc
claude/passport-pipeline.md and get added here when those passports get content files.
"""
import math
from kit import D

M = {}

def motif(fn):
    M[fn.__name__] = fn
    return fn

G = 216

# ======================= BERLIN =======================
@motif
def gate(d):
    d.rect(30, 92, 260, 22); d.rect(22, 114, 276, 10)
    d.columns(40, 124, 6, 22, 86, 26); d.ground(G, 8, 20, 300)
    d.rect(126, 62, 68, 30); d.rect(118, 56, 84, 8)
    # quadriga: four horse heads + chariot + figure
    for k in range(4):
        x = 128 + k * 16
        d.poly([(x, 56), (x + 4, 38), (x + 10, 34), (x + 14, 40), (x + 10, 56)])
    d.rect(190, 40, 10, 16); d.circ(195, 34, 5); d.line([(195, 30), (195, 12)], 3); d.line([(188, 16), (202, 16)], 3)

@motif
def dome(d):
    d.rect(40, 140, 240, 70); d.ground(G, 6)
    d.columns(118, 150, 6, 10, 56, 6, "k")
    d.pediment(108, 140, 104, 26)
    d.rect(44, 116, 30, 24); d.rect(246, 116, 30, 24)
    d.path("M110,116 A50,58 0 0 1 210,116 Z")
    for k in range(5):
        x = 122 + k * 19
        d.line([(x, 112), (160 + (x - 160) * 0.3, 66)], 3, "k")
    d.line([(116, 98), (204, 98)], 3, "k"); d.line([(128, 82), (192, 82)], 3, "k")

@motif
def stelae(d):
    for row in range(4):
        for col in range(5):
            x = 34 + col * 54 + row * 10
            h = 30 + ((row * 3 + col * 5) % 6) * 16
            y = 200 - row * 22
            d.rect(x, y - h, 34, h)
            d.rect(x + 34, y - h + 6, 6, h - 6, "k")
    d.ground(G, 6)

@motif
def column(d):
    d.rect(118, 190, 84, 20); d.rect(130, 168, 60, 22); d.ground(G, 6, 80, 240)
    d.rect(146, 78, 28, 90)
    for y in (100, 124, 148):
        d.rect(140, y, 40, 6)
    d.rect(140, 74, 40, 6)
    # gilded victory figure with wings
    d.rect(154, 44, 12, 30); d.circ(160, 38, 6)
    d.poly([(154, 50), (124, 30), (132, 58)]); d.poly([(166, 50), (196, 30), (188, 58)])
    d.line([(166, 46), (180, 22)], 3); d.line([(172, 24), (188, 24)], 3)

@motif
def cathedral(d):
    d.rect(60, 130, 200, 80); d.ground(G, 6)
    d.dome(160, 130, 58)
    d.rect(60, 96, 34, 34); d.dome(77, 96, 17, lantern=False)
    d.rect(226, 96, 34, 34); d.dome(243, 96, 17, lantern=False)
    d.windows(76, 150, 3, 1, 14, 30, 10, 0, arch=True); d.windows(200, 150, 3, 1, 14, 30, 10, 0, arch=True)
    d.arch_win(146, 156, 28, 54)
    d.rect(120, 118, 80, 8, "k")

@motif
def bust(d):
    d.rect(100, 190, 120, 20); d.ground(G, 6, 80, 240)
    # neck & shoulders
    d.path("M118,190 C122,160 140,150 150,140 L170,140 C180,150 198,160 202,190 Z")
    d.rect(148, 112, 24, 34)
    # face
    d.ell(158, 102, 20, 24)
    # tall flat-topped crown
    d.poly([(140, 92), (146, 30), (196, 26), (186, 90)])
    d.rect(140, 86, 48, 6, "k")
    d.ell(152, 98, 3, 2, "k")

@motif
def temple(d):
    d.rect(40, 168, 240, 42); d.ground(G, 6)
    d.rect(70, 100, 180, 68)
    d.columns(78, 106, 8, 12, 58, 9.4, "k")
    d.pediment(62, 100, 196, 40)
    for k in range(6):
        d.rect(120 + k * 14, 176 + k * 0, 80 - k * 0, 0)
    for k in range(5):
        d.rect(118, 172 + k * 7, 84, 3, "k")

@motif
def palace(d):
    d.rect(20, 110, 280, 100); d.ground(G, 6)
    d.windows(30, 124, 5, 3, 14, 18, 12, 10)
    d.windows(214, 124, 3, 3, 14, 18, 12, 10)
    d.rect(150, 70, 60, 140)
    d.arch_win(164, 160, 32, 50)
    d.columns(152, 76, 4, 6, 70, 12, "k")
    d.rect(20, 104, 280, 6); d.rect(146, 64, 68, 6)

@motif
def wallart(d):
    d.rect(10, 70, 300, 140); d.ground(G, 6)
    for k in range(1, 6):
        d.rect(10 + k * 50, 70, 3, 140, "k")
    d.rect(10, 62, 300, 12)
    # abstract mural shapes knocked out
    d.circ(60, 130, 26, "k"); d.circ(60, 130, 14)
    d.poly([(100, 190), (140, 96), (180, 190)], "k")
    d.path("M200,180 C210,110 260,110 270,180 Z", "k"); d.ell(235, 150, 10, 14)
    d.line([(20, 196), (300, 196)], 4, "k")

@motif
def watchtower(d):
    d.rect(10, 150, 120, 60); d.rect(10, 142, 120, 10)
    d.rect(170, 196, 140, 14)
    d.rect(212, 90, 30, 106)
    d.rect(196, 54, 62, 36); d.windows(202, 62, 3, 1, 14, 14, 5, 0)
    d.rect(192, 46, 70, 8)
    for x in range(150, 312, 18):
        d.rect(x, 168, 3, 28)
    d.ground(G, 6)

@motif
def booth(d):
    d.rect(100, 120, 120, 90); d.ground(G, 6)
    d.windows(112, 134, 3, 1, 26, 30, 10, 0)
    d.rect(92, 112, 136, 8); d.rect(120, 186, 80, 24, "k")
    # sandbags
    for k in range(6):
        d.ell(70 + k * 36, 200 if k % 2 else 204, 18, 10)
    # blank sign on pole
    d.rect(266, 70, 6, 140); d.rect(234, 50, 70, 46); d.rect(242, 58, 54, 30, "k")

@motif
def documents(d):
    d.rect(30, 168, 260, 42); d.ground(G, 6)
    d.rect(30, 160, 260, 8, "k")
    for k in range(4):
        x = 60 + k * 60
        d.poly([(x, 150), (x + 4, 70), (x + 44, 66), (x + 46, 150)])
        for j in range(4):
            d.rect(x + 10, 84 + j * 14, 26, 4, "k")
    d.line([(30, 160), (290, 160)], 4)

@motif
def twinchurch(d):
    for cx in (70, 250):
        d.rect(cx - 36, 110, 72, 100); d.dome(cx, 110, 32); d.columns(cx - 30, 150, 4, 8, 50, 9, "k")
        d.pediment(cx - 38, 150, 76, 18)
    d.rect(118, 128, 84, 82); d.pediment(112, 128, 96, 26); d.columns(124, 146, 6, 8, 54, 6, "k")
    d.ground(G, 6)

@motif
def bookshelf(d):
    d.rect(40, 60, 240, 150)
    d.rect(52, 72, 216, 126, "k")
    for k in range(1, 5):
        d.rect(52, 72 + k * 25, 216, 4)
    for k in range(1, 4):
        d.rect(52 + k * 54, 72, 4, 126)
    d.ground(G, 6)

@motif
def tvtower(d):
    d.poly([(150, 210), (154, 106), (166, 106), (170, 210)])
    d.circ(160, 88, 28)
    d.rect(132, 84, 56, 6, "k"); d.windows(140, 94, 5, 1, 6, 6, 4, 0, "k")
    d.rect(155, 32, 10, 30); d.rect(158, 6, 4, 28)
    d.rect(120, 196, 80, 14)
    d.rect(40, 176, 60, 34); d.rect(220, 170, 70, 40)
    d.ground(G, 6)

@motif
def courtyard(d):
    d.rect(20, 50, 280, 160); d.ground(G, 6)
    d.arch_win(110, 120, 100, 90)
    d.windows(36, 70, 3, 3, 16, 22, 10, 14, "k")
    d.windows(232, 70, 3, 3, 16, 22, 10, 14, "k")
    for k in range(9):
        d.circ(122 + k * 9.5, 62, 3, "k")
    for k in range(5):
        d.rect(130 + k * 14, 86, 6, 6, "k")

@motif
def ruintower(d):
    d.rect(40, 120, 80, 90); d.windows(56, 136, 2, 2, 18, 22, 12, 14, "k", arch=True)
    d.path("M140,210 L140,60 L156,38 L168,54 L180,30 L192,52 L200,44 L200,210 Z")
    d.arch_win(152, 90, 36, 60, "k"); d.circ(170, 70, 8, "k")
    d.poly([(232, 210), (236, 104), (268, 92), (296, 104), (300, 210)])
    d.windows(244, 112, 3, 5, 10, 12, 8, 6, "k")
    d.ground(G, 6)

@motif
def store(d):
    d.rect(20, 70, 280, 140); d.ground(G, 6)
    d.rect(20, 62, 280, 8)
    d.windows(34, 82, 9, 3, 18, 20, 12, 10, "k")
    d.rect(20, 160, 280, 4, "k")
    d.windows(30, 172, 5, 1, 40, 38, 14, 0, "k")
    d.rect(130, 40, 60, 22); d.rect(146, 30, 28, 10)

@motif
def palacedome(d):
    d.rect(10, 130, 300, 80); d.ground(G, 6)
    d.windows(18, 146, 8, 2, 10, 18, 7.5, 12, "k"); d.windows(214, 146, 6, 2, 10, 18, 4, 12, "k")
    d.rect(126, 96, 68, 114); d.arch_win(146, 166, 28, 44, "k")
    d.dome(160, 96, 26)
    d.rect(148, 46, 24, 12); d.circ(160, 40, 6)

@motif
def elephants(d):
    d.rect(60, 60, 200, 16)
    d.poly([(40, 60), (160, 24), (280, 60)]); d.poly([(70, 30), (160, 6), (250, 30)])
    for cx in (92, 228):
        d.rect(cx - 16, 76, 32, 44)
        d.ell(cx, 146, 34, 26)
        d.rect(cx - 30, 160, 12, 50); d.rect(cx + 18, 160, 12, 50)
        d.path(f"M{cx-4},{150} C{cx-6},{180} {cx+4},{196} {cx+14},{198} L{cx+14},{190} C{cx+8},{188} {cx+6},{176} {cx+8},{150} Z")
    d.ground(G, 6)

@motif
def terraces(d):
    for k in range(5):
        y = 196 - k * 22
        d.rect(30 + k * 16, y, 260 - k * 32, 14)
        d.windows(40 + k * 16, y + 3, int((240 - k * 32) / 16), 1, 8, 8, 8, 0, "k", arch=True)
    d.rect(100, 62, 120, 26); d.dome(160, 62, 18, lantern=False)
    d.ground(G, 6)
    d.rect(150, 96, 20, 110, "k")

@motif
def tudorhouse(d):
    d.rect(30, 110, 260, 100); d.ground(G, 6)
    d.poly([(30, 110), (90, 60), (150, 110)]); d.poly([(170, 110), (230, 60), (290, 110)])
    for x in (44, 70, 96, 122, 184, 210, 236, 262):
        d.rect(x, 116, 4, 90, "k")
    d.rect(30, 150, 260, 4, "k")
    d.rect(150, 40, 20, 70); d.rect(146, 34, 28, 8)
    d.rect(140, 170, 40, 40, "k")

@motif
def steelbridge(d):
    d.rect(0, 160, 320, 14)
    d.path("M30,160 Q160,40 290,160 L276,160 Q160,62 44,160 Z")
    for k in range(1, 12):
        x = 30 + k * 21.6
        yy = 160 - (1 - ((x - 160) / 130) ** 2) * 106
        d.rect(x - 1.5, yy, 3, 160 - yy)
    d.rect(18, 130, 16, 80); d.rect(286, 130, 16, 80)
    d.waves(192, 0, 320, 4, 24, 4, "i", 2, 12)

@motif
def gables(d):
    for k, x in enumerate((20, 120, 220)):
        d.rect(x, 110, 84, 100)
        d.path(f"M{x},{110} L{x},{90} Q{x+14},{86} {x+18},{70} L{x+30},{70} Q{x+36},{44} {x+42},{40} Q{x+48},{44} {x+54},{70} L{x+66},{70} Q{x+70},{86} {x+84},{90} L{x+84},{110} Z")
        d.windows(x + 12, 124, 3, 2, 14, 18, 7, 16, "k")
        d.rect(x + 32, 176, 20, 34, "k")
        d.circ(x + 42, 82, 6, "k")
    d.ground(G, 6)

@motif
def currywurst(d):
    # paper tray of sliced sausage under sauce, with a little wooden fork
    d.path("M40,140 L280,140 L256,206 L64,206 Z")
    d.rect(36, 132, 248, 10)
    for k in range(6):
        cx = 72 + k * 36
        d.ell(cx, 118, 17, 13)
        d.ell(cx, 116, 9, 6, "k")
    d.path("M52,128 C80,108 120,132 150,112 C180,96 220,130 270,110 L272,132 L50,132 Z")
    d.rect(60, 160, 200, 4, "k")
    d.rect(226, 30, 8, 80); d.rect(220, 22, 4, 16); d.rect(228, 18, 4, 16); d.rect(236, 22, 4, 16)
    d.ground(G, 6, 40, 280)

@motif
def kebab(d):
    # pita pocket seen from the side, stuffed with meat and vegetables
    d.path("M70,206 L250,206 L276,150 C220,170 100,170 44,150 Z")
    d.path("M60,152 C110,166 210,166 260,152 L262,146 C210,160 110,160 58,146 Z", "k")
    for k in range(7):
        d.circ(76 + k * 28, 132 + (k % 2) * 8, 16)
    for k in range(6):
        d.ell(92 + k * 28, 112 + (k % 3) * 4, 12, 8)
    d.poly([(100, 100), (120, 74), (128, 104)]); d.poly([(196, 100), (214, 70), (226, 102)])
    d.rect(152, 40, 6, 70); d.poly([(148, 40), (155, 26), (162, 40)])
    d.ground(G, 6, 40, 280)

@motif
def tracks(d):
    d.rect(0, 50, 320, 18); d.rect(0, 68, 320, 6, "k"); d.rect(0, 74, 320, 8)
    for x in (30, 150, 270):
        d.rect(x, 82, 20, 128)
        d.path(f"M{x-24},{82} Q{x+10},{120} {x+44},{82} Z")
    d.rect(80, 140, 80, 70); d.rect(74, 132, 92, 8); d.rect(90, 152, 60, 26, "k")
    d.rect(196, 170, 40, 6); d.rect(212, 176, 8, 34)
    d.ground(G, 6)

@motif
def markethall(d):
    d.rect(20, 100, 280, 110); d.ground(G, 6)
    d.path("M20,100 L20,80 Q160,20 300,80 L300,100 Z")
    d.arch_win(120, 120, 80, 90, "k")
    d.windows(36, 124, 3, 2, 16, 24, 10, 14, "k", arch=True)
    d.windows(224, 124, 3, 2, 16, 24, 10, 14, "k", arch=True)
    d.circ(160, 74, 12, "k")
