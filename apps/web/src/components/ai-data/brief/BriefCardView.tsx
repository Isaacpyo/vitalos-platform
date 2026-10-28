"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Textarea } from "@vitalos/ui";
import { provenanceLabel } from "../../../features/ai-data/brief/cards";
import { listItems } from "../../../features/ai-data/brief/text";
import { BRIEF_LIMITS, cardTitles } from "../../../features/ai-data/brief/types";
import type { BriefCard } from "../../../features/ai-data/brief/types";
import { ProvenanceTag, cx, secondaryButton, textButton } from "./parts";

const isList = (key: BriefCard["key"]) => key === "possibleAutomation" || key === "unknowns";

export interface BriefCardViewProps {
  card: BriefCard;
  onEdit: (text: string) => void;
  onRevert: () => void;
  onRemove: () => void;
  onRestore: () => void;
}

/**
 * One brief card: shows its provenance ("You said", "Suggested by AI", "Suggested from our
 * checklist", "Edited by you"), and can be edited, removed or restored. Save feedback is a polite
 * status line inside the card.
 */
export function BriefCardView({ card, onEdit, onRevert, onRemove, onRestore }: BriefCardViewProps) {
  const headingId = useId();
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.text);
  const [feedback, setFeedback] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const wasRemoved = useRef(card.removed);

  useEffect(() => {
    if (editing) document.getElementById(fieldId)?.focus();
    else if (wasEditing.current) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing, fieldId]);

  useEffect(() => {
    if (card.removed && !wasRemoved.current) restoreButton.current?.focus();
    wasRemoved.current = card.removed;
  }, [card.removed]);

  const label = provenanceLabel(card);
  const kind = card.edited ? "edited" : card.provenance;
  const title = cardTitles[card.key];

  function save() {
    const next = draft.trim();
    if (next === "") {
      setFeedback("Add some text, or remove this card instead.");
      return;
    }
    onEdit(next);
    setEditing(false);
    setFeedback("Saved. Your edit is part of the brief.");
  }

  if (card.removed) {
    return (
      <article
        aria-labelledby={headingId}
        className="flex flex-col gap-(--space-3) rounded-lg border border-dashed border-aid-line p-(--space-5)"
      >
        <h3 id={headingId} className="m-0 text-h4 text-aid-muted">
          {title}
        </h3>
        <p className="m-0 text-small text-aid-muted">
          Removed. This card will not be shared with your brief.
        </p>
        <div>
          <button
            ref={restoreButton}
            type="button"
            className={secondaryButton}
            onClick={() => {
              onRestore();
              setFeedback("Restored.");
            }}
          >
            Restore this card
          </button>
        </div>
        <p role="status" className="sr-only">
          {feedback || `${title} removed.`}
        </p>
      </article>
    );
  }

  return (
    <article
      aria-labelledby={headingId}
      data-card={card.key}
      className="flex flex-col gap-(--space-4) rounded-lg border border-aid-border bg-aid-surface p-(--space-5) md:p-(--space-6)"
    >
      <header className="flex flex-wrap items-center justify-between gap-(--space-3)">
        <h3 id={headingId} className="m-0 text-h4 text-aid-heading">
          {title}
        </h3>
        <ProvenanceTag kind={kind}>{label}</ProvenanceTag>
      </header>

      {editing ? (
        <div className="flex flex-col gap-(--space-3)">
          <label htmlFor={fieldId} className="text-small font-semibold text-aid-heading">
            Edit {title.toLowerCase()}
            {isList(card.key) ? " (one item per line)" : ""}
          </label>
          <Textarea
            id={fieldId}
            rows={isList(card.key) ? 5 : 4}
            maxLength={BRIEF_LIMITS.cardMax}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex flex-wrap gap-(--space-2)">
            <button type="button" className={secondaryButton} onClick={save}>
              Save changes
            </button>
            <button
              type="button"
              className={textButton}
              onClick={() => {
                setDraft(card.text);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : isList(card.key) ? (
        <ul className="m-0 flex list-disc flex-col gap-(--space-2) pl-(--space-5) text-aid-text">
          {listItems(card.text).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="m-0 whitespace-pre-line text-aid-text">{card.text}</p>
      )}

      {editing ? null : (
        <div className="flex flex-wrap items-center gap-(--space-2)">
          <button
            ref={editButton}
            type="button"
            className={secondaryButton}
            onClick={() => {
              setDraft(card.text);
              setFeedback("");
              setEditing(true);
            }}
          >
            Edit
          </button>
          {card.edited ? (
            <button
              type="button"
              className={textButton}
              onClick={() => {
                onRevert();
                setFeedback("Back to the original text.");
              }}
            >
              Revert to original
            </button>
          ) : null}
          <button
            type="button"
            className={cx(textButton, "ml-auto")}
            onClick={() => {
              onRemove();
              setFeedback("");
            }}
          >
            Remove
          </button>
        </div>
      )}
      <p role="status" className={cx("m-0 text-small text-aid-ok", feedback === "" && "sr-only")}>
        {feedback}
      </p>
    </article>
  );
}
