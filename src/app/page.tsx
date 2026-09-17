import Link from "next/link";
import PrivacyExplainer from "@/components/PrivacyExplainer";

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">
          Anonymous Feedback.
          <br />
          <span className="text-gray-500">Verifiable Participation.</span>
        </h1>
        <p className="mx-auto mb-8 max-w-lg text-gray-600">
          Create surveys where respondents prove eligibility via ZK proof
          without revealing their identity. Only aggregate tallies hit the
          public ledger.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/create"
            className="rounded-md bg-black px-6 py-3 text-sm text-white hover:bg-gray-800"
          >
            Create Survey
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 px-6 py-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            View Dashboard
          </Link>
        </div>
      </section>

      {/* Privacy model summary */}
      <PrivacyExplainer />
    </div>
  );
}
