'use client'

import { Note } from '@/lib/types'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { X } from 'lucide-react'

interface NoteDetailProps {
  note: Note
}

const TYPE_LABELS: Record<string, string> = {
  memory: '長期記憶',
  note: '筆記',
  conversation: '對話',
  thought: '想法',
}

export default function NoteDetail({ note }: NoteDetailProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 h-full overflow-y-auto sticky top-24">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">
            {TYPE_LABELS[note.type]}
          </span>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">{note.title}</h2>
        <p className="text-xs text-slate-500">
          {format(new Date(note.date), 'PPpp', { locale: zhTW })}
        </p>
        {note.source && (
          <p className="text-xs text-slate-400 mt-1">📁 {note.source}</p>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap break-words">
          {note.content}
        </div>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap gap-2">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
