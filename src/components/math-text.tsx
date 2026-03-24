import type { ReactNode } from "react"
import katex from "katex"

import { cn } from "@/lib/utils"

type MathTextProps = {
  text: string
  className?: string
}

type MathSegment = {
  type: "text" | "math"
  content: string
  displayMode?: boolean
}

const LATEX_SYMBOLS: Array<[RegExp, string]> = [
  [/\\times/g, "×"],
  [/\\cdot/g, "·"],
  [/\\div/g, "÷"],
  [/\\pm/g, "±"],
  [/\\neq/g, "≠"],
  [/\\leq/g, "≤"],
  [/\\geq/g, "≥"],
  [/\\infty/g, "∞"],
  [/\\to/g, "→"],
  [/\\rightarrow/g, "→"],
  [/\\left/g, ""],
  [/\\right/g, ""],
]

export function MathText({ text, className }: MathTextProps) {
  const segments = splitMathSegments(text)

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {segments.map((segment, index) => {
        if (segment.type === "math") {
          const html = katex.renderToString(segment.content, {
            throwOnError: false,
            displayMode: Boolean(segment.displayMode),
            strict: "ignore",
            trust: false,
          })

          return (
            <span
              key={`math-${index}`}
              className={cn(segment.displayMode ? "my-2 block overflow-x-auto" : "inline-block align-middle")}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        }

        return <span key={`txt-${index}`}>{renderLightMathText(segment.content)}</span>
      })}
    </span>
  )
}

function splitMathSegments(input: string): MathSegment[] {
  const segments: MathSegment[] = []
  let cursor = 0

  while (cursor < input.length) {
    const blockIndex = input.indexOf("$$", cursor)
    const inlineIndex = input.indexOf("$", cursor)
    const parenIndex = input.indexOf("\\(", cursor)
    const bracketIndex = input.indexOf("\\[", cursor)

    const candidates = [
      blockIndex >= 0 ? { index: blockIndex, kind: "block-dollar" as const } : null,
      inlineIndex >= 0 ? { index: inlineIndex, kind: "inline-dollar" as const } : null,
      parenIndex >= 0 ? { index: parenIndex, kind: "inline-paren" as const } : null,
      bracketIndex >= 0 ? { index: bracketIndex, kind: "block-bracket" as const } : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null)

    if (candidates.length === 0) {
      segments.push({ type: "text", content: input.slice(cursor) })
      break
    }

    const next = candidates.sort((a, b) => a.index - b.index)[0]

    if (next.index > cursor) {
      segments.push({ type: "text", content: input.slice(cursor, next.index) })
    }

    if (next.kind === "block-dollar") {
      const end = input.indexOf("$$", next.index + 2)
      if (end >= 0) {
        segments.push({
          type: "math",
          content: input.slice(next.index + 2, end).trim(),
          displayMode: true,
        })
        cursor = end + 2
        continue
      }
    }

    if (next.kind === "inline-dollar") {
      if (input[next.index + 1] === "$") {
        cursor = next.index
        continue
      }
      const end = findClosingDollar(input, next.index + 1)
      if (end >= 0) {
        segments.push({
          type: "math",
          content: input.slice(next.index + 1, end).trim(),
          displayMode: false,
        })
        cursor = end + 1
        continue
      }
    }

    if (next.kind === "inline-paren") {
      const end = input.indexOf("\\)", next.index + 2)
      if (end >= 0) {
        segments.push({
          type: "math",
          content: input.slice(next.index + 2, end).trim(),
          displayMode: false,
        })
        cursor = end + 2
        continue
      }
    }

    if (next.kind === "block-bracket") {
      const end = input.indexOf("\\]", next.index + 2)
      if (end >= 0) {
        segments.push({
          type: "math",
          content: input.slice(next.index + 2, end).trim(),
          displayMode: true,
        })
        cursor = end + 2
        continue
      }
    }

    segments.push({ type: "text", content: input.slice(next.index, next.index + 1) })
    cursor = next.index + 1
  }

  return segments.filter((segment) => segment.content.length > 0)
}

function findClosingDollar(input: string, start: number) {
  for (let i = start; i < input.length; i += 1) {
    if (input[i] === "$" && input[i - 1] !== "\\") {
      return i
    }
  }

  return -1
}

function renderLightMathText(input: string): ReactNode[] {
  const normalized = normalizeMathText(input)
  const nodes: ReactNode[] = []
  let index = 0

  while (index < normalized.length) {
    const char = normalized[index]

    if ((char === "^" || char === "_") && nodes.length > 0) {
      const parsed = readScriptToken(normalized, index + 1)
      if (parsed.value.length > 0) {
        nodes.push(
          char === "^" ? (
            <sup key={`sup-${index}`} className="text-[0.72em] align-super">
              {parsed.value}
            </sup>
          ) : (
            <sub key={`sub-${index}`} className="text-[0.72em] align-sub">
              {parsed.value}
            </sub>
          )
        )
        index = parsed.nextIndex
        continue
      }
    }

    nodes.push(<span key={`txt-${index}`}>{char}</span>)
    index += 1
  }

  return nodes
}

function normalizeMathText(raw: string) {
  let text = raw

  text = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, a: string, b: string) => `(${a})⁄(${b})`)
  text = text.replace(/\\sqrt\{([^{}]+)\}/g, (_, value: string) => `√(${value})`)

  for (const [pattern, replacement] of LATEX_SYMBOLS) {
    text = text.replace(pattern, replacement)
  }

  return text
}

function readScriptToken(text: string, startIndex: number) {
  if (startIndex >= text.length) {
    return { value: "", nextIndex: startIndex }
  }

  if (text[startIndex] === "{") {
    let depth = 1
    let cursor = startIndex + 1
    let value = ""

    while (cursor < text.length && depth > 0) {
      const current = text[cursor]
      if (current === "{") {
        depth += 1
      } else if (current === "}") {
        depth -= 1
        if (depth === 0) {
          cursor += 1
          break
        }
      }

      if (depth > 0) {
        value += current
      }
      cursor += 1
    }

    return {
      value,
      nextIndex: cursor,
    }
  }

  if (text[startIndex] === "(") {
    let depth = 1
    let cursor = startIndex + 1
    let value = ""

    while (cursor < text.length && depth > 0) {
      const current = text[cursor]
      if (current === "(") {
        depth += 1
      } else if (current === ")") {
        depth -= 1
        if (depth === 0) {
          cursor += 1
          break
        }
      }

      if (depth > 0) {
        value += current
      }
      cursor += 1
    }

    return {
      value,
      nextIndex: cursor,
    }
  }

  let cursor = startIndex
  let value = ""

  if (text[cursor] === "+" || text[cursor] === "-") {
    value += text[cursor]
    cursor += 1
  }

  while (cursor < text.length) {
    const current = text[cursor]
    if (/\s/.test(current) || current === "^" || current === "_") {
      break
    }

    if (/[A-Za-z0-9.]/.test(current)) {
      value += current
      cursor += 1
      continue
    }

    break
  }

  if (!value && text[startIndex]) {
    value = text[startIndex]
    cursor = startIndex + 1
  }

  return {
    value,
    nextIndex: cursor,
  }
}
