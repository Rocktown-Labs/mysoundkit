import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  onboardingEmailReminders,
  onboardingProgress,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user } from "@soundkit/db/schema/auth";
import { getPreferredRecipientName } from "@soundkit/transactional/recipient-name";
import { and, eq, isNull, lte } from "drizzle-orm";

import { getPublicSiteUrl, sendTransactionalEmail } from "@/lib/email";

const reminderSchedules = [
  {
    afterMs: 24 * 60 * 60 * 1000,
    reminderType: "setup_24h",
  },
  {
    afterMs: 72 * 60 * 60 * 1000,
    reminderType: "setup_72h",
  },
] as const;

export const sendDueOnboardingReminders = async () => {
  if (!isDatabaseConfigured()) {
    return { sent: 0 };
  }

  const db = createDb();
  let sent = 0;

  for (const schedule of reminderSchedules) {
    const cutoff = new Date(Date.now() - schedule.afterMs),
      candidates = await db
        .select({
          email: user.email,
          name: user.name,
          userId: user.id,
          username: userProfiles.username,
        })
        .from(onboardingProgress)
        .innerJoin(user, eq(user.id, onboardingProgress.userId))
        .leftJoin(userProfiles, eq(userProfiles.userId, user.id))
        .where(
          and(
            isNull(onboardingProgress.completedAt),
            lte(onboardingProgress.startedAt, cutoff)
          )
        )
        .limit(100);

    for (const candidate of candidates) {
      const inserted = await db
        .insert(onboardingEmailReminders)
        .values({
          id: crypto.randomUUID(),
          reminderType: schedule.reminderType,
          userId: candidate.userId,
        })
        .onConflictDoNothing({
          target: [
            onboardingEmailReminders.userId,
            onboardingEmailReminders.reminderType,
          ],
        })
        .returning({ id: onboardingEmailReminders.id });
      if (inserted.length === 0) {
        continue;
      }

      await sendTransactionalEmail({
        idempotencyKey: `onboarding-reminder/${candidate.userId}/${schedule.reminderType}`,
        payload: {
          actionUrl: `${getPublicSiteUrl()}/signup`,
          body:
            schedule.reminderType === "setup_24h"
              ? "Your SoundKit account and setup progress are saved. Come back when you’re ready and finish in a few minutes."
              : "Your SoundKit setup is still saved. Finish your profile when you’re ready, or reply to this email if you need help.",
          ctaLabel: "Finish setup",
          eyebrow: "SoundKit setup",
          heading: "Finish setting up your SoundKit account",
          previewText: "Your saved SoundKit setup is ready when you are.",
          recipientName: getPreferredRecipientName({
            email: candidate.email,
            name: candidate.name,
            username: candidate.username,
          }),
          subject: "Finish setting up your SoundKit account",
        },
        recipientEmail: candidate.email,
        template: "welcome",
      });
      sent += 1;
    }
  }

  return { sent };
};
