"use client";

import { useId, useState } from "react";

import { Scene, type SceneKind } from "@/components/graphics/scenes";
import type { GalleryItem } from "@/lib/config/content";

/**
 * Before/after comparison. The slider is a range input, so it works with a
 * mouse, a finger and the arrow keys, and it degrades to a plain "after" view
 * with no JavaScript.
 */
function Comparison({ scene, title }: { scene: SceneKind; title: string }) {
  const [position, setPosition] = useState(55);
  const id = useId();

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-t-lg">
        <div className="absolute inset-0">
          <Scene kind={scene} state="after" label={`${title}, after cleaning`} />
        </div>
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${position}%` }}
          aria-hidden="true"
        >
          {/* Fixed-width inner layer so the image does not squash as the wipe moves. */}
          <div className="absolute inset-y-0 left-0" style={{ width: `${(100 / Math.max(position, 1)) * 100}%` }}>
            <Scene kind={scene} state="before" />
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 w-1 bg-white shadow-[0_0_0_1px_rgba(11,37,69,0.35)]"
          style={{ left: `calc(${position}% - 2px)` }}
          aria-hidden="true"
        />
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-ink-950/85 px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">
          Before
        </span>
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-brand-500 px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">
          After
        </span>
      </div>

      <div className="px-4 pt-3">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-body-muted">
          Drag to compare
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="mt-1 w-full accent-brand-500"
          aria-label={`Reveal the before and after of ${title}`}
        />
      </div>
    </div>
  );
}

export function BeforeAfterGallery({ items }: { items: GalleryItem[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {items.map((item) => (
        <figure key={item.title} className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
          <Comparison scene={item.scene} title={item.title} />
          <figcaption className="p-4">
            <h3 className="font-display text-lg font-bold text-ink-900">{item.title}</h3>
            <p className="text-sm font-semibold text-brand-600">{item.location}</p>
            <p className="mt-2 text-sm text-body-muted">{item.detail}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
