import { ImportClient } from "./import-client"
import { QuestionManagementClient } from "./question-management-client"
import { VocabularyImportClient } from "./vocabulary-import-client"
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
        <p className="text-muted-foreground">使用 JSON 批次匯入練習題目或英文單字，支援直接貼上與檔案上傳。</p>
      </div>

      <Tabs defaultValue="questions" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="questions">練習題目</TabsTrigger>
          <TabsTrigger value="manage">管理題目</TabsTrigger>
          <TabsTrigger value="vocabulary">英文單字</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-6">
          <ImportClient studyGroups={studyGroups} />
          <div className="prose max-w-none prose-sm dark:prose-invert">
            <h3>題目 JSON 格式要求</h3>
            <p>你的 JSON 必須是一個物件陣列，結構如下：</p>
            <pre className="overflow-x-auto"><code>{`[
  {
    "external_id": "選填字串",
    "subject": "數學",
    "topic": "代數",
    "question": "2 + 2 等於多少？",
    "options": ["3", "4", "5", "6"],
    "answer": 1,
    "explanation": "因為 2 加 2 等於 4。"
  }
]`}</code></pre>
            <ul>
              <li><strong>subject</strong>, <strong>topic</strong>, <strong>question</strong>, <strong>options</strong>, <strong>answer</strong> 為必填。</li>
              <li><strong>options</strong> 必須是至少包含 2 個項目的字串陣列。</li>
              <li><strong>answer</strong> 是正確選項的索引（從 0 開始，例如 1 代表第二個選項）。</li>
              <li>重複的題目（相同使用者 + 相同科目 + 相同題目內容）將會自動跳過。</li>
              <li>可選擇匯入為<strong>私人題庫</strong>，或直接分享到你所在的<strong>讀書房</strong>。</li>
              <li><strong>請直接貼原始 JSON</strong>；不要貼 base64、不要額外加引號。</li>
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
