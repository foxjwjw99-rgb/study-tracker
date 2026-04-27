import { getDueWrongQuestions, getWrongQuestionById } from "@/app/actions/wrong-questions"
import { WrongBookReview } from "./wrong-book-review"

export default async function WrongQuestionsReviewPage({
  searchParams,
}: {
  searchParams: { questionId?: string }
}) {
  const questionId = searchParams.questionId

  const dueItems = questionId
    ? await getWrongQuestionById(questionId).then((q) => (q ? [q] : []))
    : await getDueWrongQuestions()

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

      <WrongBookReview items={dueItems} />
    </div>
  )
}
