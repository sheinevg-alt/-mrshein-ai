import 'server-only'

export function requireAdmin(request: Request) {
  const expected = process.env.MRSHEIN_ADMIN_SECRET
  if (!expected) return false
  const auth = request.headers.get('authorization') || ''
  return auth === `Bearer ${expected}`
}
