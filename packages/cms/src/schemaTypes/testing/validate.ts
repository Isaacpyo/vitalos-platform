/**
 * A small validation harness that runs the schemas' real `validation` callbacks against artificial
 * documents, without the Studio SDK.
 *
 * It implements the subset of Sanity's `Rule` API the schemas use (required, min, max, unique,
 * email, uri, custom, warning/error) and walks fields, nested objects and array members the way
 * the Studio does: hidden fields are skipped, named-type validation runs alongside field
 * validation, and custom validators run even when the value is undefined. Any Rule method it does
 * not implement throws, so a schema cannot start using one without the tests noticing.
 */
import { schemaTypes } from "../index";
import type { FetchClient } from "../rules/unique";

export type Level = "error" | "warning" | "info";
export interface Finding {
  level: Level;
  message: string;
  /** Dot path from the document root, with array indexes as numbers, e.g. "certifications.0.scope". */
  path: string;
}

type CustomFn = (value: unknown, context: Record<string, unknown>) => unknown;

interface Constraint {
  kind: "required" | "min" | "max" | "unique" | "email" | "uri" | "custom";
  arg?: unknown;
  fn?: CustomFn;
}

export class FakeRule {
  constructor(
    readonly constraints: readonly Constraint[] = [],
    readonly level: Level = "error",
  ) {}
  private with(constraint: Constraint): FakeRule {
    return new FakeRule([...this.constraints, constraint], this.level);
  }
  required() {
    return this.with({ kind: "required" });
  }
  min(arg: number) {
    return this.with({ kind: "min", arg });
  }
  max(arg: number) {
    return this.with({ kind: "max", arg });
  }
  unique() {
    return this.with({ kind: "unique" });
  }
  email() {
    return this.with({ kind: "email" });
  }
  uri(arg?: { scheme?: string[] }) {
    return this.with({ kind: "uri", arg });
  }
  custom(fn: CustomFn) {
    return this.with({ kind: "custom", fn });
  }
  warning() {
    return new FakeRule(this.constraints, "warning");
  }
  error() {
    return new FakeRule(this.constraints, "error");
  }
}

// Fail loudly on unsupported Rule methods.
const guarded = (rule: FakeRule): FakeRule =>
  new Proxy(rule, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && !(prop in target)) {
        throw new Error(
          `Test harness does not implement Rule.${prop}(); add it to testing/validate.ts`,
        );
      }
      const member = Reflect.get(target, prop, receiver) as unknown;
      // Chained calls return fresh FakeRules; keep them guarded.
      if (typeof member === "function") {
        return (...args: unknown[]) => {
          const out = (member as (...a: unknown[]) => unknown).apply(target, args);
          return out instanceof FakeRule ? guarded(out) : out;
        };
      }
      return member;
    },
  });

interface TypeDef {
  name?: string;
  type?: string;
  fields?: FieldDef[];
  of?: TypeDef[];
  hidden?: unknown;
  validation?: unknown;
}
interface FieldDef extends TypeDef {
  name: string;
}

