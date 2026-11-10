"""Quote LiDAR (DTM 2 m, PST-A, Ministero dell'Ambiente, Geoportale Nazionale) lungo le vie di Positano.
Il servizio WMS non offre il download: si interroga un punto alla volta con GetFeatureInfo.
Chiede solo i punti delle vie dentro il comune, pochi alla volta, e tiene una cache su file.
Uso: python3 -I scripts/quote-lidar.py public/data CACHE.json [max]
"""
import sys, json, math, re, time, os, urllib.request
from concurrent.futures import ThreadPoolExecutor
DATA, CACHE = sys.argv[1], sys.argv[2]
MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9
B = "http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/servizi-LiDAR/LIDAR_CAMPANIA.map"
L = "EL.LIDAR.CAMPANIA.2x2.DTM"
strade = json.load(open(f'{DATA}/strade.json'))
confine = max(json.load(open(f'{DATA}/confine.json')), key=len)
def dentro(p, poly):
    c = False; j = len(poly) - 1
    for i in range(len(poly)):
        a, b = poly[i], poly[j]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]: c = not c
        j = i
    return c
punti = []
visti = set()
for r in strade:
    for p in r['c']:
        k = (p[0], p[1])
        if k in visti: continue
        visti.add(k)
        if dentro(p, confine): punti.append(k)
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
da_fare = [p for p in punti if f'{p[0]},{p[1]}' not in cache][:MAX]
print('punti nel comune', len(punti), 'da chiedere', len(da_fare), flush=True)
def chiedi(p):
    lon, lat = p; d = 0.00002
    u = (f"{B}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS={L}&QUERY_LAYERS={L}&STYLES=&CRS=EPSG:4326"
         f"&BBOX={lat-d},{lon-d},{lat+d},{lon+d}&WIDTH=3&HEIGHT=3&I=1&J=1&INFO_FORMAT=text/plain")
    for k in range(3):
        try:
            t = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Posimulatore/0.1 (studio viabilita Positano)'}), timeout=40).read().decode('latin1')
            m = re.findall(r'Pixel Value;[^@]*?;\s*([-\d.]+);\s*$', t.strip().split('@')[-1])
            v = float(m[-1]) if m else None
            return p, (v if v is not None and -5 < v < 2000 else None)
        except Exception:
            time.sleep(2 * (k + 1))
    return p, 'err'
t0 = time.time(); n = 0
with ThreadPoolExecutor(3) as ex:
    for p, v in ex.map(chiedi, da_fare):
        if v != 'err': cache[f'{p[0]},{p[1]}'] = v
        n += 1
        if n % 500 == 0:
            json.dump(cache, open(CACHE, 'w')); print(n, round(time.time() - t0), 's', flush=True)
json.dump(cache, open(CACHE, 'w'))
ok = sum(1 for v in cache.values() if v is not None)
print('fatto', len(cache), 'con quota', ok, 'tempo', round(time.time() - t0), flush=True)
