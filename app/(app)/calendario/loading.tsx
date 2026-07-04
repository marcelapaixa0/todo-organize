export default function Loading() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}
