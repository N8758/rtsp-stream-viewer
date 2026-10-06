package services

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"
)

type FFmpegProcess struct {
	ID     string
	URL    string
	Cmd    *exec.Cmd
	Output io.ReadCloser
	Cancel context.CancelFunc
}

type FFmpegService struct {
	path      string
	processes map[string]*FFmpegProcess
	mu        sync.RWMutex
}

func NewFFmpegService(path string) *FFmpegService {
	return &FFmpegService{
		path:      path,
		processes: make(map[string]*FFmpegProcess),
	}
}

func (s *FFmpegService) Start(ctx context.Context, id, streamURL string) (*FFmpegProcess, error) {
	s.mu.Lock()

	if _, exists := s.processes[id]; exists {
		s.mu.Unlock()
		return nil, fmt.Errorf("stream %s is already running", id)
	}

	s.mu.Unlock()

	processCtx, cancel := context.WithCancel(ctx)

	cmd := exec.CommandContext(
	processCtx,
	s.path,
	"-hide_banner",
	"-loglevel",
	"error",
	"-rtsp_transport",
	"tcp",
	"-i",
	streamURL,
	"-an",
	"-c:v",
	"libx264",
	"-preset",
	"veryfast",
	"-tune",
	"zerolatency",
	"-g",
	"30",
	"-keyint_min",
	"30",
	"-sc_threshold",
	"0",
	"-profile:v",
	"main",
	"-level",
	"3.1",
	"-pix_fmt",
	"yuv420p",
	"-movflags",
	"frag_keyframe+empty_moov+default_base_moof",
	"-f",
	"mp4",
	"pipe:1",
)
	cmd.Stderr = os.Stderr

	output, err := cmd.StdoutPipe()

	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create FFmpeg output pipe: %w", err)
	}

	process := &FFmpegProcess{
		ID:     id,
		URL:    streamURL,
		Cmd:    cmd,
		Output: output,
		Cancel: cancel,
	}

	if err := cmd.Start(); err != nil {
		cancel()
		_ = output.Close()

		return nil, fmt.Errorf("failed to start FFmpeg: %w", err)
	}

	s.mu.Lock()
	s.processes[id] = process
	s.mu.Unlock()

	log.Printf("FFmpeg started for stream %s: %s", id, streamURL)

	go func() {
		err := cmd.Wait()

		s.mu.Lock()

		if current, exists := s.processes[id]; exists && current == process {
			delete(s.processes, id)
		}

		s.mu.Unlock()

		_ = output.Close()
		cancel()

		if err != nil {
			log.Printf("FFmpeg exited for stream %s: %v", id, err)
		} else {
			log.Printf("FFmpeg stopped for stream %s", id)
		}
	}()

	return process, nil
}

func (s *FFmpegService) Stop(id string) error {
	s.mu.Lock()

	process, exists := s.processes[id]

	if exists {
		delete(s.processes, id)
	}

	s.mu.Unlock()

	if !exists {
		return nil
	}

	process.Cancel()

	if process.Output != nil {
		_ = process.Output.Close()
	}

	return nil
}

func (s *FFmpegService) StopAll() {
	s.mu.Lock()

	processes := make([]*FFmpegProcess, 0, len(s.processes))

	for _, process := range s.processes {
		processes = append(processes, process)
	}

	s.processes = make(map[string]*FFmpegProcess)

	s.mu.Unlock()

	for _, process := range processes {
		process.Cancel()

		if process.Output != nil {
			_ = process.Output.Close()
		}
	}
}

func (s *FFmpegService) IsRunning(id string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	_, exists := s.processes[id]

	return exists
}