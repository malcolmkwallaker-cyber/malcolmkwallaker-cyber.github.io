# Skills

Folders of instructions, scripts, and resources that Claude loads dynamically to
improve performance on specialized tasks. Each skill lives in its own folder with a
`SKILL.md` file holding the metadata and instructions Claude reads.

## Example skills

Sourced from [anthropics/skills](https://github.com/anthropics/skills). These are
provided for demonstration and educational purposes.

### Creative & Design
| Skill | What it does |
| --- | --- |
| [algorithmic-art](./algorithmic-art) | Create generative/algorithmic art with p5.js using seeded randomness and interactive parameters. |
| [canvas-design](./canvas-design) | Design posters and static visual art as `.png`/`.pdf` documents. |
| [theme-factory](./theme-factory) | Style artifacts (slides, docs, HTML pages) with 10 preset themes or a generated one. |
| [frontend-design](./frontend-design) | Guidance for distinctive, intentional UI visual design. |
| [slack-gif-creator](./slack-gif-creator) | Build animated GIFs optimized for Slack, with validation utilities. |

### Development & Technical
| Skill | What it does |
| --- | --- |
| [claude-api](./claude-api) | Reference for the Claude API / Anthropic SDK: models, pricing, streaming, tool use, MCP, caching. |
| [mcp-builder](./mcp-builder) | Build high-quality MCP servers in Python (FastMCP) or Node/TypeScript. |
| [skill-creator](./skill-creator) | Create, edit, and benchmark skills; optimize descriptions for triggering accuracy. |
| [web-artifacts-builder](./web-artifacts-builder) | Build elaborate multi-component claude.ai HTML artifacts (React, Tailwind, shadcn/ui). |
| [webapp-testing](./webapp-testing) | Interact with and test local web apps using Playwright. |

### Enterprise & Communication
| Skill | What it does |
| --- | --- |
| [brand-guidelines](./brand-guidelines) | Apply Anthropic's official brand colors and typography to artifacts. |
| [internal-comms](./internal-comms) | Write internal communications (status reports, leadership updates, FAQs, incident reports). |
| [doc-coauthoring](./doc-coauthoring) | Structured workflow for co-authoring docs, proposals, and technical specs. |

### Document skills
| Skill | What it does |
| --- | --- |
| [docx](./docx) | Create, read, and edit Word `.docx` documents. |
| [pdf](./pdf) | Read, merge, split, form-fill, OCR, and create PDF files. |
| [pptx](./pptx) | Create, read, and edit PowerPoint `.pptx` presentations. |
| [xlsx](./xlsx) | Create, read, edit, and convert `.xlsx`/`.csv` spreadsheets. |

## Personal build kit

- [claude-code-kit](./claude-code-kit) — "Malcolm OS": 11 copy-paste build prompts
  (B1–B6 business, P1–P5 personal) for Claude Code, each a self-contained spec with
  stack, file tree, and acceptance criteria. See its
  [00-README](./claude-code-kit/00-README.md).

## Authoring

- [template](./template) — starter `SKILL.md` for creating a new skill.

A minimal skill is just a folder with a `SKILL.md`:

```yaml
---
name: my-skill-name
description: A clear description of what this skill does and when to use it.
---

# My Skill Name

Instructions Claude follows when this skill is active.
```
