
# RTSP Stream Viewer

A full-stack real-time RTSP stream viewer built with React, TypeScript, Go, FFmpeg, WebSockets, and MediaSource Extensions.

The application allows users to add RTSP stream URLs, connect to multiple live streams, view them in a responsive grid, and control playback using Play and Pause controls.

---

## Features

- RTSP stream URL input
- Real-time video streaming in the browser
- Multiple stream support
- Responsive stream grid
- Play and Pause controls
- Remove stream functionality
- Live connection status
- Connecting state
- Error state
- Graceful WebSocket disconnection handling
- FFmpeg-based RTSP processing
- WebSocket-based video delivery
- Browser-side fragmented MP4 playback
- H.264 video transcoding
- MediaSource-based browser playback
- Responsive modern dark UI
- Local RTSP testing with MediaMTX
- Docker/deployment-ready architecture
- Health check endpoint
- Backend stream management
- Graceful FFmpeg process cleanup

---

## Demo

### Live Demo

Add your deployed frontend URL here after deployment:

```text
https://your-frontend-url.vercel.app
```

### Backend

Add your deployed backend URL here after deployment:

```text
https://your-backend-url.onrender.com
```

### GitHub Repository

Add your GitHub repository URL here:

```text
https://github.com/YOUR_USERNAME/rtsp-stream-viewer
```

---

## Application Overview

The application is divided into two main parts:

```text
React + TypeScript Frontend
            |
            | HTTP
            | WebSocket
            v
       Go Backend
            |
            v
          FFmpeg
            |
            v
       RTSP Source
```

For local development, MediaMTX is used as an RTSP server.

The complete local pipeline is:

```text
FFmpeg Test Pattern
        |
        | RTSP
        v
    MediaMTX
        |
        | RTSP
        v
   Go Backend
        |
        | FFmpeg
        v
 Fragmented MP4
        |
        | WebSocket
        v
 React Frontend
        |
        v
 MediaSource API
        |
        v
 HTML Video Element
```

---

# Tech Stack

## Frontend

- React
- TypeScript
- Vite
- CSS
- WebSocket API
- MediaSource Extensions API

## Backend

- Go
- HTTP REST API
- Gorilla WebSocket
- CORS middleware
- FFmpeg process management

## Streaming

- RTSP
- FFmpeg
- H.264
- Fragmented MP4
- WebSockets
- MediaSource Extensions

## Local RTSP Testing

- MediaMTX
- FFmpeg `testsrc`

---

# Project Structure

```text
rtsp-stream-viewer/
│
├── backend/
│   ├── .env
│   ├── .env.example
│   ├── go.mod
│   │
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   │
│   ├── internal/
│   │   ├── config/
│   │   │   └── config.go
│   │   │
│   │   ├── handlers/
│   │   │   ├── health.go
│   │   │   └── stream.go
│   │   │
│   │   ├── middleware/
│   │   │   └── cors.go
│   │   │
│   │   ├── models/
│   │   │   └── stream.go
│   │   │
│   │   ├── services/
│   │   │   ├── ffmpeg_service.go
│   │   │   └── stream_service.go
│   │   │
│   │   └── websocket/
│   │       └── hub.go
│   │
│   └── tests/
│       ├── ffmpeg_test.go
│       └── stream_test.go
│
├── frontend/
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   │
│   └── src/
│       ├── components/
│       │   ├── AddStreamForm.tsx
│       │   ├── ConnectionStatus.tsx
│       │   ├── EmptyState.tsx
│       │   ├── StreamCard.tsx
│       │   ├── StreamControls.tsx
│       │   └── StreamGrid.tsx
│       │
│       ├── hooks/
│       │   └── useStream.ts
│       │
│       ├── services/
│       │   └── api.ts
│       │
│       ├── types/
│       │   └── stream.ts
│       │
│       ├── utils/
│       │   └── stream.ts
│       │
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       └── vite-env.d.ts
│
├── mediamtx/
│   └── mediamtx.yml
│
├── test-streams/
│   └── README.md
│
├── .gitignore
├── LICENSE
└── README.md
```

