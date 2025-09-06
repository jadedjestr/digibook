import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { createPortal } from 'react-dom';

const IconSelector = ({ value, onChange, categories }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const buttonRef = useRef(null);
  const modalRef = useRef(null);

  const filteredCategories = searchTerm
    ? categories.map(category => ({
      ...category,
      icons: category.icons.filter(icon =>
        icon.toLowerCase().includes(searchTerm.toLowerCase()) ||
          category.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    })).filter(category => category.icons.length > 0)
    : categories;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleIconSelect = (icon) => {
    onChange(icon);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Modal component to be rendered in portal
  const Modal = () => (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 999999 }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl glass-panel border border-white/10 shadow-2xl"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-medium text-white">Select Icon</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <span className="text-white/60 hover:text-white">✕</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search icons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input w-full pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Icons Grid */}
        <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {filteredCategories.map(category => (
            <div key={category.name} className="mb-6 last:mb-0">
              <h4 className="text-sm font-medium text-white/60 mb-3">{category.name}</h4>
              <div className="grid grid-cols-8 gap-2">
                {category.icons.map(icon => (
                  <button
                    key={icon}
                    onClick={() => handleIconSelect(icon)}
                    className={`aspect-square flex items-center justify-center rounded-lg text-2xl
                      ${value === icon
                    ? 'bg-white/20 ring-2 ring-blue-500'
                    : 'hover:bg-white/10'
                  } transition-all duration-150`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <div className="text-center py-8 text-white/40">
              No icons found for "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="glass-input w-full flex items-center justify-between group cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{value}</span>
        </div>
        <span className="text-sm text-white/60 group-hover:text-white/80">
          Click to change
        </span>
      </button>

      {/* Portal the modal to the document body */}
      {isOpen && createPortal(<Modal />, document.body)}
    </>
  );
};

export default IconSelector;
