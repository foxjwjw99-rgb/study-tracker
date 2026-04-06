import { getAdmissionEvaluationV2 } from "@/app/actions/admission-evaluation"
import { AdmissionDashboard } from "./admission-dashboard"

type Props = {
  searchParams: Promise<{ target?: string }>
}

export default async function AdmissionPage({ searchParams }: Props) {
  const { target } = await searchParams
  const data = await getAdmissionEvaluationV2(target)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">上榜評估</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          根據目前準備進度，預估各科分數與上榜機率。
        </p>
      </div>

      <AdmissionDashboard initialData={data} />
    </div>
  )
}
