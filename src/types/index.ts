import type {
  Prisma,
  Subject as PrismaSubject,
  User as PrismaUser,
} from "../../node_modules/.prisma/client"

export type Subject = Pick<PrismaSubject, "id" | "name" | "target_score" | "exam_weight">

export type SubjectDeletionImpact = {
  subjectId: string
  subjectName: string
  studyLogsCount: number
  practiceLogsCount: number
  wrongQuestionsCount: number
  reviewTasksCount: number
  questionsCount: number
  vocabularyWordsCount: number
  totalCount: number
}

export type CurrentUserSummary = Pick<
  PrismaUser,
  "id" | "name" | "exam_date" | "created_at"
>

export type StudyLogListItem = Prisma.StudyLogGetPayload<{
  include: {
    subject: {
      select: {
        id: true
        name: true
      }
    }
  }
}>

export type PracticeLogListItem = Prisma.PracticeLogGetPayload<{
  include: {
    subject: {
      select: {
        id: true
        name: true
      }
    }
  }
}>

export type ReviewTaskItem = Prisma.ReviewTaskGetPayload<{
  include: {
    subject: {
      select: {
        id: true
        name: true
      }
    }
    vocabulary_word: {
      select: {
        id: true
        word: true
        meaning: true
        status: true
        average_response_ms: true
      }
    }
  }
}>

export type WrongQuestionItem = Prisma.WrongQuestionGetPayload<{
  include: {
    subject: {
      select: {
        id: true
        name: true
      }
    }
  }
}>

export type DashboardTrendPoint = {
  date: string
  minutes: number
}

export type SubjectHoursItem = {
  subject: string
  minutes: number
}

export type WeakTopicItem = WrongQuestionItem

export type DashboardReviewFocusItem = {
  id: string
  topic: string
  reviewDate: Date
  reviewStage: number
  subject: {
    id: string
    name: string
  }
}

export type DashboardSubjectReadinessItem = {
  subjectId: string
  subjectName: string
  score: number
  level: "strong" | "steady" | "warning" | "danger"
  momentum: "up" | "steady" | "down"
  studyMinutes7d: number
  practiceAccuracy14d: number | null
  practiceCount14d: number
  dueReviews: number
  unresolvedWrongCount: number
  lastActivityDays: number | null
  weakTopic: string | null
  suggestedAction: string
  vocabularyDue: number
  vocabularyFamiliarRate: number | null
  vocabularyTotalWords: number
}

export type DashboardWeakAreaItem = {
  key: string
  subjectId: string
  subjectName: string
  topic: string
  score: number
  practiceAccuracy: number | null
  wrongCount: number
  dueReviews: number
  studyMinutes7d: number
  priority: "high" | "medium" | "low"
  note: string
}

export type DashboardPlanItem = {
  id: string
  title: string
  description: string
  reason: string
  href: string
  tone: "danger" | "warning" | "focus" | "success"
}

export type DashboardOnboardingStep = {
  id: string
  title: string
  description: string
  href: string
  completed: boolean
}

export type DashboardVocabularyOverview = {
  totalWords: number
  dueWords: number
  familiarRate: number | null
  reviewedThisWeek: number
  activeSubjects: number
}

export type DashboardSubjectCoverageItem = {
  subjectId: string
  subjectName: string
  totalTopics: number
  coveredTopics: number
  untouchedTopics: number
  activeTopics: number
  coverageRate: number
  weakTopic: string | null
}

export type DashboardTopicDetailItem = {
  key: string
  subjectId: string
  subjectName: string
  topic: string
  score: number
  status: "strong" | "steady" | "warning" | "danger"
  studyMinutes7d: number
  practiceAccuracy14d: number | null
  practiceCount14d: number
  dueReviews: number
  wrongCount: number
  hasActivity: boolean
  hasQuestionBank: boolean
  note: string
}

export type DashboardSubjectTopicSectionItem = {
  subjectId: string
  subjectName: string
  coverage: DashboardSubjectCoverageItem
  topics: DashboardTopicDetailItem[]
}

