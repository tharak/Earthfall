# Ready-to-paste terminal prompt

Build and continuously improve the original-IP browser game described in `GDD.md`: **Earthfall Protocol**, a geometry-first extraction shooter set in recognizable real-world city zones. The complete loop is loadout → mission selection → deploy → fight alien robots → collect unsecured salvage → extract → bank rewards. Keep it deployable as a static GitHub Pages site, keep cosmetics non-pay-to-win, use no protected Gantz names/assets/designs, and preserve replaceable boundaries for rendering, mission content, input, and the current rule-based enemy controller so learned robot policies can be integrated later.

Treat the running game—not code summaries—as the artifact. Use `GDD.md` as the product contract and its acceptance criteria as deterministic checks. For visual hierarchy, use the supplied Helldivers 2 mission-preview image as a quality bar for information clarity only, never as something to copy: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLkb4eLRFDwR-u0VOPnGCd4w89imaF1SkCfiWv2vqztBwOMHJHOq94gKo&s=10. For gameplay, the bar is that a first-time tester can understand the objective quickly and complete a satisfying extraction in 4–8 minutes without a stuck state.

Run a Gauntlet Loop. As lead agent, inspect the repository and choose the implementation approach. Divide the goal into the smallest pieces that can be built and judged independently. For every important piece, use a builder and a separate fresh-context critic. The critic must inspect the real rendered output or execute the actual flow, compare it directly with the relevant bar, identify the single biggest remaining gap, and send that gap back for another focused build round. Never let the builder grade itself. After each major wave, use a fresh integration critic to smooth conflicts across the whole experience.

Maintain `WORKBENCH.md` as a concise live record of current screenshots/test results, active milestone, biggest known gap, decisions, and validation commands. Keep looping until every `GDD.md` acceptance criterion passes, the running artifact meets the bars, and further improvements are marginal—or until I stop the run. Run lint, tests, production build, and the GitHub Pages export after relevant milestones; if a check fails, fix it before moving on. Do not stop merely because the project compiles.

## Recommended invocation

Run this from the repository root in an agentic terminal such as Codex or Claude Code. Give the run a high reasoning/effort setting and allow browser inspection plus subagents if the harness supports them.

