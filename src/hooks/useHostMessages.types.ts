/**
 * Type of transcript message
 */
export type MessageType = 'word' | 'sentence' | 'definition' | 'system' | 'player' | string;

/**
 * Transcript message object
 */
export interface Message {
  type: MessageType;
  text: string;
  timestamp: number;
}

/**
 * Return type for useHostMessages hook
 */
export interface UseHostMessagesResult {
  messages: Message[];
  addMessage: (type: MessageType, text: string) => void;
  clearMessages: () => void;
}
