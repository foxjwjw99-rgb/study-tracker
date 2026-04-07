import { getDueWrongQuestions, getWrongQuestionById } from "@/app/actions/wrong-questions"
import { getSubjects } from "@/app/actions/subject"
import { WrongBookReview } from "./wrong-book-review"

export default async function WrongQuestionsReviewPage({
  searchParams,
}: {
  searchParams: { questionId?: string }
}) {
  const questionId = searchParams.questionId

  const [subjects, dueItems] = await Promise.all([
    getSubjects(),
    questionId
      ? getWrongQuestionById(questionId).then((q) => (q ? [q] : []))
      : getDueWrongQuestions(),
  ])

  const subjectName = subjects.length === 1 ? subjects[0].name : undefined

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">錯題複習</h1>
        <p className="text-sm text-muted-foreground">
          {questionId
            ? "複習這道錯題。"
            : <>今天到期的錯題，共 <span className="font-medium text-foreground">{dueItems.length}</span> 題。</>
          }
        </p>
      </div>

      <WrongBookReview items={dueItems} subjectName={subjectName} />
    </div>
  )
}
