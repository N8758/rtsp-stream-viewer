package websocket

import (
	"net/http"
	"sync"

	gws "github.com/gorilla/websocket"

	"rtsp-stream-viewer/backend/internal/services"
)

type Hub struct {
	upgrader gws.Upgrader
	mu       sync.RWMutex
	clients   map[string]map[*gws.Conn]struct{}
}

func NewHub() *Hub {
	return &Hub{
		upgrader: gws.Upgrader{
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		clients: make(map[string]map[*gws.Conn]struct{}),
	}
}

func (h *Hub) Upgrade(w http.ResponseWriter, r *http.Request) (*gws.Conn, error) {
	return h.upgrader.Upgrade(w, r, nil)
}

func (h *Hub) Register(streamID string, conn *gws.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.clients[streamID] == nil {
		h.clients[streamID] = make(map[*gws.Conn]struct{})
	}

	h.clients[streamID][conn] = struct{}{}
}

func (h *Hub) Unregister(streamID string, conn *gws.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, exists := h.clients[streamID]; exists {
		delete(clients, conn)

		if len(clients) == 0 {
			delete(h.clients, streamID)
		}
	}
}

func (h *Hub) CloseStream(streamID string) {
	h.mu.Lock()
	clients := h.clients[streamID]
	delete(h.clients, streamID)
	h.mu.Unlock()

	for conn := range clients {
		_ = conn.Close()
	}
}

func (h *Hub) StreamVideo(streamID string, process *services.FFmpegProcess, conn *gws.Conn) error {
	buffer := make([]byte, 32*1024)

	for {
		n, err := process.Output.Read(buffer)

		if n > 0 {
			if writeErr := conn.WriteMessage(gws.BinaryMessage, buffer[:n]); writeErr != nil {
				return writeErr
			}
		}

		if err != nil {
			return err
		}
	}
}