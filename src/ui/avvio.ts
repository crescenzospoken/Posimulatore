// Schermata d'avvio (index.html): le fasi vere del caricamento la fanno avanzare; sparisce da sola alla prima vista di Google.
type Avvio = { fase: (k: 'terreno' | 'vie' | 'foto') => void; tessere: (n: number) => void; fine: () => void }
export const avvio = () => (window as unknown as { __avvio?: Avvio }).__avvio
