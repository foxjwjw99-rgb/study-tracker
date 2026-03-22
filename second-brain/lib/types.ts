export interface Note {
  id: string
  title: string
  content: string
  type: 'memory' | 'note' | 'conversation' | 'thought'
  date: string
  tags?: string[]
  source?: string
}
