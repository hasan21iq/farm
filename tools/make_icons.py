# يولّد أيقونات PNG للعبة بدون مكتبات خارجية
import zlib, struct, os

def png(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

def inside(poly, x, y):
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c

def render(n, maskable):
    px = bytearray(n * n * 4)
    s = n / 100
    pad = 0 if maskable else 6
    roof = [(22, 48), (32, 34), (50, 26), (68, 34), (78, 48)]
    for y in range(n):
        for x in range(n):
            u, v = x / s, y / s
            if not maskable:
                r = 18
                cx = min(max(u, pad + r), 100 - pad - r); cy = min(max(v, pad + r), 100 - pad - r)
                if (u - cx) ** 2 + (v - cy) ** 2 > r * r: continue
            col = (111, 190, 234) if v < 58 else (126, 196, 84)
            if (u - 78) ** 2 + (v - 20) ** 2 < 49: col = (255, 214, 74)
            if 26 <= u <= 74 and 46 <= v <= 78: col = (200, 69, 59)
            if inside(roof, u, v): col = (142, 43, 37)
            if 41 <= u <= 59 and 58 <= v <= 78:
                col = (122, 38, 32)
                if abs((u - 41) - (v - 58)) < 1.6 or abs((59 - u) - (v - 58)) < 1.6 or u < 42.5 or u > 57.5 or v < 59.5: col = (255, 244, 230)
            if 45 <= u <= 55 and 36 <= v <= 44: col = (255, 244, 230) if (u < 46 or u > 54 or v < 37 or v > 43) else (59, 42, 34)
            i = (y * n + x) * 4
            px[i:i + 4] = bytes((*col, 255))
    return px

out = os.path.join(os.path.dirname(__file__), '..', 'icons')
for n in (192, 512):
    png(os.path.join(out, f'icon-{n}.png'), n, n, render(n, False))
png(os.path.join(out, 'icon-maskable-512.png'), 512, 512, render(512, True))
print('ok')
