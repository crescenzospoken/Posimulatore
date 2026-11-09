"""Prepara i dati di Posimulatore da fonti aperte.
Ingressi (cartella SRC, scaricati da scripts/fetch-data.sh):
  tin/w45095_s10/w45095_s10.tif  TINITALY 1.1 (INGV, CC BY 4.0), 10 m, EPSG:32632
  cop.tif                        Copernicus DEM GLO-30 N40E014 (ESA, licenza Copernicus)
  osm/*.osm, osm/rel.osm         OpenStreetMap (ODbL), API 0.6
Uscite in public/data: terreno-dettaglio.bin, terreno-contesto.bin (Uint16 LE, decimetri),
  terreno.json, edifici.json, strade.json, luoghi.json, confine.json, suolo.json
Uso: python3 -I scripts/build-data.py SRC public/data
"""
import sys, json, math, glob, os
import numpy as np, rasterio
from pyproj import Transformer
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# Griglie geografiche (gradi). Righe da nord a sud.
DET = dict(w=14.415, e=14.535, s=40.570, n=40.665, step=0.0001)
CTX = dict(w=14.20, e=14.80, s=40.45, n=40.80, step=0.0005)

def bilinear(arr, fx, fy):
    h, w = arr.shape
    fx = np.clip(fx, 0, w - 1.001); fy = np.clip(fy, 0, h - 1.001)
    x0 = np.floor(fx).astype(int); y0 = np.floor(fy).astype(int)
    dx = fx - x0; dy = fy - y0
    a = arr[y0, x0]; b = arr[y0, x0 + 1]; c = arr[y0 + 1, x0]; d = arr[y0 + 1, x0 + 1]
    return a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy

def grid(g):
    nx = round((g['e'] - g['w']) / g['step']) + 1
    ny = round((g['n'] - g['s']) / g['step']) + 1
    lon = g['w'] + np.arange(nx) * g['step']
    lat = g['n'] - np.arange(ny) * g['step']
    return np.meshgrid(lon, lat)

def sample(path, LON, LAT):
    r = rasterio.open(path)
    a = r.read(1).astype(np.float64)
    nod = r.nodata
    if nod is not None: a[a == nod] = 0
    a[a < -50] = 0
    if r.crs.to_epsg() != 4326:
        t = Transformer.from_crs(4326, r.crs.to_epsg(), always_xy=True)
        X, Y = t.transform(LON, LAT)
    else:
        X, Y = LON, LAT
    inv = ~r.transform
    fx, fy = inv * (X, Y)
    return bilinear(a, fx - 0.5, fy - 0.5)

LON, LAT = grid(DET)
det = sample(f'{SRC}/tin/w45095_s10/w45095_s10.tif', LON, LAT)
det = np.clip(det, 0, 6500)
LONc, LATc = grid(CTX)
ctx = sample(f'{SRC}/cop.tif', LONc, LATc)
# dentro l'area di dettaglio il contesto usa TINITALY, così i bordi combaciano
ctx_t = sample(f'{SRC}/tin/w45095_s10/w45095_s10.tif', LONc, LATc)
inside = (LONc >= DET['w']) & (LONc <= DET['e']) & (LATc >= DET['s']) & (LATc <= DET['n'])
ctx[inside] = ctx_t[inside]
ctx = np.clip(ctx, 0, 6500)
for name, arr in (('dettaglio', det), ('contesto', ctx)):
    np.round(arr * 10).astype('<u2').tofile(f'{OUT}/terreno-{name}.bin')
meta = {
    'unita': 'decimetri, Uint16 little-endian, righe da nord a sud',
    'dettaglio': {**DET, 'nx': det.shape[1], 'ny': det.shape[0], 'fonte': 'TINITALY 1.1, INGV, CC BY 4.0'},
    'contesto': {**CTX, 'nx': ctx.shape[1], 'ny': ctx.shape[0], 'fonte': 'Copernicus DEM GLO-30, ESA'},
}
json.dump(meta, open(f'{OUT}/terreno.json', 'w'), indent=1)
print('terreno', det.shape, ctx.shape, 'max', det.max())

def h_at(lon, lat):
    fx = (lon - DET['w']) / DET['step']; fy = (DET['n'] - lat) / DET['step']
    return float(bilinear(det, np.array([fx]), np.array([fy]))[0])

# ---------- OSM ----------
import xml.etree.ElementTree as ET
nodes, ways, rels = {}, {}, {}
ntags = {}
for f in sorted(glob.glob(f'{SRC}/osm/c_*.osm')):
    for ev, el in ET.iterparse(f):
        if el.tag == 'node':
            nodes[el.get('id')] = (float(el.get('lon')), float(el.get('lat')))
            t = {c.get('k'): c.get('v') for c in el if c.tag == 'tag'}
            if t: ntags[el.get('id')] = t
        elif el.tag == 'way':
            ways[el.get('id')] = ([n.get('ref') for n in el if n.tag == 'nd'], {c.get('k'): c.get('v') for c in el if c.tag == 'tag'})
        elif el.tag == 'relation':
            rels[el.get('id')] = ([(m.get('type'), m.get('ref'), m.get('role')) for m in el if m.tag == 'member'], {c.get('k'): c.get('v') for c in el if c.tag == 'tag'})
        if el.tag in ('node', 'way', 'relation'): el.clear()

def coords(wid):
    return [[round(nodes[n][0], 7), round(nodes[n][1], 7)] for n in ways[wid][0] if n in nodes]

