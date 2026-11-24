const { apri, W } = require(process.env.PERF + '/base.cjs')
const OUT = process.env.OUT
;(async () => {
  const { b, p, err } = await apri({ q: '?prova' })
  await p.evaluate(() => { const s = window.__S.getState(); s.setLivelli({ nomi: false, vieDipinte: true }); s.set({ poiCat: [] }) })
  const vista = v => p.evaluate(v => { const V = window.__V, C3 = V.viewer.camera.positionWC.constructor; V.viewer.camera.setView({ destination: C3.fromDegrees(v[0], v[1], v[2]), orientation: { heading: v[4], pitch: v[3], roll: 0 } }); V.viewer.scene.requestRender() }, v)
  const fps = () => p.evaluate(() => new Promise(r => { const s = window.__V.viewer.scene; s.requestRenderMode = false; let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else { s.requestRenderMode = true; r((n / 5).toFixed(2)) } }; requestAnimationFrame(f) }))
  await vista([14.4862, 40.6297, 230, -0.6, 0.3]); await W(35000)
  await p.evaluate(() => window.__V.vieDebug(2)); await W(3000)
  await p.screenshot({ path: OUT + '/dbg-cn.png', timeout: 120000 })
  // A/B costo shader: stessa vista, vie nello shader accese/spente, nessun ridisegno
  for (const on of [true, false, true, false]) { await p.evaluate(on => window.__V.vieNelloShader(on), on); await W(1500); console.log('shader', on, await fps(), 'fps') }
  await p.evaluate(() => window.__V.vieNelloShader(true))
  await vista([14.4880, 40.6275, 120, -0.35, 0.2]); await W(25000)
  await p.screenshot({ path: OUT + '/dbg-basso.png', timeout: 120000 })
  console.log('errori', err.join(' | ').slice(0, 800)); await b.close()
})()
