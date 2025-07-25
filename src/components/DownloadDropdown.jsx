import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react';

const DownloadDropdown = ({ onExportCSV, onExportPDF, disabled = false, title = "Export" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExportCSV = () => {
    onExportCSV();
    setIsOpen(false);
  };

  const handleExportPDF = () => {
    onExportPDF();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`p-1 rounded hover:bg-surface-tertiary transition-colors flex items-center gap-1 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        title={title}
      >
        <Download className="w-4 h-4 text-text-secondary" />
        <ChevronDown className="w-3 h-3 text-text-secondary" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-1 w-32 bg-surface-primary border border-surface-tertiary rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleExportCSV}
              className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-tertiary flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-text-secondary" />
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-tertiary flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-text-secondary" />
              Export PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadDropdown; 