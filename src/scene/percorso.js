import { t as tr } from '../i18n';
import * as C from 'cesium';
import { viewer, pos, quotaGoogle, googleAcceso } from './viewer';
import { quota as quotaTerreno } from './terreno';
import { puntiVia } from './contesto';
import { impostaVoci } from './sovrapposti';
const BLU = C.Color.fromCssColorString('#0a7cff');
let linea;
const zSuolo = (p) => quotaGoogle(p[0], p[1]) ?? quotaTerreno(p[0], p[1]);
/** Disegna il percorso: linea blu alla quota vera della strada, visibile anche dietro gli edifici (più chiara). */
export function disegnaPercorso(r, tappe) {
    if (linea)
        viewer.entities.remove(linea);
    linea = undefined;
    if (r && r.pts.length > 1) {
        linea = viewer.entities.add({
            polyline: {
                positions: puntiVia(r.pts.map(p => [p[0], p[1]]), r.pts.map(p => p[2]), googleAcceso(), 1.6),
                width: 9, arcType: C.ArcType.NONE,
                material: new C.PolylineOutlineMaterialProperty({ color: BLU, outlineColor: C.Color.WHITE, outlineWidth: 2 }),
                depthFailMaterial: new C.ColorMaterialProperty(BLU.withAlpha(0.55)),
            },
        });
    }
    // tappe in HTML sopra la scena (nitide sul telefono): A verde, ultima rossa, intermedie blu con la loro lettera
    impostaVoci('tappa', tappe.map((t, i) => {
        const ultima = i === tappe.length - 1 && i > 0, prima = i === 0;
        return {
            id: 'tappa:' + i, tipo: 'tappa', pos: pos(t.p[0], t.p[1], zSuolo(t.p) + 3),
            testo: String.fromCharCode(65 + i) + ' · ' + (t.nome ?? tr('punto scelto')),
            icona: prima ? 'my_location' : ultima ? 'location_on' : 'route', col: prima ? '#188038' : ultima ? '#c5221f' : '#0b6bcb', scelto: true, maxDist: 1e9,
        };
    }));
    viewer.scene.requestRender();
}
/** Inquadra tutto il percorso dall'alto, un po' inclinato, da sud (dal mare si legge meglio Positano). */
export function inquadraPercorso(r) {
    const bs = C.BoundingSphere.fromPoints(r.pts.map(p => pos(p[0], p[1], p[2])));
    const telefono = matchMedia('(max-width: 760px)').matches;
    // sul telefono la scheda copre la metà bassa: si guarda un punto più a sud, così il percorso sale nella metà alta
    // sul computer la scheda sta a destra: si guarda un po' più a est, così il percorso resta a sinistra
    const g = C.Cartographic.fromCartesian(bs.center);
    if (telefono)
        g.latitude -= (bs.radius * 0.75) / 6371000;
    else
        g.longitude += (bs.radius * 0.45) / (6371000 * Math.cos(g.latitude));
    bs.center = C.Cartographic.toCartesian(g);
    viewer.camera.flyToBoundingSphere(bs, { offset: new C.HeadingPitchRange(C.Math.toRadians(-15), C.Math.toRadians(telefono ? -62 : -55), Math.max(160, bs.radius * (telefono ? 3.9 : 3.4))), duration: 1.6 });
}
