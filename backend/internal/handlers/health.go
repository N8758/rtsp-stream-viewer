package handlers

import (
	"encoding/json"
	"net/http"
	"time"
)

type HealthHandler struct {
	startedAt time.Time
}

func NewHealthHandler() *HealthHandler {
	return &HealthHandler{
		startedAt: time.Now(),
	}
}

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	response := map[string]interface{}{
		"status":    "ok",
		"service":   "rtsp-stream-viewer-backend",
		"timestamp": time.Now().UTC(),
		"uptime":    time.Since(h.startedAt).String(),
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response)
}