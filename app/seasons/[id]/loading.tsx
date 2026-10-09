// A season builds a board per clan and a board is a season's worth of wars, so this is the
// one page you can watch arrive. Covers the clan boards underneath it too.
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-72 animate-pulse rounded bg-panel2" />
      <div className="h-4 w-96 animate-pulse rounded bg-panel2" />
      <div className="card h-72 animate-pulse" />
    </div>
  );
}
