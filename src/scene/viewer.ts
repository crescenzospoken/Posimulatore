import * as C from 'cesium'
import { avvio } from '../ui/avvio'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { GEOIDE, caricaTerreno, quota as quotaTerreno } from './terreno'
import type { Livelli } from '../store'
import type { Vista } from '../engine/model'

;(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = '/cesium/'
export let viewer: C.Viewer
// `tileset.getHeight` ricopia dalla GPU tutti i vertici della tessera a ogni lettura (misurato il 24/11: fino a 9 s per
// una lettura sul telefono, 88 s in tutto per una vista). Qui i vertici letti restano in memoria finché vive la tessera
// (WeakMap: si liberano con lei): le letture successive sulla stessa tessera costano ~9 volte meno. Mai salvati.
try {
  const R = (C as unknown as { ModelReader?: Record<string, (x: object) => unknown> }).ModelReader
  if (R) for (const k of ['readAttributeAsTypedArray', 'readIndicesAsTypedArray']) {
    const orig = R[k], memo = new WeakMap<object, unknown>()
    if (typeof orig === 'function') R[k] = (x: object) => { let v = memo.get(x); if (v === undefined) { v = orig(x); memo.set(x, v) } return v }
  }
} catch { /* Cesium cambiato: si resta alla lettura lenta */ }
export const VAI: { nome: string; lon: number; lat: number; h: number; heading: number; pitch: number }[] = [
  { nome: 'Tutta Positano', lon: 14.4858, lat: 40.6192, h: 900, heading: 6, pitch: -42 },
  { nome: 'Bivio di Chiesa Nuova', lon: 14.48335, lat: 40.62935, h: 222, heading: 262, pitch: -38 },
  { nome: 'Spiaggia Grande e Collegiata', lon: 14.4852, lat: 40.6248, h: 160, heading: 0, pitch: -25 },
  { nome: 'La Sponda', lon: 14.4905, lat: 40.6250, h: 200, heading: -10, pitch: -35 },
  { nome: 'Fornillo', lon: 14.4795, lat: 40.6235, h: 140, heading: 10, pitch: -28 },
  { nome: 'Montepertuso', lon: 14.4925, lat: 40.6290, h: 520, heading: 5, pitch: -35 },
  { nome: 'Nocelle', lon: 14.5030, lat: 40.6262, h: 600, heading: 0, pitch: -35 },
  { nome: 'Laurito', lon: 14.5050, lat: 40.6205, h: 160, heading: 0, pitch: -25 },
  { nome: 'Li Galli', lon: 14.4330, lat: 40.5740, h: 250, heading: 0, pitch: -25 },
]
let pavimento = true
const CENTRO: [number, number] = [14.4855, 40.624], RAGGIO = 9000, ALTEZZA_MAX = 5000, ALTEZZA_MIN = 55
/** Il pavimento della camera si spegne mentre si cammina (lì la quota la decide la camminata). */
export const pavimentoAttivo = (on: boolean) => { pavimento = on }
/** Tutta Positano dal mare; sul telefono (schermo stretto) un po' più alta per starci tutta. */
export const vistaTotale = (durata = 1.6) => { const v = VAI[0]; vai(telefono() ? { ...v, h: v.h * 1.6, lat: v.lat - 0.004 } : v, durata) }
export const pos = (lon: number, lat: number, z: number) => C.Cartesian3.fromDegrees(lon, lat, z + GEOIDE)

export async function creaViewer(el: HTMLElement, onReady?: () => void) {
  const terrainProvider = await caricaTerreno()
  viewer = new C.Viewer(el, {
    terrainProvider,
    baseLayer: false,
    // niente stelle né luna (0,9 MB scaricati per un cielo che di giorno non si vede)
    skyBox: false,
    animation: false, timeline: false, geocoder: false, homeButton: false, sceneModePicker: false,
    baseLayerPicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false, scene3DOnly: true, shadows: false,
    msaaSamples: 1,
    requestRenderMode: true,
    // altrimenti Cesium disegna a 1 pixel per pixel CSS anche su schermi da 3x: tutto sgranato sul telefono
    useBrowserRecommendedResolution: false,
    maximumRenderTimeChange: Infinity,
  })
  const s = viewer.scene
  s.globe.baseColor = C.Color.fromCssColorString('#1d4f73')
  s.globe.depthTestAgainstTerrain = true
  s.globe.enableLighting = false
  s.globe.maximumScreenSpaceError = 1.5
  s.globe.tileCacheSize = 400
  if (s.skyAtmosphere) s.skyAtmosphere.show = true
  s.fog.enabled = true
  s.fog.density = 0.00012
  // da vicino il 3D di Google mostra distorsioni: non ci si avvicina a meno di ALTEZZA_MIN (Cammina escluso)
  s.screenSpaceCameraController.minimumZoomDistance = ALTEZZA_MIN
  s.screenSpaceCameraController.maximumZoomDistance = 6000
  s.postProcessStages.fxaa.enabled = true
  impostaQualita(qualitaIniziale())
  // il terreno e le immagini che arrivano chiedono un nuovo disegno
  s.globe.tileLoadProgressEvent.addEventListener(() => s.requestRender())
  ;(viewer.cesiumWidget.creditContainer as HTMLElement).classList.add('crediti')
  // pavimento: la camera non scende sotto il terreno (con Google acceso il globo è nascosto e senza questo si finiva sotto la mesh).
  // Il controllo di collisione di Cesium con il 3D costerebbe un'interrogazione della scena a ogni fotogramma; qui basta la nostra griglia.
  const g = new C.Cartographic()
  s.preRender.addEventListener(() => {
    const c = C.Cartographic.fromCartesian(viewer.camera.positionWC, undefined, g)
    if (!c) return
    // recinto: la visuale resta entro 9 km (Li Galli compresi) da Positano e sotto i 5 km di quota (con la vista quasi verticale bastava un
    // pizzico o un Maiusc-clic per finire lontanissimo e perdersi)
    const lo = C.Math.toDegrees(c.longitude), la = C.Math.toDegrees(c.latitude)
    const dx = (lo - CENTRO[0]) * 84560, dy = (la - CENTRO[1]) * 111030, d = Math.hypot(dx, dy)
    if (d > RAGGIO || c.height > ALTEZZA_MAX + GEOIDE) {
      const k = d > RAGGIO ? RAGGIO / d : 1
      const su = C.Cartesian3.fromDegrees(CENTRO[0] + (dx * k) / 84560, CENTRO[1] + (dy * k) / 111030, Math.min(c.height, ALTEZZA_MAX + GEOIDE))
      viewer.camera.setView({ destination: su, orientation: { heading: viewer.camera.heading, pitch: viewer.camera.pitch, roll: 0 } })
      return
    }
    if (!pavimento) return
    const min = quotaTerreno(C.Math.toDegrees(c.longitude), C.Math.toDegrees(c.latitude)) + GEOIDE + ALTEZZA_MIN
    if (c.height < min) {
      const su = C.Cartesian3.fromRadians(c.longitude, c.latitude, min)
      viewer.camera.setView({ destination: su, orientation: { heading: viewer.camera.heading, pitch: viewer.camera.pitch, roll: 0 } })
    }
  })
  onReady?.()
  return viewer
}

export function vai(v: Vista, durata = 1.6) {
  viewer.camera.flyTo({
    destination: pos(v.lon, v.lat, v.h),
    orientation: { heading: C.Math.toRadians(v.heading), pitch: C.Math.toRadians(v.pitch), roll: 0 },
    duration: durata,
  })
}
/** Inquadra un insieme di punti (m s.l.m.) da sud-est, inclinato. */
export function inquadra(pts: [number, number][], z: number, heading = 200, pitch = -45) {
  const cs = pts.map(p => pos(p[0], p[1], z))
  const bs = C.BoundingSphere.fromPoints(cs)
  viewer.camera.flyToBoundingSphere(bs, { offset: new C.HeadingPitchRange(C.Math.toRadians(heading), C.Math.toRadians(pitch), Math.max(90, bs.radius * 5)), duration: 1.4 })
}
export function vistaCorrente(): Vista {
  const c = viewer.camera.positionCartographic
  return { lon: C.Math.toDegrees(c.longitude), lat: C.Math.toDegrees(c.latitude), h: c.height - GEOIDE, heading: C.Math.toDegrees(viewer.camera.heading), pitch: C.Math.toDegrees(viewer.camera.pitch) }
}

// ---------- ortofoto e mappe ----------
let strato: C.ImageryLayer | undefined, rilievo: C.ImageryLayer | undefined
let ortoAttuale = ''
export function impostaOrto(k: Livelli['orto']) {
  if (k === ortoAttuale) return
  ortoAttuale = k
  if (strato) viewer.imageryLayers.remove(strato, true)
  let prov: C.ImageryProvider
  if (k === 'pcn2012') {
    prov = new C.WebMapServiceImageryProvider({
      url: '/wms/pcn',
      layers: 'OI.ORTOIMMAGINI.2012',
      parameters: { format: 'image/jpeg', transparent: false, styles: '' },
      tileWidth: 512, tileHeight: 512, maximumLevel: 19,
      rectangle: C.Rectangle.fromDegrees(6.5, 36.5, 18.6, 47.2),
      credit: new C.Credit('Ortofoto 2012: Geoportale Nazionale, Ministero dell\'Ambiente (MASE)'),
    })
  } else if (k === 'esri') {
    prov = new C.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 19, credit: new C.Credit('Immagini: Esri, Maxar, Earthstar Geographics'),
    })
  } else if (k === 'mappa') {
    // mappa semplice grigio chiaro (Esri Light Gray Canvas, stesso server del satellite): sopra, le nostre vie colorate si leggono bene
    prov = new C.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 16, credit: new C.Credit('Mappa: Esri, HERE, Garmin, © OpenStreetMap contributors'),
    })
  } else {
    prov = new C.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/', maximumLevel: 19, credit: '© OpenStreetMap contributors' } as C.OpenStreetMapImageryProvider.ConstructorOptions)
  }
  strato = viewer.imageryLayers.addImageryProvider(prov, 0)
  // sulla mappa semplice un'ombreggiatura leggera del rilievo e il mare azzurro, così si legge il 3D
  if (rilievo) { viewer.imageryLayers.remove(rilievo, true); rilievo = undefined }
  if (k === 'mappa') {
    rilievo = viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', maximumLevel: 16, credit: new C.Credit('Rilievo: Esri'),
    }))
    rilievo.alpha = 0.28
  }
  viewer.scene.globe.baseColor = C.Color.fromCssColorString(k === 'mappa' ? '#aadaff' : '#1d4f73')
  // sotto l'ortofoto, fuori dall'Italia o mentre carica: satellite a bassa risoluzione
  viewer.scene.requestRender()
}

