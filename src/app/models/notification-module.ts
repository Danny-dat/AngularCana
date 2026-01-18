/* istanbul ignore file */
// Ergänze/angleiche die Typen
export type NotificationType = 'chat_message' | 'friend_request' | 'default';

export interface AppNotification {
  id: string;
  type?: NotificationType; // <-- jetzt inkl. 'friend_request'
  message: string;
  recipientId: string;
  senderId?: string;
  read?: boolean;
  timestamp: any; // Timestamp | Date (so wie du es bisher nutzt)
}
