import { useUploadFiles } from "@better-upload/client";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileAudio,
  ImageIcon,
  Info,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FileUploadZone } from "@/components/dashboard/file-upload-zone";
import { VisualWaveformSlotTrimmer } from "@/components/studio/visual-waveform-slot-trimmer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  MEDIA_BASE_URL,
  MEDIA_UPLOAD_URL,
  TRACK_SOURCE_UPLOAD_URL,
  apiClient,
  rpcJson,
} from "@/lib/api";
import { optimizeCoverImageFile } from "@/lib/image-processing";
import { sliceAudioFileToSnippet } from "@/lib/media-bunny-slicer";
import { readAudioDurationMs } from "@/lib/media-duration";
import { canonicalGenreName } from "@/lib/music-genres";
import {
  useCreateTrackMutation,
  useGenresQuery,
  usePeopleSearchQuery,
} from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/open-verses/new")({
  component: NewOpenVersePage,
});

const PLACEHOLDER_ART = "/open-verse-placeholder.svg",
  steps = [
    {
      description: "Song metadata, genre, artwork, and creative direction",
      id: "details",
      label: "Details",
      number: "1",
    },
    {
      description: "Upload the working mix and define the collaborator slot",
      id: "audio",
      label: "Audio & Open Slot",
      number: "2",
    },
    {
      description: "Choose who can request access and submit a take",
      id: "permissions",
      label: "Permissions",
      number: "3",
    },
    {
      description: "Review contributors, rights, and publish the listing",
      id: "publish",
      label: "Contributors & Publish",
      number: "4",
    },
  ] as const,
  stepIcons = {
    audio: FileAudio,
    details: Info,
    permissions: ShieldCheck,
    publish: Users,
  } as const;
type StepId = (typeof steps)[number]["id"];

interface Credit {
  displayName: string;
  role: "producer" | "songwriter";
  userId?: string;
}

const formatFileSize = (size: number) =>
  `${(size / (1024 * 1024)).toFixed(1)} MB`;

type StepConfig = (typeof steps)[number];

function OpenVerseStepHeader({
  active,
  completed,
  step,
}: {
  active: boolean;
  completed: boolean;
  step: StepConfig;
}) {
  const StepIcon = stepIcons[step.id];

  return (
    <div className="flex items-center gap-4 text-left">
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-xl border transition-colors",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border/40 bg-muted text-muted-foreground"
        )}
      >
        {completed ? (
          <Check className="size-5" />
        ) : (
          <StepIcon className="size-5" />
        )}
      </div>
      <div>
        <h3 className="text-lg font-bold">{step.label}</h3>
        <p className="text-xs font-normal text-muted-foreground">
          {step.description}
        </p>
      </div>
    </div>
  );
}

