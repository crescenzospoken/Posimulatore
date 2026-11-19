"""Terreno per il browser: differenze fra quote vicine (Uint16, modulo 65536) compresse in gzip.
4,0 MB -> ~0,9 MB. Il browser le scompatta con DecompressionStream e somma le differenze (src/scene/terreno.ts).
Uso: python3 scripts/comprimi-terreno.py"""
import array, gzip, pathlib
for k in ("dettaglio", "contesto"):
    src = pathlib.Path(f"public/data/terreno-{k}.bin")
    a = array.array("H", src.read_bytes())
    d = array.array("H", [a[0]] + [(a[i] - a[i - 1]) & 0xFFFF for i in range(1, len(a))])
    out = src.with_suffix(".d16.gz")
    out.write_bytes(gzip.compress(d.tobytes(), 9, mtime=0))
    print(out, len(a) * 2, "->", out.stat().st_size)
