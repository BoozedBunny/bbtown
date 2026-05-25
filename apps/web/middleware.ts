import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const currentUser = request.cookies.get('bbtown_session')?.value
  const pathname = request.nextUrl.pathname

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/about' ||
    pathname.startsWith('/about/')

  if (isPublicRoute) {
    return NextResponse.next()
  }

  if (!currentUser) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|media).*)'
  ],
}
