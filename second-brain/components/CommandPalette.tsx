'use client'

import { useEffect, useMemo, useState } from 'react'
import { Command as CommandIcon, Search } from 'lucide-react'
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

  const filtered = useMemo(() => {
    if (!query) return notes.slice(0, 10)

    return notes.filter(note =>
      note.title.toLowerCase().includes(query.toLowerCase()) ||
      note.content.toLowerCase().includes(query.toLowerCase())
    )
  }, [notes, query])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setSelectedIndex(0)
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown' && filtered.length > 0) {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp' && filtered.length > 0) {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault()
        onSelectNote(filtered[selectedIndex])
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, isOpen, onClose, onSelectNote, selectedIndex])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/20 px-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="rounded-2xl bg-slate-100 p-2 text-slate-500">
            <Search className="h-4 w-4" />
          </div>
          <input
            autoFocus
            type="text"
            placeholder="快速搜尋任何筆記或記憶..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            className="flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          <div className="hidden items-center gap-2 sm:flex">
            <kbd className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">↑↓</kbd>
            <kbd className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">Enter</kbd>
            <kbd className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">Esc</kbd>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              找不到符合的內容
            </div>
          ) : (
            filtered.map((note, index) => (
              <button
                key={note.id}
                onClick={() => {
                  onSelectNote(note)
                  onClose()
                }}
                className={[
                  'mb-2 w-full rounded-2xl border px-4 py-3 text-left transition last:mb-0',
                  index === selectedIndex
                    ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div className={[
                    'flex h-10 w-10 items-center justify-center rounded-2xl text-base',
                    index === selectedIndex ? 'bg-white/10' : 'bg-slate-100',
                  ].join(' ')}>
                    {TYPE_ICONS[note.type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className={index === selectedIndex ? 'truncate font-semibold text-white' : 'truncate font-semibold text-slate-900'}>
                        {note.title}
                      </p>
                      <div className={index === selectedIndex ? 'text-slate-300' : 'text-slate-400'}>
                        <CommandIcon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className={[
                      'mt-1 truncate text-sm',
                      index === selectedIndex ? 'text-slate-300' : 'text-slate-500',
                    ].join(' ')}>
                      {note.content.replace(/\s+/g, ' ').trim() || '沒有內容'}
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
