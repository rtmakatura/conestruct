# src/narrative

Crew narrative generator. Takes a device layout and produces a Markdown
document with setup instructions, flagger positions, and takedown sequence.
Uses Jinja2 templates for structural formatting and Claude Haiku (via the
anthropic SDK) for natural-language narrative generation that adapts to the
specific scenario details.