---

# How It Works

## 1. User enters an RTSP URL

The frontend provides an input such as:

```text
rtsp://127.0.0.1:8554/camera1
```

The frontend sends the URL to the Go backend.

```http
POST /api/streams
```

Request:

```json
{
  "url": "rtsp://127.0.0.1:8554/camera1"
}
```

---

## 2. Go backend validates the RTSP URL

The backend verifies that the URL uses:

```text
rtsp://
```

or:

```text
rtsps://
```

It also validates that the URL contains a valid host.

---

## 3. Backend starts FFmpeg

For every stream, the Go backend creates an FFmpeg process.

Conceptually:

```text
Go
 |
 +-- FFmpeg process
       |
       +-- RTSP input
       |
       +-- H.264 processing
       |
       +-- Fragmented MP4 output
       |
       +-- stdout
```

FFmpeg writes the processed video to stdout instead of creating a temporary video file.

This allows the backend to stream the video continuously.

---

## 4. WebSocket delivers video data

The Go backend exposes a WebSocket endpoint:

```text
/api/streams/{streamId}/ws
```

The frontend opens a WebSocket connection for every stream.

Video bytes produced by FFmpeg are delivered through that WebSocket.

---

## 5. Browser receives fragmented MP4

The frontend receives binary video data through the WebSocket.

The stream is divided into MP4 boxes such as:

```text
ftyp
moov
moof
mdat
moof
mdat
...
```

The frontend processes these fragments and provides them to the browser's MediaSource API.

---

## 6. MediaSource provides browser playback

The frontend creates a MediaSource instance:

```text
WebSocket
    |
    v
MP4 fragments
    |
    v
MediaSource
    |
    v
SourceBuffer
    |
    v
HTMLVideoElement
```

This allows the browser to play the live stream without requiring a local video file.

---

# Playback Controls

## Play

When the user clicks:

```text
▶ Play
```

the frontend requests playback from the video element.

The application waits for playable buffered data when necessary and then starts playback.

---

## Pause

When the user clicks:

```text
⏸ Pause
```

the current video playback is paused.

The WebSocket stream can remain connected while playback is paused.

The application does not automatically start playback again.

---

## Play Again

After pausing, clicking Play again resumes the stream from the available live buffer.

---

# Backend API

## Health Check

```http
GET /api/health
```

Example:

```text
http://localhost:8080/api/health
```

Used to verify that the backend is running.

---

## Create Stream

```http
POST /api/streams
```

Request:

```json
{
  "url": "rtsp://127.0.0.1:8554/camera1"
}
```

Example response:

```json
{
  "id": "stream-b25131c6b7988d61",
  "status": "connecting",
  "websocket": "/api/streams/stream-b25131c6b7988d61/ws"
}
```

---

## List Streams

```http
GET /api/streams
```

Example:

```json
{
  "streams": []
}
```

---

## Get Stream

```http
GET /api/streams/{streamId}
```

Returns information about a specific stream.

---

## Delete Stream

```http
DELETE /api/streams/{streamId}
```

Stops the associated FFmpeg process and removes the stream.

---

## WebSocket

```text
WS /api/streams/{streamId}/ws
```

Used to transfer the processed video stream from the Go backend to the React frontend.

---

# Environment Variables

## Backend

Create:

```text
backend/.env
```

Example:

```env
PORT=8080
FRONTEND_URL=http://localhost:5173
FFMPEG_PATH=ffmpeg
```

### Variables

| Variable | Description | Example |
|---|---|---|
| `PORT` | Backend HTTP port | `8080` |
| `FRONTEND_URL` | Allowed frontend origin | `http://localhost:5173` |
| `FFMPEG_PATH` | FFmpeg executable path | `ffmpeg` |

---

