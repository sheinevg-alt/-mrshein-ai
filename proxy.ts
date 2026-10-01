import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase()
  const isBananaZero = host === 'bananazero.ru' || host === 'www.bananazero.ru'

  if (isBananaZero && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/site'
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}
