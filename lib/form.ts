import { redirect } from 'next/navigation'

/**
 * Reading form data. These four lived in nine server action files in nine
 * identical copies; a change to one of them was a change nobody made to the
 * other eight.
 *
 * Plain module, not 'use server': a server action file may only export async
 * functions, so shared helpers cannot live in one.
 */

/** An empty string is not a value. It is an empty field. */
export function text(fd: FormData, key: string): string | null {
  const value = String(fd.get(key) ?? '').trim()
  return value === '' ? null : value
}

export function required(fd: FormData, key: string): string {
  const value = text(fd, key)
  if (value === null) throw new Error(`The field "${key}" is required.`)
  return value
}

/** A number written with a comma is still a number. */
export function number(fd: FormData, key: string): number | null {
  const raw = text(fd, key)
  if (raw === null) return null
  const parsed = Number(raw.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/** Back to where the form was submitted from. */
export function back(fd: FormData): never {
  redirect(String(fd.get('redirectTo') ?? '/'))
}
