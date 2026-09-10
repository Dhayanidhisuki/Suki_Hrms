/**
 * Reporting Structure Master — tree view of the company's reporting hierarchy.
 * Shows all active employees nested under their reporting manager, with
 * inline editing of Level 1 and Level 2 managers.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { KPIGrid, KPICard } from '@/components/ui';

interface EmployeeNode {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  reportingManagerId: number | null;
  secondReportingManagerId: number | null;
  designation: string | null;
  department: string | null;
  directReports: EmployeeNode[];
}

interface EmployeeRef {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface ApiResponse {
  data: EmployeeNode[];
  stats: { totalEmployees: number; rootCount: number };
}

export default function ReportingStructurePage() {
  const [tree, setTree] = useState<EmployeeNode[]>([]);
  const [stats, setStats] = useState({ totalEmployees: 0, rootCount: 0 });
  const [employees, setEmployees] = useState<EmployeeRef[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editManagerId, setEditManagerId] = useState<string>('');
  const [editSecondManagerId, setEditSecondManagerId] = useState<string>('');
  const [showReassign, setShowReassign] = useState(false);
  const [reassignOld, setReassignOld] = useState<string>('');
  const [reassignNew, setReassignNew] = useState<string>('');
  const [reassignMsg, setReassignMsg] = useState<string>('');

  const fetchTree = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/masters/reporting-structure');
    const json: ApiResponse = await res.json();
    setTree(json.data);
    setStats(json.stats);
    setLoading(false);
  }, []);

  const fetchEmployees = useCallback(async () => {
    const res = await fetch('/api/org-options');
    const json = await res.json();
    setEmployees(json.reportingManagers ?? []);
  }, []);

  useEffect(() => {
    fetchTree();
    fetchEmployees();
  }, [fetchTree, fetchEmployees]);

  const handleEdit = (node: EmployeeNode) => {
    setEditingId(node.id);
    setEditManagerId(node.reportingManagerId ? String(node.reportingManagerId) : '');
    setEditSecondManagerId(node.secondReportingManagerId ? String(node.secondReportingManagerId) : '');
  };

  const handleSave = async (employeeId: number) => {
    const updates = {
      updates: [{
        employeeId,
        reportingManagerId: editManagerId ? Number(editManagerId) : null,
        secondReportingManagerId: editSecondManagerId ? Number(editSecondManagerId) : null,
      }],
    };
    const res = await fetch('/api/masters/reporting-structure', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setEditingId(null);
      fetchTree();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to update');
    }
  };

  const handleReassign = async () => {
    if (!reassignOld) {
      alert('Please select the departing manager');
      return;
    }
    const res = await fetch('/api/masters/reporting-structure/reassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldManagerId: Number(reassignOld),
        newManagerId: reassignNew ? Number(reassignNew) : null,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setReassignMsg(json.message);
      setReassignOld('');
      setReassignNew('');
      fetchTree();
    } else {
      alert(json.error || 'Failed to reassign');
    }
  };

  const matchesSearch = (node: EmployeeNode): boolean => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      node.firstName.toLowerCase().includes(q) ||
      node.lastName.toLowerCase().includes(q) ||
      node.employeeCode.toLowerCase().includes(q) ||
      (node.designation?.toLowerCase().includes(q) ?? false) ||
      (node.department?.toLowerCase().includes(q) ?? false) ||
      node.directReports.some(matchesSearch)
    );
  };

  const renderNode = (node: EmployeeNode, depth: number): React.ReactNode => {
    if (!matchesSearch(node)) return null;
    const fullName = `${node.firstName} ${node.lastName}`;
    return (
      <div key={node.id} style={{ marginLeft: depth * 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderBottom: '1px solid #eee',
          }}
        >
          <span style={{ fontWeight: depth === 0 ? 600 : 400 }}>{fullName}</span>
          <span style={{ color: '#888', fontSize: 12 }}>({node.employeeCode})</span>
          {node.designation && <span style={{ color: '#555', fontSize: 12 }}>— {node.designation}</span>}
          {node.department && <span style={{ color: '#999', fontSize: 12 }}>· {node.department}</span>}
          {node.directReports.length > 0 && (
            <span style={{ color: '#0066cc', fontSize: 11 }}>
              [{node.directReports.length} report{node.directReports.length > 1 ? 's' : ''}]
            </span>
          )}
          {editingId === node.id ? (
            <>
              <select value={editManagerId} onChange={(e) => setEditManagerId(e.target.value)} style={{ marginLeft: 8 }}>
                <option value="">— No Manager —</option>
                {employees.filter((e) => e.id !== node.id).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeCode})
                  </option>
                ))}
              </select>
              <select value={editSecondManagerId} onChange={(e) => setEditSecondManagerId(e.target.value)}>
                <option value="">— No 2nd Manager —</option>
                {employees.filter((e) => e.id !== node.id).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeCode})
                  </option>
                ))}
              </select>
              <button onClick={() => handleSave(node.id)} style={{ padding: '2px 8px' }}>Save</button>
              <button onClick={() => setEditingId(null)} style={{ padding: '2px 8px' }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => handleEdit(node)} style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 11 }}>
              Edit
            </button>
          )}
        </div>
        {node.directReports.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  if (loading) return <div style={{ padding: 24 }}>Loading reporting structure…</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Reporting Structure</h1>

      <KPIGrid>
        <KPICard label="Total Employees" value={stats.totalEmployees} tone="info" />
        <KPICard label="Root Managers" value={stats.rootCount} tone="success" />
      </KPIGrid>

      <div style={{ margin: '16px 0' }}>
        <input
          type="text"
          placeholder="Search by name, code, designation, or department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4 }}
        />
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 4, maxHeight: '70vh', overflowY: 'auto' }}>
        {tree.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>
            No active employees found.
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}
