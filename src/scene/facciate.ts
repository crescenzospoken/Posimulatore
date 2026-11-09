import * as C from 'cesium'
/**
 * Aspetto degli edifici: facciate generate (intonaco, finestre con persiane, piani ogni 3 m) e tetti a terrazza.
 * Coordinate relative a un'origine vicina a Positano, così il disegno non "nuota" per la precisione in float.
 */
export function aspettoFacciate(lon0: number, lat0: number) {
  const o = C.Cartesian3.fromDegrees(lon0, lat0, 0)
  // stessa codifica alta/bassa che Cesium usa per position3DHigh/Low
  const enc = (v: number) => { const h = v >= 0 ? Math.floor(v / 65536) * 65536 : -Math.floor(-v / 65536) * 65536; return [h, v - h] }
  const ex = enc(o.x), ey = enc(o.y), ez = enc(o.z)
  const e = { high: new C.Cartesian3(ex[0], ey[0], ez[0]), low: new C.Cartesian3(ex[1], ey[1], ez[1]) }
  const up = C.Cartesian3.normalize(o, new C.Cartesian3())
  const f = (v: number) => v.toFixed(6)
  const v3 = (c: C.Cartesian3) => `vec3(${f(c.x)}, ${f(c.y)}, ${f(c.z)})`
  const vs = `
in vec3 position3DHigh;
in vec3 position3DLow;
in vec3 normal;
in float batchId;
// colore e quota del tetto (i piani si contano dall'alto) arrivano dagli attributi di istanza
out vec3 v_positionEC;
out vec3 v_normalEC;
out vec4 v_color;
out vec3 v_rel;
out vec3 v_nrm;
out float v_base;
const vec3 O_HIGH = ${v3(e.high)};
const vec3 O_LOW = ${v3(e.low)};
void main() {
  vec4 p = czm_computePosition();
  v_positionEC = (czm_modelViewRelativeToEye * p).xyz;
  v_normalEC = czm_normal * normal;
  v_color = czm_batchTable_color(batchId);
  v_rel = (position3DHigh - O_HIGH) + (position3DLow - O_LOW);
  v_nrm = normal;
  v_base = czm_batchTable_base(batchId);
  gl_Position = czm_modelViewProjectionRelativeToEye * p;
}`
  const fs = `
in vec3 v_positionEC;
in vec3 v_normalEC;
in vec4 v_color;
in vec3 v_rel;
in vec3 v_nrm;
in float v_base;
const vec3 UP = ${v3(up)};
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 n = normalize(v_nrm);
  float su = dot(n, UP);
  vec3 col = v_color.rgb;
  float h = dot(v_rel, UP) - v_base;
  if (su > 0.6) {
    // terrazza: intonaco chiaro con bordo e un po' di grana
    float g = h1(floor(v_rel.xy * 1.5));
    col = mix(vec3(0.97, 0.95, 0.91), col, 0.2) * (0.95 + 0.05 * g);
  } else {
    vec3 t = normalize(cross(UP, n));
    float s = dot(v_rel, t);
    float piano = floor(h / 3.0);
    float fy = fract(h / 3.0);
    float cella = floor(s / 3.2);
    float fx = fract(s / 3.2);
    float r = h1(vec2(cella, piano) + floor(v_base));
    bool fin = fx > 0.33 && fx < 0.67 && fy > 0.28 && fy < 0.78 && h < -0.6 && r > 0.4;
    // zoccolo più scuro e cornice sotto la terrazza
    if (h > -0.35) col *= 0.9; // cornicione
    if (fin) {
      bool chiusa = r > 0.62;
      vec3 persiana = mix(vec3(0.22, 0.38, 0.28), vec3(0.18, 0.33, 0.45), step(0.9, r));
      if (chiusa) {
        col = persiana * (0.85 + 0.15 * step(0.5, fract(fy * 14.0)));
      } else {
        float ante = step(fx, 0.37) + step(0.63, fx);
        col = ante > 0.5 ? persiana : vec3(0.10, 0.12, 0.14);
      }
    } else {
      col *= 0.96 + 0.04 * h1(floor(vec2(s, h) * 2.0));
    }
  }
  vec3 nEC = normalize(v_normalEC);
  float luce = max(dot(nEC, normalize(czm_lightDirectionEC)), 0.0);
  vec3 c = su > 0.6 ? col * (0.78 + 0.3 * luce) : col * (0.55 + 0.55 * luce);
  out_FragColor = vec4(c, v_color.a);
}`
  return new C.Appearance({
    renderState: { depthTest: { enabled: true }, cull: { enabled: true, face: C.CullFace.BACK } },
    vertexShaderSource: vs,
    fragmentShaderSource: fs,
    translucent: false,
    closed: true,
  } as unknown as ConstructorParameters<typeof C.Appearance>[0])
}
