"use client";
/* eslint-disable no-void, react/no-array-index-key, react/todo, sort-vars */

import { X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import {
  DEFAULT_COLLABORATOR_CREDIT_ROLE,
  isCollaboratorCreditRole,
} from "@/lib/collaborator-credits";
import type { CollaboratorCreditRole } from "@/lib/collaborator-credits";
import { usePeopleSearchQuery } from "@/lib/soundkit-api-hooks";

export interface CreditEntry {
  alsoCreditAsWriter?: boolean;
  displayName: string;
  inviteEmail?: string;
  role: "artist" | "producer" | "songwriter";
  splitBps?: number;
  userId?: string;
}

interface CreditsEditorProps {
  onChange: (credits: CreditEntry[]) => void;
  value: CreditEntry[];
}

/**
 * Reusable credits/collaborators editor: role select, people search, an
 * "also credit as writer" option for artists, and per-credit split inputs.
 * Controlled via `value`/`onChange` so it can back a react-hook-form field
 * or standalone state (e.g. the inline track detail editor).
 */
export function CreditsEditor({ onChange, value }: CreditsEditorProps) {
  const [creditQuery, setCreditQuery] = useState(""),
    [creditRole, setCreditRole] = useState<CollaboratorCreditRole>(
      DEFAULT_COLLABORATOR_CREDIT_ROLE
    ),
    [alsoCreditAsWriter, setAlsoCreditAsWriter] = useState(true),
    { data: session } = authClient.useSession(),
    peopleSearch = usePeopleSearchQuery(creditQuery),
    addCredit = (entry: CreditEntry) => {
      const alreadyAdded = value.some(
        (credit) =>
          credit.role === entry.role &&
          ((entry.userId && credit.userId === entry.userId) ||
            credit.displayName.toLowerCase() ===
              entry.displayName.toLowerCase())
      );
      if (alreadyAdded) {
        return;
      }
      onChange([...value, entry]);
      setCreditQuery("");
    },
    addSelfAsWriter = () => {
      const user = session?.user;
      if (!user) {
        return;
      }
      addCredit({
        displayName: user.name || user.email || "Me",
        inviteEmail: user.email,
        role: "songwriter",
        userId: user.id,
      });
    },
    removeCredit = (index: number) => {
      onChange(value.filter((_, creditIndex) => creditIndex !== index));
    },
    updateSplit = (index: number, percent: number) => {
      onChange(
        value.map((credit, creditIndex) =>
          creditIndex === index
            ? {
                ...credit,
                splitBps:
                  Number.isFinite(percent) && percent >= 0
                    ? Math.round(percent * 100)
                    : undefined,
              }
            : credit
        )
      );
    };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={addSelfAsWriter}
          size="sm"
          type="button"
          variant="outline"
        >
          Add me as writer
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          onValueChange={(nextRole) => {
            if (isCollaboratorCreditRole(nextRole)) {
              setCreditRole(nextRole);
            }
          }}
          value={creditRole}
        >
          <SelectTrigger className="w-full bg-background/50 sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="artist">Artist</SelectItem>
            <SelectItem value="songwriter">Writer</SelectItem>
            <SelectItem value="producer">Producer</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="bg-background/50"
          onChange={(event) => setCreditQuery(event.target.value)}
          placeholder="Search by name, stage name, or username"
          value={creditQuery}
        />
      </div>
      {creditRole === "artist" ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            checked={alsoCreditAsWriter}
            onChange={(event) => setAlsoCreditAsWriter(event.target.checked)}
            type="checkbox"
          />
          Also credit this artist as a writer
        </label>
      ) : null}
      {creditQuery.trim().length >= 2 ? (
        <div className="space-y-1 rounded-xl border border-border/40 bg-background/40 p-2">
          {peopleSearch.isLoading ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Searching…
            </p>
          ) : null}
          {(peopleSearch.data ?? []).map((person) => (
            <button
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-accent"
              key={person.userId}
              onClick={() =>
                addCredit({
                  alsoCreditAsWriter:
                    creditRole === "artist" ? alsoCreditAsWriter : undefined,
                  displayName:
                    person.stageName ?? person.displayName ?? person.username,
                  inviteEmail: person.email ?? undefined,
                  role: creditRole,
                  userId: person.userId,
                })
              }
              type="button"
            >
              <span>
                {person.stageName ?? person.displayName}
                <span className="ml-2 text-xs text-muted-foreground">
                  @{person.username}
                </span>
              </span>
              <Badge variant="outline" className="capitalize">
                {creditRole}
              </Badge>
            </button>
          ))}
          {!peopleSearch.isLoading && (peopleSearch.data ?? []).length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              No matching people. Try another name.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {value.map((credit, index) => (
          <div
            className="flex items-center gap-1 rounded-full border bg-secondary/60 py-1 pl-3 pr-1 text-xs"
            key={`${credit.role}-${credit.userId ?? credit.displayName}-${index}`}
          >
            <span className="capitalize">{credit.role}:</span>{" "}
            <span className="max-w-[160px] truncate">{credit.displayName}</span>
            {credit.role === "songwriter" || credit.role === "artist" ? (
              <label className="ml-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <input
                  aria-label={`Split percentage for ${credit.displayName}`}
                  className="w-10 rounded border border-border/40 bg-background px-1 py-0.5 text-right tabular-nums"
                  max={100}
                  min={0}
                  onChange={(event) =>
                    updateSplit(index, Number(event.target.value))
                  }
                  placeholder="%"
                  type="number"
                  value={
                    credit.splitBps === undefined || credit.splitBps === null
                      ? ""
                      : Math.round(credit.splitBps / 100)
                  }
                />
                %
              </label>
            ) : null}
            <Button
              className="size-6 rounded-full"
              onClick={() => removeCredit(index)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
        {value.length === 0 ? (
          <p className="w-full rounded-xl border-2 border-dashed border-border/20 py-4 text-center text-xs text-muted-foreground">
            No artists, writers, or producers added yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