export type DashboardData = {
  daysUntilExam: number | null
  todaysStudyMinutes: number
  todaysAccuracy: number | null
  pendingReviews: number
  streakDays: number
  completedToday: boolean
  trendData: DashboardTrendPoint[]
  subjectHours: SubjectHoursItem[]
  weakTopics: WeakTopicItem[]
  nextReviewFocus: DashboardReviewFocusItem[]
  subjectReadiness: DashboardSubjectReadinessItem[]
  weakestAreas: DashboardWeakAreaItem[]
  subjectCoverage: DashboardSubjectCoverageItem[]
  subjectTopicSections: DashboardSubjectTopicSectionItem[]
  todayPlan: DashboardPlanItem[]
  onboardingSteps: DashboardOnboardingStep[]
  vocabularyOverview: DashboardVocabularyOverview
  recommendation: string
  hasData: boolean
}

export type SubjectStatsItem = {
  id: string
  name: string
  totalQuestions: number
  accuracy: number | null
}

export type HighEffortLowReturnItem = {
  subject: string
  topic: string
  timeSpent: number
  accuracy: number
  avgAccuracy: number
}

export type AccuracyTrendPoint = {
  date: string
  accuracy: number
}

export type VocabularyOverview = {
  totalWords: number
  reviewedToday: number
  reviewedThisWeek: number
  dueWords: number
  familiarRate: number
  masteredWords: number
  masteredRate: number
}

export type VocabularyStatusDistributionItem = {
  key: "NEW" | "LEARNING" | "FAMILIAR"
  label: string
  count: number
}

export type VocabularyDailyTrendPoint = {
  date: string
  reviewedWords: number
  reviewCount: number
}

export type VocabularyDifficultyItem = {
  id: string
  word: string
  meaning: string
  subjectName: string
  status: "NEW" | "LEARNING" | "FAMILIAR"
  lapseCount: number
  easeFactor: number
  reviewCount: number
  averageResponseMs: number | null
  averageConfidence: number | null
  intervalDays: number
}

export type VocabularySubjectProgressItem = {
  subjectId: string
  subjectName: string
  totalWords: number
  dueWords: number
  familiarWords: number
  familiarRate: number
  reviewedThisWeek: number
}

export type AnalyticsData = {
  subjectStats: SubjectStatsItem[]
  highEffortLowReturn: HighEffortLowReturnItem[]
  accuracyTrend: AccuracyTrendPoint[]
  vocabularyOverview: VocabularyOverview
  vocabularyStatusDistribution: VocabularyStatusDistributionItem[]
  vocabularyTrend: VocabularyDailyTrendPoint[]
  vocabularyDifficultWords: VocabularyDifficultyItem[]
  vocabularySubjectProgress: VocabularySubjectProgressItem[]
}

export type ActionResult = {
  success: boolean
  message: string
}

export type RewardDrawItem = Prisma.RewardDrawGetPayload<Record<string, never>>

export type RewardsOverview = {
  totalStudyMinutes: number
  earnedDraws: number
  usedDraws: number
  availableDraws: number
  carryMinutes: number
  totalRewardValue: number
  redeemedValue: number
  pendingRedeemValue: number
  expectedValuePerHour: number
}

export type RewardsData = {
  overview: RewardsOverview
  recentDraws: RewardDrawItem[]
}

export type RewardDrawActionResult = ActionResult & {
  reward?: RewardDrawItem
  remainingDraws?: number
}

export type StudyGroupSummary = {
  id: string
  name: string
  invite_code: string
  memberCount: number
  isOwner: boolean
}

export type LeaderboardPeriod = "today" | "week"

export type StudyLeaderboardEntry = {
  userId: string
  userName: string
  totalMinutes: number
  totalSessions: number
  rank: number
  isCurrentUser: boolean
}

export type StudyLeaderboardData = {
  groups: StudyGroupSummary[]
  activeGroup: StudyGroupSummary | null
  activePeriod: LeaderboardPeriod
  entries: StudyLeaderboardEntry[]
  currentUserEntry: StudyLeaderboardEntry | null
}

