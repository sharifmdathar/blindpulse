"use client";

/**
 * Optional Google Form fallback shown alongside the ZK survey form.
 *
 * Honesty note baked into the copy: Google Form responses are collected
 * by the organizer OFF-CHAIN — they are part of neither the on-chain
 * tally nor the zero-knowledge guarantee. Wallet-free, but not anonymous
 * to the form processor.
 *
 * PUBLIC: the organizer-published form URL.
 * PRIVATE: nothing — rendering a link only.
 */

interface GoogleFormFallbackProps {
  url: string;
}

export default function GoogleFormFallback({ url }: GoogleFormFallbackProps) {
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
      <p className="font-medium text-amber-800">
        Don&apos;t have a Lace wallet?
      </p>
      <p className="mt-1 text-amber-700">
        You can{" "}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-amber-900"
        >
          fill this survey via Google Forms instead
        </a>
        . Note: those responses are collected by the organizer off-chain —
        they are <span className="font-medium">not</span> part of the
        on-chain anonymous tally and not covered by the zero-knowledge
        guarantee.
      </p>
    </div>
  );
}
