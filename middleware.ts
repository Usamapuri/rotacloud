import { NextResponse } from 'next/server'

export function middleware(request: Request) {
  const url = new URL(request.url)
  const path = url.pathname || ''

  if (
    path.startsWith('/team-lead') ||
    path.startsWith('/project-manager') ||
    path.startsWith('/api/team-lead') ||
    path.startsWith('/api/project-manager')
  ) {
    return new NextResponse('Gone', { status: 410 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}


