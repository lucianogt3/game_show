import React, { useEffect, useRef } from "react";

type Props = {
  speedBack?: number;  // camada mais distante
  speedMid?: number;   // camada do meio
  speedFront?: number; // camada frente
};

export default function ArcadeBackground({
  speedBack = 10,
  speedMid = 25,
  speedFront = 45,
}: Props) {
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      tRef.current += 0.016; // ~60fps
      const t = tRef.current;

      // movimenta via CSS variables
      const root = document.documentElement;
      root.style.setProperty("--bg-x-back", `${(t * speedBack) % 100}vw`);
      root.style.setProperty("--bg-x-mid", `${(t * speedMid) % 100}vw`);
      root.style.setProperty("--bg-x-front", `${(t * speedFront) % 100}vw`);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [speedBack, speedMid, speedFront]);

  return (
    <div className="arcade-bg" aria-hidden="true">
      <div className="layer back" />
      <div className="layer mid" />
      <div className="layer front" />
      <div className="vignette" />
      <div className="scanlines" />
      <div className="glow" />
    </div>
  );
}
