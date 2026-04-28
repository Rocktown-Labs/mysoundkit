import { useRouter } from "@tanstack/react-router";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Clock, CheckCircle2, ArrowLeft, Send } from "lucide-react";
import { useState, useEffect } from "react";

import { BattleTrackCard } from "@/components/explore/battle-track-card";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Round {
  number: number;
  track1: {
    id: string;
    title: string;
    artist: string;
    artistSlug: string;
    cover: string;
    duration: string;
    votes: number;
  };
  track2: {
    id: string;
    title: string;
    artist: string;
    artistSlug: string;
    cover: string;
    duration: string;
    votes: number;
  };
  status: "completed" | "active" | "upcoming";
  votingEndsAt?: Date;
  winner?: 1 | 2 | null;
  isTiebreaker?: boolean;
}

export const Route = createFileRoute("/_explore/live/battles/$id")({
  component: BattlePage,
});

function BattlePage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [currentRoundIndex, setCurrentRoundIndex] = useState(1);
  const [votedInRound, setVotedInRound] = useState<number | null>(null);
  const [votedFor, setVotedFor] = useState<1 | 2 | null>(null);
  const [savedTracks, setSavedTracks] = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(60); // 60 seconds voting time
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      avatar: "/diverse-user-avatars.png",
      id: 1,
      isOwn: false,
      message: "This battle is fire! 🔥",
      time: "2m ago",
      user: "DJ Mike",
    },
    {
      avatar: "/diverse-user-avatars.png",
      id: 2,
      isOwn: false,
      message: "Team Artist 1!",
      time: "1m ago",
      user: "Sarah M",
    },
    {
      avatar: "/diverse-user-avatars.png",
      id: 3,
      isOwn: false,
      message: "That drop was insane",
      time: "30s ago",
      user: "Beat Master",
    },
    {
      avatar: "/diverse-user-avatars.png",
      id: 4,
      isOwn: false,
      message: "MC Rhythm all day 🎤",
      time: "20s ago",
      user: "Luna",
    },
    {
      avatar: "/diverse-user-avatars.png",
      id: 5,
      isOwn: false,
      message: "The production quality on this one is next level",
      time: "15s ago",
      user: "Producer J",
    },
    {
      avatar: "/diverse-user-avatars.png",
      id: 6,
      isOwn: false,
      message: "Who's winning?",
      time: "10s ago",
      user: "Vibe Check",
    },
  ]);

  const battle = {
    id,
    title: "West Coast Showdown",
    genre: "Hip-Hop",
    format: "Best of 5",
    totalRounds: 5,
    isTied: true, // Determines if tiebreaker round is needed
    artist1: {
      avatar: "/diverse-user-avatars.png",
      name: "DJ Nova",
      roundsWon: 2,
      slug: "dj-nova",
      verified: true,
    },
    artist2: {
      avatar: "/diverse-user-avatars.png",
      name: "MC Rhythm",
      roundsWon: 2,
      slug: "mc-rhythm",
      verified: false,
    },
    rounds: [
      {
        number: 1,
        status: "completed",
        track1: {
          artist: "DJ Nova",
          artistSlug: "dj-nova",
          cover: "/summer-music-album-cover.png",
          duration: "3:24",
          id: "track-1-1",
          title: "Midnight Drive",
          votes: 1247,
        },
        track2: {
          artist: "MC Rhythm",
          artistSlug: "mc-rhythm",
          cover: "/night-music-album-cover.png",
          duration: "4:12",
          id: "track-1-2",
          title: "City Lights",
          votes: 1089,
        },
        winner: 1,
      },
      {
        number: 2,
        status: "completed",
        track1: {
          artist: "DJ Nova",
          artistSlug: "dj-nova",
          cover: "/summer-music-album-cover.png",
          duration: "3:45",
          id: "track-2-1",
          title: "Neon Dreams",
          votes: 856,
        },
        track2: {
          artist: "MC Rhythm",
          artistSlug: "mc-rhythm",
          cover: "/night-music-album-cover.png",
          duration: "3:58",
          id: "track-2-2",
          title: "Street Poetry",
          votes: 943,
        },
        winner: 2,
      },
      {
        number: 3,
        status: "active",
        track1: {
          artist: "DJ Nova",
          artistSlug: "dj-nova",
          cover: "/summer-music-album-cover.png",
          duration: "3:15",
          id: "track-3-1",
          title: "Electric Pulse",
          votes: 654,
        },
        track2: {
          artist: "MC Rhythm",
          artistSlug: "mc-rhythm",
          cover: "/night-music-album-cover.png",
          duration: "3:30",
          id: "track-3-2",
          title: "Urban Flow",
          votes: 712,
        },
        votingEndsAt: new Date(Date.now() + 60_000),
      },
      {
        number: 4,
        status: "upcoming",
        track1: {
          artist: "DJ Nova",
          artistSlug: "dj-nova",
          cover: "/placeholder.svg?height=400&width=400",
          duration: "3:42",
          id: "track-4-1",
          title: "Locked",
          votes: 0,
        },
        track2: {
          artist: "MC Rhythm",
          artistSlug: "mc-rhythm",
          cover: "/placeholder.svg?height=400&width=400",
          duration: "3:55",
          id: "track-4-2",
          title: "Locked",
          votes: 0,
        },
      },
      {
        number: 5,
        status: "upcoming",
        track1: {
          artist: "DJ Nova",
          artistSlug: "dj-nova",
          cover: "/placeholder.svg?height=400&width=400",
          duration: "4:01",
          id: "track-5-1",
          title: "Locked",
          votes: 0,
        },
        track2: {
          artist: "MC Rhythm",
          artistSlug: "mc-rhythm",
          cover: "/placeholder.svg?height=400&width=400",
          duration: "3:48",
          id: "track-5-2",
          title: "Locked",
          votes: 0,
        },
      },
    ] as (Round & { isTiebreaker?: boolean })[],
  };

  const currentRound = battle.rounds[currentRoundIndex];
  const totalVotes = currentRound.track1.votes + currentRound.track2.votes;
  const track1Percentage =
    totalVotes > 0 ? (currentRound.track1.votes / totalVotes) * 100 : 0;
  const track2Percentage =
    totalVotes > 0 ? (currentRound.track2.votes / totalVotes) * 100 : 0;

  const tiebreakerRound = battle.isTied
    ? [
        {
          isTiebreaker: true,
          number: 6,
          status: "upcoming",
          track1: {
            artist: "DJ Nova",
            artistSlug: "dj-nova",
            cover: "/placeholder.svg?height=400&width=400",
            duration: "3:33",
            id: "track-6-1",
            title: "Tiebreaker - Locked",
            votes: 0,
          },
          track2: {
            artist: "MC Rhythm",
            artistSlug: "mc-rhythm",
            cover: "/placeholder.svg?height=400&width=400",
            duration: "3:27",
            id: "track-6-2",
            title: "Tiebreaker - Locked",
            votes: 0,
          },
        } as Round & { isTiebreaker: boolean },
      ]
    : [];

  useEffect(() => {
    if (currentRound.status === "active" && isVotingOpen) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsVotingOpen(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentRound.status, isVotingOpen]);

  const handleVote = (trackNumber: 1 | 2) => {
    if (currentRound.status !== "active" || !isVotingOpen) {
      return;
    }
    setVotedFor(trackNumber);
    setVotedInRound(currentRoundIndex);
  };

  const toggleSaveTrack = (trackId: string) => {
    setSavedTracks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
      return newSet;
    });
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) {
      return;
    }
    setMessages([
      ...messages,
      {
        avatar: "/diverse-user-avatars.png",
        id: messages.length + 1,
        isOwn: true,
        message: chatMessage,
        time: "now",
        user: "You",
      },
    ]);
    setChatMessage("");
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="size-4 mr-2" />
        Back
      </Button>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Video Player */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
            <AppImage
              src="/music-battle-live-performance-video.jpg"
              alt="Battle video"
              width={1280}
              height={720}
              layout="constrained"
              className="w-full h-full object-cover"
            />
            <button className="absolute inset-0 bg-black/60 flex items-center justify-center group-hover:bg-black/50 transition-colors">
              <div className="size-20 md:size-24 rounded-full bg-primary flex items-center justify-center">
                <Play className="size-10 md:size-12 fill-primary-foreground text-primary-foreground ml-2" />
              </div>
            </button>
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-red-600 text-white border-none"
              >
                <span className="size-2 rounded-full bg-white mr-2 animate-pulse" />
                LIVE
              </Badge>
              <Badge
                variant="secondary"
                className="bg-black/80 text-white border-none"
              >
                Round {currentRound.number} of{" "}
                {battle.totalRounds + (battle.isTied ? 1 : 0)}
              </Badge>
            </div>
          </div>

          {/* Battle Header */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary">{battle.genre}</Badge>
              <Badge variant="outline">{battle.format}</Badge>
              {currentRound.status === "active" && isVotingOpen && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="size-3" />
                  Voting ends in {Math.floor(timeRemaining / 60)}:
                  {String(timeRemaining % 60).padStart(2, "0")}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {battle.title}
            </h1>

            <div className="flex items-center justify-between mb-4">
              <Link
                to="/artist/$username"
                params={{ username: battle.artist1.slug }}
                className="flex items-center gap-3 hover:opacity-80"
              >
                <Avatar className="size-12">
                  <AvatarImage
                    src={battle.artist1.avatar || "/placeholder.svg"}
                  />
                  <AvatarFallback>{battle.artist1.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{battle.artist1.name}</span>
                    {battle.artist1.verified && (
                      <CheckCircle2 className="size-4 text-primary" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {battle.artist1.roundsWon} rounds won
                  </div>
                </div>
              </Link>

              <div className="text-2xl font-bold text-muted-foreground">VS</div>

              <Link
                to="/artist/$username"
                params={{ username: battle.artist2.slug }}
                className="flex items-center gap-3 hover:opacity-80"
              >
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <span className="font-semibold">{battle.artist2.name}</span>
                    {battle.artist2.verified && (
                      <CheckCircle2 className="size-4 text-primary" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {battle.artist2.roundsWon} rounds won
                  </div>
                </div>
                <Avatar className="size-12">
                  <AvatarImage
                    src={battle.artist2.avatar || "/placeholder.svg"}
                  />
                  <AvatarFallback>{battle.artist2.name[0]}</AvatarFallback>
                </Avatar>
              </Link>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {battle.rounds.map((round, index) => (
                <Button
                  key={round.number}
                  variant={currentRoundIndex === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentRoundIndex(index)}
                  className="shrink-0"
                  disabled={round.status === "upcoming"}
                >
                  {round.isTiebreaker ? "Tiebreaker" : `Round ${round.number}`}
                  {round.winner && <CheckCircle2 className="size-3 ml-1" />}
                </Button>
              ))}
              {tiebreakerRound.map((round, index) => (
                <Button
                  key={round.number}
                  variant={
                    currentRoundIndex === battle.rounds.length + index
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    setCurrentRoundIndex(battle.rounds.length + index)
                  }
                  className="shrink-0"
                  disabled={round.status === "upcoming"}
                >
                  {round.isTiebreaker ? "Tiebreaker" : `Round ${round.number}`}
                  {round.winner && <CheckCircle2 className="size-3 ml-1" />}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              {currentRound.isTiebreaker && "Tiebreaker Round - "}
              {currentRound.status === "completed" && "Round Complete"}
              {currentRound.status === "active" && isVotingOpen && "Vote Now!"}
              {currentRound.status === "active" &&
                !isVotingOpen &&
                "Voting Closed"}
              {currentRound.status === "upcoming" && "Coming Up Next"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <BattleTrackCard
                track={currentRound.track1}
                trackNumber={1}
                isWinner={currentRound.winner === 1}
                isVotedFor={
                  votedFor === 1 && votedInRound === currentRoundIndex
                }
                percentage={track1Percentage}
                showVoting={currentRound.status === "active"}
                votingDisabled={
                  !isVotingOpen || votedInRound === currentRoundIndex
                }
                isSaved={savedTracks.has(currentRound.track1.id)}
                onVote={() => handleVote(1)}
                onToggleSave={() => toggleSaveTrack(currentRound.track1.id)}
                showStats={currentRound.status !== "upcoming"}
              />

              <BattleTrackCard
                track={currentRound.track2}
                trackNumber={2}
                isWinner={currentRound.winner === 2}
                isVotedFor={
                  votedFor === 2 && votedInRound === currentRoundIndex
                }
                percentage={track2Percentage}
                showVoting={currentRound.status === "active"}
                votingDisabled={
                  !isVotingOpen || votedInRound === currentRoundIndex
                }
                isSaved={savedTracks.has(currentRound.track2.id)}
                onVote={() => handleVote(2)}
                onToggleSave={() => toggleSaveTrack(currentRound.track2.id)}
                showStats={currentRound.status !== "upcoming"}
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="border-b p-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                  Live Chat
                  <span className="text-sm font-normal text-muted-foreground ml-auto">
                    {messages.length} messages
                  </span>
                </h3>
              </div>
              <ScrollArea className="h-[400px] p-4">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.isOwn ? "flex-row-reverse" : ""}`}
                    >
                      <Avatar className="size-8 shrink-0">
                        <AvatarImage src={msg.avatar || "/placeholder.svg"} />
                        <AvatarFallback>{msg.user[0]}</AvatarFallback>
                      </Avatar>
                      <div
                        className={`flex-1 ${msg.isOwn ? "flex flex-col items-end" : ""}`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm">
                            {msg.user}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {msg.time}
                          </span>
                        </div>
                        <div
                          className={`inline-block rounded-2xl px-3 py-2 max-w-[85%] ${
                            msg.isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm leading-relaxed">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Send a message..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!chatMessage.trim()}
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Battle Info */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Battle Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Viewers</span>
                    <span className="font-semibold">12,547</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Votes</span>
                    <span className="font-semibold">
                      {totalVotes.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-semibold">45 min ago</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Round Summary</h3>
                <div className="space-y-2">
                  {battle.rounds
                    .filter((r) => r.status === "completed")
                    .map((round) => (
                      <div
                        key={round.number}
                        className="flex items-center justify-between text-sm p-2 rounded bg-muted"
                      >
                        <span className="text-muted-foreground">
                          {round.isTiebreaker
                            ? "Tiebreaker Round"
                            : `Round ${round.number}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {round.winner === 1
                              ? battle.artist1.name
                              : battle.artist2.name}
                          </span>
                          <CheckCircle2 className="size-4 text-green-500" />
                        </div>
                      </div>
                    ))}
                  {tiebreakerRound.map((round) => (
                    <div
                      key={round.number}
                      className="flex items-center justify-between text-sm p-2 rounded bg-muted"
                    >
                      <span className="text-muted-foreground">
                        {round.isTiebreaker
                          ? "Tiebreaker Round"
                          : `Round ${round.number}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {round.winner === 1
                            ? battle.artist1.name
                            : battle.artist2.name}
                        </span>
                        <CheckCircle2 className="size-4 text-green-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
