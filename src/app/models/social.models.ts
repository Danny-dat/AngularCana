/* istanbul ignore file */
export type UID = string;

export interface FriendPublicProfile {
  id: UID;
  label?: string;
  displayName?: string | null;
  username?: string | null;
  photoURL?: string | null;
  lastLocation?: { lat: number; lng: number } | null;
  /** UI-only */
  _action?: '' | 'remove' | 'block' | 'unblock';
}

export interface FriendRequest {
  id: string;
  fromUid: UID;
  toUid: UID;
  participants: UID[];
  status: 'pending' | 'accepted' | 'declined' | 'removed' | 'blocked';
  createdAt?: any;
  respondedAt?: any;
  fromDisplayName?: string | null;
  fromEmail?: string | null;
}

export interface ChatMessage {
  id?: string;
  text: string;
  senderId: UID;
  recipientId: UID;
  createdAt: any;
  readBy?: UID[];
}

export interface ChatSummary {
  lastMessage?: string;
  lastSenderId?: UID;
  updatedAt?: any;
  reads?: Record<UID, any>;
}
