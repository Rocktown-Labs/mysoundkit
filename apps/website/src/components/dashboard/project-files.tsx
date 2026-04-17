import {
  Upload,
  Download,
  Play,
  FileAudio,
  ImageIcon,
  File,
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

interface ProjectFilesProps {
  projectId: string;
}

const mockFiles = [
  {
    icon: FileAudio,
    id: 1,
    name: "Summer_Vibes_Instrumental_v3.wav",
    size: "45.2 MB",
    status: "complete",
    type: "instrumental",
    uploadedAt: "2 hours ago",
    uploadedBy: "You",
  },
  {
    icon: FileAudio,
    id: 2,
    name: "Lead_Vocals_Final.wav",
    size: "32.1 MB",
    status: "complete",
    type: "vocals",
    uploadedAt: "3 hours ago",
    uploadedBy: "Producer Mike",
  },
  {
    icon: FileAudio,
    id: 3,
    name: "Adlibs_Collection.wav",
    size: "18.7 MB",
    status: "complete",
    type: "adlibs",
    uploadedAt: "1 day ago",
    uploadedBy: "You",
  },
  {
    icon: File,
    id: 4,
    name: "Summer_Vibes_Session.logicx",
    size: "2.3 GB",
    status: "complete",
    type: "session",
    uploadedAt: "2 days ago",
    uploadedBy: "Producer Mike",
  },
  {
    icon: ImageIcon,
    id: 5,
    name: "Cover_Art_Final.png",
    size: "4.2 MB",
    status: "complete",
    type: "coverArt",
    uploadedAt: "1 week ago",
    uploadedBy: "You",
  },
  {
    icon: FileAudio,
    id: 6,
    name: "Reference_Track.mp3",
    size: "8.1 MB",
    status: "complete",
    type: "reference",
    uploadedAt: "2 weeks ago",
    uploadedBy: "Producer Mike",
  },
];

export function ProjectFiles({ projectId }: ProjectFilesProps) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-[family-name:var(--font-playfair)]">
              Project Files
            </CardTitle>
            <CardDescription>
              All files associated with this project
            </CardDescription>
          </div>
          <Button className="bg-primary hover:bg-primary/90">
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockFiles.map((file) => {
          const IconComponent = file.icon;
          return (
            <div
              key={file.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-background/50 hover:bg-background/80 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                  <IconComponent className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{file.name}</div>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {file.type}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {file.size}
                    </span>
                    <span className="text-sm text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">
                      {file.uploadedAt} by {file.uploadedBy}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {file.type === "instrumental" ||
                file.type === "vocals" ||
                file.type === "reference" ? (
                  <Button variant="ghost" size="sm">
                    <Play className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Upload Areas for Missing Files */}
        <div className="border-2 border-dashed border-border/40 rounded-lg p-6 text-center">
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop files here, or click to browse
          </p>
          <Button variant="outline" size="sm">
            Choose Files
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
