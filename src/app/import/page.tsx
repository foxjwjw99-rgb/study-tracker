import { ImportClient } from "./import-client"
import { QuestionManagementClient } from "./question-management-client"
import { VocabularyImportClient } from "./vocabulary-import-client"
import { CopyPromptButton } from "./copy-prompt-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getStudyGroupsForCurrentUser } from "@/app/actions/study-group"
import { getPracticeQuestionBank } from "@/app/actions/practice-log"

export default async function ImportPage() {
  const [studyGroups, questionBank] = await Promise.all([
    getStudyGroupsForCurrentUser(),
    getPracticeQuestionBank(),
  ])

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">匯入資料</h1>
        <p className="text-muted-foreground">題目匯入以統一管線處理：JSON / CSV / Excel 皆可，貼上或上傳後會自動偵測格式，驗證失敗的項目會列出個別原因，不影響其他項目匯入。</p>
      </div>

      <Tabs defaultValue="questions" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="questions">題目匯入</TabsTrigger>
          <TabsTrigger value="manage">管理題目</TabsTrigger>
          <TabsTrigger value="vocabulary">英文單字</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-6">
          <ImportClient studyGroups={studyGroups} />
          <details className="group rounded-lg border">
            <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              格式說明
              <svg className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div className="prose max-w-none prose-sm dark:prose-invert px-4 pb-4 pt-2">
              <div className="not-prose flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">統一題目 JSON 格式要求</h3>
                <CopyPromptButton />
              </div>
              <p>同一個 JSON 陣列裡，可以混合放入單題、填充題與題組：</p>
              <pre className="overflow-x-auto"><code>{`[
  {
    "external_id": "math-basic-001",
    "subject": "數學",
    "topic": "代數",
    "question": "2 + 2 等於多少？",
    "question_type": "multiple_choice",
    "options": ["3", "4", "5", "6"],
    "answer": 1,
    "explanation": "因為 2 加 2 等於 4。"
  },
  {
    "subject": "英文",
    "topic": "文法",
    "question": "The process is called ___.",
    "question_type": "fill_in_blank",
    "text_answer": "photosynthesis|光合作用"
  },
  {
    "external_id": "cn-group-001",
    "subject": "國文",
    "topic": "閱讀測驗",
    "group_title": "第一題組",
    "group_context": "閱讀下文，回答第 1–2 題...",
    "questions": [
      {
        "question": "第一小題題目",
        "options": ["A", "B", "C", "D"],
        "answer": 0
      }
    ]
  },
  {
    "subject": "經濟",
    "topic": "市場均衡",
    "group_context": "根據下表，回答問題。",
    "table": {
      "headers": ["年份", "需求量", "供給量"],
      "rows": [["2022", "500", "480"], ["2023", "520", "530"]]
    },
    "questions": [
      {
        "question": "2023 年市場狀況為何？",
        "options": ["供過於求", "求過於供", "均衡", "無法判斷"],
        "answer": 0
      }
    ]
  }
]`}</code></pre>
              <ul>
                <li><strong>單題欄位</strong>：<code>subject</code>、<code>topic</code>、<code>question</code>、<code>question_type</code>、<code>options</code>、<code>answer</code>、<code>text_answer</code>、<code>explanation</code>、<code>external_id</code>。</li>
                <li><strong>題組欄位</strong>：<code>subject</code>、<code>topic</code>、<code>group_title</code>、<code>group_context</code>、<code>external_id</code>、<code>questions</code>。</li>
                <li><strong>表格欄位</strong>：單題或題組均可加 <code>table</code>，格式為 <code>{`{"headers": [...], "rows": [[...], ...]}`}</code>；題組的表格顯示在共同題幹下方，單題的表格顯示在題目上方。</li>
                <li>判斷規則：有 <code>questions</code> 或 <code>group_context</code> 就視為題組，否則視為單題。</li>
                <li><strong>answer</strong> 使用 0-based index（0=A, 1=B, 2=C...）。</li>
                <li>匯入時會優先用 <strong>external_id</strong> 做去重；沒有 external_id 才退回題目文字或題組情境比對。</li>
                <li><strong>請直接貼原始 JSON 陣列</strong>，不要加說明文字；如果有 markdown code fence，系統會先自動去掉。</li>
              </ul>
              <h3 className="text-base font-semibold mt-4">CSV / Excel 題組表格格式</h3>
              <p>若上傳 CSV 或 Excel 檔，系統會依欄位 <code>group_context</code> 是否存在自動判斷：</p>
              <p><strong>單題 CSV</strong>（無 <code>group_context</code>）：</p>
              <pre className="overflow-x-auto"><code>{`subject, topic, question, option_a, option_b, option_c, option_d, answer, explanation`}</code></pre>
              <p><strong>題組 CSV / Excel</strong>（含 <code>group_context</code>）：</p>
              <pre className="overflow-x-auto"><code>{`subject, topic, group_title, group_context, question, option_A, option_B, option_C, option_D, answer, explanation`}</code></pre>
              <ul>
                <li>題組 CSV 中相同 <strong>subject + topic + group_context</strong> 的列會自動歸為同一題組。</li>
                <li><strong>answer</strong> 可填 A/B/C/D 或 0/1/2/3（單題 CSV）、A/B/C/D 或 1/2/3/4（題組 CSV）；若無選項欄位則視為填空題。</li>
              </ul>
            </div>
          </details>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <QuestionManagementClient questionBank={questionBank} />
        </TabsContent>

        <TabsContent value="vocabulary" className="space-y-6">
          <VocabularyImportClient studyGroups={studyGroups} />
          <details className="group rounded-lg border">
            <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              格式說明
              <svg className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div className="prose max-w-none prose-sm dark:prose-invert px-4 pb-4 pt-2">
              <h3>英文單字 JSON 格式要求</h3>
              <p>英文單字匯入也必須是一個物件陣列，結構如下：</p>
              <pre className="overflow-x-auto"><code>{`[
  {
    "subject": "英文",
    "word": "abandon",
    "part_of_speech": "v.",
    "meaning": "放棄；拋棄",
    "example_sentence": "He decided to abandon the plan.",
    "example_sentence_translation": "他決定放棄這個計畫。"
  }
]`}</code></pre>
              <ul>
                <li><strong>subject</strong>, <strong>word</strong>, <strong>meaning</strong>, <strong>example_sentence</strong> 為必填。</li>
                <li><strong>part_of_speech</strong>、<strong>example_sentence_translation</strong> 為選填。</li>
                <li><strong>part_of_speech</strong> 目前接受：<code>n.</code>、<code>v.</code>、<code>adj.</code>、<code>adv.</code>、<code>prep.</code>、<code>conj.</code>、<code>pron.</code>、<code>interj.</code>、<code>phrase</code>、<code>常用搭配詞</code>。</li>
                <li>同一使用者、同一科目、同一單字若已存在，匯入時會自動跳過。</li>
                <li>若選擇分享到讀書房，會把這批單字分發給目前房內成員；每個人的複習進度仍各自獨立。</li>
              </ul>
            </div>
          </details>
        </TabsContent>
      </Tabs>
    </div>
  )
}