// ---------- Google 3D (via Cesium ion, gratuito, solo da guardare) ----------
let google: C.Cesium3DTileset | undefined
// ---------- qualità ----------
export type Qualita = 'leggera' | 'normale' | 'alta'
export const telefono = () => matchMedia('(max-width: 760px), (pointer: coarse)').matches
export const qualitaIniziale = (): Qualita => (telefono() ? 'leggera' : 'normale')
let qAttuale: Qualita = 'normale'
/** Errore a schermo di Google (più alto = meno dettaglio, più veloce) e risoluzione del disegno per ogni livello. */
// res = pixel veri per ogni pixel CSS (il telefono ne ha 3): prima si disegnava a 0,8 pixel CSS, cioè sgranato
const Q: Record<Qualita, { sse: number; res: number; cacheMB: number }> = {
  leggera: { sse: 18, res: 1.5, cacheMB: 192 },
  normale: { sse: 12, res: 2, cacheMB: 384 },
  alta: { sse: 6, res: 3, cacheMB: 768 },
}
export function impostaQualita(q: Qualita) {
  qAttuale = q
  const v = Q[q]
  // si disegna a v.res pixel per pixel CSS, mai oltre lo schermo (useBrowserRecommendedResolution è spento)
  const dpr = window.devicePixelRatio || 1
  viewer.resolutionScale = Math.min(dpr, v.res) / dpr
  viewer.scene.postProcessStages.fxaa.enabled = q !== 'leggera'
  // MSAA: bordi lisci su vie, 3D e simboli; i telefoni (GPU a tasselli) lo fanno quasi gratis. Solo WebGL2.
  if (viewer.scene.msaaSupported) viewer.scene.msaaSamples = 4
  // sul leggero 30 fotogrammi al secondo costanti: meglio di 40-60 a strappi (e il telefono scalda meno)
  viewer.targetFrameRate = q === 'leggera' ? 30 : (undefined as unknown as number)
  viewer.scene.globe.maximumScreenSpaceError = q === 'leggera' ? 3 : q === 'alta' ? 1.5 : 2
  if (google) { google.maximumScreenSpaceError = v.sse; google.cacheBytes = v.cacheMB * 1024 * 1024 }
  viewer.scene.requestRender()
}
let onGoogle: (() => void) | undefined, onGoogleKo: (() => void) | undefined
let googlePronto = false
// Shader del 3D di Google: «Attenua il 3D» e le vie «Dipinte» (dipinte.ts). Le tele delle vie sono texture nostre,
// passate allo shader da `textureDipinte` (0-2 = colore dal fine al grosso, 3 = quote).
export const textureDipinte: unknown[] = []
const vuota = () => new C.TextureUniform({ typedArray: new Uint8Array(4), width: 1, height: 1, repeat: false })
export const shader3D = new C.CustomShader({
  uniforms: {
    u_attenua: { type: C.UniformType.FLOAT, value: 0 }, u_dip: { type: C.UniformType.FLOAT, value: 0 }, u_alfa: { type: C.UniformType.FLOAT, value: 1 }, u_pend: { type: C.UniformType.FLOAT, value: 0.36 }, u_debug: { type: C.UniformType.FLOAT, value: 0 },
    u_m: { type: C.UniformType.MAT4, value: C.Matrix4.clone(C.Matrix4.IDENTITY) }, u_su: { type: C.UniformType.VEC3, value: new C.Cartesian3(0, 0, 1) },
    u_r0: { type: C.UniformType.VEC3, value: new C.Cartesian3(0, 0, 1) }, u_r1: { type: C.UniformType.VEC3, value: new C.Cartesian3(0, 0, 1) },
    u_r2: { type: C.UniformType.VEC3, value: new C.Cartesian3(0, 0, 1) }, u_rq: { type: C.UniformType.VEC3, value: new C.Cartesian3(0, 0, 1) },
    u_t0: { type: C.UniformType.SAMPLER_2D, value: vuota() }, u_t1: { type: C.UniformType.SAMPLER_2D, value: vuota() },
    u_t2: { type: C.UniformType.SAMPLER_2D, value: vuota() }, u_q: { type: C.UniformType.SAMPLER_2D, value: vuota() },
  },
  lightingModel: C.LightingModel.UNLIT,
  fragmentShaderText: `
    bool dentro(vec2 a) { return a.x > 0.003 && a.y > 0.003 && a.x < 0.997 && a.y < 0.997; }
    void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      vec3 c = material.diffuse;
      float g = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 chiaro = mix(vec3(g), vec3(1.0), 0.55);
      c = mix(c, chiaro, u_attenua);
      vec3 pe = fsInput.attributes.positionEC;
      vec3 dx = dFdx(pe), dy = dFdy(pe);
      if (u_dip > 0.5) {
        vec3 l = (u_m * vec4(pe, 1.0)).xyz;
        vec4 t = vec4(0.0);
        vec2 a = (l.xy - u_r0.xy) / u_r0.z;
        if (dentro(a)) t = texture(u_t0, a);
        else {
          a = (l.xy - u_r1.xy) / u_r1.z;
          if (dentro(a)) t = texture(u_t1, a);
          else { a = (l.xy - u_r2.xy) / u_r2.z; if (dentro(a)) t = texture(u_t2, a); }
        }
        if (t.a > 0.004) {
          // solo superfici quasi piane (niente muri), alla quota della via (niente tetti e chiome)
          float k = 1.0, kq = 1.0, kn = 1.0;
          vec2 b = (l.xy - u_rq.xy) / u_rq.z;
          if (dentro(b)) {
            vec4 q = texture(u_q, b);
            if (q.a > 0.25) {
              float hz = (q.r * 65280.0 + q.g * 255.0) / 50.0 - 100.0, tol = q.b * 25.5;
              // quota non ancora letta dal 3D (lontano): tolleranza larga, che cresce con la distanza
              if (q.b > 0.99) tol = 2.2 + 0.012 * length(pe);
              float dz = l.z - hz;
              // sopra la strada si è più severi (tetti, chiome, auto alte), sotto un po' meno (cunette, mesh imprecisa)
              kq = 1.0 - smoothstep(tol, tol + 0.7, dz > 0.0 ? dz * 1.25 : -dz);
            }
          }
          kn = smoothstep(u_pend - 0.15, u_pend, abs(dot(normalize(cross(dx, dy)), u_su)));
          k = kq * kn * u_alfa;
          vec3 col = czm_srgbToLinear(t.rgb / max(t.a, 0.001));
          // la vernice lascia passare chiari e scuri della foto (strisce, ombre): sembra stesa sull'asfalto, non incollata sopra
          float luce = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(c, col * (0.62 + 0.75 * luce), t.a * k);
          if (u_debug > 0.5) c = mix(c, vec3(1.0 - kq, kn * kq, 1.0 - kn), t.a);
        }
      }
      material.diffuse = c;
    }`,
})
// le texture le creiamo e aggiorniamo noi (da canvas, senza rileggerle in memoria): lo shader le prende da qui
{
  const mappa = (shader3D as unknown as { uniformMap: Record<string, () => unknown> }).uniformMap
  ;['u_t0', 'u_t1', 'u_t2', 'u_q'].forEach((n, i) => { mappa[n] = () => textureDipinte[i] ?? (viewer.scene as unknown as { context: { defaultTexture: unknown } }).context.defaultTexture })
}
/** 0 = foto vere, 1 = quasi bianco e grigio come un plastico. */
export function attenua3D(x: number) { shader3D.setUniform('u_attenua', Math.max(0, Math.min(1, x))); viewer?.scene.requestRender() }
let fonteGoogle: 'google' | 'ion' | '' = ''
/** Da dove arriva il 3D: Google diretto o Cesium ion (per le prove). */
export const fonte3D = () => fonteGoogle
/** Chiamata quando Google smette di rispondere e si torna al satellite. */
export const quandoGoogleKo = (f: () => void) => { onGoogleKo = f }
/** Chiamata ogni volta che Google ha finito di caricare la vista: le quote lette possono essere cambiate. */
export const quandoGoogle = (f: () => void) => { onGoogle = f }
export async function impostaGoogle(on: boolean, token: string, chiave = ''): Promise<string | null> {
  if (!on) {
    if (google) google.show = false
    viewer.scene.globe.show = true
    return null
  }
  if (!token && !chiave) return 'Serve il codice di accesso gratuito di Cesium ion (Impostazioni)'
  try {
    if (!google) {
      if (token) C.Ion.defaultAccessToken = token
      const v = Q[qAttuale]
      const opzioni: C.Cesium3DTileset.ConstructorOptions = {
        maximumScreenSpaceError: v.sse, cacheBytes: v.cacheMB * 1024 * 1024,
        // meno dettaglio ai bordi e in lontananza, niente tile a vuoto mentre si muove la vista
        foveatedScreenSpaceError: true, dynamicScreenSpaceError: true, preloadFlightDestinations: false, loadSiblings: false,
        enableCollision: false,
        // niente skipLevelOfDetail: con le tessere di Google stira la mesh in strisce lungo la vista (19/11)
      }
      // prima Google diretto con la chiave del sito (uso pubblico gratuito entro la quota, tetto giornaliero nella console Google);
      // se non risponde (quota finita, chiave sbagliata) si prova Cesium ion
      google = undefined
      if (chiave) {
        try { google = await C.createGooglePhotorealistic3DTileset({ key: chiave, onlyUsingWithGoogleGeocoder: true }, opzioni); fonteGoogle = 'google' }
        catch (e) { console.warn('Google diretto non risponde, provo Cesium ion', e) }
      }
      if (!google) {
        if (!token) throw new Error('Google non risponde')
        google = await C.createGooglePhotorealistic3DTileset({ onlyUsingWithGoogleGeocoder: true }, opzioni); fonteGoogle = 'ion'
      }
      // Google ha già le sue ombre nelle foto: riceve solo quelle dei nostri oggetti
      google.shadows = C.ShadowMode.RECEIVE_ONLY
      // «Attenua il 3D»: schiarisce e desatura le foto di Google, così vie e punti si leggono meglio (il 3D resta solido)
      google.customShader = shader3D
      google.allTilesLoaded.addEventListener(() => onGoogle?.())
      // il satellite resta sotto finché Google non ha la prima vista: prima, se Google tardava o falliva, restava tutto blu
      // la schermata d'avvio segue le tessere che mancano e si toglie alla prima vista completa
      google.loadProgress.addEventListener((attesa: number, lavoro: number) => avvio()?.tessere(attesa + lavoro))
      google.initialTilesLoaded.addEventListener(() => avvio()?.fine())
      google.initialTilesLoaded.addEventListener(() => { googlePronto = true; if (google?.show) { viewer.scene.globe.show = false; viewer.scene.requestRender() } })
      // se le tessere di Google falliscono a raffica si torna al satellite (e si riprova al prossimo caricamento)
      let errori: number[] = []
      google.tileFailed.addEventListener(() => {
        const t = performance.now(); errori = [...errori.filter(x => t - x < 15000), t]
        if (errori.length >= 8 && !viewer.scene.globe.show) { viewer.scene.globe.show = true; googlePronto = false; viewer.scene.requestRender(); onGoogleKo?.() }
      })
      google.tileLoad.addEventListener(() => { if (!googlePronto && google?.show && errori.length < 8) { googlePronto = true; viewer.scene.globe.show = false } })
      viewer.scene.primitives.add(google)
    }
    google.show = true
    viewer.scene.globe.show = !googlePronto
    return null
  } catch (e) {
    return 'Google 3D non disponibile: ' + (e instanceof Error ? e.message : String(e))
  }
}
export const googleTileset = () => google
export const googleAcceso = () => !!google && google.show
/** Quota (m s.l.m.) della superficie di Google 3D in un punto, se caricata. Legge solo Google, non i nostri oggetti. */
export function quotaGoogle(lon: number, lat: number): number | undefined {
  if (!google || !google.show) return undefined
  // getHeight a volte lancia un errore interno (punto su una tessera non ancora pronta): vale come «non caricato»
  let h: number | undefined
  try { h = google.getHeight(C.Cartographic.fromDegrees(lon, lat), viewer.scene) } catch { return undefined }
  return h === undefined || !isFinite(h) ? undefined : h - GEOIDE
}

