import { createFileRoute } from "@tanstack/react-router"
import { NewTrackForm } from "@/components/dashboard/new-track-form"

export const Route = createFileRoute('/dashboard/tracks/new')({
  component: NewTrackPage,
})

function NewTrackPage() {
  return (
    
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">Create New Track</h1>
          <p className="text-muted-foreground">Add a new track to your music library</p>
        </div>
        <NewTrackForm />
      </div>
    
  )
}
