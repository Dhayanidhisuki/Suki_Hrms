import { describe, it, expect } from 'vitest';
import {
  render,
  extractPlaceholders,
  formatIndianCurrency,
  amountInIndianWords,
  integerInIndianWords,
  formatDate,
  mask,
  toTitleCase,
  truncate,
  plural,
} from '@/lib/platform/notification/render';
import { selectTemplate, filterMatches, type TemplateCandidate } from '@/lib/platform/notification/templates';

const ctx = {
  Employee: { FullName: 'ramesh kumar', Code: 'EMP026', BankAccount: '123456787712', Dotted: null },
  Request: { No: 'LEAV/2526/00042', Amount: 1200000, DueAt: new Date(Date.UTC(2026, 9, 2, 3, 30)), Count: 1 },
  Payroll: { NetPay: 45000 },
  Approver: { Remark: 'Clearance verified after checking every line item in the statement' },
  Document: { DaysToExpiry: 7 },
};

describe('render — placeholder substitution', () => {
  it('substitutes namespaced placeholders and leaves plain text alone', () => {
    const r = render('Hello {{Employee.FullName}}, request {{Request.No}}.', ctx);
    expect(r.text).toBe('Hello ramesh kumar, request LEAV/2526/00042.');
    expect(r.unresolved).toEqual([]);
  });

  it('reports unresolved placeholders and renders them empty', () => {
    const r = render('{{Request.No}} / {{Request.Missing}} / {{Nope.Field}}', ctx);
    expect(r.text).toBe('LEAV/2526/00042 /  / ');
    expect(r.unresolved).toEqual(['Request.Missing', 'Nope.Field']);
  });

  it('uses default: for null values without reporting them unresolved', () => {
    const r = render('{{Employee.Dotted|default:Not applicable}}', ctx);
    expect(r.text).toBe('Not applicable');
    expect(r.unresolved).toEqual([]);
  });

  it('renders {{{{ as a literal double brace', () => {
    expect(render('use {{{{Ns.Field}} syntax', ctx).text).toBe('use {{Ns.Field}} syntax');
  });

  it('HTML-escapes values only when asked', () => {
    const c = { X: { V: '<b>&"' } };
    expect(render('{{X.V}}', c).text).toBe('<b>&"');
    expect(render('{{X.V}}', c, { escapeHtml: true }).text).toBe('&lt;b&gt;&amp;&quot;');
  });

  it('extractPlaceholders lists namespace, field and directives', () => {
    const p = extractPlaceholders('{{Request.Amount|currency:INR}} {{Employee.FullName|title}}');
    expect(p.map((x) => `${x.namespace}.${x.field}`)).toEqual(['Request.Amount', 'Employee.FullName']);
    expect(p[0].directives).toEqual([{ name: 'currency', arg: 'INR' }]);
  });
});

describe('render — directives', () => {
  it('date:<pattern> formats in IST with dd-MMM-yyyy and dd/MM/yyyy', () => {
    expect(render('{{Request.DueAt|date:dd-MMM-yyyy}}', ctx).text).toBe('02-Oct-2026');
    expect(render('{{Request.DueAt|date:dd/MM/yyyy}}', ctx).text).toBe('02/10/2026');
    expect(render('{{Request.DueAt|date:dd-MMM-yyyy HH:mm}}', ctx).text).toBe('02-Oct-2026 09:00');
    expect(formatDate(new Date('2026-04-01'), 'EEE, d MMMM yyyy')).toBe('Wed, 1 April 2026');
  });

  it('currency:INR uses Indian grouping with two decimals', () => {
    expect(render('{{Request.Amount|currency:INR}}', ctx).text).toBe('12,00,000.00');
    expect(formatIndianCurrency(1234567.5)).toBe('12,34,567.50');
    expect(formatIndianCurrency('999')).toBe('999.00');
    expect(formatIndianCurrency(1000)).toBe('1,000.00');
    expect(formatIndianCurrency(-100000)).toBe('-1,00,000.00');
    expect(formatIndianCurrency({ toFixed: (n: number) => (123456789.123).toFixed(n) })).toBe('12,34,56,789.12');
  });

  it('words:INR renders rupees in Indian words', () => {
    expect(render('{{Payroll.NetPay|words:INR}}', ctx).text).toBe('Rupees Forty Five Thousand Only');
    expect(amountInIndianWords(1200000)).toBe('Rupees Twelve Lakh Only');
    expect(amountInIndianWords(45000.5)).toBe('Rupees Forty Five Thousand and Fifty Paise Only');
    expect(integerInIndianWords(123456789)).toBe('Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine');
    expect(integerInIndianWords(0)).toBe('Zero');
  });

  it('upper / lower / title transform case', () => {
    expect(render('{{Employee.FullName|upper}}', ctx).text).toBe('RAMESH KUMAR');
    expect(render('{{Employee.Code|lower}}', ctx).text).toBe('emp026');
    expect(render('{{Employee.FullName|title}}', ctx).text).toBe('Ramesh Kumar');
    expect(toTitleCase("o'brien-smith")).toBe("O'Brien-Smith");
  });

  it('mask:<n> keeps only the last n characters', () => {
    expect(render('{{Employee.BankAccount|mask:4}}', ctx).text).toBe('XXXXXXXX7712');
    expect(mask('12', 4)).toBe('12');
  });

  it('truncate:<n> adds an ellipsis', () => {
    expect(render('{{Approver.Remark|truncate:20}}', ctx).text).toBe('Clearance verified…');
    expect(truncate('short', 60)).toBe('short');
  });

  it('plural:<s>/<p> picks by numeric value', () => {
    expect(render('{{Document.DaysToExpiry|plural:day/days}}', ctx).text).toBe('days');
    expect(render('{{Request.Count|plural:day/days}}', ctx).text).toBe('day');
    expect(plural('1', 'item/items')).toBe('item');
  });

  it('chains directives left to right', () => {
    expect(render('{{Employee.FullName|title|truncate:8}}', ctx).text).toBe('Ramesh…');
  });
});

