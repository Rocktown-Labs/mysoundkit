const BATTLE_KIT_SELECTION_KEY = "soundkit.selectedBattleKit.v1";

export interface BattleKitSelection {
  battleId?: string;
  kitId: string;
  opponentUsername?: string;
}

const isBattleKitSelection = (value: unknown): value is BattleKitSelection => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const selection = value as Partial<BattleKitSelection>;
  return Boolean(
    typeof selection.kitId === "string" &&
      selection.kitId.trim().length > 0 &&
      (!selection.battleId || typeof selection.battleId === "string") &&
      (!selection.opponentUsername ||
        typeof selection.opponentUsername === "string")
  );
};

export const rememberBattleKitSelection = (selection: BattleKitSelection) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    BATTLE_KIT_SELECTION_KEY,
    JSON.stringify(selection)
  );
};

export const readBattleKitSelection = (): BattleKitSelection | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSelection = window.localStorage.getItem(BATTLE_KIT_SELECTION_KEY);
  if (!rawSelection) {
    return null;
  }

  try {
    const selection: unknown = JSON.parse(rawSelection);
    return isBattleKitSelection(selection) ? selection : null;
  } catch {
    window.localStorage.removeItem(BATTLE_KIT_SELECTION_KEY);
    return null;
  }
};

export const clearBattleKitSelection = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(BATTLE_KIT_SELECTION_KEY);
  }
};
