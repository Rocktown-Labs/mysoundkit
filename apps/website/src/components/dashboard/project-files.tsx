import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, Play, FileAudio, ImageIcon, File } from "lucide-react"

interface ProjectFilesProps {
  projectId: string
}

const mockFiles = [
  {
    id: 1,
    name: "Summer_Vibes_Instrumental_v3.wav",
    type: "instrumental",
    size: "45.2 MB",
    uploadedAt: "2 hours ago",
    uploadedBy: "You",
    status: "complete",
    icon: FileAudio,
  },
  {
    id: 2,
    name: "Lead_Vocals_Final.wav",
    type: "vocals",
    size: "32.1 MB",
    uploadedAt: "3 hours ago",
    uploadedBy: "Producer Mike",
    status: "complete",
    icon: FileAudio,
  },
  {
    id: 3,
    name: "Adlibs_Collection.wav",
    type: "adlibs",
    size: "18.7 MB",
    uploadedAt: "1 day ago",
    uploadedBy: "You",
    status: "complete",
    icon: FileAudio,
  },
  {
    id: 4,
    name: "Summer_Vibes_Session.logicx",
    type: "session",
    size: "2.3 GB",
    uploadedAt: "2 days ago",
    uploadedBy: "Producer Mike",
    status: "complete",
    icon: File,
  },
  {
    id: 5,
    name: "Cover_Art_Final.png",
    type: "coverArt",
    size: "4.2 MB",
    uploadedAt: "1 week ago",
    uploadedBy: "You",
    status: "complete",
    icon: ImageIcon,
  },
  {
    id: 6,
    name: "Reference_Track.mp3",
    type: "reference",
    size: "8.1 MB",
    uploadedAt: "2 weeks ago",
    uploadedBy: "Producer Mike",
    status: "complete",
    icon: FileAudio,
  },
]

export function ProjectFiles({ projectId }: ProjectFilesProps) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-[family-name:var(--font-playfair)]">Project Files</CardTitle>
            <CardDescription>All files associated with this project</CardDescription>
          </div>
          <Button className="bg-primary hover:bg-primary/90">
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockFiles.map((file) => {
          const IconComponent = file.icon
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
                    <span className="text-sm text-muted-foreground">{file.size}</span>
                    <span className="text-sm text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">
                      {file.uploadedAt} by {file.uploadedBy}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {file.type === "instrumental" || file.type === "vocals" || file.type === "reference" ? (
                  <Button variant="ghost" size="sm">
                    <Play className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}

        {/* Upload Areas for Missing Files */}
        <div className="border-2 border-dashed border-border/40 rounded-lg p-6 text-center">
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">Drag and drop files here, or click to browse</p>
          <Button variant="outline" size="sm">
            Choose Files
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
