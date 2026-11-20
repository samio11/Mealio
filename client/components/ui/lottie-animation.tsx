"use client";

import { Lottie, type LottieHandle } from "lottie-react";
import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";

import blockedUserAnimation from "@/public/block_user.json";
import notFoundAnimation from "@/components/ui/404.json";
import loadingAnimation from "@/components/ui/loading.json";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale";

const sizes = {
  small: 32,
  medium: 96,
  large: 176,
  xlarge: 240,
} as const;

function AnimationPlayer({
  src,
  loop,
  size,
  className,
}: {
  src: object;
  loop: boolean;
  size: keyof typeof sizes;
  className?: string;
}) {
  const { translate: t } = useLocale();
  const lottieRef = useRef<LottieHandle>(null);
  const [paused, setPaused] = useState(false);

  function togglePlayback() {
    const player = lottieRef.current;
    if (!player) return;
    if (paused) player.play();
    else player.pause();
    setPaused(!paused);
  }

  return (
    <div className={cn("flex shrink-0 items-center justify-center gap-1", className)}>
      <Lottie
        src={src}
        autoplay
        loop={loop}
        lottieRef={lottieRef}
        aria-hidden="true"
        className="shrink-0"
        style={{
          width: size === "xlarge" ? "min(15rem, 62vw)" : sizes[size],
          height: size === "xlarge" ? "min(15rem, 62vw)" : sizes[size],
        }}
      />
      <button
        type="button"
        aria-label={t(paused ? "Resume animation" : "Pause animation")}
        title={t(paused ? "Resume animation" : "Pause animation")}
        onClick={togglePlayback}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
      </button>
    </div>
  );
}

export function LoadingAnimation({
  label = "Loading…",
  size = "medium",
  className,
}: {
  label?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const { translate: t } = useLocale();

  return (
    <div role="status" aria-live="polite" className={cn("flex shrink-0 items-center justify-center", className)}>
      <AnimationPlayer src={loadingAnimation} loop size={size} />
      <span className="sr-only">{t(label)}</span>
    </div>
  );
}

export function NotFoundAnimation({
  className,
  size = "large",
}: {
  className?: string;
  size?: keyof typeof sizes;
}) {
  return (
    <AnimationPlayer
      src={notFoundAnimation}
      loop={false}
      size={size}
      className={className}
    />
  );
}

export function BlockedUserAnimation({ className }: { className?: string }) {
  return (
    <AnimationPlayer
      src={blockedUserAnimation}
      loop
      size="xlarge"
      className={className}
    />
  );
}
