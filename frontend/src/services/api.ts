import type {
  CreateStreamResponse,
  Stream,
  StreamListResponse,
} from "../types/stream";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data as T;
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || "Request failed");
  }

  return text as T;
}

export async function createStream(
  url: string
): Promise<CreateStreamResponse> {
  const response = await fetch(`${API_URL}/api/streams`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  return parseResponse<CreateStreamResponse>(response);
}

export async function getStreams(): Promise<Stream[]> {
  const response = await fetch(`${API_URL}/api/streams`);

  const data = await parseResponse<StreamListResponse>(response);

  return data.streams;
}

export async function getStream(id: string): Promise<Stream> {
  const response = await fetch(`${API_URL}/api/streams/${encodeURIComponent(id)}`);

  return parseResponse<Stream>(response);
}

export async function deleteStream(id: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/streams/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete stream");
    }

    const text = await response.text();
    throw new Error(text || "Failed to delete stream");
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/health`);

    return response.ok;
  } catch {
    return false;
  }
}