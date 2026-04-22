"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Pencil } from "lucide-react"
import { toast } from "sonner"

import {
  createVocabularyList,
  deleteVocabularyListCascade,
  getVocabularyListDeletionImpact,
  renameVocabularyList,
} from "@/app/actions/vocabulary-list"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { VocabularyListDeletionImpact, VocabularyListSummary } from "@/types"

type Props = {
  lists: VocabularyListSummary[]
}

export function VocabularyListsManager({ lists }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [newListName, setNewListName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [impact, setImpact] = useState<VocabularyListDeletionImpact | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleCreate = () => {
    if (!newListName.trim()) {
      toast.error("請輸入清單名稱。")
      return
    }
    startTransition(async () => {
      const result = await createVocabularyList(newListName)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setNewListName("")
      router.refresh()
    })
  }

  const handleRename = (id: string) => {
    if (!editingName.trim()) {
      toast.error("請輸入清單名稱。")
      return
    }
    startTransition(async () => {
      const result = await renameVocabularyList(id, editingName)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setEditingId(null)
      setEditingName("")
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        const listImpact = await getVocabularyListDeletionImpact(id)
        setImpact(listImpact)
        setDialogOpen(true)
      } catch {
        toast.error("讀取清單刪除資訊失敗。")
      }
    })
  }

  const handleCascadeDelete = () => {
    if (!impact) return
    startTransition(async () => {
      const result = await deleteVocabularyListCascade(impact.listId)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setDialogOpen(false)
      setImpact(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="新清單名稱（例如：托福 3000）"
          value={newListName}
          onChange={(event) => setNewListName(event.target.value)}
          disabled={isPending}
        />
        <Button type="button" onClick={handleCreate} disabled={isPending}>
          {isPending ? "處理中..." : "新增清單"}
        </Button>
      </div>

      <div className="rounded-md border">
        {lists.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">尚未建立任何單字清單。</div>
        ) : (
          <div className="grid grid-cols-1 divide-y">
            {lists.map((list) => {
              const isEditing = editingId === list.id
              return (
                <div
                  key={list.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          disabled={isPending}
                        />
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => handleRename(list.id)} disabled={isPending}>
                            儲存
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null)
                              setEditingName("")
                            }}
                            disabled={isPending}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="break-words font-medium">{list.name}</div>
                        <div className="text-sm text-muted-foreground">共 {list.word_count} 個單字</div>
                      </>
                    )}
                  </div>
                  {!isEditing ? (
                    <div className="flex items-center gap-3 text-sm">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        disabled={isPending}
                        onClick={() => {
                          setEditingId(list.id)
                          setEditingName(list.name)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        改名
                      </button>
                      <button
                        type="button"
                        className="text-destructive hover:underline"
                        disabled={isPending}
                        onClick={() => handleDelete(list.id)}
                      >
                        刪除
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              刪除單字清單與相關資料
            </DialogTitle>
            <DialogDescription>
              {impact
                ? `「${impact.listName}」底下的單字、複習紀錄與複習任務都會一起被刪掉，這個動作無法復原。`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {impact ? (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
              <ImpactRow label="單字" value={impact.wordsCount} />
              <ImpactRow label="複習紀錄" value={impact.reviewLogsCount} />
              <ImpactRow label="複習任務" value={impact.reviewTasksCount} />
              <div className="border-t border-border/70 pt-3 font-medium text-foreground">
                總共會刪除 {impact.totalCount} 筆相關資料
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="destructive" disabled={isPending} onClick={handleCascadeDelete}>
              {isPending ? "刪除中..." : "確認整包刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ImpactRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
