import { z } from "zod"

export const VALID_POS = ["n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.", "interj.", "phrase", "常用搭配詞"] as const

export const vocabularyItemSchema = z
  .object({
    list_name: z.string().trim().min(1, "清單名稱不能為空").optional(),
    subject: z.string().trim().min(1, "科目名稱不能為空").optional(), // 舊欄位相容；視為 list_name
    word: z.string().trim().min(1, "英文單字不能為空"),
    part_of_speech: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => val === undefined || val === "" || VALID_POS.includes(val as (typeof VALID_POS)[number]),
        { message: `詞性須為以下之一：${VALID_POS.join("、")}` }
      ),
    meaning: z.string().trim().min(1, "中文意思不能為空"),
    example_sentence: z.string().trim().min(1, "例句不能為空"),
    example_sentence_translation: z.string().trim().optional(),
  })
  .refine((v) => Boolean(v.list_name || v.subject), {
    message: "必須提供 list_name（或舊欄位 subject）",
    path: ["list_name"],
  })

export const vocabularyImportSchema = z.array(vocabularyItemSchema)

export type ImportedVocabularyWord = z.infer<typeof vocabularyItemSchema>

/** Resolve the effective list name for an imported item (prefer list_name, fall back to legacy subject). */
export function resolveListName(item: ImportedVocabularyWord): string {
  return (item.list_name || item.subject || "").trim()
}
