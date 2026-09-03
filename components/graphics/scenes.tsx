import { cn } from "@/lib/utils/cn";

/**
 * Illustration system.
 *
 * The site ships without a photo library, so rather than leaving empty frames
 * every surface that would hold a job photo renders a drawn scene instead:
 * five subjects (siding, concrete, deck, roof, storefront) in a "before" and
 * "after" state. Pure SVG - no external assets, no layout shift, and the
 * before/after pairs are the actual point of the gallery.
 */

export type SceneKind = "siding" | "concrete" | "deck" | "roof" | "storefront";
export type SceneState = "before" | "after";

export interface SceneProps {
  kind: SceneKind;
  state?: SceneState;
  className?: string;
  /** Decorative by default; pass a label when the scene carries meaning. */
  label?: string;
}

interface GrimeLevels {
  organic: number;
  streak: number;
  stain: number;
  wash: number;
}

const GRIME: Record<SceneState, GrimeLevels> = {
  before: { organic: 0.55, streak: 0.42, stain: 0.3, wash: 0.22 },
  after: { organic: 0, streak: 0, stain: 0, wash: 0 },
};

function Sky({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bcdcf5" />
          <stop offset="100%" stopColor="#e8f3fb" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}-sky)`} />
    </>
  );
}

function Grime({ id, opacity, seed }: { id: string; opacity: number; seed: number }) {
  if (opacity === 0) return null;
  return (
    <>
      <defs>
        <filter id={`${id}-grime`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed={seed} />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.22
                    0 0 0 0 0.28
                    0 0 0 0 0.16
                    0 0 0 1.1 -0.35"
          />
        </filter>
      </defs>
      <rect width="400" height="300" filter={`url(#${id}-grime)`} opacity={opacity} />
    </>
  );
}

function Siding({ id, g }: { id: string; g: GrimeLevels }) {
  return (
    <>
      <Sky id={id} />
      {/* lawn */}
      <rect y="252" width="400" height="48" fill="#7fa864" />
      <rect y="252" width="400" height="6" fill="#6d9455" />
      {/* wall */}
      <rect x="26" y="66" width="348" height="188" fill="#e9eef2" />
      {Array.from({ length: 14 }).map((_, index) => (
        <rect key={index} x="26" y={70 + index * 13} width="348" height="1.6" fill="#cdd6de" />
      ))}
      {/* roof */}
      <path d="M8 70 L200 12 L392 70 Z" fill="#4b5b69" />
      <path d="M8 70 L200 12 L392 70 Z" fill="none" stroke="#3a4652" strokeWidth="2" />
      {/* windows */}
      {[70, 168, 266].map((x) => (
        <g key={x}>
          <rect x={x} y="104" width="58" height="70" rx="2" fill="#2f4a63" />
          <rect x={x + 4} y="108" width="50" height="62" fill="#8fb7d6" />
          <rect x={x + 27} y="108" width="3" height="62" fill="#2f4a63" />
          <rect x={x + 4} y="136" width="50" height="3" fill="#2f4a63" />
        </g>
      ))}
      {/* door */}
      <rect x="176" y="186" width="48" height="68" rx="2" fill="#1d4f7a" />
      <circle cx="215" cy="222" r="2.6" fill="#e6c86a" />
      {/* gutter + downspout */}
      <rect x="26" y="66" width="348" height="7" fill="#f5f8fa" />
      <rect x="30" y="73" width="8" height="181" fill="#e2e8ee" />
      {/* organic growth low on the wall (north side) */}
      <g opacity={g.organic}>
        <path d="M26 254 Q60 214 96 254 Z" fill="#5d7a4a" opacity="0.55" />
        <path d="M300 254 Q334 206 374 254 Z" fill="#5d7a4a" opacity="0.5" />
        <rect x="26" y="228" width="348" height="26" fill="#6a7c56" opacity="0.4" />
      </g>
      <Grime id={id} opacity={g.wash} seed={4} />
    </>
  );
}

