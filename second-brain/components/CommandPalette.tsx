'use client'

import { useEffect, useState } from 'react'
import { Command as CommandIcon } from 'lucide-react'
import { Note } from '@/lib/types'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  notes: Note[]
  onSelectNote: (note: Note) => void
}

const TYPE_ICONS: Record<string, string> = {
  memory: '🧠',
  note: '📝',
  conversation: '💬',
  thought: '💭',
}

export default function CommandPalette({
  isOpen,
  onClose,
  notes,
  onSelectNote,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filtered = query
    ? notes.filter(note =>
        note.title.toLowerCase().includes(query.toLowerCase()) ||
        note.content.toLowerCase().includes(query.toLowerCase())
      )
    : notes.slice(0, 10)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault()
        onSelectNote(filtered[selectedIndex])
        setQuery('')
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filtered, selectedIndex, onClose, onSelectNote])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-lg shadow-lg border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <CommandIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="搜尋筆記..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            className="flex-1 bg-transparent text-slate-900 placeholder-slate-400 outline-none"
          />
          <kbd className="px-2 py-1 text-xs font-semibold text-slate-400 bg-slate-100 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              找不到符合的筆記
            </div>
          ) : (
            filtered.map((note, index) => (
              <button
                key={note.id}
                onClick={() => {
                  onSelectNote(note)
                  setQuery('')
                  onClose()
                }}
                className={`w-full text-left p-4 border-b border-slate-100 last:border-b-0 transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">
                    {TYPE_ICONS[note.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {note.title}
                    </p>
                    <p className="text-sm text-slate-600 truncate">
                      {note.content.substring(0, 80)}...
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
