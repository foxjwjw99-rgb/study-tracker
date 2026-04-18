import { type NextRequest } from "next/server"
import { auth } from "@/auth"

const clients = new Map<string, ReadableStreamDefaultController<string>>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
const heartbeatIntervals = new Map<string, ReturnType<typeof setInterval>>()

function sendEvent(controller: ReadableStreamDefaultController<string>, data: object) {
  try {
    controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
  } catch {
    // client disconnected
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }
  const userId = session.user.id

  // Close any existing connection for this user
  const existingHeartbeat = heartbeatIntervals.get(userId)
  if (existingHeartbeat) clearInterval(existingHeartbeat)

  let controller: ReadableStreamDefaultController<string>

  const stream = new ReadableStream<string>({
    start(ctrl) {
      controller = ctrl
      clients.set(userId, ctrl)

      sendEvent(ctrl, { type: "connected" })

      // Heartbeat every 25s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          ctrl.enqueue(": ping\n\n")
        } catch {
          clearInterval(heartbeat)
          heartbeatIntervals.delete(userId)
        }
      }, 25000)
      heartbeatIntervals.set(userId, heartbeat)
    },
    cancel() {
      clients.delete(userId)
      const hb = heartbeatIntervals.get(userId)
      if (hb) {
        clearInterval(hb)
        heartbeatIntervals.delete(userId)
      }
    },
  })

  req.signal.addEventListener("abort", () => {
    clients.delete(userId)
    const hb = heartbeatIntervals.get(userId)
    if (hb) {
      clearInterval(hb)
      heartbeatIntervals.delete(userId)
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }
  const userId = session.user.id

  const existing = pendingTimers.get(userId)
  if (existing) {
    clearTimeout(existing)
    pendingTimers.delete(userId)
  }

  const body = await req.json()
  const { endAt, title, body: msgBody } = body as {
    endAt: number | null
    title: string
    body: string
  }

  if (!endAt || !title) {
    return Response.json({ ok: true })
  }

  const delay = endAt - Date.now()
  if (delay <= 0) {
    return Response.json({ ok: true })
  }

  const timer = setTimeout(() => {
    const ctrl = clients.get(userId)
    if (ctrl) {
      sendEvent(ctrl, { type: "notification", title, body: msgBody })
    }
    pendingTimers.delete(userId)
  }, delay)

  pendingTimers.set(userId, timer)
  return Response.json({ ok: true })
}
