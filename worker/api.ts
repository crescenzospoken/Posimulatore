// API di Posimulatore: registrazione e accesso, punti di interesse, impostazioni per tutti, utenti.
// Ruoli: 'attesa' (registrato, non ancora abilitato), 'editor' (modifica e punti di interesse), 'admin' (anche utenti e impostazioni).
import type { Env } from './index'

type Utente = { email: string; nome: string; ruolo: 'attesa' | 'editor' | 'admin' }
const GIORNI = 30
const CATEGORIE = new Set(['bagni', 'fermate', 'biglietti', 'traghetti', 'taxi', 'parcheggi', 'bar', 'ristoranti', 'farmacie', 'salute', 'bancomat', 'acqua', 'info', 'alimentari', 'spiagge', 'panorami', 'chiese', 'sicurezza', 'altro'])
const IMPOSTAZIONI = new Set(['coloriVie'])

const json = (d: unknown, status = 200, h: Record<string, string> = {}) => Response.json(d, { status, headers: { 'Cache-Control': 'no-store', ...h } })
const errore = (t: string, status = 400) => json({ errore: t }, status)
const b64 = (a: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(a)))
const casuale = (n: number) => b64(crypto.getRandomValues(new Uint8Array(n))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' })[c]!)

async function impronta(password: string, sale: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(sale), iterations: 100000 }, k, 256)
  return b64(bits)
}
const uguali = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0 }

function cookie(req: Request, nome: string) {
  for (const c of (req.headers.get('Cookie') ?? '').split(';')) { const [k, ...v] = c.trim().split('='); if (k === nome) return v.join('=') }
  return null
}
const cookieSessione = (token: string, maxAge: number) => `ps=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`

async function chiSei(req: Request, env: Env): Promise<Utente | null> {
  const t = cookie(req, 'ps')
  if (!t) return null
  return await env.DB.prepare('SELECT u.email, u.nome, u.ruolo FROM sessioni s JOIN utenti u ON u.email = s.email WHERE s.token = ? AND s.scade > ?').bind(t, Date.now()).first<Utente>()
}
async function nuovaSessione(env: Env, email: string) {
  const token = casuale(32)
  await env.DB.prepare('INSERT INTO sessioni (token, email, scade) VALUES (?, ?, ?)').bind(token, email, Date.now() + GIORNI * 864e5).run()
  return token
}
const corpo = async <T>(req: Request): Promise<T | null> => { try { return (await req.json()) as T } catch { return null } }

