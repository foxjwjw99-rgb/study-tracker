import { redirect } from "next/navigation"

export default function VocabularyInsightsPage() {
  redirect("/vocabulary?tab=insights")
}
