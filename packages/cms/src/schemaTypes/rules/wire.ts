/**
 * Adapters from pure `Issue[]` rules to Sanity validation `Rule`s.
 *
 * `errors` blocks publishing; `warnings` is advisory (Sanity's warning level never blocks).
 */
import type { CustomValidatorResult, ValidationContext } from "sanity";
import type { Issue } from "./issue";

export type IssueRule<T> = (
  value: T,
  context: ValidationContext,
) => readonly Issue[] | Promise<readonly Issue[]>;

/** Structural subset of Sanity's `Rule` that the wiring needs; keeps typing independent of rule flavour. */
export interface RuleLike {
  custom(validator: (value: never, context: ValidationContext) => unknown): RuleLike;
  warning(message?: string): RuleLike;
}

export function toResult(issues: readonly Issue[]): CustomValidatorResult {
  if (issues.length === 0) return true;
  return issues.map((entry) =>
    entry.path ? { message: entry.message, path: entry.path } : { message: entry.message },
  );
}

/** Blocking custom rule. */
export function errors<T = unknown>(rule: IssueRule<T>) {
  return (r: RuleLike): RuleLike =>
    r.custom(async (value: never, context) => toResult(await rule(value, context)));
}

/** Advisory custom rule. */
export function warnings<T = unknown>(rule: IssueRule<T>) {
  return (r: RuleLike): RuleLike => errors(rule)(r).warning();
}
