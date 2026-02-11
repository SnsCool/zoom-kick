import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isMockMode, mockStore } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit')) || 50
  const offset = Number(searchParams.get('offset')) || 0
  const action = searchParams.get('action') || undefined

  if (isMockMode()) {
    const result = mockStore.getLogs(limit, offset, action)
    return NextResponse.json({ logs: result.data, total: result.total, banned: result.banned, deleted: result.deleted, passed: result.passed }, { status: 200 })
  }

  let query = supabaseAdmin
    .from('mod_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) {
    query = query.eq('action', action)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs: data, total: count }, { status: 200 })
}