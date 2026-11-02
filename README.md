# CodeSync — Collaborative Browser-Based IDE

> **Collaborative coding, together.**

CodeSync is a production-grade, browser-based collaborative Integrated Development Environment (IDE) enabling multiple developers to concurrently edit files, run programs across multiple languages, observe live cursors and presence, and collaborate in real-time.

---

## 1. Project Overview

CodeSync delivers a rich remote development experience directly in the browser:

- **Monaco Editor Integration**: First-class editing experience powered by the same engine as Visual Studio Code.
- **Multi-Language Support**: Execution capabilities for **Python**, **C++**, **JavaScript**, and **Java**.
- **Real-Time Collaborative Editing**: Conflict-free concurrent editing powered by Conflict-Free Replicated Data Types (CRDTs via **Yjs**).
- **User Presence & Live Cursors**: Live visual awareness of active peers, text selections, and cursor trajectories.
- **Workspace Access & RBAC**: Fine-grained workspace roles (**Owner**, **Admin**, **Editor**, **Viewer**).
- **Sandboxed Remote Execution**: Safe, isolated code compilation and execution backed by self-hosted **Judge0 CE**.
- **Integrated Stdin & Output Panels**: Interactive execution panels with custom input streaming, output display, and error diagnostics.
- **Real-Time Chat & Communications**: Integrated workspace chat (Socket.IO) and low-latency audio/video conferencing (LiveKit).

---

## 2. Technology Stack

### Frontend

- **Framework**: Next.js (App Router, React 19)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS with custom design system variables
- **Components**: shadcn/ui & Radix UI primitives
- **Icons**: Lucide React
- **Code Editor**: Monaco Editor (`@monaco-editor/react`)
- **State Management**: Zustand & TanStack Query (v5)

### Backend

- **Runtime**: Node.js
- **Framework**: Express.js REST API
- **Language**: TypeScript (Strict Mode)
- **ORM & Data Modeling**: Prisma ORM
- **Input Validation**: Zod

### Collaboration Engine

- **CRDT Core**: Yjs
- **Collaboration Server**: Hocuspocus (WebSocket server for Yjs)
- **Editor Binding**: y-monaco

### Infrastructure & Services

- **Database**: PostgreSQL 16
- **Cache & Broker**: Redis 7
- **Job Queues**: BullMQ
- **Code Execution Sandbox**: Judge0 CE
- **Media / Audio / Video**: LiveKit
- **Containerization**: Docker & Docker Compose

### Development Tooling

- **Package Manager**: pnpm workspaces
- **Type Checking**: TypeScript 5.7+
- **Code Quality**: ESLint 9 (Flat Config) & Prettier

---

## 3. Architecture Overview

CodeSync adopts a **modular monolith** monorepo architecture:

```
┌────────────────────────────────────────────────────────┐
│                   Next.js Web Client                   │
│        (Editor, File Tree, Terminal, Chat, Video)      │
└──────────────┬─────────────────────────┬───────────────┘
               │ (REST APIs)             │ (WebSockets)
               ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────┐
│     Express REST API         │  │ Hocuspocus Server    │
│  (Auth, Workspaces, Files)   │  │   (Yjs CRDT Sync)    │
└──────────────┬───────────────┘  └──────────┬───────────┘
               │                             │
               ├──────────────┬──────────────┤
               ▼              ▼              ▼
        ┌────────────┐ ┌─────────────┐ ┌─────────────┐
        │ PostgreSQL │ │ Redis Cache │ │  Judge0 CE  │
        │  (Prisma)  │ │  & Queues   │ │  (Sandbox)  │
        └────────────┘ └─────────────┘ └─────────────┘
```

- **Document State**: Yjs serves as the single source of truth for active documents.
- **REST vs WebSockets**: Keystrokes are synchronized exclusively via Yjs WebSockets to Hocuspocus, not through frequent REST mutations.
- **Sandboxed Execution**: Untrusted user code never executes inside the Node.js backend; it is delegated to isolated Judge0 sandbox containers.

---

## 4. Monorepo Folder Structure