# Frontend Environment Variables

Create:

```text
frontend/.env
```

Example:

```env
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
```

### Variables

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend HTTP URL | `http://localhost:8080` |
| `VITE_WS_URL` | Backend WebSocket URL | `ws://localhost:8080` |

For HTTPS deployment, use:

```text
https://your-backend-domain
```

and:

```text
wss://your-backend-domain
```

for WebSockets.

---

# Requirements

Before running the application, install:

- Node.js
- npm
- Go
- FFmpeg
- MediaMTX for local RTSP testing

Verify Node:

```bash
node --version
```

Verify npm:

```bash
npm --version
```

Verify Go:

```bash
go version
```

Verify FFmpeg:

```bash
ffmpeg -version
```

---

# Local Development

## Step 1 — Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/rtsp-stream-viewer.git
```

```bash
cd rtsp-stream-viewer
```

---

# Step 2 — Start MediaMTX

Go to the MediaMTX directory:

```powershell
cd mediamtx
```

Start MediaMTX:

```powershell
.\mediamtx.exe
```

MediaMTX should start the RTSP server on:

```text
rtsp://127.0.0.1:8554
```

Keep this terminal running.

---

# Step 3 — Create a Test RTSP Stream

Open another terminal.

Run:

```powershell
ffmpeg -re -f lavfi -i "testsrc=size=1280x720:rate=30" -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -f rtsp rtsp://127.0.0.1:8554/camera1
```

This creates a synthetic 1280x720 test video and publishes it to:

```text
rtsp://127.0.0.1:8554/camera1
```

Keep this terminal running.

You should see:

```text
Output #0, rtsp, to 'rtsp://127.0.0.1:8554/camera1'
```

and continuously increasing frames:

```text
frame=...
```

---

# Step 4 — Start the Go Backend

Open another terminal:

```powershell
cd backend
```

Install dependencies:

```powershell
go mod tidy
```

Start the server:

```powershell
go run ./cmd/server
```

Expected output:

```text
RTSP Stream Viewer backend running on http://localhost:8080
Health endpoint: http://localhost:8080/api/health
```

---

# Step 5 — Start the Frontend

Open another terminal:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

Start Vite:

```powershell
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

# Step 6 — Add the RTSP Stream

Open:

```text
http://localhost:5173
```

Enter:

```text
rtsp://127.0.0.1:8554/camera1
```

Click:

```text
Add Stream
```

The application should connect to the stream.

Once the stream becomes live, click:

```text
Play
```

The test pattern should appear in the video player.

---

# Testing the Playback

## Play Test

1. Add an RTSP stream.
2. Wait for the stream to become Live.
3. Click Play.
4. Confirm that video appears.
5. Confirm that the Play button becomes disabled while playing.

---

## Pause Test

1. Start the video.
2. Click Pause.
3. Confirm that playback stops.
4. Wait several seconds.
5. Confirm that playback does not automatically restart.

---

## Resume Test

1. Pause the stream.
2. Click Play.
3. Confirm that playback resumes.

---

## Remove Test

1. Add a stream.
2. Click Remove.
3. Confirm that the stream card disappears.
4. Confirm that the FFmpeg process is stopped.

---

# Testing the Backend

Run:

```powershell
cd backend
go test ./...
```

The backend tests cover the stream and FFmpeg-related functionality implemented in the project.

---

# Testing the Frontend Build

Run:

```powershell
cd frontend
npm run build
```

The production build is generated in:

```text
frontend/dist
```

---

# Multiple Streams

The frontend supports multiple stream cards.

Each stream has its own:

- Stream ID
- RTSP URL
- WebSocket connection
- FFmpeg process
- Playback state
- Connection status
- Play/Pause controls
- Remove action

Conceptually:

```text
Stream 1
RTSP
  ↓
FFmpeg
  ↓
WebSocket
  ↓
Video 1


Stream 2
RTSP
  ↓
FFmpeg
  ↓
WebSocket
  ↓
Video 2


Stream 3
RTSP
  ↓
FFmpeg
  ↓
WebSocket
  ↓
Video 3
```

