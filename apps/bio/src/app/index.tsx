import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Disc3, Sparkles } from "lucide-react";

import { SOUNDKIT_WEB_URL } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: BioHomePage,
});

function BioHomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-sm text-orange-300">
          <Disc3 className="size-4" />
          SOUNDKIT.BIO
        </div>
        <h1 className="mt-6 font-playfair text-5xl leading-[0.95] tracking-tight sm:text-7xl">
          One link for the music you make.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/65">
          Artist profiles, releases, and direct support — powered by SoundKit.
          Visit an artist profile at{" "}
          <span className="text-white">/username</span>.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <a
            className="inline-flex items-center gap-2 rounded-full bg-orange-300 px-5 py-3 font-semibold text-black transition hover:bg-orange-200"
            href={SOUNDKIT_WEB_URL}
            rel="noopener"
          >
            Explore SoundKit <ArrowRight className="size-4" />
          </a>
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 font-medium text-white/80 transition hover:border-white/40 hover:text-white"
            to="/"
          >
            <Sparkles className="size-4" />
            Artist profiles
          </Link>
        </div>
      </div>
    </main>
  );
}
