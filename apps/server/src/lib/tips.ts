/* eslint-disable one-var */

export interface TipAllocation {
  artistAmountCents: number;
  artistUserId: string;
  amountCents: number;
}

const splitCents = (amountCents: number, count: number) => {
  const baseAmountCents = Math.floor(amountCents / count),
    remainderCents = amountCents % count;

  return Array.from(
    { length: count },
    (_, index) => baseAmountCents + (index < remainderCents ? 1 : 0)
  );
};

export const buildTipAllocations = ({
  amountCents,
  artistAmountCents,
  recipientUserIds,
}: {
  amountCents: number;
  artistAmountCents: number;
  recipientUserIds: string[];
}): TipAllocation[] => {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Tip amount must be a positive integer.");
  }
  if (
    !Number.isInteger(artistAmountCents) ||
    artistAmountCents < 0 ||
    artistAmountCents > amountCents
  ) {
    throw new Error("Artist tip amount must be a valid integer.");
  }
  if (
    recipientUserIds.length === 0 ||
    recipientUserIds.length > 2 ||
    new Set(recipientUserIds).size !== recipientUserIds.length
  ) {
    throw new Error("A tip must have one or two unique recipients.");
  }

  const amountShares = splitCents(amountCents, recipientUserIds.length),
    artistAmountShares = splitCents(artistAmountCents, recipientUserIds.length);

  return recipientUserIds.map((artistUserId, index) => ({
    amountCents: amountShares[index] ?? 0,
    artistAmountCents: artistAmountShares[index] ?? 0,
    artistUserId,
  }));
};
