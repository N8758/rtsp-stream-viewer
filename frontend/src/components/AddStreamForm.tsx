import { FormEvent, useState } from "react";
import { isValidRTSPUrl } from "../utils/stream";

interface AddStreamFormProps {
  onAdd: (url: string) => Promise<void> | void;
  loading?: boolean;
}

export default function AddStreamForm({
  onAdd,
  loading = false,
}: AddStreamFormProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = url.trim();

    if (!value) {
      setError("Please enter an RTSP URL.");
      return;
    }

    if (!isValidRTSPUrl(value)) {
      setError("Please enter a valid RTSP URL.");
      return;
    }

    try {
      setError("");
      await onAdd(value);
      setUrl("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add stream."
      );
    }
  };

  return (
    <form className="add-stream-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="rtsp-url">RTSP Stream URL</label>

        <input
          id="rtsp-url"
          type="text"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) {
              setError("");
            }
          }}
          placeholder="rtsp://localhost:8554/camera1"
          autoComplete="off"
          disabled={loading}
        />

        {error && <p className="form-error">{error}</p>}
      </div>

      <button type="submit" disabled={loading}>
        {loading ? "Adding..." : "Add Stream"}
      </button>
    </form>
  );
}