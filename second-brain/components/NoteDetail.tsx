'use client'

import { Note } from '@/lib/types'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface NoteDetailProps {
  note: Note
}

const TYPE_META: Record<Note['type'], { label: string; emoji: string; accent: string }> = {
  memory: { label: '長期記憶', emoji: '🧠', accent: 'bg-violet-50 text-violet-700 border-violet-100' },
  note: { label: '筆記', emoji: '📝', accent: 'bg-blue-50 text-blue-700 border-blue-100' },
  conversation: { label: '對話', emoji: '💬', accent: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  thought: { label: '想法', emoji: '💭', accent: 'bg-amber-50 text-amber-700 border-amber-100' },
}

export default function NoteDetail({ note }: NoteDetailProps) {
  const meta = TYPE_META[note.type]

  return (
    <article className="h-full rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${meta.accent}`}>
            <span>{meta.emoji}</span>
            {meta.label}
          </span>
          {note.source && (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
              {note.source}
            </span>
          )}
        </div>

        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {note.title}
        </h2>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>{format(new Date(note.date), 'PPP p', { locale: zhTW })}</span>
          <span className="text-slate-300">•</span>
          <span>{note.content.length.toLocaleString()} 字元</span>
        </div>
      </div>

      <div className="max-h-[calc(100vh-260px)] overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
        <div className="max-w-3xl whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-700 sm:text-base">
          {note.content}
        </div>

        {note.tags && note.tags.length > 0 && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
