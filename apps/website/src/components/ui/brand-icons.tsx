import { cn } from "@/lib/utils";

export function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-5", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.492 17.306c-.215.352-.671.465-1.023.25-2.852-1.742-6.442-2.134-10.677-1.166-.402.096-.803-.156-.899-.558-.096-.402.156-.803.558-.899 4.636-1.058 8.601-.603 11.789 1.34.352.215.465.671.252 1.033zm1.466-3.253c-.272.436-.843.573-1.28.301-3.11-1.91-7.85-2.464-11.53-1.344-.492.148-1.012-.132-1.16-.624-.148-.492.132-1.012.624-1.16 4.195-1.272 9.42-.656 13.045 1.569.437.272.573.843.301 1.28zm.126-3.409C15.807 8.441 10.493 8.26 7.411 9.27c-.456.138-.936-.12-.1074-.576-.138-.456.12-.936.576-1.074 3.518-1.066 9.408-.87 13.13 1.338.408.24.552.78.312 1.188-.24.408-.78.552-1.188.312z" />
    </svg>
  );
}

export function AppleMusicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-5", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.504 15.143c-.413.435-.97.712-1.57.787v-5.61c.6.075 1.157.352 1.57.787.413.435.659 1.012.659 1.618 0 .606-.246 1.183-.659 1.618zM12 18.25c-3.452 0-6.25-2.798-6.25-6.25S8.548 5.75 12 5.75c.983 0 1.9.227 2.716.633l-.707.707C13.385 6.817 12.71 6.75 12 6.75c-2.895 0-5.25 2.355-5.25 5.25s2.355 5.25 5.25 5.25c.71 0 1.385-.067 2.009-.34l.707.707c-.816.406-1.733.633-2.716.633zm3.75-6.25c0-.98-.396-1.867-1.035-2.506l.707-.707c.82.82 1.328 1.954 1.328 3.213s-.508 2.393-1.328 3.213l-.707-.707c.639-.639 1.035-1.526 1.035-2.506z" />
    </svg>
  );
}

export function YoutubeMusicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-5", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 17.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zm0-9.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-1.5 6l4-2-4-2v4z" />
    </svg>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-5", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z" />
    </svg>
  );
}
