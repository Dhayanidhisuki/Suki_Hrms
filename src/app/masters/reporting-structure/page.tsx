/**
 * Reporting Structure Master — visual tree & directory view of company hierarchy.
 * Features:
 * - Multi-select checkboxes for batch manager assignment
 * - Floating Bulk Assign action bar (L1 and L2 managers)
 * - Tree view with expandable/collapsible nodes & tree connectors
 * - Directory table view with search & department/status filters
 * - Single-employee quick inline editor
 * - Bulk reassign reports workflow for departing managers
 * - Rich manager options showing Name, Code, Designation & Department
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { KPIGrid, KPICard, useToast, useConfirm } from '@/components/ui';
import { ArrowLeftRight, Briefcase, CircleCheck, Clock, Download, RefreshCw, Users } from 'lucide-react';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';
import OrgChartCanvas from '@/components/masters/OrgChartCanvas';

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

interface FlatEmployee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  reportingManagerId: number | null;
  secondReportingManagerId: number | null;
  reportingManager: { id: number; firstName: string; lastName: string; employeeCode: string } | null;
  secondReportingManager: { id: number; firstName: string; lastName: string; employeeCode: string } | null;
  designation: string | null;
  department: string | null;
  directReportsCount: number;
  isManager: boolean;
}

interface ManagerOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  designation: string | null;
  department: string | null;
  isManager: boolean;
  directReportsCount: number;
}

interface ApiResponse {
  data: EmployeeNode[];
  flat?: FlatEmployee[];
  managers?: ManagerOption[];
  stats: {
    totalEmployees: number;
    rootCount: number;
    assignedCount?: number;
    unassignedCount?: number;
    managersCount?: number;
  };
}

export default function ReportingStructurePage() {
  const { confirm } = useConfirm();
  const toast = useToast();
  const [tree, setTree] = useState<EmployeeNode[]>([]);
  const [flatList, setFlatList] = useState<FlatEmployee[]>([]);
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    rootCount: 0,
    assignedCount: 0,
    unassignedCount: 0,
    managersCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MANAGERS' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [viewMode, setViewMode] = useState<'chart' | 'tree' | 'table'>('chart');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // Multi-select state for bulk assignment
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkManagerId, setBulkManagerId] = useState<string>('');
  const [bulkSecondManagerId, setBulkSecondManagerId] = useState<string>('');
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // Single edit modal/state
  const [editingEmployee, setEditingEmployee] = useState<FlatEmployee | null>(null);
  const [editManagerId, setEditManagerId] = useState<string>('');
  const [editSecondManagerId, setEditSecondManagerId] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Bulk Reassign Drawer
  const [showReassign, setShowReassign] = useState(false);
  const [reassignOld, setReassignOld] = useState<string>('');
  const [reassignNew, setReassignNew] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);

  const fetchHierarchy = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/masters/reporting-structure');
      if (!res.ok) throw new Error('Failed to load reporting structure');
      const json: ApiResponse = await res.json();

      setTree(json.data || []);
      setStats({
        totalEmployees: json.stats.totalEmployees || 0,
        rootCount: json.stats.rootCount || 0,
        assignedCount: json.stats.assignedCount ?? ((json.stats.totalEmployees || 0) - (json.stats.rootCount || 0)),
        unassignedCount: json.stats.unassignedCount ?? (json.stats.rootCount || 0),
        managersCount: json.stats.managersCount || 0,
      });

      if (json.flat) {
        setFlatList(json.flat);
      }
      if (json.managers) {
        setManagerOptions(json.managers);
      }

      // Default expand all root nodes with direct reports
      const autoExpand = new Set<number>();
      const addExp = (nodes: EmployeeNode[]) => {
        nodes.forEach((n) => {
          if (n.directReports.length > 0) {
            autoExpand.add(n.id);
            addExp(n.directReports);
          }
        });
      };
      addExp(json.data || []);
      setExpandedNodes(autoExpand);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch hierarchy';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    flatList.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [flatList]);

  // Expand / Collapse toggles
  const toggleNode = (id: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<number>();
    flatList.filter((e) => e.directReportsCount > 0).forEach((e) => all.add(e.id));
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Checkbox Selection
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const visibleIds = filteredFlatList.map((e) => e.id);
      setSelectedIds(new Set(visibleIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Filtered Flat List for Table & Tree checks
  const filteredFlatList = useMemo(() => {
    return flatList.filter((emp) => {
      if (deptFilter && emp.department !== deptFilter) return false;

      if (statusFilter === 'MANAGERS' && !emp.isManager) return false;
      if (statusFilter === 'ASSIGNED' && emp.reportingManagerId === null) return false;
      if (statusFilter === 'UNASSIGNED' && emp.reportingManagerId !== null) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchCode = emp.employeeCode.toLowerCase().includes(q);
        const matchDesig = emp.designation?.toLowerCase().includes(q) ?? false;
        const matchDept = emp.department?.toLowerCase().includes(q) ?? false;
        const matchMgr = emp.reportingManager
          ? `${emp.reportingManager.firstName} ${emp.reportingManager.lastName}`.toLowerCase().includes(q)
          : false;
        if (!matchName && !matchCode && !matchDesig && !matchDept && !matchMgr) return false;
      }

      return true;
    });
  }, [flatList, deptFilter, statusFilter, search]);

  /**
   * Exports exactly what the user is looking at — the filtered list, not the
   * whole company — so an export taken after narrowing to one department
   * contains that department. Quotes are doubled and every field is wrapped,
   * because names and designations legitimately contain commas.
   */
  const handleExportCsv = useCallback(() => {
    if (filteredFlatList.length === 0) {
      toast.warning('Nothing to export for the current filters');
      return;
    }
    const headers = [
      'Employee Code', 'Employee Name', 'Designation', 'Department',
      'Reporting Manager', 'Second Reporting Manager', 'Direct Reports', 'Is Manager',
    ];
    const cell = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filteredFlatList.map((e) => [
      cell(e.employeeCode),
      cell(e.fullName),
      cell(e.designation),
      cell(e.department),
      cell(e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}` : ''),
      cell(e.secondReportingManager ? `${e.secondReportingManager.firstName} ${e.secondReportingManager.lastName}` : ''),
      cell(e.directReportsCount),
      cell(e.isManager ? 'Yes' : 'No'),
    ].join(','));

    // BOM so Excel opens non-ASCII names correctly instead of mojibake.
    const blob = new Blob(['\ufeff' + [headers.map(cell).join(','), ...rows].join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporting-structure-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredFlatList.length} row${filteredFlatList.length === 1 ? '' : 's'}`);
  }, [filteredFlatList, toast]);

  // The chart thinks in "collapsed", the tree in "expanded". Deriving one from
  // the other keeps a single source of truth, so collapsing a branch in one
  // view is already collapsed when you switch to the other.
  const collapsedIds = useMemo(() => {
    const out = new Set<number>();
    for (const e of flatList) {
      if (e.directReportsCount > 0 && !expandedNodes.has(e.id)) out.add(e.id);
    }
    return out;
  }, [flatList, expandedNodes]);

  const visibleIdSet = useMemo(() => new Set(filteredFlatList.map((e) => e.id)), [filteredFlatList]);

  const isTreeMatch = useCallback((node: EmployeeNode): boolean => {
    if (visibleIdSet.has(node.id)) return true;
    return node.directReports.some(isTreeMatch);
  }, [visibleIdSet]);

  // Bulk Assignment Handler
  const handleBulkAssign = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkManagerId) {
      toast.warning('Please select a Reporting Manager to assign');
      return;
    }

    const mgrIdNum = Number(bulkManagerId);
    if (selectedIds.has(mgrIdNum)) {
      toast.warning('One of the selected employees cannot be their own manager. Please uncheck them first.');
      return;
    }

    setSubmittingBulk(true);
    try {
      const res = await fetch('/api/masters/reporting-structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: Array.from(selectedIds),
          reportingManagerId: mgrIdNum,
          secondReportingManagerId: bulkSecondManagerId ? Number(bulkSecondManagerId) : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update manager assignments');

      toast.success(json.message || `Assigned manager to ${selectedIds.size} employees`);
      setSelectedIds(new Set());
      setBulkManagerId('');
      setBulkSecondManagerId('');
      await fetchHierarchy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error assigning managers';
      toast.error(msg);
    } finally {
      setSubmittingBulk(false);
    }
  };

  // Bulk Unassign / Remove Manager
  const handleBulkUnassign = async () => {
    if (selectedIds.size === 0) return;
    if (
      !(await confirm({
        title: 'Remove manager assignment?',
        message: `${selectedIds.size} selected employee(s) will become Root employees.`,
        confirmLabel: 'Remove assignment',
        tone: 'danger',
      }))
    ) {
      return;
    }

    setSubmittingBulk(true);
    try {
      const res = await fetch('/api/masters/reporting-structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: Array.from(selectedIds),
          reportingManagerId: null,
          secondReportingManagerId: null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to unassign managers');

      toast.success(`Unassigned managers for ${selectedIds.size} employee(s)`);
      setSelectedIds(new Set());
      await fetchHierarchy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error unassigning managers';
      toast.error(msg);
    } finally {
      setSubmittingBulk(false);
    }
  };

  // Single Edit
  const openEditModal = (empId: number) => {
    const found = flatList.find((e) => e.id === empId);
    if (!found) return;
    setEditingEmployee(found);
    setEditManagerId(found.reportingManagerId ? String(found.reportingManagerId) : '');
    setEditSecondManagerId(found.secondReportingManagerId ? String(found.secondReportingManagerId) : '');
  };

  const handleSaveSingleEdit = async () => {
    if (!editingEmployee) return;
    setSavingEdit(true);
    try {
      const res = await fetch('/api/masters/reporting-structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{
            employeeId: editingEmployee.id,
            reportingManagerId: editManagerId ? Number(editManagerId) : null,
            secondReportingManagerId: editSecondManagerId ? Number(editSecondManagerId) : null,
          }],
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update employee');

      toast.success(`Updated reporting manager for ${editingEmployee.fullName}`);
      setEditingEmployee(null);
      await fetchHierarchy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update';
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // Bulk Reassign for Departing Managers
  const handleReassignDeparting = async () => {
    if (!reassignOld) {
      toast.warning('Please select the departing manager');
      return;
    }
    setReassigning(true);
    try {
      const res = await fetch('/api/masters/reporting-structure/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldManagerId: Number(reassignOld),
          newManagerId: reassignNew ? Number(reassignNew) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reassign reports');

      toast.success(json.message || 'Direct reports reassigned successfully');
      setReassignOld('');
      setReassignNew('');
      setShowReassign(false);
      await fetchHierarchy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reassign';
      toast.error(msg);
    } finally {
      setReassigning(false);
    }
  };

  // Helper for rendering initials avatar
  const renderAvatar = (name: string, isMgr: boolean) => {
    const parts = name.trim().split(' ');
    const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
    return (
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
          isMgr ? 'bg-indigo-600 text-white shadow-sm' : 'bg-[var(--border-main)] text-[var(--text-primary)]'
        }`}
      >
        {initials.toUpperCase()}
      </div>
    );
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: EmployeeNode, depth: number = 0): React.ReactNode => {
    if (!isTreeMatch(node)) return null;

    const hasReports = node.directReports.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedIds.has(node.id);
    const fullName = `${node.firstName} ${node.lastName}`.trim();

    return (
      <div key={node.id} className="relative">
        {/* Node Card */}
        <div
          className={`flex items-center gap-3 py-2.5 px-3 rounded-lg border transition-all mb-1.5 ${
            isSelected
              ? 'bg-blue-50/90 border-blue-400 shadow-sm'
              : 'bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)]/90 border-[var(--border-main)]'
          }`}
          style={{ marginLeft: `${depth * 28}px` }}
        >
          {/* Depth connector indent line indicator */}
          {depth > 0 && (
            <div className="absolute -left-3.5 top-1/2 w-3.5 h-px bg-[var(--border-main)]" />
          )}

          {/* Expand/Collapse Toggle Button */}
          {hasReports ? (
            <button
              onClick={() => toggleNode(node.id)}
              className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] font-mono text-sm shrink-0 transition"
              title={isExpanded ? 'Collapse team' : 'Expand team'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <div className="w-5 h-5 flex items-center justify-center text-slate-300 text-xs shrink-0">
              •
            </div>
          )}

          {/* Selection Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(node.id)}
            className="w-4 h-4 rounded border-[var(--border-main)] text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
          />

          {/* Avatar */}
          {renderAvatar(fullName, hasReports)}

          {/* Employee Info */}
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <span className="font-medium text-[var(--text-primary)] text-sm truncate">
              {fullName}
            </span>
            <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded">
              {node.employeeCode}
            </span>

            {node.designation && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-primary)] font-medium">
                {node.designation}
              </span>
            )}

            {node.department && (
              <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
                · {node.department}
              </span>
            )}

            {hasReports && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium shrink-0">
                {node.directReports.length} direct report{node.directReports.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Quick Edit Action */}
          <button
            onClick={() => openEditModal(node.id)}
            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1 rounded border border-transparent hover:border-blue-200 transition shrink-0"
          >
            Edit Manager
          </button>
        </div>

        {/* Child nodes */}
        {hasReports && isExpanded && (
          <div className="border-l border-[var(--border-main)] ml-4 pl-1">
            {node.directReports.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const allVisibleSelected = filteredFlatList.length > 0 && filteredFlatList.every((e) => selectedIds.has(e.id));
  const someVisibleSelected = filteredFlatList.some((e) => selectedIds.has(e.id)) && !allVisibleSelected;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <MasterGroupTabs groupLabel="Organization" />
      {/* Header & Page Title */}
      <div
        className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between"
        style={{ borderColor: 'var(--border-main)' }}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Reporting Structure
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Manage organizational hierarchy, team leads, and reporting managers across all departments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowReassign(!showReassign)}
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium shadow-sm transition hover:opacity-80"
            style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>{showReassign ? 'Close Reassign' : 'Bulk Reassign Reports'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium shadow-sm transition hover:opacity-80"
            style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>

          <button
            onClick={fetchHierarchy}
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <KPIGrid columns={4}>
        <KPICard
          label="Total Employees"
          value={stats.totalEmployees}
          tone="info"
          icon={<Users />}
          subtitle="Active in company"
        />
        <KPICard
          label="Reports Assigned"
          value={stats.assignedCount}
          tone="success"
          icon={<CircleCheck />}
          badge={
            stats.totalEmployees > 0
              ? `${((stats.assignedCount / stats.totalEmployees) * 100).toFixed(1)}%`
              : undefined
          }
          subtitle="Has L1 reporting manager"
        />
        <KPICard
          label="Root / Unassigned"
          value={stats.unassignedCount}
          tone="warning"
          icon={<Clock />}
          // Drawn in its tone and given an action only when there is actually
          // something to fix — a zero here is good news, not a warning.
          highlight={stats.unassignedCount > 0}
          subtitle="No reporting manager"
          action={
            stats.unassignedCount > 0
              ? {
                  label: `Resolve (${stats.unassignedCount})`,
                  onClick: () => {
                    setStatusFilter('UNASSIGNED');
                    setViewMode('table');
                  },
                }
              : undefined
          }
        />
        <KPICard
          label="Active Managers"
          value={stats.managersCount}
          tone="accent"
          icon={<Briefcase />}
          subtitle="Employees leading teams"
        />
      </KPIGrid>

      {/* Collapsible Bulk Reassign Reports Drawer */}
      {showReassign && (
        <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-[var(--border-main)] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <span>⇄</span> Reassign Reports for Departing / Transitioning Manager
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Automatically transfers all direct reports from one manager to another in a single atomic action.
              </p>
            </div>
            <button
              onClick={() => setShowReassign(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-muted)] text-sm"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                Departing / Previous Manager
              </label>
              <select
                value={reassignOld}
                onChange={(e) => setReassignOld(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">— Select Departing Manager —</option>
                {managerOptions
                  .filter((m) => m.directReportsCount > 0)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.employeeCode}) — {m.directReportsCount} reports ({m.designation || 'Staff'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                New Reporting Manager
              </label>
              <select
                value={reassignNew}
                onChange={(e) => setReassignNew(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">— Unassign (Make Root Employees) —</option>
                {managerOptions
                  .filter((m) => String(m.id) !== reassignOld)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.employeeCode}) — {m.designation || 'Staff'} · {m.department || ''}
                    </option>
                  ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                onClick={handleReassignDeparting}
                disabled={!reassignOld || reassigning}
                className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium text-sm px-4 py-2 rounded-lg transition shadow-sm"
              >
                {reassigning ? 'Reassigning…' : 'Reassign All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating / Sticky Bulk Assign Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-40 bg-slate-900 text-white rounded-xl p-4 shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {selectedIds.size} Selected
              </span>
              <span className="text-sm font-medium text-slate-200">
                Bulk Assign Manager to selected employees:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Manager 1 Select */}
              <div className="min-w-[240px] flex-1 lg:flex-initial">
                <select
                  value={bulkManagerId}
                  onChange={(e) => setBulkManagerId(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">— Select Reporting Manager (L1) —</option>
                  {managerOptions
                    .filter((m) => !selectedIds.has(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.employeeCode}) — {m.designation || 'Staff'} · {m.department || ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Manager 2 Select */}
              <div className="min-w-[200px] flex-1 lg:flex-initial">
                <select
                  value={bulkSecondManagerId}
                  onChange={(e) => setBulkSecondManagerId(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">— Optional: 2nd Manager (L2) —</option>
                  {managerOptions
                    .filter((m) => !selectedIds.has(m.id) && String(m.id) !== bulkManagerId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.employeeCode}) — {m.designation || 'Staff'}
                      </option>
                    ))}
                </select>
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleBulkAssign}
                disabled={submittingBulk || !bulkManagerId}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5"
              >
                {submittingBulk ? 'Assigning…' : '✓ Assign Manager'}
              </button>

              <button
                onClick={handleBulkUnassign}
                disabled={submittingBulk}
                className="bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition"
              >
                Unassign
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[var(--text-muted)] hover:text-white text-xs px-2 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Card */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] shadow-sm overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-[var(--border-main)] bg-[var(--bg-subtle)]/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Left: Search & Filter */}
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <input
                type="text"
                placeholder="Search employee, designation, code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="absolute left-3 top-2 text-[var(--text-muted)] text-xs">🔍</span>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2 text-[var(--text-muted)] hover:text-[var(--text-muted)] text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="">All Departments ({departments.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="ALL">All Hierarchy Status</option>
              <option value="MANAGERS">Managers Only (Lead Teams)</option>
              <option value="ASSIGNED">Has Manager Assigned</option>
              <option value="UNASSIGNED">Root / No Manager</option>
            </select>
          </div>

          {/* Right: View Toggle & Tree Tools */}
          <div className="flex items-center gap-2 justify-between md:justify-end">
            {(viewMode === 'tree' || viewMode === 'chart') && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mr-2">
                <button
                  onClick={expandAll}
                  className="px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-main)] rounded hover:bg-[var(--bg-subtle)] transition"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-main)] rounded hover:bg-[var(--bg-subtle)] transition"
                >
                  Collapse All
                </button>
              </div>
            )}

            {/* Select All Checkbox Button */}
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-card)] px-2.5 py-1.5 rounded border border-[var(--border-main)] cursor-pointer hover:bg-[var(--bg-subtle)]">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someVisibleSelected;
                }}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[var(--border-main)] text-blue-600"
              />
              <span>Select All ({filteredFlatList.length})</span>
            </label>

            {/* View Mode Switch */}
            <div className="inline-flex rounded-lg border border-[var(--border-main)] p-0.5 bg-[var(--bg-card)] shadow-xs">
              {([
                { id: 'chart', label: 'Visual Org Chart' },
                { id: 'tree', label: 'List / Tree' },
                { id: 'table', label: 'Directory Table' },
              ] as const).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setViewMode(v.id)}
                  className="rounded-md px-3 py-1 text-xs font-medium transition"
                  style={
                    viewMode === v.id
                      ? { backgroundColor: 'var(--primary)', color: '#fff' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Display */}
        <div className="p-4 min-h-[400px]">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[var(--text-muted)]">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Loading company hierarchy…</p>
            </div>
          ) : filteredFlatList.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-muted)]">
              <p className="text-base font-medium">No matching employees found</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Try clearing search query or adjusting department/status filters.
              </p>
            </div>
          ) : viewMode === 'chart' ? (
            /* VISUAL ORG CHART */
            <OrgChartCanvas
              roots={tree}
              collapsed={collapsedIds}
              onToggle={toggleNode}
              onNodeAction={(n) => openEditModal(n.id)}
            />
          ) : viewMode === 'tree' ? (
            /* TREE VIEW */
            <div className="space-y-1">
              {tree.map((rootNode) => renderTreeNode(rootNode, 0))}
            </div>
          ) : (
            /* DIRECTORY TABLE VIEW */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[var(--text-primary)]">
                <thead className="bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--text-muted)] uppercase border-b border-[var(--border-main)]">
                  <tr>
                    <th className="py-3 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someVisibleSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 rounded border-[var(--border-main)] text-blue-600"
                      />
                    </th>
                    <th className="py-3 px-3">Employee</th>
                    <th className="py-3 px-3">Designation & Dept</th>
                    <th className="py-3 px-3">Reporting Manager (L1)</th>
                    <th className="py-3 px-3">2nd Manager (L2)</th>
                    <th className="py-3 px-3 text-center">Direct Reports</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredFlatList.map((emp) => {
                    const isSelected = selectedIds.has(emp.id);
                    return (
                      <tr
                        key={emp.id}
                        className={`hover:bg-[var(--bg-subtle)] transition ${
                          isSelected ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(emp.id)}
                            className="w-4 h-4 rounded border-[var(--border-main)] text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            {renderAvatar(emp.fullName, emp.isManager)}
                            <div>
                              <div className="font-medium text-[var(--text-primary)]">{emp.fullName}</div>
                              <div className="text-xs font-mono text-[var(--text-muted)]">{emp.employeeCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            {emp.designation ? (
                              <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-primary)]">
                                {emp.designation}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">Not assigned</span>
                            )}
                            {emp.department && (
                              <div className="text-xs text-[var(--text-muted)]">{emp.department}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {emp.reportingManager ? (
                            <div className="text-xs">
                              <span className="font-medium text-[var(--text-primary)]">
                                {emp.reportingManager.firstName} {emp.reportingManager.lastName}
                              </span>
                              <span className="text-[var(--text-muted)] font-mono ml-1">
                                ({emp.reportingManager.employeeCode})
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              Root Manager (None)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {emp.secondReportingManager ? (
                            <div className="text-xs">
                              <span className="font-medium text-[var(--text-primary)]">
                                {emp.secondReportingManager.firstName} {emp.secondReportingManager.lastName}
                              </span>
                              <span className="text-[var(--text-muted)] font-mono ml-1">
                                ({emp.secondReportingManager.employeeCode})
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {emp.directReportsCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {emp.directReportsCount} reports
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => openEditModal(emp.id)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2.5 py-1 rounded hover:bg-blue-50 transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Single Employee Edit Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-card)] rounded-xl max-w-lg w-full shadow-2xl border border-[var(--border-main)] p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[var(--border-main)] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Update Reporting Manager
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Set Level 1 and Level 2 managers for {editingEmployee.fullName} ({editingEmployee.employeeCode})
                </p>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-muted)] text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Employee Summary Card */}
              <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] flex items-center gap-3">
                {renderAvatar(editingEmployee.fullName, editingEmployee.isManager)}
                <div>
                  <div className="font-semibold text-sm text-[var(--text-primary)]">{editingEmployee.fullName}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {editingEmployee.designation || 'Staff'} · {editingEmployee.department || 'General'}
                  </div>
                </div>
              </div>

              {/* Level 1 Manager */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Reporting Manager (Level 1)
                </label>
                <select
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">— No Manager (Top Level / Root) —</option>
                  {managerOptions
                    .filter((m) => m.id !== editingEmployee.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.employeeCode}) — {m.designation || 'Staff'} · {m.department || ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Level 2 Manager */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Second Reporting Manager (Level 2 / Skip-Level)
                </label>
                <select
                  value={editSecondManagerId}
                  onChange={(e) => setEditSecondManagerId(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">— No 2nd Manager —</option>
                  {managerOptions
                    .filter((m) => m.id !== editingEmployee.id && String(m.id) !== editManagerId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.employeeCode}) — {m.designation || 'Staff'} · {m.department || ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-main)]">
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium rounded-lg hover:bg-[var(--bg-subtle)] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSingleEdit}
                disabled={savingEdit}
                className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg shadow-sm transition"
              >
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

