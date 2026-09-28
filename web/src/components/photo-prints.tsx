import type { CSSProperties } from "react";
import "@/styles/photo-prints.css";

const PRINTS = [
  { src: "/photos/corgi-douche.jpg", rotate: -3, shift: 6 },
  { src: "/photos/chien-plage.jpg", rotate: -1.5, shift: -4 },
  { src: "/photos/chiens-panier.png", rotate: 0.5, shift: 2 },
  { src: "/photos/chien-portrait.jpg", rotate: 2.5, shift: -5 },
  { src: "/photos/gobelet-mozza.jpg", rotate: -2, shift: 5 },
] as const;

export function PhotoPrints() {
  return (
    <div className="photo-prints" aria-hidden="true">
      {PRINTS.map((print) => (
        <div
          key={print.src}
          className="photo-print"
          style={
            {
              "--r": `${print.rotate}deg`,
              "--y": `${print.shift}px`,
            } as CSSProperties
          }
        >
          <span className="photo-print-frame">
            <img src={print.src} alt="" />
          </span>
        </div>
      ))}
    </div>
  );
}
