"""Punti di interesse di Positano da OpenStreetMap (API 0.6, ODbL): bagni, fermate, biglietti, parcheggi, bar...
Scarica il comune a riquadri (cache su disco), tiene nodi e aree con i tag utili, dentro il confine comunale.
Uso: python3 -I scripts/poi-osm.py CACHE_DIR public/data
"""
import sys, os, json, time, urllib.request
import xml.etree.ElementTree as ET
CACHE, OUT = sys.argv[1], sys.argv[2]
os.makedirs(CACHE, exist_ok=True)
W, E, S, N, P = 14.415, 14.535, 40.570, 40.665, 0.02

# categoria -> regole (chiave, valori); la prima che combacia vince
CAT = [
    ('bagni', [('amenity', {'toilets'})]),
    ('biglietti', [('shop', {'ticket'}), ('vending', {'public_transport_tickets', 'bus_tickets'}), ('amenity', {'ticket_office'})]),
    ('fermate', [('highway', {'bus_stop'}), ('bus', {'yes'})]),
    ('traghetti', [('amenity', {'ferry_terminal'})]),
    ('taxi', [('amenity', {'taxi'})]),
    ('parcheggi', [('amenity', {'parking', 'motorcycle_parking'})]),
    ('bar', [('amenity', {'bar', 'cafe', 'pub', 'ice_cream'})]),
    ('ristoranti', [('amenity', {'restaurant', 'fast_food'})]),
    ('farmacie', [('amenity', {'pharmacy'}), ('healthcare', {'pharmacy'})]),
    ('salute', [('amenity', {'doctors', 'clinic', 'hospital', 'dentist'}), ('emergency', {'defibrillator'})]),
    ('bancomat', [('amenity', {'atm', 'bank'})]),
    ('acqua', [('amenity', {'drinking_water', 'fountain'})]),
    ('info', [('tourism', {'information'})]),
    ('alimentari', [('shop', {'supermarket', 'convenience', 'grocery', 'bakery', 'greengrocer', 'butcher', 'deli'})]),
    ('spiagge', [('natural', {'beach'})]),
    ('panorami', [('tourism', {'viewpoint'})]),
    ('chiese', [('amenity', {'place_of_worship'})]),
    ('sicurezza', [('amenity', {'police', 'fire_station'})]),
]
def categoria(t):
    if t.get('public_transport') == 'platform' and t.get('bus') != 'yes' and t.get('highway') != 'bus_stop': return None
    for c, regole in CAT:
        for k, vs in regole:
            if t.get(k) in vs: return c
    # tutto il resto che ha un nome: alloggi, negozi, attività (per la ricerca; sulla mappa si accendono a richiesta)
    if not t.get('name'): return None
    if t.get('tourism') in {'hotel', 'guest_house', 'apartment', 'hostel', 'motel', 'chalet', 'camp_site'}: return 'alloggi'
    if t.get('shop'): return 'negozi'
    if (t.get('amenity') in {'nightclub', 'theatre', 'cinema', 'arts_centre', 'library', 'post_office', 'townhall', 'school', 'kindergarten', 'car_rental', 'boat_rental', 'bicycle_rental', 'fuel', 'marketplace', 'events_venue', 'dive_centre', 'spa'}
            or t.get('office') or t.get('craft') or t.get('healthcare') or t.get('club')
            or t.get('tourism') in {'attraction', 'museum', 'gallery', 'artwork'} or t.get('leisure') in {'beach_resort', 'marina', 'sports_centre', 'fitness_centre'}):
        return 'attivita'
    return None

def scarica(w, s):
    f = f'{CACHE}/{w:.3f}_{s:.3f}.osm'
    if not os.path.exists(f):
        u = f'https://api.openstreetmap.org/api/0.6/map?bbox={w},{s},{w + P},{s + P}'
        for k in range(4):
            try:
                d = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Posimulatore/0.1 (mappa 3D di Positano)'}), timeout=120).read()
                open(f, 'wb').write(d); break
            except Exception as e:
                print('riprovo', u, e, flush=True); time.sleep(5 * (k + 1))
        time.sleep(1)
    return f

confine = max(json.load(open(f'{OUT}/confine.json')), key=len)
def dentro(p, poly):
    c = False; j = len(poly) - 1
    for i in range(len(poly)):
        a, b = poly[i], poly[j]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]: c = not c
        j = i
    return c

nodi, out, visti = {}, [], set()
s = S
while s < N:
    w = W
    while w < E:
        f = scarica(round(w, 3), round(s, 3))
        if os.path.exists(f):
            r = ET.parse(f).getroot()
            for n in r.iter('node'): nodi[n.get('id')] = (float(n.get('lon')), float(n.get('lat')))
            elementi = [('n', e) for e in r.iter('node')] + [('w', e) for e in r.iter('way')]
            for tipo, e in elementi:
                t = {x.get('k'): x.get('v') for x in e.iter('tag')}
                c = categoria(t) if t else None
                if not c: continue
                i = tipo + e.get('id')
                if i in visti: continue
                if tipo == 'n': p = (float(e.get('lon')), float(e.get('lat')))
                else:
                    pts = [nodi[x.get('ref')] for x in e.iter('nd') if x.get('ref') in nodi]
                    if not pts: continue
                    p = (sum(q[0] for q in pts) / len(pts), sum(q[1] for q in pts) / len(pts))
                if not dentro(p, confine): continue
                visti.add(i)
                d = {'id': 'osm:' + i, 'c': c, 'p': [round(p[0], 7), round(p[1], 7)]}
                if t.get('name'): d['n'] = t['name']
                extra = {k: t[k] for k in ('opening_hours', 'fee', 'wheelchair', 'phone', 'website', 'operator', 'capacity', 'shop', 'tourism', 'amenity', 'cuisine', 'addr:street', 'addr:housenumber') if k in t}
                if extra: d['x'] = extra
                out.append(d)
        w += P
    s += P
out.sort(key=lambda d: (d['c'], d.get('n', '')))
json.dump({'fonte': 'OpenStreetMap contributors (ODbL), API 0.6, ' + time.strftime('%d/%m/%Y'), 'punti': out}, open(f'{OUT}/poi.json', 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(len(out), Counter(d['c'] for d in out))
