/**
 * Refresh token domain entity.
 */
export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent?: string | null;
  ip?: string | null;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}
