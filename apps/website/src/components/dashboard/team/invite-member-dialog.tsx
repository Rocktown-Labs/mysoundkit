import { UserPlus, LoaderCircle, Check, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useCreateWorkspaceInvitationMutation } from "@/lib/soundkit-api-hooks";
import { zodResolver } from "@/lib/zod-resolver";

const inviteFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  message: z.string().optional(),
  role: z.enum(["admin", "manager", "editor", "viewer"]),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

interface InviteMemberDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  seatsUsed: number;
  totalSeats: number;
}

export function InviteMemberDialog({
  isOpen,
  onOpenChange,
  seatsUsed,
  totalSeats,
}: InviteMemberDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false),
    isAtLimit = seatsUsed >= totalSeats,
    createInvitationMutation = useCreateWorkspaceInvitationMutation(),
    form = useForm<InviteFormValues>({
      defaultValues: {
        email: "",
        message: "",
        role: "manager",
      },
      resolver: zodResolver(inviteFormSchema),
    }),
    onSubmit = async (values: InviteFormValues) => {
      setIsSubmitting(true);
      try {
        await createInvitationMutation.mutateAsync({
          email: values.email,
          role: values.role === "admin" ? "admin" : "member",
        });

        toast({
          description: `We've sent an invite to ${values.email}.`,
          title: "Invitation Sent",
        });

        onOpenChange(false);
        form.reset();
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Failed to send invitation. Please try again.",
          title: "Error",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card/95 backdrop-blur-xl border-border/40">
        <DialogHeader>
          <DialogTitle className="text-2xl font-[family-name:var(--font-playfair)] flex items-center gap-2">
            <UserPlus className="size-6 text-primary" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Add a new member to your professional team to help manage your
            career.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {/* Seat Usage Indicator */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/20">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Team Capacity
              </span>
              <span className="text-xs font-bold">
                {seatsUsed} / {totalSeats} seats used
              </span>
            </div>
            <Progress
              value={(seatsUsed / totalSeats) * 100}
              className="h-1.5"
            />
            {isAtLimit && (
              <div className="mt-3 flex items-start gap-2 text-amber-500">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-normal font-medium">
                  You've reached your seat limit. Upgrade to a Pro+ plan to add
                  more team members.
                </p>
              </div>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="collaborator@example.com"
                        {...field}
                        disabled={isAtLimit}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isAtLimit}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">
                          Admin (Full Control)
                        </SelectItem>
                        <SelectItem value="manager">
                          Manager (Manage Content)
                        </SelectItem>
                        <SelectItem value="editor">
                          Editor (Edit Metadata)
                        </SelectItem>
                        <SelectItem value="viewer">
                          Viewer (Read Only)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[10px]">
                      Roles determine what actions the member can perform.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isAtLimit}
                  className="min-w-[120px]"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Invite
                      <Check className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