function NewOpenVersePage() {
  const router = useRouter(),
    genresQuery = useGenresQuery(),
    createTrackMutation = useCreateTrackMutation(),
    [activeStep, setActiveStep] = useState<StepId>("details"),
    [completedSteps, setCompletedSteps] = useState<Set<StepId>>(new Set()),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [genre, setGenre] = useState("Hip-Hop/Rap"),
    [bpm, setBpm] = useState(""),
    [musicalKey, setMusicalKey] = useState(""),
    [artwork, setArtwork] = useState<File | null>(null),
    [master, setMaster] = useState<File | null>(null),
    [durationMs, setDurationMs] = useState<number | null>(null),
    [slotStart, setSlotStart] = useState(0),
    [slotEnd, setSlotEnd] = useState(30),
    [clip, setClip] = useState<File | null>(null),
    [clipUrl, setClipUrl] = useState<string | null>(null),
    [clipRange, setClipRange] = useState<{
      end: number;
      start: number;
    } | null>(null),
    [isGeneratingClip, setIsGeneratingClip] = useState(false),
    [accessMode, setAccessMode] = useState<"open" | "approval_required">(
      "open"
    ),
    [credits, setCredits] = useState<Credit[]>([]),
    [creditQuery, setCreditQuery] = useState(""),
    [creditRole, setCreditRole] = useState<Credit["role"]>("songwriter"),
    [rightsAccepted, setRightsAccepted] = useState(false),
    [isPublishing, setIsPublishing] = useState(false),
    [publishStage, setPublishStage] = useState(""),
    peopleQuery = usePeopleSearchQuery(creditQuery),
    { upload: uploadMedia } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      route: "media",
    }),
    { upload: uploadTrackFiles } = useUploadFiles({
      api: TRACK_SOURCE_UPLOAD_URL,
      credentials: "include",
      route: "track-source",
    }),
    availableGenres = useMemo(() => {
      const rows = Array.isArray(genresQuery.data) ? genresQuery.data : [];
      return rows.length > 0
        ? rows.map((row) => row.name)
        : ["Hip-Hop/Rap", "Pop", "R&B/Soul", "Electronic", "Jazz", "Rock"];
    }, [genresQuery.data]),
    listingTitle = title.trim()
      ? `${title.trim()} - Open Verse`
      : "Your Song - Open Verse",
    durationSeconds = (durationMs ?? 0) / 1000,
    isClipStale = Boolean(
      clipRange && (clipRange.start !== slotStart || clipRange.end !== slotEnd)
    ),
    markStepComplete = (step: StepId, next?: StepId) => {
      setCompletedSteps((current) => new Set(current).add(step));
      if (next) {
        setActiveStep(next);
      }
    },
    handleMaster = async (files: FileList) => {
      const file = files[0];
      if (!file) {
        return;
      }
      setMaster(file);
      const nextDuration = await readAudioDurationMs(file);
      setDurationMs(nextDuration);
      setSlotStart(0);
      setSlotEnd(Math.min(30, Math.max(1, (nextDuration ?? 30_000) / 1000)));
      setClip(null);
      if (clipUrl) {
        URL.revokeObjectURL(clipUrl);
      }
      setClipUrl(null);
      setClipRange(null);
    },
    generateClip = async (start: number, end: number) => {
      if (!master) {
        return;
      }
      setSlotStart(start);
      setSlotEnd(end);
      setIsGeneratingClip(true);
      try {
        const nextClip = await sliceAudioFileToSnippet(
          master,
          start,
          end,
          `${
            title
              .trim()
              .toLowerCase()
              .replaceAll(/[^a-z0-9]+/gu, "-") || "open-verse"
          }-${Math.round(start)}-${Math.round(end)}.wav`
        );
        if (clipUrl) {
          URL.revokeObjectURL(clipUrl);
        }
        setClip(nextClip);
        setClipUrl(URL.createObjectURL(nextClip));
        setClipRange({ end, start });
        toast({
          description: `${Math.round(end - start)} seconds are ready for contributors.`,
          title: "Open Verse Clip Ready",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "The selected audio could not be sliced.",
          title: "Clip generation failed",
          variant: "destructive",
        });
      } finally {
        setIsGeneratingClip(false);
      }
    },
    addCredit = (credit: Credit) => {
      if (
        credits.some(
          (current) =>
            current.userId === credit.userId && current.role === credit.role
        )
      ) {
        return;
      }
      setCredits((current) => [...current, credit]);
      setCreditQuery("");
    },
    publish = async () => {
      if (
        !title.trim() ||
        !genre ||
        !master ||
        !clip ||
        isClipStale ||
        !rightsAccepted
      ) {
        toast({
          description:
            "Complete Details, a valid audio selection, and the rights confirmation before publishing.",
          title: "Open Verse setup incomplete",
          variant: "destructive",
        });
        return;
      }
      setIsPublishing(true);
      try {
        setPublishStage("Creating underlying Track");
        const track = await createTrackMutation.mutateAsync({
            assetIds: [],
            bpm: bpm ? Number(bpm) : undefined,
            catalogItemType: "single",
            collaborators: credits.map((credit) => ({
              name: credit.displayName,
              role: credit.role,
              userId: credit.userId,
            })),
            description: description.trim() || undefined,
            downloadsAllowed: true,
            downloadsRequireFirstPlay: false,
            downloadsRequirePurchase: false,
            genre,
            isForSale: false,
            isOpenVerse: false,
            isPublic: false,
            listeningAccess: "public",
            musicalKey: musicalKey.trim() || undefined,
            productionStatus: "demo",
            purchaseMode: "digital_download",
            releaseStrategy: "private",
            streamingLinks: {},
            title: title.trim(),
          }),
          trackId = track.id;

        setPublishStage("Uploading immutable base master");
        const uploadResult = await uploadTrackFiles([master]),
          uploadedMaster = uploadResult.files.find(
            (entry) => entry.raw.name === master.name
          );
        if (!uploadedMaster?.objectInfo.key) {
          throw new Error("The base master upload did not complete.");
        }

        let coverObjectKey: string | undefined, coverUrl: string | undefined;
        if (artwork) {
          setPublishStage("Uploading Artwork");
          const coverResult = await uploadMedia([artwork]),
            uploadedCover = coverResult.files[0];
          coverObjectKey = uploadedCover?.objectInfo.key;
          if (coverObjectKey) {
            coverUrl = `${MEDIA_BASE_URL}/${coverObjectKey}`;
          }
        }

        await rpcJson(
          await apiClient.v1.tracks[":trackId"].assets.$post({
            json: {
              assetKind: "master",
              durationMs: durationMs ?? undefined,
              metadata: {
                durationMs,
                originalFileName: master.name,
              },
              mimeType: master.type || "audio/wav",
              objectKey: uploadedMaster.objectInfo.key,
              sizeBytes: master.size,
              status: "uploaded",
              storageProvider: "r2",
            },
            param: { trackId },
          })
        );
        if (coverObjectKey) {
          await rpcJson(
            await apiClient.v1.tracks[":trackId"].assets.$post({
              json: {
                assetKind: "cover_art",
                metadata: { originalFileName: artwork?.name, url: coverUrl },
                mimeType: artwork?.type || "image/*",
                objectKey: coverObjectKey,
                sizeBytes: artwork?.size,
                status: "ready",
                storageProvider: "r2",
              },
              param: { trackId },
            })
          );
        }

        setPublishStage("Starting durable Open Verse processing");
        const listing = await rpcJson(
          await apiClient.v1["open-verses"].index.$post({
            json: {
              accessMode,
              description: description.trim() || undefined,
              maxSubmissions: 50,
              slotEndsAtMs: Math.round(slotEnd * 1000),
              slotStartsAtMs: Math.round(slotStart * 1000),
              title: listingTitle,
              trackId,
            },
          })
        );
        toast({
          description: `${listingTitle} is discoverable while SoundKit prepares its listening snippet.`,
          title: "Open Verse processing started",
        });
        await router.navigate({
          params: { genre: listing.genreSlug, id: listing.id },
          to: "/dashboard/open-verses/$genre/$id",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "SoundKit could not finish publishing this Open Verse.",
          title: "Publish failed",
          variant: "destructive",
        });
      } finally {
        setIsPublishing(false);
        setPublishStage("");
      }
    };

  useEffect(
    () => () => {
      if (clipUrl) {
        URL.revokeObjectURL(clipUrl);
      }
    },
    [clipUrl]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <Button
          className="text-muted-foreground hover:text-foreground"
          onClick={() => router.history.back()}
          variant="ghost"
        >
          <ChevronLeft className="mr-2 size-4" />
          Back to Open Verses
        </Button>
        <Badge
          className="border-primary/20 bg-primary/5 text-primary"
          variant="outline"
        >
          Open Verse Workflow
        </Badge>
      </div>
      <div className="space-y-2 text-center">
        <h1 className="font-[family-name:var(--font-playfair)] text-4xl font-bold tracking-tight">
          Create an Open Verse
        </h1>
        <p className="mx-auto max-w-lg text-muted-foreground">
          Upload an incomplete track, define the exact collaborator slot, and
          invite eligible artists to submit their take.
        </p>
      </div>
      <Accordion
        className="space-y-4"
        collapsible
        onValueChange={(value) => setActiveStep(value as StepId)}
        type="single"
        value={activeStep}
      >
        <AccordionItem
          className="overflow-hidden rounded-2xl border border-border/40 bg-card/40 px-6 py-2 backdrop-blur-md"
          value="details"
        >
          <AccordionTrigger className="py-4 hover:no-underline">
            <OpenVerseStepHeader
              active={activeStep === "details"}
              completed={completedSteps.has("details")}
              step={steps[0]}
            />
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6 pt-2">
            <div className="space-y-2">
              <Label htmlFor="song-title">Song Title *</Label>
              <Input
                id="song-title"
                placeholder="IYKYK"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="direction">Direction / Instructions</Label>
              <Textarea
                id="direction"
                placeholder="Leave a 16-bar verse after the second hook. Aggressive delivery, no profanity."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Genre *</Label>
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGenres.map((value) => (
                      <SelectItem key={value} value={value}>
                        {canonicalGenreName(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bpm">
                  BPM <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="bpm"
                  inputMode="numeric"
                  min="1"
                  type="number"
                  value={bpm}
                  onChange={(event) => setBpm(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">
                  Musical Key{" "}
                  <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="key"
                  placeholder="C minor"
                  value={musicalKey}
                  onChange={(event) => setMusicalKey(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Cover Artwork{" "}
                <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <FileUploadZone
                acceptedTypes=".jpg,.jpeg,.png,.webp"
                description="Use SoundKit's branded fallback if you are not ready with artwork."
                files={
                  artwork ? [{ name: artwork.name, status: "Selected" }] : []
                }
                onFileUpload={(files) => {
                  const file = files[0];
                  if (file) {
                    void optimizeCoverImageFile(file).then(setArtwork);
                  }
                }}
                onRemove={() => setArtwork(null)}
                title="Cover Artwork"
                optional
                variant="compact"
              />
            </div>
            <div className="flex justify-end">
              <Button
                disabled={!title.trim() || !genre}
                onClick={() => markStepComplete("details", "audio")}
                type="button"
              >
                Next: Audio & Open Slot <ChevronRight className="ml-2 size-4" />
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem
          className="overflow-hidden rounded-2xl border border-border/40 bg-card/40 px-6 py-2 backdrop-blur-md"
          value="audio"
        >
          <AccordionTrigger className="py-4 hover:no-underline">
            <OpenVerseStepHeader
              active={activeStep === "audio"}
              completed={completedSteps.has("audio")}
              step={steps[1]}
            />
          </AccordionTrigger>
          <AccordionContent className="space-y-8 pb-6 pt-2">
            <FileUploadZone
              acceptedTypes=".wav,.mp3,.aiff,.flac,.m4a"
              description="WAV preferred. This is the only audio asset required to start."
              files={
                master
                  ? [
                      {
                        name: master.name,
                        status: durationMs
                          ? `${formatFileSize(master.size)} • Ready`
                          : "Analyzing",
                      },
                    ]
                  : []
              }
              onFileUpload={(files) => void handleMaster(files)}
              onRemove={() => setMaster(null)}
              title="Master / Working Mix"
              variant="compact"
            />
            {master && (
              <VisualWaveformSlotTrimmer
                audioFile={master}
                durationSeconds={durationSeconds}
                isGeneratingClip={isGeneratingClip}
                onChangeSlot={(start, end) => {
                  setSlotStart(start);
                  setSlotEnd(end);
                }}
                onGenerateClip={generateClip}
                slotEndsAt={slotEnd}
                slotStartsAt={slotStart}
                trackTitle={title || "Open Verse Master"}
              />
            )}
            {clipUrl && clip && (
              <div
                className={`rounded-xl border p-4 ${isClipStale ? "border-amber-500/50 bg-amber-500/10" : "border-primary/30 bg-primary/5"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <FileAudio className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold">Open Verse Clip Preview</p>
                      <p className="text-xs text-muted-foreground">
                        {slotStart.toFixed(0)}s → {slotEnd.toFixed(0)}s •{" "}
                        {Math.round(slotEnd - slotStart)} seconds
                      </p>
                    </div>
                  </div>
                  <audio controls src={clipUrl} />
                </div>
                {isClipStale && (
                  <p className="mt-3 text-sm text-amber-200">
                    The selection changed. Set Open Verse Slot again before
                    publishing.
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-between">
              <Button
                onClick={() => setActiveStep("details")}
                type="button"
                variant="ghost"
              >
                <ChevronLeft className="mr-2 size-4" />
                Back
              </Button>
              <Button
                disabled={!master || !clip || isClipStale}
                onClick={() => markStepComplete("audio", "permissions")}
                type="button"
              >
                Next: Permissions <ChevronRight className="ml-2 size-4" />
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem
          className="overflow-hidden rounded-2xl border border-border/40 bg-card/40 px-6 py-2 backdrop-blur-md"
          value="permissions"
        >
          <AccordionTrigger className="py-4 hover:no-underline">
            <OpenVerseStepHeader
              active={activeStep === "permissions"}
              completed={completedSteps.has("permissions")}
              step={steps[2]}
            />
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6 pt-2">
            <button
              className={`w-full rounded-xl border p-4 text-left ${accessMode === "open" ? "border-primary bg-primary/10" : "border-border/40"}`}
              onClick={() => setAccessMode("open")}
              type="button"
            >
              <span className="font-semibold">Open to Eligible Artists</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Any SoundKit artist who already has a Track or Project can
                submit.
              </span>
            </button>
            <button
              className={`w-full rounded-xl border p-4 text-left ${accessMode === "approval_required" ? "border-primary bg-primary/10" : "border-border/40"}`}
              onClick={() => setAccessMode("approval_required")}
              type="button"
            >
              <span className="font-semibold">Approval Required</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Artists request access before they can submit files.
              </span>
            </button>
            <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 p-4 text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-muted-foreground">
                SoundKit enforces the one Track or Project eligibility rule on
                the server; this screen is not the authority.
              </p>
            </div>
            <div className="flex justify-between">
              <Button
                onClick={() => setActiveStep("audio")}
                type="button"
                variant="ghost"
              >
                <ChevronLeft className="mr-2 size-4" />
                Back
              </Button>
              <Button
                onClick={() => markStepComplete("permissions", "publish")}
                type="button"
              >
                Next: Contributors <ChevronRight className="ml-2 size-4" />
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem
          className="overflow-hidden rounded-2xl border border-border/40 bg-card/40 px-6 py-2 backdrop-blur-md"
          value="publish"
        >
          <AccordionTrigger className="py-4 hover:no-underline">
            <OpenVerseStepHeader
              active={activeStep === "publish"}
              completed={completedSteps.has("publish")}
              step={steps[3]}
            />
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6 pt-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <Label>Contributors already associated with this work</Label>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Search people"
                  value={creditQuery}
                  onChange={(event) => setCreditQuery(event.target.value)}
                />
                <Select
                  value={creditRole}
                  onValueChange={(value: Credit["role"]) =>
                    setCreditRole(value)
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="songwriter">Songwriter</SelectItem>
                    <SelectItem value="producer">Producer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {peopleQuery.data?.map((person) => (
                <button
                  className="flex w-full items-center justify-between rounded-lg border border-border/40 p-3 text-left hover:bg-muted/30"
                  key={person.userId}
                  onClick={() =>
                    addCredit({
                      displayName: person.displayName,
                      role: creditRole,
                      userId: person.userId,
                    })
                  }
                  type="button"
                >
                  <span>
                    {person.displayName}{" "}
                    <span className="text-muted-foreground">
                      @{person.username}
                    </span>
                  </span>
                  <Plus className="size-4" />
                </button>
              ))}
              {credits.map((credit, index) => (
                <div
                  className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
                  key={`${credit.userId ?? credit.displayName}-${credit.role}`}
                >
                  <span>
                    {credit.displayName}{" "}
                    <Badge variant="secondary">{credit.role}</Badge>
                  </span>
                  <Button
                    aria-label={`Remove ${credit.displayName}`}
                    onClick={() =>
                      setCredits((current) =>
                        current.filter(
                          (_, currentIndex) => currentIndex !== index
                        )
                      )
                    }
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {credits.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No additional contributors selected.
                </p>
              )}
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-border/40 p-4 text-sm">
              <Checkbox
                checked={rightsAccepted}
                onCheckedChange={(checked) =>
                  setRightsAccepted(checked === true)
                }
              />
              <span>
                I confirm I have the rights necessary to upload and publish this
                audio on SoundKit.
              </span>
            </label>
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
              <p className="font-semibold">Review</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Listing</dt>
                  <dd>{listingTitle}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Genre</dt>
                  <dd>{canonicalGenreName(genre)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Open Slot</dt>
                  <dd>
                    {slotStart.toFixed(0)}s → {slotEnd.toFixed(0)}s
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Permissions</dt>
                  <dd>
                    {accessMode === "open"
                      ? "Open to Eligible Artists"
                      : "Approval Required"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Artwork</dt>
                  <dd className="flex items-center gap-2">
                    {artwork ? artwork.name : "SoundKit Placeholder"}
                    {!artwork && <ImageIcon className="size-4 text-primary" />}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Open Verse Clip</dt>
                  <dd className="flex items-center gap-2">
                    Ready <CheckCircle2 className="size-4 text-emerald-400" />
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex justify-between">
              <Button
                onClick={() => setActiveStep("permissions")}
                type="button"
                variant="ghost"
              >
                <ChevronLeft className="mr-2 size-4" />
                Back
              </Button>
              <Button
                disabled={isPublishing || !rightsAccepted}
                onClick={() => void publish()}
                type="button"
              >
                {isPublishing ? (
                  <>
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                    {publishStage || "Publishing…"}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 size-4" />
                    Publish Open Verse
                  </>
                )}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {!artwork && (
        <p className="text-center text-xs text-muted-foreground">
          Open Verses without artwork use the maintained SoundKit placeholder:{" "}
          {PLACEHOLDER_ART}
        </p>
      )}
    </div>
  );
}
