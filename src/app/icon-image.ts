import { readFile } from "node:fs/promises"
import path from "node:path"

let cachedDataUrl: string | null = null

export async function getAppIconDataUrl() {
  if (cachedDataUrl) {
    return cachedDataUrl
  }

  const iconPath = path.join(process.cwd(), "public", "app-icon-source.jpg")
  const buffer = await readFile(iconPath)
  cachedDataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`
  return cachedDataUrl
}
