'use client'

import { Command, Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onCommandPalette: () => void
}

export default function SearchBar({ value, onChange, onCommandPalette }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder="搜尋筆記、記憶、對話內容..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-14 pr-28 text-[15px] text-slate-900 shadow-sm outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
      />
      <button
        onClick={onCommandPalette}
        className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <Command className="h-3.5 w-3.5" />
        <span>Cmd</span>
        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700">
          K
        </span>
      </button>
    </div>
  )
}
