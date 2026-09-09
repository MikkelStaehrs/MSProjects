import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads and writes the session through cookies, so RLS sees the right user.
 */
export async function createClient() {
  const cookieStore = await cookies()

  /*
   * Checked rather than asserted. `!` is a promise to the compiler and not a
   * fact, and the first deployment proved it: the values are baked in when the
   * site is built, so a build made before they were set carries `undefined`.
   * Middleware catches that case first and says so, but a page reached another
   * way should still fail with the name of what is missing rather than with
   * whatever `createServerClient` throws when handed nothing.
   */
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing ' +
        [
          !url && 'NEXT_PUBLIC_SUPABASE_URL',
          !key && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        ]
          .filter(Boolean)
          .join(' and ') +
        '. These are read at build time, so set them and redeploy.',
    )
  }

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component. Middleware refreshes the session instead.
          }
        },
      },
    },
  )
}