export type VocabularyStatus = "NEW" | "LEARNING" | "FAMILIAR"
export type VocabularyStatusFilter = "all" | "due" | "new" | "learning" | "familiar"
export type VocabularyReviewRating = "hard" | "okay" | "easy"
export type VocabularyConfidenceLevel = 1 | 2 | 3 | 4 | 5

export type VocabularyWordItem = Prisma.VocabularyWordGetPayload<{
  include: {
    subject: {
      select: {
        id: true
        name: true
      }
    }
  }
}>

export type VocabularyImportItem = {
  subject: string
  word: string
  part_of_speech?: string
  meaning: string
  example_sentence: string
}

export type VocabularyBankItem = {
  subject_id: string
  subject_name: string
  word_count: number
}

export type VocabularyQueueItem = {
  id: string
  word: string
  part_of_speech: string | null
  meaning: string
  example_sentence: string
  example_sentence_translation: string | null
  status: VocabularyStatus
  subject_id: string
  subject_name: string
  next_review_date: Date | null
  last_reviewed_at: Date | null
  ease_factor: number
  interval_days: number
  review_count: number
  lapse_count: number
  average_response_ms: number | null
  average_confidence: number | null
}

export type VocabularyReviewInput = {
  rating: VocabularyReviewRating
  confidence: VocabularyConfidenceLevel
  response_ms: number
  review_task_id?: string
}

export type VocabularyReviewUpdateResult = ActionResult & {
  word: VocabularyQueueItem
}

export type VocabularySessionResult = ActionResult & {
  reviewedCount: number
}

export type VocabularyReviewLogItem = {
  id: string
  user_id: string
  subject_id: string
  vocabulary_word_id: string
  review_task_id: string | null
  rating: string
  confidence: number
  response_ms: number
  quality: number
  scheduled_days: number
  elapsed_days: number
  interval_days: number
  ease_factor: number
  created_at: Date
}

// --- Exam Forecast ---

export type UnitForecastItem = {
  unitName: string
  weight: number        // 0.0–1.0 (normalised within subject)
  accuracy: number | null  // null = no practice data
  isCovered: boolean
  contribution: number  // weight × accuracy × 100
}

export type SubjectForecastItem = {
  subjectId: string
  subjectName: string
  examWeight: number | null  // 0.0–1.0, null = not configured
  targetScore: number        // from Subject.target_score (default 60 if unset)
  estimatedScore: number     // 0–100
  units: UnitForecastItem[]
}

export type ExamForecastData = {
  isConfigured: boolean        // false if no syllabus units exist for this user
  estimatedTotalScore: number  // 0–100 weighted total
  targetTotalScore: number     // Σ(exam_weight × target_score)
  probability: number          // 0–100 logistic estimate
  subjectBreakdown: SubjectForecastItem[]
  highRiskUnits: (UnitForecastItem & { subjectName: string })[]  // high weight, low accuracy
}

// --- end Exam Forecast ---

export type QuestionVisibility = "private" | "study_group"

export type QuestionImportTarget = {
  visibility: QuestionVisibility
  shared_study_group_id?: string
}

export type PracticeQuestionBankSummary = {
  subject_id: string
  subject_name: string
  question_count: number
  private_question_count: number
  shared_question_count: number
}

export type PracticeQuestionItem = {
  id: string
  source_question_id?: string
  subject_id: string
  subject_name: string
  topic: string
  question: string
  options: string[]
  answer: number
  explanation: string | null
  image_url?: string | null
  visibility?: QuestionVisibility
  shared_study_group_id?: string | null
  shared_study_group_name?: string | null
}

export type PracticeQuestionAnswerInput = {
  question_id: string
  selected_answer: number | null
}

export type PracticeQuestionSessionResult = ActionResult & {
  totalQuestions: number
  correctQuestions: number
  wrongQuestionCount: number
}
