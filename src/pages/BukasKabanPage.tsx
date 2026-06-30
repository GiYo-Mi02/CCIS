import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, X, Edit, Trash2, Loader2, Download, AlertTriangle, CheckCircle2, Info, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ============================================================
// SUPABASE SCHEMA CONVENTION REFERENCES
// ============================================================
/*
  Table: public.transparency_reports
    id: uuid DEFAULT gen_random_uuid() PRIMARY KEY
    title: text NOT NULL
    caption: text NOT NULL
    semester: text NOT NULL
    pdf_url: text NOT NULL
    thumbnail_url: text NOT NULL
    file_size_label: text NOT NULL
    created_at: timestamptz DEFAULT now()

  Storage Bucket: bukas-kaban-reports
    Read: Public Select
    Write: Restricted to Authenticated Admins (role in profiles table checks)
*/

export interface TransparencyReport {
  id: string;
  title: string;
  caption: string;
  semester: string; // e.g. "1st Semester 2025-2026"
  pdfUrl: string;
  thumbnailUrl: string;
  fileSizeLabel: string; // e.g. "2.4 MB"
  createdAt: string;
}

interface BukasKabanPageProps {
  isAdmin?: boolean;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

const MOCK_REPORTS: TransparencyReport[] = [
  {
    id: "report-1",
    title: "1st Semester Orgfee Collection Summary",
    caption: "A comprehensive breakdown of organizational fees collected from students of the College of Computing and Information Sciences during the first semester of A.Y. 2025-2026.",
    semester: "1st Semester A.Y. 2025-2026",
    pdfUrl: "#",
    thumbnailUrl: "",
    fileSizeLabel: "1.84 MB",
    createdAt: "2026-06-15T08:30:00.000Z"
  },
  {
    id: "report-2",
    title: "CCIS Student Assembly General Minutes",
    caption: "Official minutes of the college assembly held on August 20, 2025, detailing representative elections, constitution revisions, and project allocation decisions.",
    semester: "1st Semester A.Y. 2025-2026",
    pdfUrl: "#",
    thumbnailUrl: "",
    fileSizeLabel: "842 KB",
    createdAt: "2025-08-22T10:15:00.000Z"
  },
  {
    id: "report-3",
    title: "CCIS Innovate Hackathon Event Budget Liquidation",
    caption: "Financial statements outlining the complete fund disbursements, sponsorship allocations, cash prize payouts, and logistics receipts for the 48-hour continuous cycle hackathon.",
    semester: "1st Semester A.Y. 2025-2026",
    pdfUrl: "#",
    thumbnailUrl: "",
    fileSizeLabel: "3.24 MB",
    createdAt: "2025-07-02T14:45:00.000Z"
  },
  {
    id: "report-4",
    title: "Student Council Photobooth Earnings & Receipts",
    caption: "Detailed revenue report and receipt ledger for the CCIS Student Council photobooth activity conducted during the UMak Sportsfest 2025.",
    semester: "2nd Semester A.Y. 2024-2025",
    pdfUrl: "#",
    thumbnailUrl: "",
    fileSizeLabel: "1.12 MB",
    createdAt: "2025-05-18T16:00:00.000Z"
  },
  {
    id: "report-5",
    title: "Event Liquidation Report — CCIS Sportsfest 2025 Support Staff",
    caption: "A detailed account of meal allowances, equipment rentals, uniform production, and logistical expenses for support staff volunteers during the annual Sportsfest.",
    semester: "2nd Semester A.Y. 2024-2025",
    pdfUrl: "#",
    thumbnailUrl: "",
    fileSizeLabel: "2.10 MB",
    createdAt: "2025-05-10T11:20:00.000Z"
  },
  {
    id: "report-6",
    title: "CCIS Computing Congress Seminar - Financial Statements",
    caption: "Transparency records showing budget allocations, guest speaker honoraria receipts, certificate printing costs, and venue decorations for the Computing Congress.",
    semester: "2nd Semester A.Y. 2024-2025",
    pdfUrl: "#",
    thumbnailUrl: "",
    fileSizeLabel: "1.65 MB",
    createdAt: "2025-03-05T09:00:00.000Z"
  },
  {
    id: "report-7",
    title: "Mid-Term Project Implementation Report",
    caption: "Official review of targeted versus actual execution metrics for academic tutorials, peer-to-peer programming workshops, and online forum deployment projects.",
    semester: "1st Semester A.Y. 2024-2025",
    pdfUrl: "#",
    thumbnailUrl: "",
    fileSizeLabel: "4.15 MB",
    createdAt: "2024-11-28T13:40:00.000Z"
  }
];

// Vector placeholder preview illustration for PDF
const PDFPlaceholder = ({ title }: { title: string }) => (
  <div className="w-full h-full bg-gradient-to-br from-stone-50 to-stone-150 flex flex-col items-center justify-center p-3 relative border-r border-stone-200">
    <div className="absolute top-2 left-2 bg-[#1A3C2E] text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded tracking-tighter shadow-xs">
      PDF
    </div>
    <div className="w-10 h-13 bg-white rounded border border-stone-300 flex items-center justify-center shadow-xs">
      <span className="text-[10px] font-serif font-black text-[#1A3C2E] tracking-tight">CCIS</span>
    </div>
    <div className="mt-3 w-16 h-1 bg-stone-300 rounded-full" />
    <div className="mt-1.5 w-12 h-1 bg-stone-300 rounded-full" />
    <div className="mt-1.5 w-14 h-1 bg-stone-300 rounded-full" />
    <span className="sr-only">First page preview of {title}</span>
  </div>
);

export default function BukasKabanPage({ isAdmin = false }: BukasKabanPageProps) {
  const [reports, setReports] = useState<TransparencyReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSemester, setSelectedSemester] = useState<string>('All');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isUsingMockData, setIsUsingMockData] = useState<boolean>(false);

  // Admin form modal state
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<TransparencyReport | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formCaption, setFormCaption] = useState('');
  const [formSemester, setFormSemester] = useState('');
  const [formCustomSemester, setFormCustomSemester] = useState('');
  const [formIsNewSemester, setFormIsNewSemester] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // PDF processing states
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [generatedThumbnailBlob, setGeneratedThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Toast Helper
  const triggerToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Fetch reports from Supabase
  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transparency_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Table doesn't exist or other query error
        console.warn('Supabase transparency table access error, falling back to mock data:', error.message);
        setReports(MOCK_REPORTS);
        setIsUsingMockData(true);
      } else if (data && data.length > 0) {
        const mapped: TransparencyReport[] = data.map((r) => ({
          id: r.id,
          title: r.title,
          caption: r.caption,
          semester: r.semester,
          pdfUrl: r.pdf_url,
          thumbnailUrl: r.thumbnail_url || '',
          fileSizeLabel: r.file_size_label,
          createdAt: r.created_at
        }));
        setReports(mapped);
        setIsUsingMockData(false);
      } else {
        // Table exists but is empty
        setReports([]);
        setIsUsingMockData(false);
      }
    } catch (err) {
      console.error('Failed to load transparency reports, falling back to mock:', err);
      setReports(MOCK_REPORTS);
      setIsUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Compute unique semesters for filtering
  const semestersList = ['All', ...Array.from(new Set(reports.map(r => r.semester)))].sort((a, b) => (b as string).localeCompare(a as string));

  // Filter reports
  const filteredReports = reports.filter(r => {
    if (selectedSemester === 'All') return true;
    return r.semester === selectedSemester;
  });

  // Last updated timestamp calculation
  const lastUpdatedText = (() => {
    if (reports.length === 0) return 'No updates yet';
    const dates = reports.map(r => new Date(r.createdAt).getTime());
    const maxDate = new Date(Math.max(...dates));
    return maxDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  })();

  // Generate dynamic list of semesters for form dropdown
  const formSemestersOptions = Array.from(new Set(reports.map(r => r.semester))).sort((a, b) => (a as string).localeCompare(b as string));

  // Initialize form for adding / editing
  const openForm = (report: TransparencyReport | null = null) => {
    if (report) {
      setEditTarget(report);
      setFormTitle(report.title);
      setFormCaption(report.caption);
      setFormSemester(report.semester);
      setFormIsNewSemester(false);
      setFormCustomSemester('');
      setSelectedFile(null);
      setGeneratedThumbnailBlob(null);
      setThumbnailPreviewUrl(report.thumbnailUrl);
    } else {
      setEditTarget(null);
      setFormTitle('');
      setFormCaption('');
      setFormSemester(formSemestersOptions[0] || '1st Semester A.Y. 2025-2026');
      setFormIsNewSemester(false);
      setFormCustomSemester('');
      setSelectedFile(null);
      setGeneratedThumbnailBlob(null);
      setThumbnailPreviewUrl('');
    }
    setShowFormModal(true);
  };

  // Client-side PDF page to canvas render function
  const renderPdfThumbnail = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const scriptId = 'pdfjs-lib-cdn-loader';
      let script = document.getElementById(scriptId) as HTMLScriptElement;

      const processFile = async () => {
        try {
          const pdfjsLib = (window as any).pdfjsLib;
          if (!pdfjsLib) {
            throw new Error('pdfjsLib was not found on global scope.');
          }

          // Set cloud worker
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

          const fileReader = new FileReader();
          fileReader.onload = async function() {
            try {
              const arrayBuffer = this.result as ArrayBuffer;
              const typedarray = new Uint8Array(arrayBuffer);
              const loadingTask = pdfjsLib.getDocument({ data: typedarray });
              const pdf = await loadingTask.promise;

              if (pdf.numPages === 0) {
                throw new Error('This PDF has no pages.');
              }

              const page = await pdf.getPage(1);
              
              // Scale for optimal rendering resolution (1.2 scale fits preview card)
              const viewport = page.getViewport({ scale: 1.2 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');

              if (!context) {
                throw new Error('Failed to create canvas context.');
              }

              canvas.width = viewport.width;
              canvas.height = viewport.height;

              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;

              canvas.toBlob((blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error('Export canvas to image blob failed.'));
                }
              }, 'image/jpeg', 0.85);

            } catch (err) {
              reject(err);
            }
          };

          fileReader.onerror = () => reject(new Error('FileReader failed to process PDF.'));
          fileReader.readAsArrayBuffer(file);
        } catch (e) {
          reject(e);
        }
      };

      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          processFile();
        };
        script.onerror = () => reject(new Error('Failed to download PDF helper scripts. Check your connection.'));
        document.head.appendChild(script);
      } else {
        if ((window as any).pdfjsLib) {
          processFile();
        } else {
          // If script tag is appending, poll safely
          const poll = setInterval(() => {
            if ((window as any).pdfjsLib) {
              clearInterval(poll);
              processFile();
            }
          }, 100);
          setTimeout(() => {
            clearInterval(poll);
            reject(new Error('PDF script load timeout.'));
          }, 10000);
        }
      }
    });
  };

  // Handle PDF file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type !== 'application/pdf') {
      triggerToast('Only PDF documents are allowed.', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      triggerToast('PDF file size cannot exceed 50MB limit.', 'error');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    setIsGeneratingThumbnail(true);
    
    try {
      const blob = await renderPdfThumbnail(file);
      setGeneratedThumbnailBlob(blob);
      const url = URL.createObjectURL(blob);
      setThumbnailPreviewUrl(url);
      triggerToast('PDF page preview generated successfully.', 'info');
    } catch (err: any) {
      console.error('Thumbnail generation failed:', err);
      triggerToast('Failed to auto-generate PDF thumbnail preview. Using default file icon.', 'warning');
      setGeneratedThumbnailBlob(null);
      setThumbnailPreviewUrl('');
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const getStoragePathFromUrl = (url: string): string | null => {
    try {
      const parts = url.split('/public/bukas-kaban-reports/');
      if (parts.length === 2) return parts[1];
      return null;
    } catch {
      return null;
    }
  };

  // Submit Admin Form (Add / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUsingMockData) {
      triggerToast('Operations disabled: Using local mock fallback. Connect Supabase database to write.', 'warning');
      return;
    }

    const title = formTitle.trim();
    const caption = formCaption.trim();
    const semester = formIsNewSemester ? formCustomSemester.trim() : formSemester.trim();

    if (!title || !caption || !semester) {
      triggerToast('Please fill out all required fields.', 'error');
      return;
    }

    if (!editTarget && !selectedFile) {
      triggerToast('Please select a PDF document to upload.', 'error');
      return;
    }

    setFormSubmitting(true);

    try {
      let pdfUrl = editTarget ? editTarget.pdfUrl : '';
      let thumbnailUrl = editTarget ? editTarget.thumbnailUrl : '';
      let fileSizeLabel = editTarget ? editTarget.fileSizeLabel : '';

      // Upload files if selected
      if (selectedFile) {
        // Clean storage path on edit replacement
        if (editTarget) {
          const oldPdfPath = getStoragePathFromUrl(editTarget.pdfUrl);
          const oldThumbPath = getStoragePathFromUrl(editTarget.thumbnailUrl);
          const deletePaths = [];
          if (oldPdfPath) deletePaths.push(oldPdfPath);
          if (oldThumbPath) deletePaths.push(oldThumbPath);
          
          if (deletePaths.length > 0) {
            console.log('[Transparency Upload] Cleaning up old assets from storage:', deletePaths);
            await supabase.storage.from('bukas-kaban-reports').remove(deletePaths);
          }
        }

        // Upload new PDF
        const sanitizedFileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        console.log('[Transparency Upload] Starting PDF upload to storage bucket "bukas-kaban-reports":', sanitizedFileName);
        const { error: pdfUploadErr } = await supabase.storage
          .from('bukas-kaban-reports')
          .upload(sanitizedFileName, selectedFile);

        if (pdfUploadErr) {
          console.error('[Transparency Upload] PDF upload failed with error:', pdfUploadErr);
          throw pdfUploadErr;
        }
        
        const pdfPublicUrl = supabase.storage.from('bukas-kaban-reports').getPublicUrl(sanitizedFileName).data.publicUrl;
        pdfUrl = pdfPublicUrl;
        fileSizeLabel = (selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB';
        console.log('[Transparency Upload] PDF uploaded successfully. Public URL:', pdfUrl);

        // Upload thumbnail if generated
        if (generatedThumbnailBlob) {
          const sanitizedThumbName = `thumb_${sanitizedFileName.replace('.pdf', '')}.webp`;
          console.log('[Transparency Upload] Starting thumbnail upload to storage:', sanitizedThumbName);
          const { error: thumbUploadErr } = await supabase.storage
            .from('bukas-kaban-reports')
            .upload(sanitizedThumbName, generatedThumbnailBlob, {
              contentType: 'image/webp'
            });

          if (thumbUploadErr) {
            console.error('[Transparency Upload] Thumbnail upload failed (non-blocking):', thumbUploadErr);
          } else {
            thumbnailUrl = supabase.storage.from('bukas-kaban-reports').getPublicUrl(sanitizedThumbName).data.publicUrl;
            console.log('[Transparency Upload] Thumbnail uploaded successfully. Public URL:', thumbnailUrl);
          }
        }
      }

      if (editTarget) {
        // Update database row
        const { error: dbErr } = await supabase
          .from('transparency_reports')
          .update({
            title,
            caption,
            semester,
            pdf_url: pdfUrl,
            thumbnail_url: thumbnailUrl,
            file_size_label: fileSizeLabel
          })
          .eq('id', editTarget.id);

        if (dbErr) throw dbErr;
        triggerToast('Report updated successfully.', 'success');
      } else {
        // Insert database row
        const { error: dbErr } = await supabase
          .from('transparency_reports')
          .insert({
            title,
            caption,
            semester,
            pdf_url: pdfUrl,
            thumbnail_url: thumbnailUrl,
            file_size_label: fileSizeLabel
          });

        if (dbErr) throw dbErr;
        triggerToast('Transparency report published successfully.', 'success');
      }

      setShowFormModal(false);
      fetchReports();
    } catch (err: any) {
      console.error('Submission failed:', err);
      triggerToast(err.message || 'Failed to submit transparency report.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Confirm delete handler
  const handleDeleteReport = async (report: TransparencyReport) => {
    if (isUsingMockData) {
      // Allow deletion on mock data locally for visual checks
      setReports(prev => prev.filter(r => r.id !== report.id));
      triggerToast('Mock report removed from view (Local fallback mode).', 'success');
      setDeleteConfirmId(null);
      return;
    }

    try {
      // 1. Delete files from storage
      const pdfPath = getStoragePathFromUrl(report.pdfUrl);
      const thumbPath = getStoragePathFromUrl(report.thumbnailUrl);
      const pathsToDelete: string[] = [];
      
      if (pdfPath) pathsToDelete.push(pdfPath);
      if (thumbPath) pathsToDelete.push(thumbPath);

      if (pathsToDelete.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from('bukas-kaban-reports')
          .remove(pathsToDelete);
        
        if (storageErr) console.warn('Failed to delete assets from storage bucket:', storageErr.message);
      }

      // 2. Delete DB Row
      const { error: dbErr } = await supabase
        .from('transparency_reports')
        .delete()
        .eq('id', report.id);

      if (dbErr) throw dbErr;

      setReports(prev => prev.filter(r => r.id !== report.id));
      triggerToast('Report and associated storage files deleted successfully.', 'success');
    } catch (err: any) {
      console.error('Deletion error:', err);
      triggerToast(err.message || 'Failed to delete report.', 'error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="bg-[#FAF7EA] min-h-screen font-sans antialiased text-stone-800">
      
      {/* Admin Panel Actions Bar */}
      {isAdmin && (
        <div className="bg-[#1A3C2E] border-b border-[#F5B400]/30 py-3 px-4 sm:px-6 sticky top-[66px] z-40 text-stone-200 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-[#F5B400] animate-pulse" />
            <span className="font-sans font-black text-xs uppercase tracking-wider text-[#FAF7EA]">
              CCIS Transparency Ledger Control Console
            </span>
            {isUsingMockData && (
              <span className="bg-[#F5B400] text-[#1A3C2E] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
                Fallback Active
              </span>
            )}
          </div>
          <div>
            <button
              onClick={() => openForm(null)}
              className="px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[#1A3C2E] bg-[#FAF7EA] border border-white hover:bg-stone-100 rounded-full flex items-center gap-1.5 transition-all shadow-sm cursor-pointer focus:ring-2 focus:ring-[#F5B400] outline-none"
            >
              <Plus size={12} />
              Publish Document
            </button>
          </div>
        </div>
      )}

      {/* Custom Toast Portal */}
      <div className="fixed top-28 right-4 z-[99] flex flex-col gap-2 max-w-sm w-full pointer-events-none" id="bukas-kaban-toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`p-4 rounded-2xl shadow-2xl flex items-start gap-3 pointer-events-auto border animate-toast-in text-[#FAF7EA] ${
              t.type === 'success' 
                ? 'bg-emerald-800 border-emerald-700' 
                : t.type === 'error' 
                  ? 'bg-rose-800 border-rose-700' 
                  : t.type === 'info'
                    ? 'bg-[#1A3C2E] border-[#FAF7EA]/20'
                    : 'bg-amber-800 border-amber-700'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="shrink-0 mt-0.5 text-[#F5B400]" size={16} />
            ) : t.type === 'error' ? (
              <AlertTriangle className="shrink-0 mt-0.5 text-rose-300" size={16} />
            ) : (
              <Info className="shrink-0 mt-0.5 text-[#F5B400]" size={16} />
            )}
            <div className="flex-1 font-sans">
              <p className="text-xs font-black uppercase tracking-wide text-white">
                {t.type === 'success' ? 'Success' : t.type === 'error' ? 'Action Failed' : t.type === 'info' ? 'Info' : 'Notice'}
              </p>
              <p className="text-[11px] text-stone-200 leading-relaxed mt-0.5">{t.message}</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-[#FAF7EA] hover:opacity-75 focus:outline-none cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Main Page Layout */}
      <section className="pt-12 pb-20 px-4 md:px-8 max-w-6xl mx-auto">
        
        {/* Ledger Header */}
        <div className="border-b-2 border-stone-200 pb-8 mb-10 text-left">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-stone-400 font-bold block mb-2">
            Civic Transparency Archives
          </span>
          <h1 className="font-serif font-black text-4xl sm:text-5xl text-[#1A3C2E] tracking-tight leading-tight">
            Bukas Kaban Drive
          </h1>
          <p className="text-stone-600 text-sm mt-3 leading-relaxed">
            Every report the council publishes, in one place.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-stone-400 font-mono">
            <span className="bg-stone-200/50 px-3 py-1 rounded-md border border-stone-200">
              LEDGER STATUS: ACTIVE
            </span>
            <span className="bg-stone-200/50 px-3 py-1 rounded-md border border-stone-200">
              LAST UPDATE: {lastUpdatedText}
            </span>
          </div>
        </div>

        {/* Filter Navigation Pill-Tabs */}
        {semestersList.length > 2 && (
          <div className="flex flex-wrap gap-2 mb-8 bg-stone-200/30 p-1.5 rounded-2xl border border-stone-200/50">
            {semestersList.map(sem => (
              <button
                key={sem}
                onClick={() => setSelectedSemester(sem)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-[#1A3C2E] outline-none cursor-pointer ${
                  selectedSemester === sem
                    ? 'bg-[#1A3C2E] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                {sem === 'All' ? 'All Semesters' : sem}
              </button>
            ))}
          </div>
        )}

        {/* Content list or Loading Skel */}
        {loading ? (
          /* Ledger Loading Skeleton */
          <div className="relative pl-10 sm:pl-16 space-y-12">
            <div className="absolute left-4 sm:left-8 top-0 bottom-0 w-0.5 bg-stone-200" />
            {[1, 2, 3].map(i => (
              <div key={i} className="relative animate-pulse flex flex-col sm:flex-row gap-6 bg-white p-6 sm:p-8 rounded-3xl border border-stone-200">
                <div className="absolute -left-[28px] sm:-left-[36px] top-8 w-3 h-3 rounded-full bg-stone-200 border border-white" />
                <div className="w-28 sm:w-36 h-36 sm:h-48 bg-stone-100 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-4">
                  <div className="h-4 bg-stone-200 rounded w-1/4" />
                  <div className="h-6 bg-stone-200 rounded w-3/4" />
                  <div className="h-4 bg-stone-200 rounded w-5/6" />
                  <div className="h-4 bg-stone-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16 bg-white border border-stone-200 rounded-3xl p-8 max-w-md mx-auto">
            <FileText className="mx-auto text-stone-300 mb-4" size={40} />
            <h3 className="font-serif font-black text-stone-800 text-lg mb-1">Archive Empty</h3>
            <p className="text-stone-500 text-xs leading-relaxed">
              No reports published for this semester yet.
            </p>
          </div>
        ) : (
          /* Timeline Feed */
          <div className="relative pl-4 sm:pl-10">
            {/* Timeline Spine rail */}
            <div className="absolute left-4 sm:left-8 top-2 bottom-6 w-0.5 bg-stone-300" />

            {/* Render items chronological newest first */}
            {filteredReports.map((report, idx) => {
              const showSemesterHeader = idx === 0 || filteredReports[idx - 1].semester !== report.semester;
              const formattedDate = new Date(report.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });

              return (
                <div key={report.id} className="relative">
                  {/* Semester Subheading */}
                  {showSemesterHeader && (
                    <div className="flex items-center gap-3 my-6 select-none">
                      <div className="absolute -left-[2px] sm:left-[28px] w-2 h-2 rounded-full bg-[#1A3C2E]" />
                      <h3 className="font-serif font-black text-xs uppercase tracking-wider text-stone-900 bg-white border border-stone-200/80 px-4 py-1.5 rounded-full shadow-xs inline-block ml-6 sm:ml-12 font-mono">
                        {report.semester}
                      </h3>
                    </div>
                  )}

                  {/* Document Card Entry */}
                  <div className="relative ml-6 sm:ml-12 mb-10 flex flex-col sm:flex-row gap-6 bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-2xs hover:shadow-md hover:bg-[#1A3C2E] hover:border-[#1A3C2E] hover:text-white transition-all duration-300 group">
                    {/* Spine anchor node */}
                    <div className="absolute -left-[30px] sm:-left-[42px] top-8 w-2.5 h-2.5 rounded-full bg-stone-300 border-2 border-[#FAF7EA] group-hover:bg-[#1A3C2E] group-hover:scale-110 transition-all shadow-xs" />

                    {/* Left side preview thumbnail */}
                    <div className="w-28 sm:w-36 h-36 sm:h-48 bg-stone-100 rounded-2xl border border-stone-200 shadow-2xs shrink-0 flex items-center justify-center relative overflow-hidden transition-all duration-300 hover:scale-[1.02] group-hover:border-[#F5B400]/20">
                      {report.thumbnailUrl ? (
                        <img
                          src={report.thumbnailUrl}
                          alt={`First page preview of ${report.title}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <PDFPlaceholder title={report.title} />
                      )}
                      
                      {/* View Action overlay on hover */}
                      <a
                        href={report.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-[#1A3C2E]/60 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center text-white text-xs font-black uppercase tracking-wider gap-1.5 focus:opacity-100 focus:outline-none"
                      >
                        <Eye size={14} />
                        View PDF
                      </a>
                    </div>

                    {/* Right side contents */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-[9px] bg-stone-150 text-stone-600 px-2 py-0.5 rounded font-black tracking-wider uppercase group-hover:bg-white/15 group-hover:text-white transition-colors">
                          REF-{report.id.substring(0, 8).toUpperCase()}
                        </span>
                        <span className="font-mono text-[9px] text-stone-400 group-hover:text-stone-300 font-bold transition-colors">{formattedDate}</span>
                      </div>

                      <h4 className="font-serif font-black text-stone-900 group-hover:text-[#FAF7EA] text-lg sm:text-xl md:text-2xl leading-tight mb-2 transition-colors">
                        {report.title}
                      </h4>

                      <p className="text-xs sm:text-sm text-stone-500 group-hover:text-stone-200 leading-relaxed font-sans pr-4 mb-4 transition-colors">
                        {report.caption}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-4 mt-auto pt-3 border-t border-stone-100 group-hover:border-white/10 transition-colors">
                        {/* Size & Term tags */}
                        <div className="flex items-center gap-3 text-[10px] text-stone-400 group-hover:text-stone-300 font-mono font-bold uppercase tracking-tight transition-colors">
                          <span className="flex items-center gap-1">📁 {report.fileSizeLabel}</span>
                          <span className="flex items-center gap-1">🏷️ {report.semester}</span>
                        </div>

                        {/* Actions block */}
                        <div className="flex items-center gap-3">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openForm(report)}
                                className="p-1 text-stone-400 group-hover:text-stone-300 hover:text-stone-800 group-hover:hover:text-white transition-colors focus:ring-2 focus:ring-[#1A3C2E] rounded outline-none cursor-pointer"
                                title="Edit Document Metadata"
                              >
                                <Edit size={14} />
                              </button>
                              
                              {deleteConfirmId === report.id ? (
                                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 p-0.5 rounded-lg">
                                  <button
                                    onClick={() => handleDeleteReport(report)}
                                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase rounded shadow-sm cursor-pointer"
                                  >
                                    YES
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2 py-0.5 bg-stone-200 group-hover:bg-white/10 hover:bg-stone-350 group-hover:hover:bg-white/20 text-stone-600 group-hover:text-stone-200 text-[9px] font-black uppercase rounded shadow-sm cursor-pointer transition-colors"
                                  >
                                    NO
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(report.id)}
                                  className="p-1 text-stone-400 group-hover:text-stone-300 hover:text-rose-600 group-hover:hover:text-rose-400 transition-colors focus:ring-2 focus:ring-rose-500 rounded outline-none cursor-pointer"
                                  title="Delete Document"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </>
                          )}
                          
                          <a
                            href={report.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#1A3C2E] hover:text-[#F5B400] group-hover:text-[#F5B400] group-hover:hover:text-[#ffc522] transition-colors focus:outline-none focus:underline"
                          >
                            View Report <Eye size={12} className="inline" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ============================================================
          ADMIN MODAL UPLOAD / EDIT DIALOG
          ============================================================ */}
      {showFormModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white max-w-md w-full rounded-3xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-[#1A3C2E] text-white px-6 py-4 flex items-center justify-between border-b border-[#F5B400]/20 shrink-0">
              <h3 className="font-serif font-black text-base tracking-wide">
                {editTarget ? 'Edit Transparency Record' : 'Publish New Report'}
              </h3>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all cursor-pointer"
                disabled={formSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 font-sans text-xs">
              
              {/* Report Title */}
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-stone-400 mb-1.5">
                  Report Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Orgfee Collection Summary — 1st Semester A.Y. 2025-2026"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] transition-all text-xs"
                  disabled={formSubmitting}
                />
              </div>

              {/* Short Caption */}
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-stone-400 mb-1.5">
                  Short Caption / Summary *
                </label>
                <textarea
                  required
                  value={formCaption}
                  onChange={(e) => setFormCaption(e.target.value)}
                  placeholder="Summarize what this report covers (1-2 sentences)..."
                  maxLength={250}
                  rows={3}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] transition-all text-xs resize-none"
                  disabled={formSubmitting}
                />
                <span className="text-[9px] text-stone-400 block text-right font-mono mt-1">
                  {formCaption.length}/250 characters
                </span>
              </div>

              {/* Semester/Term selection */}
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-stone-400 mb-1.5">
                  Semester / Term *
                </label>
                
                <div className="flex flex-col gap-2">
                  <select
                    value={formIsNewSemester ? 'NEW' : formSemester}
                    onChange={(e) => {
                      if (e.target.value === 'NEW') {
                        setFormIsNewSemester(true);
                      } else {
                        setFormIsNewSemester(false);
                        setFormSemester(e.target.value);
                      }
                    }}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] transition-all text-xs font-mono"
                    disabled={formSubmitting}
                  >
                    {formSemestersOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value="NEW">+ Add New Semester...</option>
                  </select>

                  {formIsNewSemester && (
                    <input
                      type="text"
                      required
                      value={formCustomSemester}
                      onChange={(e) => setFormCustomSemester(e.target.value)}
                      placeholder="e.g. 1st Semester A.Y. 2026-2027"
                      className="w-full bg-[#FAF7EA]/50 border border-[#F5B400]/40 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A3C2E] transition-all text-xs font-mono"
                      disabled={formSubmitting}
                    />
                  )}
                </div>
              </div>

              {/* PDF Document Selector */}
              <div>
                <label className="block text-[10px] font-mono uppercase font-bold text-stone-400 mb-1.5">
                  PDF Document {editTarget ? '(Optional replacement)' : '*'}
                </label>
                <div className="border-2 border-dashed border-stone-200 hover:border-stone-400 rounded-2xl p-4 transition-all text-center relative bg-stone-50">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={formSubmitting}
                  />
                  <FileText className="mx-auto text-stone-300 mb-2" size={28} />
                  <span className="text-[11px] font-bold block text-stone-700">
                    {selectedFile ? selectedFile.name : 'Select PDF File'}
                  </span>
                  <span className="text-[9px] text-stone-400 font-mono block mt-1">
                    PDF format only. Max file size: 50MB
                  </span>
                </div>
              </div>

              {/* Dynamic preview block */}
              {isGeneratingThumbnail && (
                <div className="flex items-center justify-center gap-2 p-3 bg-stone-50 border border-stone-150 rounded-2xl">
                  <Loader2 className="animate-spin text-[#1A3C2E]" size={16} />
                  <span className="text-[10px] font-mono text-stone-500">Generating preview thumbnail client-side...</span>
                </div>
              )}

              {thumbnailPreviewUrl && !isGeneratingThumbnail && (
                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-stone-400 mb-1.5">
                    Preview Thumbnail (Generated from PDF page 1)
                  </label>
                  <div className="w-20 h-28 border border-stone-200 shadow-sm rounded-lg overflow-hidden relative">
                    <img src={thumbnailPreviewUrl} alt="Thumbnail Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-4 flex gap-3 border-t border-stone-150 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="flex-1 py-3 text-center border border-stone-200 rounded-xl hover:bg-stone-50 font-black uppercase tracking-wider text-stone-600 transition-all cursor-pointer"
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || isGeneratingThumbnail}
                  className="flex-1 py-3 text-center bg-[#1A3C2E] hover:bg-[#123524] disabled:bg-stone-300 text-white rounded-xl font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border border-[#F5B400]/20"
                >
                  {formSubmitting && <Loader2 className="animate-spin" size={14} />}
                  {editTarget ? 'Save Changes' : 'Publish Report'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
