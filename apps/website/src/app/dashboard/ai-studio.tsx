import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/ai-studio")({
  component: DashboardAIStudioRoute,
});

function DashboardAIStudioRoute() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-8">
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="text-2xl font-bold font-[family-name:var(--font-playfair)] flex items-center gap-2">
            <Sparkles className="size-6 text-emerald-400" />
            AI Creative Studio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Generate cover art, video storyboards, and social media campaigns
            powered by Google Gemini APIs and tied directly to your song lyrics.
          </p>
          <Button
            asChild
            className="bg-emerald-600 hover:bg-emerald-700 font-bold gap-2"
          >
            <Link to="/dashboard/career/ai-studio">
              Launch AI Creative Studio <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
