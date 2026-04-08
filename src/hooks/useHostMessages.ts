import { useCallback, useState } from 'react';
import type { Message, MessageType, UseHostMessagesResult } from './useHostMessages.types';

/**
 * Manage host transcript messages.
 */
export function useHostMessages(): UseHostMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);

  const addMessage = useCallback((type: MessageType, text: string): void => {
    setMessages(prev => [...prev, { type, text, timestamp: Date.now() }]);
  }, []);

  const clearMessages = useCallback((): void => {
    setMessages([]);
  }, []);

  return {
    messages,
    addMessage,
    clearMessages,
  };
}

// Re-export types for convenience
export type {
  MessageType,
  Message,
  UseHostMessagesResult,
} from './useHostMessages.types';
