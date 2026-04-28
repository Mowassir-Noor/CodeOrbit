# CodeOrbit — Real-Time Collaborative IDE

CodeOrbit is a full-stack, real-time collaborative Integrated Development Environment (IDE). Multiple users can work in the same "Room," manage multiple files, and execute code directly in their browser using WebAssembly-powered containers.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Authentication](#authentication)
5. [Real-Time Collaboration](#real-time-collaboration)
6. [Code Execution (WebContainer)](#code-execution-webcontainer)
7. [Database & Persistence](#database--persistence)
8. [Frontend Components](#frontend-components)
9. [Running Locally](#running-locally)
10. [Known Constraints](#known-constraints)

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
                                           └── /topic/code/{roomId}/{filePath}
```

**Workflow:**
- **Persistence**: Files are stored in PostgreSQL via REST API.
- **Sync**: Real-time keystrokes are synchronized across users via WebSockets.
- **Execution**: Code is "mounted" into a local browser-based WebContainer and executed via a virtual terminal (xterm.js).

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Language | Java 21 |
| Framework | Spring Boot 3.4+ |
| Security | Spring Security 6 + JWT + OAuth2 (Google) |
| WebSocket | Spring WebSocket (STOMP), SockJS |
| Persistence | Spring Data JPA (Hibernate 6/7) |
| Database | PostgreSQL (Primary) / H2 (Dev) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Execution | **WebContainer API** (StackBlitz) |
| Terminal | **xterm.js** + FitAddon |
| WebSocket | `@stomp/stompjs` + SockJS-client |

---

## Project Structure

### Backend (`src/main/java/com/gazi/codeOrbit/`)

```
config/
  ├── SecurityConfig.java         # Auth, CORS, and OAuth2 login
  ├── WebSocketConfig.java        # STOMP broker and SockJS config
  └── WebSocketAuthInterceptor.java # JWT validation for WS connections

controller/
  ├── AuthController.java         # Login, Register, OAuth2 Success
  ├── CodeController.java         # WebSocket message broadcasting
  ├── ProjectFileController.java  # CRUD for files within rooms
  └── RoomController.java         # Create/Join rooms (UUID-based)

entity/
  ├── User.java                   # User profile and credentials
  ├── Room.java                   # Room metadata (ID is UUID)
  └── ProjectFile.java            # Multi-file storage per room

service/
  ├── ProjectFileService.java     # Logic for file persistence
  └── RoomService.java            # Room management and sharing logic
```

### Frontend (`frontend/src/`)

```
components/
  ├── Editor.jsx                  # Collaborative Monaco Editor
  ├── FileTree.jsx                # Explorer for room files
  └── TerminalPanel.jsx           # WebContainer shell + xterm.js

pages/
  ├── Dashboard.jsx               # Personal room list & join/create
  ├── Room.jsx                    # IDE Layout (Editor + Terminal + Explorer)
  └── OAuth2Redirect.jsx          # JWT handling for Google Login

services/
  ├── api.js                      # Centralized API calls (Axios)
  └── socket.js                   # WebSocket connection helpers
```

---

## Authentication

### JWT & OAuth2
1. **Local**: `POST /api/auth/login` returns a JWT stored in `localStorage`.
2. **Google**: Redirects to Google Consent → Spring handles exchange → Redirects to frontend with token.
3. **WS Auth**: JWT is passed in the `Authorization` header of the STOMP `CONNECT` frame.

---

## Real-Time Collaboration

CodeOrbit uses **STOMP over WebSockets** to synchronize keystrokes.
- **Topic**: `/topic/code/{roomId}`
- **Deltas**: The editor broadcasts small changes which are applied to remote instances using `pushEditOperations` to preserve cursor position and undo history.
- **Presence**: (Planned) Live user cursors and active file indicators.

---

## Code Execution (WebContainer)

The **TerminalPanel** leverages the **WebContainer API** to run code without a backend execution server.
- **Isolation**: Each browser tab runs its own micro-container.
- **Run Command**: When clicking "Run," the current editor content is written to the WebContainer's virtual file system, and the corresponding command (e.g., `node app.js`) is triggered in the shell.
- **Terminal**: `xterm.js` provides a high-performance terminal UI for the bash process.

---

## Database & Persistence

### PostgreSQL Schema
- **`users`**: `id`, `username`, `email`, `password`, `provider`.
- **`rooms`**: `id` (UUID), `name`, `owner_id`.
- **`project_files`**: `id`, `room_id` (FK), `path`, `content`, `last_updated`.

---

## Frontend Components

### `Editor.jsx`
- Handles file loading from the backend.
- Manages local vs. remote change reconciliation.
- Exposes `getValue()` via `useImperativeHandle` for the execution engine.

### `TerminalPanel.jsx`
- Bootstraps the WebContainer instance.
- Maintains a real-time Fit-responsive terminal.
- Handles file synchronization from the IDE state to the container's FS.

---

## Running Locally

### 1. PostgreSQL Setup
Ensure you have a database named `codeorbit`:
```sql
CREATE DATABASE codeorbit;
```

### 2. Backend
```bash
mvn spring-boot:run
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

> [!IMPORTANT]
> **Browser Isolation Headers**
> WebContainers require `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`. These are configured in `vite.config.js`. Ensure you are using a modern browser (Chrome, Firefox, or Edge).

---

## Known Constraints

| Constraint | Detail |
|---|---|
| **Conflict Resolution** | Uses "Last Writer Wins" (LWW). Not full Operational Transformation (OT). |
| **Container Ephemerality** | Terminal changes (e.g., `npm install`) are not persisted to the database; only files edited in the UI are saved. |
| **Binary Files** | Current focus is on text-based source code. |
| **CORS/COOP** | Strict browser headers required for WebContainers may affect some third-party extensions. |
