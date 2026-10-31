# AGENTS.md — Collaborative IDE (CodeSync)

Permanent architectural, engineering, and workflow instructions for all AI agents and developers working in this repository.

---

## 1. Project Overview

**CodeSync** is a high-performance, browser-based collaborative Integrated Development Environment (IDE) engineered for seamless real-time coding, pair programming, remote interviews, and team collaboration.

### Core Capabilities

- **Monaco Editor Integration**: Full-featured code editor with syntax highlighting, autocomplete, code folding, and multi-cursor support.
- **Multi-Language Support**: First-class compilation and runtime support for **Python**, **C++**, **JavaScript**, and **Java**.
- **File & Folder Management**: Hierarchical workspace file tree supporting file/folder creation, deletion, renaming, nested directories, and drag-and-drop organization.
- **Real-Time Collaborative Editing**: Conflict-free, multi-user concurrent editing powered by Conflict-Free Replicated Data Types (CRDTs via Yjs).
- **User Presence & Live Cursors**: Visual user awareness showcasing real-time cursor positions, text selections, and active user avatars/names.
- **Workspace Access & RBAC**: Workspace creation, invitation links, and granular Role-Based Access Control (**Owner**, **Admin**, **Editor**, **Viewer**).
- **Sandboxed Code Execution**: Remote code compilation and execution using self-hosted Judge0 CE with security isolation.
- **Interactive Stdin & Terminal Output**: Configurable input panels (stdin) and rich output panels displaying stdout, stderr, compile errors, execution timing, and exit status.
- **Real-Time Chat**: In-workspace room chat with instant messaging, system alerts, and notification feeds.
- **Audio & Video Calls**: Low-latency, multi-participant voice and video conferencing built on WebRTC and LiveKit.
- **Workspace Activity History**: Comprehensive audit logging and event tracking covering file changes, execution runs, and member actions.

---

## 2. Technology Decisions

Every component in the system is intentionally selected to ensure scalability, reliability, and security.

