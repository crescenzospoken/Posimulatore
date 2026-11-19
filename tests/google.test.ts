import { describe, it, expect, vi, beforeAll } from 'vitest'
import { verificaGoogle } from '../worker/google'

const b64u = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64url')
let chiavi: CryptoKeyPair, pub: JsonWebKey
async function firma(dati: object, kid = 'k1') {
  const h = b64u(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid })))
  const p = b64u(new TextEncoder().encode(JSON.stringify(dati)))
  const f = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chiavi.privateKey, new TextEncoder().encode(h + '.' + p))
  return `${h}.${p}.${b64u(f)}`
}
const buono = () => ({ iss: 'https://accounts.google.com', aud: 'cid', exp: Math.floor(Date.now() / 1000) + 600, email: 'Tu@Esempio.it', email_verified: true, name: 'Tu' })

describe('accesso con Google', () => {
  beforeAll(async () => {
    chiavi = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair
    pub = await crypto.subtle.exportKey('jwk', chiavi.publicKey)
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ keys: [{ ...pub, kid: 'k1', alg: 'RS256' }] })))
  })
  it('accetta un token valido', async () => { expect(await verificaGoogle(await firma(buono()), 'cid')).toEqual({ email: 'tu@esempio.it', nome: 'Tu' }) })
  it('rifiuta un altro client ID', async () => { expect(await verificaGoogle(await firma(buono()), 'altro')).toBeNull() })
  it('rifiuta un token scaduto', async () => { expect(await verificaGoogle(await firma({ ...buono(), exp: 1 }), 'cid')).toBeNull() })
  it('rifiuta email non verificata', async () => { expect(await verificaGoogle(await firma({ ...buono(), email_verified: false }), 'cid')).toBeNull() })
  it('rifiuta un altro emittente', async () => { expect(await verificaGoogle(await firma({ ...buono(), iss: 'evil.com' }), 'cid')).toBeNull() })
  it('rifiuta una firma manomessa', async () => {
    const t = (await firma(buono())).split('.'); t[1] = b64u(new TextEncoder().encode(JSON.stringify({ ...buono(), email: 'admin@esempio.it' })))
    expect(await verificaGoogle(t.join('.'), 'cid')).toBeNull()
  })
})
