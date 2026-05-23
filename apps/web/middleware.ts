import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const currentUser = request.cookies.get('mock_user')?.value || request.cookies.get('bbtown_session')?.value
  const pathname = request.nextUrl.pathname

  if (pathname === '/' || pathname === '/login') {
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