const _w = new C.Cartesian2(), _p = new C.Cartesian3(), _k = new C.Cartographic()
/** Quota (m s.l.m.) del 3D di Google in un punto, letta dal fotogramma già disegnato (profondità del pixel dove il punto
 * cade sullo schermo) invece che dalla mesh: `getHeight` alla prima lettura di ogni tessera ricopia i vertici dalla GPU e
 * blocca la pagina (misurato il 24/11: da 0,15 a 8 s l'una), questa costa centesimi di millisecondo. `z` è la quota
 * presunta: se a quella quota il raggio incontra la superficie altrove si riprova con la quota trovata (due volte).
 * `undefined` se il punto è fuori schermo o coperto (un edificio davanti): lì la quota precisa non serve, non si vede. */
export function quotaVista(lon: number, lat: number, z: number): number | undefined {
  if (!google || !google.show) return undefined
  const sc = viewer.scene, W = sc.canvas.clientWidth, H = sc.canvas.clientHeight
  try {
    for (let i = 0; i < 3; i++) {
      const w = C.SceneTransforms.worldToWindowCoordinates(sc, pos(lon, lat, z), _w)
      if (!w || w.x < 1 || w.y < 1 || w.x > W - 2 || w.y > H - 2) return undefined
      const p = sc.pickPosition(w, _p)
      if (!p) return undefined
      const k = C.Cartographic.fromCartesian(p, undefined, _k)
      if (!k) return undefined
      const h = k.height - GEOIDE
      if (Math.hypot((C.Math.toDegrees(k.longitude) - lon) * 84560, (C.Math.toDegrees(k.latitude) - lat) * 111030) < 1) return h
      if (Math.abs(h - z) < 0.25) return undefined
      z = h
    }
  } catch { /* profondità non disponibile */ }
  return undefined
}

