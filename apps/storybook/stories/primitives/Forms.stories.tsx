import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Checkbox,
  Field,
  FormErrorSummary,
  Select,
  Stack,
  StatusMessage,
  SubmitButton,
  Textarea,
  TextInput,
} from "@vitalos/ui";
import { Frame, sample } from "./_frame";

const meta = {
  title: "Primitives/Forms",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const FieldStates: Story = {
  render: () => (
    <Frame>
      <Stack gap={6} className="max-w-xl">
        <Field label="Example default field (fixture)">
          <TextInput name="default" />
        </Field>
        <Field label="Example field with hint (fixture)" hint="Example hint text (fixture)">
          <TextInput name="hint" />
        </Field>
        <Field label="Example required field (fixture)" required>
          <TextInput name="required" />
        </Field>
        <Field label="Example optional field (fixture)" optional>
          <TextInput name="optional" />
        </Field>
        <Field
          label="Example field with error (fixture)"
          hint="Example hint text (fixture)"
          error="Example error that explains how to fix it (fixture)"
        >
          <TextInput name="error" defaultValue="example value (fixture)" />
        </Field>
        <Field label="Example disabled field (fixture)">
          <TextInput name="disabled" disabled defaultValue="Example value (fixture)" />
        </Field>
      </Stack>
    </Frame>
  ),
};

export const TextareaSelectCheckbox: Story = {
  render: () => (
    <Frame>
      <Stack gap={6} className="max-w-xl">
        <Field label="Example free text (fixture)" hint="Example hint text (fixture)">
          <Textarea name="goal" />
        </Field>
        <Field label="Example select (fixture)">
          <Select name="choice" defaultValue="">
            <option value="" disabled>
              Example choose an option (fixture)
            </option>
            <option value="a">Example option A (fixture)</option>
            <option value="b">Example option B (fixture)</option>
          </Select>
        </Field>
        <Field label="Example select with error (fixture)" error="Example error (fixture)">
          <Select name="choice-error" defaultValue="">
            <option value="" disabled>
              Example choose an option (fixture)
            </option>
            <option value="a">Example option A (fixture)</option>
          </Select>
        </Field>
        <Checkbox
          name="consent"
          label={
            <>
              Example consent statement (fixture) with a{" "}
              <a className="underline" href="#example">
                example link (fixture)
              </a>
            </>
          }
          hint="Example hint text (fixture)"
        />
        <Checkbox
          name="consent-checked"
          label="Example checked checkbox (fixture)"
          defaultChecked
        />
        <Checkbox
          name="consent-error"
          label="Example checkbox with error (fixture)"
          error="Example error (fixture)"
        />
        <Checkbox name="consent-disabled" label="Example disabled checkbox (fixture)" disabled />
      </Stack>
    </Frame>
  ),
};

export const ErrorSummary: Story = {
  render: () => (
    <Frame>
      <Stack gap={6} className="max-w-xl">
        <FormErrorSummary
          errors={[
            { fieldId: "summary-name", message: "Example error for the first field (fixture)" },
            { fieldId: "summary-email", message: "Example error for the second field (fixture)" },
          ]}
        />
        <Field
          label="Example first field (fixture)"
          id="summary-name"
          error="Example inline error (fixture)"
        >
          <TextInput name="name" />
        </Field>
        <Field
          label="Example second field (fixture)"
          id="summary-email"
          error="Example inline error (fixture)"
        >
          <TextInput name="email" type="email" />
        </Field>
      </Stack>
    </Frame>
  ),
};

export const SubmitButtonIdle: Story = {
  render: () => (
    <Frame>
      <form>
        <SubmitButton pendingLabel="Example sending (fixture)">
          Example submit (fixture)
        </SubmitButton>
      </form>
    </Frame>
  ),
};

/** The form action never settles, so the button stays in its pending state. */
export const SubmitButtonPending: Story = {
  render: () => (
    <Frame>
      <form
        action={() =>
          new Promise<void>(() => {
            /* intentionally never resolves */
          })
        }
      >
        <SubmitButton pendingLabel="Example sending (fixture)">
          Example submit (fixture)
        </SubmitButton>
      </form>
    </Frame>
  ),
  play: ({ canvasElement }) => {
    canvasElement.querySelector("form")?.requestSubmit();
  },
};

export const StatusMessages: Story = {
  render: () => (
    <Frame>
      <Stack gap={4} className="max-w-xl">
        <StatusMessage variant="info" title="Example information (fixture)">
          {sample.paragraph}
        </StatusMessage>
        <StatusMessage variant="success" title="Example success (fixture)">
          {sample.paragraph}
        </StatusMessage>
        <StatusMessage variant="warning" title="Example warning (fixture)">
          {sample.paragraph}
        </StatusMessage>
        <StatusMessage variant="error" title="Example error (fixture)">
          {sample.paragraph}
        </StatusMessage>
      </Stack>
    </Frame>
  ),
};

export const FormOn320: Story = {
  render: () => (
    <Frame width={320}>
      <form>
        <Stack gap={5}>
          <Field label={sample.longHeading} hint={sample.paragraph} error={sample.paragraph}>
            <TextInput name="long" defaultValue={sample.longWord} />
          </Field>
          <Checkbox label={sample.paragraph} />
          <SubmitButton>{sample.longHeading}</SubmitButton>
        </Stack>
      </form>
    </Frame>
  ),
};
