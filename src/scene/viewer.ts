import * as C from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { GEOIDE, caricaTerreno } from './terreno'
import type { Livelli } from '../store'
import type { Vista } from '../engine/model'

;(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = '/cesium/'
export let viewer: C.Viewer
export const VAI: { nome: string; lon: number; lat: number; h: number; heading: number; pitch: number }[] = [
  { nome: 'Tutta Positano', lon: 14.4835, lat: 40.6085, h: 1500, heading: 0, pitch: -32 },
  { nome: 'Bivio di Chiesa Nuova', lon: 14.48335, lat: 40.62935, h: 222, heading: 262, pitch: -38 },
  { nome: 'Spiaggia Grande e Collegiata', lon: 14.4852, lat: 40.6248, h: 160, heading: 0, pitch: -25 },
  { nome: 'La Sponda', lon: 14.4905, lat: 40.6250, h: 200, heading: -10, pitch: -35 },
  { nome: 'Fornillo', lon: 14.4795, lat: 40.6235, h: 140, heading: 10, pitch: -28 },
  { nome: 'Montepertuso', lon: 14.4925, lat: 40.6290, h: 520, heading: 5, pitch: -35 },
  { nome: 'Nocelle', lon: 14.5030, lat: 40.6262, h: 600, heading: 0, pitch: -35 },
  { nome: 'Laurito', lon: 14.5050, lat: 40.6205, h: 160, heading: 0, pitch: -25 },
  { nome: 'Li Galli', lon: 14.4330, lat: 40.5740, h: 250, heading: 0, pitch: -25 },
]
export const pos = (lon: number, lat: number, z: number) => C.Cartesian3.fromDegrees(lon, lat, z + GEOIDE)

export async function creaViewer(el: HTMLElement, onReady?: () => void) {
  const terrainProvider = await caricaTerreno()
  viewer = new C.Viewer(el, {
    terrainProvider,
    baseLayer: false,
    animation: false, timeline: false, geocoder: false, homeButton: false, sceneModePicker: false,
    baseLayerPicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false, scene3DOnly: true, shadows: false,
    contextOptions: { webgl: { preserveDrawingBuffer: true } },
    msaaSamples: 1,
    requestRenderMode: true,
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
  s.screenSpaceCameraController.minimumZoomDistance = 2
  s.screenSpaceCameraController.maximumZoomDistance = 60000
  s.postProcessStages.fxaa.enabled = true
  viewer.resolutionScale = new URLSearchParams(location.search).get('prova') === '' ? 0.6 : Math.min(window.devicePixelRatio || 1, 1.5)
  // il terreno e le immagini che arrivano chiedono un nuovo disegno
  s.globe.tileLoadProgressEvent.addEventListener(() => s.requestRender())
  ;(viewer.cesiumWidget.creditContainer as HTMLElement).classList.add('crediti')
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
let strato: C.ImageryLayer | undefined
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
  } else {
    prov = new C.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/', maximumLevel: 19, credit: '© OpenStreetMap contributors' } as C.OpenStreetMapImageryProvider.ConstructorOptions)
  }
  strato = viewer.imageryLayers.addImageryProvider(prov, 0)
  // sotto l'ortofoto, fuori dall'Italia o mentre carica: satellite a bassa risoluzione
  viewer.scene.requestRender()
}

// ---------- Google 3D (via Cesium ion, gratuito, solo da guardare) ----------
let google: C.Cesium3DTileset | undefined
let onGoogle: (() => void) | undefined
/** Chiamata ogni volta che Google ha finito di caricare la vista: le quote lette possono essere cambiate. */
export const quandoGoogle = (f: () => void) => { onGoogle = f }
export async function impostaGoogle(on: boolean, token: string): Promise<string | null> {
  if (!on) {
    if (google) google.show = false
    viewer.scene.globe.show = true
    return null
  }
  if (!token) return 'Serve il codice di accesso gratuito di Cesium ion (Impostazioni)'
  try {
    if (!google) {
      C.Ion.defaultAccessToken = token
      google = await C.createGooglePhotorealistic3DTileset(undefined, { maximumScreenSpaceError: matchMedia('(max-width: 760px)').matches ? 8 : 4, enableCollision: true })
      // Google ha già le sue ombre nelle foto: riceve solo quelle dei nostri oggetti
      google.shadows = C.ShadowMode.RECEIVE_ONLY
      google.allTilesLoaded.addEventListener(() => onGoogle?.())
      viewer.scene.primitives.add(google)
    }
    google.show = true
    viewer.scene.globe.show = false
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
  const h = google.getHeight(C.Cartographic.fromDegrees(lon, lat), viewer.scene)
  return h === undefined ? undefined : h - GEOIDE
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
  viewer.resolutionScale = Math.min(3, Math.max(2, prima * 2))
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
