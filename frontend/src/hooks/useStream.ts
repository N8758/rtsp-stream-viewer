import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { getWebSocketUrl } from "../utils/stream";
import type { StreamStatus } from "../types/stream";

interface UseStreamResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: StreamStatus;
  error: string | null;
  isPlaying: boolean;
  connect: () => void;
  disconnect: () => void;
  play: () => Promise<void>;
  pause: () => void;
}

function getBoxSize(data: Uint8Array): number | null {
  if (data.byteLength < 8) {
    return null;
  }

  const view = new DataView(
    data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    )
  );

  const size = view.getUint32(0);

  if (size === 0) {
    return data.byteLength;
  }

  if (size === 1) {
    if (data.byteLength < 16) {
      return null;
    }

    const high = view.getUint32(8);
    const low = view.getUint32(12);

    if (high !== 0) {
      return null;
    }

    return low;
  }

  return size;
}

function getBoxType(data: Uint8Array): string {
  if (data.byteLength < 8) {
    return "";
  }

  return new TextDecoder().decode(data.subarray(4, 8));
}

function splitMp4Boxes(input: Uint8Array): {
  boxes: Uint8Array[];
  remaining: Uint8Array;
} {
  const boxes: Uint8Array[] = [];
  let offset = 0;

  while (offset + 8 <= input.byteLength) {
    const current = input.subarray(offset);
    const size = getBoxSize(current);

    if (size === null || size < 8) {
      break;
    }

    if (offset + size > input.byteLength) {
      break;
    }

    boxes.push(input.slice(offset, offset + size));
    offset += size;
  }

  return {
    boxes,
    remaining: input.slice(offset),
  };
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const result = new ArrayBuffer(data.byteLength);
  new Uint8Array(result).set(data);
  return result;
}

