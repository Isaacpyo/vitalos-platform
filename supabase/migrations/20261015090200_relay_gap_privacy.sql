-- Vitalos Relay: deleting a conversation also removes its words from knowledge gaps.
-- Security review M4: kb_gaps.example_question kept up to 500 characters of (redacted) visitor
-- text after the visitor deleted the conversation or retention purged it, because the foreign
-- key only set example_conversation_id to null. Both paths delete relay.conversations rows, so
-- one trigger covers them. Additive: a function and a trigger, no table changes.

create function relay.forget_gap_examples()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Asked only in this conversation: the gap row is this visitor's text, so it goes.
  delete from relay.kb_gaps
  where example_conversation_id = old.id and count <= 1;
  -- Asked by others too: keep the normalised question (the shared signal), drop the example.
  update relay.kb_gaps
  set example_question = question_norm, example_conversation_id = null
  where example_conversation_id = old.id;
  return old;
end;
$$;

revoke all on function relay.forget_gap_examples() from public, anon, authenticated;

create trigger conversations_forget_gap_examples
before delete on relay.conversations
for each row execute function relay.forget_gap_examples();