```text
CodeSync/
├── apps/
│   ├── web/                    # Next.js frontend application (port 3000)
│   │   ├── app/                # App Router layouts and pages
│   │   ├── components/         # UI components (shadcn/ui, icons)
│   │   ├── hooks/              # Reusable React hooks
│   │   ├── lib/                # Utilities and helpers (cn)
│   │   ├── next.config.ts      # Next.js build configuration
│   │   ├── tailwind.config.ts  # Tailwind CSS configuration
│   │   └── package.json
│   │
│   ├── api/                    # Express.js REST API (port 4000)
│   │   ├── src/
│   │   │   ├── config/         # Environment, Redis, and app config
│   │   │   ├── controllers/    # Route controllers
│   │   │   ├── middleware/     # Error handlers, loggers, auth
│   │   │   ├── routes/         # Centralized API routes (/api/health)
│   │   │   ├── services/       # Core business logic
│   │   │   ├── app.ts          # Express application factory
│   │   │   └── server.ts       # Server entry point
│   │   └── package.json
│   │
│   └── collaboration/          # Hocuspocus / Yjs WebSocket server (port 1234)
│       ├── src/
│       │   ├── config/         # Server environment configuration
│       │   ├── server.ts       # Hocuspocus server factory
│       │   └── index.ts        # Collaboration entry point
│       └── package.json
│
├── packages/
│   ├── shared/                 # Shared types, constants, schemas (@codesync/shared)
│   │   ├── src/
│   │   │   ├── types/          # API, error, and domain interfaces
│   │   │   ├── constants/      # App constants, supported languages, roles
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── database/               # Prisma client and schema (@codesync/database)
│   │   ├── prisma/
│   │   │   └── schema.prisma   # PostgreSQL database schema
│   │   ├── src/
│   │   │   └── index.ts        # Prisma client singleton export
│   │   └── package.json
│   │
│   └── config/                 # Shared configuration packages
│       ├── eslint/             # Shared ESLint configuration
│       ├── typescript/         # Shared tsconfig bases (base, node, nextjs)
│       └── prettier/           # Shared Prettier rules
│
├── infrastructure/
│   └── docker/
│       └── docker-compose.yml  # PostgreSQL & Redis container definitions
│
├── .env.example                # Example environment variables
├── .gitignore                  # Git ignore rules
├── .prettierrc                 # Prettier configuration pointer
├── eslint.config.mjs           # Root ESLint configuration
├── package.json                # Root package.json scripts and dependencies
├── pnpm-workspace.yaml         # pnpm workspace definition
├── tsconfig.json               # Root TypeScript configuration
├── AGENTS.md                   # Permanent AI agent development guidelines
└── README.md                   # Project documentation
```

---

## 5. Prerequisites

Before setting up CodeSync, ensure you have installed:

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **pnpm**: `v9.x` or `v10.x` (`npm install -g pnpm`)
- **Docker & Docker Compose**: (Docker Desktop on Windows/macOS or Docker Engine on Linux)
- **Git**: Installed and configured

---

## 6. Installation Instructions

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Vrxt47/CodeSync.git
   cd CodeSync
   ```

2. **Install all monorepo dependencies:**
   ```bash
   pnpm install
   ```

---

## 7. Environment Variable Setup

Copy the example environment configuration into `.env`:

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS Terminal:**

```bash
cp .env.example .env
```

Key environment variables:

| Variable                 | Default Value                                                          | Description                  |
| ------------------------ | ---------------------------------------------------------------------- | ---------------------------- |
| `PORT` / `API_PORT`      | `4000`                                                                 | Port for Express REST API    |
| `NEXT_PUBLIC_APP_URL`    | `http://localhost:3000`                                                | Frontend web URL             |
| `NEXT_PUBLIC_API_URL`    | `http://localhost:4000`                                                | REST API URL                 |
| `NEXT_PUBLIC_COLLAB_URL` | `ws://localhost:1234`                                                  | Collaboration server URL     |
| `COLLAB_PORT`            | `1234`                                                                 | Port for Hocuspocus server   |
| `DATABASE_URL`           | `postgresql://postgres:postgres@localhost:5432/codesync?schema=public` | PostgreSQL connection string |
| `REDIS_URL`              | `redis://localhost:6379`                                               | Redis connection URL         |

