import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type PageSkeletonProps = {
  headerLines?: number
  cards?: number
  listItems?: number
  className?: string
}

export function PageSkeleton({
  headerLines = 2,
  cards = 2,
  listItems = 4,
  className,
}: PageSkeletonProps) {
  return (
    <div className={className ?? "mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8"}>
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: headerLines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full max-w-md" />
        ))}
      </div>

      {cards > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 px-5 py-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: listItems }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