### Frontend

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React, Server & Client Components)
- **Language**: TypeScript (`strict: true`)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Component Library**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
- **Code Editor**: `@monaco-editor/react` / Monaco Editor
- **Client State Management**: [Zustand](https://github.com/pmndrs/zustand) (editor settings, panels, layout, active tabs)
- **Server State & Data Fetching**: [TanStack Query](https://tanstack.com/query/latest) (React Query v5)

### Backend

- **Runtime & Framework**: Node.js with [Express.js](https://expressjs.com/)
- **Language**: TypeScript (`strict: true`)
- **ORM & Data Modeling**: [Prisma](https://www.prisma.io/)
- **Input Validation**: [Zod](https://zod.dev/)

### Infrastructure & Services

- **Database**: PostgreSQL (relational persistence for users, workspaces, files, permissions, activity logs)
- **In-Memory Cache & Message Broker**: Redis (session tracking, rate limiting, pub/sub, awareness data)
- **Asynchronous Task Queue**: [BullMQ](https://docs.bullmq.io/) (backed by Redis for background jobs, execution queuing, and heavy async tasks)
- **Containerization**: Docker & Docker Compose (Judge0 CE, PostgreSQL, Redis, LiveKit local development)

### Collaboration Engine

- **CRDT Core**: [Yjs](https://github.com/yjs/yjs)
- **Monaco Binding**: `y-monaco`
- **Collaboration Backend**: [Hocuspocus](https://tiptap.dev/hocuspocus) (WebSocket server for Yjs with persistence hooks and authentication)

### Code Execution

- **Sandbox Engine**: Self-hosted [Judge0 CE](https://judge0.com/) (isolated Docker sandbox utilizing Linux cgroups and `isolate`)

### Real-Time Communication

- **Chat & Notifications**: [Socket.IO](https://socket.io/)
- **Audio & Video Calling**: [LiveKit](https://livekit.io/) (WebRTC SFU architecture with room token authentication)

### Testing & Quality Assurance

- **Unit & Integration Testing**: [Vitest](https://vitest.dev/)
- **End-to-End (E2E) Testing**: [Playwright](https://playwright.dev/)
- **Linting & Formatting**: ESLint, Prettier

---

## 3. Monorepo Architecture

The repository follows a clean, modular monorepo layout:

```text
CodeSync/
├── apps/
│   ├── web/                    # Next.js frontend application
│   │   ├── src/
│   │   │   ├── app/            # App Router pages and layouts
│   │   │   ├── components/     # UI, Editor, Terminal, FileTree, Chat, Media
│   │   │   ├── hooks/          # React hooks (useCollab, useExecution, usePresence)
│   │   │   ├── stores/         # Zustand stores (useEditorStore, useLayoutStore)
│   │   │   └── lib/            # Utilities, API client, Yjs provider setup
│   │   └── ...
│   └── server/                 # Express.js REST & WebSocket backend
│       ├── src/
│       │   ├── controllers/    # Route controllers
│       │   ├── routes/         # Express API route declarations
│       │   ├── middleware/     # Auth, RBAC, Rate-limiting, Zod validation
│       │   ├── services/       # Core business logic (Execution, Workspace, LiveKit)
│       │   ├── queues/         # BullMQ workers and queues
│       │   ├── socket/         # Socket.IO handlers (Chat, Presence)
│       │   └── collab/         # Hocuspocus server configuration & hooks
│       └── ...
├── packages/
│   ├── database/               # Prisma schema, migrations, database client
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/index.ts
│   └── shared/                 # Shared TypeScript interfaces, types, Zod schemas
│       └── src/
│           ├── types/          # Roles, FileTree, Execution, WebSocket payloads
│           └── schemas/        # Shared Zod validation schemas
├── docker/                     # Docker Compose files (PostgreSQL, Redis, Judge0, LiveKit)
├── AGENTS.md                   # This instruction file
└── README.md
```

---

## 4. Critical Architecture Rules

### 4.1. Collaboration & Document Synchronization (Yjs)

- **Yjs is the Single Source of Truth**: The active state of an open document is governed by the Yjs document, never by raw string state in React or database row overwrites.
- **No Per-Keystroke REST Sync**: Never synchronize file content to the database via REST endpoints on individual keystrokes. All text mutation flows exclusively through Yjs CRDT updates over WebSockets.
- **Scoped Documents**: Each file corresponds to its own distinct Yjs document identifier formatted as: `workspace:{workspaceId}:file:{fileId}`.
- **Yjs Awareness for Cursors**: Cursor coordinates, line positions, user color, and text selections are communicated through Yjs Awareness (`provider.awareness`), bound to Monaco using `y-monaco`.
- **Reliable Persistence**:
  - Hocuspocus handles incoming Yjs updates.
  - Updates are buffered and persisted to PostgreSQL using debounce strategies and snapshots (e.g., on file save, inactive debounce, or document close).
  - Yjs binary update vectors/snapshots must be stored reliably so document history and state reconstruct losslessly.

### 4.2. Code Execution & Security Isolation (Judge0)

- **Zero Untrusted Execution in Backend**: Never execute user-submitted code directly within the Node.js backend environment.
- **Sandboxed Execution**: All code runs inside the self-hosted Judge0 CE instance with strict isolation:
  - CPU time limits (e.g., 2–5 seconds).
  - Wall-clock time limits (e.g., 10 seconds).
  - Memory limits (e.g., 256MB–512MB).
  - Maximum process/thread restrictions.
  - Restricted network access for user code.
- **Asynchronous Execution Flow**:
  1. Frontend submits an execution request with `language_id`, `source_code`, and optional `stdin`.
  2. Backend validates authentication and workspace edit permissions.
  3. Backend submits submission token to Judge0 (via BullMQ if high-throughput queueing is needed).
  4. Status is polled or streamed back until completion (`Accepted`, `Time Limit Exceeded`, `Compilation Error`, etc.).
  5. Outputs (`stdout`, `stderr`, `compile_output`, `status`, `time`, `memory`) are sent to the client.

### 4.3. Real-Time Communication & Media (Socket.IO & LiveKit)

- **Chat & Room Events**: Socket.IO handles room channels, participant join/leave broadcasts, system notifications, and chat messaging.
- **Audio/Video via LiveKit**:
  - Audio and video media are handled exclusively through LiveKit SFU.
  - The backend issues cryptographically signed LiveKit Room Tokens with designated permissions based on the user's workspace membership role.
  - Clients connect to the LiveKit server using the signed token; raw media never touches the Express backend.

### 4.4. Role-Based Access Control (RBAC)

- Workspaces define 4 hierarchy levels:
  - **Owner**: Full workspace management, deletion, transfer ownership, manage all roles, billing/settings.
  - **Admin**: Invite members, change member roles (except Owner), manage files, trigger code execution.
  - **Editor**: Create/edit/rename/delete files and folders, participate in collaborative editing, execute code, chat, join calls.
  - **Viewer**: Read-only access to files and editor; can view live edits and cursors; cannot modify files, run code, or delete resources.
- **Dual Enforcement**:
  - **REST APIs**: Validated via route middleware (`requireRole('EDITOR')`).
  - **WebSockets / Hocuspocus / Socket.IO / LiveKit**: Validated during the initial handshake and token generation. Unauthorized write attempts on Yjs documents for Viewers must be rejected.

---

## 5. Permanent Development Rules

1. **Follow the Established Monorepo Architecture**: Maintain clear separation between `apps/web`, `apps/server`, and shared packages (`packages/shared`, `packages/database`).
2. **Use TypeScript Throughout the Application**: Enforce strict typing. Do not use `any` unless explicitly required by an untyped 3rd-party library, and wrap it safely.
3. **Never Duplicate Existing Functionality**: Before building a new utility, component, or helper, search the codebase for existing implementations.
4. **Never Rewrite Working Modules Without Explicit Necessity**: Preserve functional, tested modules. Refactor only with clear architectural justification.
5. **Follow Consistent Naming Conventions**:
   - Files and directories: `kebab-case` for general files/utilities; `PascalCase` for React components.
   - Types, Interfaces, Enums: `PascalCase`.
   - Variables, Functions, Methods: `camelCase`.
   - Constants & Environment Variables: `UPPER_SNAKE_CASE`.
   - Database tables and columns: Follow Prisma standards (`camelCase` fields, mapped to `snake_case` if needed).
6. **Keep Components Modular and Reusable**: Adhere to single-responsibility design. Decompose large views into small, focused sub-components.
7. **Separate Business Logic from UI Components**:
   - Extract stateful workflows into custom hooks (`useCollaborativeDoc`, `useTerminal`) or Zustand stores.
   - Extract API and mutation logic into TanStack Query hooks.
   - Keep UI components focused on layout, rendering, and event wiring.
8. **Validate Backend Requests Using Zod**: Every API route and incoming socket payload must validate parameters and request bodies against a shared or controller-level Zod schema.
9. **Enforce Authorization on the Backend**: Never trust frontend client claims. Re-verify user authentication and workspace permissions on every backend endpoint and socket event.
10. **Never Expose Secrets to the Frontend**: Secret keys (Judge0 API keys, database credentials, LiveKit API secret, JWT secrets) must stay on the server. Only prefix public frontend environment variables with `NEXT_PUBLIC_`.
11. **Use Environment Variables for Configuration**: Centralize configuration management with schema validation (e.g., using `dotenv` and Zod for environment validation).
12. **Add Error Handling to Every API Integration**: Wrap external calls (Database, Redis, Judge0, LiveKit) in structured `try/catch` blocks with meaningful HTTP status codes, structured JSON error formats, and log traces.
13. **Write Tests for Important Functionality**:
    - Unit tests for pure utilities, CRDT helpers, and authorization logic.
    - Integration tests for Express API routes and Prisma interactions.
    - E2E tests for Monaco editor loading, collaborative sync, and execution flows.
14. **Update README When Architecture or Configuration Changes**: Keep setup guides, environment variable references, and architectural changes up to date.
15. **Avoid Unnecessary Dependencies**: Evaluate package weight and necessity before adding npm packages. Rely on standard language features and approved stack libraries.
16. **Never Replace Real Backend Functionality with Mock Data**: Implement authentic database queries, real Redis caching, actual Yjs updates, and live Judge0/LiveKit connections. Do not leave fake timers or dummy responses in production paths.
17. **Never Silently Remove Existing Features**: Retain established capabilities when introducing new ones.
18. **Do Not Proceed to Unrelated Features Without Explicit Instruction**: Maintain focused scope for each task. Implement what was requested with high quality and avoid unrelated tangents.

---

## 6. Development Workflow

For every implementation task, adhere to the following 10-step protocol:

1. **Inspect the Existing Repository**: Examine files, directory layout, package configurations, and existing implementations.
2. **Understand the Existing Architecture**: Trace data flows, dependency graphs, and existing abstractions before writing code.
3. **Identify Reusable Components and Services**: Check `packages/shared`, UI component libraries, and existing hooks to reuse battle-tested logic.
4. **Plan the Required Changes**: Structure your strategy, edge cases, schema impacts, and interface designs.
5. **Implement Only the Requested Feature**: Focus strictly on the defined scope and maintain high code quality.
6. **Run TypeScript Checks**: Execute `tsc --noEmit` across all affected packages to confirm zero typing errors.
7. **Run Relevant Tests**: Execute Vitest or Playwright suites relevant to the modified code.
8. **Fix Regressions**: Promptly resolve any linting errors, test failures, or type discrepancies introduced during implementation.
9. **Update Documentation**: Synchronize `README.md`, schema diagrams, or inline comments if the changes affect configuration or architecture.
10. **Report Modified Files and Verification Results**: Conclude every task by clearly summarizing all created/modified files and presenting verification outcomes.

---

## 7. Architectural Conflict Resolution

If a newly requested feature or external instruction directly conflicts with an existing architectural decision or rule documented here:

- **Do not silently make conflicting changes.**
- **Pause and explain the trade-offs, incompatibilities, and alternatives** before altering core structures.
- Await confirmation or explicit architectural direction before proceeding.
