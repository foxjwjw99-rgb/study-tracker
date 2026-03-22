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

const TYPE_ICONS: Record<string, string> = {
  memory: '🧠',
  note: '📝',
  conversation: '💬',
  thought: '💭',
}

export default function NotesList({ notes, selectedId, onSelect }: NotesListProps) {
  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <button
          key={note.id}
          onClick={() => onSelect(note)}
          className={clsx(
            'w-full text-left p-4 rounded-lg border transition-colors',
            selectedId === note.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-start gap-2 flex-1">
              <span className="text-lg">{TYPE_ICONS[note.type]}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">
                  {note.title}
                </h3>
                {note.source && (
                  <p className="text-xs text-slate-500 mt-1">{note.source}</p>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600 line-clamp-2 mb-2">
            {note.content.substring(0, 150)}...
          </p>
          <time className="text-xs text-slate-500">
            {formatDistanceToNow(new Date(note.date), { locale: zhTW, addSuffix: true })}
          </time>
        </button>
      ))}
    </div>
  )
}
