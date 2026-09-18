import Link from "next/link";
import WalletConnect from "./WalletConnect";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-night-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              {/* Waxing moon mark */}
              <span className="relative inline-flex h-6 w-6 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-moon-100 to-glow shadow-glow-sm" />
                <span className="absolute inset-0 translate-x-1.5 rounded-full bg-night-950" />
              </span>
              <span className="bg-moon-text bg-clip-text text-lg font-bold tracking-tight text-transparent">
                BlindPulse
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className="text-moon-300 transition-colors hover:text-moon-50"
              >
                Dashboard
              </Link>
              <Link
                href="/create"
                className="text-moon-300 transition-colors hover:text-moon-50"
              >
                Create
              </Link>
              <Link
                href="/feedback"
                className="text-moon-300 transition-colors hover:text-moon-50"
              >
                Feedback
              </Link>
            </nav>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-white/10 py-5 text-center text-xs text-moon-300/60">
        Anonymous Feedback. Verifiable Participation. Powered by Midnight. ·{" "}
        <Link
          href="/feedback"
          className="transition-colors hover:text-moon-100"
        >
          Give feedback on BlindPulse (anonymously, of course)
        </Link>
      </footer>
    </div>
  );
}
