export type GalleryCategory = 
  | 'All' 
  | 'Student Achievements' 
  | 'Student Council' 
  | 'Computer Society' 
  | 'CCIS Department';

export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  category: Exclude<GalleryCategory, 'All'>;
  postedBy: string;
  imageUrl: string;
  thumbnails: string[];
  aspectRatio: 'portrait' | 'landscape' | 'square';
  indexLabel?: string;
  featured: boolean;
  createdAt: string;
}

export interface AdminFormState {
  title: string;
  category: Exclude<GalleryCategory, 'All'>;
  description: string;
  postedBy: string;
  aspectRatio: 'portrait' | 'landscape' | 'square';
  imageFile: File | null;
  imagePreview: string;
  thumbnailFiles: File[];
  thumbnailPreviews: string[];
  existingThumbnails: string[];
  removedThumbnails: string[]; // Track deleted thumbnails during form session to clean up storage on submit
  isEditing: boolean;
  editTargetId: string | null;
  featured: boolean;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}
