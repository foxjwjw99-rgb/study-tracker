import fs from 'fs'
import path from 'path'
import { Note } from '@/lib/types'

const WORKSPACE_DIR = '/Users/huli/.openclaw/workspace'

export async function fetchNotes(): Promise<Note[]> {
  const notes: Note[] = []

  // Fetch from MEMORY.md
  try {
    const memoryPath = path.join(WORKSPACE_DIR, 'MEMORY.md')
    if (fs.existsSync(memoryPath)) {
      const content = fs.readFileSync(memoryPath, 'utf-8')
      notes.push({
        id: 'memory-main',
        title: '長期記憶 (MEMORY.md)',
        content: content,
        type: 'memory',
        date: new Date(fs.statSync(memoryPath).mtime).toISOString(),
        source: 'MEMORY.md',
      })
    }
  } catch (error) {
    console.error('Error reading MEMORY.md:', error)
  }

  // Fetch from daily memory files
  try {
    const memoryDir = path.join(WORKSPACE_DIR, 'memory')
    if (fs.existsSync(memoryDir)) {
      const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'))
      for (const file of files) {
        const filePath = path.join(memoryDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const date = new Date(fs.statSync(filePath).mtime).toISOString()
        
        notes.push({
          id: `memory-${file}`,
          title: `每日記憶 • ${file.replace('.md', '')}`,
          content: content,
          type: 'memory',
          date: date,
          source: `memory/${file}`,
        })
      }
    }
  } catch (error) {
    console.error('Error reading memory directory:', error)
  }

  // Fetch from notes directory
  try {
    const notesDir = path.join(WORKSPACE_DIR, 'notes')
    if (fs.existsSync(notesDir)) {
      const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.md'))
      for (const file of files) {
        const filePath = path.join(notesDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const date = new Date(fs.statSync(filePath).mtime).toISOString()
        
        notes.push({
          id: `note-${file}`,
          title: file.replace('.md', ''),
          content: content,
          type: 'note',
          date: date,
          source: `notes/${file}`,
        })
      }
    }
  } catch (error) {
    console.error('Error reading notes directory:', error)
  }

  // Sort by date (newest first)
  notes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return notes
}
