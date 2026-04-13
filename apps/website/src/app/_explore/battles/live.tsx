import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BattleViewAll } from "@/components/explore/battle-view-all"

export const Route = createFileRoute('/_explore/battles/live')({
  component: LiveBattlesPage,
})

function LiveBattlesPage() {
  const router = useRouter()

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 pb-24 md:pb-12">
      <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="mb-4">
        <ArrowLeft className="size-4 mr-2" />
        Back
      </Button>

      <BattleViewAll type="live" title="Live Battles" description="Watch battles happening right now" />
    </div>
  )
}
