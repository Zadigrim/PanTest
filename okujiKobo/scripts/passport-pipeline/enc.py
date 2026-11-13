"""Compact contour encoding. '>' + 4 chars = moveto (x,y each 2 chars, 0..4095);
pair of chars = relative step (dx+32, dy+32); '*' + 4 chars = long step (dx+2048, dy+2048); '.' = close."""
A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
def n2(v): return A[v >> 6] + A[v & 63]

def encode(contours):
    out = []
    for pts in contours:
        x0, y0 = pts[0]
        out.append(">" + n2(x0) + n2(y0))
        px, py = x0, y0
        for x, y in pts[1:]:
            dx, dy = x - px, y - py
            if dx == 0 and dy == 0: continue
            if -32 <= dx <= 31 and -32 <= dy <= 31:
                out.append(A[dx + 32] + A[dy + 32])
            else:
                out.append("*" + n2(dx + 2048) + n2(dy + 2048))
            px, py = x, y
        out.append(".")
    return "".join(out)

def decode(s):
    o = []; i = 0
    while i < len(s):
        c = s[i]
        if c == ">":
            x = A.index(s[i+1]) * 64 + A.index(s[i+2]); y = A.index(s[i+3]) * 64 + A.index(s[i+4])
            o.append(f"M{x} {y}"); i += 5
        elif c == ".":
            o.append("z"); i += 1
        elif c == "*":
            dx = A.index(s[i+1]) * 64 + A.index(s[i+2]) - 2048; dy = A.index(s[i+3]) * 64 + A.index(s[i+4]) - 2048
            o.append(f"l{dx} {dy}"); i += 5
        else:
            o.append(f"l{A.index(c)-32} {A.index(s[i+1])-32}"); i += 2
    return "".join(o)

def contours_from_mask(mask, scale, eps, min_area=6):
    import cv2
    cs, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    res = []
    for c in cs:
        if cv2.contourArea(c) < min_area: continue
        a = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
        if len(a) < 3: continue
        pts = []
        for x, y in a:
            p = (int(round(x * scale)), int(round(y * scale)))
            if not pts or p != pts[-1]: pts.append(p)
        if len(pts) >= 3: res.append(pts)
    return res
