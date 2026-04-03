import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSingleSelectProps {
  label: string;
  placeholder: string;
  options: SelectOption[];
  value: string;
  onChange: (nextValue: string) => void;
}

export function SearchableSingleSelect({ label, placeholder, options, value, onChange }: SearchableSingleSelectProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLabel = useMemo(() => options.find((item) => item.value === value)?.label ?? '', [options, value]);
  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const visible = normalizedSearch
      ? options.filter((option) => option.label.toLowerCase().includes(normalizedSearch))
      : options;

    return visible.slice(0, 250);
  }, [options, search]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current) {
        return;
      }

      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs text-muted-foreground block mb-2">{label}</label>

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="w-full border border-border bg-input-background hover:bg-secondary rounded-lg px-3 py-2.5 text-left text-sm text-foreground flex items-center justify-between"
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <ChevronDown className="w-4 h-4 opacity-70" />
      </button>

      {isOpen ? (
        <div className="absolute z-40 mt-2 w-full border border-border rounded-lg bg-popover shadow-xl">
          <div className="p-2 border-b border-border">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? <p className="text-xs text-muted-foreground px-3 py-2">No match found</p> : null}
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-foreground hover:bg-secondary flex items-center"
              >
                <Check className={`mr-2 h-4 w-4 ${option.value === value ? 'opacity-100' : 'opacity-0'}`} />
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
