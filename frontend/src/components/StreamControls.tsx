interface StreamControlsProps {
  isPlaying: boolean;
  disabled?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRemove: () => void;
}

export default function StreamControls({
  isPlaying,
  disabled = false,
  onPlay,
  onPause,
  onRemove,
}: StreamControlsProps) {
  return (
    <div className="stream-controls">
      <button
        type="button"
        onClick={onPlay}
        disabled={disabled || isPlaying}
      >
        ▶ Play
      </button>

      <button
        type="button"
        onClick={onPause}
        disabled={disabled || !isPlaying}
      >
        ⏸ Pause
      </button>

      <button
        type="button"
        onClick={onRemove}
        className="remove-button"
      >
        ✕ Remove
      </button>
    </div>
  );
}