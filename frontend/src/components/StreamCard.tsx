import { useEffect } from "react";
import type { Stream } from "../types/stream";
import { useStream } from "../hooks/useStream";
import { getStreamName } from "../utils/stream";
import ConnectionStatus from "./ConnectionStatus";
import StreamControls from "./StreamControls";

interface StreamCardProps {
  stream: Stream;
  index: number;
  onRemove: (id: string) => void;
}

export default function StreamCard({
  stream,
  index,
  onRemove,
}: StreamCardProps) {
  const {
    videoRef,
    status,
    error,
    isPlaying,
    connect,
    play,
    pause,
  } = useStream(stream.id);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (status === "live") {
      void play();
    }
  }, [status, play]);

  const handlePlay = () => {
    if (status === "disconnected" || status === "error") {
      connect();
      return;
    }

    void play();
  };

  return (
    <article className="stream-card">
      <div className="stream-card-header">
        <div>
          <h3>{getStreamName(stream.url, index)}</h3>
          <p>{stream.url}</p>
        </div>

        <ConnectionStatus status={status} error={error} />
      </div>

      <div className="video-container">
        <video
          ref={videoRef}
          muted
          playsInline
          controls={false}
          className="stream-video"
        />

        {status === "connecting" && (
          <div className="video-overlay">
            <span>Connecting to stream...</span>
          </div>
        )}

        {status === "error" && (
          <div className="video-overlay video-error">
            <span>{error || "Stream unavailable"}</span>
          </div>
        )}

        {status === "disconnected" && (
          <div className="video-overlay">
            <span>Stream disconnected</span>
          </div>
        )}
      </div>

      <StreamControls
        isPlaying={isPlaying}
        disabled={status === "connecting" || status === "error"}
        onPlay={handlePlay}
        onPause={pause}
        onRemove={() => onRemove(stream.id)}
      />
    </article>
  );
}