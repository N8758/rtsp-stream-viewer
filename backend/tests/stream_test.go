package tests

import (
	"context"
	"testing"

	"rtsp-stream-viewer/backend/internal/services"
)

func TestStreamServiceCreation(t *testing.T) {
	ffmpegService := services.NewFFmpegService("ffmpeg")
	streamService := services.NewStreamService(ffmpegService)

	if streamService == nil {
		t.Fatal("expected stream service to be created")
	}

	streams := streamService.ListStreams()

	if len(streams) != 0 {
		t.Fatalf("expected zero streams, got %d", len(streams))
	}
}

func TestInvalidRTSPURL(t *testing.T) {
	ffmpegService := services.NewFFmpegService("ffmpeg")
	streamService := services.NewStreamService(ffmpegService)

	_, err := streamService.CreateStream(
		context.Background(),
		"http://example.com/video",
	)

	if err == nil {
		t.Fatal("expected invalid RTSP URL error")
	}
}

func TestEmptyRTSPURL(t *testing.T) {
	ffmpegService := services.NewFFmpegService("ffmpeg")
	streamService := services.NewStreamService(ffmpegService)

	_, err := streamService.CreateStream(
		context.Background(),
		"",
	)

	if err == nil {
		t.Fatal("expected empty RTSP URL error")
	}
}

func TestInvalidRTSPHost(t *testing.T) {
	ffmpegService := services.NewFFmpegService("ffmpeg")
	streamService := services.NewStreamService(ffmpegService)

	_, err := streamService.CreateStream(
		context.Background(),
		"rtsp://",
	)

	if err == nil {
		t.Fatal("expected invalid RTSP host error")
	}
}