package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	gws "github.com/gorilla/websocket"

	"rtsp-stream-viewer/backend/internal/models"
	"rtsp-stream-viewer/backend/internal/services"
	wsmanager "rtsp-stream-viewer/backend/internal/websocket"
)

type StreamHandler struct {
	service *services.StreamService
	hub     *wsmanager.Hub
}

func NewStreamHandler(service *services.StreamService, hub *wsmanager.Hub) *StreamHandler {
	return &StreamHandler{
		service: service,
		hub:     hub,
	}
}

func (h *StreamHandler) CreateStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	defer r.Body.Close()

	var request models.CreateStreamRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	request.URL = strings.TrimSpace(request.URL)

	if request.URL == "" {
		writeJSONError(w, http.StatusBadRequest, "RTSP URL is required")
		return
	}

	stream, err := h.service.CreateStream(r.Context(), request.URL)
	if err != nil {
		if stream != nil {
			writeJSON(w, http.StatusBadGateway, map[string]interface{}{
				"id":     stream.ID,
				"status": stream.Status,
				"error":  stream.Error,
			})
			return
		}

		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	response := models.CreateStreamResponse{
		ID:        stream.ID,
		Status:    stream.Status,
		WebSocket: "/api/streams/" + stream.ID + "/ws",
	}

	writeJSON(w, http.StatusCreated, response)
}

func (h *StreamHandler) ListStreams(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	streams := h.service.ListStreams()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"streams": streams,
	})
}

func (h *StreamHandler) GetStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	id := streamIDFromPath(r.URL.Path)

	if id == "" {
		writeJSONError(w, http.StatusBadRequest, "stream ID is required")
		return
	}

	stream, exists := h.service.GetStream(id)

	if !exists {
		writeJSONError(w, http.StatusNotFound, "stream not found")
		return
	}

	writeJSON(w, http.StatusOK, stream)
}

func (h *StreamHandler) DeleteStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	id := streamIDFromPath(r.URL.Path)

	if id == "" {
		writeJSONError(w, http.StatusBadRequest, "stream ID is required")
		return
	}

	if err := h.service.RemoveStream(id); err != nil {
		writeJSONError(w, http.StatusNotFound, err.Error())
		return
	}

	h.hub.CloseStream(id)

	w.WriteHeader(http.StatusNoContent)
}

func (h *StreamHandler) WebSocket(w http.ResponseWriter, r *http.Request) {
	id := streamIDFromPath(r.URL.Path)

	if id == "" {
		http.Error(w, "stream ID is required", http.StatusBadRequest)
		return
	}

	_, exists := h.service.GetStream(id)

	if !exists {
		http.Error(w, "stream not found", http.StatusNotFound)
		return
	}

	process, exists := h.service.GetProcess(id)

	if !exists {
		http.Error(w, "stream process not found", http.StatusNotFound)
		return
	}

	conn, err := h.hub.Upgrade(w, r)

	if err != nil {
		return
	}

	defer conn.Close()

	h.hub.Register(id, conn)
	defer h.hub.Unregister(id, conn)

	err = h.hub.StreamVideo(id, process, conn)

	if err != nil {
		if errors.Is(err, io.EOF) || errors.Is(err, gws.ErrCloseSent) {
			return
		}

		return
	}
}

func streamIDFromPath(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 3 {
		return ""
	}

	if parts[0] != "api" || parts[1] != "streams" {
		return ""
	}

	return parts[2]
}

func writeJSON(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, models.StreamErrorResponse{
		Error: message,
	})
}