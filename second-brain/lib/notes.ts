import fs from 'fs'
import path from 'path'
import { Note, NoteType } from '@/lib/types'

const WORKSPACE_DIR = '/Users/huli/.openclaw/workspace'
const OPENCLAW_DIR = '/Users/huli/.openclaw'
const SESSION_DIR = path.join(OPENCLAW_DIR, 'agents', 'main', 'sessions')

const TEXT_EXTENSIONS = new Set(['.md', '.txt'])
const MAX_CONVERSATIONS = 24

function safeRead(filePath: string) {
  return fs.readFileSync(filePath, 'utf-8')
}

function trimText(text: string) {
  return text.replace(/\r/g, '').trim()
}

function createExcerpt(text: string, max = 180) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.length > max ? `${cleaned.slice(0, max).trim()}…` : cleaned
}

function createTitleFromFilename(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
}

function createTagsFromPath(relativePath: string) {
  return relativePath
    .split(path.sep)
    .slice(0, -1)
    .map(segment => segment.replace(/^\./, ''))
    .filter(Boolean)
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function pushFileAsNote(notes: Note[], filePath: string, type: NoteType, sourcePrefix = '') {
  const content = trimText(safeRead(filePath))
  if (!content) return

  const relativePath = path.relative(WORKSPACE_DIR, filePath)
  const source = sourcePrefix ? `${sourcePrefix}/${relativePath}` : relativePath
  const titlePrefix = type === 'thought' ? '想法' : type === 'memory' ? '記憶' : '筆記'

  notes.push({
    id: `${type}-${relativePath}`,
    title: `${titlePrefix} • ${createTitleFromFilename(path.basename(filePath))}`,
    content,
    excerpt: createExcerpt(content),
    type,
    date: new Date(fs.statSync(filePath).mtime).toISOString(),
    source,
    tags: createTagsFromPath(relativePath),
    meta: {
      wordCount: wordCount(content),
      characterCount: content.length,
    },
  })
}

function walkTextFiles(dir: string, collector: string[] = []) {
  if (!fs.existsSync(dir)) return collector

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkTextFiles(fullPath, collector)
      continue
    }

    if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      collector.push(fullPath)
    }
  }

  return collector
}

function extractVisibleText(content: unknown): string {
  if (!Array.isArray(content)) return ''

  return content
    .map((part: any) => (part?.type === 'text' ? String(part.text || '') : ''))
    .join('\n')
    .trim()
}

function stripTelegramMetadata(text: string) {
  return text
    .replace(/Conversation info \(untrusted metadata\):\s*```json[\s\S]*?```/g, '')
    .replace(/Sender \(untrusted metadata\):\s*```json[\s\S]*?```/g, '')
    .replace(/Replied message \(untrusted, for context\):\s*```json[\s\S]*?```/g, '')
    .replace(/System:\s*\[[^\]]+\][\s\S]*?Current time:[^\n]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function createConversationTitle(messages: Array<{ role: 'user' | 'assistant'; text: string }>) {
  const firstUser = messages.find(message => message.role === 'user' && message.text)
  const seed = firstUser?.text || messages[0]?.text || '未命名對話'
  const firstLine = seed.split('\n').find(Boolean)?.trim() || '未命名對話'
  const short = firstLine.length > 56 ? `${firstLine.slice(0, 56).trim()}…` : firstLine
  return `對話 • ${short}`
}

function parseConversationFile(filePath: string): Note | null {
  try {
    const lines = safeRead(filePath)
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)

    const messages: Array<{ role: 'user' | 'assistant'; text: string; timestamp: string }> = []

    for (const line of lines) {
      let parsed: any
      try {
        parsed = JSON.parse(line)
      } catch {
        continue
      }

      if (parsed?.type !== 'message' || !parsed?.message) continue
      const role = parsed.message.role
      if (role !== 'user' && role !== 'assistant') continue

      let text = extractVisibleText(parsed.message.content)
      if (!text) continue
      if (role === 'user') text = stripTelegramMetadata(text)
      if (!text) continue
      if (text.startsWith('✅ New session started')) continue

      messages.push({
        role,
        text,
        timestamp: parsed.message.timestamp || parsed.timestamp,
      })
    }

    if (messages.length === 0) return null

    const transcript = messages
      .map(message => `${message.role === 'user' ? 'Jimmy' : '狐狸'}\n${message.text}`)
      .join('\n\n---\n\n')

    const lastTimestamp = messages[messages.length - 1]?.timestamp
    const title = createConversationTitle(messages)
    const relativePath = path.relative(OPENCLAW_DIR, filePath)

    return {
      id: `conversation-${path.basename(filePath, '.jsonl')}`,
      title,
      content: transcript,
      excerpt: createExcerpt(transcript),
      type: 'conversation',
      date: lastTimestamp ? new Date(lastTimestamp).toISOString() : new Date(fs.statSync(filePath).mtime).toISOString(),
      source: relativePath,
      tags: ['openclaw', 'session'],
      meta: {
        messageCount: messages.length,
        wordCount: wordCount(transcript),
        characterCount: transcript.length,
      },
    }
  } catch (error) {
    console.error(`Error parsing conversation file ${filePath}:`, error)
    return null
  }
}

function collectWorkspaceNotes(notes: Note[]) {
  const folders: Array<{ dir: string; type: NoteType }> = [
    { dir: path.join(WORKSPACE_DIR, 'research'), type: 'note' },
    { dir: path.join(WORKSPACE_DIR, 'notes'), type: 'note' },
    { dir: path.join(WORKSPACE_DIR, '.learnings'), type: 'thought' },
  ]

  for (const folder of folders) {
    const files = walkTextFiles(folder.dir)
    for (const filePath of files) {
      pushFileAsNote(notes, filePath, folder.type)
    }
  }
}

function collectMemory(notes: Note[]) {
  const memoryFile = path.join(WORKSPACE_DIR, 'MEMORY.md')
  if (fs.existsSync(memoryFile)) {
    pushFileAsNote(notes, memoryFile, 'memory')
  }

  const memoryDir = path.join(WORKSPACE_DIR, 'memory')
  if (fs.existsSync(memoryDir)) {
    const files = walkTextFiles(memoryDir)
    for (const filePath of files) {
      pushFileAsNote(notes, filePath, 'memory')
    }
  }
}

function collectConversations(notes: Note[]) {
  if (!fs.existsSync(SESSION_DIR)) return

  const files = fs
    .readdirSync(SESSION_DIR)
    .filter(file => file.endsWith('.jsonl'))
    .filter(file => !file.includes('.reset.'))
    .filter(file => !file.endsWith('.lock'))
    .map(file => path.join(SESSION_DIR, file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    .slice(0, MAX_CONVERSATIONS)

  for (const filePath of files) {
    const conversation = parseConversationFile(filePath)
    if (conversation) notes.push(conversation)
  }
}

export async function fetchNotes(): Promise<Note[]> {
  const notes: Note[] = []

  collectMemory(notes)
  collectWorkspaceNotes(notes)
  collectConversations(notes)

  notes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return notes
}
