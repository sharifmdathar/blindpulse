export default function EligibilityBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      Eligibility verified via ZK proof
    </span>
  );
}
