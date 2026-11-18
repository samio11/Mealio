import { LoadingAnimation } from "@/components/ui/lottie-animation";

export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <LoadingAnimation label="Loading…" size="xlarge" />
      <span>Loading…</span>
    </main>
  );
}