---

## 8. Docker Compose Instructions

Start the persistent services (PostgreSQL 16 and Redis 7):

```bash
# Start PostgreSQL & Redis in background
pnpm infra:up

# View logs from infrastructure containers
pnpm infra:logs

# Stop infrastructure containers
pnpm infra:down
```

Direct Docker commands (if preferred):

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
docker compose -f infrastructure/docker/docker-compose.yml down
```

---

## 9. Database Architecture & Setup Instructions

CodeSync uses **PostgreSQL 16** with **Prisma ORM** as the source of truth for persistence, relational integrity, and schema migrations.

### 9.1. Database Models Overview

The database consists of nine core models with strict referential integrity:

| Model                | Table                | Purpose                                                                          | Referential Rules                                                                                                                                      |
| -------------------- | -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **User**             | `users`              | Registered users with email normalization and hashed credentials.                | Owns workspaces (Restrict on delete).                                                                                                                  |
| **Workspace**        | `workspaces`         | Shared collaborative programming environment.                                    | Cascades to members, files, invitations, messages, executions, activity logs.                                                                          |
| **WorkspaceMember**  | `workspace_members`  | User membership in workspace with `WorkspaceRole` (`OWNER`, `EDITOR`, `VIEWER`). | Unique per `[workspaceId, userId]`. Cascades on workspace or user deletion.                                                                            |
| **File**             | `files`              | Hierarchical files and folders (`FileType`: `FILE`, `FOLDER`).                   | Self-referencing composite FK prevents cross-workspace parenting. Partial unique indexes prevent duplicate names within folders and at workspace root. |
| **Invitation**       | `invitations`        | Secure workspace invite links with hashed tokens and expiration dates.           | Unique `tokenHash`. Cascades on workspace deletion.                                                                                                    |
| **Message**          | `messages`           | Workspace room chat messages with chronological retrieval index.                 | Sender foreign key (Restrict). Cascades on workspace deletion.                                                                                         |
| **Execution**        | `executions`         | Code execution audit trail with status, timing, stdout, stderr.                  | Composite FK `[workspaceId, fileId]` ensures file-workspace consistency. Cascades on workspace deletion.                                               |
| **ActivityLog**      | `activity_logs`      | Audit trail with JSONB metadata and nullable `userId` for system events.         | SetNull on user deletion. Cascades on workspace deletion.                                                                                              |
| **DocumentSnapshot** | `document_snapshots` | Versioned document snapshots with `[documentId, version]` compound uniqueness.   | Cascades on referenced file deletion.                                                                                                                  |

### 9.2. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    User ||--o{ Workspace : "owns"
    User ||--o{ WorkspaceMember : "belongs to"
    User ||--o{ Message : "sends"
    User ||--o{ Execution : "initiates"
    User ||--o{ ActivityLog : "performs"

    Workspace ||--o{ WorkspaceMember : "has members"
    Workspace ||--o{ File : "contains files"
    Workspace ||--o{ Invitation : "issues invites"
    Workspace ||--o{ Message : "contains chat"
    Workspace ||--o{ Execution : "records runs"
    Workspace ||--o{ ActivityLog : "tracks events"

    File ||--o{ File : "parent-child hierarchy"
    File ||--o{ Execution : "executes"
    File ||--o{ DocumentSnapshot : "snapshots"
```

### 9.3. Database Setup Commands

Once PostgreSQL is running via Docker Compose (`pnpm infra:up`):

1. **Apply Migrations to PostgreSQL:**

   ```bash
   pnpm db:migrate
   # or for production deployments:
   pnpm db:deploy
   ```

2. **Generate the Prisma Client:**

   ```bash
   pnpm db:generate
   ```

3. **Seed the Database with Idempotent Development Data:**

   ```bash
   pnpm db:seed
   ```

   _Creates a test user (`developer@codesync.dev`), demo workspace, owner membership, and sample folder/file hierarchy._

4. **Verify Database Integrity via Automated Tests:**

   ```bash
   pnpm test:db
   ```

