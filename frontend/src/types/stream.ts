export type StreamStatus =
  | "connecting"
  | "live"
  | "paused"
  | "error"
  | "disconnected";

export interface Stream {
  id: string;
  url: string;
  status: StreamStatus;
  error?: string;
  createdAt?: string;
}

export interface CreateStreamResponse {
  id: string;
  status: StreamStatus;
  websocket: string;
}

export interface StreamListResponse {
  streams: Stream[];
}

export interface ApiError {
  error: string;
}