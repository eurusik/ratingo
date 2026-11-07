import type {
  UserMediaListSort,
  UserMediaState,
  UserMediaSummary,
} from '@/modules/user-media/public';

export interface PublicUserMediaListQuery {
  limit?: number;
  offset?: number;
  sort?: UserMediaListSort;
}

export interface PublicUserMediaListItem {
  id: string;
  state: UserMediaState['state'];
  rating: number | null;
  progress: UserMediaState['progress'];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  mediaSummary: UserMediaSummary;
}

export interface PublicUserMediaPage {
  total: number;
  data: PublicUserMediaListItem[];
}
