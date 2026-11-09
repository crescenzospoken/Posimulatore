import * as C from 'cesium'
/**
 * Aspetto degli edifici alla positanese: intonaco bianco o pastello, poche aperture grandi ad arco
 * (portefinestre con persiane verdi, ringhiere), logge ad archi in alto, terrazze chiare, qualche tetto in cotto.
 * Coordinate relative a un'origine vicina a Positano, così il disegno non "nuota" per la precisione in float.
 */
export function aspettoFacciate(lon0: number, lat0: number, plastico = false) {
  const o = C.Cartesian3.fromDegrees(lon0, lat0, 0)
  // stessa codifica alta/bassa che Cesium usa per position3DHigh/Low
  const enc = (v: number) => { const h = v >= 0 ? Math.floor(v / 65536) * 65536 : -Math.floor(-v / 65536) * 65536; return [h, v - h] }
  const ex = enc(o.x), ey = enc(o.y), ez = enc(o.z)
  const up = C.Cartesian3.normalize(o, new C.Cartesian3())
  const f = (v: number) => v.toFixed(6)
  const v3 = (x: number, y: number, z: number) => `vec3(${f(x)}, ${f(y)}, ${f(z)})`
  const vs = `
in vec3 position3DHigh;
in vec3 position3DLow;
in vec3 normal;
in float batchId;
out vec3 v_positionEC;
out vec3 v_normalEC;
out vec4 v_color;
out vec3 v_rel;
out vec3 v_nrm;
out float v_base;
const vec3 O_HIGH = ${v3(ex[0], ey[0], ez[0])};
const vec3 O_LOW = ${v3(ex[1], ey[1], ez[1])};
void main() {
  vec4 p = czm_computePosition();
  v_positionEC = (czm_modelViewRelativeToEye * p).xyz;
  v_normalEC = czm_normal * normal;
  v_color = czm_batchTable_color(batchId);
  v_rel = (position3DHigh - O_HIGH) + (position3DLow - O_LOW);
  v_nrm = normal;
  v_base = czm_batchTable_base(batchId); // quota del tetto: i piani si contano dall'alto
  gl_Position = czm_modelViewProjectionRelativeToEye * p;
}`
  const fs = `
in vec3 v_positionEC;
in vec3 v_normalEC;
in vec4 v_color;
in vec3 v_rel;
in vec3 v_nrm;
in float v_base;
const vec3 UP = ${v3(up.x, up.y, up.z)};
const bool PLASTICO = ${plastico ? 'true' : 'false'};
const vec3 VERDE = vec3(0.24, 0.42, 0.33);
const vec3 VETRO = vec3(0.16, 0.18, 0.2);
const vec3 FERRO = vec3(0.12, 0.13, 0.13);
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 n = normalize(v_nrm);
  float su = dot(n, UP);
  vec3 muro = v_color.rgb;
  vec3 col = muro;
  float idb = floor(v_base * 3.7);           // identità dell'edificio
  float sb = h1(vec2(idb, 7.0));
  if (su > 0.6) {
    // terrazze bianche; un edificio su sette ha il tetto in cotto
    col = sb > 0.92 ? vec3(0.78, 0.45, 0.32) : vec3(0.96, 0.95, 0.92);
  } else if (PLASTICO) {
    // plastico: parete liscia, appena più scura verso il basso e una cornice sotto la terrazza
    float h = dot(v_rel, UP) - v_base;
    col = muro * (h > -0.25 ? 0.9 : 1.0) * (0.94 + 0.06 * clamp(1.0 + h / 12.0, 0.0, 1.0));
  } else {
    float h = dot(v_rel, UP) - v_base;       // negativo: metri sotto il tetto
    vec3 t = normalize(cross(UP, n));
    float s = dot(v_rel, t);
    float passo = 3.6 + 1.2 * sb;            // passo diverso per ogni casa
    float piano = floor(-h / 3.1);
    float y = 3.1 - mod(-h, 3.1);            // 0 = pavimento del piano, 3,1 = soffitto
    float cella = floor(s / passo);
    float dx = (fract(s / passo) - 0.5) * passo;
    float r = h1(vec2(cella, piano) + idb);
    // parapetto della terrazza in cima: fascia piena
    if (h > -1.0) {
      col = muro * 1.02;
    } else if (piano == 0.0 && sb > 0.78 && abs(dx) < passo * 0.42 && y > 0.0 && y < 2.6 + 0.0) {
      // loggia ad archi all'ultimo piano
      float w = passo * 0.42;
      float a = 1.7 + sqrt(max(0.0, w * w - dx * dx)) * 0.55;
      col = y < a ? mix(vec3(0.55, 0.5, 0.45), muro, 0.45) : muro;
      if (y < 1.0 && y > 0.92) col = FERRO;
    } else if (r > 0.22) {
      // portafinestra grande ad arco (1,5 x 2,6 m), persiane verdi, spesso con balcone in ferro
      float w = 0.75;
      float imp = 1.95;                              // imposta dell'arco
      float top = imp + sqrt(max(0.0, w * w - dx * dx));
      bool foro = abs(dx) < w && y > 0.12 && y < top;
      bool ante = abs(dx) >= w && abs(dx) < w * 1.9 && y > 0.12 && y < imp + 0.35;
      bool balcone = r > 0.45;
      float bw = 1.55;                               // mezzo balcone
      if (foro) {
        col = r > 0.85 ? VERDE * (0.9 + 0.1 * step(0.5, fract(y * 8.0))) : VETRO * (0.8 + 0.4 * y / top);
      } else if (ante && r <= 0.85) {
        col = VERDE * (0.92 + 0.08 * step(0.5, fract(y * 8.0)));
      } else if (abs(dx) < w + 0.16 && y >= top && y < top + 0.16) {
        col = muro * 1.07;                           // cornice dell'arco
      }
      if (balcone && abs(dx) < bw) {
        // soletta e ombra del balcone
        if (y < 0.12) col = muro * 0.62;
        else if (y < 0.32 && !foro) col = mix(col, muro * 0.78, 0.6);
        // ringhiera: corrimano, traverso basso e bacchette verticali
        float bar = step(0.85, fract((dx + bw) / 0.12));
        if ((y > 1.0 && y < 1.07) || (y > 0.14 && y < 0.19)) col = FERRO;
        else if (y > 0.19 && y < 1.0 && bar > 0.5) col = mix(col, FERRO, 0.85);
      } else if (!balcone && foro && y > 0.95 && y < 1.02) {
        col = FERRO;                                 // parapetto alla francese
      }
    }
    // zoccolo e ombra sotto il cornicione
    if (h > -1.15 && h < -1.0) col *= 0.82;
  }
  vec3 nEC = normalize(v_normalEC);
  float luce = max(dot(nEC, normalize(czm_lightDirectionEC)), 0.0);
  vec3 c = su > 0.6 ? col * (0.86 + 0.18 * luce) : col * (0.68 + 0.42 * luce);
  out_FragColor = vec4(min(c, vec3(1.0)), v_color.a);
}`
  return new C.Appearance({
    renderState: { depthTest: { enabled: true }, cull: { enabled: true, face: C.CullFace.BACK } },
    vertexShaderSource: vs,
    fragmentShaderSource: fs,
    translucent: false,
    closed: true,
  } as unknown as ConstructorParameters<typeof C.Appearance>[0])
}
