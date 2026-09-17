import Link from "next/link";
import WalletConnect from "./WalletConnect";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <a href="/" className="text-lg font-bold">
              BlindPulse
            </a>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="text-gray-600 hover:text-black">
                Dashboard
              </Link>
              <Link href="/create" className="text-gray-600 hover:text-black">
                Create
              </Link>
              <Link href="/feedback" className="text-gray-600 hover:text-black">
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

      <footer className="border-t py-4 text-center text-xs text-gray-400">
        Anonymous Feedback. Verifiable Participation. Powered by Midnight. ·{" "}
        <Link href="/feedback" className="hover:text-gray-600">
          Give feedback on BlindPulse (anonymously, of course)
        </Link>
      </footer>
    </div>
  );
}
