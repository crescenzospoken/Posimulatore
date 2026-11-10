"""Tempi di percorrenza a piedi a Positano: rete OpenStreetMap + quote (LiDAR 2 m dove c'è, altrimenti TINITALY 10 m).
Regola DIN 33466: 4 km/h in piano, 300 m/h di dislivello in salita, 500 in discesa; il tempo è il maggiore
fra orizzontale e verticale più metà del minore. Sulle scale: 0,85 m/s in piano, 360 m/h su, 600 giù (da tarare).
Uso: python3 -I scripts/tempi.py public/data [lidar|tin]
"""
import sys, json, math, heapq
import numpy as np
DATA = sys.argv[1]; FONTE = sys.argv[2] if len(sys.argv) > 2 else 'lidar'
m = json.load(open(f'{DATA}/terreno.json'))['dettaglio']
A = np.fromfile(f'{DATA}/terreno-dettaglio.bin', '<u2').reshape(m['ny'], m['nx']) / 10
def tin(lon, lat):
    fx = (lon - m['w']) / m['step']; fy = (m['n'] - lat) / m['step']
    if not (0 <= fx < m['nx'] - 1 and 0 <= fy < m['ny'] - 1): return None
    x0 = int(fx); y0 = int(fy); dx = fx - x0; dy = fy - y0
    return A[y0, x0] * (1 - dx) * (1 - dy) + A[y0, x0 + 1] * dx * (1 - dy) + A[y0 + 1, x0] * (1 - dx) * dy + A[y0 + 1, x0 + 1] * dx * dy
Q = {}
if FONTE == 'lidar':
    q = json.load(open(f'{DATA}/quote-vie.json'))
    Q = {(p[0], p[1]): p[2] for p in q['punti']}
R = json.load(open(f'{DATA}/strade.json'))
kx = 111320 * math.cos(math.radians(40.63)); ky = 110950
G = {}; VP = 1.11
for r in R:
    c = r['c']; scale = r['k'] == 'steps'
    zs = [Q.get((x, y)) if Q.get((x, y)) is not None else tin(x, y) for x, y in c]
    if any(z is None for z in zs): continue
    z = np.array(zs, dtype=float)
    # lisciatura leggera lungo la via: toglie i gradini del modello, non le salite vere
    n = 3 if FONTE == 'lidar' else 5
    if len(z) > n: z = np.convolve(np.pad(z, n // 2, mode='edge'), np.ones(n) / n, mode='valid')
    for i in range(len(c) - 1):
        d = math.hypot((c[i + 1][0] - c[i][0]) * kx, (c[i + 1][1] - c[i][1]) * ky); dz = float(z[i + 1] - z[i])
        if d < 0.01: continue
        for a, b, dzz in ((i, i + 1, dz), (i + 1, i, -dz)):
            up = max(dzz, 0); dn = max(-dzz, 0)
            th = d / (0.85 if scale else VP)
            tv = up * 3600 / (360 if scale else 300) + dn * 3600 / (600 if scale else 500)
            t = max(th, tv) + 0.5 * min(th, tv)
            G.setdefault(tuple(c[a]), []).append((tuple(c[b]), t, d, up, dn, d if scale else 0))
nodi = list(G)
def vicino(lon, lat): return min(nodi, key=lambda n: ((n[0] - lon) * kx) ** 2 + ((n[1] - lat) * ky) ** 2)
def cammino(a, b):
    D = {a: 0}; P = {}; pq = [(0, a)]
    while pq:
        t, u = heapq.heappop(pq)
        if u == b: break
        if t > D[u]: continue
        for v, w, *r in G[u]:
            if t + w < D.get(v, 1e18): D[v] = t + w; P[v] = (u, r); heapq.heappush(pq, (t + w, v))
    if b not in D: return None
    d = up = dn = st = 0; u = b
    while u != a: pu, r = P[u]; d += r[0]; up += r[1]; dn += r[2]; st += r[3]; u = pu
    return D[b] / 60, d, up, dn, st
L = {'Chiesa Nuova': (14.4823335, 40.6294794), 'Spiaggia Grande': (14.4862, 40.6279), 'Collegiata': (14.487054, 40.628339),
     'Fornillo': (14.480394, 40.625905), 'Montepertuso': (14.493447, 40.631504), 'Nocelle': (14.503698, 40.628702), 'Sponda': (14.49119, 40.627315)}
N = {k: vicino(*v) for k, v in L.items()}
out = {}
for a, b in [('Chiesa Nuova', 'Spiaggia Grande'), ('Sponda', 'Spiaggia Grande'), ('Spiaggia Grande', 'Fornillo'), ('Montepertuso', 'Collegiata'), ('Nocelle', 'Montepertuso'), ('Collegiata', 'Nocelle'), ('Chiesa Nuova', 'Collegiata'), ('Sponda', 'Chiesa Nuova')]:
    x = cammino(N[a], N[b]); y = cammino(N[b], N[a])
    out[f'{a} -> {b}'] = None if not x else [round(x[0]), round(y[0]), round(x[1]), round(x[2]), round(x[3]), round(100 * x[4] / x[1])]
print(json.dumps(out, ensure_ascii=False))