export async function api(req: Request, url: URL, env: Env): Promise<Response> {
  const via = url.pathname.slice(5).split('/').map(decodeURIComponent)
  const m = req.method
  // le scritture arrivano solo dalla nostra pagina: JSON e intestazione propria (contro i moduli di altri siti)
  if (m !== 'GET' && req.headers.get('X-Posimulatore') !== '1') return errore('Richiesta non valida', 403)
  const io = await chiSei(req, env)
  const puoModificare = io?.ruolo === 'editor' || io?.ruolo === 'admin'

  if (via[0] === 'io' && m === 'GET') return json(io)

  if (via[0] === 'registrati' && m === 'POST') {
    const b = await corpo<{ email?: string; nome?: string; password?: string }>(req)
    const email = (b?.email ?? '').trim().toLowerCase(), nome = (b?.nome ?? '').trim().slice(0, 60), pw = b?.password ?? ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return errore('Email non valida')
    if (!nome) return errore('Scrivi il tuo nome')
    if (pw.length < 8) return errore('La password deve avere almeno 8 caratteri')
    if (await env.DB.prepare('SELECT 1 FROM utenti WHERE email = ?').bind(email).first()) return errore('Questa email è già registrata: accedi', 409)
    const sale = casuale(16)
    const ruolo = env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.trim().toLowerCase() ? 'admin' : 'attesa'
    await env.DB.prepare('INSERT INTO utenti (email, nome, hash, sale, ruolo, creato) VALUES (?, ?, ?, ?, ?, ?)').bind(email, nome, await impronta(pw, sale), sale, ruolo, new Date().toISOString()).run()
    const t = await nuovaSessione(env, email)
    return json({ email, nome, ruolo }, 200, { 'Set-Cookie': cookieSessione(t, GIORNI * 86400) })
  }
  if (via[0] === 'accedi' && m === 'POST') {
    const b = await corpo<{ email?: string; password?: string }>(req)
    const email = (b?.email ?? '').trim().toLowerCase()
    const u = await env.DB.prepare('SELECT email, nome, ruolo, hash, sale FROM utenti WHERE email = ?').bind(email).first<Utente & { hash: string; sale: string }>()
    // stesso tempo e stesso messaggio se l'email non esiste: non si scopre chi è registrato
    const h = await impronta(b?.password ?? '', u?.sale ?? 'nessuno')
    if (!u || !uguali(h, u.hash)) return errore('Email o password sbagliate', 401)
    const t = await nuovaSessione(env, email)
    return json({ email: u.email, nome: u.nome, ruolo: u.ruolo }, 200, { 'Set-Cookie': cookieSessione(t, GIORNI * 86400) })
  }
  if (via[0] === 'esci' && m === 'POST') {
    const t = cookie(req, 'ps')
    if (t) await env.DB.prepare('DELETE FROM sessioni WHERE token = ?').bind(t).run()
    return json({ ok: true }, 200, { 'Set-Cookie': cookieSessione('', 0) })
  }

  // punti di interesse: tutti leggono, gli editor scrivono
  if (via[0] === 'poi') {
    if (m === 'GET') {
      const r = await env.DB.prepare('SELECT id, c, n, lon, lat, note, nascosto, aggiornato FROM poi').all()
      return json(r.results, 200, { 'Cache-Control': 'public, max-age=30' })
    }
    if (!puoModificare) return errore('Serve un account abilitato alla modifica', 403)
    const id = via[1]
    if (!id || id.length > 80) return errore('Punto non valido')
    if (m === 'DELETE') { await env.DB.prepare('DELETE FROM poi WHERE id = ?').bind(id).run(); return json({ ok: true }) }
    if (m === 'PUT') {
      const b = await corpo<{ c?: string; n?: string; lon?: number; lat?: number; note?: string; nascosto?: boolean }>(req)
      if (!b || !CATEGORIE.has(b.c ?? '')) return errore('Categoria non valida')
      const lon = Number(b.lon), lat = Number(b.lat)
      if (!(Math.abs(lon - 14.48) < 0.1 && Math.abs(lat - 40.62) < 0.08)) return errore('Il punto deve essere a Positano')
      await env.DB.prepare('INSERT INTO poi (id, c, n, lon, lat, note, nascosto, autore, aggiornato) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET c = excluded.c, n = excluded.n, lon = excluded.lon, lat = excluded.lat, note = excluded.note, nascosto = excluded.nascosto, autore = excluded.autore, aggiornato = excluded.aggiornato')
        .bind(id, b.c, (b.n ?? '').trim().slice(0, 80) || null, lon, lat, (b.note ?? '').trim().slice(0, 400) || null, b.nascosto ? 1 : 0, io!.email, new Date().toISOString()).run()
      return json({ ok: true })
    }
  }

  // impostazioni per tutti (colori di base delle vie): tutti leggono, l'amministratore scrive
  if (via[0] === 'impostazioni') {
    if (m === 'GET') {
      const r = await env.DB.prepare('SELECT k, v FROM impostazioni').all<{ k: string; v: string }>()
      return json(Object.fromEntries(r.results.map(x => [x.k, JSON.parse(x.v)])), 200, { 'Cache-Control': 'public, max-age=30' })
    }
    if (io?.ruolo !== 'admin') return errore('Solo l\'amministratore', 403)
    const k = via[1]
    if (m === 'PUT' && IMPOSTAZIONI.has(k)) {
      const b = await corpo<{ v: unknown }>(req)
      const v = JSON.stringify(b?.v ?? null)
      if (v.length > 4000) return errore('Troppo grande')
      await env.DB.prepare('INSERT INTO impostazioni (k, v, autore, aggiornato) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, autore = excluded.autore, aggiornato = excluded.aggiornato').bind(k, v, io.email, new Date().toISOString()).run()
      return json({ ok: true })
    }
  }

  // utenti: solo l'amministratore
  if (via[0] === 'utenti') {
    if (io?.ruolo !== 'admin') return errore('Solo l\'amministratore', 403)
    if (m === 'GET') return json((await env.DB.prepare('SELECT email, nome, ruolo, creato FROM utenti ORDER BY creato DESC').all()).results)
    const email = (via[1] ?? '').toLowerCase()
    if (email === io.email) return errore('Non puoi cambiare il tuo ruolo')
    if (m === 'PUT') {
      const b = await corpo<{ ruolo?: string }>(req)
      if (!['attesa', 'editor', 'admin'].includes(b?.ruolo ?? '')) return errore('Ruolo non valido')
      await env.DB.prepare('UPDATE utenti SET ruolo = ? WHERE email = ?').bind(b!.ruolo, email).run()
      return json({ ok: true })
    }
    if (m === 'DELETE') {
      await env.DB.batch([env.DB.prepare('DELETE FROM sessioni WHERE email = ?').bind(email), env.DB.prepare('DELETE FROM utenti WHERE email = ?').bind(email)])
      return json({ ok: true })
    }
  }
  return errore('Non trovato', 404)
}