This allows multiple streams to be displayed in the responsive grid.

---

# Error Handling

The application handles several connection states.

## Connecting

Displayed while:

- The backend is starting FFmpeg
- The WebSocket is connecting
- The browser is initializing the video pipeline

---

## Live

Displayed when the stream has been initialized and video data is available.

---

## Paused

Displayed when the user manually pauses playback.

---

## Error

Displayed when:

- WebSocket connection fails
- FFmpeg fails
- Browser video processing fails
- Invalid stream data is received

---

## Disconnected

Displayed when the WebSocket connection closes unexpectedly.

---

# Graceful Cleanup

When a stream is removed, the backend:

1. Finds the associated FFmpeg process.
2. Cancels the process context.
3. Closes the FFmpeg output pipe.
4. Removes the process from the active process map.
5. Closes associated WebSocket clients.

The frontend also cleans up:

- WebSocket connections
- MediaSource
- SourceBuffer
- Object URLs
- Playback state
- Pending playback timers

This prevents stale connections and unnecessary resource usage.

---

# Local Testing Architecture

The local test environment uses a synthetic video source.

```text
FFmpeg testsrc
      |
      | RTSP
      v
MediaMTX :8554
      |
      | RTSP
      v
Go Backend
      |
      | FFmpeg
      v
Fragmented MP4
      |
      | WebSocket
      v
React
      |
      v
MediaSource
      |
      v
Browser
```

This allows the application to be tested without requiring a physical IP camera.

---

# Using a Real RTSP Camera

A real camera can be used instead of the MediaMTX test stream.

For example:

```text
rtsp://username:password@camera-ip:554/stream
```

The exact RTSP URL depends on the camera manufacturer and configuration.

The important requirement is that the Go backend must be able to reach the RTSP source over the network.

---

# Deployment

The application consists of two deployable parts:

```text
Frontend
   |
   v
Vercel / Static Hosting

Backend
   |
   v
Render / Railway / VM
   |
   v
FFmpeg
   |
   v
RTSP Camera
```

---

# Frontend Deployment

The frontend can be deployed to Vercel or another static hosting platform.

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Set the production environment variables:

```env
VITE_API_URL=https://your-backend-domain
VITE_WS_URL=wss://your-backend-domain
```

---

# Backend Deployment

The Go backend requires:

- Go runtime
- FFmpeg
- WebSocket support
- Network access to the RTSP source

Example production environment:

```env
PORT=8080
FRONTEND_URL=https://your-frontend-domain
FFMPEG_PATH=ffmpeg
```

The backend should listen on the port provided by the hosting platform.

---

# Important Deployment Consideration

A local RTSP URL such as:

```text
rtsp://127.0.0.1:8554/camera1
```

works only on the local machine where MediaMTX is running.

After deployment, this URL does not refer to your local computer.

For a deployed application, the RTSP source must be reachable from the deployed backend.

For example:

```text
RTSP Camera
     |
     | Internet / Private Network
     v
Deployed Go Backend
     |
     v
Frontend
```

Therefore, the local MediaMTX test stream is intended for development and demonstration on the local machine.

---

# Production Architecture

A production deployment can look like:

```text
                    ┌──────────────────────┐
                    │   React Frontend     │
                    │      Vercel          │
                    └──────────┬───────────┘
                               │
                         HTTP / WebSocket
                               │
                               ▼
                    ┌──────────────────────┐
                    │     Go Backend       │
                    │ Render / Railway / VM │
                    └──────────┬───────────┘
                               │
                            FFmpeg
                               │
                               ▼
                    ┌──────────────────────┐
                    │     RTSP Camera      │
                    └──────────────────────┘
```

---

# Security Considerations

For production deployment, additional security should be added.

Recommended improvements include:

- RTSP credential protection
- HTTPS
- Secure WebSockets
- Authentication
- Authorization
- Rate limiting
- Stream ownership
- Input validation
- Restricted CORS
- FFmpeg process limits
- Maximum concurrent streams
- Connection timeouts
- Resource monitoring

RTSP credentials should never be committed to Git.

Use environment variables or a secure secrets manager instead.

---

# Performance Considerations

Each active stream can require:

- One FFmpeg process
- CPU for H.264 encoding
- Memory for buffering
- One WebSocket connection
- Browser-side video decoding

For multiple simultaneous streams, server resources should be monitored.

Potential future optimizations include:

- Hardware-accelerated FFmpeg encoding
- Stream passthrough when browser-compatible
- Connection pooling
- Worker-based stream management
- Maximum stream limits
- Adaptive bitrate streaming
- Dedicated media servers
- WebRTC for lower latency

---

# Why FFmpeg Is Used

Browsers generally cannot directly play arbitrary RTSP URLs through a standard HTML `<video>` element.

The backend therefore uses FFmpeg to:

```text
RTSP
 ↓
Decode
 ↓
Encode / package
 ↓
Browser-compatible fragmented MP4
```

The browser then consumes the processed stream through WebSockets and MediaSource.

---

# Why WebSockets Are Used

WebSockets provide a persistent bidirectional connection between the Go backend and browser.

Instead of repeatedly requesting small pieces of video:

```text
HTTP request
HTTP response
HTTP request
HTTP response
...
```

the browser maintains one connection:

```text
Browser
   ⇅
WebSocket
   ⇅
Go Backend
```

Video bytes can continuously flow through the connection.

---

# Why MediaSource Is Used

The browser cannot directly assign an RTSP URL to a normal video element and expect Chrome to decode it.

MediaSource allows JavaScript to feed supported media segments into the browser's media pipeline.

The flow is:

```text
WebSocket
   ↓
MP4 fragments
   ↓
MediaSource
   ↓
SourceBuffer
   ↓
HTMLVideoElement
```

---

# Design Decisions

## React

React was selected for:

- Component-based UI
- Stream card isolation
- State management
- Easy responsive UI development

## TypeScript

TypeScript provides:

- Strong typing
- Safer component interfaces
- Stream model definitions
- Better development-time error detection

## Go

Go was selected for the backend because it provides:

- Lightweight HTTP servers
- Efficient concurrency
- Easy process management
- Strong WebSocket support
- Good performance for streaming workloads

## FFmpeg

FFmpeg provides:

- RTSP input support
- H.264 encoding
- Media format conversion
- Reliable media processing

## WebSockets

WebSockets provide continuous real-time delivery between the backend and frontend.

---

# API Flow

The complete API flow is:

```text
1. User enters RTSP URL
            |
            v
2. POST /api/streams
            |
            v
3. Go validates URL
            |
            v
4. FFmpeg starts
            |
            v
5. Stream ID returned
            |
            v
6. Frontend opens WebSocket
            |
            v
7. FFmpeg writes video data
            |
            v
8. Go sends binary WebSocket messages
            |
            v
9. Browser receives MP4 fragments
            |
            v
10. MediaSource buffers fragments
            |
            v
11. User clicks Play
            |
            v
12. Video playback starts
```

---

# Project Goals

The project was designed to satisfy the following requirements:

- [x] React frontend
- [x] TypeScript
- [x] RTSP URL input
- [x] Live stream display
- [x] Multiple stream support
- [x] Play control
- [x] Pause control
- [x] Responsive interface
- [x] Go backend
- [x] FFmpeg integration
- [x] WebSocket video delivery
- [x] Connection status
- [x] Graceful stream errors
- [x] Stream removal
- [x] Local RTSP testing
- [x] MediaMTX integration
- [x] Production build configuration
- [ ] Production deployment
- [ ] Public live RTSP camera integration

---

# Known Limitations

