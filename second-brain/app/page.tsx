'use client'

import { useState, useEffect } from 'react'
import SearchBar from '@/components/SearchBar'
import FilterBar from '@/components/FilterBar'
import NotesList from '@/components/NotesList'
import NoteDetail from '@/components/NoteDetail'
import CommandPalette from '@/components/CommandPalette'
import { Note } from '@/lib/types'

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([])
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string>('all')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch notes
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/notes')
        const data = await response.json()
        setNotes(data)
        setFilteredNotes(data)
      } catch (error) {
        console.error('Failed to fetch notes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNotes()
  }, [])

  // Filter notes based on search, type, and date
  useEffect(() => {
    let filtered = notes

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(note => note.type === selectedType)
    }

    // Date filter
    if (selectedDate !== 'all') {
      const now = new Date()
      filtered = filtered.filter(note => {
        const noteDate = new Date(note.date)
        switch (selectedDate) {
          case 'today':
            return noteDate.toDateString() === now.toDateString()
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return noteDate >= weekAgo
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return noteDate >= monthAgo
          default:
            return true
        }
      })
    }

    setFilteredNotes(filtered)
  }, [notes, searchQuery, selectedType, selectedDate])

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(!showCommandPalette)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCommandPalette])

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note)
    setShowCommandPalette(false)
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        notes={notes}
        onSelectNote={handleSelectNote}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-bold text-slate-900 mb-4">🦊 第二大腦</h1>
            <SearchBar 
              value={searchQuery}
              onChange={setSearchQuery}
              onCommandPalette={() => setShowCommandPalette(true)}
            />
          </div>
          <FilterBar
            selectedType={selectedType}
            selectedDate={selectedDate}
            onTypeChange={setSelectedType}
            onDateChange={setSelectedDate}
          />
        </div>

        {/* Main Content */}
        <div className="flex gap-4 p-6">
          {/* Notes List */}
          <div className="flex-1">
            {loading ? (
              <div className="text-center py-12 text-slate-500">載入中...</div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {searchQuery || selectedType !== 'all' || selectedDate !== 'all'
                  ? '找不到筆記'
                  : '還沒有筆記'}
              </div>
            ) : (
              <NotesList
                notes={filteredNotes}
                selectedId={selectedNote?.id}
                onSelect={handleSelectNote}
              />
            )}
          </div>

          {/* Note Detail */}
          {selectedNote && (
            <div className="w-96">
              <NoteDetail note={selectedNote} />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
