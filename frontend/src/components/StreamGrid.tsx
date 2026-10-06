import type { Stream } from "../types/stream";
import EmptyState from "./EmptyState";
import StreamCard from "./StreamCard";

interface StreamGridProps {
  streams: Stream[];
  onRemove: (id: string) => void;
}

export default function StreamGrid({
  streams,
  onRemove,
}: StreamGridProps) {
  if (streams.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="stream-section">
      <div className="stream-section-header">
        <div>
          <h2>Live Streams</h2>
          <p>
            {streams.length}{" "}
            {streams.length === 1 ? "stream" : "streams"} connected
          </p>
        </div>
      </div>

      <div className="stream-grid">
        {streams.map((stream, index) => (
          <StreamCard
            key={stream.id}
            stream={stream}
            index={index}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}