5. **Open Prisma Studio (Interactive Web GUI):**
   ```bash
   pnpm db:studio
   # or from root or packages/database:
   pnpm studio
   ```

---

## 10. How to Start the Frontend

To run only the Next.js web application:

```bash
pnpm dev:web
# or
pnpm --filter @codesync/web dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 11. Backend Architecture & API

The backend is built with Express.js, TypeScript, Prisma ORM, and Zod in `apps/api`. It follows a feature-modular architecture:

- `src/config/`: Centralized Zod-validated environment config (`env.ts`), singleton Prisma connection manager (`database.ts`), and Redis client (`redis.ts`).
- `src/middleware/`: Centralized error handler (`error.middleware.ts`), 404 handler (`not-found.middleware.ts`), reusable Zod validation middleware (`validate.middleware.ts`), and request logger (`requestLogger.ts`).
- `src/modules/`: Feature-scoped domain types and Zod schemas:
  - `users/`: Registration, login, profile validation, and safe public types.
  - `workspaces/`: Workspace creation, updates, and member RBAC schemas.
  - `files/`: Hierarchical file/folder creation, path separation validation.
  - `invitations/`: Hashed token verification and future expiration checks.
  - `messages/`: Chronological chat message schemas.
  - `executions/`: Code execution input/result schemas.
  - `activities/`: Workspace activity logging schemas.
  - `snapshots/`: Document version snapshot schemas.
- `src/utils/`: Custom operational error class (`AppError.ts`).
- `src/app.ts`: Express application factory configuring Helmet, CORS, body parsers, routes, and error pipelines.
- `src/server.ts`: Bootstrap process connecting to PostgreSQL with startup connectivity verification, HTTP server initialization, and graceful shutdown handlers (`SIGTERM`, `SIGINT`).

To run only the Express REST API:

```bash
pnpm dev:api
# or
pnpm --filter @codesync/api dev
```

The API starts at [http://localhost:4000](http://localhost:4000).  
Verify connectivity:

```bash
curl http://localhost:4000/api/health
```

Expected response:

```json
{
  "success": true,
  "status": "success",
  "message": "CodeSync API is healthy",
  "data": {
    "status": "healthy",
    "database": "connected",
    "timestamp": "2026-11-01T..."
  },
  "timestamp": "2026-11-01T..."
}
```

---

## 12. How to Start the Collaboration Server

To run only the Hocuspocus CRDT server:

```bash
pnpm dev:collab
# or
pnpm --filter @codesync/collaboration dev
```

The collaboration WebSocket server listens on `ws://localhost:1234`.

---

## 13. How to Run the Entire Project

Start the frontend, API, and collaboration server concurrently with a single command:

```bash
pnpm dev
```

This concurrently launches:

