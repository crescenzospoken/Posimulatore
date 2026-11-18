import { svgIcona, type NomeIcona } from './icone'

/** Icona Material in linea: prende colore e dimensione dal testo intorno (1em). */
export function Icona({ n, className }: { n: NomeIcona; className?: string }) {
  return <span className={'icona-m' + (className ? ' ' + className : '')} dangerouslySetInnerHTML={{ __html: svgIcona(n) }} />
}
