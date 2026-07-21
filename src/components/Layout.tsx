import WalletConnect from "./WalletConnect";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <a href="/" className="text-lg font-bold">
            BlindPulse
          </a>
          <WalletConnect />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-t py-4 text-center text-xs text-gray-400">
        Anonymous Feedback. Verifiable Participation. Powered by Midnight.
      </footer>
    </div>
  );
}
