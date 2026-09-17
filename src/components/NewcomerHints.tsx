"use client";

/**
 * Newcomer hints for the wallet connect walls: what to install, which
 * network, and where to get test funds. Renders nothing once a wallet
 * is connected, so pages can include it unconditionally.
 *
 * PUBLIC: static help text and public URLs only.
 * PRIVATE: nothing.
 */

import { useWallet } from "@/hooks/useWallet";

export default function NewcomerHints() {
  const { isConnected } = useWallet();
  if (isConnected) return null;

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
      <p className="font-medium text-gray-800">New here? Two-minute setup:</p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5">
        <li>
          Install the <span className="font-medium">1AM</span> or{" "}
          <span className="font-medium">Lace</span> Midnight wallet from your
          browser&apos;s extension store, and set it to the{" "}
          <span className="font-medium">Preprod</span> network.
        </li>
        <li>
          Grab free test NIGHT at the{" "}
          <a
            href="https://faucet.preprod.midnight.network/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-800"
          >
            Midnight Preprod faucet
          </a>{" "}
          (no real funds needed).
        </li>
        <li>Click Connect Wallet above and approve in the wallet.</li>
      </ol>
      <p className="mt-2 text-xs text-gray-400">
        No wallet and just want to answer? If this survey offers a Google
        Form fallback, it appears on this page.
      </p>
    </div>
  );
}
