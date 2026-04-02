import { getSubjects, getExamUnits } from "@/app/actions/subject"
import { SubjectForm } from "./subject-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExamDateForm } from "./exam-date-form"
import { SubjectsList } from "./subjects-list"
import { UserManagement } from "./user-management"
import { StudyGroupManagement } from "./study-group-management"
import { ExamScopeForm } from "./exam-scope-form"
import { getStudyGroupsForCurrentUser } from "@/app/actions/study-group"
import { resolveCurrentUserContext, toCurrentUserSummary } from "@/lib/current-user"

export default async function SettingsPage() {
  const { user } = await resolveCurrentUserContext()
  const currentUser = toCurrentUserSummary(user)
  const subjects = await getSubjects()
  const examUnits = await getExamUnits()
  const studyGroups = await getStudyGroupsForCurrentUser()

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">設定</h1>
        <p className="text-muted-foreground">管理帳號、科目與讀書房。考試日期已移到 Dashboard 可直接調整。</p>
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
            預先定義每個科目的考試單元，讓 Dashboard 的覆蓋率計算更準確。貼上 JSON 後點「確認儲存」，會取代該科目原有的單元設定。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExamScopeForm initialData={examUnits} />
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
