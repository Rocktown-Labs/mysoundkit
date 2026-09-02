import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { createFileRoute } from "@tanstack/react-router";
/* eslint-disable complexity, no-nested-ternary, one-var, sort-vars, react/todo */
import {
  ArrowUpRight,
  Check,
  Disc3,
  ExternalLink,
  HandCoins,
  Headphones,
  Instagram,
  Link2,
  LoaderCircle,
  Music2,
  Play,
  Sparkles,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  API_V1_URL,
  SOUNDKIT_BIO_URL,
  SOUNDKIT_WEB_URL,
  STRIPE_PUBLISHABLE_KEY,
  isSafeExternalUrl,
  loadBioProfile,
} from "@/lib/api";
import type { BioArtist, BioProfile, BioTrack } from "@/lib/api";

const SOUNDKIT_WEB_ORIGIN = new URL(SOUNDKIT_WEB_URL).origin,
  stripePromise = STRIPE_PUBLISHABLE_KEY
    ? loadStripe(STRIPE_PUBLISHABLE_KEY)
    : null,
  presetAmounts = [500, 1000, 2500, 5000] as const,
  formatDollars = (amountCents: number) => `$${(amountCents / 100).toFixed(2)}`,
  isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === "object"),
  absoluteUrl = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }

    try {
      return new URL(value, SOUNDKIT_WEB_URL).toString();
    } catch {
      return null;
    }
  },
  formatCount = (value: number | undefined) => {
    if (!value) {
      return "0";
    }

    return new Intl.NumberFormat("en", {
      maximumFractionDigits: 1,
      notation: "compact",
    }).format(value);
  };

export const Route = createFileRoute("/$username")({
  component: BioProfilePage,
  head: ({ loaderData, params }) => {
    const profile = loaderData as unknown as BioProfile | null,
      name = profile?.artist.name ?? `@${params.username}`,
      description =
        profile?.artist.bio ??
        `Listen to ${name}'s music and support the artist directly on SoundKit.`,
      image =
        absoluteUrl(profile?.artist.coverImageUrl) ??
        absoluteUrl(profile?.artist.avatarUrl),
      canonical = `${SOUNDKIT_BIO_URL}/${encodeURIComponent(params.username)}`;

    return {
      links: [{ href: canonical, rel: "canonical" }],
      meta: [
        { title: `${name} — SoundKit` },
        { content: description, name: "description" },
        { content: canonical, property: "og:url" },
        { content: "profile", property: "og:type" },
        { content: name, property: "og:title" },
        { content: description, property: "og:description" },
        ...(image ? [{ content: image, property: "og:image" }] : []),
        { content: "summary_large_image", name: "twitter:card" },
        { content: name, name: "twitter:title" },
        { content: description, name: "twitter:description" },
        ...(image ? [{ content: image, name: "twitter:image" }] : []),
      ],
    };
  },
  loader: async ({ params }) => await loadBioProfile(params.username),
});

