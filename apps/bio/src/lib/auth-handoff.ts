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
