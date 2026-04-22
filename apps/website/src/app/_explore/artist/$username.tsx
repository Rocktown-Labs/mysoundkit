"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  Grid3x3, 
  Music, 
  LayoutGrid, 
  Film,
  Heart,
  MessageCircle,
  LoaderCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";

import { ProfileShell } from "@/components/dashboard/profile/profile-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppImage } from "@/components/ui/app-image";

export const Route = createFileRoute("/_explore/artist/$username")({
  component: ArtistProfilePage,
});

// Mock fetch function for infinite scroll
const fetchArtistPosts = async ({ pageParam = 0 }) => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return Array.from({ length: 9 }, (_, i) => ({
    id: `artist-post-${pageParam}-${i}`,
    title: `Luna Release ${pageParam * 9 + i + 1}`,
    image: [
      "/summer-music-album-cover.png",
      "/night-music-album-cover.png",
      "/hip-hop-album-cover.png",
      "/acoustic-guitar-album.png"
    ][(pageParam * 9 + i) % 4],
    likes: Math.floor(Math.random() * 20_000) + 500,
    comments: Math.floor(Math.random() * 500) + 25,
    type: i % 4 === 0 ? 'project' : i % 4 === 1 ? 'video' : 'track',
    artist: {
      name: "Luna Eclipse",
      username: "luna",
      avatar: "/diverse-user-avatars.png"
    }
  }));
};

function ArtistProfilePage() {
  const { username } = Route.useParams();
  const { ref, inView } = useInView();

  const artist = {
    name: "Luna Eclipse",
    username: username,
    avatar: "/diverse-user-avatars.png",
    coverImage: "/summer-music-album-cover.png",
    bio: "R&B/Soul artist from Los Angeles. Creating vibes for late nights and summer days. 🌙✨",
    location: "Los Angeles, CA",
    genre: "R&B / Soul",
    followers: "124K",
    following: "892",
    tracks: 24,
    verified: true,
    joinedDate: "Mar 2023",
    battleRank: "#2",
    battleRecord: "48-2",
    monthlyListeners: "1.2M",
    links: {
      instagram: "https://instagram.com",
      twitter: "https://twitter.com",
      youtube: "https://youtube.com",
      spotify: "https://spotify.com",
      apple: "https://music.apple.com"
    },
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['artist-posts', username],
    queryFn: fetchArtistPosts,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => allPages.length,
  });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, fetchNextPage, hasNextPage]);

  const allPosts = data?.pages.flat() || [];

  return (
    <ProfileShell user={artist} isOwner={false}>
      <Tabs defaultValue="all" className="w-full">
        <div className="flex items-center justify-center border-t border-border/10">
          <TabsList className="bg-transparent h-14 gap-8 md:gap-16">
            <TabsTrigger 
              value="all" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-t-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-0 gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest"
            >
              <Grid3x3 className="size-4" />
              <span className="hidden sm:inline">Feed</span>
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
            ) : hasNextPage ? (
              <div className="h-10" />
            ) : (
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">End of Feed</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tracks" className="mt-6">
          <div className="grid grid-cols-3 gap-1 md:gap-4">
            {allPosts.filter(p => p.type === 'track').map((post) => (
              <PostGridItem key={post.id} post={post} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <div className="grid grid-cols-3 gap-1 md:gap-4">
            {allPosts.filter(p => p.type === 'project').map((post) => (
              <PostGridItem key={post.id} post={post} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          <div className="grid grid-cols-3 gap-1 md:gap-4">
            {allPosts.filter(p => p.type === 'video').map((post) => (
              <PostGridItem key={post.id} post={post} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </ProfileShell>
  );
}

function PostGridItem({ post }: { post: any }) {
  const targetTo = post.type === 'video' ? '/videos/$id' : post.type === 'project' ? '/projects/$id' : '/tracks/$id';

  return (
    <Link 
      to={targetTo as any}
      params={{ id: post.id }}
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
        {post.type === 'video' && <div className="bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-white"><Film className="size-3 md:size-4" /></div>}
        {post.type === 'project' && <div className="bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-white"><LayoutGrid className="size-3 md:size-4" /></div>}
      </div>

      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-4 md:gap-8 text-white z-20">
        <div className="flex items-center gap-1.5 md:gap-2">
          <Heart className="size-4 md:size-5 fill-current" />
          <span className="font-bold text-sm md:text-base">{post.likes > 1000 ? (post.likes / 1000).toFixed(1) + 'K' : post.likes}</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <MessageCircle className="size-4 md:size-5 fill-current" />
          <span className="font-bold text-sm md:text-base">{post.comments}</span>
        </div>
      </div>
    </Link>
  );
}
