# Design lifecycle

ChatGPT visual exploration → approved direction → Figma tokens/components/templates → source-controlled tokens/UI → Storybook → coded templates → visual regression. Figma is design authority; code is behaviour authority. Differences require review, token update and Storybook regression—not screenshot scraping.

Current state (10 Oct 2026): until Figma Direction 01 templates exist, the owner's comp (`vitalos-web.zip`) is the interim visual reference. Its layout and motion are rebuilt in tokens, `@vitalos/ui` and Storybook (ADR-023); Stage 9 rules win where the comp conflicts with them, and the token additions it needed await design review.