// ---------- nitidezza e colore ----------
let nitido: C.PostProcessStage | undefined
/** Maschera di contrasto leggera più un filo di saturazione e contrasto: le foto aeree di Google sono morbide e slavate. */
export function impostaNitidezza(on: boolean) {
  if (!nitido) {
    nitido = new C.PostProcessStage({
      name: 'posimulatore_nitido',
      fragmentShader: `
        uniform sampler2D colorTexture;
        in vec2 v_textureCoordinates;
        void main() {
          vec2 px = 1.0 / czm_viewport.zw;
          vec3 c = texture(colorTexture, v_textureCoordinates).rgb;
          vec3 b = (texture(colorTexture, v_textureCoordinates + vec2(px.x, 0.0)).rgb + texture(colorTexture, v_textureCoordinates - vec2(px.x, 0.0)).rgb
                  + texture(colorTexture, v_textureCoordinates + vec2(0.0, px.y)).rgb + texture(colorTexture, v_textureCoordinates - vec2(0.0, px.y)).rgb) * 0.25;
          vec3 o = c + (c - b) * 0.55;
          float l = dot(o, vec3(0.299, 0.587, 0.114));
          o = mix(vec3(l), o, 1.12);
          o = (o - 0.5) * 1.05 + 0.5;
          out_FragColor = vec4(clamp(o, 0.0, 1.0), 1.0);
        }`,
    })
    viewer.scene.postProcessStages.add(nitido)
  }
  nitido.enabled = on
  viewer.scene.requestRender()
}

