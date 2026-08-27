import { followProfileByUsername } from "./soundkit-api-hooks";

const BATTLE_SHARE_REFERRAL_KEY = "soundkit.battleShareReferral.v1";

export interface BattleShareReferral {
  battleId: string;
  returnPath: string;
  senderUsername: string;
}

const isValidReferral = (value: unknown): value is BattleShareReferral => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const referral = value as Partial<BattleShareReferral>;
  return Boolean(
    typeof referral.battleId === "string" &&
    typeof referral.returnPath === "string" &&
    referral.returnPath.startsWith("/live/battles/") &&
    typeof referral.senderUsername === "string" &&
    /^[a-z0-9_-]{3,80}$/iu.test(referral.senderUsername)
  );
};

export const rememberBattleShareReferral = (referral: BattleShareReferral) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    BATTLE_SHARE_REFERRAL_KEY,
    JSON.stringify(referral)
  );
};

export const readBattleShareReferral = (): BattleShareReferral | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawReferral = window.localStorage.getItem(BATTLE_SHARE_REFERRAL_KEY);
  if (!rawReferral) {
    return null;
  }

  try {
    const referral: unknown = JSON.parse(rawReferral);
    return isValidReferral(referral) ? referral : null;
  } catch {
    window.localStorage.removeItem(BATTLE_SHARE_REFERRAL_KEY);
    return null;
  }
};

export const completeBattleShareReferral = async () => {
  const referral = readBattleShareReferral();
  if (!referral) {
    return null;
  }

  try {
    await followProfileByUsername(referral.senderUsername);
  } catch {
    // Referral follow-up must not block account creation or battle access.
  }

  return referral;
};

export const clearBattleShareReferral = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(BATTLE_SHARE_REFERRAL_KEY);
  }
};
