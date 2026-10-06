export default function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📹</div>

      <h2>No streams added</h2>

      <p>
        Add an RTSP stream URL above to start watching a live stream.
      </p>
    </div>
  );
}