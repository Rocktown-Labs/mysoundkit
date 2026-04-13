import { createFileRoute } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"

const conversations = [
  {
    id: 1,
    name: "Sarah Johnson",
    avatar: "/diverse-user-avatars.png",
    lastMessage: "Hey! I added the vocals to the track",
    timestamp: "2m ago",
    unread: 2,
  },
  {
    id: 2,
    name: "Mike Chen",
    avatar: "/diverse-user-avatars.png",
    lastMessage: "Can you check the mix on 'Summer Vibes'?",
    timestamp: "1h ago",
    unread: 0,
  },
  {
    id: 3,
    name: "Alex Rivera",
    avatar: "/diverse-user-avatars.png",
    lastMessage: "The session file is ready for download",
    timestamp: "3h ago",
    unread: 1,
  },
]

export const Route = createFileRoute('/dashboard/messages')({
  component: MessagesPage,
})

function MessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState(conversations[0])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">Messages</h1>
        <p className="text-muted-foreground">Chat with your collaborators</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
        {/* Conversations List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search messages..." className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`w-full flex items-center gap-3 p-4 hover:bg-accent transition-colors ${
                    selectedConversation.id === conversation.id ? "bg-accent" : ""
                  }`}
                >
                  <Avatar>
                    <AvatarImage src={conversation.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{conversation.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm truncate">{conversation.name}</p>
                      {conversation.unread > 0 && <Badge className="ml-2">{conversation.unread}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conversation.lastMessage}</p>
                    <p className="text-xs text-muted-foreground mt-1">{conversation.timestamp}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="md:col-span-2 flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={selectedConversation.avatar || "/placeholder.svg"} />
                <AvatarFallback>{selectedConversation.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{selectedConversation.name}</CardTitle>
                <p className="text-xs text-muted-foreground">Active now</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex gap-3">
                <Avatar className="size-8">
                  <AvatarImage src={selectedConversation.avatar || "/placeholder.svg"} />
                  <AvatarFallback>{selectedConversation.name[0]}</AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                  <p className="text-sm">Hey! I added the vocals to the track. Can you check it out?</p>
                  <p className="text-xs text-muted-foreground mt-1">2m ago</p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="bg-primary text-primary-foreground rounded-lg p-3 max-w-[70%]">
                  <p className="text-sm">Sounds great! I'll review it tonight.</p>
                  <p className="text-xs opacity-70 mt-1">Just now</p>
                </div>
              </div>
            </div>
          </CardContent>
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input placeholder="Type a message..." />
              <Button size="icon">
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
