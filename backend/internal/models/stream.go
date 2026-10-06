package models

import "time"

type StreamStatus string

const (
	StreamStatusConnecting   StreamStatus = "connecting"
	StreamStatusLive         StreamStatus = "live"
	StreamStatusPaused       StreamStatus = "paused"
	StreamStatusError        StreamStatus = "error"
	StreamStatusDisconnected StreamStatus = "disconnected"
)

type Stream struct {
	ID        string       `json:"id"`
	URL       string       `json:"url"`
	Status    StreamStatus `json:"status"`
	Error     string       `json:"error,omitempty"`
	CreatedAt time.Time    `json:"createdAt"`
}

type CreateStreamRequest struct {
	URL string `json:"url"`
}

type CreateStreamResponse struct {
	ID        string       `json:"id"`
	Status    StreamStatus `json:"status"`
	WebSocket string       `json:"websocket"`
}

type StreamErrorResponse struct {
	Error string `json:"error"`
}