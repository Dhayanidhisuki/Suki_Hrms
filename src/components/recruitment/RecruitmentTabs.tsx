/**
 * Generic tab strip for the Recruitment module's tab-based pages (BRD §16.4).
 * Pill-style strip matching EmployeeMastersTabs; active tab is mirrored into
 * ?tab= (and ?sub= for nested sub-tabs) so tabs are deep-linkable and the old
 * flat routes can redirect here.
 *
 * Each tab renders either a scaffold panel (default) or real content via the
 * optional `contentMap` / `subContentMap` props.
 */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { findRecruitmentTab, type RecruitmentTabDef } from './tabDefs';

function PillStrip<T extends { readonly key: string; readonly label: string }>({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly T[];
  active: string;
  onSelect: (key: T['key']) => void;
}) {
  return (
    <div className="card overflow-x-auto p-2">
      <div className="flex min-w-max items-center gap-1" role="tablist">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(t.key)}
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition"
              style={{
                backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#fff' : 'var(--foreground-muted)',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabScaffold({ tab }: { tab: RecruitmentTabDef }) {
  return (
    <div className="card px-6 py-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
          {tab.label}
        </h2>
        <p
          className="mt-1 inline-block rounded-full px-3 py-0.5 text-[11px] font-semibold"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          BRD {tab.brd}
        </p>
        <p className="mt-3 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          {tab.summary}
        </p>
        <p className="mt-4 text-[12px]" style={{ color: 'var(--foreground-muted)' }}>
          This tab is reserved in the restructured module — the screen will be built in the
          corresponding implementation phase.
        </p>
      </div>
    </div>
  );
}

export default function RecruitmentTabs({
  title,
  subtitle,
  basePath,
  tabs,
  initialTab,
  initialSub,
  contentMap,
  subContentMap,
}: {
  title: string;
  subtitle: string;
  basePath: string;
  tabs: readonly RecruitmentTabDef[];
  initialTab: string;
  initialSub?: string;
  /** Optional: pre-rendered content keyed by tab key (replaces scaffold). */
  contentMap?: Record<string, ReactNode>;
  /** Optional: pre-rendered content keyed by sub-tab key (for nested tabs). */
  subContentMap?: Record<string, ReactNode>;
}) {
  const router = useRouter();
  const [activeKey, setActiveKey] = useState(initialTab);
  const [activeSubKey, setActiveSubKey] = useState(initialSub);

  // Sync tab state when the URL changes externally (e.g. "View 360°" button
  // pushes ?tab=candidate-360&candidateId=N). useState only reads initialTab
  // on mount — without this the active tab never updates after navigation.
  useEffect(() => {
    if (initialTab !== activeKey) setActiveKey(initialTab);
    if (initialSub !== activeSubKey) setActiveSubKey(initialSub);
  }, [initialTab, initialSub]);

  const tab = findRecruitmentTab(tabs, activeKey);
  const sub = tab.subs ? findRecruitmentTab(tab.subs, activeSubKey) : undefined;

  const href = (tabKey: string, subKey?: string) =>
    `${basePath}?tab=${tabKey}${subKey ? `&sub=${subKey}` : ''}`;

  const selectTab = (key: string) => {
    setActiveKey(key);
    const next = findRecruitmentTab(tabs, key);
    const nextSub = next.subs?.[0]?.key;
    setActiveSubKey(nextSub);
    router.replace(href(key, nextSub), { scroll: false });
  };

  const selectSub = (key: string) => {
    setActiveSubKey(key);
    router.replace(href(activeKey, key), { scroll: false });
  };

  const activeForContent = sub ?? tab;

  // Resolve content: sub-tab content takes priority, then tab content, then scaffold.
  const resolvedContent =
    (sub && subContentMap?.[sub.key]) ??
    contentMap?.[tab.key] ??
    <TabScaffold tab={activeForContent} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          {subtitle}
        </p>
      </div>

      <PillStrip tabs={tabs} active={tab.key} onSelect={selectTab} />

      {tab.subs && (
        <PillStrip tabs={tab.subs} active={(sub ?? tab.subs[0]).key} onSelect={selectSub} />
      )}

      {resolvedContent}
    </div>
  );
}
