<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.0.1
Bump rationale: PATCH — Principle III performance target refined from "up to 200 pods"
  to "500–1,000 pods" to match the scale decision made during /speckit-plan. No new
  principle or section; a single numeric value corrected for consistency with spec.md
  (SC-003) and plan.md. Dependent doc updated: specs/001-kube-city-visualizer/spec.md.

--- Prior entry (1.0.0) ---
Version change: [unversioned template] → 1.0.0
Bump rationale: MAJOR — initial population of all placeholder tokens from blank template.

Modified principles:
  [PRINCIPLE_1_NAME] → I. Isometric-First Visual Design
  [PRINCIPLE_2_NAME] → II. Cluster-Faithful Data Mapping
  [PRINCIPLE_3_NAME] → III. Performance-Conscious Rendering (LOD)
  [PRINCIPLE_4_NAME] → IV. Real-Time Health Visibility
  [PRINCIPLE_5_NAME] → V. Progressive Feature Tiers

Added sections:
  "Technology Stack & Asset Standards" (from [SECTION_2_NAME])
  "Check-In Protocol" (from [SECTION_3_NAME])

Removed sections: none

Templates requiring updates:
  ✅ .specify/templates/constitution-template.md — source template, no changes needed
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate now has defined gates
     (principles I–V listed above; update any spec's plan.md when generated)
  ✅ .specify/templates/spec-template.md — no structural changes required; FR/SC fields
     should reference LOD, health-visibility, and tier constraints when filling specs
  ✅ .specify/templates/tasks-template.md — task phases align with Tier 1/2/3 structure;
     no template edits required

Deferred items: none — all placeholders resolved.
-->

# Kube Kingdom Constitution

## Core Principles

### I. Isometric-First Visual Design

Every Kubernetes resource MUST be rendered as a distinct, recognizable element in a
top-down isometric 3D medieval city — no dashboards, no data tables, no charts as
primary UI. The city IS the interface.

- Each resource type MUST have a defined visual metaphor (see `PROMPT.md` mapping table).
- Buildings MUST be visually distinct at a glance; silhouette alone should identify type.
- Visual fidelity MUST resemble a real RTS game. Basic geometry placeholders are
  acceptable only as temporary scaffolding during development, not in delivered Tier 1.
- All 3D assets MUST be in glTF/GLB format sourced from free/CC0/CC-BY packs
  (Kenney, Quaternius, poly.pizza, Sketchfab). Do NOT model buildings from scratch
  when a suitable free asset exists.
- Lighting MUST use a fixed golden-hour setup (warm directional sun + ambient occlusion).
  No day/night cycle is permitted.

### II. Cluster-Faithful Data Mapping

The city MUST faithfully represent cluster state at all times — what is true in the
cluster MUST be reflected in the city within one WebSocket update cycle.

- Every Kubernetes resource type listed in `PROMPT.md` MUST have a city counterpart.
- `kube-system` namespace MUST always render as the central castle / citadel.
- City layout MUST be stable: adding or removing a pod adds/removes a house in its
  district without rearranging unrelated structures.
- `MOCK_MODE=true` MUST generate a realistic synthetic cluster (≥3 nodes, ≥4 namespaces,
  ~30 pods, services, traffic) so the city is fully alive without a real cluster.
- `MOCK_MODE=false` MUST use the Kubernetes Watch API to stream live updates over
  WebSockets to the frontend.

### III. Performance-Conscious Rendering (LOD)

The renderer MUST remain smooth regardless of cluster size via a three-tier LOD system.

- **Zoomed out**: Namespaces render as colored walled areas with density indicators.
  Individual buildings MUST NOT be rendered at this level.
- **Mid zoom**: Buildings render as simplified low-poly models. Roads are visible.
- **Zoomed in**: Full detail — textured models, props, particle effects, labels.

LOD transitions MUST be smooth (no pop-in artifacts). The target is 60 fps on a modern
MacBook Pro for a cluster of 500–1,000 pods at mid zoom.

### IV. Real-Time Health Visibility

Pod and node health MUST be immediately readable from the city view without any clicks.

- Health state MUST be conveyed by color (green / amber / red / gray), visual effects
  (fire, smoke, construction scaffolding), and ambient audio cues.
- Incident mode MUST trigger a city-wide visual cascade: affected buildings pulse red,
  failure propagation glows along roads, dependency chains highlight automatically.
- No health state should require opening a table or running `kubectl` to discover.
- The detail panel (click-to-inspect) MUST use a parchment/scroll aesthetic consistent
  with the medieval theme.

### V. Progressive Feature Tiers

Implementation MUST follow the tier order defined in `PROMPT.md`: Tier 1 → Tier 2 → Tier 3.

- **Tier 1 (MVP)** is the only non-negotiable delivery scope. Work on Tier 2 or Tier 3
  features MUST NOT begin until Tier 1 is complete and validated.
- Each tier MUST be independently demonstrable — Tier 1 alone constitutes a shippable
  product.
- Scope cuts, if required, MUST be proposed as check-ins (see Check-In Protocol below)
  and approved before implementation.
- `READ_ONLY=true` is the safe default. Write actions (restart, scale, delete) are Tier 2
  and MUST be gated behind `READ_ONLY=false` with confirmation dialogs for all
  destructive operations.

## Technology Stack & Asset Standards

**Frontend**: React 18+ + TypeScript, bundled with Vite.
React Three Fiber (R3F) + `@react-three/drei` MUST be used for all 3D rendering.
Three.js MUST NOT be called directly outside of R3F unless no R3F abstraction exists.

**Backend**: Node.js + TypeScript, Express for HTTP, WebSockets (ws or socket.io) for
live cluster event streaming.

**Monorepo structure**: Two npm packages — `client/` (frontend) and `server/` (backend).
Shared types MAY be extracted to a `shared/` package if duplication becomes a problem.

**3D Assets**: glTF/GLB only. All assets MUST be from free/open-license packs.
Asset selection MUST be proposed as a check-in before bulk downloading or integrating.

**No deployment target**: The app runs locally via `npm run dev`. No Docker, no CI/CD
pipeline, no cloud infra is required for the project to function.

## Check-In Protocol

The following decision points MUST pause implementation and await explicit user approval
before proceeding:

1. **Before building the world** — Present 3 visual style directions labeled A / B / C,
   each with a one-line tradeoff. Wait for selection.
2. **Before choosing 3D model packs** — Show 3 asset pack options with links and preview
   descriptions. Wait for aesthetic approval.
3. **For any major scoping decision** — Including features to cut if the full Tier 1 scope
   cannot fit in one implementation pass.

Proceeding past a check-in gate without user confirmation is a constitution violation.

## Governance

This constitution supersedes all other practices and documentation. When conflict exists
between this document and any spec, plan, or task file, this document takes precedence.

**Amendment procedure**:
1. Propose the change with a rationale and version bump type (MAJOR / MINOR / PATCH).
2. Run `/speckit-constitution` to apply and propagate the change to dependent templates.
3. Update any active `spec.md`, `plan.md`, or `tasks.md` files that reference amended principles.

**Versioning policy**:
- MAJOR: Principle removed, redefined, or backward-incompatible governance change.
- MINOR: New principle or section added, or materially expanded guidance.
- PATCH: Clarification, wording fix, or non-semantic refinement.

**Compliance review**: Every plan.md Constitution Check gate MUST validate against
principles I–V above before implementation begins. Re-check after Phase 1 design.

**Version**: 1.0.1 | **Ratified**: 2026-06-19 | **Last Amended**: 2026-06-19
