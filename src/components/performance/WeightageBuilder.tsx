/**
 * Two-level KRA → KPI builder, shared by the goal-template builder and
 * employee goal assignment.
 *
 * It exists once because BRD §17 Model A must behave identically in both: a
 * template being a valid 100/100 set does not exempt an individually
 * customised goal set, so the same live totals and the same
 * validateWeightages() call back both screens. The API re-runs the same
 * function — this is convenience, not the enforcement point.
 *
 * `mode` controls the extra per-KPI fields BRD §17 asks for at assignment
 * time (dates, frequency, evidence, comments), which a template does not
 * carry.
 */

'use client';

import { useMemo } from 'react';
import { Alert, Button, StatusBadge } from '@/components/ui';
import { validateWeightages } from '@/lib/performance/weightage';
import { MEASUREMENT_FREQUENCIES, MEASUREMENT_TYPE_OPTIONS, type MeasurementType } from '@/lib/performance/measurement';

export interface MasterKra { id: number; code: string; name: string; defaultWeightage: string | null }
export interface MasterKpi {
  id: number;
  kraId: number;
  code: string;
  name: string;
  description: string;
  unit: string;
  measurementType: MeasurementType;
  target: string;
  weightage: string;
  frequency: string;
}

export interface BuilderKpi {
  kpiId: number;
  target: number | string;
  weightage: number | string;
  // Goal mode only (BRD §17).
  description?: string;
  measurementType?: MeasurementType;
  unit?: string;
  startDate?: string;
  endDate?: string;
  frequency?: string;
  evidenceRequired?: boolean;
  employeeComments?: string;
  managerComments?: string;
}

export interface BuilderKra {
  kraId: number;
  weightage: number | string;
  kpis: BuilderKpi[];
}

interface Props {
  mode: 'template' | 'goal';
  masterKras: MasterKra[];
  masterKpis: MasterKpi[];
  value: BuilderKra[];
  onChange: (next: BuilderKra[]) => void;
  /** Goal mode: the cycle window KPI dates are bounded to (BRD §41). */
  cycleWindow?: { startDate: string; endDate: string };
  readOnly?: boolean;
}

const inputCls = 'rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 w-full';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

const num = (v: number | string) => (v === '' || v == null ? 0 : Number(v));

