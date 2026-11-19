// Street View dentro l'app (Google Maps JavaScript, StreetViewPanorama): foto a 360° di Google, solo da guardare.
// Modi: un punto fisso (luogo, evento), il percorso a passi (avanti e indietro lungo la linea), Cammina (segue la camera).
import { useEffect, useRef, useState } from 'react'
import * as C from 'cesium'
import { useS } from '../store'
import { t } from '../i18n'
import { Icona } from './Icona'
import { viewer, pos } from '../scene/viewer'
import { impostaVoci } from '../scene/sovrapposti'
import { quota } from '../scene/terreno'
import type { LL } from '../engine/geo'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any
let caricamento: Promise<G> | null = null
/** Carica le API di Google Maps una volta sola, nella lingua dell'app. */
function google(chiave: string, lingua: string): Promise<G> {
  const w = window as unknown as { google?: G }
  if (w.google?.maps?.StreetViewPanorama) return Promise.resolve(w.google)
  caricamento ??= new Promise((ok, ko) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(chiave)}&v=weekly&language=${lingua}&region=IT&loading=async&callback=__svPronto`
    ;(window as unknown as Record<string, unknown>).__svPronto = () => ok(w.google)
    s.onerror = () => { caricamento = null; ko(new Error('Street View non raggiungibile')) }
    document.head.appendChild(s)
  })
  return caricamento
}

const KX = 84560, KY = 111030
const dist = (a: LL, b: LL) => Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY)
const rotta = (a: LL, b: LL) => (Math.atan2((b[0] - a[0]) * KX, (b[1] - a[1]) * KY) * 180) / Math.PI
/** Punti del percorso ogni ~25 m, con la direzione in cui si cammina. */
export function passiPercorso(pts: LL[], passo = 25): { p: LL; rotta: number }[] {
  const out: { p: LL; rotta: number }[] = []
  let resto = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = dist(a, b)
    if (d < 0.01) continue
    let x = resto
    while (x <= d) { const k = x / d; out.push({ p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], rotta: rotta(a, b) }); x += passo }
    resto = x - d
  }
  if (pts.length > 1) out.push({ p: pts[pts.length - 1], rotta: rotta(pts[pts.length - 2], pts[pts.length - 1]) })
  return out
}

export type Vista360 = { modo: 'punto'; p: LL; titolo?: string } | { modo: 'percorso'; pts: LL[]; titolo?: string } | { modo: 'cammina' }

/** Pannello Street View. Mostra «nessuna foto qui» dove Google non ha immagini (tanti vicoli e scale di Positano). */
export function StreetView({ vista, chiudi }: { vista: Vista360; chiudi: () => void }) {
  const s = useS()
  const box = useRef<HTMLDivElement>(null)
  const pano = useRef<G>(null), servizio = useRef<G>(null)
  const [stato, setStato] = useState<'carico' | 'ok' | 'vuoto' | 'errore'>('carico')
  const [i, setI] = useState(0)
  const passi = vista.modo === 'percorso' ? passiPercorso(vista.pts) : []

  // cerca la foto più vicina (prima quelle di Google per strada, poi anche quelle dei visitatori)
  const vaiA = (g: G, p: LL, verso?: number) => {
    const req = (fonte: string) => servizio.current.getPanorama({ location: { lat: p[1], lng: p[0] }, radius: 40, preference: g.maps.StreetViewPreference.NEAREST, sources: [fonte] })
    req(g.maps.StreetViewSource.GOOGLE).catch(() => req(g.maps.StreetViewSource.DEFAULT)).then((r: G) => {
      pano.current.setPano(r.data.location.pano)
      if (verso !== undefined) pano.current.setPov({ heading: verso, pitch: 0 })
      setStato('ok')
    }).catch(() => setStato('vuoto'))
  }

  useEffect(() => {
    let vivo = true
    google(s.googleKey, s.lingua).then(g => {
      if (!vivo || !box.current) return
      servizio.current = new g.maps.StreetViewService()
      pano.current = new g.maps.StreetViewPanorama(box.current, { addressControl: false, fullscreenControl: true, motionTracking: false, showRoadLabels: true, zoomControl: false, linksControl: true, panControl: false })
      // sulla mappa, un pallino arancione dove si trova la foto (anche quando ci si sposta con le frecce di Street View)
      pano.current.addListener('position_changed', () => {
        const l = pano.current.getPosition(); if (!l) return
        const p: LL = [l.lng(), l.lat()]
        impostaVoci('sv:', [{ id: 'sv:io', tipo: 'tappa', pos: pos(p[0], p[1], quota(p[0], p[1]) + 3), testo: '', icona: 'streetview', col: '#f9ab00', scelto: true, maxDist: 1e9 }])
      })
      if (vista.modo === 'punto') vaiA(g, vista.p)
      else if (vista.modo === 'percorso' && passi.length) vaiA(g, passi[0].p, passi[0].rotta)
      else { const c = viewer.camera.positionCartographic; vaiA(g, [C.Math.toDegrees(c.longitude), C.Math.toDegrees(c.latitude)], C.Math.toDegrees(viewer.camera.heading)) }
    }).catch(() => vivo && setStato('errore'))
    return () => { vivo = false; impostaVoci('sv:', []) }
  }, [vista.modo === 'punto' ? vista.p.join() : vista.modo === 'percorso' ? vista.pts.length + ':' + vista.pts[0]?.join() : 'c'])

  // percorso a passi
  useEffect(() => {
    if (vista.modo !== 'percorso' || !pano.current || !passi[i]) return
    const w = window as unknown as { google: G }
    vaiA(w.google, passi[i].p, passi[i].rotta)
  }, [i])

  // Cammina: ogni 12 m di camminata la foto segue la camera, e anche la direzione dello sguardo
  useEffect(() => {
    if (vista.modo !== 'cammina') return
    let ultimo: LL | null = null
    const via = viewer.scene.postRender.addEventListener(() => {
      const w = window as unknown as { google?: G }
      if (!pano.current || !w.google) return
      const c = viewer.camera.positionCartographic, p: LL = [C.Math.toDegrees(c.longitude), C.Math.toDegrees(c.latitude)]
      if (!ultimo || dist(ultimo, p) > 12) { ultimo = p; vaiA(w.google, p, C.Math.toDegrees(viewer.camera.heading)) }
      else pano.current.setPov({ heading: C.Math.toDegrees(viewer.camera.heading), pitch: 0 })
    })
    return () => via()
  }, [vista.modo])

  return (
    <section className="street-view" aria-label="Street View">
      <div ref={box} className="sv-foto" />
      {stato !== 'ok' && <div className="sv-stato">{stato === 'carico' ? t('Carico Street View…') : stato === 'vuoto' ? t('Qui Google non ha foto a 360°: prova un po\' più avanti') : t('Street View non raggiungibile')}</div>}
      <div className="sv-barra">
        <b>{vista.modo !== 'cammina' && vista.titolo ? vista.titolo : 'Street View'}</b>
        {vista.modo === 'percorso' && passi.length > 1 && <>
          <button className="tondo" disabled={i === 0} onClick={() => setI(Math.max(0, i - 1))} aria-label={t('Indietro')}><Icona n="arrow_back" /></button>
          <small>{Math.round((i / (passi.length - 1)) * 100)}%</small>
          <button className="tondo" disabled={i >= passi.length - 1} onClick={() => setI(Math.min(passi.length - 1, i + 1))} aria-label={t('Avanti')}><span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}><Icona n="arrow_back" /></span></button>
        </>}
        <button className="tondo quiet" onClick={chiudi} aria-label={t('Chiudi')}><Icona n="close" /></button>
      </div>
    </section>
  )
}
