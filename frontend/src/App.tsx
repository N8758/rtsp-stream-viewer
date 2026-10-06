import { useCallback, useEffect, useState } from "react";
import AddStreamForm from "./components/AddStreamForm";
import StreamGrid from "./components/StreamGrid";
import { createStream, deleteStream, getStreams } from "./services/api";
import type { Stream } from "./types/stream";

function App() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");

  const loadStreams = useCallback(async () => {
    try {
      setError("");
      const data = await getStreams();
      setStreams(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the backend."
      );
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    void loadStreams();
  }, [loadStreams]);

  const handleAddStream = async (url: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await createStream(url);

      const newStream: Stream = {
        id: response.id,
        url,
        status: response.status,
      };

      setStreams((current) => [...current, newStream]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add stream.";

      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStream = async (id: string) => {
    try {
      setError("");
      await deleteStream(id);

      setStreams((current) =>
        current.filter((stream) => stream.id !== id)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove stream."
      );
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <div className="brand-icon">▶</div>

            <div>
              <h1>RTSP Stream Viewer</h1>
              <p>Monitor your live streams in one place</p>
            </div>
          </div>

          <div className="system-status">
            <span className="status-dot" />
            <span>Stream Monitor</span>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <div className="hero-content">
            <span className="eyebrow">LIVE VIDEO MONITORING</span>

            <h2>
              Connect and monitor
              <br />
              your RTSP streams
            </h2>

            <p>
              Add an RTSP stream URL to start watching your live
              video feed directly from your browser.
            </p>
          </div>

          <AddStreamForm
            onAdd={handleAddStream}
            loading={loading}
          />
        </section>

        {error && (
          <div className="global-error" role="alert">
            <span>⚠</span>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {initializing ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Connecting to backend...</p>
          </div>
        ) : (
          <StreamGrid
            streams={streams}
            onRemove={handleRemoveStream}
          />
        )}
      </main>

      <footer className="app-footer">
        <span>RTSP Stream Viewer</span>
        <span>•</span>
        <span>React + TypeScript + Go + FFmpeg</span>
      </footer>
    </div>
  );
}

export default App;