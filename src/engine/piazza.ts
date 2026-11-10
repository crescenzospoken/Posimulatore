import { type XY, add, area, ccw, dist, distToPoly, distToSeg, dot, inside, mul, norm, perp, polysOverlap, rect, rectInside, sub } from './geo'
import { NORME } from './norme'

export type PiazzaPar = {
  quota: number // piano della piazza, m s.l.m.
  spessore: number // solaio, m
  livelli: number // piani di parcheggio sotto la piazza
  hLiv: number // interpiano, m
  campata: number // passo dei pilastri, m
  attacco: number // indice del lato attaccato alla strada
  corsia: number
  stalloL: number
  stalloP: number
  rampaPend: number // pendenza della rampa (0,16 = 16%)
  rampaPos: number // 0..1 lungo il lato d'attacco
  parapetto: boolean
  /** false = si entra a raso dalla strada bassa, niente rampa interna */
  rampa?: boolean
}
export const PIAZZA_DEF: Omit<PiazzaPar, 'quota'> = {
  spessore: 0.5, livelli: 1, hLiv: 3.2, campata: 7.5, attacco: 0, corsia: NORME.corsia90.valore,
  stalloL: 2.5, stalloP: 5.0, rampaPend: 0.16, rampaPos: 0, parapetto: true,
}
export type Controllo = { esito: 'ok' | 'attenzione' | 'errore'; testo: string; fonte?: string }
export type Livello = { k: number; pavimento: number; intradosso: number; stalli: XY[][]; libera: number }
export type Pilastro = { p: XY; base: number; cima: number }
export type Muro = { a: XY; b: XY; base: number; cima: number[]; pts: XY[]; controTerra: boolean }
export type Piazza = {
  poly: XY[]
  area: number
  perimetro: number
  sporgenza: number // distanza massima dal lato d'attacco
  terrenoMin: number
  terrenoMax: number
  altezzaSulTerreno: number
  livelli: Livello[]
  rampa: XY[] | null
  rampaL: number
  pilastri: Pilastro[]
  muri: Muro[]
  scavo: number // m³
  stalliTot: number
  interferenze: string[]
  controlli: Controllo[]
  u: XY
  v: XY
}

