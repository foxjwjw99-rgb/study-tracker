'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Brain,
  Command,
  FileText,
  MessageSquareText,
  Sparkles,
} from 'lucide-react'
import SearchBar from '@/components/SearchBar'
import FilterBar from '@/components/FilterBar'
import NotesList from '@/components/NotesList'
import NoteDetail from '@/components/NoteDetail'
import CommandPalette from '@/components/CommandPalette'
import { Note } from '@/lib/types'

const TYPE_META = {
  memory: { label: '記憶', icon: Brain },
  note: { label: '筆記', icon: FileText },
  conversation: { label: '對話', icon: MessageSquareText },
  thought: { label: '想法', icon: Sparkles },
} as const

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string>('all')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/notes')
        const data = await response.json()
        setNotes(data)
        if (data.length > 0) {
          setSelectedNote(data[0])
        }
      } catch (error) {
        console.error('Failed to fetch notes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNotes()
  }, [])

  const filteredNotes = useMemo(() => {
    let filtered = notes

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(note => note.type === selectedType)
    }

    if (selectedDate !== 'all') {
      const now = new Date()
      filtered = filtered.filter(note => {
        const noteDate = new Date(note.date)
        switch (selectedDate) {
          case 'today':
            return noteDate.toDateString() === now.toDateString()
          case 'week': {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return noteDate >= weekAgo
          }
          case 'month': {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return noteDate >= monthAgo
          }
          default:
            return true
        }
      })
    }

    return filtered
  }, [notes, searchQuery, selectedType, selectedDate])

  useEffect(() => {
    if (filteredNotes.length === 0) {
      setSelectedNote(null)
      return
    }

    const selectedStillExists = selectedNote
      ? filteredNotes.some(note => note.id === selectedNote.id)
      : false

    if (!selectedStillExists) {
      setSelectedNote(filteredNotes[0])
    }
  }, [filteredNotes, selectedNote])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCommandPalette(current => !current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const stats = useMemo(() => {
    return {
      total: notes.length,
      memory: notes.filter(note => note.type === 'memory').length,
      note: notes.filter(note => note.type === 'note').length,
      conversation: notes.filter(note => note.type === 'conversation').length,
      thought: notes.filter(note => note.type === 'thought').length,
    }
  }, [notes])

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note)
    setShowCommandPalette(false)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(241,245,249,0.9)_40%,_rgba(226,232,240,0.8)_100%)] text-slate-900">
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        notes={notes}
        onSelectNote={handleSelectNote}
      />

      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="rounded-[28px] border border-white/70 bg-white/70 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="border-b border-slate-200/80 px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                  <span className="text-sm">🦊</span>
                  Second Brain OS
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  第二大腦
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  把筆記、記憶和對話收進同一個乾淨介面。搜尋快、篩選快、讀起來也舒服。
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                <Command className="h-4 w-4" />
                <span>按</span>
                <kbd className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700">
                  Cmd + K
                </kbd>
                <span>全域搜尋</span>
              </div>
            </div>

            <div className="mt-6">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onCommandPalette={() => setShowCommandPalette(true)}
              />
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[280px_420px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200/80 p-5 xl:border-b-0 xl:border-r">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Overview
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{stats.total}</p>
                <p className="mt-1 text-sm text-slate-500">全部資料</p>

                <div className="mt-5 space-y-2">
                  {Object.entries(TYPE_META).map(([key, meta]) => {
                    const Icon = meta.icon
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3"
                      >
                        <div className="flex items-center gap-3 text-sm text-slate-700">
                          <div className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span>{meta.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {stats[key as keyof typeof TYPE_META]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-slate-100 shadow-sm">
                <p className="text-sm font-medium">搜尋小提醒</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  用上面的搜尋欄做即時過濾，用 Cmd+K 快速跳到任何一則內容。
                </p>
              </div>
            </aside>

            <section className="border-b border-slate-200/80 xl:border-b-0 xl:border-r">
              <div className="border-b border-slate-200/80 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">內容列表</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {loading ? '整理中…' : `目前顯示 ${filteredNotes.length} 筆`}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <FilterBar
                    selectedType={selectedType}
                    selectedDate={selectedDate}
                    onTypeChange={setSelectedType}
                    onDateChange={setSelectedDate}
                  />
                </div>
              </div>

              <div className="max-h-[calc(100vh-320px)] min-h-[480px] overflow-y-auto px-4 py-4 sm:px-5">
                {loading ? (
                  <div className="flex h-full min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-slate-500">
                    載入中...
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                    <div className="rounded-2xl bg-white p-3 shadow-sm">🔎</div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">沒有符合的內容</h3>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                      試著清掉篩選條件，或換個關鍵字搜尋。你也可以用 Cmd+K 直接全域找。
                    </p>
                  </div>
                ) : (
                  <NotesList
                    notes={filteredNotes}
                    selectedId={selectedNote?.id}
                    onSelect={handleSelectNote}
                  />
                )}
              </div>
            </section>

            <section className="min-h-[640px] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.95))] p-4 sm:p-5 lg:p-6">
              {selectedNote ? (
                <NoteDetail note={selectedNote} />
              ) : (
                <div className="flex h-full min-h-[500px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white px-8 text-center shadow-sm">
                  <div className="rounded-2xl bg-slate-100 p-3">🪶</div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">選一則內容開始看</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    左邊挑一則筆記、記憶或對話，右邊就會展開完整內容。
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
