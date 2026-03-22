export type NoteType = 'memory' | 'note' | 'conversation' | 'thought'

export interface NoteMeta {
  messageCount?: number
  wordCount?: number
  characterCount?: number
}

export interface Note {
  id: string
  title: string
  content: string
  type: NoteType
  date: string
  tags?: string[]
  source?: string
  excerpt?: string
  meta?: NoteMeta
}
