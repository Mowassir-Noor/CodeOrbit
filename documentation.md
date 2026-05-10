# CodeOrbit — Real-Time Collaborative IDE

CodeOrbit is a full-stack, real-time collaborative Integrated Development Environment (IDE). Multiple users can work in the same "Room," manage a full hierarchical filesystem, and execute code directly in their browser using WebAssembly-powered containers.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Authentication](#authentication)
5. [Real-Time Collaboration](#real-time-collaboration)
6. [Filesystem Management](#filesystem-management)
7. [Code Execution (WebContainer)](#code-execution-webcontainer)
8. [Database & Persistence](#database--persistence)
9. [REST API Reference](#rest-api-reference)
10. [WebSocket Event Reference](#websocket-event-reference)
11. [Frontend Components](#frontend-components)
12. [Running Locally](#running-locally)
13. [Known Constraints](#known-constraints)

---

## Architecture Overview

```
Browser (Spring Boot Thymeleaf Shell + React Fragments)
  │
  ├── WebContainer API (WebAssembly) ──► Node.js/Bash in-browser
  │
  ├── HTTP (Axios + JWT) ──────────────► Spring Boot REST API ──► PostgreSQL
  │
  └── WebSocket (STOMP + JWT) ─────────► Spring WebSocket Broker
                                           ├── /topic/code/{roomId}   — editor sync
                                           └── /topic/fs/{roomId}     — filesystem events
```

**Workflow:**
- **Hybrid Rendering**: Thymeleaf manages the global application shell and navigation layout, while React is dynamically mounted inside specific pages (Dashboard, Room) for high interactivity.
- **Persistence**: Files and folders are stored in PostgreSQL as a parent-child adjacency list.
- **Editor Sync**: Yjs CRDT over STOMP WebSocket. Each file has a `Y.Doc` that converges across all clients automatically. Incremental `Yjs` updates are broadcast via `/topic/code/{roomId}`. DB persistence stores both plain text (`content`) and CRDT state (`yjsState`) for new client convergence. Simultaneous typing is fully supported with automatic conflict resolution.
- **FS Sync**: Create/rename/move/delete operations broadcast typed `FileSystemEvent` payloads via `/topic/fs/{roomId}`.
- **Execution**: Code runs via backend execution service (Docker-style sandbox) supporting Python, JavaScript, TypeScript, C, C++, Rust, Go, and Java. Output streams directly to xterm.js terminal.

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Language | Java 21 |
| Framework | Spring Boot 4.0.6 |
| Security | Spring Security 6 + JWT + OAuth2 (Google) |
| WebSocket | Spring WebSocket (STOMP), SockJS |
| Persistence | Spring Data JPA / Hibernate |
| Database | PostgreSQL (primary) / H2 (dev fallback) |
| Execution | Temp-directory sandbox (no Docker required for dev) |
| Build | Maven (mvnw wrapper) |

### Frontend
| Layer | Technology |
|---|---|
| Architecture | Spring Boot Thymeleaf Shell + React Fragments |
| View Engine | Thymeleaf |
| Framework | React 18 |
| Styling | Tailwind CSS |
| Interactivity | Alpine.js (for simple shell interactions) |
| Animations | GSAP (GreenSock Animation Platform) |
| Editor | Monaco Editor (`@monaco-editor/react`) with `editor.setModel()` model cache |
| Collaboration | Yjs CRDT + `y-monaco` binding + `y-protocols` (peer dep)
| Icons | Inline SVG (cross-browser, no emoji fonts) |
| Execution | WebContainer API (StackBlitz) |
| Terminal | xterm.js + FitAddon |
| WebSocket | `@stomp/stompjs` + SockJS-client |
| Drag & Drop | `@dnd-kit/core` |
| Build | Vite 5 (outputs to Spring Boot static resources) |

---

## Project Structure

### Backend (`src/main/java/com/gazi/codeOrbit/`)

```
config/
  ├── SecurityConfig.java             # Auth, CORS (incl. PATCH), OAuth2
  ├── WebSocketConfig.java            # STOMP broker, SockJS endpoint
  └── WebSocketAuthInterceptor.java   # JWT validation for WS CONNECT

controller/
  ├── AuthController.java             # POST /api/auth/login|register
  ├── CodeController.java             # WS /app/code.send → /topic/code/{roomId}
  ├── CodeExecutionController.java    # POST /api/execute
  ├── ProfileApiController.java       # Profile image and stats endpoints
  ├── ProjectFileController.java      # Full filesystem REST API
  ├── RoomController.java             # Room create/list/get
  └── ViewController.java             # Thymeleaf view routing (/login, /register, /dashboard, /room/*, /profile)

dto/
  ├── CreateNodeRequest.java          # name + fileType + parentId
  ├── RenameRequest.java              # newName
  ├── MoveRequest.java                # targetParentId
  ├── AuthResponse.java
  ├── ExecuteRequest.java             # language + code + fileName + stdin + timeout
  ├── ExecuteResponse.java            # success + output + error + exitCode + executionTimeMs
  ├── LoginRequest.java
  └── RegisterRequest.java

entity/
  ├── User.java                       # User profile, credentials, and BLOB image
  ├── Room.java                       # Room metadata (UUID id)
  ├── RoomMember.java                 # Room membership (user-room many-to-many)
  └── ProjectFile.java                # Hierarchical node (file or folder) + yjsState BLOB

enums/
  ├── AuthProvider.java               # LOCAL | GOOGLE | GITHUB (GOOGLE active for OAuth2)
  └── FileType.java                   # FILE | DIRECTORY

model/
  ├── CodeMessage.java                # roomId + filePath + clientId + type + content/changes/yjsState
  └── FileSystemEvent.java            # Typed FS event (8 event types)

repository/
  ├── ProjectFileRepository.java      # Includes bulk path update + prefix delete
  ├── RoomMemberRepository.java       # Room membership queries
  ├── RoomRepository.java
  └── UserRepository.java

service/
  ├── CodeExecutionService.java       # Multi-language execution sandbox
  ├── CustomUserDetailsService.java
  ├── ProfileService.java             # Profile image BLOB storage logic
  ├── ProjectFileService.java         # Full FS logic + WS broadcast
  └── RoomService.java

util/
  └── JwtUtils.java

resources/
  └── templates/
      ├── auth/
      │   ├── login.html              # Spring Boot login view
      │   └── register.html           # Spring Boot register view
      ├── fragments/
      │   └── layout.html             # Global shell layout
      ├── dashboard.html              # React mounting point for Dashboard
      ├── profile.html                # React mounting point for Profile
      └── room.html                   # React mounting point for Room IDE
```

### Frontend (`frontend/src/`)

```
components/
  ├── ContextMenu.jsx     # Position-aware right-click menu
  ├── Editor.jsx          # Yjs CRDT collaborative Monaco Editor
  ├── FileTree.jsx        # VS Code-style recursive tree explorer
  ├── TabBar.jsx          # Closable editor tabs with dirty state
  ├── TerminalPanel.jsx   # WebContainer shell + xterm.js
  └── (landing components are in landing/)

hooks/
  ├── useBackendRunner.js # Multi-language execution via backend API
  └── useFileSystem.js    # Central FS state, buildTree(), WS subscriber

pages/
  ├── Dashboard.jsx       # Room list, create, join by ID (mounted via dashboard.html)
  ├── OAuth2Redirect.jsx  # Handles Google login token redirect
  ├── Profile.jsx         # User profile page (mounted via profile.html)
  └── Room.jsx            # Full IDE layout (mounted via room.html)

landing/
  ├── LandingPage.jsx       # Main landing page composition
  ├── SplineBackground.jsx  # 3D Spline scene renderer
  ├── LandingHeader.jsx     # Fixed navbar for landing
  ├── LandingFooter.jsx     # Footer for landing
  └── sections/
      ├── HeroSection.jsx       # Hero with CTA
      ├── TechStackSection.jsx  # Technology showcase
      ├── FeaturesSection.jsx   # Feature cards
      ├── ArchitectureSection.jsx # System architecture diagram
      └── CTASection.jsx        # Call-to-action footer

services/
  └── api.js              # Axios client with JWT interceptor + all FS endpoints

yjs/
  └── StompProvider.js    # Custom Yjs provider bridging CRDT over STOMP WebSocket
```

---

## Authentication

### JWT (Local)
1. `GET /login` — Serves Thymeleaf template with Alpine.js form.
2. `POST /api/auth/login` — JSON API returns `{ token, username }`. Form script stores in `localStorage` and redirects to `/dashboard`.
3. React components read `localStorage` and attach as `Authorization: Bearer <token>` to every HTTP and WebSocket request.

### OAuth2 (Google)
1. Frontend `/login` or `/register` redirects to `/login` (Thymeleaf — same origin, no hardcoded host)
2. User clicks "Sign in with Google" → `/oauth2/authorization/google`
3. Spring Security handles the OAuth2 exchange with Google
4. On success, redirects to `/oauth2-redirect?token=<jwt>` — React stores token in `localStorage`

> Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars (or `application.properties` defaults).
> Google OAuth callback URI: `https://<your-domain>/login/oauth2/code/google`

### WebSocket Auth
JWT is sent in the STOMP `CONNECT` frame headers via `WebSocketAuthInterceptor`.

---

## Real-Time Collaboration

### Editor Sync — `/topic/code/{roomId}` (Yjs CRDT)

CodeOrbit uses **Yjs CRDT** (Conflict-free Replicated Data Type) for true simultaneous collaborative editing. This means multiple users can type in the same file at the same time, and all changes converge automatically without conflicts.

**Architecture:**
- Each file has one `Y.Doc` per client (cached in `ydocCacheRef`)
- `MonacoBinding` (from `y-monaco`) syncs `Y.Text` ↔ Monaco `ITextModel` automatically
- `StompYjsProvider` bridges Yjs updates over STOMP WebSocket

**Message Types:**

| Type | Direction | Description |
|---|---|---|
| `yjs-update` | Outgoing / Incoming | Incremental CRDT update (`update` field: base64-encoded `Uint8Array`). Broadcast on every local Yjs document change. |
| `yjs-request` | Outgoing | New client requests full state from peers. Sent once on file open. |
| `yjs-offer` | Outgoing / Incoming | Peer responds with full `encodeStateAsUpdate(doc)` (`yjsState` field: base64). Only peers active >2s respond. |
| `yjs-full` | Outgoing | Periodic full state snapshot (every **5s**). Persisted to DB as `yjsState` BLOB. |
| `full` | Outgoing | Legacy plain-text sync. Still used for backward-compat DB persistence. |
| `delta` | — | Legacy Monaco incremental sync (ignored by Yjs clients). |

**New Client Convergence:**
1. Load `yjsState` from DB via `GET /api/files/{roomId}/yjs`
2. If available: `Y.applyUpdate(doc, decodedState)` — instant convergence to canonical state
3. If not available: fall back to plain-text `content` → insert into `Y.Text`
4. Create `MonacoBinding` + `StompYjsProvider`
5. Send `yjs-request` to catch any edits made since last DB snapshot

**Echo Prevention:** `clientId` filtering — messages with `clientId === localClientId` are silently ignored.

**Model Cache:** One Monaco `ITextModel` + one `Y.Doc` per file path. Switching tabs uses `editor.setModel()` without recreation.

### Filesystem Events — `/topic/fs/{roomId}`
All filesystem mutations (create, rename, move, delete) broadcast a `FileSystemEvent` to every room member. The `useFileSystem` hook subscribes and applies each event optimistically to the local node list.

---

## Filesystem Management

CodeOrbit implements a full **VS Code–style filesystem** with:

### Data Model
`ProjectFile` uses an **adjacency list** (`parent_id`) for hierarchical storage:

| Column | Type | Description |
|---|---|---|
| `id` | BIGINT | Primary key |
| `room_id` | VARCHAR | Owning room UUID |
| `file_path` | VARCHAR | Full virtual path (`src/components/Button.jsx`) |
| `name` | VARCHAR | Segment name (`Button.jsx`) |
| `parent_id` | BIGINT | FK to parent folder (null = root) |
| `file_type` | ENUM | `FILE` \| `DIRECTORY` |
| `content` | TEXT | File content (null for directories) |
| `yjs_state` | BYTEA | Yjs CRDT encoded state snapshot for convergence |
| `last_updated` | TIMESTAMP | Auto-updated |

**Indexes**: `idx_pf_room`, `idx_pf_parent`, `idx_pf_path`

### Operations & Cascade Logic
| Operation | Backend Behaviour |
|---|---|
| **Create** | Inserts node, resolves full path from parent chain, broadcasts `FILE_CREATED` / `FOLDER_CREATED` |
| **Rename** | Updates node name + path; bulk-updates all descendant paths via JPQL `LIKE` prefix query; broadcasts `FILE_RENAMED` / `FOLDER_RENAMED` |
| **Move** | Changes `parent_id`, recalculates path, bulk-updates descendant paths; cycle guard prevents moving a folder into itself; broadcasts `FILE_MOVED` / `FOLDER_MOVED` |
| **Delete** | Recursively deletes all descendants by path prefix, then deletes node; broadcasts `FILE_DELETED` / `FOLDER_DELETED` |

### Frontend File Explorer
- Recursive `TreeNode` component rendered from `buildTree(flatNodes)`
- Folders expand/collapse with animated arrows
- **Inline rename**: click `F2` or right-click → Rename; `Enter` confirms, `Escape` cancels
- **Drag & drop**: native HTML5 drag onto any folder to move; dragging to the tree root moves to root
- **Context menu**: right-click any node or empty space for `New File`, `New Folder`, `Rename`, `Delete`, `Copy Path`
- **Keyboard shortcuts**: `F2` rename, `Delete` delete selected file

### Tab Management
- Tabs open on file click, support middle-click close
- On rename: open tab path updates automatically
- On delete: tab closes, editor switches to nearest remaining tab
- Dirty state indicator (dot) planned for unsaved content

### WebContainer Sync
Every FS operation is mirrored to the in-browser WebContainer:
- Create file → `writeFile(path, '')`
- Create folder → `mkdir(path, { recursive: true })`
- Rename → read + write new path + rm old
- Delete → `rm(path, { recursive: true })`

---

## Code Execution (Multi-Language Backend)

CodeOrbit features a **backend code execution service** that runs code in isolated temporary directories with support for 10 languages.

### Supported Languages

| Language | Executor | File Extensions | Compilation |
|----------|----------|-----------------|-------------|
| Python | `python3` | `.py` | N/A |
| JavaScript | `node` | `.js`, `.mjs` | N/A |
| TypeScript | `npx ts-node` / `tsc` | `.ts`, `.tsx` | Transpiled |
| C | `gcc` | `.c` | Compiled |
| C++ | `g++` | `.cpp`, `.cc`, `.cxx` | Compiled |
| Ruby | `ruby` | `.rb` | N/A |
| PHP | `php` | `.php` | N/A |
| Rust | `rustc` | `.rs` | Compiled |
| Go | `go run` | `.go` | Compiled |
| Java | `javac` → `java` | `.java` | Compiled |

### Execution Flow
1. Frontend sends code to `POST /api/execute` via `useBackendRunner` hook
2. Backend creates temp directory (`/tmp/codeorbit_{uuid}`)
3. Writes code to file, executes with appropriate compiler/interpreter
4. Captures stdout/stderr with 30-second timeout
5. Returns output to frontend which writes directly to xterm.js
6. Temp directory cleaned up automatically

### TerminalPanel
- **xterm.js** terminal with direct output writing (bypassing shell)
- **WebContainer** still used for `node` and `npm` commands interactively
- Exposes `term` getter for direct xterm access by runner hook

> **Required browser headers** (configured in `vite.config.js`):
> ```
> Cross-Origin-Opener-Policy: same-origin
> Cross-Origin-Embedder-Policy: require-corp
> ```

---

## Database & Persistence

### PostgreSQL Schema

```sql
-- Users
CREATE TABLE users (
  id                  BIGSERIAL PRIMARY KEY,
  username            VARCHAR NOT NULL UNIQUE,
  email               VARCHAR NOT NULL UNIQUE,
  password            VARCHAR,
  provider            VARCHAR NOT NULL DEFAULT 'LOCAL',
  profile_image       BYTEA,      -- binary image storage
  profile_image_content_type VARCHAR,
  profile_image_file_name    VARCHAR,
  profile_image_updated_at   TIMESTAMP
);

-- Rooms
CREATE TABLE rooms (
  id         VARCHAR PRIMARY KEY,        -- UUID
  name       VARCHAR NOT NULL,
  owner_id   BIGINT  NOT NULL,
  created_at TIMESTAMP
);

-- Room Membership (many-to-many)
CREATE TABLE room_members (
  id         BIGSERIAL PRIMARY KEY,
  room_id    VARCHAR   NOT NULL REFERENCES rooms(id),
  user_id    BIGINT    NOT NULL REFERENCES users(id),
  joined_at  TIMESTAMP,
  UNIQUE (room_id, user_id)
);

CREATE INDEX idx_rm_room ON room_members (room_id);
CREATE INDEX idx_rm_user ON room_members (user_id);

-- Files & Folders (adjacency list)
CREATE TABLE project_files (
  id           BIGSERIAL PRIMARY KEY,
  room_id      VARCHAR   NOT NULL,
  file_path    VARCHAR   NOT NULL,
  name         VARCHAR   NOT NULL,
  parent_id    BIGINT    REFERENCES project_files(id),
  file_type    VARCHAR   NOT NULL DEFAULT 'FILE',
  content      TEXT,
  last_updated TIMESTAMP,
  UNIQUE (room_id, file_path)
);

CREATE INDEX idx_pf_room   ON project_files (room_id);
CREATE INDEX idx_pf_parent ON project_files (parent_id);
CREATE INDEX idx_pf_path   ON project_files (file_path);
```

> Hibernate `ddl-auto` will auto-generate/update this schema on startup.

---

## REST API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET  | `/api/auth/oauth2/success` | OAuth2 token exchange |

### Rooms
| Method | Path | Description |
|---|---|---|
| GET  | `/api/rooms` | List **my** rooms (membership-based) |
| GET  | `/api/rooms/{id}` | Get room by ID (member only) |
| POST | `/api/rooms` | Create room (creator auto-added as member) |
| DELETE | `/api/rooms/{id}` | Delete room (owner only) |
| POST | `/api/rooms/{roomId}/join` | Join a room by link |
| GET | `/api/rooms/{roomId}/access` | Check if user has room access |
| POST | `/api/rooms/{roomId}/members` | Add member (existing members only) |
| DELETE | `/api/rooms/{roomId}/members/{userId}` | Remove member (owner only) |
| GET | `/api/rooms/{roomId}/members` | List room members |

### Profile
| Method | Path | Description |
|---|---|---|
| GET | `/api/profile` | Get current user's profile info |
| GET | `/api/profile/image/{username}` | Get user's profile image (binary) |
| POST | `/api/profile/image` | Upload profile image (multipart form) |
| DELETE | `/api/profile/image` | Delete profile image |
| GET | `/api/profile/stats` | Get user statistics (mocked) |
| GET | `/api/profile/activity` | Get user activity timeline (mocked) |

**Access Control:**
- Users can only access rooms where they are a member (via `room_members` table)
- Room creator is automatically added as a member
- Non-members get `403 Forbidden` when trying to access room resources
- Filesystem and WebSocket endpoints also enforce membership checks

### Filesystem
| Method | Path | Body | Description |
|---|---|---|---|
| GET    | `/api/files/{roomId}` | — | Flat list of all nodes in room |
| POST   | `/api/files/{roomId}` | `text/plain` content | Legacy: save file by `?filePath=` |
| POST   | `/api/files/{roomId}/nodes` | `CreateNodeRequest` | Create file or folder |
| PATCH  | `/api/files/nodes/{id}/rename` | `RenameRequest` | Rename node (cascades children) |
| PATCH  | `/api/files/nodes/{id}/move` | `MoveRequest` | Move node to new parent |
| DELETE | `/api/files/nodes/{id}` | — | Delete node (recursive if folder) |
| DELETE | `/api/files/{roomId}?filePath=` | — | Legacy: delete file by path |
| GET | `/api/files/{roomId}/yjs` | `?filePath=` | Load base64-encoded Yjs CRDT state snapshot |

### Code Execution
| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/execute` | `ExecuteRequest` | Execute code in sandbox |
| GET | `/api/execute/languages` | — | List supported languages |

**ExecuteRequest:**
```json
{
  "language": "python",
  "code": "print('Hello')",
  "fileName": "main.py",
  "stdin": "",
  "timeoutSeconds": 30
}
```

**ExecuteResponse:**
```json
{
  "success": true,
  "output": "Hello\n",
  "error": null,
  "exitCode": 0,
  "executionTimeMs": 15,
  "language": "python"
}
```

---

## WebSocket Event Reference

### Editor Channel — `/topic/code/{roomId}`

**Yjs CRDT Messages:**
```json
// Incremental update
{ "roomId": "...", "filePath": "src/index.js", "clientId": "...", "type": "yjs-update", "update": "base64..." }

// Request full state
{ "roomId": "...", "filePath": "src/index.js", "clientId": "...", "type": "yjs-request" }

// Offer full state
{ "roomId": "...", "filePath": "src/index.js", "clientId": "...", "type": "yjs-offer", "yjsState": "base64..." }

// Periodic full snapshot (persisted to DB)
{ "roomId": "...", "filePath": "src/index.js", "clientId": "...", "type": "yjs-full", "yjsState": "base64..." }
```

**Legacy Messages (backward compat):**
```json
{ "roomId": "...", "filePath": "src/index.js", "clientId": "...", "type": "full", "content": "..." }
```

### Filesystem Channel — `/topic/fs/{roomId}`
```json
{
  "roomId":    "...",
  "eventType": "FILE_RENAMED",
  "fileType":  "FILE",
  "id":        42,
  "oldPath":   "src/app.js",
  "newPath":   "src/main.js",
  "name":      "main.js",
  "parentId":  7,
  "content":   null
}
```

**Event types**: `FILE_CREATED`, `FILE_RENAMED`, `FILE_DELETED`, `FILE_MOVED`, `FOLDER_CREATED`, `FOLDER_RENAMED`, `FOLDER_DELETED`, `FOLDER_MOVED`

---

## Frontend Components

### `useFileSystem.js` (hook)
- Fetches flat node list from `GET /api/files/{roomId}`
- Subscribes to `/topic/fs/{roomId}` via STOMP
- Applies each `FileSystemEvent` to local state (optimistic)
- Exposes `createNode`, `renameNode`, `moveNode`, `deleteNode` mutations
- `buildTree(flatNodes)` converts flat list → recursive tree (folders first, alphabetical)

### `FileTree.jsx`
- Recursive `TreeNode` component (`React.memo`)
- **SVG icons** for all file/folder types (cross-browser, no emoji dependency)
- `FolderIcon` (open/closed states) and `FileIcon` (color-coded by extension) components
- Inline `InlineInput` for rename and new node creation
- Native HTML5 drag/drop for move operations
- `ContextMenu` on right-click with SVG action icons (New File, New Folder, Rename, Copy Path, Delete)
- `DeleteModal` confirmation before delete
- Keyboard: `F2` rename, `Delete` delete

### `TabBar.jsx`
- Scrollable tab strip
- Active tab highlighted with blue top border
- **SVG file icons** with color-coded extension labels
- Middle-click or `×` button closes tab
- Dirty state dot indicator

### `ContextMenu.jsx`
- Renders at cursor position
- Dismisses on outside click or `Escape`
- Position-clamped to viewport bounds

### `Editor.jsx` (Yjs CRDT Collaborative)
- **Wrapped with `React.memo`** — zero re-renders during typing; all mutable state lives in `useRef`
- **Yjs CRDT** (`Y.Doc` per file) with `y-monaco` `MonacoBinding` for automatic two-way sync
- **Custom `StompYjsProvider`** bridges Yjs updates over STOMP WebSocket with base64 encoding
- **Model cache** (`Map<filePath, ITextModel>`) — models reused on tab switches via `editor.setModel()`
- **View state cache** (`Map<filePath, IEditorViewState>`) — scroll and cursor restored on tab switch
- **Yjs doc cache** (`Map<filePath, Y.Doc>`) — one CRDT document per file, survives tab switches
- **New client convergence**: loads `yjsState` from DB → `Y.applyUpdate()` → requests fresh state from peers
- **Echo prevention** via `clientId` filtering on all incoming messages
- **Periodic auto-save**: 5s `yjs-full` snapshots to DB (stored as `yjsState` BLOB)
- **Optimized Monaco options**: `minimap: false`, `overviewRulerLanes: 0`, `occurrencesHighlight: 'off'`, `selectionHighlight: false`, `codeLens: false`, `cursorSmoothCaretAnimation: 'on'`
- `useImperativeHandle` exposes `getValue()`, `getModel()`, `forceSave()`
- **Simultaneous typing fully supported** — Yjs automatically merges concurrent edits without conflicts

### `StompProvider.js` (Yjs Provider)
- Bridges Yjs `Doc` updates over STOMP pub/sub
- `toBase64` / `fromBase64` helpers for `Uint8Array` ↔ JSON transport
- **State request protocol**: new clients send `yjs-request`, established peers (>2s) respond with `yjs-offer`
- **Broadcast methods**: `broadcastUpdate()` for incremental, `broadcastFullState()` for snapshots
- **Message routing**: `onRemoteMessage()` handles `yjs-update`, `yjs-request`, `yjs-offer`, `yjs-full`

### `TerminalPanel.jsx`
- WebContainer boot (singleton across tab) for interactive shell
- `jsh` shell with xterm.js I/O
- Direct xterm write access for backend execution output
- Imperative ref exposes: `runCommand`, `clear`, `writeFile`, `mkdir`, `removeFile`, `renameFile`, `term`

### `useBackendRunner.js` (hook)
- Detects language from file extension
- Sends code to `POST /api/execute`
- Writes output directly to xterm.js (bypassing WebContainer shell)
- Handles execution status and error display

### `SplineBackground.jsx`
- Renders the interactive 3D landing page background using `@splinetool/react-spline`
- **Keycap Reveal Animation**: Finds 3D objects named `"keycap"`, `"keycap-desktop"`, and `"keycap-mobile"` and reveals them using a staggered GSAP bounce-in effect (`y: 200 → 50`) on mount.
- **Dynamic Transforms**: Updates 3D object properties based on window size and device type.

---

## Running Locally

### Prerequisites
- Java 21+
- Node.js 18+
- PostgreSQL 14+

### 1. Database
```bash
psql -U postgres -c "CREATE DATABASE codeorbit;"
```

### 2. Environment

Create `src/main/resources/application.properties` (gitignored) or set env vars:

```properties
jwt.secret=${JWT_SECRET:your-secret-key}
jwt.expiration=${JWT_EXPIRATION:86400000}
server.port=${PORT:8080}
spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/codeorbit}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME:postgres}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:password}
spring.security.oauth2.client.registration.google.client-id=${GOOGLE_CLIENT_ID:dummy}
spring.security.oauth2.client.registration.google.client-secret=${GOOGLE_CLIENT_SECRET:dummy}
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
```

### 3. Backend
```bash
# From project root
./mvnw spring-boot:run
# Runs on http://localhost:8080
```

### 4. Frontend (dev)
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### 4. Frontend (production build)
```bash
cd frontend
npm run build
# Output goes to ../src/main/resources/static/dist
# Then the Spring Boot app serves everything on :8080
```

> **WebContainer requirement**: Use Chrome, Edge, or Firefox with SharedArrayBuffer enabled.
> The Vite dev server injects the required COOP/COEP headers automatically.

---

## Known Constraints

| Constraint | Detail |
|---|---|
| **Conflict Resolution** | **Yjs CRDT** — automatic convergence for simultaneous edits. No Last-Writer-Wins. All concurrent changes merge correctly. |
| **Container Ephemerality** | `npm install` results in terminal are not persisted to PostgreSQL. |
| **Binary Files** | Text-based source files only. |
| **COOP/COEP Headers** | Required for WebContainers terminal; may conflict with some browser extensions. |
| **Backend Execution** | Requires Python, Node.js, GCC, G++, Rust, Go, and Java installed on server. Use the provided Dockerfile for a fully-equipped production image. |
| **Rename Race Condition** | Concurrent renames of the same folder by two users resolve to last write. |
| **Cursor Awareness** | Multi-cursor presence (ghost cursors) not yet implemented. Yjs handles text convergence; cursors are local-only. |

---

## Deployment

### Docker (single container)

```bash
# Build
docker build -t codeorbit .

# Run (with env vars)
docker run -p 8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host:5432/codeorbit \
  -e SPRING_DATASOURCE_USERNAME=user \
  -e SPRING_DATASOURCE_PASSWORD=pass \
  -e JWT_SECRET=your-secret \
  -e GOOGLE_CLIENT_ID=your-google-client-id \
  -e GOOGLE_CLIENT_SECRET=your-google-client-secret \
  codeorbit
```

### Render / Railway / Fly.io

1. Set the environment variables above in the platform dashboard.
2. Point the build to the repo root (the multi-stage `Dockerfile` handles everything).
3. Google OAuth callback URL must be set to `https://<your-domain>/login/oauth2/code/google` in your Google Cloud Console OAuth App settings.