// ---------- sole e ombre ----------
const LUCE_FISSA = new C.DirectionalLight({ direction: new C.Cartesian3(0, 0, -1) })
export function impostaSole(l: Livelli) {
  // senza ombre: luce fissa da sud-ovest, alta, che fa leggere bene le facciate
  if (!l.ombre) {
    const c = C.Cartesian3.fromDegrees(14.4855, 40.6287)
    const enu = C.Transforms.eastNorthUpToFixedFrame(c)
    const d = C.Matrix4.multiplyByPointAsVector(enu, new C.Cartesian3(0.45, 0.55, -0.7), new C.Cartesian3())
    LUCE_FISSA.direction = C.Cartesian3.normalize(d, d)
    viewer.scene.light = LUCE_FISSA
  } else viewer.scene.light = new C.SunLight()
  viewer.shadows = l.ombre
  viewer.terrainShadows = l.ombre ? C.ShadowMode.RECEIVE_ONLY : C.ShadowMode.DISABLED
  const sm = viewer.scene.shadowMap
  sm.softShadows = true
  sm.size = 2048
  sm.maximumDistance = 500
  sm.darkness = 0.45
  // ora locale italiana -> UTC
  const [y, mo, d] = l.giorno.split('-').map(Number)
  const ore = Math.floor(l.ora), min = Math.round((l.ora - ore) * 60)
  const guess = Date.UTC(y, mo - 1, d, ore, min)
  const off = offsetRoma(new Date(guess))
  viewer.clock.currentTime = C.JulianDate.fromDate(new Date(guess - off * 60000))
  viewer.clock.shouldAnimate = false
  viewer.scene.globe.enableLighting = l.ombre
  viewer.scene.requestRender()
}
function offsetRoma(d: Date) {
  const s = d.toLocaleString('en-US', { timeZone: 'Europe/Rome', hour12: false, timeZoneName: 'short' })
  return s.includes('GMT+2') ? 120 : 60
}

