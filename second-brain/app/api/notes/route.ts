import { NextResponse } from 'next/server'
import { fetchNotes } from '@/lib/notes'

export async function GET() {
  try {
    const notes = await fetchNotes()
    return NextResponse.json(notes)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}
