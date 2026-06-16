import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Generate range of page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);
      
      if (start === 1) {
        end = maxVisible;
      } else if (end === totalPages) {
        start = totalPages - maxVisible + 1;
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-between border-t border-gray-100 bg-white px-4 py-3 sm:px-6 rounded-xl shadow-sm mt-4">
      {/* Mobile view */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>

      {/* Desktop view */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-gray-700">
            Page <span className="font-semibold">{currentPage}</span> of{' '}
            <span className="font-semibold">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-xs" aria-label="Pagination">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-md p-1.5 text-gray-400 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {pages[0] > 1 && (
              <>
                <button
                  onClick={() => onPageChange(1)}
                  className={`relative inline-flex items-center px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-gray-200 focus:z-20 ${
                    currentPage === 1
                      ? 'z-10 bg-[#1A3C2E] text-white'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  1
                </button>
                {pages[0] > 2 && (
                  <span className="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-400 ring-1 ring-inset ring-gray-200">
                    ...
                  </span>
                )}
              </>
            )}
            
            {pages.map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`relative inline-flex items-center px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-gray-200 focus:z-20 ${
                  currentPage === p
                    ? 'z-10 bg-[#1A3C2E] text-white'
                    : 'text-gray-950 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}

            {pages[pages.length - 1] < totalPages && (
              <>
                {pages[pages.length - 1] < totalPages - 1 && (
                  <span className="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-400 ring-1 ring-inset ring-gray-200">
                    ...
                  </span>
                )}
                <button
                  onClick={() => onPageChange(totalPages)}
                  className={`relative inline-flex items-center px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-gray-200 focus:z-20 ${
                    currentPage === totalPages
                      ? 'z-10 bg-[#1A3C2E] text-white'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-r-md p-1.5 text-gray-400 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
