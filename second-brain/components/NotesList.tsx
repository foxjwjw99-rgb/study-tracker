'use client'

import { Note } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import clsx from 'clsx'

interface NotesListProps {
  notes: Note[]
  selectedId?: string
  onSelect: (note: Note) => void
}

const TYPE_META: Record<Note['type'], { emoji: string; label: string; accent: string }> = {
  memory: { emoji: '🧠', label: '記憶', accent: 'bg-violet-50 text-violet-700' },
  note: { emoji: '📝', label: '筆記', accent: 'bg-blue-50 text-blue-700' },
  conversation: { emoji: '💬', label: '對話', accent: 'bg-emerald-50 text-emerald-700' },
  thought: { emoji: '💭', label: '想法', accent: 'bg-amber-50 text-amber-700' },
}

export default function NotesList({ notes, selectedId, onSelect }: NotesListProps) {
  return (
    <div className="space-y-3">
      {notes.map((note) => {
        const meta = TYPE_META[note.type]
        const preview = note.content.replace(/\s+/g, ' ').trim()

        return (
          <button
            key={note.id}
            onClick={() => onSelect(note)}
            className={clsx(
              'group w-full rounded-3xl border p-4 text-left transition-all duration-200',
              selectedId === note.id
                ? 'border-slate-900 bg-slate-900 text-white shadow-[0_20px_40px_rgba(15,23,42,0.18)]'
                : 'border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                      selectedId === note.id ? 'bg-white/10 text-white' : meta.accent
                    )}
                  >
                    <span>{meta.emoji}</span>
                    {meta.label}
                  </span>
                  {note.source && (
                    <span
                      className={clsx(
                        'truncate text-xs',
                        selectedId === note.id ? 'text-slate-300' : 'text-slate-400'
                      )}
                    >
                      {note.source}
                    </span>
                  )}
                </div>

                <h3
                  className={clsx(
                    'truncate text-base font-semibold',
                    selectedId === note.id ? 'text-white' : 'text-slate-950'
                  )}
                >
                  {note.title}
                </h3>

                <p
                  className={clsx(
                    'mt-2 line-clamp-3 text-sm leading-6',
                    selectedId === note.id ? 'text-slate-300' : 'text-slate-600'
                  )}
                >
                  {preview || '沒有內容預覽'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <time className={clsx('text-xs font-medium', selectedId === note.id ? 'text-slate-400' : 'text-slate-400')}>
                {formatDistanceToNow(new Date(note.date), { locale: zhTW, addSuffix: true })}
              </time>
              <span
                className={clsx(
                  'text-xs transition',
                  selectedId === note.id ? 'text-slate-300' : 'text-slate-300 group-hover:text-slate-500'
                )}
              >
                查看全文 →
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
