import type { StreamStatus } from "../types/stream";
import { getStatusClass, getStatusLabel } from "../utils/stream";

interface ConnectionStatusProps {
  status: StreamStatus;
  error?: string | null;
}

export default function ConnectionStatus({
  status,
  error,
}: ConnectionStatusProps) {
  return (
    <div className={`connection-status ${getStatusClass(status)}`}>
      <span className="connection-status-dot" />
      <span>{getStatusLabel(status)}</span>
      {error && <span className="connection-status-error">{error}</span>}
    </div>
  );
}