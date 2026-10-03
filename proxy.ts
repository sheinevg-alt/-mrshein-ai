import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase()
  const isBananaZero = host === 'bananazero.ru' || host === 'www.bananazero.ru'
  const isVercelAlias = Boolean(host?.endsWith('.vercel.app'))

  if (isVercelAlias && (request.method === 'GET' || request.method === 'HEAD') && !request.nextUrl.pathname.startsWith('/api/')) {
    const url = request.nextUrl.clone()
    url.protocol = 'https'
    url.host = 'bananazero.ru'
    if (url.pathname === '/') url.pathname = '/app'
    return NextResponse.redirect(url, 307)
  }

  if (isBananaZero && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/site'
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/:path*'],
}
