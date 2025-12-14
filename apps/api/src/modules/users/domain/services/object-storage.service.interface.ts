/**
 * Injection token for the object storage service.
 */
export const OBJECT_STORAGE_SERVICE = Symbol('OBJECT_STORAGE_SERVICE');

/**
 * Represents a presigned PUT upload URL and its corresponding public URL.
 */
export interface PresignedPutUrlResult {
  /**
   * Returns a presigned URL that can be used to upload a file via HTTP PUT.
   */
  uploadUrl: string;

  /**
   * Returns a public URL that can be stored in user profile and rendered by clients.
   */
  publicUrl: string;

  /**
   * Returns an object key inside the bucket.
   */
  key: string;
}

/**
 * Generates presigned upload URLs for an object storage provider.
 */
export interface IObjectStorageService {
  /**
   * Gets a presigned PUT URL for uploading an object.
   *
   * @param {object} options - Presign options
   * @returns {Promise<PresignedPutUrlResult>} Presigned upload URL and derived public URL
   */
  getPresignedPutUrl(options: {
    /**
     * Defines the object key to upload.
     */
    key: string;

    /**
     * Defines the uploaded object's content type.
     */
    contentType: string;

    /**
     * Defines Cache-Control for the stored object.
     */
    cacheControl?: string;

    /**
     * Defines how long (in seconds) the presigned URL remains valid.
     */
    expiresInSeconds?: number;
  }): Promise<PresignedPutUrlResult>;
}
