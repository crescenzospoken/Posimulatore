// Accesso con Google (Google Identity Services): il browser riceve un ID token firmato da Google, qui si controlla
// firma (chiavi pubbliche di Google), destinatario (il nostro client ID), emittente, scadenza ed email verificata.
type JwkG = JsonWebKey & { kid: string }
export const b64url = (x: string) => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (x.length % 4)) % 4)), c => c.charCodeAt(0))
async function chiaviGoogle(): Promise<JwkG[]> {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit)
  return ((await r.json()) as { keys: JwkG[] }).keys
}
export async function verificaGoogle(token: string, clientId: string): Promise<{ email: string; nome: string } | null> {
  const [h, p, f] = token.split('.')
  if (!h || !p || !f) return null
  const testa = JSON.parse(new TextDecoder().decode(b64url(h))) as { kid?: string; alg?: string }
  if (testa.alg !== 'RS256') return null
  const jwk = (await chiaviGoogle()).find(k => k.kid === testa.kid)
  if (!jwk) return null
  const k = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', k, b64url(f), new TextEncoder().encode(h + '.' + p)))) return null
  const c = JSON.parse(new TextDecoder().decode(b64url(p))) as { iss?: string; aud?: string; exp?: number; email?: string; email_verified?: boolean; name?: string }
  if (c.iss !== 'accounts.google.com' && c.iss !== 'https://accounts.google.com') return null
  if (c.aud !== clientId || !c.exp || c.exp * 1000 < Date.now() || !c.email || c.email_verified !== true) return null
  return { email: c.email.toLowerCase(), nome: (c.name ?? c.email.split('@')[0]).slice(0, 60) }
}
