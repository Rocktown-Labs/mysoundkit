import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Post {
  id: string;
  type: "track" | "project" | "media" | "battle";
  image: string;
  title?: string;
  description?: string;
  likes: number;
  comments: number;
  artist: {
    name: string;
    avatar: string;
    username: string;
  };
}

interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  allPosts: Post[];
  currentIndex: number;
  onNavigate: (direction: "prev" | "next") => void;
}

export function PostDetailModal({
  post,
  isOpen,
  onClose,
  allPosts,
  currentIndex,
  onNavigate,
}: PostDetailModalProps) {
  const [isLiked, setIsLiked] = useState(false),
    [isSaved, setIsSaved] = useState(false);

  if (!post) {
    return null;
  }

  const hasPrev = currentIndex > 0,
    hasNext = currentIndex < allPosts.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] p-0 gap-0">
        <div className="grid md:grid-cols-[1fr_400px] lg:grid-cols-[1fr_500px] h-full">
          {/* Image Section */}
          <div className="relative bg-black flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
              onClick={onClose}
            >
              <X className="size-5" />
            </Button>

            {/* Navigation Arrows */}
            {hasPrev && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                onClick={() => onNavigate("prev")}
              >
                ←
              </Button>
            )}
            {hasNext && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                onClick={() => onNavigate("next")}
              >
                →
              </Button>
            )}

            <AppImage
              src={post.image || "/placeholder.svg"}
              alt={post.title || "Post"}
              width={1080}
              height={1080}
              layout="constrained"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Details Section */}
          <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage src={post.artist.avatar || "/placeholder.svg"} />
                  <AvatarFallback>{post.artist.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{post.artist.name}</p>
                  <p className="text-xs text-muted-foreground">
                    @{post.artist.username}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="size-5" />
              </Button>
            </div>

            {/* Comments/Description */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {post.description && (
                <div className="flex gap-3">
                  <Avatar className="size-8">
                    <AvatarImage
                      src={post.artist.avatar || "/placeholder.svg"}
                    />
                    <AvatarFallback>{post.artist.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-semibold text-sm">
                      {post.artist.name}
                    </span>{" "}
                    <span className="text-sm">{post.description}</span>
                  </div>
                </div>
              )}

              {/* Mock Comments */}
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Avatar className="size-8">
                      <AvatarImage src="/soundkit-default-avatar.svg" />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-semibold text-sm">user{i}</span>{" "}
                      <span className="text-sm">This is amazing! 🔥</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        2h ago
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="border-t p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsLiked(!isLiked)}
                    className={isLiked ? "text-red-500" : ""}
                  >
                    <Heart
                      className={`size-6 ${isLiked ? "fill-current" : ""}`}
                    />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MessageCircle className="size-6" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Send className="size-6" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSaved(!isSaved)}
                >
                  <Bookmark
                    className={`size-6 ${isSaved ? "fill-current" : ""}`}
                  />
                </Button>
              </div>

              <div>
                <p className="font-semibold text-sm">
                  {post.likes.toLocaleString()} likes
                </p>
                <p className="text-xs text-muted-foreground">2 days ago</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
