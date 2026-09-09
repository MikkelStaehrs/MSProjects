'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { back, required, text } from '@/lib/form'
import type { DecisionTopic } from '@/lib/types'

export async function createDecision(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('decision').insert({
    node_id: required(fd, 'node_id'),
    decided_on: text(fd, 'decided_on') ?? undefined,
    decision: required(fd, 'decision'),
    rationale: text(fd, 'rationale'),
    alternatives: text(fd, 'alternatives'),
    topic: (text(fd, 'topic') ?? 'other') as DecisionTopic,
  })

  if (error) throw new Error(`Could not save decision: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}

export async function updateDecision(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('decision')
    .update({
      decided_on: required(fd, 'decided_on'),
      decision: required(fd, 'decision'),
      rationale: text(fd, 'rationale'),
      alternatives: text(fd, 'alternatives'),
      topic: (text(fd, 'topic') ?? 'other') as DecisionTopic,
    })
    .eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not save decision: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}

export async function deleteDecision(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('decision').delete().eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not delete decision: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}
