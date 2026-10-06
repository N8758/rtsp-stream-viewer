package tests

import (
	"context"
	"os/exec"
	"testing"
	"time"

	"rtsp-stream-viewer/backend/internal/services"
)

func TestFFmpegServiceCreation(t *testing.T) {
	service := services.NewFFmpegService("ffmpeg")

	if service == nil {
		t.Fatal("expected FFmpeg service to be created")
	}
}

func TestFFmpegCommandAvailable(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffmpeg", "-version")

	if err := cmd.Run(); err != nil {
		t.Skip("FFmpeg is not installed or not available in PATH")
	}
}