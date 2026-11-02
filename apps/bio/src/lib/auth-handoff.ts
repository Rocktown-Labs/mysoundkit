export const isBioAuthHandoffMessage = (
  event: Pick<MessageEvent<unknown>, "origin" | "source" | "data">,
  expectedOrigin: string,
  popup: Window | null
): event is Pick<MessageEvent<unknown>, "origin" | "source"> & {
  data: { token: string; type: "soundkit-auth-handoff" };
} => {
  const { data } = event;
  return (
    popup !== null &&
    event.origin === expectedOrigin &&
    event.source === popup &&
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "soundkit-auth-handoff" &&
    "token" in data &&
    typeof data.token === "string" &&
    data.token.length > 0
  );
};

export interface BioTipTarget {
  artistId: string;
  username: string;
  canReceiveTips: boolean;
}

export function canCompleteBioTip(
  requested: BioTipTarget | null,
  current: BioTipTarget | null
): boolean {
  return (
    requested !== null &&
    current !== null &&
    current.canReceiveTips &&
    requested.artistId === current.artistId &&
    requested.username.toLowerCase() === current.username.toLowerCase()
  );
}
