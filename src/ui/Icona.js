import { jsx as _jsx } from "react/jsx-runtime";
import { svgIcona } from './icone';
/** Icona Material in linea: prende colore e dimensione dal testo intorno (1em). */
export function Icona({ n, className }) {
    return _jsx("span", { className: 'icona-m' + (className ? ' ' + className : ''), dangerouslySetInnerHTML: { __html: svgIcona(n) } });
}
