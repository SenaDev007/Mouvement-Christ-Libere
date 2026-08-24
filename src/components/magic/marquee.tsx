"use client";

import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  direction?: "left" | "right";
  speed?: "slow" | "medium" | "fast";
  pauseOnHover?: boolean;
}

const SPEED_DURATION = {
  slow: "60s",
  medium: "30s",
  fast: "15s",
};

export function Marquee({
  children,
  className,
  direction = "left",
  speed = "medium",
  pauseOnHover = true,
}: MarqueeProps) {
  const duration = SPEED_DURATION[speed];
  const animationName =
    direction === "left" ? "marquee-scroll-left" : "marquee-scroll-right";

  return (
    <div
      className={cn(
        "flex overflow-hidden whitespace-nowrap",
        pauseOnHover && "[&:hover>*]:[animation-play-state:paused]",
        className
      )}
    >
      <div
        className="flex shrink-0 items-center"
        style={{
          animation: `${animationName} ${duration} linear infinite`,
        }}
      >
        {children}
      </div>
      <div
        className="flex shrink-0 items-center"
        style={{
          animation: `${animationName} ${duration} linear infinite`,
        }}
        aria-hidden="true"
      >
        {children}
      </div>

      <style jsx>{`
        @keyframes marquee-scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        @keyframes marquee-scroll-right {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
