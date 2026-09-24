'use client';

/**
 * Visual org chart — the hierarchy drawn as connected cards on a dark canvas,
 * rather than as the indented list the tree view gives.
 *
 * Layout is a plain tidy-tree pass done in one render: measure each subtree's
 * width bottom-up, then place nodes top-down centring every parent over its
 * children. It is deliberately not a graph library — the input is already a
 * tree, so the whole layout is ~40 lines and costs one pass per render, which
 * beats pulling in a dependency that would also have to be themed.
 *
 * The canvas stays dark in both light and dark app themes. That is a choice,
 * not an oversight: it is a focus surface like a diagramming tool, and the
 * connector lines need to sit on a consistent background to stay legible.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Maximize2, Minus, Plus } from 'lucide-react';
import { useToast } from '@/components/ui';

export interface OrgNode {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  department: string | null;
  directReports: OrgNode[];
}

const NODE_W = 268;
const NODE_H = 96;
const H_GAP = 24;
const V_GAP = 64;

/** A laid-out node: the source node plus the box it occupies. */
interface Placed {
  node: OrgNode;
  x: number;
  y: number;
  children: Placed[];
}

/**
 * Department → chip colour. Hashed rather than configured so a new department
 * gets a stable colour without anyone maintaining a map, and the same
 * department is always the same colour across sessions.
 */
const CHIP_COLORS = [
  { bg: 'rgba(56,189,248,0.16)', fg: '#7dd3fc' }, // sky
  { bg: 'rgba(52,211,153,0.16)', fg: '#6ee7b7' }, // emerald
  { bg: 'rgba(251,191,36,0.16)', fg: '#fcd34d' }, // amber
  { bg: 'rgba(167,139,250,0.16)', fg: '#c4b5fd' }, // violet
  { bg: 'rgba(244,114,182,0.16)', fg: '#f9a8d4' }, // pink
  { bg: 'rgba(248,113,113,0.16)', fg: '#fca5a5' }, // red
  { bg: 'rgba(129,140,248,0.16)', fg: '#a5b4fc' }, // indigo
];

