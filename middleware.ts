import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Nothing here is allowed to crash.
 *
 * Middleware runs ahead of every page, so an exception in it does not break one
 * route, it answers every URL on the site with Vercel's own blank
 * MIDDLEWARE_INVOCATION_FAILED page. That page carries a request id and nothing
 * else: not the exception, not the file, not a hint. Two deployments were spent
 * guessing at a cause that the process already knew.
 *
 * So the whole thing is wrapped. Whatever goes wrong, the visitor gets the
 * message rather than a request id, and the request is refused rather than
 * waved through: a session that could not be checked has not been checked.
 *
 * The message only, never the stack. This page is reachable before anyone logs
 * in, and a stack trace names paths and internals that a login form should not
 * hand out.
 */
export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return new NextResponse(
      `<!doctype html><meta charset="utf-8">` +
        `<title>The gate in front of this site failed</title>` +
        `<style>body{font:15px/1.6 system-ui,sans-serif;margin:12vh auto;` +
        `max-width:36rem;padding:0 1.5rem;color:#1a1a1a}` +
        `h1{font-size:1.15rem;margin:0 0 .75rem}p{margin:.75rem 0}` +
        `pre{background:#f0efec;padding:.75rem;overflow-x:auto;` +
        `white-space:pre-wrap;font-size:13px}</style>` +
        `<h1>The gate in front of this site failed</h1>` +
        `<p>Every page sits behind a session check, and the check itself threw. ` +
        `Nothing has been lost and nothing has been let through.</p>` +
        `<pre>${escapeHtml(message)}</pre>`,
      { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } },
    )
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
