export function SpotifyIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.505 17.307a.747.747 0 0 1-1.027.248c-2.812-1.719-6.353-2.107-10.53-1.153a.748.748 0 0 1-.333-1.459c4.57-1.044 8.486-.596 11.641 1.333.352.216.464.677.249 1.031Zm1.469-3.268a.936.936 0 0 1-1.287.309c-3.22-1.979-8.128-2.552-11.935-1.397a.936.936 0 1 1-.544-1.792c4.351-1.32 9.759-.681 13.457 1.591.441.271.58.848.309 1.289Zm.126-3.403c-3.861-2.293-10.233-2.505-13.915-1.386a1.122 1.122 0 0 1-.652-2.146c4.227-1.284 11.265-1.034 15.713 1.605a1.122 1.122 0 1 1-1.146 1.927Z" />
    </svg>
  );
}

export function AppleMusicIcon({
  className = "size-5",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.63 3.09c.17-.02.33.11.33.28v11.25c0 2.48-1.38 3.56-3.04 3.88-1.61.31-2.94-.41-3.18-1.66-.24-1.22.78-2.39 2.31-2.69.69-.13 1.32-.08 1.83.13V7.49l-7.75 1.5v7.33c0 2.48-1.38 3.56-3.04 3.88-1.61.31-2.94-.41-3.18-1.66-.24-1.22.78-2.39 2.31-2.69.69-.13 1.32-.08 1.83.13V6.25c0-.69.48-1.29 1.16-1.42l10.42-1.74Z" />
    </svg>
  );
}

export function YoutubeIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function InstagramIcon({
  className = "size-5",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="20" rx="5" ry="5" width="20" x="2" y="2" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function TwitterIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z" />
    </svg>
  );
}

export function TikTokIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-5.2-1.74 2.89 2.89 0 0 1 2.31-1.42V8.9a6.34 6.34 0 0 0-5.11 6.25 6.34 6.34 0 0 0 11.45-3.87V9a8.28 8.28 0 0 0 4.77 1.5V7.05a4.83 4.83 0 0 1-1.00-.36Z" />
    </svg>
  );
}
