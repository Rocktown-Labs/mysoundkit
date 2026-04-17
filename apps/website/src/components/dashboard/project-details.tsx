import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Edit,
  Share,
  Download,
  CheckCircle,
  Clock,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ProjectDetailsProps {
  projectId: string;
}

// Mock data - in real app this would come from API
const mockProject = {
  bpm: 128,
  collaborators: ["You", "Producer Mike"],
  createdAt: "2024-01-15",
  description:
    "Upbeat track for summer playlist with tropical influences and catchy hooks",
  genre: "Pop",
  id: 1,
  key: "C Major",
  lastUpdated: "2 hours ago",
  mastered: true,
  mixed: true,
  name: "Summer Vibes",
  progress: 100,
  status: "complete",
};

export function ProjectDetails({ projectId }: ProjectDetailsProps) {
  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center space-x-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Projects</span>
      </Link>

      {/* Project Header */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <CardTitle className="text-2xl font-[family-name:var(--font-playfair)]">
                  {mockProject.name}
                </CardTitle>
                <Badge
                  variant={
                    mockProject.status === "complete" ? "default" : "secondary"
                  }
                  className={
                    mockProject.status === "complete"
                      ? "bg-primary/20 text-primary border-primary/30"
                      : "bg-accent/20 text-accent border-accent/30"
                  }
                >
                  {mockProject.status === "complete" ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <Clock className="h-3 w-3 mr-1" />
                  )}
                  {mockProject.status.charAt(0).toUpperCase() +
                    mockProject.status.slice(1)}
                </Badge>
              </div>
              <CardDescription className="text-base">
                {mockProject.description}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button className="bg-primary hover:bg-primary/90">
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Project Progress</span>
              <span className="text-sm text-muted-foreground">
                {mockProject.progress}%
              </span>
            </div>
            <Progress value={mockProject.progress} className="h-3" />
          </div>

          {/* Project Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="font-medium">{mockProject.createdAt}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
              <div className="font-medium">{mockProject.lastUpdated}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Genre</div>
              <div className="font-medium">{mockProject.genre}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">BPM</div>
              <div className="font-medium">{mockProject.bpm}</div>
            </div>
          </div>

          {/* Production Status */}
          <div className="flex items-center space-x-6">
            <div
              className={`flex items-center space-x-2 ${mockProject.mixed ? "text-primary" : "text-muted-foreground"}`}
            >
              <CheckCircle
                className={`h-4 w-4 ${mockProject.mixed ? "text-primary" : "text-muted"}`}
              />
              <span className="font-medium">Mixed</span>
            </div>
            <div
              className={`flex items-center space-x-2 ${mockProject.mastered ? "text-primary" : "text-muted-foreground"}`}
            >
              <CheckCircle
                className={`h-4 w-4 ${mockProject.mastered ? "text-primary" : "text-muted"}`}
              />
              <span className="font-medium">Mastered</span>
            </div>
          </div>

          {/* Collaborators */}
          <div>
            <div className="text-sm text-muted-foreground mb-2">
              Collaborators
            </div>
            <div className="flex items-center space-x-2">
              {mockProject.collaborators.map((collaborator, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-background/50"
                >
                  {collaborator}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
