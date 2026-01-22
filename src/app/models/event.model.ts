export interface EventItem {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  upvotes?: string[]; // user uids
  downvotes?: string[]; // user uids
}
