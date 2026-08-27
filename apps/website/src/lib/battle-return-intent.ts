/* eslint-disable one-var */

const BATTLE_RETURN_INTENT_EVENT = "soundkit:battle-return-intent",
  BATTLE_RETURN_INTENT_KEY = "soundkit.battleReturnIntent.v1";

export interface BattleReturnIntent {
  battleId: string;
  userId: string;
}

const isBattleReturnIntent = (value: unknown): value is BattleReturnIntent => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const intent = value as Partial<BattleReturnIntent>;
  return Boolean(
    typeof intent.battleId === "string" &&
    intent.battleId.trim() &&
    typeof intent.userId === "string" &&
    intent.userId.trim()
  );
};

export const rememberBattleReturnIntent = (intent: BattleReturnIntent) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(BATTLE_RETURN_INTENT_KEY, JSON.stringify(intent));
  window.dispatchEvent(new Event(BATTLE_RETURN_INTENT_EVENT));
};

export const readBattleReturnIntent = (): BattleReturnIntent | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawIntent = window.localStorage.getItem(BATTLE_RETURN_INTENT_KEY);
  if (!rawIntent) {
    return null;
  }

  try {
    const intent: unknown = JSON.parse(rawIntent);
    return isBattleReturnIntent(intent) ? intent : null;
  } catch {
    window.localStorage.removeItem(BATTLE_RETURN_INTENT_KEY);
    return null;
  }
};

export const clearBattleReturnIntent = (battleId?: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const intent = readBattleReturnIntent();
  if (!intent || !battleId || intent.battleId === battleId) {
    window.localStorage.removeItem(BATTLE_RETURN_INTENT_KEY);
    window.dispatchEvent(new Event(BATTLE_RETURN_INTENT_EVENT));
  }
};

export { BATTLE_RETURN_INTENT_EVENT };
