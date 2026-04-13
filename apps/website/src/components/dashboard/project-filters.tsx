import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function ProjectFilters() {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-[family-name:var(--font-playfair)]">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Filter */}
        <div>
          <h3 className="text-sm font-medium mb-3">Status</h3>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" className="rounded border-border" defaultChecked />
              <span>Complete</span>
              <span className="ml-auto text-xs text-muted-foreground">3</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" className="rounded border-border" defaultChecked />
              <span>In Progress</span>
              <span className="ml-auto text-xs text-muted-foreground">5</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span>Draft</span>
              <span className="ml-auto text-xs text-muted-foreground">2</span>
            </label>
          </div>
        </div>

        <Separator />

        {/* File Type Filter */}
        <div>
          <h3 className="text-sm font-medium mb-3">Has Files</h3>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span>Instrumental</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span>Vocals</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span>Session Files</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span>Cover Art</span>
            </label>
          </div>
        </div>

        <Separator />

        {/* Production Status */}
        <div>
          <h3 className="text-sm font-medium mb-3">Production</h3>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span>Mixed</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="checkbox" className="rounded border-border" />
              <span>Mastered</span>
            </label>
          </div>
        </div>

        <Separator />

        {/* Date Range */}
        <div>
          <h3 className="text-sm font-medium mb-3">Last Updated</h3>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm">
              <input type="radio" name="date" className="rounded-full border-border" />
              <span>Today</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="radio" name="date" className="rounded-full border-border" />
              <span>This Week</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="radio" name="date" className="rounded-full border-border" />
              <span>This Month</span>
            </label>
            <label className="flex items-center space-x-2 text-sm">
              <input type="radio" name="date" className="rounded-full border-border" defaultChecked />
              <span>All Time</span>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
