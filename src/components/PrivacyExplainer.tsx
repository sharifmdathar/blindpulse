export default function PrivacyExplainer() {
  return (
    <div className="card p-6">
      <h3 className="mb-4 text-lg font-semibold text-moon-50">Privacy Model</h3>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <h4 className="mb-2 text-sm font-medium text-rose-300">
            🔒 Private (never on-chain)
          </h4>
          <ul className="space-y-1 text-sm text-moon-300">
            <li>• Your wallet identity</li>
            <li>• Your individual responses</li>
            <li>• Your eligibility credential</li>
          </ul>
        </div>

        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
          <h4 className="mb-2 text-sm font-medium text-emerald-300">
            🌐 Public (on-chain)
          </h4>
          <ul className="space-y-1 text-sm text-moon-300">
            <li>• Aggregate tally per option</li>
            <li>• Total participant count</li>
            <li>• Nullifiers (anti-double-submit only)</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-glow/30 bg-glow/[0.06] p-3 text-xs text-moon-200">
        Responses are submitted through a Zero-Knowledge circuit. Your answers
        and identity are private witnesses — they prove eligibility without
        revealing WHO you are or WHAT you answered. Only the group-level tally
        is recorded on the public ledger.
      </div>
    </div>
  );
}
