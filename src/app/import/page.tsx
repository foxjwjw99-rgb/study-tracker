import { ImportClient } from "./import-client"
import { QuestionManagementClient } from "./question-management-client"
import { VocabularyImportClient } from "./vocabulary-import-client"
import { CopyPromptButton } from "./copy-prompt-button"
import { QuestionGroupImportClient } from "./question-group-import-client"
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
        <p className="text-muted-foreground">題目匯入現在以統一 JSON 管線為主：貼上 / 上傳 → 驗證 → 預覽 → 去重 → 寫入。題組表格匯入與英文單字匯入則保留在下方。</p>
      </div>

      <Tabs defaultValue="questions" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="questions">題目匯入</TabsTrigger>
          <TabsTrigger value="question-groups">題組表格匯入</TabsTrigger>
          <TabsTrigger value="manage">管理題目</TabsTrigger>
          <TabsTrigger value="vocabulary">英文單字</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-6">
          <ImportClient studyGroups={studyGroups} />
          <div className="prose max-w-none prose-sm dark:prose-invert">
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
  }
]`}</code></pre>
            <ul>
              <li><strong>單題欄位</strong>：<code>subject</code>、<code>topic</code>、<code>question</code>、<code>question_type</code>、<code>options</code>、<code>answer</code>、<code>text_answer</code>、<code>explanation</code>、<code>external_id</code>。</li>
              <li><strong>題組欄位</strong>：<code>subject</code>、<code>topic</code>、<code>group_title</code>、<code>group_context</code>、<code>external_id</code>、<code>questions</code>。</li>
              <li>判斷規則：有 <code>questions</code> 或 <code>group_context</code> 就視為題組，否則視為單題。</li>
              <li><strong>answer</strong> 使用 0-based index（0=A, 1=B, 2=C...）。</li>
              <li>匯入時會優先用 <strong>external_id</strong> 做去重；沒有 external_id 才退回題目文字或題組情境比對。</li>
              <li><strong>請直接貼原始 JSON 陣列</strong>，不要加說明文字；如果有 markdown code fence，系統會先自動去掉。</li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="question-groups" className="space-y-6">
          <QuestionGroupImportClient studyGroups={studyGroups} />
          <div className="prose max-w-none prose-sm dark:prose-invert">
            <h3>題組表格 / 補充格式說明</h3>
            <p><strong>JSON 格式</strong>：若你只想匯入題組，也可在這裡使用一個題組物件陣列：</p>
            <pre className="overflow-x-auto"><code>{`[
  {
    "subject": "國文",
    "topic": "閱讀測驗",
    "group_title": "第一題組（選填）",
    "group_context": "閱讀下文，回答第 1–2 題...",
    "questions": [
      {
        "question": "第一小題題目",
        "options": ["選項A", "選項B", "選項C", "選項D"],
        "answer": 0,
        "explanation": "選填解析"
      },
      {
        "question": "第二小題（填空）",
        "question_type": "fill_in_blank",
        "text_answer": "答案1|答案2"
      }
    ]
  }
]`}</code></pre>
            <p><strong>表格格式（CSV / Excel）</strong>：需包含以下欄位標題：</p>
            <pre className="overflow-x-auto"><code>{`subject, topic, group_title, group_context, question, option_A, option_B, option_C, option_D, answer, explanation`}</code></pre>
            <ul>
              <li>相同 <strong>subject + topic + group_context</strong> 的列會自動歸為同一題組。</li>
              <li><strong>answer</strong> 填 A/B/C/D 或 1/2/3/4；若無選項欄位則視為填空題。</li>
              <li>重複的題組（相同科目 + 相同情境）將自動跳過。</li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <QuestionManagementClient questionBank={questionBank} />
        </TabsContent>

        <TabsContent value="vocabulary" className="space-y-6">
          <VocabularyImportClient studyGroups={studyGroups} />
          <div className="prose max-w-none prose-sm dark:prose-invert">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