/** Scarica la vista come immagine al doppio della risoluzione, con i crediti scritti dentro. */
export function foto(nome: string) {
  const prima = viewer.resolutionScale
  // foto a 2-3 pixel per pixel CSS, qualunque sia lo schermo
  const dpr = window.devicePixelRatio || 1
  viewer.resolutionScale = Math.min(3, Math.max(2, prima * dpr * 2)) / dpr
  viewer.resize()
  viewer.render()
  const src = viewer.canvas
  const out = document.createElement('canvas')
  out.width = src.width; out.height = src.height
  const g = out.getContext('2d')!
  g.drawImage(src, 0, 0)
  viewer.resolutionScale = prima
  viewer.resize()
  viewer.scene.requestRender()
  const t = `${google && google.show ? 'Immagini 3D © Google · ' : ''}Posimulatore · ${nome}`
  const fs = Math.round(out.height / 60)
  g.font = `500 ${fs}px system-ui, sans-serif`
  const w = g.measureText(t).width
  g.fillStyle = 'rgba(16,32,44,0.6)'; g.fillRect(out.width - w - fs * 1.6, out.height - fs * 2, w + fs * 1.6, fs * 2)
  g.fillStyle = '#fff'; g.fillText(t, out.width - w - fs * 0.8, out.height - fs * 0.65)
  const a = document.createElement('a')
  a.href = out.toDataURL('image/jpeg', 0.92)
  a.download = `Posimulatore - ${nome} - ${new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.')}.jpg`
  a.click()
}
