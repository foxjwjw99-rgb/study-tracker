import { getSubjects } from "@/app/actions/subject"
import { SubjectForm } from "./subject-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExamDateForm } from "./exam-date-form"
import { SubjectsList } from "./subjects-list"
import { UserManagement } from "./user-management"
import { StudyGroupManagement } from "./study-group-management"
import { getStudyGroupsForCurrentUser } from "@/app/actions/study-group"
import {
  listUserSummaries,
  resolveCurrentUserContext,
  toCurrentUserSummary,
} from "@/lib/current-user"

export default async function SettingsPage() {
  const { user } = await resolveCurrentUserContext()
  const currentUser = toCurrentUserSummary(user)
  const users = await listUserSummaries()
  const subjects = await getSubjects()
  const studyGroups = await getStudyGroupsForCurrentUser()

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">設定</h1>
        <p className="text-muted-foreground">管理使用者、科目與讀書房。考試日期已移到 Dashboard 可直接調整。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>使用者切換</CardTitle>
          <CardDescription>在沒有登入系統前，使用這裡切換目前操作中的使用者。</CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagement currentUser={currentUser} users={users} />
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
