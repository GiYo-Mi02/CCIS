import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { deleteManagedOptimizedImage, deleteManagedOptimizedImageByUrl, uploadOptimizedImage } from '../../lib/media/uploadOptimizedImage';
import { getManagedImagePathsFromUrl } from '../../lib/media/managedPaths';
import type { MediaAsset, UploadOptimizedImageResult } from '../../lib/media/types';
import { GalleryItem, AdminFormState, GalleryCategory } from '../../types/gallery';

function revokeObjectUrl(url: string, ownedUrls: Set<string>) {
  if (ownedUrls.delete(url)) URL.revokeObjectURL(url);
}

const INITIAL_FORM_STATE: AdminFormState = {
  title: '', category: 'Student Council', description: '', postedBy: '',
  aspectRatio: 'landscape', imageFile: null, imagePreview: '',
  thumbnailFiles: [], thumbnailPreviews: [], existingThumbnails: [],
  removedThumbnails: [], isEditing: false, editTargetId: null, featured: false,
};

interface AdminFormProps {
  itemToEdit: GalleryItem | null;
  onSuccess: (item: GalleryItem, isEditing: boolean) => void;
  onClose: () => void;
  triggerToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function AdminForm({
  itemToEdit,
  onSuccess,
  onClose,
  triggerToast
}: AdminFormProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const thumbnailsInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const initialFormState: AdminFormState = itemToEdit ? {
    title: itemToEdit.title,
    category: itemToEdit.category,
    description: itemToEdit.description,
    postedBy: itemToEdit.postedBy,
    aspectRatio: itemToEdit.aspectRatio,
    imageFile: null,
    imagePreview: itemToEdit.imageUrl,
    thumbnailFiles: [],
    thumbnailPreviews: [],
    existingThumbnails: itemToEdit.thumbnails,
    removedThumbnails: [],
    isEditing: true,
    editTargetId: itemToEdit.id,
    featured: itemToEdit.featured || false
  } : INITIAL_FORM_STATE;

  const [formState, setFormState] = useState<AdminFormState>(initialFormState);

  useEffect(() => () => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  const createPreviewUrl = (file: File) => {
    const preview = URL.createObjectURL(file);
    previewUrlsRef.current.add(preview);
    return preview;
  };

  const cleanPreviews = () => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  };

  const handleCancel = () => {
    cleanPreviews();
    setFormState(INITIAL_FORM_STATE);
    if (mainImageInputRef.current) mainImageInputRef.current.value = '';
    if (thumbnailsInputRef.current) thumbnailsInputRef.current.value = '';
    onClose();
  };

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported. Use JPG, PNG or WEBP.`;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return `File ${file.name} exceeds the 10MB size limit.`;
    }
    return null;
  };

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const errorMsg = validateFile(file);
      if (errorMsg) {
        triggerToast(errorMsg, 'error');
        if (mainImageInputRef.current) mainImageInputRef.current.value = '';
        return;
      }
       revokeObjectUrl(formState.imagePreview, previewUrlsRef.current);
       const preview = createPreviewUrl(file);
      setFormState(prev => {
        return {
          ...prev,
          imageFile: file,
          imagePreview: preview
        };
      });
    }
  };

  const handleThumbnailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const filesArray = Array.from(files) as File[];
      const totalAllowed = 5 - formState.existingThumbnails.length;
      
      if (filesArray.length > totalAllowed) {
        triggerToast(`You can only add up to ${totalAllowed} more thumbnail(s). Max limit is 5.`, 'warning');
        if (thumbnailsInputRef.current) thumbnailsInputRef.current.value = '';
        return;
      }

      for (const file of filesArray) {
        const errorMsg = validateFile(file);
        if (errorMsg) {
          triggerToast(errorMsg, 'error');
          if (thumbnailsInputRef.current) thumbnailsInputRef.current.value = '';
          return;
        }
      }

       formState.thumbnailPreviews.forEach(url => revokeObjectUrl(url, previewUrlsRef.current));
       const newPreviews = filesArray.map(createPreviewUrl);
      setFormState(prev => {
        return {
          ...prev,
          thumbnailFiles: filesArray,
          thumbnailPreviews: newPreviews
        };
      });
    }
  };

  const handleRemoveExistingThumbnail = (thumbUrl: string) => {
    setFormState(prev => ({
      ...prev,
      existingThumbnails: prev.existingThumbnails.filter(t => t !== thumbUrl),
      removedThumbnails: [...prev.removedThumbnails, thumbUrl]
    }));
  };

  const getStoragePathFromUrl = (url: string): string | null => {
    try {
      const parts = url.split('gallery-images/');
      if (parts.length >= 2) return parts.slice(1).join('gallery-images/');
      return null;
    } catch {
      return null;
    }
  };

  const getCategorySlug = (cat: string) => {
    return cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const uploadToStorage = async (file: File, categorySlug: string): Promise<UploadOptimizedImageResult> => {
    const result = await uploadOptimizedImage(file, {
      category: 'gallery',
      bucket: 'gallery-images',
      folder: categorySlug,
      entityType: 'gallery_items',
      entityId: formState.editTargetId || undefined,
    });
    triggerToast(
      `${file.name}: ${(result.originalSizeBytes / 1024).toFixed(0)} KB to ${(result.optimizedSizeBytes / 1024).toFixed(0)} KB (${result.percentageSaved.toFixed(0)}% saved).`,
      'success',
    );
    return result;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formState.title.trim()) {
      triggerToast('Please provide a title.', 'warning');
      return;
    }
    if (!formState.imageFile && !formState.isEditing) {
      triggerToast('Please select a main image.', 'warning');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(10);
    const newlyUploadedAssets: MediaAsset[] = [];

    try {
      const categorySlug = getCategorySlug(formState.category);
      let mainImageUrl = formState.imagePreview;

      // 1. Upload main image if modified
      if (formState.imageFile) {
        setUploadProgress(30);
        const mainUpload = await uploadToStorage(formState.imageFile, categorySlug);
        newlyUploadedAssets.push(mainUpload.asset);
        mainImageUrl = mainUpload.asset.publicUrl;
      }

      // 2. Upload new thumbnails
      setUploadProgress(60);
      const thumbnailUploads = await Promise.all(formState.thumbnailFiles.map(file => uploadToStorage(file, categorySlug)));
      newlyUploadedAssets.push(...thumbnailUploads.map(upload => upload.asset));
      const newThumbUrls = thumbnailUploads.map(upload => upload.asset.publicUrl);

      const combinedThumbnails = [
        ...formState.existingThumbnails,
        ...newThumbUrls
      ].slice(0, 5); // strict ceiling

      setUploadProgress(85);

      if (formState.isEditing && formState.editTargetId) {
        // UPDATE Operation
        const { error: dbError } = await supabase
          .from('gallery_items')
          .update({
            title: formState.title.trim(),
            description: formState.description.trim(),
            category: formState.category,
            posted_by: formState.postedBy.trim() || 'Anonymous',
            image_url: mainImageUrl,
            thumbnails: combinedThumbnails,
            aspect_ratio: formState.aspectRatio,
            featured: formState.featured
          })
          .eq('id', formState.editTargetId);

        if (dbError) throw dbError;

        if (formState.imageFile && itemToEdit?.imageUrl && itemToEdit.imageUrl !== mainImageUrl) {
          await deleteManagedOptimizedImageByUrl(itemToEdit.imageUrl, 'gallery-images').catch(error =>
            console.error('Failed to clean up replaced managed gallery image:', error));
        }

        // Explicitly removed gallery images are cleaned up only after the row update.
        // Replaced originals are retained for the staged optimization rollback window.
        if (formState.removedThumbnails.length > 0) {
          await Promise.allSettled(formState.removedThumbnails
            .filter(url => getManagedImagePathsFromUrl(url, 'gallery-images') !== null)
            .map(url => deleteManagedOptimizedImageByUrl(url, 'gallery-images')));

          const pathsToDelete = formState.removedThumbnails
            .filter(url => getManagedImagePathsFromUrl(url, 'gallery-images') === null)
            .map(url => getStoragePathFromUrl(url))
            .filter((p): p is string => p !== null);

          if (pathsToDelete.length > 0) {
            try {
              await supabase.storage.from('gallery-images').remove(pathsToDelete);
            } catch (err) {
              console.error('Failed to clean up removed thumbnails:', err);
            }
          }
        }

        const updatedItem: GalleryItem = {
          id: formState.editTargetId,
          title: formState.title.trim(),
          description: formState.description.trim(),
          category: formState.category,
          postedBy: formState.postedBy.trim() || 'Anonymous',
          imageUrl: mainImageUrl,
          thumbnails: combinedThumbnails,
          aspectRatio: formState.aspectRatio,
          featured: formState.featured,
          createdAt: itemToEdit?.createdAt || new Date().toISOString()
        };

        onSuccess(updatedItem, true);
        triggerToast('Gallery item updated successfully!', 'success');
      } else {
        // CREATE Operation
        const { data: insertedRows, error: dbError } = await supabase
          .from('gallery_items')
          .insert([{
            title: formState.title.trim(),
            description: formState.description.trim(),
            category: formState.category,
            posted_by: formState.postedBy.trim() || 'Anonymous',
            image_url: mainImageUrl,
            thumbnails: combinedThumbnails,
            aspect_ratio: formState.aspectRatio,
            featured: formState.featured
          }])
          .select();

        if (dbError) throw dbError;

        if (insertedRows && insertedRows.length > 0) {
          const inserted = insertedRows[0];
          const newGalleryItem: GalleryItem = {
            id: inserted.id,
            title: inserted.title,
            description: inserted.description || '',
            category: inserted.category as Exclude<GalleryCategory, 'All'>,
            postedBy: inserted.posted_by || 'Anonymous',
            imageUrl: inserted.image_url,
            thumbnails: inserted.thumbnails || [],
            aspectRatio: inserted.aspect_ratio as 'portrait' | 'landscape' | 'square',
            featured: inserted.featured || false,
            createdAt: inserted.created_at
          };

          onSuccess(newGalleryItem, false);
        }
        triggerToast('New gallery item uploaded successfully!', 'success');
      }

      handleCancel();
    } catch (err: unknown) {
      await Promise.allSettled(newlyUploadedAssets.map(asset => deleteManagedOptimizedImage(asset)));
      console.error('Error submitting form:', err);
      triggerToast(err instanceof Error ? err.message : 'An error occurred while uploading. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 w-screen h-screen overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleCancel();
        }
      }}
    >
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-2xl overflow-y-auto max-h-[92vh] w-full max-w-4xl p-6 sm:p-8 animate-modal-zoom relative text-left scrollbar-thin scrollbar-thumb-stone-300">
        
        {/* Close Button overlay */}
        <button
          onClick={handleCancel}
          disabled={isSubmitting}
          className="absolute top-4 right-4 z-20 p-2 bg-[#FAF7EA] hover:bg-stone-100 border border-stone-200/50 text-stone-700 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Close form modal"
        >
          <X size={16} />
        </button>

        <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1A3C2E]/10 flex items-center justify-center text-[#1A3C2E]">
              <Upload size={18} />
            </div>
            <div>
              <h3 className="font-sans font-black text-lg md:text-xl text-[#1A3C2E] uppercase tracking-tight">
                {formState.isEditing ? `Editing: ${formState.title}` : 'Upload New Gallery Media'}
              </h3>
              <p className="text-xs text-stone-500">
                {formState.isEditing ? 'Modify metadata or swap thumbnails.' : 'Add new university events to the public portal.'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Form Column */}
            <div className="space-y-5">
              <div>
                <label htmlFor="gallery-title" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2 text-left">
                  Event Title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="gallery-title"
                  type="text"
                  value={formState.title}
                  onChange={e => setFormState(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. CCIS Hackathon Champions 2026"
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E]/30 focus:border-[#1A3C2E] text-sm font-sans transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="gallery-category" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2 text-left">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select id="gallery-category"
                    value={formState.category}
                    onChange={e => setFormState(prev => ({ ...prev, category: e.target.value as Exclude<GalleryCategory, 'All'> }))}
                    className="w-full px-3 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E]/30 focus:border-[#1A3C2E] text-sm font-sans bg-white transition-colors"
                  >
                    <option value="Student Achievements">Student Achievements</option>
                    <option value="Student Council">Student Council</option>
                    <option value="Computer Society">Computer Society</option>
                    <option value="CCIS Department">CCIS Department</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="gallery-aspect-ratio" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2 text-left">
                    Aspect Ratio
                  </label>
                  <select id="gallery-aspect-ratio"
                    value={formState.aspectRatio}
                    onChange={e => setFormState(prev => ({ ...prev, aspectRatio: e.target.value as 'portrait' | 'landscape' | 'square' }))}
                    className="w-full px-3 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E]/30 focus:border-[#1A3C2E] text-sm font-sans bg-white transition-colors"
                  >
                    <option value="landscape">Landscape (4:3)</option>
                    <option value="portrait">Portrait (3:4)</option>
                    <option value="square">Square (1:1)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="gallery-posted-by" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2 text-left">
                  Posted By / Author
                </label>
                <input
                  id="gallery-posted-by"
                  type="text"
                  value={formState.postedBy}
                  onChange={e => setFormState(prev => ({ ...prev, postedBy: e.target.value }))}
                  placeholder="e.g. CCIS Student Council"
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E]/30 focus:border-[#1A3C2E] text-sm font-sans transition-colors"
                />
              </div>

              {/* Featured toggle option */}
              <div className="flex items-center gap-3 bg-[#FAF7EA]/50 p-4 rounded-2xl border border-[#1A3C2E]/10 select-none">
                <input
                  type="checkbox"
                  id="featured-toggle"
                  checked={formState.featured}
                  onChange={e => setFormState(prev => ({ ...prev, featured: e.target.checked }))}
                  className="w-4 h-4 rounded text-[#1A3C2E] border-stone-300 focus:ring-[#1A3C2E]/40 cursor-pointer"
                />
                <label htmlFor="featured-toggle" className="text-xs font-bold text-stone-700 uppercase tracking-wider cursor-pointer">
                  Featured (Highlight in Hero Carousel)
                </label>
              </div>

              <div>
                <label htmlFor="gallery-description" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2 text-left">
                  Description
                </label>
                <textarea id="gallery-description"
                  value={formState.description}
                  onChange={e => setFormState(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detail the event objectives, participants, and milestones achieved..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E]/30 focus:border-[#1A3C2E] text-sm font-sans resize-none transition-colors text-left animate-none"
                />
              </div>
            </div>

            {/* Right Form Column: File Selection & Previews */}
            <div className="space-y-5 bg-stone-50 p-5 rounded-3xl border border-stone-100">
              
              {/* Main Image File Picker */}
              <div>
                <label htmlFor="main-image-file-input" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2 text-left">
                  Main Featured Image {formState.isEditing ? <span className="text-stone-400 font-normal font-sans tracking-normal lowercase">(optional)</span> : <span className="text-rose-500">*</span>}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={mainImageInputRef}
                    onChange={handleMainImageChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    id="main-image-file-input"
                    aria-label="Select main featured image"
                  />
                  <label
                    htmlFor="main-image-file-input"
                    className="px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 cursor-pointer flex items-center gap-2 text-xs font-bold shadow-sm transition-colors focus-within:ring-2 focus-within:ring-[#1A3C2E] focus-within:ring-offset-2"
                  >
                    <Upload size={14} className="text-[#1A3C2E]" />
                    Select Main Image
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">JPG, PNG, WEBP (Max 10MB)</span>
                </div>

                {formState.imagePreview && (
                  <div className="mt-3 relative w-full h-40 rounded-2xl border border-stone-200 overflow-hidden bg-black flex items-center justify-center">
                    <img 
                      src={formState.imagePreview} 
                      alt="Featured image preview" 
                      className="max-w-full max-h-full object-contain"
                    />
                    <button
                      type="button"
                         onClick={() => {
                           revokeObjectUrl(formState.imagePreview, previewUrlsRef.current);
                           setFormState(prev => ({ ...prev, imageFile: null, imagePreview: '' }));
                        if (mainImageInputRef.current) mainImageInputRef.current.value = '';
                      }}
                     className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                     aria-label="Remove main image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Multi Thumbnail Picker */}
              <div>
                <label htmlFor="thumbnails-file-input" className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-2 text-left">
                  Additional Thumbnails (Max 5 total)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={thumbnailsInputRef}
                    onChange={handleThumbnailsChange}
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    id="thumbnails-file-input"
                    aria-label="Add gallery thumbnails"
                  />
                  <label
                    htmlFor="thumbnails-file-input"
                    className="px-4 py-2.5 bg-white border border-[#FAF7EA] text-[#1A3C2E] rounded-xl hover:bg-stone-55 cursor-pointer flex items-center gap-2 text-xs font-bold shadow-sm transition-colors focus-within:ring-2 focus-within:ring-[#1A3C2E] focus-within:ring-offset-2 border-stone-200"
                  >
                    <Plus size={14} className="text-[#1A3C2E]" />
                    Add Thumbnails
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">
                    ({formState.existingThumbnails.length + formState.thumbnailFiles.length} / 5 selected)
                  </span>
                </div>

                {/* Previews wrapper */}
                {(formState.existingThumbnails.length > 0 || formState.thumbnailPreviews.length > 0) && (
                  <div className="mt-3 space-y-3">
                    
                    {/* Existing Thumbnails (Editable) */}
                    {formState.existingThumbnails.length > 0 && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1.5 text-left">
                          Current Event Photos
                        </span>
                        <div className="flex flex-wrap gap-2">
                           {formState.existingThumbnails.map(thumbUrl => (
                             <div key={thumbUrl} className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-200/50 bg-black flex-shrink-0 group">
                              <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                 onClick={() => handleRemoveExistingThumbnail(thumbUrl)}
                                 aria-label="Remove existing thumbnail"
                                className="absolute inset-0 bg-rose-600/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Thumbnails Previews */}
                    {formState.thumbnailPreviews.length > 0 && (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1.5 text-left">
                          New Photos to Upload
                        </span>
                        <div className="flex flex-wrap gap-2">
                           {formState.thumbnailPreviews.map((previewUrl, idx) => (
                             <div key={previewUrl} className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-200/50 bg-black flex-shrink-0">
                              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                 onClick={() => {
                                   revokeObjectUrl(previewUrl, previewUrlsRef.current);
                                   const updatedFiles = [...formState.thumbnailFiles];
                                  updatedFiles.splice(idx, 1);
                                  const updatedPreviews = [...formState.thumbnailPreviews];
                                  updatedPreviews.splice(idx, 1);
                                  setFormState(prev => ({
                                    ...prev,
                                    thumbnailFiles: updatedFiles,
                                    thumbnailPreviews: updatedPreviews
                                  }));
                                }}
                                 className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded-full text-white hover:bg-black/80 cursor-pointer"
                                 aria-label={`Remove thumbnail ${idx + 1}`}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Progress Bar Indicator */}
          {uploadProgress !== null && (
            <div className="w-full space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-500">
                <span>Uploading event assets...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#1A3C2E] transition-colors duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2.5 text-stone-500 hover:text-stone-700 bg-stone-100 hover:bg-stone-200/80 text-xs font-bold rounded-2xl transition-colors cursor-pointer"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-[#FAF7EA] bg-[#1A3C2E] hover:bg-[#123524] disabled:bg-[#1A3C2E]/40 text-xs font-black uppercase tracking-wider rounded-2xl flex items-center gap-2 transition-colors shadow-md cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Processing...
                </>
              ) : (
                formState.isEditing ? 'Save Changes' : 'Upload Gallery Item'
              )}
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
}
