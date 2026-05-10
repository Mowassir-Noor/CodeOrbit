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
- **Stunning 3D landing page** — Interactive Spline-based 3D background with GSAP-animated keycaps
- **Futuristic glassmorphic Profile Page** — Animated GSAP components, statistics, timeline, and BLOB profile image uploads
- **VS Code–style file explorer** — hierarchical folders, inline rename (F2), drag-and-drop move, context menu, file-type icons
- **Recursive folder operations** — create, rename, move, and delete folders with all descendants in one action
- **Live filesystem sync** — every create/rename/move/delete is broadcast to all room members in real-time via `/topic/fs/{roomId}`
- **Multi-language code execution** — Backend sandbox supporting Python, JavaScript, TypeScript, C, C++, Rust, Go, and Java with xterm.js terminal output
- **Room access control** — Users can only access rooms they're members of; shareable join-by-link
- **Closable editor tabs** — with dirty-state indicator and middle-click close
- **JWT + GitHub OAuth2 authentication**
- **Room sharing** — share a UUID room link; users can join and become members

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

### 2. Configuration

Create `src/main/resources/application.properties` (gitignored):

```properties
jwt.secret=${JWT_SECRET:your-secret}
jwt.expiration=${JWT_EXPIRATION:86400000}
server.port=${PORT:8080}
spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/codeorbit}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME:postgres}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:password}
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.security.oauth2.client.registration.google.client-id=${GOOGLE_CLIENT_ID:dummy}
spring.security.oauth2.client.registration.google.client-secret=${GOOGLE_CLIENT_SECRET:dummy}
```

### 3. Backend

```bash
./mvnw spring-boot:run
# → http://localhost:8080
```

### 4. Frontend (dev)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 4. Frontend (production)

```bash
cd frontend
npm run build
# Output injected into src/main/resources/static/dist
# Then Spring Boot serves everything on :8080
```

### 5. Docker (all-in-one)

```bash
docker build -t codeorbit .
docker run -p 8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host:5432/codeorbit \
  -e SPRING_DATASOURCE_USERNAME=user \
  -e SPRING_DATASOURCE_PASSWORD=pass \
  -e JWT_SECRET=your-secret \
  -e GOOGLE_CLIENT_ID=your-google-client-id \
  -e GOOGLE_CLIENT_SECRET=your-google-client-secret \
  codeorbit
```

> **Browser note**: Terminal uses WebContainers API which requires `SharedArrayBuffer`. Use **Chrome**, **Edge**, or **Firefox** (latest). The Spring Boot application sets the required `COOP`/`COEP` headers automatically.

> **Backend requirements** | Python 3, Node.js, GCC, G++, Rust, Go, and Java must be installed on the server for code execution. The provided Dockerfile includes all dependencies.

---

## Architecture

```
Browser (Thymeleaf Shell + React Views)
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
│   ├── controller/     AuthController, RoomController, ProjectFileController, CodeController, ViewController, ProfileApiController
│   ├── dto/            CreateNodeRequest, RenameRequest, MoveRequest, AuthResponse, ExecuteRequest, ExecuteResponse
│   ├── entity/         User, Room, RoomMember, ProjectFile
│   ├── enums/          FileType (FILE|DIRECTORY), AuthProvider
│   ├── model/          CodeMessage, FileSystemEvent
│   ├── repository/     ProjectFileRepository, RoomMemberRepository, RoomRepository
│   ├── service/        CodeExecutionService, ProjectFileService, RoomService
│   └── util/           JwtUtils
│
├── src/main/resources/templates/
│   ├── auth/           login.html, register.html
│   ├── fragments/      layout.html
│   └──                 dashboard.html, room.html, profile.html
│
└── frontend/src/
    ├── components/     Editor, FileTree, TabBar, ContextMenu, TerminalPanel
    ├── hooks/          useFileSystem (FS state), useBackendRunner (execution)
    ├── pages/          Room, Dashboard, Profile, OAuth2Redirect
    └── services/       api.js (Axios + all FS + execution endpoints)
```

---

## Key REST Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/register` | Register |
| GET | `/api/rooms` | List **my** rooms (membership-based) |
| POST | `/api/rooms` | Create a room |
| POST | `/api/rooms/{roomId}/join` | Join a room by link |
| GET | `/api/rooms/{roomId}/access` | Check room access |
| GET | `/api/files/{roomId}` | Get all nodes (member only) |
| POST | `/api/files/{roomId}/nodes` | Create file or folder (member only) |
| PATCH | `/api/files/nodes/{id}/rename` | Rename (member only) |
| PATCH | `/api/files/nodes/{id}/move` | Move to new parent (member only) |
| DELETE | `/api/files/nodes/{id}` | Delete (member only) |
| POST | `/api/execute` | Execute code (multi-language sandbox) |
| GET | `/api/execute/languages` | List supported languages |
| GET/POST | `/api/profile/*` | Get/Update user profile info & image |

> **Room Access Control:** All room endpoints enforce membership. Non-members receive `403 Forbidden`.

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
| Frontend | React 18, Vite 5, Thymeleaf, Tailwind CSS, Alpine.js |
| 3D Graphics | Spline + @splinetool/react-spline |
| Animations | GSAP (GreenSock Animation Platform) |
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
- Environment variable reference
- Docker & cloud deployment guide
- Known constraints

---

## License

MIT
