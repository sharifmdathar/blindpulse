export default function PrivacyExplainer() {
  return (
    <div className="rounded-lg border p-6">
      <h3 className="mb-4 text-lg font-semibold">
        Privacy Model
      </h3>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-medium text-red-600">
            🔒 Private (never on-chain)
          </h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Your wallet identity</li>
            <li>• Your individual responses</li>
            <li>• Your eligibility credential</li>
          </ul>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-green-600">
            🌐 Public (on-chain)
          </h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Aggregate tally per option</li>
            <li>• Total participant count</li>
            <li>• Nullifiers (anti-double-submit only)</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-md bg-blue-50 p-3 text-xs text-blue-700">
        Responses are submitted through a Zero-Knowledge circuit. Your
        answers and identity are private witnesses — they prove eligibility
        without revealing WHO you are or WHAT you answered. Only the
        group-level tally is recorded on the public ledger.
      </div>
    </div>
  );
}