describe('selectTemplate — §12.3 precedence', () => {
  const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));
  const base = (over: Partial<TemplateCandidate> & { id: number }): TemplateCandidate => ({
    eventCode: 'WF_APPROVED',
    channel: 'EMAIL',
    language: 'en-IN',
    status: 'Active',
    effectiveFrom: d(2026, 1, 1),
    effectiveTo: null,
    designationFilter: null,
    departmentFilter: null,
    versionNo: 1,
    ...over,
  });
  const at = d(2026, 6, 15);

  it('filters by event, channel, status and effective window', () => {
    const all = [
      base({ id: 1 }),
      base({ id: 2, channel: 'INAPP' }),
      base({ id: 3, status: 'Inactive' }),
      base({ id: 4, effectiveFrom: d(2027, 1, 1) }),
      base({ id: 5, effectiveTo: d(2026, 3, 31) }),
      base({ id: 6, eventCode: 'WF_REJECTED' }),
    ];
    expect(selectTemplate(all, { eventCode: 'WF_APPROVED', channel: 'EMAIL', at })?.id).toBe(1);
    expect(selectTemplate(all, { eventCode: 'WF_APPROVED', channel: 'SMS', at })).toBeNull();
  });

  it('prefers the recipient language and falls back to en-IN', () => {
    const all = [base({ id: 1 }), base({ id: 2, language: 'ta-IN' })];
    expect(selectTemplate(all, { eventCode: 'WF_APPROVED', channel: 'EMAIL', language: 'ta-IN', at })?.id).toBe(2);
    expect(selectTemplate(all, { eventCode: 'WF_APPROVED', channel: 'EMAIL', language: 'hi-IN', at })?.id).toBe(1);
  });

  it('prefers a designation-filtered template that names the recipient over the generic one', () => {
    const all = [base({ id: 1 }), base({ id: 2, designationFilter: 'OPERATOR, FITTER' })];
    const q = { eventCode: 'WF_APPROVED', channel: 'EMAIL', at };
    expect(selectTemplate(all, { ...q, recipient: { designationCode: 'fitter' } })?.id).toBe(2);
    expect(selectTemplate(all, { ...q, recipient: { designationCode: 'MANAGER' } })?.id).toBe(1);
    expect(selectTemplate(all, { ...q })?.id).toBe(1);
  });

  it('applies the department filter after the designation filter', () => {
    const all = [
      base({ id: 1, designationFilter: 'OPERATOR' }),
      base({ id: 2, designationFilter: 'OPERATOR', departmentFilter: 'Production' }),
    ];
    const q = { eventCode: 'WF_APPROVED', channel: 'EMAIL', at };
    expect(selectTemplate(all, { ...q, recipient: { designationCode: 'OPERATOR', department: 'Production' } })?.id).toBe(2);
    expect(selectTemplate(all, { ...q, recipient: { designationCode: 'OPERATOR', department: 'Quality' } })?.id).toBe(1);
  });

  it('takes the latest effectiveFrom, then the highest versionNo', () => {
    const all = [base({ id: 1, effectiveFrom: d(2026, 1, 1) }), base({ id: 2, effectiveFrom: d(2026, 4, 1), versionNo: 2 }), base({ id: 3, effectiveFrom: d(2026, 4, 1), versionNo: 3 })];
    expect(selectTemplate(all, { eventCode: 'WF_APPROVED', channel: 'EMAIL', at })?.id).toBe(3);
  });

  it('returns null when nothing matches', () => {
    expect(selectTemplate([], { eventCode: 'X', channel: 'EMAIL', at })).toBeNull();
    expect(filterMatches('A,B', 'c')).toBe(false);
    expect(filterMatches(null, 'c')).toBe(true);
  });
});
