import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'rounded' | 'circular';
}

export function Skeleton({ className = '', variant = 'rounded' }: SkeletonProps) {
  const variantClass =
    variant === 'circular'
      ? 'rounded-full'
      : variant === 'rectangular'
      ? 'rounded-none'
      : 'rounded-xl';

  return (
    <div
      className={`animate-pulse bg-stone-200/80 ${variantClass} ${className}`}
      aria-hidden="true"
    />
  );
}

/** Skeleton for Announcements Bulletin */
export function AnnouncementsSkeleton({ previewMode = false }: { previewMode?: boolean }) {
  if (previewMode) {
    return (
      <section className="py-16 bg-[#FAF7EA]/50 border-b border-[#1A3C2E]/10" id="announcements-preview">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
            <div>
              <Skeleton className="h-3.5 w-32 mb-2 bg-[#1A3C2E]/10" />
              <Skeleton className="h-9 w-64 mb-3 bg-[#1A3C2E]/15" />
              <Skeleton className="h-1 w-16 bg-[#FFBC00]/40" />
            </div>
            <Skeleton className="h-5 w-40 mt-4 md:mt-0 bg-[#1A3C2E]/10" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 border border-zinc-150 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-20 rounded-full bg-amber-100/60" />
                    <Skeleton className="h-4 w-28 bg-stone-200" />
                  </div>
                  <Skeleton className="h-6 w-4/5 bg-stone-200/90" />
                  <Skeleton className="h-4 w-full bg-stone-100" />
                  <Skeleton className="h-4 w-3/4 bg-stone-100" />
                </div>
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton variant="circular" className="w-6 h-6 bg-stone-200" />
                    <Skeleton className="h-3.5 w-24 bg-stone-200" />
                  </div>
                  <Skeleton className="h-4 w-20 bg-stone-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <Skeleton className="h-4 w-36 mx-auto mb-2 bg-stone-300" />
        <Skeleton className="h-10 w-72 mx-auto mb-3 bg-stone-300" />
        <Skeleton className="h-4 w-96 max-w-full mx-auto mb-4 bg-stone-200" />
        <Skeleton className="h-1.5 w-16 mx-auto bg-[#FFBC00]/50" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Skeleton className="h-11 rounded-xl bg-stone-200/80 md:col-span-2" />
        <Skeleton className="h-11 rounded-xl bg-stone-200/80" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm space-y-4 flex flex-col justify-between h-64"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-20 rounded-full bg-amber-100/60" />
                <Skeleton className="h-4 w-24 bg-stone-200" />
              </div>
              <Skeleton className="h-6 w-5/6 bg-stone-200" />
              <Skeleton className="h-4 w-full bg-stone-100" />
              <Skeleton className="h-4 w-2/3 bg-stone-100" />
            </div>
            <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton variant="circular" className="w-6 h-6 bg-stone-200" />
                <Skeleton className="h-3.5 w-20 bg-stone-200" />
              </div>
              <Skeleton className="h-4 w-16 bg-stone-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for Upcoming Events Strip */
export function UpcomingEventsSkeleton() {
  return (
    <div className="space-y-3 font-sans">
      <Skeleton className="h-4 w-36 mb-2 bg-[#123524]/10" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-zinc-100 shadow-sm">
          <Skeleton className="w-12 h-12 rounded-xl bg-stone-200 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-4/5 bg-stone-200" />
            <Skeleton className="h-3 w-1/2 bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for Calendar Grid */
export function CalendarGridSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-36 bg-stone-200" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-lg bg-stone-200" />
          <Skeleton className="h-8 w-8 rounded-lg bg-stone-200" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center py-1">
            <Skeleton className="h-3 w-4 mx-auto bg-stone-200" />
          </div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-xl bg-stone-100" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton for Registration Page Events Grid */
export function RegistrationGridSkeleton() {
  return (
    <div className="bg-[#FAF7EA] min-h-screen text-[#1A3C2E] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <Skeleton className="h-3.5 w-24 mx-auto mb-2 bg-[#5E6E64]/20" />
          <Skeleton className="h-9 w-80 max-w-full mx-auto mb-2 bg-[#1A3C2E]/20" />
          <Skeleton className="h-4 w-96 max-w-full mx-auto mb-3 bg-[#5E6E64]/15" />
          <Skeleton className="h-1.5 w-16 bg-[#F5B400]/40 mx-auto rounded-full" />
        </div>

        {/* Filter Pills Skeleton */}
        <div className="flex justify-center gap-2 mb-8">
          <Skeleton className="h-9 w-24 rounded-full bg-stone-200" />
          <Skeleton className="h-9 w-28 rounded-full bg-stone-200" />
          <Skeleton className="h-9 w-28 rounded-full bg-stone-200" />
        </div>

        {/* Grid Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
              <Skeleton className="h-44 w-full rounded-none bg-stone-200" />
              <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20 bg-stone-200 rounded-full" />
                    <Skeleton className="h-4 w-24 bg-stone-200" />
                  </div>
                  <Skeleton className="h-6 w-5/6 bg-stone-300" />
                  <Skeleton className="h-3.5 w-full bg-stone-100" />
                  <Skeleton className="h-3.5 w-2/3 bg-stone-100" />
                </div>
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <Skeleton className="h-4 w-24 bg-stone-200" />
                  <Skeleton className="h-9 w-28 rounded-xl bg-stone-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for FAQ Accordion */
export function FaqSkeleton() {
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-zinc-150 shadow-sm flex items-center justify-between">
          <Skeleton className="h-5 w-3/4 bg-stone-200" />
          <Skeleton variant="circular" className="w-6 h-6 bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for Gallery Page */
export function GallerySkeleton() {
  return (
    <div className="min-h-screen bg-[#FAF7EA] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <Skeleton className="h-4 w-28 mx-auto bg-stone-300" />
          <Skeleton className="h-10 w-72 mx-auto bg-stone-300" />
          <Skeleton className="h-4 w-96 max-w-full mx-auto bg-stone-200" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
              <Skeleton className="h-52 w-full rounded-none bg-stone-200" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-stone-300" />
                <Skeleton className="h-3 w-1/2 bg-stone-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for Bukas Kaban / Transparency Page */
export function TransparencySkeleton() {
  return (
    <div className="min-h-screen bg-[#FAF7EA] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <Skeleton className="h-4 w-32 mx-auto bg-stone-300" />
          <Skeleton className="h-10 w-80 mx-auto bg-stone-300" />
          <Skeleton className="h-4 w-96 max-w-full mx-auto bg-stone-200" />
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-3">
              <Skeleton className="h-4 w-28 bg-stone-200" />
              <Skeleton className="h-9 w-40 bg-stone-300" />
              <Skeleton className="h-3 w-32 bg-stone-100" />
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
          <Skeleton className="h-6 w-48 bg-stone-200 mb-4" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-100">
              <Skeleton className="h-4 w-1/4 bg-stone-200" />
              <Skeleton className="h-4 w-1/5 bg-stone-200" />
              <Skeleton className="h-4 w-1/6 bg-stone-200" />
              <Skeleton className="h-4 w-20 bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for Patches Page */
export function PatchSkeleton() {
  return (
    <div className="min-h-screen bg-[#FAF7EA] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <Skeleton className="h-4 w-32 mx-auto bg-stone-300" />
          <Skeleton className="h-10 w-64 mx-auto bg-stone-300" />
          <Skeleton className="h-4 w-80 max-w-full mx-auto bg-stone-200" />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-6 md:p-8 border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32 bg-amber-100 rounded-full" />
                <Skeleton className="h-4 w-24 bg-stone-200" />
              </div>
              <Skeleton className="h-6 w-3/4 bg-stone-300" />
              <Skeleton className="h-4 w-full bg-stone-100" />
              <Skeleton className="h-4 w-5/6 bg-stone-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for Account Profile & Pass */
export function AccountSkeleton() {
  return (
    <div className="min-h-screen bg-[#FAF7EA] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Profile Card Header */}
        <div className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm flex flex-col md:flex-row items-center gap-6">
          <Skeleton variant="circular" className="w-24 h-24 bg-stone-200 flex-shrink-0" />
          <div className="flex-1 text-center md:text-left space-y-2 w-full">
            <Skeleton className="h-7 w-56 mx-auto md:mx-0 bg-stone-300" />
            <Skeleton className="h-4 w-40 mx-auto md:mx-0 bg-stone-200" />
            <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-2">
              <Skeleton className="h-6 w-20 rounded-full bg-stone-200" />
              <Skeleton className="h-6 w-24 rounded-full bg-stone-200" />
            </div>
          </div>
        </div>

        {/* Universal Pass Card Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
            <Skeleton className="h-6 w-44 bg-stone-300" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-12 bg-stone-100 rounded-xl" />
              <Skeleton className="h-12 bg-stone-100 rounded-xl" />
              <Skeleton className="h-12 bg-stone-100 rounded-xl" />
              <Skeleton className="h-12 bg-stone-100 rounded-xl" />
            </div>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm flex flex-col items-center justify-center space-y-4">
            <Skeleton className="h-48 w-48 rounded-2xl bg-stone-200" />
            <Skeleton className="h-4 w-32 bg-stone-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full Page Layout Fallback Skeleton */
export function FullPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#FAF7EA] flex flex-col justify-between">
      <div className="h-20 bg-[#123524] border-b border-white/10 px-8 flex items-center justify-between">
        <Skeleton className="h-8 w-36 bg-white/20" />
        <div className="hidden md:flex gap-6">
          <Skeleton className="h-4 w-16 bg-white/15" />
          <Skeleton className="h-4 w-16 bg-white/15" />
          <Skeleton className="h-4 w-16 bg-white/15" />
          <Skeleton className="h-4 w-16 bg-white/15" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl bg-[#FFBC00]/30" />
      </div>
      <div className="max-w-7xl mx-auto px-4 py-16 w-full space-y-12">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-96 max-w-full mx-auto bg-stone-300" />
          <Skeleton className="h-5 w-80 max-w-full mx-auto bg-stone-200" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 rounded-3xl bg-stone-200" />
          <Skeleton className="h-48 rounded-3xl bg-stone-200" />
          <Skeleton className="h-48 rounded-3xl bg-stone-200" />
        </div>
      </div>
      <div className="h-24 bg-[#123524] border-t border-white/10" />
    </div>
  );
}
