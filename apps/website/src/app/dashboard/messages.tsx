import { createFileRoute } from "@tanstack/react-router";
import { 
  Search, 
  Send, 
  MoreHorizontal, 
  Phone, 
  Video, 
  Info, 
  Paperclip, 
  Mic, 
  Image as ImageIcon,
  Check,
  CheckCheck,
  Circle,
  Pin,
  Star
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const conversations = [
  {
    avatar: "/diverse-user-avatars.png",
    id: 1,
    lastMessage: "Hey! I added the vocals to the track. Can you check it out?",
    name: "Sarah Johnson",
    timestamp: "2m ago",
    unread: 2,
    online: true,
    pinned: true,
    role: "Vocalist"
  },
  {
    avatar: "/diverse-user-avatars.png",
    id: 2,
    lastMessage: "Can you check the mix on 'Summer Vibes'?",
    name: "Mike Chen",
    timestamp: "1h ago",
    unread: 0,
    online: false,
    pinned: true,
    role: "Producer"
  },
  {
    avatar: "/diverse-user-avatars.png",
    id: 3,
    lastMessage: "The session file is ready for download",
    name: "Alex Rivera",
    timestamp: "3h ago",
    unread: 1,
    online: true,
    pinned: false,
    role: "Engineer"
  },
  {
    avatar: "/diverse-user-avatars.png",
    id: 4,
    lastMessage: "Let's record the ad-libs tomorrow.",
    name: "Jordan Smith",
    timestamp: "5h ago",
    unread: 0,
    online: false,
    pinned: false,
    role: "Artist"
  },
];

const mockMessages = [
  { id: 1, sender: "them", text: "Hey! How's the new project coming along?", time: "10:00 AM", status: "read" },
  { id: 2, sender: "me", text: "It's going great! Just finishing up the main melody.", time: "10:05 AM", status: "read" },
  { id: 3, sender: "them", text: "Awesome. I've got some vocal stems ready when you need them.", time: "10:06 AM", status: "read" },
  { id: 4, sender: "them", text: "Hey! I added the vocals to the track. Can you check it out?", time: "2m ago", status: "sent" },
];

export const Route = createFileRoute("/dashboard/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const [selectedId, setSelectedId] = useState(conversations[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);

  const selectedConversation = useMemo(() => 
    conversations.find(c => c.id === selectedId) || conversations[0],
    [selectedId]
  );

  const filteredConversations = conversations.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const rowVirtualizer = useVirtualizer({
    count: mockMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-playfair)] tracking-tight">
            Messages
          </h1>
          <p className="text-muted-foreground mt-1">Chat with your collaborators</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-card/40 border-border/40">
            <Star className="mr-2 size-3.5" />
            Starred
          </Button>
          <Button size="sm" className="shadow-lg shadow-primary/20">
            New Chat
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          <Card className="flex flex-col bg-card/40 backdrop-blur-md border-border/40 overflow-hidden h-full">
            <div className="p-4 border-b border-border/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Search chats..." 
                  className="pl-9 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {/* Pinned Section */}
              <div className="px-2 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-2 flex items-center gap-1.5">
                  <Pin className="size-3" />
                  Pinned
                </p>
                {filteredConversations.filter(c => c.pinned).map((conv) => (
                  <ConversationItem 
                    key={conv.id} 
                    conversation={conv} 
                    isSelected={selectedId === conv.id}
                    onClick={() => setSelectedId(conv.id)}
                  />
                ))}
              </div>

              {/* All Messages */}
              <div className="px-2 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-2">
                  Recent
                </p>
                {filteredConversations.filter(c => !c.pinned).map((conv) => (
                  <ConversationItem 
                    key={conv.id} 
                    conversation={conv} 
                    isSelected={selectedId === conv.id}
                    onClick={() => setSelectedId(conv.id)}
                  />
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Chat Main Area */}
        <div className="hidden md:flex flex-1 flex-col h-full overflow-hidden">
          <Card className="flex flex-col flex-1 bg-card/20 backdrop-blur-xl border-border/40 overflow-hidden relative shadow-2xl">
            {/* Background Accent */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

            {/* Chat Header */}
            <div className="p-4 border-b border-border/20 flex items-center justify-between bg-white/[0.02] backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="size-10 border-2 border-border/40">
                    <AvatarImage src={selectedConversation.avatar} />
                    <AvatarFallback>{selectedConversation.name[0]}</AvatarFallback>
                  </Avatar>
                  {selectedConversation.online && (
                    <span className="absolute bottom-0 right-0 size-3 bg-emerald-500 border-2 border-card rounded-full" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-none">{selectedConversation.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      {selectedConversation.role}
                    </span>
                    <span className="text-[10px] text-emerald-500 font-medium">
                      {selectedConversation.online ? "Online" : "Away"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-9 rounded-full hover:bg-white/5">
                  <Phone className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-9 rounded-full hover:bg-white/5">
                  <Video className="size-4" />
                </Button>
                <div className="w-px h-4 bg-border/20 mx-1" />
                <Button variant="ghost" size="icon" className="size-9 rounded-full hover:bg-white/5">
                  <Info className="size-4" />
                </Button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div 
              ref={parentRef} 
              className="flex-1 overflow-y-auto p-6 custom-scrollbar z-10"
            >
              <div 
                className="relative"
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                  const message = mockMessages[virtualItem.index];
                  return (
                    <div
                      key={virtualItem.key}
                      className={cn(
                        "absolute top-0 left-0 w-full flex mb-6",
                        message.sender === "me" ? "justify-end" : "justify-start"
                      )}
                      style={{
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <div className={cn(
                        "flex gap-3 max-w-[80%]",
                        message.sender === "me" ? "flex-row-reverse" : "flex-row"
                      )}>
                        {message.sender === "them" && (
                          <Avatar className="size-8 self-end mb-1">
                            <AvatarImage src={selectedConversation.avatar} />
                            <AvatarFallback>{selectedConversation.name[0]}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex flex-col gap-1">
                          <div className={cn(
                            "px-4 py-3 rounded-2xl shadow-sm",
                            message.sender === "me" 
                              ? "bg-primary text-primary-foreground rounded-br-none" 
                              : "bg-muted/80 backdrop-blur-md text-foreground rounded-bl-none border border-border/20"
                          )}>
                            <p className="text-sm leading-relaxed">{message.text}</p>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1.5 px-1",
                            message.sender === "me" ? "justify-end" : "justify-start"
                          )}>
                            <span className="text-[10px] text-muted-foreground/60 font-medium">
                              {message.time}
                            </span>
                            {message.sender === "me" && (
                              <span className="text-primary/70">
                                {message.status === "read" ? <CheckCheck className="size-3" /> : <Check className="size-3" />}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chat Input Area */}
            <div className="p-4 border-t border-border/20 bg-white/[0.01] z-10">
              <div className="flex items-center gap-2 bg-muted/40 backdrop-blur-xl border border-border/20 rounded-2xl p-1.5 pl-3 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <Button variant="ghost" size="icon" className="size-8 rounded-xl text-muted-foreground hover:text-primary">
                  <Paperclip className="size-4" />
                </Button>
                <Input 
                  placeholder="Type your message..." 
                  className="bg-transparent border-none focus-visible:ring-0 text-sm h-10 px-1"
                />
                <div className="flex items-center gap-1 px-1">
                  <Button variant="ghost" size="icon" className="size-8 rounded-xl text-muted-foreground hover:text-primary">
                    <ImageIcon className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 rounded-xl text-muted-foreground hover:text-primary">
                    <Mic className="size-4" />
                  </Button>
                </div>
                <Button className="size-10 rounded-xl shadow-lg shadow-primary/20 shrink-0">
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ConversationItem({ conversation, isSelected, onClick }: { 
  conversation: any, 
  isSelected: boolean,
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative",
        isSelected 
          ? "bg-primary/10 border border-primary/20 shadow-sm" 
          : "hover:bg-muted/50 border border-transparent"
      )}
    >
      {isSelected && (
        <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
      )}
      <div className="relative">
        <Avatar className="size-11 border-2 border-border/10 group-hover:border-primary/20 transition-colors">
          <AvatarImage src={conversation.avatar || "/placeholder.svg"} />
          <AvatarFallback className="bg-muted text-xs">{conversation.name[0]}</AvatarFallback>
        </Avatar>
        {conversation.online && (
          <span className="absolute bottom-0 right-0 size-3 bg-emerald-500 border-2 border-card rounded-full" />
        )}
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className={cn(
            "font-semibold text-xs transition-colors",
            isSelected ? "text-primary" : "text-foreground"
          )}>
            {conversation.name}
          </p>
          <span className="text-[10px] text-muted-foreground/60 font-medium">
            {conversation.timestamp}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground/80 truncate pr-4 leading-normal">
          {conversation.lastMessage}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-bold">
            {conversation.role}
          </span>
          {conversation.unread > 0 && (
            <div className="size-4 bg-primary rounded-full flex items-center justify-center">
              <span className="text-[9px] font-bold text-primary-foreground">{conversation.unread}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