function Concrete({ id, g }: { id: string; g: GrimeLevels }) {
  return (
    <>
      <Sky id={id} />
      <rect y="40" width="400" height="40" fill="#7fa864" />
      {/* slab in perspective */}
      <path d="M96 80 L304 80 L392 300 L8 300 Z" fill="#d6d9db" />
      <path d="M96 80 L304 80 L392 300 L8 300 Z" fill="none" stroke="#b7bcc0" strokeWidth="2" />
      {/* expansion joints */}
      {[0.28, 0.52, 0.76].map((t, index) => {
        const y = 80 + t * 220;
        const halfWidth = 104 + t * 88;
        return (
          <line
            key={index}
            x1={200 - halfWidth}
            y1={y}
            x2={200 + halfWidth}
            y2={y}
            stroke="#b0b5b9"
            strokeWidth="2.5"
          />
        );
      })}
      <line x1="200" y1="80" x2="200" y2="300" stroke="#b0b5b9" strokeWidth="2.5" />
      {/* garage face */}
      <rect x="86" y="18" width="228" height="62" fill="#e9eef2" />
      <rect x="118" y="30" width="164" height="50" rx="2" fill="#c3ccd4" />
      {Array.from({ length: 4 }).map((_, index) => (
        <line
          key={index}
          x1="118"
          y1={40 + index * 11}
          x2="282"
          y2={40 + index * 11}
          stroke="#aeb8c1"
          strokeWidth="1.5"
        />
      ))}
      {/* oil shadow + tire marks */}
      <g opacity={g.stain}>
        <ellipse cx="200" cy="120" rx="34" ry="15" fill="#4a4a48" opacity="0.7" />
        <ellipse cx="188" cy="140" rx="16" ry="8" fill="#4a4a48" opacity="0.5" />
        <path d="M140 300 Q160 190 176 84" stroke="#54534f" strokeWidth="14" fill="none" opacity="0.35" />
        <path d="M260 300 Q240 190 224 84" stroke="#54534f" strokeWidth="14" fill="none" opacity="0.35" />
      </g>
      {/* mildew line creeping from the lawn edge */}
      <g opacity={g.organic}>
        <path d="M8 300 L46 300 L120 84 L96 84 Z" fill="#5f7350" opacity="0.5" />
        <path d="M392 300 L354 300 L280 84 L304 84 Z" fill="#5f7350" opacity="0.5" />
      </g>
      <Grime id={id} opacity={g.wash} seed={11} />
    </>
  );
}

function Deck({ id, g }: { id: string; g: GrimeLevels }) {
  return (
    <>
      <Sky id={id} />
      <rect y="30" width="400" height="34" fill="#7fa864" />
      {/* house wall behind */}
      <rect y="0" width="400" height="34" fill="#e2e8ee" />
      {/* deck boards */}
      <rect y="64" width="400" height="236" fill="#c99a63" />
      {Array.from({ length: 12 }).map((_, index) => (
        <rect key={index} y={64 + index * 20} width="400" height="2.5" fill="#a97f4e" />
      ))}
      {/* railing */}
      <rect x="0" y="46" width="400" height="10" rx="2" fill="#d9ac74" />
      {Array.from({ length: 13 }).map((_, index) => (
        <rect key={index} x={12 + index * 31} y="56" width="7" height="34" fill="#d0a26b" />
      ))}
      <rect x="0" y="88" width="400" height="7" fill="#c99a63" />
      {/* graying / algae film on the shaded half */}
      <g opacity={g.wash}>
        <rect y="64" width="400" height="236" fill="#8a8b84" opacity="0.55" />
      </g>
      <g opacity={g.organic}>
        <rect y="196" width="400" height="104" fill="#6c7d55" opacity="0.45" />
        <path d="M0 300 Q80 236 160 300 Z" fill="#5d7a4a" opacity="0.4" />
      </g>
      <Grime id={id} opacity={g.streak * 0.5} seed={7} />
    </>
  );
}

