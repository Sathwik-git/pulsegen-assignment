# PulseGen — AI-Powered Video Management Platform

> A full-stack video management platform with **AI-driven content moderation**, **role-based access control (RBAC)**, **real-time processing updates via WebSockets**, and **multi-tenant organisation support**.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Installation & Setup Guide](#installation--setup-guide)
4. [Environment Variables](#environment-variables)
5. [API Documentation](#api-documentation)
6. [User Manual](#user-manual)
7. [Assumptions & Design Decisions](#assumptions--design-decisions)
8. [Deployment](#deployment)
9. [Project Structure](#project-structure)
10. [License](#license)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  React 19 · React Router · Tailwind CSS · Socket.IO Client      │
└──────────┬──────────────────────────────────┬───────────────────┘
           │  REST (Axios)                    │  WebSocket
           ▼                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                     BACKEND  (Node / Express 5)                  │
│                                                                  │
│  ┌──────────┐  ┌────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │  Auth     │  │  Video     │  │  User Mgmt    │  │ Socket.IO│ │
│  │  Routes   │  │  Routes    │  │  Routes       │  │  Server  │ │
│  └────┬─────┘  └─────┬──────┘  └──────┬────────┘  └────┬─────┘ │
│       │              │                │                 │       │
│  ┌────▼──────────────▼────────────────▼─────────────────▼─────┐ │
│  │              Middleware Layer                               │ │
│  │  JWT Auth · RBAC · Zod Validation · Multer Upload          │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                     │
│  ┌────────────────────────▼───────────────────────────────────┐ │
│  │            Video Processing Pipeline                       │ │
│  │  FFmpeg (metadata, frames, thumbnails, audio extraction)   │ │
│  │  Hugging Face Inference API:                               │ │
│  │    • Falconsai/nsfw_image_detection  (visual analysis)     │ │
│  │    • openai/whisper-large-v3         (speech-to-text)      │ │
│  │  Profanity detection · Sensitivity classification          │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                     │
│  ┌────────────────────────▼───────────────────────────────────┐ │
│  │                   MongoDB (Mongoose ODM)                   │ │
│  │  Users Collection  ·  Videos Collection                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Upload** — Editor/Admin uploads a video file via the React frontend.
2. **Storage** — Multer stores the file on disk; a Video document is created in MongoDB with status `pending`.
3. **Processing Pipeline** (asynchronous, non-blocking):
   - **Metadata extraction** — FFmpeg extracts duration, resolution.
   - **Frame extraction** — Scene-change detection + fixed-interval sampling.
   - **Thumbnail generation** — First-second frame scaled to 320px width.
   - **Visual analysis** — Each frame sent to Falconsai NSFW model via Hugging Face API.
   - **Audio analysis** — Audio extracted as WAV → Whisper transcription → profanity scoring.
   - **Classification** — Weighted scoring algorithm classifies video as `safe` or `flagged`.
4. **Real-time updates** — Socket.IO emits progress events to the uploading user and anyone viewing that video.
5. **Access control** — RBAC middleware enforces role-based visibility; multi-tenant org isolation.

---

## Tech Stack

| Layer        | Technology                                                              |
| ------------ | ----------------------------------------------------------------------- |
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, React Router 7, Vite 7           |
| **Backend**  | Node.js, Express 5, TypeScript, Socket.IO 4                            |
| **Database** | MongoDB with Mongoose 8 ODM                                            |
| **AI / ML**  | Hugging Face Inference API (Falconsai NSFW, Whisper large-v3)           |
| **Media**    | FFmpeg (fluent-ffmpeg) for video processing                             |
| **Auth**     | JWT (jsonwebtoken), bcryptjs password hashing                           |
| **Validation** | Zod schema validation                                                |
| **Deployment** | Docker (backend), Vercel (frontend)                                  |

---

## Installation & Setup Guide

### Prerequisites

| Requirement          | Version  | Notes                                    |
| -------------------- | -------- | ---------------------------------------- |
| **Node.js**          | ≥ 20 LTS | Required for both frontend and backend   |
| **npm**              | ≥ 9      | Comes with Node.js                       |
| **MongoDB**          | ≥ 6.0    | Local install or MongoDB Atlas           |
| **FFmpeg**           | ≥ 5.0    | Must be on system PATH                   |
| **Hugging Face Token** | —      | Free account at https://huggingface.co   |

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/pulsegen.git
cd pulsegen
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/pulsegen

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# Uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE=524288000          # 500 MB in bytes

# AI / Hugging Face
HUGGINGFACE_API_TOKEN=hf_your_token_here

# Processing
MAX_ANALYSIS_FRAMES=10
FRAME_INTERVAL_SECONDS=5

# CORS
CORS_ORIGIN=http://localhost:5173
```

Build and start:

```bash
npm run build
npm start
```

Or for development with rebuild:

```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory (optional — defaults to `/api` with Vite proxy):

```env
VITE_API_URL=http://localhost:5000/api
```

Start the development server:

```bash
npm run dev
```

The app will be available at **http://localhost:5173**.

### 4. Seed an Admin User (Optional)

```bash
cd backend
npm run seed:admin
```

### 5. Docker Deployment (Backend)

```bash
cd backend
docker build -t pulsegen-backend .
docker run -p 5000:5000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/pulsegen \
  -e JWT_SECRET=your-secret \
  -e HUGGINGFACE_API_TOKEN=hf_your_token \
  -e CORS_ORIGIN=http://localhost:5173 \
  pulsegen-backend
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable               | Required | Default                              | Description                              |
| ---------------------- | -------- | ------------------------------------ | ---------------------------------------- |
| `PORT`                 | No       | `5000`                               | HTTP server port                         |
| `NODE_ENV`             | No       | `development`                        | `development` or `production`            |
| `MONGODB_URI`          | Yes      | `mongodb://localhost:27017/talentpulse` | MongoDB connection string             |
| `JWT_SECRET`           | Yes      | `fallback-secret-change-me`         | Secret for signing JWTs                  |
| `JWT_EXPIRES_IN`       | No       | `7d`                                 | Token expiration duration                |
| `MAX_FILE_SIZE`        | No       | `524288000` (500 MB)                 | Max upload size in bytes                 |
| `UPLOAD_DIR`           | No       | `uploads`                            | Directory for uploaded files             |
| `HUGGINGFACE_API_TOKEN`| Yes      | —                                    | Hugging Face API token for AI models     |
| `MAX_ANALYSIS_FRAMES`  | No       | `10`                                 | Max frames for analysis                  |
| `FRAME_INTERVAL_SECONDS`| No     | `5`                                  | Seconds between sampled frames           |
| `CORS_ORIGIN`          | No       | `http://localhost:5173`              | Allowed CORS origin                      |

### Frontend (`frontend/.env`)

| Variable       | Required | Default | Description                |
| -------------- | -------- | ------- | -------------------------- |
| `VITE_API_URL` | No       | `/api`  | Backend API base URL       |

---

## API Documentation

All endpoints are prefixed with `/api`. Responses follow a consistent format:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... }
}
```

Authentication uses **Bearer tokens** in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

---

### Authentication — `/api/auth`

#### `POST /api/auth/register`

Register a new user account.

| Field          | Type   | Required | Validation                    |
| -------------- | ------ | -------- | ----------------------------- |
| `name`         | string | Yes      | Non-empty, trimmed            |
| `email`        | string | Yes      | Valid email format            |
| `password`     | string | Yes      | Min 6 characters              |
| `organisation` | string | No       | Optional org membership       |

**Response** `201 Created`:

```json
{
  "success": true,
  "message": "Account created successfully.",
  "data": {
    "user": { "id": "...", "name": "...", "email": "...", "role": "viewer", "organisation": "..." },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors**: `409` — email already exists.

---

#### `POST /api/auth/login`

Authenticate an existing user.

| Field      | Type   | Required |
| ---------- | ------ | -------- |
| `email`    | string | Yes      |
| `password` | string | Yes      |

**Response** `200 OK`: Same shape as register response.

**Errors**: `401` — invalid credentials · `403` — account deactivated.

---

#### `GET /api/auth/me`

Retrieve the currently authenticated user's profile.

**Auth**: Required (Bearer token).

**Response** `200 OK`:

```json
{
  "success": true,
  "data": { "user": { "id": "...", "name": "...", "email": "...", "role": "...", "organisation": "..." } }
}
```

---

### Videos — `/api/videos`

All video endpoints require authentication.

#### `GET /api/videos`

List videos with filtering, search, and pagination. Visibility is scoped by role and organisation.

| Query Param   | Type   | Default     | Description                              |
| ------------- | ------ | ----------- | ---------------------------------------- |
| `page`        | number | `1`         | Page number                              |
| `limit`       | number | `12`        | Items per page                           |
| `status`      | string | —           | Filter by `pending`, `processing`, `completed`, `failed` |
| `sensitivity` | string | —           | Filter by `safe`, `flagged`, `unprocessed` |
| `category`    | string | —           | Filter by category                       |
| `search`      | string | —           | Case-insensitive title search            |
| `sortBy`      | string | `createdAt` | Sort field                               |
| `sortOrder`   | string | `desc`      | `asc` or `desc`                          |

**Auth**: All authenticated roles.

**Response** `200 OK`:

```json
{
  "success": true,
  "data": {
    "videos": [ ... ],
    "pagination": { "page": 1, "limit": 12, "total": 42, "pages": 4 }
  }
}
```

---

#### `POST /api/videos/upload`

Upload a video file for processing.

**Auth**: Editor, Admin.

**Content-Type**: `multipart/form-data`.

| Field         | Type   | Required | Notes                                     |
| ------------- | ------ | -------- | ----------------------------------------- |
| `video`       | file   | Yes      | Max 500 MB. Supported: mp4, mpeg, mov, avi, webm, mkv |
| `title`       | string | No       | Defaults to original filename             |
| `description` | string | No       | Max 2000 chars                            |
| `tags`        | string | No       | Comma-separated                           |
| `category`    | string | No       | Defaults to `uncategorised`               |
| `visibility`  | string | No       | `private` (default), `organisation`, `public` |

**Response** `201 Created`:

```json
{
  "success": true,
  "message": "Video uploaded successfully. Processing started.",
  "data": { "video": { ... } }
}
```

---

#### `GET /api/videos/:id`

Get full details of a single video.

**Auth**: All roles (access governed by org/visibility rules).

---

#### `GET /api/videos/:id/stream`

Stream the video file with HTTP range request support. Supports `?token=<jwt>` query param for embedded players.

**Auth**: All roles.

---

#### `GET /api/videos/:id/thumbnail`

Serve the auto-generated JPEG thumbnail.

**Auth**: All roles.

---

#### `PUT /api/videos/:id`

Update video metadata (title, description, tags, category, visibility).

**Auth**: Editor (own videos), Admin (any video in org).

---

#### `DELETE /api/videos/:id`

Delete a video and its associated files (video file, thumbnail).

**Auth**: Editor (own videos), Admin (any video in org).

---

#### `POST /api/videos/:id/reprocess`

Re-trigger the AI processing pipeline for a video.

**Auth**: Editor, Admin.

---

### User Management — `/api/users`

All user management endpoints require **Admin** role.

#### `GET /api/users`

List users in the admin's organisation.

| Query Param | Type   | Default | Description        |
| ----------- | ------ | ------- | ------------------ |
| `page`      | number | `1`     | Page number        |
| `limit`     | number | `20`    | Items per page     |
| `role`      | string | —       | Filter by role     |

---

#### `PUT /api/users/:id/role`

Change a user's role.

| Field  | Type   | Required | Values                       |
| ------ | ------ | -------- | ---------------------------- |
| `role` | string | Yes      | `viewer`, `editor`, `admin`  |

**Constraints**: Cannot change own role. User must belong to same organisation.

**Real-time**: Emits `role:updated` Socket.IO event to the affected user.

---

#### `PATCH /api/users/:id/status`

Toggle a user's active/inactive status.

**Real-time**: Emits `status:updated` Socket.IO event to the affected user.

---

### WebSocket Events (Socket.IO)

Connect with authentication:

```javascript
const socket = io("http://localhost:5000", {
  auth: { token: "your-jwt-token" }
});
```

#### Client → Server

| Event               | Payload    | Description                      |
| ------------------- | ---------- | -------------------------------- |
| `subscribe:video`   | `videoId`  | Join a video's progress room     |
| `unsubscribe:video` | `videoId`  | Leave a video's progress room    |

#### Server → Client

| Event            | Payload                                                                 | Description                      |
| ---------------- | ----------------------------------------------------------------------- | -------------------------------- |
| `video:progress` | `{ videoId, progress, status, message }`                                | Processing progress update       |
| `video:complete` | `{ videoId, status, progress, sensitivityClassification, sensitivityScore, sensitivityDetails }` | Processing completed |
| `video:error`    | `{ videoId, error }`                                                    | Processing failed                |
| `role:updated`   | `{ role, name, email, _id }`                                           | User's role was changed by admin |
| `status:updated` | `{ isActive, name, email, _id }`                                       | User's active status toggled     |

---

## User Manual

### Registration & Login

1. Navigate to the application URL.
2. Click **Register** to create a new account (name, email, password, optional organisation).
3. New accounts are assigned the **Viewer** role by default.
4. After registration you are automatically logged in and redirected to the Dashboard.

### Roles & Permissions

| Capability             | Viewer | Editor | Admin |
| ---------------------- | :----: | :----: | :---: |
| View video library     |   ✓    |   ✓    |   ✓   |
| Watch / stream videos  |   ✓    |   ✓    |   ✓   |
| Upload videos          |   ✗    |   ✓    |   ✓   |
| Edit video metadata    |   ✗    |   ✓    |   ✓   |
| Delete videos          |   ✗    |   ✓*   |   ✓   |
| Reprocess videos       |   ✗    |   ✓    |   ✓   |
| Manage users           |   ✗    |   ✗    |   ✓   |
| Change user roles      |   ✗    |   ✗    |   ✓   |
| Activate/deactivate users |   ✗ |   ✗    |   ✓   |

*\* Editors can only delete their own uploads.*

### Uploading a Video

1. Navigate to **Upload** from the sidebar.
2. Drag and drop a video file or click to browse (supported formats: MP4, MPEG, MOV, AVI, WebM, MKV; max 500 MB).
3. Optionally fill in title, description, tags, category, and visibility.
4. Click **Upload**. You'll see a real-time progress tracker as the video is processed.

### Video Processing Pipeline

After upload, videos go through an automated AI pipeline:

| Stage | Progress | What Happens                                              |
| ----- | -------- | --------------------------------------------------------- |
| 1     | 0–10%    | Upload validation (file exists on disk)                   |
| 2     | 10–30%   | Metadata extraction, frame sampling, thumbnail generation |
| 3     | 30–75%   | AI sensitivity analysis (visual NSFW + audio profanity)   |
| 4     | 75–90%   | Content classification (safe / flagged)                   |
| 5     | 90–100%  | Finalisation and cleanup                                  |

Progress is shown in **real-time** via WebSocket events — no need to refresh.

### Sensitivity Classification

Videos are automatically classified as:

- **Safe** — No concerning content detected.
- **Flagged** — Potentially sensitive content detected (visual adult content or profane language).
- **Unprocessed** — Not yet analysed.

The classification uses a weighted scoring algorithm:
- **Visual (Adult/NSFW)**: 60% max frame score + 25% top-5 average + 15% overall average. Flagged if weighted score > 0.4, any frame > 0.7, or ≥ 2 frames > 0.4.
- **Language (Profanity)**: Per-word profanity density × 3, capped at 1.0. Flagged if score > 0.15.

### Video Library

- Browse all accessible videos with search, filter by status/sensitivity/category, and sort options.
- Click a video card to open the player page with full metadata and streaming playback.
- Editors can edit/delete their own videos; Admins can manage all org videos.

### Admin Panel

Admins can access the **Admin** page to:
- View all users in their organisation.
- Change user roles (viewer ↔ editor ↔ admin).
- Activate or deactivate user accounts.
- Role/status changes are reflected in real-time for affected users.

### Multi-Tenant Organisation Support

- Users belong to an **organisation** (set during registration).
- Admins only see and manage users within their own organisation.
- Video visibility is scoped by organisation:
  - **Private** — Only the uploader can see it.
  - **Organisation** — All org members can view.
  - **Public** — Visible to everyone.
- Users without an organisation can only see public videos.

---

## Assumptions & Design Decisions

### Authentication & Security

- **JWT-based stateless auth** was chosen over session-based auth for scalability and simpler horizontal scaling. Tokens expire after 7 days by default.
- **Passwords** are hashed with bcrypt (12 salt rounds) — never stored in plain text.
- The `password` field is excluded from all query results via Mongoose `select: false`.

### Role-Based Access Control (RBAC)

- Three-tier role hierarchy: **Admin > Editor > Viewer**.
- RBAC is enforced on **both** backend (middleware) and frontend (permission guards) for defense-in-depth.
- Frontend RBAC is for UX only — all security enforcement happens server-side.

### Video Processing

- Processing runs **asynchronously** after upload response is sent. The user receives an immediate `201` response and tracks progress via WebSockets.
- **FFmpeg** is used for all media operations (metadata, frame extraction, thumbnails, audio extraction) — it must be installed on the host system.
- **Scene-change detection** is combined with fixed-interval sampling to catch brief inappropriate content that regular sampling might miss.
- Frame analysis is batched (4 concurrent API calls) to balance throughput against Hugging Face rate limits.
- If frame extraction or audio analysis fails for any individual item, the pipeline continues gracefully with partial results rather than failing entirely.

### AI Models

- **Falconsai/nsfw_image_detection** — NSFW image classification model used for visual content analysis.
- **openai/whisper-large-v3** — Speech-to-text model used for audio transcription and subsequent profanity detection.
- Both models are accessed via the **Hugging Face Inference API** (serverless) — no local GPU required.
- A hardcoded profanity word list is used for language scoring after transcription.

### Multi-Tenancy

- Organisation-based data isolation is implemented at the **application layer** (query filters) rather than database-level separation. This simplifies deployment while providing adequate isolation.
- Users without an organisation are treated as independent and can only access public content.

### File Storage

- Videos are stored on the **local filesystem** (`uploads/` directory). For production, a cloud storage solution (S3, GCS) would be recommended.
- Thumbnails and temporary frames are stored in subdirectories under `uploads/`.
- Temporary frame files are cleaned up after processing completes.

### Frontend

- **Vite dev proxy** forwards `/api` requests to `localhost:5000` during development, avoiding CORS issues.
- **Vercel** is configured for SPA hosting with a catch-all rewrite rule for client-side routing.
- **Axios interceptors** handle automatic token injection and 401/403 error handling (auto-redirect to login on expired tokens).

### Database

- **MongoDB** was chosen for its flexible schema, which suits the varied metadata structure of video documents.
- Mongoose virtuals are used for computed fields like `formattedSize` and user-video relationships.

---

## Deployment

### Publicly Accessible Web Application

- **Frontend**: Deployed on [Vercel](https://vercel.com) — configured via `vercel.json` with SPA rewrites.
- **Backend**: Containerised with Docker; deploy to any container platform (AWS ECS, Azure Container Apps, Railway, Render, etc.).

### Deployment Checklist

1. Set all required environment variables (see [Environment Variables](#environment-variables)).
2. Ensure MongoDB is accessible from the backend (use MongoDB Atlas for cloud deployment).
3. Ensure FFmpeg is available in the backend runtime (included in the Docker image).
4. Obtain a Hugging Face API token and set `HUGGINGFACE_API_TOKEN`.
5. Set `CORS_ORIGIN` to the frontend's production URL.
6. Set `VITE_API_URL` in the frontend build to point to the production backend.

### Video Demonstration

> 📹 A video demonstration of the platform's functionality is available at: _[Add video demo link here]_

### GitHub Repository

> 🔗 Complete source code: _[Add GitHub repository link here]_

---

## Project Structure

```
pulsegen/
├── README.md                          # This file
├── backend/
│   ├── Dockerfile                     # Multi-stage Docker build
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts                     # Express app setup (CORS, routes, middleware)
│       ├── server.ts                  # HTTP + Socket.IO server bootstrap
│       ├── socket.ts                  # WebSocket event handlers & emitters
│       ├── config/
│       │   ├── index.ts               # Centralised configuration (env vars, constants)
│       │   └── db.ts                  # MongoDB connection
│       ├── controllers/
│       │   ├── auth.controller.ts     # Register, login, getMe
│       │   ├── user.controller.ts     # List users, update role, toggle status
│       │   └── video.controller.ts    # CRUD + stream + thumbnail + reprocess
│       ├── middleware/
│       │   ├── auth.ts                # JWT verification middleware
│       │   ├── rbac.ts                # Role-based access control middleware
│       │   ├── upload.ts              # Multer file upload configuration
│       │   └── validate.ts            # Zod schema validation middleware
│       ├── models/
│       │   ├── user.ts                # User schema (bcrypt, virtuals)
│       │   └── video.ts               # Video schema (processing, sensitivity)
│       ├── routes/
│       │   ├── auth.routes.ts         # Auth endpoints + Zod schemas
│       │   ├── user.routes.ts         # Admin-only user management
│       │   └── video.routes.ts        # Video CRUD + streaming
│       ├── services/
│       │   └── videoProcessor.ts      # Full AI processing pipeline
│       └── types/
│           └── index.ts               # TypeScript interfaces (IUser, IVideo, JwtPayload)
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts                 # Vite + Tailwind + API proxy
│   ├── vercel.json                    # Vercel SPA rewrite config
│   └── src/
│       ├── App.tsx                    # Route definitions + ProtectedRoute wrapper
│       ├── main.tsx                   # Entry point (AuthProvider, SocketProvider, Router)
│       ├── types.ts                   # Shared TypeScript types
│       ├── components/
│       │   ├── Layout.tsx             # App shell (sidebar, header)
│       │   ├── ProgressTracker.tsx    # Real-time upload progress display
│       │   ├── UploadDropzone.tsx     # Drag-and-drop video upload
│       │   └── VideoCard.tsx          # Video thumbnail card component
│       ├── context/
│       │   ├── AuthContext.tsx        # Auth state management (login, register, logout)
│       │   └── SocketContext.tsx      # Socket.IO connection management
│       ├── pages/
│       │   ├── AdminPage.tsx          # User management (admin only)
│       │   ├── DashboardPage.tsx      # Overview / landing page
│       │   ├── LoginPage.tsx          # Login form
│       │   ├── RegisterPage.tsx       # Registration form
│       │   ├── UnauthorizedPage.tsx   # 403 access denied page
│       │   ├── UploadPage.tsx         # Video upload interface
│       │   ├── VideoLibraryPage.tsx   # Searchable video grid
│       │   └── VideoPlayerPage.tsx    # Video playback + metadata
│       ├── rbac/
│       │   ├── permissions.ts         # Role-permission mapping
│       │   ├── RoleGuard.tsx          # Component-level RBAC wrapper
│       │   └── usePermissions.ts      # RBAC hook (can, isAnyRole)
│       └── services/
│           └── api.ts                 # Axios API client (auth, video, user)
└── uploads/                           # Runtime: uploaded videos, frames, thumbnails
    ├── frames/
    └── thumbnails/
```

---

## License

This project is provided as-is for educational and evaluation purposes.
