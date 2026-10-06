package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port         string
	FrontendURL  string
	FFmpegPath   string
	ReadTimeout  int
	WriteTimeout int
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	ffmpegPath := os.Getenv("FFMPEG_PATH")
	if ffmpegPath == "" {
		ffmpegPath = "ffmpeg"
	}

	readTimeout := getIntEnv("READ_TIMEOUT", 30)
	writeTimeout := getIntEnv("WRITE_TIMEOUT", 30)

	return Config{
		Port:         port,
		FrontendURL:  frontendURL,
		FFmpegPath:   ffmpegPath,
		ReadTimeout:  readTimeout,
		WriteTimeout: writeTimeout,
	}
}

func getIntEnv(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return defaultValue
	}

	return parsed
}