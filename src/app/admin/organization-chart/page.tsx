/**
 * Organization Chart — visual box-and-line org chart with headcount and
 * salary cost per node. Drill down by clicking a node to expand/collapse.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { KPIGrid, KPICard } from '@/components/ui';

interface OrgNode {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  department: string | null;
  grossSalary: number | null;
  headcount: number;
  totalSalaryCost: number;
  children: OrgNode[];
}

function formatCurrency(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function OrgBox({ node, depth, expanded, onToggle }: {
  node: OrgNode;
  depth: number;
  expanded: Set<number>;
  onToggle: (id: number) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const fullName = `${node.firstName} ${node.lastName}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        onClick={() => hasChildren && onToggle(node.id)}
        style={{
          border: '1px solid #ccc',
          borderRadius: 6,
          padding: '10px 14px',
          minWidth: 180,
          maxWidth: 240,
          textAlign: 'center',
          cursor: hasChildren ? 'pointer' : 'default',
          background: depth === 0 ? '#e6f3ff' : '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13 }}>{fullName}</div>
        <div style={{ fontSize: 11, color: '#666' }}>{node.designation ?? '—'}</div>
        {node.department && (
          <div style={{ fontSize: 10, color: '#999' }}>{node.department}</div>
        )}
        <div style={{ fontSize: 10, color: '#0066cc', marginTop: 4 }}>
          {node.headcount > 0 ? `${node.headcount} reports` : 'No direct reports'}
        </div>
        {node.totalSalaryCost > 0 && (
          <div style={{ fontSize: 10, color: '#888' }}>
            Cost: {formatCurrency(node.totalSalaryCost)}
          </div>
        )}
        {hasChildren && (
          <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
            {isExpanded ? '▼ collapse' : '▶ expand'}
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {node.children.map((child) => (
            <OrgBox
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrganizationChartPage() {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [totalHeadcount, setTotalHeadcount] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/organization-chart');
    const json = await res.json();
    setTree(json.data ?? []);

    // Compute totals
    let headcount = 0;
    let cost = 0;
    function countAll(nodes: OrgNode[]) {
      for (const n of nodes) {
        headcount++;
        cost += n.grossSalary ?? 0;
        countAll(n.children);
      }
    }
    countAll(json.data ?? []);
    setTotalHeadcount(headcount);
    setTotalCost(cost);
    setLoading(false);

    // Auto-expand root nodes
    setExpanded(new Set((json.data ?? []).map((n: OrgNode) => n.id)));
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const handleToggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<number>();
    function collect(nodes: OrgNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0) all.add(n.id);
        collect(n.children);
      }
    }
    collect(tree);
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set());

  if (loading) return <div style={{ padding: 24 }}>Loading organization chart…</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Organization Chart</h1>

      <KPIGrid>
        <KPICard label="Total Headcount" value={totalHeadcount} tone="info" />
        <KPICard label="Total Monthly Salary Cost" value={formatCurrency(totalCost)} tone="success" />
      </KPIGrid>

      <div style={{ margin: '16px 0', display: 'flex', gap: 8 }}>
        <button onClick={expandAll} style={{ padding: '6px 12px' }}>Expand All</button>
        <button onClick={collapseAll} style={{ padding: '6px 12px' }}>Collapse All</button>
      </div>

      <div style={{ overflowX: 'auto', padding: 16 }}>
        {tree.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
            No active employees found.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            {tree.map((node) => (
              <OrgBox
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
