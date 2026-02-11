import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isMockMode, mockStore } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (isMockMode()) {
    return NextResponse.json({ ngWords: mockStore.getNgWords() }, { status: 200 })
  }

  const { data, error } = await supabaseAdmin
    .from('ng_words')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ngWords: data }, { status: 200 })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { word, category, severity, is_regex } = body

  if (!word || word.trim() === '') {
    return NextResponse.json({ error: 'Word is required' }, { status: 400 })
  }

  if (isMockMode()) {
    const newWord = mockStore.addNgWord({
      word,
      category: category || 'general',
      severity: severity || 'medium',
      is_regex: is_regex || false,
    })
    return NextResponse.json({ ngWord: newWord }, { status: 201 })
  }

  const { data, error } = await supabaseAdmin
    .from('ng_words')
    .insert({
      word,
      category: category || 'general',
      severity: severity || 'medium',
      is_regex: is_regex || false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ngWord: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const body = await request.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  if (isMockMode()) {
    mockStore.deleteNgWord(id)
    return NextResponse.json({ message: '削除しました' }, { status: 200 })
  }

  const { error } = await supabaseAdmin
    .from('ng_words')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: '削除しました' }, { status: 200 })
}
