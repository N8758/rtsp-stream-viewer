package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"rtsp-stream-viewer/backend/internal/models"
)

type StreamService struct {
	ffmpeg    *FFmpegService
	streams   map[string]*models.Stream
	processes map[string]*FFmpegProcess
	mu        sync.RWMutex
}

func NewStreamService(ffmpeg *FFmpegService) *StreamService {
	return &StreamService{
		ffmpeg:    ffmpeg,
		streams:   make(map[string]*models.Stream),
		processes: make(map[string]*FFmpegProcess),
	}
}

func (s *StreamService) CreateStream(ctx context.Context, streamURL string) (*models.Stream, error) {
	streamURL = strings.TrimSpace(streamURL)

	if err := validateRTSPURL(streamURL); err != nil {
		return nil, err
	}

	id, err := generateStreamID()
	if err != nil {
		return nil, err
	}

	stream := &models.Stream{
		ID:        id,
		URL:       streamURL,
		Status:    models.StreamStatusConnecting,
		CreatedAt: time.Now().UTC(),
	}

	process, err := s.ffmpeg.Start(context.Background(), id, streamURL)
	if err != nil {
		stream.Status = models.StreamStatusError
		stream.Error = err.Error()

		s.mu.Lock()
		s.streams[id] = stream
		s.mu.Unlock()

		return stream, err
	}

	s.mu.Lock()
	s.streams[id] = stream
	s.processes[id] = process
	s.mu.Unlock()

	return stream, nil
}

func (s *StreamService) GetStream(id string) (*models.Stream, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stream, exists := s.streams[id]
	if !exists {
		return nil, false
	}

	copy := *stream
	return &copy, true
}

func (s *StreamService) ListStreams() []*models.Stream {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*models.Stream, 0, len(s.streams))

	for _, stream := range s.streams {
		copy := *stream
		result = append(result, &copy)
	}

	return result
}

func (s *StreamService) GetProcess(id string) (*FFmpegProcess, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	process, exists := s.processes[id]
	return process, exists
}

func (s *StreamService) RemoveStream(id string) error {
	s.mu.Lock()

	if _, exists := s.streams[id]; !exists {
		s.mu.Unlock()
		return fmt.Errorf("stream %s not found", id)
	}

	delete(s.streams, id)
	delete(s.processes, id)

	s.mu.Unlock()

	return s.ffmpeg.Stop(id)
}

func (s *StreamService) StopAll() {
	s.ffmpeg.StopAll()

	s.mu.Lock()
	s.streams = make(map[string]*models.Stream)
	s.processes = make(map[string]*FFmpegProcess)
	s.mu.Unlock()
}

func (s *StreamService) UpdateStatus(id string, status models.StreamStatus, errorMessage string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	stream, exists := s.streams[id]
	if !exists {
		return
	}

	stream.Status = status
	stream.Error = errorMessage
}

func validateRTSPURL(rawURL string) error {
	if rawURL == "" {
		return fmt.Errorf("RTSP URL is required")
	}

	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil {
		return fmt.Errorf("invalid RTSP URL")
	}

	if parsed.Scheme != "rtsp" && parsed.Scheme != "rtsps" {
		return fmt.Errorf("URL must use rtsp:// or rtsps://")
	}

	if parsed.Host == "" {
		return fmt.Errorf("RTSP URL must include a host")
	}

	return nil
}

func generateStreamID() (string, error) {
	buffer := make([]byte, 8)

	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("failed to generate stream ID: %w", err)
	}

	return "stream-" + hex.EncodeToString(buffer), nil
}