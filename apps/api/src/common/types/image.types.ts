/**
 * Image data with multiple sizes.
 * Domain/application type - use ImageDto for API responses.
 */
export type ImageData = {
  small: string;
  medium: string;
  large: string;
  original: string;
};
