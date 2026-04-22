"use client";

import { useRouter } from "@tanstack/react-router";
import { 
  Plus, 
  X, 
  Music, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Info, 
  Mic2, 
  Disc, 
  Layers, 
  Users,
  DollarSign,
  CloudUpload,
  Play
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { FileUploadZone } from "@/components/dashboard/file-upload-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const trackFormSchema = z.object({
  name: z.string().min(2, "Track name is required"),
  genre: z.string().min(1, "Genre is required"),
  bpm: z.string().optional(),
  key: z.string().optional(),
  productionStatus: z.enum(["demo", "mixed", "mastered", "complete"]).default("demo"),
  description: z.string().optional(),
  releaseStrategy: z.enum(["private", "publish_when_ready", "scheduled"]).default("publish_when_ready"),
  releaseAt: z.string().optional(),
  isForSale: z.boolean().default(false),
  price: z.string().optional(),
  collaborators: z.array(z.string().email()).default([]),
});

type TrackFormValues = z.infer<typeof trackFormSchema>;

export function NewTrackForm() {
  const router = useRouter();
  const [step, setStep] = useState("details");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");

  const form = useForm<TrackFormValues>({
    resolver: zodResolver(trackFormSchema),
    defaultValues: {
      name: "",
      genre: "",
      bpm: "",
      key: "",
      productionStatus: "demo",
      description: "",
      releaseStrategy: "publish_when_ready",
      isForSale: false,
      price: "29.99",
      collaborators: [],
    },
  });

  const onSubmit = async (values: TrackFormValues) => {
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast({
        title: "Track Created",
        description: `${values.name} has been added to your library.`,
      });
      router.navigate({ to: "/dashboard/tracks" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create track. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCollaborator = () => {
    const email = collaboratorEmail.trim();
    if (email && z.string().email().safeParse(email).success) {
      const current = form.getValues("collaborators");
      if (!current.includes(email)) {
        form.setValue("collaborators", [...current, email]);
      }
      setCollaboratorEmail("");
    } else {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid collaborator email.",
        variant: "destructive",
      });
    }
  };

  const removeCollaborator = (email: string) => {
    const current = form.getValues("collaborators");
    form.setValue("collaborators", current.filter(c => c !== email));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => router.history.back()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-2 size-4" />
          Back to Tracks
        </Button>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
          New Track Workflow
        </Badge>
      </div>

      <div className="space-y-2">
        <h1 className="text-4xl font-bold font-[family-name:var(--font-playfair)] tracking-tight text-center">
          Create New Track
        </h1>
        <p className="text-muted-foreground text-center max-w-lg mx-auto">
          Add a new track to your music library. Complete each section to ensure your release is professional and discoverable.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Accordion 
            type="single" 
            collapsible 
            value={step} 
            onValueChange={setStep}
            className="space-y-4"
          >
            {/* STEP 1: BASIC DETAILS */}
            <AccordionItem value="details" className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center border transition-colors",
                    step === "details" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border/40"
                  )}>
                    <Info className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Track Details</h3>
                    <p className="text-xs text-muted-foreground font-normal">Basic information and categorization</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Track Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Midnight Vibes" {...field} className="bg-background/50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="genre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Genre <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Hip-Hop, R&B" {...field} className="bg-background/50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="bpm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BPM</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="120" {...field} className="bg-background/50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Key</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. C Major" {...field} className="bg-background/50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="productionStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="demo">Demo / Idea</SelectItem>
                            <SelectItem value="mixed">Mixed</SelectItem>
                            <SelectItem value="mastered">Mastered</SelectItem>
                            <SelectItem value="complete">Complete</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell the story behind this track..." 
                          className="bg-background/50 min-h-[100px] resize-none" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button type="button" onClick={() => setStep("assets")} className="group">
                    Next: Upload Assets
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 2: ASSETS */}
            <AccordionItem value="assets" className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center border transition-colors",
                    step === "assets" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border/40"
                  )}>
                    <CloudUpload className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Audio Assets</h3>
                    <p className="text-xs text-muted-foreground font-normal">Master, Instrumental and Stems</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-8">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-primary">Master File</Label>
                      <FileUploadZone
                        title="Main Master"
                        description="Highest quality (WAV preferred)"
                        acceptedTypes=".wav,.mp3,.aiff"
                        onFileUpload={() => {}}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Instrumental</Label>
                      <FileUploadZone
                        title="Instrumental"
                        description="Optional but recommended"
                        acceptedTypes=".wav,.mp3,.aiff"
                        onFileUpload={() => {}}
                        optional
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vocal Components</Label>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] uppercase font-bold">
                      <Plus className="mr-1 size-3" />
                      Add Component
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileUploadZone
                      title="Lead Vocals"
                      description="Clean vocal tracks"
                      acceptedTypes=".wav,.mp3,.aiff"
                      onFileUpload={() => {}}
                      optional
                    />
                    <FileUploadZone
                      title="Adlibs / FX"
                      description="Background components"
                      acceptedTypes=".wav,.mp3,.aiff"
                      onFileUpload={() => {}}
                      optional
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="ghost" onClick={() => setStep("details")}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => setStep("distribution")} className="group">
                    Next: Distribution
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 3: DISTRIBUTION & SALES */}
            <AccordionItem value="distribution" className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center border transition-colors",
                    step === "distribution" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border/40"
                  )}>
                    <DollarSign className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Distribution & Sales</h3>
                    <p className="text-xs text-muted-foreground font-normal">Pricing, release plan and strategy</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-8">
                <FormField
                  control={form.control}
                  name="releaseStrategy"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel>Release Strategy</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                          <FormItem>
                            <FormLabel className="flex flex-col items-center justify-between rounded-xl border border-border/40 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                              <FormControl>
                                <RadioGroupItem value="private" className="sr-only" />
                              </FormControl>
                              <div className="size-8 rounded-lg bg-muted flex items-center justify-center mb-3">
                                <Clock className="size-4" />
                              </div>
                              <span className="font-bold text-sm">Private</span>
                              <p className="text-[10px] text-center text-muted-foreground mt-1">Keep it as a draft</p>
                            </FormLabel>
                          </FormItem>
                          <FormItem>
                            <FormLabel className="flex flex-col items-center justify-between rounded-xl border border-border/40 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                              <FormControl>
                                <RadioGroupItem value="publish_when_ready" className="sr-only" />
                              </FormControl>
                              <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center mb-3 text-primary">
                                <Zap className="size-4 fill-current" />
                              </div>
                              <span className="font-bold text-sm">Auto-Live</span>
                              <p className="text-[10px] text-center text-muted-foreground mt-1">Go live after processing</p>
                            </FormLabel>
                          </FormItem>
                          <FormItem>
                            <FormLabel className="flex flex-col items-center justify-between rounded-xl border border-border/40 bg-background/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                              <FormControl>
                                <RadioGroupItem value="scheduled" className="sr-only" />
                              </FormControl>
                              <div className="size-8 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-3 text-indigo-500">
                                <Calendar className="size-4" />
                              </div>
                              <span className="font-bold text-sm">Scheduled</span>
                              <p className="text-[10px] text-center text-muted-foreground mt-1">Pick a specific date</p>
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20 gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Monetize Track</Label>
                    <p className="text-xs text-muted-foreground">Allow fans to purchase this track directly.</p>
                  </div>
                  <FormField
                    control={form.control}
                    name="isForSale"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch("isForSale") && (
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem className="max-w-[200px]">
                        <FormLabel>Price (USD)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                            <Input placeholder="29.99" {...field} className="pl-7 bg-background/50" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="ghost" onClick={() => setStep("assets")}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => setStep("collaboration")} className="group">
                    Next: Team
                    <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* STEP 4: COLLABORATION */}
            <AccordionItem value="collaboration" className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl px-6 py-2 overflow-hidden">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 text-left">
                  <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center border transition-colors",
                    step === "collaboration" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border/40"
                  )}>
                    <Users className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Collaborators</h3>
                    <p className="text-xs text-muted-foreground font-normal">Invite your team to this track</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Collaborator email address" 
                      value={collaboratorEmail}
                      onChange={(e) => setCollaboratorEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCollaborator())}
                      className="bg-background/50"
                    />
                    <Button type="button" onClick={addCollaborator}>Add</Button>
                  </div>

                  <div className="space-y-2">
                    {form.watch("collaborators").map((email) => (
                      <div key={email} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                        <span className="text-sm font-medium">{email}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="size-8 rounded-full text-destructive"
                          onClick={() => removeCollaborator(email)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                    {form.watch("collaborators").length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-4 border-2 border-dashed border-border/20 rounded-xl">
                        No collaborators added yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="ghost" onClick={() => setStep("distribution")}>
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="min-w-[150px] shadow-lg shadow-primary/20"
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="mr-2 size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <Check className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>
      </Form>
    </div>
  );
}

import { Clock, Zap, Calendar, LoaderCircle } from "lucide-react";
