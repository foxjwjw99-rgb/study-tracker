'use client'

import { Search, Command } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onCommandPalette: () => void
}

export default function SearchBar({ value, onChange, onCommandPalette }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
      <input
        type="text"
        placeholder="搜尋筆記、記憶、對話..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-12 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        onClick={onCommandPalette}
        className="absolute right-3 top-3 flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors"
      >
        <Command className="w-3 h-3" />K
      </button>
    </div>
  )
}
