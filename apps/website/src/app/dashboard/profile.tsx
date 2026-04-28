"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Grid3x3,
  Music,
  LayoutGrid,
  Film,
  Heart,
  MessageCircle,
  LoaderCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";

import { ProfileShell } from "@/components/dashboard/profile/profile-shell";
import { AppImage } from "@/components/ui/app-image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard/profile")({
  component: DashboardProfilePage,
});

// Mock fetch function for infinite scroll
const fetchPosts = async ({ pageParam = 0 }) => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return Array.from({ length: 9 }, (_, i) => ({
    artist: {
      avatar: "/diverse-user-avatars.png",
      name: "John Doe",
      username: "johndoe",
    },
    comments: Math.floor(Math.random() * 200) + 10,
    id: `post-${pageParam}-${i}`,
    image: [
      "/summer-music-album-cover.png",
      "/night-music-album-cover.png",
      "/hip-hop-album-cover.png",
      "/acoustic-guitar-album.png",
    ][(pageParam * 9 + i) % 4],
    likes: Math.floor(Math.random() * 5000) + 100,
    title: `Release ${pageParam * 9 + i + 1}`,
    type: i % 3 === 0 ? "project" : (i % 3 === 1 ? "video" : "track"),
  }));
};

function DashboardProfilePage() {
  const { ref, inView } = useInView();

  const user = {
    avatar: "/diverse-user-avatars.png",
    battleRank: "#4",
    battleRecord: "32-6",
    bio: "Hip-hop producer and artist based in LA. Creating vibes since 2020. 💎",
    coverImage: "/hip-hop-battle-stage.jpg",
    followers: "5.2K",
    following: "342",
    genre: "Hip-Hop / Rap",
    joinedDate: "Jan 2024",
    links: {
      apple: "https://music.apple.com",
      instagram: "https://instagram.com",
      spotify: "https://spotify.com",
      twitter: "https://twitter.com",
      youtube: "https://youtube.com",
    },
    location: "Los Angeles, CA",
    monthlyListeners: "84.2K",
    name: "John Doe",
    tracks: 24,
    username: "johndoe",
    verified: true,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      getNextPageParam: (lastPage, allPages) => allPages.length,
      initialPageParam: 0,
      queryFn: fetchPosts,
      queryKey: ["profile-posts", user.username],
    });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, fetchNextPage, hasNextPage]);

  const allPosts = data?.pages.flat() || [];

  return (
    <ProfileShell user={user} isOwner={true}>
      <Tabs defaultValue="all" className="w-full">
        <div className="flex items-center justify-center border-t border-border/10">
          <TabsList className="bg-transparent h-14 gap-8 md:gap-16">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-0 gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest"
            >
              <Grid3x3 className="size-4" />
              <span className="hidden sm:inline">All Releases</span>
            </TabsTrigger>
            <TabsTrigger
              value="tracks"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-0 gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest"
            >
              <Music className="size-4" />
              <span className="hidden sm:inline">Tracks</span>
            </TabsTrigger>
            <TabsTrigger
              value="projects"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-0 gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest"
            >
              <LayoutGrid className="size-4" />
              <span className="hidden sm:inline">Projects</span>
            </TabsTrigger>
            <TabsTrigger
              value="videos"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-0 gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest"
            >
              <Film className="size-4" />
              <span className="hidden sm:inline">Videos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-3 gap-1 md:gap-4">
            {allPosts.map((post) => (
              <PostGridItem key={post.id} post={post} />
            ))}
          </div>

          <div ref={ref} className="py-10 flex justify-center">
            {isFetchingNextPage ? (
              <LoaderCircle className="size-6 text-primary animate-spin" />
            ) : (hasNextPage ? (
              <div className="h-10" />
            ) : (
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                End of Feed
              </p>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tracks" className="mt-6">
          <div className="grid grid-cols-3 gap-1 md:gap-4">
            {allPosts
              .filter((p) => p.type === "track")
              .map((post) => (
                <PostGridItem key={post.id} post={post} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <div className="grid grid-cols-3 gap-1 md:gap-4">
            {allPosts
              .filter((p) => p.type === "project")
              .map((post) => (
                <PostGridItem key={post.id} post={post} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          <div className="grid grid-cols-3 gap-1 md:gap-4">
            {allPosts
              .filter((p) => p.type === "video")
              .map((post) => (
                <PostGridItem key={post.id} post={post} />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </ProfileShell>
  );
}

function PostGridItem({ post }: { post: any }) {
  const linkProps =
    post.type === "video"
      ? ({ params: { id: post.id }, to: "/videos/$id" } as const)
      : (post.type === "project"
        ? ({ params: { id: post.id }, to: "/projects/$id" } as const)
        : ({ params: { id: post.id }, to: "/tracks/$id" } as const));

  return (
    <Link
      {...linkProps}
      className="group relative aspect-square overflow-hidden rounded-md md:rounded-xl border border-border/10 bg-muted/20"
    >
      <AppImage
        src={post.image}
        alt={post.title}
        width={600}
        height={600}
        className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
      />

      <div className="absolute top-2 right-2 z-10 scale-90 md:scale-100 opacity-80 group-hover:opacity-100 transition-opacity">
        {post.type === "video" && (
          <div className="bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-white">
            <Film className="size-3 md:size-4" />
          </div>
        )}
        {post.type === "project" && (
          <div className="bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-white">
            <LayoutGrid className="size-3 md:size-4" />
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-4 md:gap-8 text-white z-20">
        <div className="flex items-center gap-1.5 md:gap-2">
          <Heart className="size-4 md:size-5 fill-current" />
          <span className="font-bold text-sm md:text-base">
            {post.likes > 1000
              ? (post.likes / 1000).toFixed(1) + "K"
              : post.likes}
          </span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <MessageCircle className="size-4 md:size-5 fill-current" />
          <span className="font-bold text-sm md:text-base">
            {post.comments}
          </span>
        </div>
      </div>
    </Link>
  );
}
