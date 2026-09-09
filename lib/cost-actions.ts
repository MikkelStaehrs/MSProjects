'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { back, number, required, text } from '@/lib/form'
import { storeFile } from '@/lib/document-store'
import type {
  CostBudget,
  CostCurrency,
  CostKind,
  CostRecurrence,
  CostState,
} from '@/lib/types'

/**
 * A priced line, on whatever node it belongs to.
 *
 * Nothing here is derived. The amount and the state are the two facts only you
 * can know, and everything the project says about money is rolled up from them
 * in v_node_cost.
 */
/**
 * The currency of the quote, and the rate that applied when it was written.
 *
 * A euro line carries a rate of 1 rather than being special cased, so the sum
 * in the view is one expression rather than a condition. A rate of zero or less
 * would make the conversion meaningless, so it falls back to 1 and the amount
 * is then read as euro: wrong by a factor, never divided by nothing.
 */
function currencyFields(fd: FormData) {
  const currency = (text(fd, 'currency') ?? 'DKK') as CostCurrency
  const typed = number(fd, 'eur_rate')
  const rate = currency === 'EUR' ? 1 : typed !== null && typed > 0 ? typed : 1
  return { currency, eur_rate: rate }
}

function costFields(fd: FormData) {
  return {
    description: required(fd, 'description'),
    amount: Math.max(0, number(fd, 'amount') ?? 0),
    // The price is per unit, so a quantity of zero would silently erase the
    // line rather than record it. Blank means one.
    quantity: Math.max(0.001, number(fd, 'quantity') ?? 1),
    kind: (text(fd, 'kind') ?? 'other') as CostKind,
    state: (text(fd, 'state') ?? 'estimate') as CostState,
    recurrence: (text(fd, 'recurrence') ?? 'once') as CostRecurrence,
    budget: (text(fd, 'budget') ?? 'capex') as CostBudget,
    ...currencyFields(fd),
    vendor: text(fd, 'vendor'),
    reference: text(fd, 'reference'),
    dated: text(fd, 'dated') ?? undefined,
    note: text(fd, 'note'),
  }
}

/**
 * The paper behind the number, in one step.
 *
 * A quote that has to be uploaded on another page first and picked here second
 * is a quote that does not get attached. So the form takes either: a file to
 * put away now, or one already in the project.
 */
async function paperFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fd: FormData,
  nodeId: string,
): Promise<string | null> {
  const file = fd.get('file')
  if (file instanceof File && file.size > 0) {
    return storeFile(supabase, { nodeId, file, folder: '03 Quotes and pricing' })
  }
  return text(fd, 'document_id')
}

export async function createCost(fd: FormData) {
  const supabase = await createClient()

  const nodeId = required(fd, 'node_id')

  const { error } = await supabase.from('cost').insert({
    node_id: nodeId,
    ...costFields(fd),
    document_id: await paperFor(supabase, fd, nodeId),
  })

  if (error) throw new Error(`Could not save the cost line: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}

export async function updateCost(fd: FormData) {
  const supabase = await createClient()

  const id = required(fd, 'id')
  const { data: existing } = await supabase
    .from('cost')
    .select('node_id, document_id')
    .eq('id', id)
    .single()

  const paper = await paperFor(supabase, fd, existing?.node_id ?? '')

  const { error } = await supabase
    .from('cost')
    .update({
      ...costFields(fd),
      // A form submitted without a file and without a pick keeps what it had.
      document_id: paper ?? existing?.document_id ?? null,
    })
    .eq('id', id)

  if (error) throw new Error(`Could not save the cost line: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}

/**
 * Moving a line along, which is the action that happens most: a quote becomes
 * an order, an order becomes an invoice. One click, no form.
 */
export async function setCostState(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cost')
    .update({ state: required(fd, 'state') as CostState })
    .eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not change the state: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}

export async function deleteCost(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('cost').delete().eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not delete the cost line: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}
