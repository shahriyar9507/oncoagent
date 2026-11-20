"use client";

import { useEffect, useState } from "react";

/** Sticky in-page navigation for long patient records; highlights the section in view. */
export function SubNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-130px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);
  return (
    <nav className="subnav" aria-label="Sections of this record">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className={active === i.id ? "on" : undefined} aria-current={active === i.id ? "location" : undefined} onClick={() => setActive(i.id)}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}