- 🔵 **Web App**: [http://localhost:3000](http://localhost:3000)
- 🟢 **REST API**: [http://localhost:4000](http://localhost:4000)
- 🟣 **Collaboration Server**: `ws://localhost:1234`

---

## 14. Authentication System (Chunk 4)

CodeSync features a production-grade dual-token authentication system designed with maximum security guarantees:

### Token Architecture

- **Access Tokens**: Short-lived (15 minutes) signed JSON Web Tokens (`JWT_ACCESS_SECRET`). Stored **strictly in frontend client memory** (`apiClient.ts` / `AuthProvider`) and never stored in `localStorage` or `sessionStorage` to eliminate Cross-Site Scripting (XSS) token exfiltration.
- **Refresh Tokens**: Long-lived (7 days) cryptographically random tokens (`crypto.randomBytes(40)`). Stored exclusively in secure, browser-managed `HttpOnly`, `SameSite=Lax`, `Path=/api/auth` cookies.
- **Database Hashing**: Refresh tokens are stored in the PostgreSQL database using deterministic **SHA-256 hashes** (`tokenHash`) inside the `Session` model. Plaintext refresh tokens are never persisted.
- **Atomic Refresh Token Rotation**: Refresh token claims are performed via PostgreSQL conditional updates (`revokedAt: null, expiresAt: { gt: now }`) and successor creation within a single Prisma transaction (`prisma.$transaction`). Exactly one request can claim a token, and failures roll back revocation cleanly.
- **Session Family Tracking & Concurrency Grace Window**: Each login initiates an isolated session family (`familyId`). Successor sessions inherit the family lineage. Concurrent requests within the grace window (`REFRESH_TOKEN_GRACE_WINDOW_MS = 15s`) are rejected with `409 CONCURRENT_REFRESH` without invalidating the winning successor. Genuine replay attacks outside the grace window invalidate only the compromised session family, leaving independent sessions on other devices fully active.

### API Endpoints

| Method | Endpoint             | Access        | Description                                                 |
| ------ | -------------------- | ------------- | ----------------------------------------------------------- |
| `POST` | `/api/auth/register` | Public        | Validates input with Zod, hashes password, issues tokens    |
| `POST` | `/api/auth/login`    | Public        | Authenticates email/password, issues tokens & cookie        |
| `POST` | `/api/auth/refresh`  | Cookie Auth   | Rotates refresh token, detects reuse, issues new JWT        |
| `POST` | `/api/auth/logout`   | Authenticated | Revokes session in PostgreSQL, clears HttpOnly cookie       |
| `GET`  | `/api/auth/me`       | Bearer JWT    | Returns current authenticated user (excluding passwordHash) |

### Frontend Authentication & Protected Routes

- **`/register`**: Dedicated registration page with client-side validation, error handling, and auto-redirect.
- **`/login`**: Sign-in page with dark IDE theme matching Visual Studio Code aesthetics.
- **`/dashboard`**: Protected user dashboard displaying profile, session architecture details, and sign-out controls.
- **`apiClient.ts`**: Transparent fetch wrapper attaching in-memory tokens, handling credentials, and intercepting 401s to perform queued, deduplicated token refreshes.
- **`AuthProvider`**: React context provider restoring sessions on initial page load via silent cookie refresh.

---

## 15. Workspace Management System (Chunk 5)

CodeSync provides a robust, collaborative workspace management architecture with fine-grained access control, tenant isolation, activity logging, and responsive frontend dashboard interfaces:

### Core Architecture & Capabilities

- **Transactional Workspace Creation**: Creating a workspace atomically creates the `Workspace` entity, assigns the creator as `OWNER` in `WorkspaceMember`, and records a `WORKSPACE_CREATED` event in `ActivityLog` within a single PostgreSQL transaction (`prisma.$transaction`).
- **Workspace Tenant Isolation**: Workspace listings (`GET /api/workspaces`) strictly filter by the authenticated user's memberships (`members: { some: { userId } }`). Users cannot view or query workspaces they do not belong to.
- **Role-Based Access Control (RBAC)**:
  - **OWNER**: Full management authority. Can rename workspace, delete workspace (cascades dependent records), invite members, and manage roles.
  - **EDITOR**: Can view, edit code, execute code, and participate in collaboration. Cannot rename or delete the workspace.
  - **VIEWER**: Read-only access to files and editor; live awareness observer. Cannot modify files, run code, rename, or delete the workspace.
- **Detail Retrieval & Access Tracking**: Querying `GET /api/workspaces/:workspaceId` verifies membership (returning `403 WORKSPACE_ACCESS_DENIED` for unauthorized users) and automatically updates `lastAccessedAt = new Date()` for recency sorting.
- **Efficient N+1 Query Elimination**: Member counts are fetched in a single aggregated query via Prisma's `_count: { select: { members: true } }`, and the current user's role is retrieved via scoped member selection.
- **Audit Logging**: Workspace creation (`WORKSPACE_CREATED`) and updates (`WORKSPACE_UPDATED`) are automatically logged to `ActivityLog` with metadata tracking old and new names.

### Workspace API Endpoints

| Method   | Endpoint                       | Access Role   | Description                                                                      |
| -------- | ------------------------------ | ------------- | -------------------------------------------------------------------------------- |
| `POST`   | `/api/workspaces`              | Authenticated | Creates a new workspace, assigns creator as OWNER, logs `WORKSPACE_CREATED`      |
| `GET`    | `/api/workspaces`              | Authenticated | Lists workspaces where user is a member; supports `?search=` filter and counts   |
| `GET`    | `/api/workspaces/:workspaceId` | Member        | Retrieves details, verifies membership (403 for non-members), updates recency    |
| `PATCH`  | `/api/workspaces/:workspaceId` | OWNER Only    | Renames workspace, validates name, logs `WORKSPACE_UPDATED` (403 for non-owners) |
| `DELETE` | `/api/workspaces/:workspaceId` | OWNER Only    | Deletes workspace and cascades all dependent members, files, and activity logs   |

### Frontend Workspace Dashboard & IDE Routing

- **`/dashboard`**: Complete workspace management dashboard:
  - **Header**: CodeSync branding, profile badge, "+ Create Workspace" modal trigger, and Sign Out.
  - **Search Bar**: Real-time filtering by workspace name with instant results and empty-state messaging.
  - **Recent Workspaces**: Visual grid of up to 4 most recently accessed/updated workspaces.
  - **All Workspaces**: Complete responsive grid showing role badges (`OWNER`, `EDITOR`, `VIEWER`), member counts, relative update/access timestamps, and contextual settings menus.
  - **Create Workspace Dialog**: Modal dialog with input validation, error handling, and autofocus.
  - **Rename Workspace Dialog**: Pre-populated modal dialog allowing owners to update workspace names.
  - **Delete Workspace Dialog**: High-friction confirmation modal requiring exact workspace name input to prevent accidental deletions.
- **`/workspace/:workspaceId`**: Dedicated IDE route that verifies user access, loads workspace metadata, updates access recency, and renders the collaborative IDE interface.

---

## 16. Workspace File Explorer & Virtual Filesystem (Chunk 6)

CodeSync features a database-backed, workspace-scoped virtual filesystem supporting complete file and folder CRUD, nested directory trees, move operations, and role-based access control without touching host filesystem disks:

### Core Architecture & Capabilities

- **Database-Backed Virtual Filesystem**: All files and folders are persisted in PostgreSQL via the `File` model, distinguished by `type` (`FILE` or `FOLDER`).
- **Hierarchical Self-Referencing Tree**: Folders contain files and child folders using a composite foreign key `[workspaceId, parentId]` referencing `[workspaceId, id]` with `ON DELETE CASCADE`. Root-level items have `parentId = null`.
- **Case-Insensitive Sibling Uniqueness**: PostgreSQL partial functional unique indexes (`lower(name)`) guarantee that duplicate sibling names cannot be created at the workspace root or inside any folder, regardless of casing.
- **Recursive Deletion**: Deleting a folder atomically cascades in PostgreSQL to all nested descendants, preventing orphaned records while leaving unrelated sibling items intact.
- **Move & Circular Nesting Prevention**: Moving folders employs an ancestor traversal algorithm ensuring a folder can never be moved into itself or into any of its own descendants.
- **Identity Preservation**: Renaming and moving operations preserve the original UUIDs, content, and descendant relationships.
- **Cross-Workspace Isolation & RBAC**: Every file and folder operation resolves workspace ownership from the database and enforces that the user holds an active membership with write permissions (`OWNER` or `EDITOR`). `VIEWER` roles are restricted to read-only access.
- **Frontend Explorer UI**: Real-time VS Code-style sidebar explorer with custom icons for all major languages, open/closed folder states, inline creation inputs, right-click context menus, drag-and-drop movement, delete confirmation modals, and empty states.

### Virtual Filesystem API Endpoints

| Method   | Endpoint                               | Access Role    | Description                                                                    |
| -------- | -------------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `GET`    | `/api/workspaces/:workspaceId/files`   | Member         | Retrieves the complete hierarchical directory tree (folders first, sorted A-Z) |
| `POST`   | `/api/workspaces/:workspaceId/files`   | Editor / Owner | Creates a new file with initial empty content in the specified parent folder   |
| `POST`   | `/api/workspaces/:workspaceId/folders` | Editor / Owner | Creates a new directory folder in the specified parent folder                  |
| `PATCH`  | `/api/files/:fileId`                   | Editor / Owner | Renames a file or folder; validates uniqueness and preserves identity          |
| `DELETE` | `/api/files/:fileId`                   | Editor / Owner | Deletes a file or recursively deletes a folder and all descendants             |
| `POST`   | `/api/files/:fileId/move`              | Editor / Owner | Moves a file or folder; validates parent, sibling names, and circular nesting  |

---

## 17. Available Development Scripts

| Command                 | Purpose                                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`              | Starts all applications (Web, API, Collab) concurrently                         |
| `pnpm dev:web`          | Starts Next.js frontend in development mode (:3000)                             |
| `pnpm dev:api`          | Starts Express API in watch mode (:4000)                                        |
| `pnpm dev:collab`       | Starts Hocuspocus server in watch mode (:1234)                                  |
| `pnpm build`            | Builds shared packages, API, Collab, and Web for production                     |
| `pnpm lint`             | Runs ESLint across all packages and apps                                        |
| `pnpm typecheck`        | Runs `tsc --noEmit` across all workspace packages                               |
| `pnpm format`           | Formats the codebase using Prettier                                             |
| `pnpm format:check`     | Checks formatting compliance with Prettier                                      |
| `pnpm test`             | Runs database integrity, backend, auth, concurrency, workspaces, and file tests |
| `pnpm test:db`          | Executes comprehensive 9-model database integrity tests                         |
| `pnpm test:backend`     | Executes Express API, health, error, and validation tests                       |
| `pnpm test:auth`        | Executes Chunk 4 authentication and session security tests                      |
| `pnpm test:concurrency` | Executes atomic rotation, concurrency & rollback tests                          |
| `pnpm test:workspaces`  | Executes Chunk 5 workspace creation, isolation, & RBAC tests                    |
| `pnpm test:files`       | Executes Chunk 6 virtual filesystem CRUD, recursion, & security tests           |
| `pnpm studio`           | Opens Prisma Studio web interface (root or database package)                    |
| `pnpm prisma <cmd>`     | Runs any Prisma CLI command with root `.env` loaded                             |
| `pnpm db:generate`      | Generates Prisma client types from `schema.prisma`                              |
| `pnpm db:migrate`       | Runs Prisma migrations in development                                           |
| `pnpm db:deploy`        | Applies pending Prisma migrations in production                                 |
| `pnpm db:seed`          | Seeds database with test user, workspace, and files                             |
| `pnpm db:push`          | Synchronizes database schema with PostgreSQL                                    |
| `pnpm db:studio`        | Opens Prisma Studio web interface                                               |
| `pnpm infra:up`         | Boots PostgreSQL and Redis containers                                           |
| `pnpm infra:down`       | Shuts down PostgreSQL and Redis containers                                      |
| `pnpm infra:logs`       | Streams container output logs                                                   |

---

## 17. Validation Endpoints

| Service  | Target                                     | Expected Result                                                |
| -------- | ------------------------------------------ | -------------------------------------------------------------- |
| Frontend | `http://localhost:3000`                    | CodeSync IDE interface                                         |
| Frontend | `http://localhost:3000/register`           | Dedicated user registration page                               |
| Frontend | `http://localhost:3000/login`              | User authentication page                                       |
| Frontend | `http://localhost:3000/dashboard`          | Protected workspace management & user dashboard                |
| Frontend | `http://localhost:3000/workspace/:id`      | Dynamic collaborative workspace IDE                            |
| Backend  | `http://localhost:4000/api/health`         | `{"status":"success","message":"CodeSync API is running",...}` |
| Backend  | `http://localhost:4000/api/auth/me`        | Current authenticated user payload (Bearer token required)     |
| Backend  | `http://localhost:4000/api/workspaces`     | Workspace creation & listing endpoints (Bearer token required) |
| Backend  | `http://localhost:4000/api/workspaces/:id` | Workspace details, rename, delete (RBAC enforced)              |
| Collab   | `ws://localhost:1234`                      | Accepts WebSocket connections                                  |

---

## 18. Development Guidelines

All developers and AI agents must adhere to the permanent architectural rules defined in [AGENTS.md](AGENTS.md).
