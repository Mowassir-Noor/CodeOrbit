# CodeOrbit

> **Real-time collaborative browser IDE** — write, share, and run code with your team, right in the browser.

![Java](https://img.shields.io/badge/Java-21-orange?style=flat-square&logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.0.6-brightgreen?style=flat-square&logo=springboot)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue?style=flat-square&logo=postgresql)
![WebContainers](https://img.shields.io/badge/WebContainers-StackBlitz-purple?style=flat-square)

---

## Features

- **Real-time collaboration** — Monaco Editor synced keystroke-by-keystroke over WebSockets (STOMP)
- **VS Code–style file explorer** — hierarchical folders, inline rename (F2), drag-and-drop move, context menu, file-type icons
- **Recursive folder operations** — create, rename, move, and delete folders with all descendants in one action
- **Live filesystem sync** — every create/rename/move/delete is broadcast to all room members in real-time via `/topic/fs/{roomId}`
- **Multi-language code execution** — Backend sandbox supporting Python, JavaScript, TypeScript, C, C++, Rust, Go, and Java with xterm.js terminal output
- **Closable editor tabs** — with dirty-state indicator and middle-click close
- **JWT + Google OAuth2 authentication**
- **Room sharing** — share a UUID room link with teammates

---

## Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Java | 21+ |
| Node.js | 18+ |
| PostgreSQL | 14+ |
| Maven | bundled (`mvnw`) |

### 1. Database

```bash
psql -U postgres -c "CREATE DATABASE codeorbit;"
```

### 2. Backend

```bash
./mvnw spring-boot:run
# → http://localhost:8080
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

> **Browser note**: Terminal uses WebContainers API which requires `SharedArrayBuffer`. Use **Chrome**, **Edge**, or **Firefox** (latest). The Vite dev server sets the required `COOP`/`COEP` headers automatically.

> **Backend requirements** | Python 3, Node.js, GCC, G++, Rust, Go, and Java must be installed on the server for code execution.

---

## Architecture

```
Browser (React IDE)
  │
  ├── WebContainer API ──► in-browser Node.js runtime
  │
  ├── HTTP + JWT ─────────► Spring Boot REST API ──► PostgreSQL
  │
  └── STOMP/SockJS ───────► Spring WebSocket Broker
                              ├── /topic/code/{roomId}  (editor sync)
                              └── /topic/fs/{roomId}    (filesystem events)
```

---

## Project Layout

```
codeOrbit/
├── src/main/java/com/gazi/codeOrbit/
│   ├── config/         SecurityConfig, WebSocketConfig, JwtFilter
│   ├── controller/     AuthController, RoomController, ProjectFileController, CodeController, CodeExecutionController
│   ├── dto/            CreateNodeRequest, RenameRequest, MoveRequest, AuthResponse, ExecuteRequest, ExecuteResponse
│   ├── entity/         User, Room, ProjectFile
│   ├── enums/          FileType (FILE|DIRECTORY), AuthProvider
│   ├── model/          CodeMessage, FileSystemEvent
│   ├── repository/     ProjectFileRepository (bulk path updates, prefix delete)
│   ├── service/        CodeExecutionService, ProjectFileService, RoomService
│   └── util/           JwtUtils
│
└── frontend/src/
    ├── components/     Editor, FileTree, TabBar, ContextMenu, TerminalPanel
    ├── hooks/          useFileSystem (FS state), useBackendRunner (execution)
    ├── pages/          Room, Dashboard, Login, Register, OAuth2Redirect
    └── services/       api.js (Axios + all FS + execution endpoints)
```

---

## Key REST Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/register` | Register |
| GET | `/api/rooms` | List your rooms |
| POST | `/api/rooms` | Create a room |
| GET | `/api/files/{roomId}` | Get all nodes (flat list) |
| POST | `/api/files/{roomId}/nodes` | Create file or folder |
| PATCH | `/api/files/nodes/{id}/rename` | Rename (cascades children) |
| PATCH | `/api/files/nodes/{id}/move` | Move to new parent |
| DELETE | `/api/files/nodes/{id}` | Delete (recursive for folders) |
| POST | `/api/execute` | Execute code (multi-language sandbox) |
| GET | `/api/execute/languages` | List supported languages |

---

## WebSocket Events

Subscribe to `/topic/fs/{roomId}` to receive filesystem events:

```json
{
  "eventType": "FOLDER_RENAMED",
  "fileType":  "DIRECTORY",
  "id":        12,
  "oldPath":   "src/utils",
  "newPath":   "src/helpers",
  "name":      "helpers",
  "parentId":  3
}
```

Event types: `FILE_CREATED` · `FILE_RENAMED` · `FILE_DELETED` · `FILE_MOVED` · `FOLDER_CREATED` · `FOLDER_RENAMED` · `FOLDER_DELETED` · `FOLDER_MOVED`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend language | Java 21 |
| Backend framework | Spring Boot 4.0.6 |
| Auth | Spring Security 6, JWT (jjwt), OAuth2 (Google) |
| WebSocket | Spring STOMP, SockJS |
| ORM | Spring Data JPA / Hibernate |
| Database | PostgreSQL |
| Frontend | React 18, Vite 5 |
| Editor | Monaco Editor |
| Terminal | xterm.js + FitAddon |
| Execution | WebContainer API |
| WS client | @stomp/stompjs + sockjs-client |

---

## Documentation

See [`documentation.md`](./documentation.md) for full details including:
- Complete REST API & WebSocket reference
- Database schema (adjacency list FS model)
- Filesystem cascade logic (rename, move, delete)
- Frontend component architecture
- Known constraints

---

## License

MIT
