/* eslint-disable one-var */

const BATTLE_MEDIA_SELECTION_KEY = "soundkit.battleMediaDevices.v1";

export interface BattleMediaDeviceSelection {
  audioDeviceId: string;
  videoDeviceId: string;
}

export interface AvailableBattleMediaDevice {
  deviceId: string;
  kind: string;
}

export const resolveBattleMediaDeviceSelection = (
  devices: AvailableBattleMediaDevice[],
  preferred: Partial<BattleMediaDeviceSelection> = {}
): BattleMediaDeviceSelection => {
  const firstDeviceId = (kind: AvailableBattleMediaDevice["kind"]) =>
    devices.find((device) => device.kind === kind)?.deviceId ?? "";

  return {
    audioDeviceId:
      devices.find(
        (device) =>
          device.kind === "audioinput" &&
          device.deviceId === preferred.audioDeviceId
      )?.deviceId ?? firstDeviceId("audioinput"),
    videoDeviceId:
      devices.find(
        (device) =>
          device.kind === "videoinput" &&
          device.deviceId === preferred.videoDeviceId
      )?.deviceId ?? firstDeviceId("videoinput"),
  };
};

const isBattleMediaDeviceSelection = (
  value: unknown
): value is BattleMediaDeviceSelection => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const selection = value as Partial<BattleMediaDeviceSelection>;
  return Boolean(
    typeof selection.audioDeviceId === "string" &&
    selection.audioDeviceId.trim() &&
    typeof selection.videoDeviceId === "string" &&
    selection.videoDeviceId.trim()
  );
};

export const rememberBattleMediaDeviceSelection = (
  selection: BattleMediaDeviceSelection
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    BATTLE_MEDIA_SELECTION_KEY,
    JSON.stringify(selection)
  );
};

export const readBattleMediaDeviceSelection =
  (): BattleMediaDeviceSelection | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const rawSelection = window.localStorage.getItem(
      BATTLE_MEDIA_SELECTION_KEY
    );
    if (!rawSelection) {
      return null;
    }

    try {
      const selection: unknown = JSON.parse(rawSelection);
      return isBattleMediaDeviceSelection(selection) ? selection : null;
    } catch {
      window.localStorage.removeItem(BATTLE_MEDIA_SELECTION_KEY);
      return null;
    }
  };