The current implementation is intended as a coding assessment and demonstration project.

Important limitations include:

1. Local RTSP URLs are not accessible from a remote deployment.
2. Every active stream requires backend media-processing resources.
3. FFmpeg transcoding can be CPU-intensive.
4. Production deployments should add authentication and authorization.
5. Production deployments should use secure WebSockets.
6. A real deployment requires an RTSP source accessible from the backend server.

---

# Future Improvements

Potential improvements include:

### WebRTC

Replace the current browser playback pipeline with WebRTC for lower latency.

### Authentication

Add user authentication and stream ownership.

### Stream Persistence

Store stream configurations in a database.

### Stream Health Monitoring

Track:

- FPS
- bitrate
- connection uptime
- FFmpeg status
- dropped frames
- latency

### Automatic Reconnection

Automatically restart failed FFmpeg processes and reconnect the WebSocket.

### Hardware Encoding

Use GPU acceleration when available.

### Stream Recording

Allow users to record selected streams.

### Screenshots

Allow users to capture frames from active streams.

### Stream Metadata

Display:

- Resolution
- FPS
- Codec
- Bitrate
- Connection duration

### Resource Management

Implement maximum concurrent streams and backend resource limits.

---

# Troubleshooting

## Stream stays at Connecting

Check that:

1. MediaMTX is running.
2. The RTSP publisher is running.
3. The RTSP URL is correct.
4. FFmpeg is installed.
5. The Go backend is running.
6. The WebSocket endpoint is reachable.

For local testing, verify:

```text
rtsp://127.0.0.1:8554/camera1
```

---

## MediaMTX returns 404

A 404 usually means that the requested RTSP path does not currently exist.

Make sure the publisher is running:

```powershell
ffmpeg -re -f lavfi -i "testsrc=size=1280x720:rate=30" -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -f rtsp rtsp://127.0.0.1:8554/camera1
```

---

## FFmpeg cannot connect to RTSP

Verify the RTSP source independently:

```powershell
ffmpeg -rtsp_transport tcp -i "rtsp://127.0.0.1:8554/camera1" -t 5 -f null NUL
```

If FFmpeg can read the stream successfully, the RTSP source is available.

---

## Frontend cannot connect to backend

Check:

```text
VITE_API_URL
VITE_WS_URL
```

For local development:

```env
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
```

---

## Production WebSocket connection fails

If the frontend uses HTTPS, the WebSocket URL should normally use:

```text
wss://
```

instead of:

```text
ws://
```

---

# Development Commands

## Frontend

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build production application:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

---

## Backend

Download Go dependencies:

```bash
go mod tidy
```

Run backend:

```bash
go run ./cmd/server
```

Run tests:

```bash
go test ./...
```

---

# Example Local Setup

Run the following components in separate terminals.

### Terminal 1 — MediaMTX

```powershell
cd mediamtx
.\mediamtx.exe
```

### Terminal 2 — RTSP Publisher

```powershell
ffmpeg -re -f lavfi -i "testsrc=size=1280x720:rate=30" -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -f rtsp rtsp://127.0.0.1:8554/camera1
```

### Terminal 3 — Backend

```powershell
cd backend
go run ./cmd/server
```

### Terminal 4 — Frontend

```powershell
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

Use:

```text
rtsp://127.0.0.1:8554/camera1
```

---

# Assessment Highlights

This project demonstrates experience with:

- Full-stack application development
- React and TypeScript
- Go backend development
- REST API design
- WebSocket communication
- FFmpeg process integration
- RTSP streaming
- Real-time media processing
- Browser MediaSource APIs
- Concurrent stream management
- Error handling
- Responsive UI development
- Local media infrastructure
- Production-oriented project structure

---

# Author

**Nilesh Pulate**

Full Stack & AI/ML Developer

GitHub:

```text
https://github.com/N8758
```

Portfolio:

```text
https://portfolio-nileshpulate.netlify.app/
```

