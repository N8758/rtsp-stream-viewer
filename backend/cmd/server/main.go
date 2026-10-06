package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"rtsp-stream-viewer/backend/internal/config"
	"rtsp-stream-viewer/backend/internal/handlers"
	"rtsp-stream-viewer/backend/internal/middleware"
	"rtsp-stream-viewer/backend/internal/services"
	wsmanager "rtsp-stream-viewer/backend/internal/websocket"
)

func main() {
	cfg := config.Load()

	ffmpegService := services.NewFFmpegService(cfg.FFmpegPath)
	streamService := services.NewStreamService(ffmpegService)
	hub := wsmanager.NewHub()

	healthHandler := handlers.NewHealthHandler()
	streamHandler := handlers.NewStreamHandler(streamService, hub)

	mux := http.NewServeMux()

	mux.HandleFunc("/api/health", healthHandler.Health)

	mux.HandleFunc("/api/streams", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			streamHandler.ListStreams(w, r)
		case http.MethodPost:
			streamHandler.CreateStream(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/streams/", func(w http.ResponseWriter, r *http.Request) {
		if len(r.URL.Path) > len("/api/streams/") {
			if len(r.URL.Path) >= 3 && r.URL.Path[len(r.URL.Path)-3:] == "/ws" {
				streamHandler.WebSocket(w, r)
				return
			}

			switch r.Method {
			case http.MethodGet:
				streamHandler.GetStream(w, r)
			case http.MethodDelete:
				streamHandler.DeleteStream(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		http.NotFound(w, r)
	})

	handler := middleware.CORS(cfg.FrontendURL)(mux)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       time.Duration(cfg.ReadTimeout) * time.Second,
		WriteTimeout:      0,
		IdleTimeout:       60 * time.Second,
	}

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("RTSP Stream Viewer backend running on http://localhost:%s", cfg.Port)
		log.Printf("Health endpoint: http://localhost:%s/api/health", cfg.Port)

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-shutdown

	log.Println("Shutting down server...")

	streamService.StopAll()

	shutdownTimeout := 10 * time.Second
	shutdownCtx := time.After(shutdownTimeout)

	select {
	case <-shutdownCtx:
		log.Println("Shutdown timeout reached")
	default:
	}

	log.Println("Server stopped")
}