export function calcolaPiazza(polyIn: XY[], par: PiazzaPar, h: (p: XY) => number, edifici: { id: string; poly: XY[] }[] = []): Piazza {
  const poly = ccw(polyIn)
  const n = poly.length
  const att = ((par.attacco % n) + n) % n
  // se il poligono è stato invertito, l'indice del lato cambia
  const flipped = poly !== polyIn
  const ai = flipped ? (n - 2 - att + n) % n : att
  const A = poly[ai], B = poly[(ai + 1) % n]
  const u = norm(sub(B, A))
  const v = perp(u) // verso l'interno (poligono antiorario)
  const ar = area(poly)
  let per = 0
  for (let i = 0; i < n; i++) per += dist(poly[i], poly[(i + 1) % n])
  const sporg = Math.max(...poly.map(p => distToSeg(p, A, B)))

  // estensione in coordinate (s lungo u, t lungo v) a partire da A
  const st = poly.map(p => [dot(sub(p, A), u), dot(sub(p, A), v)] as XY)
  const sMin = Math.min(...st.map(q => q[0])), sMax = Math.max(...st.map(q => q[0]))
  const tMax = Math.max(...st.map(q => q[1]))
  const P = (s: number, t: number): XY => add(add(A, mul(u, s)), mul(v, t))

  // terreno sotto la piazza (griglia di 1 m)
  let tMin = Infinity, tMx = -Infinity, scavo = 0
  const fondo = par.quota - par.livelli * par.hLiv - par.spessore
  for (let s = sMin + 0.5; s < sMax; s += 1)
    for (let t = 0.5; t < tMax; t += 1) {
      const p = P(s, t)
      if (!inside(p, poly)) continue
      const z = h(p)
      tMin = Math.min(tMin, z); tMx = Math.max(tMx, z)
      if (par.livelli > 0) scavo += Math.max(0, z - fondo)
    }
  if (!isFinite(tMin)) { tMin = tMx = h(poly[0]) }

  // rampa (una per piano, impilate)
  const conRampa = par.livelli > 0 && par.rampa !== false
  const rampaL = conRampa ? par.hLiv / Math.max(0.05, par.rampaPend) : 0
  const m = 0.3
  const edgeLen = dist(A, B)
  let rampa: XY[] | null = null
  if (conRampa) {
    const s0 = m + par.rampaPos * Math.max(0, edgeLen - rampaL - 2 * m)
    rampa = rect(P(s0, m), u, rampaL, NORME.rampaL.valore)
  }

  // stalli: file parallele al lato d'attacco, corsie fra una coppia di file e l'altra
  const livelli: Livello[] = []
  const righe: number[] = []
  const mod = 2 * par.stalloP + par.corsia
  for (let k = 0; ; k++) {
    const t = k % 2 === 0 ? m + (k / 2) * mod : m + par.stalloP + par.corsia + ((k - 1) / 2) * mod
    if (t + par.stalloP > tMax) break
    righe.push(t)
  }
  const stalliPiano: XY[][] = []
  for (const t of righe) {
    for (let s = sMin + m + 0.2; s + par.stalloL <= sMax; s += par.stalloL) {
      const r = rect(P(s, t), u, par.stalloL, par.stalloP)
      if (!rectInside(r, poly, m)) continue
      if (rampa && polysOverlap(r, rampa)) continue
      stalliPiano.push(r)
    }
  }
  for (let k = 0; k <= par.livelli; k++) {
    const pav = par.quota - k * par.hLiv
    livelli.push({
      k, pavimento: pav, intradosso: pav - par.spessore,
      stalli: k === 0 ? [] : stalliPiano,
      libera: k === 0 ? 0 : par.hLiv - par.spessore,
    })
  }

  // pilastri
  const pilastri: Pilastro[] = []
  const cima = par.quota - par.spessore
  const ts: number[] = []
  if (par.livelli > 0) righe.forEach((t, k) => ts.push(k % 2 === 0 ? t + par.stalloP : t)) // fronte delle file, sul bordo della corsia
  else for (let t = m + 0.2; t <= tMax; t += par.campata) ts.push(t)
  for (let s = sMin + m + 0.2; s <= sMax; s += par.campata)
    for (const t of ts) {
      const p = P(s, t)
      if (!inside(p, poly) || distToPoly(p, poly) < 0.4) continue
      const z = h(p)
      const base = par.livelli > 0 ? Math.min(z, fondo) : z // dal terreno, o dal fondo se il piano è scavato
      if (base < cima - 0.3) pilastri.push({ p, base, cima })
    }

  // muri perimetrali dei piani di parcheggio (sotto il lato d'attacco e contro terra)
  const muri: Muro[] = []
  if (par.livelli > 0)
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n]
      const L = dist(a, b), pts: XY[] = [], cimaArr: number[] = []
      const steps = Math.max(1, Math.ceil(L / 1))
      let contro = false
      for (let j = 0; j <= steps; j++) {
        const p = add(a, mul(sub(b, a), j / steps))
        pts.push(p)
        const z = h(p)
        if (z > fondo + 0.3) contro = true
        cimaArr.push(i === ai ? cima : Math.max(fondo, Math.min(cima, z)))
      }
      muri.push({ a, b, base: fondo, cima: cimaArr, pts, controTerra: contro || i === ai })
    }

  const interferenze = edifici.filter(e => polysOverlap(e.poly, poly)).map(e => e.id)
  const stalliTot = stalliPiano.length * par.livelli
  const controlli: Controllo[] = []
  const lib = par.hLiv - par.spessore
  if (par.livelli > 0) {
    controlli.push(lib >= NORME.autorimessaH.valore
      ? { esito: 'ok', testo: `Altezza libera dei piani ${lib.toFixed(2).replace('.', ',')} m`, fonte: NORME.autorimessaH.fonte }
      : { esito: 'errore', testo: `Altezza libera ${lib.toFixed(2).replace('.', ',')} m, sotto 2,40 m`, fonte: NORME.autorimessaH.fonte })
    if (!conRampa) controlli.push({ esito: 'attenzione', testo: 'Ingresso a raso dalla strada bassa: quota e varco da verificare sul posto' })
    else controlli.push(par.rampaPend <= NORME.rampaMax.valore
      ? { esito: 'ok', testo: `Rampa al ${Math.round(par.rampaPend * 100)}%, lunga ${rampaL.toFixed(1).replace('.', ',')} m per piano`, fonte: NORME.rampaMax.fonte }
      : { esito: 'errore', testo: `Rampa al ${Math.round(par.rampaPend * 100)}%, oltre il 20%`, fonte: NORME.rampaMax.fonte })
    if (rampa && rampaL + 0.6 > edgeLen) controlli.push({ esito: 'errore', testo: `La rampa (${rampaL.toFixed(1).replace('.', ',')} m) non entra nel lato d'attacco (${edgeLen.toFixed(1).replace('.', ',')} m)` })
    if (stalliPiano.length === 0) controlli.push({ esito: 'errore', testo: 'Nessuno stallo entra: la piazza è troppo stretta per fila + corsia' })
    if (scavo > 1) controlli.push({ esito: 'attenzione', testo: `Scavo nel versante circa ${Math.round(scavo).toLocaleString('it-IT')} m³ (stima dal modello 3D)` })
  }
  const alt = par.quota - tMin
  if (alt > 12) controlli.push({ esito: 'attenzione', testo: `La piazza sta fino a ${alt.toFixed(1).replace('.', ',')} m sopra il terreno: struttura alta, serve verifica strutturale` })
  if (par.quota < tMx - 0.5) controlli.push({ esito: 'attenzione', testo: `Parte del terreno (fino a ${(tMx - par.quota).toFixed(1).replace('.', ',')} m) sta sopra il piano della piazza` })
  if (interferenze.length) controlli.push({ esito: 'attenzione', testo: `Sovrapposta a ${interferenze.length} edific${interferenze.length === 1 ? 'io' : 'i'} esistent${interferenze.length === 1 ? 'e' : 'i'} (ingombri OpenStreetMap)` })
  controlli.push({ esito: 'attenzione', testo: 'Quote lette dal modello 3D: indicative, servono rilievi sul posto' })

  return {
    poly, area: ar, perimetro: per, sporgenza: sporg, terrenoMin: tMin, terrenoMax: tMx, altezzaSulTerreno: alt,
    livelli, rampa, rampaL, pilastri, muri, scavo, stalliTot, interferenze, controlli, u, v,
  }
}