function chipColor(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[h % CHIP_COLORS.length];
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export default function OrgChartCanvas({
  roots,
  collapsed,
  onToggle,
  onNodeAction,
}: {
  roots: OrgNode[];
  /** Ids whose children are hidden. Owned by the page so the tree and chart agree. */
  collapsed: Set<number>;
  onToggle: (id: number) => void;
  /** Opens the same edit affordance the other views use. */
  onNodeAction?: (node: OrgNode) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  /** Bottom-up width measurement, then top-down placement. */
  const { placed, width, height, depth, count } = useMemo(() => {
    let maxDepth = 0;
    let nodeCount = 0;

    // Pure: it is called again from place(), so it must not touch the counters
    // (doing so double-counted every node and inflated the depth readout).
    const measure = (node: OrgNode, d: number): number => {
      const kids = collapsed.has(node.id) ? [] : node.directReports;
      if (kids.length === 0) return NODE_W;
      const total = kids.reduce((sum, k) => sum + measure(k, d + 1), 0) + H_GAP * (kids.length - 1);
      return Math.max(NODE_W, total);
    };

    const place = (node: OrgNode, left: number, d: number): Placed => {
      const kids = collapsed.has(node.id) ? [] : node.directReports;
      const subtreeW = measure(node, d);
      if (kids.length === 0) {
        return { node, x: left + (subtreeW - NODE_W) / 2, y: d * (NODE_H + V_GAP), children: [] };
      }
      let cursor = left;
      const children = kids.map((k) => {
        const kw = measure(k, d + 1);
        const p = place(k, cursor, d + 1);
        cursor += kw + H_GAP;
        return p;
      });
      // Centre the parent over the span its children actually occupy.
      const first = children[0];
      const last = children[children.length - 1];
      const x = (first.x + last.x) / 2;
      return { node, x, y: d * (NODE_H + V_GAP), children };
    };

    const countOnly = (node: OrgNode, d: number) => {
      nodeCount++;
      maxDepth = Math.max(maxDepth, d + 1);
      if (!collapsed.has(node.id)) node.directReports.forEach((k) => countOnly(k, d + 1));
    };
    roots.forEach((r) => countOnly(r, 0));

    let cursor = 0;
    const tops = roots.map((r) => {
      const w = measure(r, 0);
      const p = place(r, cursor, 0);
      cursor += w + H_GAP;
      return p;
    });

    return {
      placed: tops,
      width: Math.max(cursor - H_GAP, NODE_W),
      height: maxDepth * NODE_H + (maxDepth - 1) * V_GAP,
      depth: maxDepth,
      count: nodeCount,
    };
  }, [roots, collapsed]);

  const fit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || width === 0) return;
    // A little padding so the outermost cards are not flush to the edge.
    setZoom(Math.min(1, Math.max(0.25, (vp.clientWidth - 48) / width)));
  }, [width]);

  /**
   * Rasterizes the full chart — not just the scrolled-into-view portion — as
   * a PNG. Captures the inner content node directly rather than the
   * scrollable viewport, so it is unaffected by the viewport's overflow
   * clipping or current scroll position.
   *
   * The node is captured at its natural (unzoomed) size: the on-screen CSS
   * `scale(zoom)` transform is cleared on the DOM node just before the
   * capture and restored right after, because html2canvas does not reliably
   * account for a CSS transform on the element it is asked to render —
   * capturing at zoom itself would either crop or mis-scale the output.
   * `scale: 2` (a html2canvas option, unrelated to the chart's own zoom)
   * is what actually controls the exported image's resolution.
   */
  const handleDownload = useCallback(async () => {
    const node = contentRef.current;
    if (!node || count === 0) return;
    setDownloading(true);
    const prevTransform = node.style.transform;
    try {
      node.style.transform = 'none';
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(node, {
        backgroundColor: '#0f0f11',
        scale: 2,
        width,
        height,
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `org-chart-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      toast.success('Org chart downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export chart');
    } finally {
      node.style.transform = prevTransform;
      setDownloading(false);
    }
  }, [count, width, height, toast]);

  /** Flattened for rendering; connectors are drawn from each parent. */
  const all = useMemo(() => {
    const out: Placed[] = [];
    const walk = (p: Placed) => {
      out.push(p);
      p.children.forEach(walk);
    };
    placed.forEach(walk);
    return out;
  }, [placed]);

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-main)' }}>
      {/* Canvas chrome */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
        style={{ backgroundColor: '#18181b', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#4ade80' }} />
          <span style={{ color: '#e4e4e7' }}>Live Hierarchy Canvas</span>
          <span style={{ color: '#3f3f46' }}>|</span>
          <span>{depth} Depth Level{depth === 1 ? '' : 's'}</span>
          <span style={{ color: '#3f3f46' }}>|</span>
          <span>{count} Node{count === 1 ? '' : 's'} Rendered</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">
            Hold <kbd className="rounded px-1 py-0.5" style={{ backgroundColor: '#27272a', color: '#d4d4d8' }}>shift</kbd> + scroll to pan
          </span>
          <div className="flex items-center gap-0.5 rounded-lg" style={{ backgroundColor: '#27272a' }}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-l-lg hover:opacity-70"
              aria-label="Zoom out"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 text-center tabular-nums" style={{ color: '#e4e4e7' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
              className="flex h-7 w-7 cursor-pointer items-center justify-center hover:opacity-70"
              aria-label="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={fit}
              className="flex h-7 cursor-pointer items-center gap-1 rounded-r-lg px-2 hover:opacity-70"
              aria-label="Fit to width"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Fit</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || count === 0}
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: '#27272a', color: '#e4e4e7' }}
            aria-label="Download chart as PNG"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{downloading ? 'Exporting…' : 'Download'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable canvas */}
      <div
        ref={viewportRef}
        className="relative overflow-auto"
        style={{ backgroundColor: '#0f0f11', height: 'min(70vh, 720px)' }}
      >
        {count === 0 ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: '#71717a' }}>
            No hierarchy to display for the current filters.
          </div>
        ) : (
          <div
            style={{
              width: width * zoom + 48,
              height: height * zoom + 48,
              position: 'relative',
            }}
          >
            <div
              ref={contentRef}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                width,
                height,
                position: 'absolute',
                top: 24,
                left: 24,
                backgroundColor: '#0f0f11',
              }}
            >
              {/* Connectors first, so cards paint over the line ends. */}
              <svg
                width={width}
                height={height}
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
              >
                {all.flatMap((p) =>
                  p.children.map((c) => {
                    const startX = p.x + NODE_W / 2;
                    const startY = p.y + NODE_H;
                    const endX = c.x + NODE_W / 2;
                    const endY = c.y;
                    const midY = startY + V_GAP / 2;
                    return (
                      <path
                        key={`${p.node.id}-${c.node.id}`}
                        d={`M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`}
                        fill="none"
                        stroke="#3f3f46"
                        strokeWidth={1.5}
                      />
                    );
                  })
                )}
              </svg>

              {all.map((p) => {
                const { node } = p;
                const kids = node.directReports.length;
                const isCollapsed = collapsed.has(node.id);
                const dept = node.department;
                const color = dept ? chipColor(dept) : null;
                return (
                  <div
                    key={node.id}
                    className="absolute rounded-xl border p-3"
                    style={{
                      left: p.x,
                      top: p.y,
                      width: NODE_W,
                      height: NODE_H,
                      backgroundColor: '#1c1c1f',
                      borderColor: '#2e2e33',
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                        style={{ backgroundColor: '#3f3f46', color: '#e4e4e7' }}
                      >
                        {initials(node.firstName, node.lastName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold" style={{ color: '#fafafa' }}>
                          {node.firstName} {node.lastName}
                        </p>
                        <p className="truncate text-[11px]" style={{ color: '#a1a1aa' }}>
                          {node.designation ?? node.employeeCode}
                        </p>
                      </div>
                      {onNodeAction && (
                        <button
                          type="button"
                          onClick={() => onNodeAction(node)}
                          className="shrink-0 cursor-pointer rounded-full px-1.5 text-[13px] leading-none hover:opacity-70"
                          style={{ color: '#7dd3fc' }}
                          title={`Edit ${node.firstName} ${node.lastName}`}
                          aria-label={`Edit ${node.firstName} ${node.lastName}`}
                        >
                          •••
                        </button>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      {dept && color && (
                        <span
                          className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: color.bg, color: color.fg, maxWidth: 150 }}
                        >
                          {dept}
                        </span>
                      )}
                      {kids > 0 && (
                        <button
                          type="button"
                          onClick={() => onToggle(node.id)}
                          className="ml-auto flex shrink-0 cursor-pointer items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] tabular-nums hover:opacity-70"
                          style={{ backgroundColor: '#27272a', color: '#d4d4d8' }}
                          title={isCollapsed ? `Show ${kids} direct report${kids === 1 ? '' : 's'}` : 'Hide direct reports'}
                        >
                          {kids}
                          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
