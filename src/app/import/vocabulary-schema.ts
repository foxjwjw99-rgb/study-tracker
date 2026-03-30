import { z } from "zod"

export const VALID_POS = ["n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.", "interj.", "phrase", "常用搭配詞"] as const

export const vocabularyItemSchema = z.object({
  subject: z.string().trim().min(1, "科目名稱不能為空"),
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

export const vocabularyImportSchema = z.array(vocabularyItemSchema)

export type ImportedVocabularyWord = z.infer<typeof vocabularyItemSchema>
