"use client"

import { FlaskConical } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ScoreSimulation } from "@/types"

function ScenarioRow({
  scenario,
  currentMedian,
}: {
  scenario: ScoreSimulation["scenarios"][number]
  currentMedian: number
}) {
  const startPct = Math.min(100, Math.max(0, currentMedian))
  const endPct = Math.min(100, Math.max(0, scenario.projectedMedian))
  const width = Math.max(0, endPct - startPct)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{scenario.label}</span>
        <span className="tabular-nums">
          <span className="text-muted-foreground">{currentMedian}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="font-semibold text-foreground">{scenario.projectedMedian}</span>
          <span className="ml-1.5 font-semibold text-emerald-600">+{scenario.delta}</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 rounded-full bg-sky-200"
          style={{ left: 0, width: `${startPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-emerald-400"
          style={{ left: `${startPct}%`, width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export function ScoreSimulationCard({ simulations }: { simulations: ScoreSimulation[] }) {
  const meaningful = simulations.filter((s) => s.scenarios.length > 0)
  if (meaningful.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-sky-500" />
          模擬補分情境
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          用同一份公式試算：若你完成下列條件，科目分數會變成多少。
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {meaningful.map((sim) => {
          const maxProjected = Math.max(sim.currentMedian, ...sim.scenarios.map((s) => s.projectedMedian))
          return (
            <div key={sim.subjectId} className="space-y-2.5">
              <div className="flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {sim.subjectName}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    目前 {sim.currentMedian} 分，最多可達{" "}
                    <span className="font-medium text-foreground tabular-nums">{maxProjected}</span>
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {sim.scenarios.map((scenario, i) => (
                  <ScenarioRow key={i} scenario={scenario} currentMedian={sim.currentMedian} />
                ))}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