export function useStream(streamId: string): UseStreamResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const networkBufferRef = useRef<Uint8Array>(new Uint8Array());
  const mediaQueueRef = useRef<ArrayBuffer[]>([]);
  const pendingFragmentRef = useRef<Uint8Array[]>([]);

  const mountedRef = useRef(true);
  const connectingRef = useRef(false);
  const initializedRef = useRef(false);
  const playRequestedRef = useRef(false);
  const userPausedRef = useRef(false);
  const statusRef = useRef<StreamStatus>("disconnected");
  const playTimerRef = useRef<number | null>(null);
  const sessionRef = useRef(0);

  const [status, setStatus] =
    useState<StreamStatus>("disconnected");

  const [error, setError] =
    useState<string | null>(null);

  const [isPlaying, setIsPlaying] =
    useState(false);

  const updateStatus = useCallback(
    (next: StreamStatus) => {
      statusRef.current = next;

      if (mountedRef.current) {
        setStatus(next);
      }
    },
    []
  );

  const clearPlayTimer = useCallback(() => {
    if (playTimerRef.current !== null) {
      window.clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    clearPlayTimer();

    const video = videoRef.current;
    const sourceBuffer = sourceBufferRef.current;
    const mediaSource = mediaSourceRef.current;

    if (sourceBuffer) {
      sourceBuffer.onupdateend = null;
      sourceBuffer.onerror = null;
    }

    if (mediaSource) {
      try {
        if (mediaSource.readyState === "open") {
          mediaSource.endOfStream();
        }
      } catch {
      }
    }

    if (video) {
      try {
        video.pause();
      } catch {
      }

      video.onplaying = null;
      video.onpause = null;
      video.onerror = null;
      video.removeAttribute("src");

      try {
        video.load();
      } catch {
      }
    }

    sourceBufferRef.current = null;
    mediaSourceRef.current = null;

    networkBufferRef.current = new Uint8Array();
    mediaQueueRef.current = [];
    pendingFragmentRef.current = [];

    initializedRef.current = false;
    connectingRef.current = false;

    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {
      }

      objectUrlRef.current = null;
    }
  }, [clearPlayTimer]);

  const disconnect = useCallback(() => {
    sessionRef.current += 1;

    playRequestedRef.current = false;
    userPausedRef.current = false;

    clearPlayTimer();

    const socket = socketRef.current;

    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        try {
          socket.close();
        } catch {
        }
      }
    }

    socketRef.current = null;

    cleanupMedia();

    if (mountedRef.current) {
      setIsPlaying(false);
      setError(null);
      updateStatus("disconnected");
    }
  }, [cleanupMedia, clearPlayTimer, updateStatus]);

  const appendNext = useCallback(() => {
    const mediaSource = mediaSourceRef.current;
    const sourceBuffer = sourceBufferRef.current;

    if (
      !mediaSource ||
      !sourceBuffer ||
      mediaSource.readyState !== "open" ||
      sourceBuffer.updating ||
      mediaQueueRef.current.length === 0
    ) {
      return;
    }

    const segment = mediaQueueRef.current.shift();

    if (!segment) {
      return;
    }

    if (
      mediaSourceRef.current !== mediaSource ||
      sourceBufferRef.current !== sourceBuffer ||
      mediaSource.readyState !== "open"
    ) {
      mediaQueueRef.current.unshift(segment);
      return;
    }

    try {
      sourceBuffer.appendBuffer(segment);
    } catch (err) {
      mediaQueueRef.current.unshift(segment);

      if (
        !mountedRef.current ||
        mediaSourceRef.current !== mediaSource ||
        sourceBufferRef.current !== sourceBuffer ||
        mediaSource.readyState !== "open"
      ) {
        return;
      }

      updateStatus("error");

      setError(
        err instanceof Error
          ? err.message
          : "Unable to process the video stream."
      );
    }
  }, [updateStatus]);

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;

    if (!video || !mountedRef.current) {
      return;
    }

    if (
      !playRequestedRef.current ||
      userPausedRef.current
    ) {
      return;
    }

    const mediaSource = mediaSourceRef.current;
    const sourceBuffer = sourceBufferRef.current;

    if (
      !mediaSource ||
      !sourceBuffer ||
      mediaSource.readyState !== "open" ||
      !initializedRef.current
    ) {
      return;
    }

    if (sourceBuffer.updating) {
      return;
    }

    if (video.buffered.length === 0) {
      return;
    }

    try {
      const livePosition =
        video.buffered.end(
          video.buffered.length - 1
        );

      if (!Number.isFinite(livePosition)) {
        return;
      }

      if (
        !Number.isFinite(video.currentTime) ||
        video.currentTime < livePosition - 3
      ) {
        video.currentTime = Math.max(
          0,
          livePosition - 0.25
        );
      }

      await video.play();

      if (!mountedRef.current) {
        return;
      }

      if (
        !playRequestedRef.current ||
        userPausedRef.current
      ) {
        try {
          video.pause();
        } catch {
        }

        setIsPlaying(false);
        updateStatus("paused");
        return;
      }

      setIsPlaying(true);
      updateStatus("live");
      setError(null);
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }

      if (
        !playRequestedRef.current ||
        userPausedRef.current
      ) {
        setIsPlaying(false);
        updateStatus("paused");
        return;
      }

      setIsPlaying(false);

      const message =
        err instanceof Error
          ? err.message
          : "Unable to start video playback.";

      if (
        message.includes("interrupted") ||
        message.includes("removed from the parent media source")
      ) {
        updateStatus("connecting");
        setError(null);
        return;
      }

      updateStatus("error");
      setError(message);
    }
  }, [updateStatus]);

  const schedulePlay = useCallback(() => {
    clearPlayTimer();

    if (
      !mountedRef.current ||
      !playRequestedRef.current ||
      userPausedRef.current
    ) {
      return;
    }

    playTimerRef.current = window.setTimeout(() => {
      playTimerRef.current = null;

      if (
        !mountedRef.current ||
        !playRequestedRef.current ||
        userPausedRef.current
      ) {
        return;
      }

      void tryPlay();
    }, 100);
  }, [clearPlayTimer, tryPlay]);

  const processBoxes = useCallback(
    (boxes: Uint8Array[]) => {
      for (const box of boxes) {
        if (!mountedRef.current) {
          return;
        }

        const type = getBoxType(box);

        if (!initializedRef.current) {
          if (
            type === "ftyp" ||
            type === "moov"
          ) {
            pendingFragmentRef.current.push(box);
          }

          if (type === "moov") {
            const totalSize =
              pendingFragmentRef.current.reduce(
                (total, item) =>
                  total + item.byteLength,
                0
              );

            const initSegment =
              new Uint8Array(totalSize);

            let offset = 0;

            for (
              const item of
              pendingFragmentRef.current
            ) {
              initSegment.set(item, offset);
              offset += item.byteLength;
            }

            mediaQueueRef.current.push(
              toArrayBuffer(initSegment)
            );

            pendingFragmentRef.current = [];
            initializedRef.current = true;

            setError(null);

            if (
              playRequestedRef.current &&
              !userPausedRef.current
            ) {
              updateStatus("connecting");
              schedulePlay();
            } else {
              updateStatus("live");
            }

            appendNext();
          }

          continue;
        }

        if (type === "moof") {
          pendingFragmentRef.current = [box];
          continue;
        }

        if (
          type === "mdat" &&
          pendingFragmentRef.current.length > 0
        ) {
          pendingFragmentRef.current.push(box);

          const totalSize =
            pendingFragmentRef.current.reduce(
              (total, item) =>
                total + item.byteLength,
              0
            );

          const mediaSegment =
            new Uint8Array(totalSize);

          let offset = 0;

          for (
            const item of
            pendingFragmentRef.current
          ) {
            mediaSegment.set(item, offset);
            offset += item.byteLength;
          }

          mediaQueueRef.current.push(
            toArrayBuffer(mediaSegment)
          );

          pendingFragmentRef.current = [];

          appendNext();

          if (
            playRequestedRef.current &&
            !userPausedRef.current
          ) {
            schedulePlay();
          }
        }
      }
    },
    [
      appendNext,
      schedulePlay,
      updateStatus,
    ]
  );

  const handleData = useCallback(
    (data: ArrayBuffer) => {
      if (!mountedRef.current) {
        return;
      }

      const incoming = new Uint8Array(data);
      const existing = networkBufferRef.current;

      const combined = new Uint8Array(
        existing.byteLength +
          incoming.byteLength
      );

      combined.set(existing, 0);
      combined.set(
        incoming,
        existing.byteLength
      );

      const result =
        splitMp4Boxes(combined);

      networkBufferRef.current =
        result.remaining;

      processBoxes(result.boxes);
    },
    [processBoxes]
  );

  const connect = useCallback(() => {
    if (
      !mountedRef.current ||
      !streamId
    ) {
      return;
    }

    const existingSocket =
      socketRef.current;

    if (
      existingSocket &&
      (
        existingSocket.readyState ===
          WebSocket.OPEN ||
        existingSocket.readyState ===
          WebSocket.CONNECTING
      )
    ) {
      return;
    }

    sessionRef.current += 1;

    const sessionId =
      sessionRef.current;

    clearPlayTimer();

    playRequestedRef.current = false;
    userPausedRef.current = false;

    setIsPlaying(false);
    setError(null);
    updateStatus("connecting");

    cleanupMedia();

    const oldSocket =
      socketRef.current;

    if (oldSocket) {
      oldSocket.onopen = null;
      oldSocket.onmessage = null;
      oldSocket.onerror = null;
      oldSocket.onclose = null;

      try {
        oldSocket.close();
      } catch {
      }
    }

    socketRef.current = null;

    if (!("MediaSource" in window)) {
      updateStatus("error");
      setError(
        "This browser does not support MediaSource playback."
      );
      return;
    }

    const mimeType =
      'video/mp4; codecs="avc1.4d401f"';

    if (
      !MediaSource.isTypeSupported(
        mimeType
      )
    ) {
      updateStatus("error");
      setError(
        "This browser does not support H.264 MP4 playback."
      );
      return;
    }

    const video =
      videoRef.current;

    if (!video) {
      updateStatus("error");
      setError(
        "Video element is not available."
      );
      return;
    }

    const mediaSource =
      new MediaSource();

    mediaSourceRef.current =
      mediaSource;

    const objectUrl =
      URL.createObjectURL(
        mediaSource
      );

    objectUrlRef.current =
      objectUrl;

    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = false;

    video.onplaying = () => {
      if (
        !mountedRef.current ||
        sessionRef.current !== sessionId
      ) {
        return;
      }

      if (
        playRequestedRef.current &&
        !userPausedRef.current
      ) {
        setIsPlaying(true);
        updateStatus("live");
        setError(null);
      }
    };

    video.onpause = () => {
      if (
        !mountedRef.current ||
        sessionRef.current !== sessionId
      ) {
        return;
      }

      if (userPausedRef.current) {
        setIsPlaying(false);
        updateStatus("paused");
      }
    };

    video.onerror = () => {
      if (
        !mountedRef.current ||
        sessionRef.current !== sessionId
      ) {
        return;
      }

      const mediaError =
        video.error;

      updateStatus("error");

      setIsPlaying(false);

      setError(
        mediaError
          ? `Video playback error: ${mediaError.code}`
          : "The browser could not decode the video stream."
      );
    };

    const handleSourceOpen = () => {
      if (
        !mountedRef.current ||
        sessionRef.current !== sessionId ||
        mediaSourceRef.current !== mediaSource ||
        mediaSource.readyState !== "open"
      ) {
        return;
      }

      try {
        const sourceBuffer =
          mediaSource.addSourceBuffer(
            mimeType
          );

        sourceBuffer.mode =
          "segments";

        sourceBufferRef.current =
          sourceBuffer;

        sourceBuffer.onupdateend =
          () => {
            if (
              !mountedRef.current ||
              sessionRef.current !== sessionId ||
              mediaSourceRef.current !== mediaSource ||
              sourceBufferRef.current !== sourceBuffer ||
              mediaSource.readyState !== "open"
            ) {
              return;
            }

            appendNext();

            if (
              userPausedRef.current
            ) {
              setIsPlaying(false);
              updateStatus("paused");
              return;
            }

            if (
              playRequestedRef.current
            ) {
              schedulePlay();
              return;
            }

            if (
              initializedRef.current
            ) {
              updateStatus("live");
              setError(null);
            }
          };

        sourceBuffer.onerror = () => {
          if (
            !mountedRef.current ||
            sessionRef.current !== sessionId ||
            mediaSourceRef.current !== mediaSource ||
            sourceBufferRef.current !== sourceBuffer
          ) {
            return;
          }

          updateStatus("error");
          setIsPlaying(false);
          setError(
            "The browser could not process the H.264 video stream."
          );
        };

        appendNext();

        if (
          playRequestedRef.current &&
          !userPausedRef.current
        ) {
          schedulePlay();
        }
      } catch (err) {
        updateStatus("error");
        setError(
          err instanceof Error
            ? err.message
            : "Unable to initialize video playback."
        );
      }
    };

    mediaSource.addEventListener(
      "sourceopen",
      handleSourceOpen,
      { once: true }
    );

    const socket =
      new WebSocket(
        getWebSocketUrl(streamId)
      );

    socket.binaryType =
      "arraybuffer";

    socketRef.current =
      socket;

    socket.onopen = () => {
      if (
        !mountedRef.current ||
        sessionRef.current !== sessionId ||
        socketRef.current !== socket
      ) {
        return;
      }

      connectingRef.current = false;
      updateStatus("connecting");
    };

    socket.onmessage = (event) => {
      if (
        !mountedRef.current ||
        sessionRef.current !== sessionId ||
        socketRef.current !== socket
      ) {
        return;
      }

      if (
        event.data instanceof ArrayBuffer
      ) {
        handleData(event.data);
        return;
      }

      if (
        event.data instanceof Blob
      ) {
        void event.data
          .arrayBuffer()
          .then((buffer) => {
            if (
              mountedRef.current &&
              sessionRef.current === sessionId &&
              socketRef.current === socket
            ) {
              handleData(buffer);
            }
          })
          .catch(() => {
            if (
              mountedRef.current &&
              sessionRef.current === sessionId
            ) {
              updateStatus("error");
              setError(
                "Unable to read video data."
              );
            }
          });
      }
    };

    socket.onerror = () => {
      if (
        !mountedRef.current ||
        sessionRef.current !== sessionId ||
        socketRef.current !== socket
      ) {
        return;
      }

      connectingRef.current = false;
      setIsPlaying(false);
      updateStatus("error");
      setError(
        "WebSocket connection failed."
      );
    };

    socket.onclose = () => {
      if (
        !mountedRef.current ||
        sessionRef.current !== sessionId ||
        socketRef.current !== socket
      ) {
        return;
      }

      connectingRef.current = false;
      socketRef.current = null;
      clearPlayTimer();

      if (!userPausedRef.current) {
        setIsPlaying(false);
        updateStatus("disconnected");
        setError(
          "Stream connection closed."
        );
      }
    };
  }, [
    appendNext,
    cleanupMedia,
    clearPlayTimer,
    handleData,
    schedulePlay,
    streamId,
    updateStatus,
  ]);

  const play = useCallback(
    async () => {
      playRequestedRef.current = true;
      userPausedRef.current = false;

      setError(null);

      const socket =
        socketRef.current;

      if (
        !socket ||
        socket.readyState !==
          WebSocket.OPEN
      ) {
        connect();
        return;
      }

      updateStatus("connecting");

      await tryPlay();

      if (
        mountedRef.current &&
        playRequestedRef.current &&
        !userPausedRef.current
      ) {
        schedulePlay();
      }
    },
    [
      connect,
      schedulePlay,
      tryPlay,
      updateStatus,
    ]
  );

  const pause = useCallback(() => {
    playRequestedRef.current = false;
    userPausedRef.current = true;

    clearPlayTimer();

    const video =
      videoRef.current;

    if (video) {
      try {
        video.pause();
      } catch {
      }
    }

    setIsPlaying(false);
    setError(null);
    updateStatus("paused");
  }, [clearPlayTimer, updateStatus]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      sessionRef.current += 1;

      clearPlayTimer();

      const socket =
        socketRef.current;

      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;

        if (
          socket.readyState ===
            WebSocket.OPEN ||
          socket.readyState ===
            WebSocket.CONNECTING
        ) {
          try {
            socket.close();
          } catch {
          }
        }
      }

      socketRef.current = null;

      cleanupMedia();
    };
  }, [cleanupMedia, clearPlayTimer]);

  return {
    videoRef,
    status,
    error,
    isPlaying,
    connect,
    disconnect,
    play,
    pause,
  };
}