export default function WeightageBuilder({
  mode, masterKras, masterKpis, value, onChange, cycleWindow, readOnly = false,
}: Props) {
  const kraById = useMemo(() => new Map(masterKras.map((k) => [k.id, k])), [masterKras]);
  const kpiById = useMemo(() => new Map(masterKpis.map((k) => [k.id, k])), [masterKpis]);

  // Same function the API calls, so the totals shown here are the totals that
  // will be enforced on save.
  const validation = useMemo(
    () =>
      validateWeightages(
        value.map((k) => ({
          label: kraById.get(k.kraId)?.code ?? String(k.kraId),
          weightage: num(k.weightage),
          kpis: k.kpis.map((p) => ({ label: kpiById.get(p.kpiId)?.code ?? String(p.kpiId), weightage: num(p.weightage) })),
        }))
      ),
    [value, kraById, kpiById]
  );

  const usedKraIds = new Set(value.map((k) => k.kraId));
  const availableKras = masterKras.filter((k) => !usedKraIds.has(k.id));

  const patchKra = (index: number, patch: Partial<BuilderKra>) =>
    onChange(value.map((k, i) => (i === index ? { ...k, ...patch } : k)));

  const patchKpi = (kraIndex: number, kpiIndex: number, patch: Partial<BuilderKpi>) =>
    onChange(
      value.map((k, i) =>
        i === kraIndex ? { ...k, kpis: k.kpis.map((p, j) => (j === kpiIndex ? { ...p, ...patch } : p)) } : k
      )
    );

  const addKra = (kraId: number) => {
    const master = kraById.get(kraId);
    onChange([...value, { kraId, weightage: master?.defaultWeightage != null ? Number(master.defaultWeightage) : '', kpis: [] }]);
  };

  const addKpi = (kraIndex: number, kpiId: number) => {
    const master = kpiById.get(kpiId);
    if (!master) return;
    const line: BuilderKpi = {
      kpiId,
      target: Number(master.target),
      weightage: Number(master.weightage),
      ...(mode === 'goal'
        ? {
            description: master.description,
            measurementType: master.measurementType,
            unit: master.unit,
            // Default to the full cycle window — always inside it, so BRD §41
            // holds until the manager narrows it.
            startDate: cycleWindow?.startDate.slice(0, 10) ?? '',
            endDate: cycleWindow?.endDate.slice(0, 10) ?? '',
            frequency: master.frequency,
            evidenceRequired: false,
            employeeComments: '',
            managerComments: '',
          }
        : {}),
    };
    onChange(value.map((k, i) => (i === kraIndex ? { ...k, kpis: [...k.kpis, line] } : k)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={Math.abs(validation.kraTotal - 100) < 0.01 ? 'success' : 'warning'} dot>
          Total KRA weightage: {validation.kraTotal}%
        </StatusBadge>
        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Model A — KRAs must total 100%, and KPIs must total 100% within each KRA.
        </span>
      </div>

      {!validation.valid && value.length > 0 && (
        <Alert tone="warning">
          <ul className="list-disc pl-4 space-y-0.5">
            {validation.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </Alert>
      )}

      {value.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
          No KRAs added yet. Pick one below to start.
        </div>
      )}

      {value.map((kra, kraIndex) => {
        const master = kraById.get(kra.kraId);
        const kpiTotal = validation.kpiTotals[master?.code ?? ''] ?? 0;
        const availableKpis = masterKpis.filter(
          (p) => p.kraId === kra.kraId && !kra.kpis.some((existing) => existing.kpiId === p.id)
        );

        return (
          <div key={kra.kraId} className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-3 border-b p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-muted)' }}>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{master?.code} — {master?.name}</div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <span style={{ color: 'var(--foreground-muted)' }}>KRA weight %</span>
                <input
                  type="number" min={0} max={100} step="0.01" disabled={readOnly}
                  className={inputCls} style={{ ...inputStyle, width: '5.5rem' }}
                  value={kra.weightage}
                  onChange={(e) => patchKra(kraIndex, { weightage: e.target.value })}
                />
              </label>
              <StatusBadge tone={Math.abs(kpiTotal - 100) < 0.01 ? 'success' : 'warning'} dot>
                KPI total {kpiTotal}%
              </StatusBadge>
              {!readOnly && (
                <Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_, i) => i !== kraIndex))}>
                  Remove
                </Button>
              )}
            </div>

            <div className="space-y-2 p-3">
              {kra.kpis.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  No KPIs yet — a KRA with no KPIs cannot be saved.
                </p>
              )}

              {kra.kpis.map((kpi, kpiIndex) => {
                const kpiMaster = kpiById.get(kpi.kpiId);
                return (
                  <div key={kpi.kpiId} className="rounded-md border p-2.5" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex flex-wrap items-end gap-2.5">
                      <div className="min-w-[10rem] flex-1">
                        <div className="text-sm font-medium">{kpiMaster?.code} — {kpiMaster?.name}</div>
                        <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                          {MEASUREMENT_TYPE_OPTIONS.find((o) => o.value === (kpi.measurementType ?? kpiMaster?.measurementType))?.label}
                        </div>
                      </div>
                      <label className="text-[11px]">
                        <span style={{ color: 'var(--foreground-muted)' }}>Target ({kpi.unit ?? kpiMaster?.unit})</span>
                        <input
                          type="number" step="0.0001" disabled={readOnly}
                          className={inputCls} style={{ ...inputStyle, width: '7rem' }}
                          value={kpi.target}
                          onChange={(e) => patchKpi(kraIndex, kpiIndex, { target: e.target.value })}
                        />
                      </label>
                      <label className="text-[11px]">
                        <span style={{ color: 'var(--foreground-muted)' }}>Weight %</span>
                        <input
                          type="number" min={0} max={100} step="0.01" disabled={readOnly}
                          className={inputCls} style={{ ...inputStyle, width: '5.5rem' }}
                          value={kpi.weightage}
                          onChange={(e) => patchKpi(kraIndex, kpiIndex, { weightage: e.target.value })}
                        />
                      </label>

                      {mode === 'goal' && (
                        <>
                          <label className="text-[11px]">
                            <span style={{ color: 'var(--foreground-muted)' }}>Start</span>
                            <input
                              type="date" disabled={readOnly}
                              min={cycleWindow?.startDate.slice(0, 10)} max={cycleWindow?.endDate.slice(0, 10)}
                              className={inputCls} style={{ ...inputStyle, width: '9rem' }}
                              value={kpi.startDate ?? ''}
                              onChange={(e) => patchKpi(kraIndex, kpiIndex, { startDate: e.target.value })}
                            />
                          </label>
                          <label className="text-[11px]">
                            <span style={{ color: 'var(--foreground-muted)' }}>End</span>
                            <input
                              type="date" disabled={readOnly}
                              min={cycleWindow?.startDate.slice(0, 10)} max={cycleWindow?.endDate.slice(0, 10)}
                              className={inputCls} style={{ ...inputStyle, width: '9rem' }}
                              value={kpi.endDate ?? ''}
                              onChange={(e) => patchKpi(kraIndex, kpiIndex, { endDate: e.target.value })}
                            />
                          </label>
                          <label className="text-[11px]">
                            <span style={{ color: 'var(--foreground-muted)' }}>Frequency</span>
                            <select
                              disabled={readOnly} className={inputCls} style={{ ...inputStyle, width: '8rem' }}
                              value={kpi.frequency ?? 'QUARTERLY'}
                              onChange={(e) => patchKpi(kraIndex, kpiIndex, { frequency: e.target.value })}
                            >
                              {MEASUREMENT_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </label>
                          <label className="flex items-center gap-1.5 pb-1.5 text-[11px]">
                            <input
                              type="checkbox" disabled={readOnly} className="h-3.5 w-3.5" style={{ accentColor: 'var(--accent)' }}
                              checked={Boolean(kpi.evidenceRequired)}
                              onChange={(e) => patchKpi(kraIndex, kpiIndex, { evidenceRequired: e.target.checked })}
                            />
                            <span style={{ color: 'var(--foreground-muted)' }}>Evidence</span>
                          </label>
                        </>
                      )}

                      {!readOnly && (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => patchKra(kraIndex, { kpis: kra.kpis.filter((_, j) => j !== kpiIndex) })}
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    {mode === 'goal' && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px]">
                          <span style={{ color: 'var(--foreground-muted)' }}>Description</span>
                          <textarea
                            rows={2} disabled={readOnly} className={inputCls} style={inputStyle}
                            value={kpi.description ?? ''}
                            onChange={(e) => patchKpi(kraIndex, kpiIndex, { description: e.target.value })}
                          />
                        </label>
                        <label className="text-[11px]">
                          <span style={{ color: 'var(--foreground-muted)' }}>Manager comments</span>
                          <textarea
                            rows={2} disabled={readOnly} className={inputCls} style={inputStyle}
                            value={kpi.managerComments ?? ''}
                            onChange={(e) => patchKpi(kraIndex, kpiIndex, { managerComments: e.target.value })}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}

              {!readOnly && (
                <select
                  className={inputCls} style={{ ...inputStyle, maxWidth: '22rem' }}
                  value=""
                  onChange={(e) => { if (e.target.value) addKpi(kraIndex, Number(e.target.value)); }}
                >
                  <option value="">
                    {availableKpis.length ? '+ Add a KPI to this KRA…' : 'No further KPIs defined under this KRA'}
                  </option>
                  {availableKpis.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
              )}
            </div>
          </div>
        );
      })}

      {!readOnly && (
        <select
          className={inputCls} style={{ ...inputStyle, maxWidth: '22rem' }}
          value=""
          onChange={(e) => { if (e.target.value) addKra(Number(e.target.value)); }}
        >
          <option value="">{availableKras.length ? '+ Add a KRA…' : 'All active KRAs have been added'}</option>
          {availableKras.map((k) => <option key={k.id} value={k.id}>{k.code} — {k.name}</option>)}
        </select>
      )}
    </div>
  );
}
