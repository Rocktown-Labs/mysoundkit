import { env } from "@soundkit/env/server";

const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "",

 getExpectedHostnames = () =>
  new Set(
    getEnvValue("TURNSTILE_HOSTNAMES")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean)
  );

export interface TurnstileVerificationResponse {
  action?: string;
  hostname?: string;
  success?: boolean;
}

export const isTurnstileResponseValid = ({
  expectedAction,
  expectedHostnames,
  response,
}: {
  expectedAction: string;
  expectedHostnames: ReadonlySet<string>;
  response: TurnstileVerificationResponse;
}) =>
  response.success === true &&
  response.action === expectedAction &&
  typeof response.hostname === "string" &&
  expectedHostnames.has(response.hostname.toLowerCase());

export const verifyTurnstileRequest = async ({
  action,
  request,
}: {
  action: string;
  request: Request;
}) => {
  const secret = getEnvValue("TURNSTILE_SECRET"),
    expectedHostnames = getExpectedHostnames();

  // Local/CI environments can remain capability-gated until a sitekey and
  // server secret are configured. Production has both GitHub bindings set.
  if (!secret || expectedHostnames.size === 0) {
    return true;
  }

  const token = request.headers.get("X-Turnstile-Token");
  if (!token || token.length > 2048) {
    return false;
  }

  const form = new URLSearchParams({
    response: token,
    secret,
  }),
   clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) {
    form.set("remoteip", clientIp);
  }

  try {
    const verificationResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        body: form,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!verificationResponse.ok) {
      return false;
    }

    const verification =
      (await verificationResponse.json()) as TurnstileVerificationResponse;
    return isTurnstileResponseValid({
      expectedAction: action,
      expectedHostnames,
      response: verification,
    });
  } catch {
    return false;
  }
};