def join_rings(wids):
    segs = [coords(w) for w in wids if w in ways]
    segs = [s for s in segs if len(s) > 1]
    rings = []
    while segs:
        r = segs.pop(0); changed = True
        while r[0] != r[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == r[-1]: r = r + s[1:]
                elif s[-1] == r[-1]: r = r + s[::-1][1:]
                elif s[-1] == r[0]: r = s + r[1:]
                elif s[0] == r[0]: r = s[::-1] + r[1:]
                else: continue
                segs.pop(i); changed = True; break
        if r[0] == r[-1] and len(r) >= 4: rings.append(r)
    return rings

def area_m2(ring):
    lat0 = math.radians(ring[0][1]); kx = 111320 * math.cos(lat0); ky = 110540
    s = 0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]): s += (x1 * kx) * (y2 * ky) - (x2 * kx) * (y1 * ky)
    return abs(s) / 2

def est_height(t, a):
    if 'height' in t:
        try: return float(t['height'].replace('m', '').strip())
        except ValueError: pass
    if 'building:levels' in t:
        try: return float(t['building:levels']) * 3.2 + 0.8
        except ValueError: pass
    if t.get('building') in ('church', 'chapel', 'cathedral'): return 12.0
    # Positano: case a gradoni, l'altezza conta dal lato a monte (quota più alta del terreno)
    if a < 25: return 3.0
    if a < 80: return 4.5
    if a < 200: return 6.0
    if a < 500: return 7.0
    return 8.5

buildings = []; used = set()
def add_b(ring, t, bid):
    a = area_m2(ring)
    if a < 4: return
    hs = [h_at(x, y) for x, y in ring[:-1]]
    h = est_height(t, a)
    buildings.append({'id': bid, 'r': [[round(x, 7), round(y, 7)] for x, y in ring[:-1]],
                      'b': round(min(hs) - 1.0, 1), 'g': round(max(hs), 1), 'h': round(h, 1),
                      'stima': not ('height' in t or 'building:levels' in t),
                      **({'n': t['name']} if 'name' in t else {}),
                      **({'t': t['building']} if t.get('building') not in (None, 'yes') else {})})
for rid, (mem, t) in rels.items():
    if t.get('type') == 'multipolygon' and 'building' in t:
        outer = [m[1] for m in mem if m[0] == 'way' and m[2] != 'inner']
        for k, ring in enumerate(join_rings(outer)): add_b(ring, t, f'r{rid}.{k}')
        used.update(outer)

WIDTH = {'primary': 6.5, 'secondary': 6, 'tertiary': 5.0, 'unclassified': 4.5, 'residential': 4.5,
         'living_street': 3.5, 'service': 3.5, 'pedestrian': 3.0, 'track': 3.0, 'steps': 1.6,
         'footway': 1.4, 'path': 1.2, 'cycleway': 2.0}
roads = []; landuse = []
for wid, (nd, t) in ways.items():
    c = coords(wid)
    if len(c) < 2: continue
    if ('building' in t or 'building:part' in t) and nd[0] == nd[-1] and wid not in used:
        add_b(c, t, f'w{wid}')
    elif 'highway' in t and t['highway'] in WIDTH:
        w = WIDTH[t['highway']]
        try: w = float(t.get('width', w))
        except ValueError: pass
        roads.append({'id': f'w{wid}', 'k': t['highway'], 'w': w, 'c': c,
                      **({'n': t['name']} if 'name' in t else {}),
                      **({'o': 1} if t.get('oneway') in ('yes', '1') else {}),
                      **({'ponte': 1} if 'bridge' in t else {}), **({'galleria': 1} if 'tunnel' in t else {})})
    elif nd[0] == nd[-1] and (t.get('amenity') == 'parking' or t.get('leisure') in ('pitch', 'park', 'playground') or t.get('landuse') in ('cemetery',) or t.get('natural') == 'beach'):
        kind = t.get('amenity') or t.get('leisure') or t.get('landuse') or t.get('natural')
        landuse.append({'id': f'w{wid}', 'k': kind, 'r': c[:-1], **({'n': t['name']} if 'name' in t else {})})

places = []
for nid, t in ntags.items():
    if 'name' not in t: continue
    k = t.get('place') or t.get('amenity') or t.get('tourism') or t.get('historic') or t.get('public_transport') or t.get('highway') or t.get('shop') or t.get('natural')
    if not k: continue
    x, y = nodes[nid]
    places.append({'n': t['name'], 'k': k, 'p': [round(x, 6), round(y, 6)], 'z': round(h_at(x, y), 1)})

rn, rw, rr = {}, {}, []
for ev, el in ET.iterparse(f'{SRC}/osm/rel.osm'):
    if el.tag == 'node': rn[el.get('id')] = (float(el.get('lon')), float(el.get('lat')))
    if el.tag == 'way': rw[el.get('id')] = [n.get('ref') for n in el if n.tag == 'nd']
    if el.tag == 'relation' and el.get('id') == '40642':
        rr = [m.get('ref') for m in el if m.tag == 'member' and m.get('type') == 'way' and m.get('role') == 'outer']
nodes.update(rn)
for k, v in rw.items(): ways.setdefault(k, (v, {}))
confine = join_rings(rr)

def dump(name, obj):
    json.dump(obj, open(f'{OUT}/{name}.json', 'w'), separators=(',', ':'), ensure_ascii=False)
dump('edifici', buildings); dump('strade', roads); dump('luoghi', places)
dump('confine', confine); dump('suolo', landuse)
print('edifici', len(buildings), 'strade', len(roads), 'luoghi', len(places), 'suolo', len(landuse), 'confine', [len(r) for r in confine])
print('quota bivio Chiesa Nuova', round(h_at(14.4823335, 40.6294794), 1))