const registry = new Map<string, TypeDef>(
  (schemaTypes as unknown as TypeDef[]).map((def) => [def.name as string, def]),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Linear-time email shape check (one "@", no whitespace, a dot inside the domain). */
function looksLikeEmail(value: string): boolean {
  if (value.length > 320 || /\s/.test(value)) return false;
  const at = value.indexOf("@");
  if (at < 1 || at !== value.lastIndexOf("@")) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  return dot > 0 && dot < domain.length - 1;
}

const present = (value: unknown): boolean =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  !(Array.isArray(value) && value.length === 0);

export interface ValidateOptions {
  /** Answers GROQ lookups made by async rules. */
  fetch?: (query: string, params: Record<string, unknown>) => unknown;
}

interface Walk {
  doc: Record<string, unknown>;
  options: ValidateOptions;
  findings: Finding[];
}

function buildRules(validation: unknown): FakeRule[] {
  if (typeof validation !== "function") return [];
  const result = (validation as (rule: FakeRule) => unknown)(guarded(new FakeRule()));
  return (Array.isArray(result) ? result : [result]).filter(
    (entry): entry is FakeRule => entry instanceof FakeRule,
  );
}

async function runRule(
  rule: FakeRule,
  value: unknown,
  path: (string | number)[],
  context: Record<string, unknown>,
  walk: Walk,
): Promise<void> {
  const report = (message: string, extra: (string | number)[] = []) =>
    walk.findings.push({ level: rule.level, message, path: [...path, ...extra].join(".") });
  for (const constraint of rule.constraints) {
    switch (constraint.kind) {
      case "required":
        if (!present(value)) report("Required");
        break;
      case "min":
      case "max": {
        if (!present(value)) break;
        const size =
          typeof value === "string" || Array.isArray(value)
            ? value.length
            : typeof value === "number"
              ? value
              : undefined;
        const limit = constraint.arg as number;
        if (size !== undefined && (constraint.kind === "min" ? size < limit : size > limit)) {
          report(`${constraint.kind} ${limit} violated`);
        }
        break;
      }
      case "unique":
        if (Array.isArray(value)) {
          const keys = value.map((item) => JSON.stringify(item));
          if (new Set(keys).size !== keys.length) report("Duplicate items");
        }
        break;
      case "email":
        if (typeof value === "string" && !looksLikeEmail(value)) report("Invalid email");
        break;
      case "uri": {
        if (typeof value !== "string") break;
        const schemes = (constraint.arg as { scheme?: string[] } | undefined)?.scheme ?? [];
        try {
          const protocol = new URL(value).protocol.replace(":", "");
          if (schemes.length > 0 && !schemes.includes(protocol)) report("Wrong URL scheme");
        } catch {
          report("Invalid URL");
        }
        break;
      }
      case "custom": {
        const result = await (constraint.fn as CustomFn)(value, context);
        const list = result === true ? [] : Array.isArray(result) ? result : [result];
        for (const entry of list) {
          if (typeof entry === "string") report(entry);
          else if (isRecord(entry) && typeof entry["message"] === "string") {
            const extra = Array.isArray(entry["path"])
              ? (entry["path"] as (string | number)[])
              : [];
            report(entry["message"], extra);
          }
        }
        break;
      }
    }
  }
}

const primitive = new Set([
  "string",
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "url",
  "slug",
  "reference",
  "block",
]);

/** The field's type followed by each named schema type it inherits from. */
function chainOf(def: TypeDef): TypeDef[] {
  const chain = [def];
  let current = def;
  while (current.type !== undefined) {
    const next = registry.get(current.type);
    if (!next || next === current || chain.includes(next)) break;
    chain.push(next);
    current = next;
  }
  return chain;
}

async function walkValue(
  def: TypeDef,
  value: unknown,
  path: (string | number)[],
  parent: unknown,
  walk: Walk,
): Promise<void> {
  const hidden = def.hidden;
  if (hidden === true) return;
  if (typeof hidden === "function") {
    const isHidden = (hidden as (args: Record<string, unknown>) => unknown)({
      parent,
      document: walk.doc,
      value,
    });
    if (isHidden) return;
  }
  const client: FetchClient = {
    fetch: async <R = unknown>(query: string, params: Record<string, unknown> = {}) =>
      (walk.options.fetch ? await walk.options.fetch(query, params) : undefined) as R,
  };
  const context = { document: walk.doc, parent, getClient: () => client };

  const chain = chainOf(def);
  for (const entry of chain) {
    for (const rule of buildRules(entry.validation))
      await runRule(rule, value, path, context, walk);
  }

  const fields = chain.find((entry) => entry.fields)?.fields;
  const members = chain.find((entry) => entry.of)?.of;
  if (fields && isRecord(value)) {
    for (const child of fields) {
      await walkValue(child, value[child.name], [...path, child.name], value, walk);
    }
  }
  if (members && Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const typeName =
        isRecord(item) && typeof item["_type"] === "string" ? item["_type"] : undefined;
      const member =
        members.find((entry) => (entry.name ?? entry.type) === typeName) ??
        (typeName === undefined
          ? members.find((entry) => primitive.has(entry.type ?? ""))
          : undefined) ??
        members[0];
      if (member) await walkValue(member, item, [...path, index], value, walk);
    }
  }
}

/** Validates an artificial document against its schema type and returns every finding. */
export async function validateDocument(
  doc: Record<string, unknown>,
  options: ValidateOptions = {},
): Promise<Finding[]> {
  const type = registry.get(String(doc["_type"]));
  if (!type) throw new Error(`Unknown schema type ${String(doc["_type"])}`);
  const walk: Walk = { doc, options, findings: [] };
  await walkValue(type, doc, [], undefined, walk);
  return walk.findings;
}

/** Validates a standalone value against a named object type (for example `evidence` or `cta`). */
export async function validateObject(
  typeName: string,
  value: unknown,
  options: ValidateOptions = {},
): Promise<Finding[]> {
  const type = registry.get(typeName);
  if (!type) throw new Error(`Unknown schema type ${typeName}`);
  const walk: Walk = { doc: isRecord(value) ? value : {}, options, findings: [] };
  await walkValue(type, value, [], undefined, walk);
  return walk.findings;
}

/** A dataset with nothing in it: counts are 0, single lookups are null, lists are empty. */
export const emptyDataset: NonNullable<ValidateOptions["fetch"]> = (query) => {
  if (query.startsWith("count(")) return 0;
  if (query.includes("[0]")) return null;
  return [];
};

/** Runs one `validation` callback (taken straight from a schema definition) against a value. */
export async function checkValue(
  validation: unknown,
  value: unknown,
  options: ValidateOptions = {},
): Promise<Finding[]> {
  const walk: Walk = { doc: {}, options, findings: [] };
  await walkValue({ validation }, value, [], undefined, walk);
  return walk.findings;
}

export const errorsOf = (findings: readonly Finding[]) =>
  findings.filter((f) => f.level === "error");
export const warningsOf = (findings: readonly Finding[]) =>
  findings.filter((f) => f.level === "warning");
export const atPath = (findings: readonly Finding[], path: string) =>
  findings.filter((f) => f.path === path || f.path.startsWith(`${path}.`));
