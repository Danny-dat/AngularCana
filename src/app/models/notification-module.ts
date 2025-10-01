import type { Timestamp } from 'firebase/firestore';

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId?: string;
  message: string;
  type?: 'default' | 'chat_message';
  timestamp: Timestamp | Date;
  read?: boolean;
}