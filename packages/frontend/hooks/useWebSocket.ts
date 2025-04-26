import { useState, useEffect, useRef } from 'react';

export type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

// Define a more specific type for the messages you expect, if possible
// For now, using 'any' for flexibility
type WebSocketMessage = any;

interface UseWebSocketOptions {
    onMessage?: (message: WebSocketMessage) => void;
    onError?: (event: Event) => void;
    onOpen?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
}

export function useWebSocket(url: string, options?: UseWebSocketOptions) {
    const [status, setStatus] = useState<WebSocketStatus>('connecting');
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const webSocketRef = useRef<WebSocket | null>(null);
    const errorOccurredRef = useRef<boolean>(false); // Ref to track if an error caused the close

    useEffect(() => {
        if (!url) return;

        setStatus('connecting');
        errorOccurredRef.current = false; // Reset error flag on new connection attempt
        const ws = new WebSocket(url);
        webSocketRef.current = ws;

        ws.onopen = (event) => {
            console.log('WebSocket connected');
            errorOccurredRef.current = false; // Reset error flag on successful open
            setStatus('open');
            options?.onOpen?.(event);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                setLastMessage(message);
                options?.onMessage?.(message); // Optional callback for direct handling
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
                // Handle non-JSON messages or parsing errors if necessary
            }
        };

        ws.onerror = (event) => {
            console.error('WebSocket error:', event);
            errorOccurredRef.current = true; // Set error flag
            setStatus('error');
            options?.onError?.(event);
        };

        ws.onclose = (event) => {
            console.log('WebSocket disconnected');
            // Only set to 'closed' if an error didn't precede this close event.
            if (!errorOccurredRef.current) {
                 setStatus('closed');
            }
            // We always clear the ref here, regardless of error status
            webSocketRef.current = null;
            options?.onClose?.(event);
        };

        // Cleanup function
        return () => {
            // Add a check before closing, readyState might be CLOSING or CLOSED
            if (webSocketRef.current && (webSocketRef.current.readyState === WebSocket.OPEN || webSocketRef.current.readyState === WebSocket.CONNECTING)) {
                console.log('Closing WebSocket connection on cleanup...');
                // Prevent onclose handler logic when deliberately closing
                webSocketRef.current.onclose = null;
                webSocketRef.current.onerror = null;
                webSocketRef.current.close();
                webSocketRef.current = null;
            }
        };
        // REMOVED 'status' dependency
        // Only include dependencies that, when changed, *should* trigger a re-connection.
        // If the callbacks passed via options can change identity without needing a reconnect,
        // consider wrapping them in useCallback in the parent component or using a ref.
    }, [url, options?.onOpen, options?.onMessage, options?.onError, options?.onClose]);

    // Function to send messages (optional, but often useful)
    const sendMessage = (message: any) => {
        if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            webSocketRef.current.send(JSON.stringify(message));
        } else {
            console.error('WebSocket is not open. Cannot send message.');
        }
    };

    return { status, lastMessage, sendMessage };
} 