function BioProfilePage() {
  const profile = Route.useLoaderData() as unknown as BioProfile | null,
    [authToken, setAuthToken] = useState<string | null>(null),
    [authMessage, setAuthMessage] = useState<string | null>(null),
    [isTipOpen, setIsTipOpen] = useState(false),
    beginAuthHandoff = () => {
      const returnOrigin = window.location.origin,
        loginUrl = `${SOUNDKIT_WEB_URL}/auth/handoff?returnOrigin=${encodeURIComponent(returnOrigin)}`,
        popup = window.open(
          loginUrl,
          "soundkit-auth-handoff",
          "popup,width=480,height=760,resizable,scrollbars"
        );

      if (!popup) {
        setAuthMessage("Allow pop-ups to sign in securely with SoundKit.");
        return;
      }

      setAuthMessage("Sign in in the SoundKit window, then return here.");
    },
    handleTipClick = () => {
      if (authToken) {
        setIsTipOpen(true);
        return;
      }

      beginAuthHandoff();
    };

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== SOUNDKIT_WEB_ORIGIN || !isRecord(event.data)) {
        return;
      }

      if (
        event.data.type !== "soundkit-auth-handoff" ||
        typeof event.data.token !== "string"
      ) {
        return;
      }

      setAuthToken(event.data.token);
      setAuthMessage("Signed in. Your secure tip checkout is ready.");
      setIsTipOpen(true);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!profile) {
    return <ProfileNotFound />;
  }

  const { artist, media } = profile,
    tracks = media.tracks.length > 0 ? media.tracks : media.featuredTracks,
    links = [
      ["Instagram", artist.links?.instagram, Instagram],
      ["YouTube", artist.links?.youtube, Youtube],
      ["Spotify", artist.links?.spotify, Headphones],
      ["Website", artist.links?.personalSite, ExternalLink],
      ["SoundCloud", artist.links?.soundcloud, Music2],
    ] as const;

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="flex items-center justify-between text-xs text-white/55">
        <a className="flex items-center gap-2 tracking-[0.2em]" href="/">
          <Disc3 className="size-4 text-orange-300" />
          SOUNDKIT.BIO
        </a>
        <a
          className="inline-flex items-center gap-1.5 transition hover:text-white"
          href={SOUNDKIT_WEB_URL}
          rel="noopener"
        >
          Powered by SoundKit <ArrowUpRight className="size-3.5" />
        </a>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 sm:p-8">
        <div className="absolute inset-0 opacity-25">
          {artist.coverImageUrl ? (
            <img
              alt=""
              className="size-full object-cover blur-2xl"
              height={500}
              src={artist.coverImageUrl}
              width={900}
            />
          ) : null}
        </div>
        <div className="absolute inset-0 bg-[#101010]/75" />
        <div className="relative">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-orange-300 to-violet-500 text-4xl font-semibold text-black shadow-2xl shadow-black/30 sm:size-36">
              {artist.avatarUrl ? (
                <img
                  alt={`${artist.name} avatar`}
                  className="size-full object-cover"
                  height={144}
                  src={artist.avatarUrl}
                  width={144}
                />
              ) : (
                artist.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-notable text-[10px] uppercase tracking-[0.3em] text-orange-300">
                Artist profile
              </p>
              <h1 className="mt-2 flex flex-wrap items-center gap-2 font-playfair text-4xl leading-none sm:text-5xl">
                {artist.name}
                {artist.verified ? (
                  <span
                    aria-label="Verified artist"
                    className="inline-flex size-5 items-center justify-center rounded-full bg-orange-300 text-black"
                    title="Verified artist"
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </h1>
              <p className="mt-2 text-sm text-white/60">
                @{artist.username} · {artist.genre}
                {artist.location ? ` · ${artist.location}` : ""}
              </p>
            </div>
          </div>

          {artist.bio ? (
            <p className="relative mt-7 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-white/75">
              {artist.bio}
            </p>
          ) : null}

          <div className="relative mt-7 flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-orange-300 px-5 py-2.5 font-semibold text-black text-sm transition hover:bg-orange-200"
              onClick={handleTipClick}
              type="button"
            >
              <HandCoins className="size-4" />
              {authToken ? `Tip ${artist.name}` : "Tip this artist"}
            </button>
            <a
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 font-medium text-sm text-white/80 transition hover:border-white/40 hover:text-white"
              href={`${SOUNDKIT_WEB_URL}/artist/${encodeURIComponent(artist.username)}`}
              rel="noopener"
            >
              Full SoundKit profile <ArrowUpRight className="size-4" />
            </a>
          </div>
          {authMessage ? (
            <p
              aria-live="polite"
              className="relative mt-3 text-xs text-orange-200"
            >
              {authMessage}
            </p>
          ) : null}
        </div>
      </section>

      <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_180px]">
        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-notable text-[10px] uppercase tracking-[0.25em] text-white/45">
                <Sparkles className="size-3.5 text-orange-300" />
                Latest music
              </p>
              <h2 className="mt-2 font-playfair text-3xl">Press play.</h2>
            </div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45">
              {tracks.length} releases
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {tracks.length > 0 ? (
              tracks
                .slice(0, 12)
                .map((track) => <BioTrackRow key={track.id} track={track} />)
            ) : (
              <p className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-white/50">
                New music is on the way.
              </p>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
              About
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/65">
              <p>{formatCount(artist.followers)} followers</p>
              <p>{formatCount(artist.trackCount)} tracks</p>
              <p>{artist.genre}</p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40">
              <Link2 className="size-3.5" /> Connect
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {links.map(([label, href, Icon]) =>
                isSafeExternalUrl(href) ? (
                  <a
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-orange-300/60 hover:text-orange-200"
                    href={href}
                    key={label}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Icon className="size-3.5" /> {label}
                  </a>
                ) : null
              )}
            </div>
          </div>
        </aside>
      </div>

      <footer className="mt-8 flex items-center justify-between gap-4 px-1 text-xs text-white/35">
        <span>Direct support for independent music.</span>
        <a className="hover:text-white" href={SOUNDKIT_WEB_URL} rel="noopener">
          SoundKit <ArrowUpRight className="inline size-3" />
        </a>
      </footer>

      <TipCheckoutDialog
        artist={artist}
        authToken={authToken}
        onOpenChange={setIsTipOpen}
        onReauthenticate={beginAuthHandoff}
        open={isTipOpen}
      />
    </main>
  );
}

function BioTrackRow({ track }: { track: BioTrack }) {
  return (
    <article className="rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-white/20">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-orange-300/80 to-violet-500/80">
          {track.coverArtUrl ? (
            <img
              alt={`${track.title} cover`}
              className="size-full object-cover"
              height={44}
              src={track.coverArtUrl}
              width={44}
            />
          ) : (
            <Music2 className="size-5 text-black/70" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-sm">{track.title}</h3>
          <p className="truncate text-xs text-white/45">
            {track.artistName} · {track.duration}
          </p>
        </div>
        <a
          aria-label={`Open ${track.title} on SoundKit`}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
          href={`${SOUNDKIT_WEB_URL}/tracks/${encodeURIComponent(track.id)}`}
          rel="noopener"
        >
          <ArrowUpRight className="size-4" />
        </a>
      </div>
      {track.playbackUrl ? (
        <audio
          className="mt-3 h-8 w-full opacity-80"
          controls
          preload="none"
          src={track.playbackUrl}
        >
          <track
            kind="captions"
            label="No captions available"
            src="/empty-captions.vtt"
            srcLang="en"
          />
        </audio>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/35">
          <Play className="size-3" /> Preview is still processing.
        </p>
      )}
    </article>
  );
}

function TipCheckoutDialog({
  artist,
  authToken,
  onOpenChange,
  onReauthenticate,
  open,
}: {
  artist: BioArtist;
  authToken: string | null;
  onOpenChange: (open: boolean) => void;
  onReauthenticate: () => void;
  open: boolean;
}) {
  const [amountCents, setAmountCents] = useState(1000),
    [customAmount, setCustomAmount] = useState("10.00"),
    [message, setMessage] = useState(""),
    [clientSecret, setClientSecret] = useState<string | null>(null),
    [isSubmitting, setIsSubmitting] = useState(false),
    [errorMessage, setErrorMessage] = useState<string | null>(null),
    checkoutOptions = clientSecret ? { clientSecret } : null,
    close = () => {
      setClientSecret(null);
      setErrorMessage(null);
      onOpenChange(false);
    },
    selectPreset = (preset: number) => {
      setAmountCents(preset);
      setCustomAmount((preset / 100).toFixed(2));
      setErrorMessage(null);
    },
    handleCustomAmountChange = (value: string) => {
      setCustomAmount(value);
      const parsed = Number(value);
      setAmountCents(Number.isFinite(parsed) ? Math.round(parsed * 100) : 0);
      setErrorMessage(null);
    },
    handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!(authToken && amountCents >= 100 && amountCents <= 100_000)) {
        setErrorMessage("Choose an amount between $1.00 and $1,000.00.");
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const response = await fetch(`${API_V1_URL}/payments/tips`, {
            body: JSON.stringify({
              amountCents,
              artistUserId: artist.id,
              cancelUrl: window.location.href,
              idempotencyKey: crypto.randomUUID(),
              message: message.trim() || undefined,
              successUrl: `${window.location.href}#tip-complete`,
            }),
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            method: "POST",
          }),
          payload: unknown = await response.json().catch(() => null);

        if (response.status === 401) {
          setErrorMessage("Your sign-in expired. Sign in again to continue.");
          return;
        }
        if (!response.ok) {
          const apiMessage =
            isRecord(payload) && typeof payload.message === "string"
              ? payload.message
              : "Unable to start secure checkout.";
          throw new Error(apiMessage);
        }

        const nextClientSecret =
          isRecord(payload) && typeof payload.clientSecret === "string"
            ? payload.clientSecret
            : null;
        if (nextClientSecret) {
          setClientSecret(nextClientSecret);
          return;
        }

        setErrorMessage(
          isRecord(payload) && payload.setupRequired === true
            ? "Tip checkout is temporarily unavailable."
            : "Stripe checkout could not be started."
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to start secure checkout."
        );
      } finally {
        setIsSubmitting(false);
      }
    };

  if (!open) {
    return null;
  }

  return (
    <dialog
      aria-labelledby="tip-dialog-title"
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-w-none items-end justify-center border-0 bg-black/75 p-4 backdrop-blur-sm sm:items-center"
      open
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/15 bg-[#1b1b1b] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-notable text-[10px] uppercase tracking-[0.25em] text-orange-300">
              Direct support
            </p>
            <h2 className="mt-2 font-playfair text-3xl" id="tip-dialog-title">
              Tip {artist.name}
            </h2>
            <p className="mt-2 text-sm text-white/55">
              Your tip goes through SoundKit’s secure Stripe checkout.
            </p>
          </div>
          <button
            aria-label="Close tip dialog"
            className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
            onClick={close}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        {clientSecret && stripePromise && checkoutOptions ? (
          <div className="mt-6 min-h-[520px] overflow-hidden rounded-2xl bg-white">
            <EmbeddedCheckoutProvider
              options={checkoutOptions}
              stripe={stripePromise}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <fieldset>
              <legend className="font-medium text-sm">Choose an amount</legend>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {presetAmounts.map((preset) => (
                  <button
                    className={`rounded-xl border px-2 py-2.5 font-medium text-sm transition ${amountCents === preset ? "border-orange-300 bg-orange-300 text-black" : "border-white/15 text-white/75 hover:border-white/35"}`}
                    key={preset}
                    onClick={() => selectPreset(preset)}
                    type="button"
                  >
                    {formatDollars(preset)}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm">
              <span className="text-white/65">Custom amount</span>
              <div className="mt-2 flex items-center rounded-xl border border-white/15 bg-black/20 px-3 focus-within:border-orange-300">
                <span className="text-white/45">$</span>
                <input
                  aria-label="Custom tip amount"
                  className="w-full bg-transparent px-2 py-3 outline-none"
                  inputMode="decimal"
                  min="1"
                  onChange={(event) =>
                    handleCustomAmountChange(event.target.value)
                  }
                  step="0.01"
                  type="number"
                  value={customAmount}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="text-white/65">Message (optional)</span>
              <textarea
                className="mt-2 min-h-20 w-full resize-y rounded-xl border border-white/15 bg-black/20 px-3 py-3 outline-none focus:border-orange-300"
                maxLength={500}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Keep creating!"
                value={message}
              />
            </label>
            {errorMessage ? (
              <p aria-live="polite" className="text-sm text-red-300">
                {errorMessage}{" "}
                {errorMessage.includes("expired") ? (
                  <button
                    className="underline"
                    onClick={() => {
                      close();
                      onReauthenticate();
                    }}
                    type="button"
                  >
                    Sign in again
                  </button>
                ) : null}
              </p>
            ) : null}
            <button
              className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-300 px-5 py-3 font-semibold text-black transition hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting || !stripePromise}
              type="submit"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" /> Preparing
                  checkout…
                </>
              ) : (
                `Continue with ${formatDollars(amountCents)}`
              )}
            </button>
            {stripePromise ? (
              <span className="sr-only">Stripe checkout is configured.</span>
            ) : (
              <p className="text-center text-xs text-white/40">
                Checkout is not configured in this environment.
              </p>
            )}
          </form>
        )}
      </div>
    </dialog>
  );
}

function ProfileNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="max-w-md text-center">
        <Disc3 className="mx-auto size-8 text-orange-300" />
        <h1 className="mt-5 font-playfair text-4xl">Profile not found</h1>
        <p className="mt-3 text-sm text-white/55">
          This artist profile is unavailable or has not been published yet.
        </p>
        <a
          className="mt-6 inline-flex rounded-full border border-white/20 px-5 py-2.5 text-sm transition hover:border-white/40"
          href="/"
        >
          Browse SoundKit.bio
        </a>
      </section>
    </main>
  );
}
