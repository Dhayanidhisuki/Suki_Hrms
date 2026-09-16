/**
 * Workflow handler registry.
 *
 * A module makes a transaction approvable by registering a request type
 * (configuration, WorkflowRequestType.handlerKey) and, optionally, an
 * in-process handler under that key. The engine calls the handler at
 * Validate (Submit / Re-submit), on final approval and on rejection.
 *
 * Registration happens at *import time*: a module registers its handler
 * from a module-level statement in a file that is imported by its own
 * route handlers, e.g.
 *
 *   // src/lib/leave/workflowHandler.ts
 *   registerWorkflowHandler('leave.application', { validate, onApproved, onRejected });
 *
 * and re-exports nothing else. Because Next.js evaluates route modules
 * lazily, a module must make sure that file is imported before the engine
 * verb that needs it runs (the simplest way is to import it from the
 * module's own workflow route files and from src/instrumentation.ts).
 * A request type whose handlerKey has no registered handler is treated as
 * "validation passes, no callbacks" — the engine never fails on an absent
 * handler.
 */

import type { WorkflowRequestView } from './types';

export type WorkflowHandler = {
  validate?(req: WorkflowRequestView): Promise<{ ok: true } | { ok: false; errors: string[] }>;
  onApproved?(req: WorkflowRequestView): Promise<void>;
  onRejected?(req: WorkflowRequestView, reason: string): Promise<void>;
};

const g = globalThis as unknown as { __platformWorkflowHandlers?: Map<string, WorkflowHandler> };

/** Module-level map, kept on globalThis so dev HMR never loses registrations. */
function registry(): Map<string, WorkflowHandler> {
  if (!g.__platformWorkflowHandlers) g.__platformWorkflowHandlers = new Map();
  return g.__platformWorkflowHandlers;
}

export function registerWorkflowHandler(handlerKey: string, handler: WorkflowHandler): void {
  if (!handlerKey) throw new Error('registerWorkflowHandler: handlerKey is required');
  registry().set(handlerKey, handler);
}

export function getWorkflowHandler(handlerKey: string | null | undefined): WorkflowHandler | undefined {
  if (!handlerKey) return undefined;
  return registry().get(handlerKey);
}

export function unregisterWorkflowHandler(handlerKey: string): void {
  registry().delete(handlerKey);
}
