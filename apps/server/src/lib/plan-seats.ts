import {
  LEGACY_TEAM_PLAN_SEATS,
  PREMIUM_INCLUDED_SEATS,
  PREMIUM_PLAN_CODES,
} from "@soundkit/auth/plan-limits";

const PLAN_SEAT_LIMITS = new Map([
  ["artist_team", LEGACY_TEAM_PLAN_SEATS],
  ["fan_family", LEGACY_TEAM_PLAN_SEATS],
  ["soundkit_premium_artist", PREMIUM_INCLUDED_SEATS],
  ["soundkit_premium_fan", PREMIUM_INCLUDED_SEATS],
]);

export const maxIncludedSeatsForPlan = (planCode: string) =>
  PLAN_SEAT_LIMITS.get(planCode) ?? 1;

export const assertPlanSeatCount = ({
  planCode,
  seats,
}: {
  planCode: string;
  seats: number;
}) => {
  const maxSeats = maxIncludedSeatsForPlan(planCode);

  if (seats > maxSeats) {
    throw new Error(`${planCode} allows up to ${maxSeats} seats.`);
  }
};

export const billableSeatsForCheckout = ({
  planCode,
  seats,
}: {
  planCode: string;
  seats?: number;
}) => {
  if (!seats || PREMIUM_PLAN_CODES.has(planCode)) {
    return;
  }

  return seats;
};
