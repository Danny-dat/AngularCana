export interface EventLocationMeta {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface EventItem {
  id: string;
  name: string;
  
  address?: string | null;
  lat: number;
  lng: number;
  
  startTimestamp?: number;
  bannerUrl?: string | null;
  bannerStoragePath?: string | null;
  location?: EventLocationMeta;
  upvotes?: string[]; // user uids
  downvotes?: string[]; // user uids
  [key: string]: any;
}