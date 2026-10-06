import type { StreamStatus } from "../types/stream";

const WS_URL = (
  import.meta.env.VITE_WS_URL || "ws://localhost:8080"
).replace(/\/$/, "");

export function getWebSocketUrl(streamId: string): string {
  return `${WS_URL}/api/streams/${encodeURIComponent(streamId)}/ws`;
}

export function isValidRTSPUrl(value: string): boolean {
  const url = value.trim();

  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);

    return (
      (parsed.protocol === "rtsp:" || parsed.protocol === "rtsps:") &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function getStatusLabel(status: StreamStatus): string {
  switch (status) {
    case "connecting":
      return "Connecting";
    case "live":
      return "Live";
    case "paused":
      return "Paused";
    case "error":
      return "Error";
    case "disconnected":
      return "Disconnected";
    default:
      return "Unknown";
  }
}

export function getStatusClass(status: StreamStatus): string {
  switch (status) {
    case "connecting":
      return "status-connecting";
    case "live":
      return "status-live";
    case "paused":
      return "status-paused";
    case "error":
      return "status-error";
    case "disconnected":
      return "status-disconnected";
    default:
      return "status-unknown";
  }
}

export function getStreamName(url: string, index = 0): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname || `Camera ${index + 1}`;
  } catch {
    return `Camera ${index + 1}`;
  }
}