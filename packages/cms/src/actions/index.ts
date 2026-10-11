/**
 * Studio document actions (`@vitalos/cms` internal; wired in apps/studio/sanity.config.ts).
 *
 * - Publish is blocked unless the draft is approved, governance and evidence are valid and it is
 *   not controlled content (see publish-guard.ts).
 * - Publishing a document whose public URL changed creates a draft 301 redirect from the old URL
 *   (see slug-redirect.ts); the slug field also shows a warning while editing.
 * - Singletons cannot be duplicated, deleted or unpublished.
 */
import {
  useClient,
  useValidationStatus,
  type DocumentActionComponent,
  type DocumentActionsResolver,
  type NewDocumentOptionsResolver,
} from "sanity";
import { studioApiVersion, isSingletonType } from "../schemaTypes/constants";
import { plannedUrlChange, type HrefSource } from "../schemaTypes/document-href";
import { evaluatePublishReadiness } from "./publish-guard";
import { buildRedirectDraft } from "./slug-redirect";

export { evaluatePublishReadiness, type PublishDecision } from "./publish-guard";
export { buildRedirectDraft, redirectDraftId } from "./slug-redirect";

const blockedOnSingletons = new Set(["delete", "duplicate", "unpublish"]);

/** Wraps Sanity's built-in Publish action with the approval guard and the slug-change redirect. */
export function guardPublishAction(original: DocumentActionComponent): DocumentActionComponent {
  const GuardedPublish: DocumentActionComponent = (props) => {
    const base = original(props);
    const { validation, isValidating } = useValidationStatus(props.id, props.type, true);
    const client = useClient({ apiVersion: studioApiVersion });

    const decision = evaluatePublishReadiness({
      document: props.draft ?? props.published,
      markers: validation,
      isValidating,
    });
    if (!decision.allowed) {
      return {
        ...(base ?? { label: "Publish" }),
        disabled: true,
        title: decision.reasons.join(" "),
        onHandle: () => props.onComplete(),
      };
    }
    if (!base) return base;

    const change = plannedUrlChange(
      props.type,
      props.published as HrefSource | null,
      props.draft as HrefSource | null,
    );
    if (!change) return base;

    return {
      ...base,
      title: `Publishing creates a draft redirect from ${change.from} to ${change.to}.`,
      onHandle: () => {
        const draft = buildRedirectDraft(
          change,
          props.draft as Parameters<typeof buildRedirectDraft>[1],
        );
        client.createIfNotExists(draft).then(
          () => base.onHandle?.(),
          (error: unknown) => {
            console.error("Could not create the draft redirect", error);
            window.alert(
              `The page was not published because the draft redirect from ${change.from} could not be created. Try again, or create the redirect manually first.`,
            );
            props.onComplete();
          },
        );
      },
    };
  };
  GuardedPublish.action = "publish";
  GuardedPublish.displayName = "GuardedPublishAction";
  return GuardedPublish;
}

export const resolveDocumentActions: DocumentActionsResolver = (previous, context) => {
  const singleton = isSingletonType(context.schemaType);
  return previous
    .filter((action) => !(singleton && action.action && blockedOnSingletons.has(action.action)))
    .map((action) => (action.action === "publish" ? guardPublishAction(action) : action));
};

/** Singletons are created through the desk, never from the global "new document" menu. */
export const resolveNewDocumentOptions: NewDocumentOptionsResolver = (previous) =>
  previous.filter((template) => !isSingletonType(template.templateId));
