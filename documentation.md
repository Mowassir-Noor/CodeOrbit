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
Browser (React IDE)
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
- **Persistence**: Files and folders are stored in PostgreSQL as a parent-child adjacency list.
- **Editor Sync**: Real-time keystrokes broadcast via `/topic/code/{roomId}` to all room members.
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
| Framework | React 18 |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Execution | WebContainer API (StackBlitz) |
| Terminal | xterm.js + FitAddon |
| WebSocket | `@stomp/stompjs` + SockJS-client |
| Drag & Drop | `@dnd-kit/core` |
| Build | Vite 5 |

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
  ├── ProjectFileController.java      # Full filesystem REST API
  └── RoomController.java             # Room create/list/get

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
  ├── User.java                       # User profile and credentials
  ├── Room.java                       # Room metadata (UUID id)
  ├── RoomMember.java                 # Room membership (user-room many-to-many)
  └── ProjectFile.java                # Hierarchical node (file or folder)

enums/
  ├── AuthProvider.java               # LOCAL | GOOGLE
  └── FileType.java                   # FILE | DIRECTORY

model/
  ├── CodeMessage.java                # roomId + filePath + content
  └── FileSystemEvent.java            # Typed FS event (8 event types)

repository/
  ├── ProjectFileRepository.java      # Includes bulk path update + prefix delete
  ├── RoomMemberRepository.java       # Room membership queries
  ├── RoomRepository.java
  └── UserRepository.java

service/
  ├── CodeExecutionService.java       # Multi-language execution sandbox
  ├── CustomUserDetailsService.java
  ├── ProjectFileService.java         # Full FS logic + WS broadcast
  └── RoomService.java

util/
  └── JwtUtils.java
```

### Frontend (`frontend/src/`)

```
components/
  ├── ContextMenu.jsx     # Position-aware right-click menu
  ├── Editor.jsx          # Collaborative Monaco Editor (STOMP)
  ├── FileTree.jsx        # VS Code-style recursive tree explorer
  ├── TabBar.jsx          # Closable editor tabs with dirty state
  └── TerminalPanel.jsx   # WebContainer shell + xterm.js

hooks/
  ├── useBackendRunner.js # Multi-language execution via backend API
  └── useFileSystem.js    # Central FS state, buildTree(), WS subscriber

pages/
  ├── Dashboard.jsx       # Room list, create, join by ID
  ├── Login.jsx
  ├── OAuth2Redirect.jsx  # Handles Google login token redirect
  ├── Register.jsx
  └── Room.jsx            # Full IDE layout (tree + tabs + editor + terminal)

services/
  └── api.js              # Axios client with JWT interceptor + all FS endpoints
```

---

## Authentication

### JWT (Local)
1. `POST /api/auth/register` — create account
2. `POST /api/auth/login` — returns `{ token, username }`
3. Token stored in `localStorage`, attached as `Authorization: Bearer <token>` to every HTTP and WebSocket request.

### OAuth2 (Google)
1. Frontend redirects to `/oauth2/authorization/google`
2. Spring Security handles the exchange
3. Redirects to `/oauth2-redirect?token=<jwt>` — stored in `localStorage`

### WebSocket Auth
JWT is sent in the STOMP `CONNECT` frame headers via `WebSocketAuthInterceptor`.

---

## Real-Time Collaboration

### Editor Sync — `/topic/code/{roomId}`
- **Publish**: `POST /app/code.send` with `{ roomId, filePath, content }`
- **Receive**: All room subscribers receive the full file content and apply it with `pushEditOperations` (preserves cursor, undo history)
- **Debounce**: 350ms client-side before publishing

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

CodeOrbit features a **backend code execution service** that runs code in isolated temporary directories with support for 8 languages.

### Supported Languages

| Language | Executor | File Extensions | Compilation |
|----------|----------|-----------------|-------------|
| Python | `python3` | `.py` | N/A |
| JavaScript | `node` | `.js`, `.mjs` | N/A |
| TypeScript | `npx ts-node` / `tsc` | `.ts`, `.tsx` | Transpiled |
| C | `gcc` | `.c` | Compiled |
| C++ | `g++` | `.cpp`, `.cc`, `.cxx` | Compiled |
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
  id         BIGSERIAL PRIMARY KEY,
  username   VARCHAR NOT NULL UNIQUE,
  email      VARCHAR NOT NULL UNIQUE,
  password   VARCHAR,
  provider   VARCHAR NOT NULL DEFAULT 'LOCAL'
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
```json
{ "roomId": "...", "filePath": "src/index.js", "content": "..." }
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
- Inline `InlineInput` for rename and new node creation
- Native HTML5 drag/drop for move operations
- `ContextMenu` on right-click
- `DeleteModal` confirmation before delete
- Keyboard: `F2` rename, `Delete` delete

### `TabBar.jsx`
- Scrollable tab strip
- Active tab highlighted with blue top border
- Middle-click or `×` button closes tab
- Dirty state dot indicator

### `ContextMenu.jsx`
- Renders at cursor position
- Dismisses on outside click or `Escape`
- Position-clamped to viewport bounds

### `Editor.jsx`
- Monaco Editor with STOMP sync
- Debounced 350ms outgoing publishes
- `pushEditOperations` for cursor-safe remote updates
- `useImperativeHandle` exposes `getValue()` for run engine

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

### 2. Backend
```bash
# From project root
./mvnw spring-boot:run
# Runs on http://localhost:8080
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

> **WebContainer requirement**: Use Chrome, Edge, or Firefox with SharedArrayBuffer enabled.
> The Vite dev server injects the required COOP/COEP headers automatically.

---

## Known Constraints

| Constraint | Detail |
|---|---|
| **Conflict Resolution** | Last-Writer-Wins for editor content. No OT/CRDT. |
| **Container Ephemerality** | `npm install` results in terminal are not persisted to PostgreSQL. |
| **Binary Files** | Text-based source files only. |
| **COOP/COEP Headers** | Required for WebContainers terminal; may conflict with some browser extensions. |
| **Backend Execution** | Requires Python, Node.js, GCC, G++, Rust, Go, and Java installed on server. |
| **Rename Race Condition** | Concurrent renames of the same folder by two users resolve to last write. |
| **Cursor Awareness** | Multi-cursor presence (ghost cursors) not yet implemented. |
