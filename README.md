# malcolmkwallaker-cyber.github.io

## Pages

- [OpenMontage — Overview & Field Notes](https://malcolmkwallaker-cyber.github.io/openmontage/) — an independent look at the open-source agentic video production system.
- [Land Reel](https://malcolmkwallaker-cyber.github.io/landreel/) — turn vacant-land photos into a vertical listing reel (Ken Burns motion, a whip transition, and an AI rendering of the finished home), entirely in your browser. No uploads, no accounts.

## Vacant-land listing reel pipeline

Two ways to generate the same reel:

- **From Claude Code:** drop land photos into a session and ask for a listing reel.
  See `tools/land_reel/README.md` for the CLI tools and `.claude/skills/vacant-land-reel/`
  for the workflow Claude follows.
- **From a browser:** [landreel](https://malcolmkwallaker-cyber.github.io/landreel/) is
  a static, client-side port of the same pipeline (`landreel/`) — no install, video
  assembly and encoding happen locally via Canvas + WebCodecs, and the optional AI
  render step calls Google's Gemini API directly from your browser with your own API
  key.