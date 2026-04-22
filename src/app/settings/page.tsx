import { getSubjects } from "@/app/actions/subject"
import { listVocabularyLists } from "@/app/actions/vocabulary-list"
import { SubjectForm } from "./subject-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExamDateForm } from "./exam-date-form"
import { SubjectsList } from "./subjects-list"
import { UserManagement } from "./user-management"
import { StudyGroupManagement } from "./study-group-management"
import { ExamSyllabusManager } from "./exam-syllabus-manager"
import { MockExamManager } from "./mock-exam-manager"
import { VocabularyListsManager } from "./vocabulary-lists"
import { getStudyGroupsForCurrentUser } from "@/app/actions/study-group"
import { getMockExamRecords } from "@/app/actions/exam-forecast"
import { resolveCurrentUserContext, toCurrentUserSummary } from "@/lib/current-user"
import prisma from "@/lib/prisma"

export default async function SettingsPage() {
  const { user } = await resolveCurrentUserContext()
  const currentUser = toCurrentUserSummary(user)
  const subjects = await getSubjects()
  const vocabularyLists = await listVocabularyLists()
  const studyGroups = await getStudyGroupsForCurrentUser()

  const subjectsWithUnits = await prisma.subject.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      name: true,
      target_score: true,
      exam_weight: true,
      exam_syllabus_units: {
        select: { id: true, unit_name: true, weight: true, mastery_score: true },
        orderBy: { unit_name: "asc" },
      },
    },
  })

  const mockExamRecords = await getMockExamRecords()

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">設定</h1>
        <p className="text-muted-foreground">管理帳號、科目與讀書房。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>帳號與存取</CardTitle>
          <CardDescription>已改成 Google 登入，資料直接綁定登入中的帳號。</CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagement currentUser={currentUser} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>目標考試日期</CardTitle>
          <CardDescription>你的主要考試日期是什麼時候？我們將為你計算剩餘天數。</CardDescription>
        </CardHeader>
        <CardContent>
          <ExamDateForm initialDate={user.exam_date} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>學習科目</CardTitle>
          <CardDescription>新增你想要追蹤的科目。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SubjectForm />

          <div className="mt-6 border rounded-md">
            <div className="p-4">
              <SubjectsList subjects={subjects} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>考試範圍與單元設定</CardTitle>
          <CardDescription>
            預先定義每個科目的考試單元與比重，讓 Dashboard 的覆蓋率計算更準確。支援逐筆新增或從 JSON 匯入。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExamSyllabusManager subjects={subjectsWithUnits} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>單字清單</CardTitle>
          <CardDescription>
            管理英文單字的清單。清單獨立於科目，匯入不同來源（如托福、雅思、學測）不會影響主要科目列表。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VocabularyListsManager lists={vocabularyLists} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>模擬考紀錄</CardTitle>
          <CardDescription>記錄每次模擬考成績，追蹤各科進步曲線。</CardDescription>
        </CardHeader>
        <CardContent>
          <MockExamManager subjects={subjects} initialRecords={mockExamRecords} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>讀書房與排行榜</CardTitle>
          <CardDescription>建立房間、複製邀請碼，跟朋友比本日或本週的計時讀書時間。</CardDescription>
        </CardHeader>
        <CardContent>
          <StudyGroupManagement groups={studyGroups} />
        </CardContent>
      </Card>
    </div>
  )
}
