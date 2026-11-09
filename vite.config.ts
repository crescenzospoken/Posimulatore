import { defineConfig, type Plugin } from 'vite'
import { cpSync, existsSync, mkdirSync, symlinkSync } from 'node:fs'
const CESIUM = 'node_modules/cesium/Build/Cesium'
const PARTI = ['Workers', 'ThirdParty', 'Assets', 'Widgets']
/** Copia i file statici di Cesium in /cesium (build) e li espone in sviluppo. */
function cesiumStatico(): Plugin {
  return {
    name: 'cesium-statico',
    buildStart() {
      if (!existsSync('public/cesium')) mkdirSync('public/cesium', { recursive: true })
      for (const d of PARTI) if (!existsSync(`public/cesium/${d}`)) symlinkSync(`../../${CESIUM}/${d}`, `public/cesium/${d}`)
    },
    writeBundle() {
      for (const d of PARTI) cpSync(`${CESIUM}/${d}`, `dist/cesium/${d}`, { recursive: true, dereference: true })
    },
  }
}
export default defineConfig({
  plugins: [cesiumStatico()],
  publicDir: 'public',
  build: { chunkSizeWarningLimit: 6000, sourcemap: false, copyPublicDir: true },
  server: {
    proxy: {
      '/wms/pcn': {
        target: 'http://wms.pcn.minambiente.it',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/wms\/pcn\??/, '/ogc?map=/ms_ogc/WMS_v1.3/raster/ortofoto_colore_12.map&'),
      },
    },
  },
})
