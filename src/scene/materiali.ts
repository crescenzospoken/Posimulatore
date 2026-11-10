import * as C from 'cesium'
// Texture disegnate al volo (niente file esterni): ogni tessera copre LATO metri e si ripete.
export const LATO = 2.4
type Nome = 'pietra' | 'calcestruzzo' | 'intonaco' | 'asfalto' | 'cotto'
const cache = new Map<string, HTMLCanvasElement>()
// rumore ripetibile
function rnd(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
function grana(g: CanvasRenderingContext2D, n: number, a: number, r: () => number, chiaro = true) {
  for (let i = 0; i < n; i++) {
    const v = r()
    g.fillStyle = (chiaro ? v > 0.5 : false) ? `rgba(255,255,255,${a * r()})` : `rgba(0,0,0,${a * r()})`
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2)
  }
}
function disegna(nome: Nome, tinta: string): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const g = c.getContext('2d')!
  const r = rnd(nome.length * 7919 + tinta.length)
  g.fillStyle = tinta; g.fillRect(0, 0, 512, 512)
  if (nome === 'pietra' || nome === 'cotto') {
    // lastre 60 x 40 cm a correre, con toni diversi e fughe
    const w = 128, h = 512 / 6
    for (let j = 0; j < 6; j++) for (let i = -1; i < 5; i++) {
      const x = i * w + (j % 2 ? w / 2 : 0), y = j * h, t = r()
      g.fillStyle = t > 0.5 ? `rgba(255,255,255,${(t - 0.5) * 0.22})` : `rgba(60,40,20,${(0.5 - t) * 0.2})`
      g.fillRect(x, y, w, h)
      // la tessera deve ripetersi: la lastra che esce a destra rientra a sinistra
      if (x + w > 512) g.fillRect(x - 512, y, w, h)
      g.strokeStyle = 'rgba(70,60,50,0.38)'; g.lineWidth = 1.6; g.strokeRect(x + 0.8, y + 0.8, w, h)
      if (x + w > 512) g.strokeRect(x - 512 + 0.8, y + 0.8, w, h)
    }
    grana(g, 5000, 0.1, r)
  } else if (nome === 'calcestruzzo') {
    grana(g, 9000, 0.09, r)
    g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 1
    for (let y = 0; y < 512; y += 128) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(512, y + 0.5); g.stroke() }
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`; g.fillRect(r() * 512, 0, 6 + r() * 26, 512) }
  } else if (nome === 'intonaco') {
    grana(g, 6000, 0.05, r)
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(120,110,90,${0.02 + r() * 0.03})`; g.fillRect(r() * 512, r() * 300, 4 + r() * 14, 200 + r() * 300) }
  } else {
    grana(g, 16000, 0.16, r)
  }
  return c
}
/** Materiale con texture: `larg` e `alt` sono le misure in metri della superficie da coprire. */
export function materiale(nome: Nome, tinta: string, larg: number, alt: number): C.ImageMaterialProperty {
  const k = nome + tinta
  let c = cache.get(k)
  if (!c) { c = disegna(nome, tinta); cache.set(k, c) }
  return new C.ImageMaterialProperty({ image: c, repeat: new C.Cartesian2(Math.max(1, larg / LATO), Math.max(1, alt / LATO)) })
}