function Roof({ id, g }: { id: string; g: GrimeLevels }) {
  return (
    <>
      <Sky id={id} />
      {/* roof plane */}
      <path d="M0 300 L60 60 L340 60 L400 300 Z" fill="#6b7480" />
      {Array.from({ length: 11 }).map((_, index) => {
        const y = 66 + index * 22;
        const t = (y - 60) / 240;
        return (
          <line
            key={index}
            x1={60 - t * 60}
            y1={y}
            x2={340 + t * 60}
            y2={y}
            stroke="#5b6470"
            strokeWidth="3"
          />
        );
      })}
      {/* ridge */}
      <rect x="52" y="52" width="296" height="12" rx="3" fill="#4d5560" />
      {/* black streaking */}
      <g opacity={g.streak}>
        {[92, 128, 168, 206, 244, 282].map((x, index) => (
          <path
            key={x}
            d={`M${x} 64 Q${x - 6} 180 ${x - 14 - index * 3} 300`}
            stroke="#20242a"
            strokeWidth={12 + (index % 3) * 5}
            fill="none"
            opacity="0.5"
            strokeLinecap="round"
          />
        ))}
      </g>
      {/* moss at the lower edge */}
      <g opacity={g.organic}>
        <path d="M0 300 Q70 268 140 300 Z" fill="#4f6b3d" opacity="0.55" />
        <path d="M250 300 Q320 262 400 300 Z" fill="#4f6b3d" opacity="0.5" />
      </g>
      <Grime id={id} opacity={g.wash} seed={19} />
    </>
  );
}

function Storefront({ id, g }: { id: string; g: GrimeLevels }) {
  return (
    <>
      <Sky id={id} />
      {/* building */}
      <rect x="10" y="40" width="380" height="200" fill="#e4e9ee" />
      <rect x="10" y="40" width="380" height="26" fill="#cfd7de" />
      {/* three storefronts */}
      {[26, 146, 266].map((x, index) => (
        <g key={x}>
          <rect x={x} y="96" width="108" height="144" fill="#2f4a63" />
          <rect x={x + 5} y="101" width="98" height="112" fill="#9dc0dc" />
          <rect x={x + 40} y="176" width="28" height="64" fill="#1d4f7a" />
          {/* awning */}
          <path
            d={`M${x - 6} 96 L${x + 114} 96 L${x + 104} 74 L${x + 4} 74 Z`}
            fill={index === 1 ? "#1667c0" : "#0b2545"}
          />
        </g>
      ))}
      {/* sidewalk */}
      <rect y="240" width="400" height="60" fill="#d6d9db" />
      <line x1="0" y1="264" x2="400" y2="264" stroke="#b7bcc0" strokeWidth="2" />
      {/* grime on the concrete + awning film */}
      <g opacity={g.stain}>
        <rect y="240" width="400" height="60" fill="#5a5a56" opacity="0.35" />
        <ellipse cx="330" cy="278" rx="46" ry="16" fill="#3f3f3c" opacity="0.55" />
      </g>
      <Grime id={id} opacity={g.wash} seed={31} />
    </>
  );
}

const RENDERERS: Record<SceneKind, (props: { id: string; g: GrimeLevels }) => React.JSX.Element> = {
  siding: Siding,
  concrete: Concrete,
  deck: Deck,
  roof: Roof,
  storefront: Storefront,
};

export function Scene({ kind, state = "after", className, label }: SceneProps) {
  const id = `sc-${kind}-${state}`;
  const Renderer = RENDERERS[kind];

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", className)}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Renderer id={id} g={GRIME[state]} />
    </svg>
  );
}

export const SCENE_FOR_SERVICE: Record<string, SceneKind> = {
  "house-washing": "siding",
  "pressure-washing": "siding",
  "power-washing": "siding",
  "painting-staining": "deck",
  "roof-cleaning": "roof",
  "window-cleaning": "storefront",
  "concrete-cleaning": "concrete",
  "gutter-cleaning": "siding",
  "fence-cleaning": "deck",
  "graffiti-removal": "storefront",
  "commercial-pressure-washing": "storefront",
  "christmas-light-installation": "storefront",
};
