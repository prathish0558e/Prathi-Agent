import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Badge } from './ui/badge';

interface SearchableMultiSelectProps {
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (nextValues: string[]) => void;
}

const normalize = (value: string) => value.trim().toLowerCase();

export function SearchableMultiSelect({ label, placeholder, options, selected, onChange }: SearchableMultiSelectProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const optionSet = useMemo(() => new Set(options.map((item) => normalize(item))), [options]);
  const filteredOptions = useMemo(() => {
    const normalizedSearch = normalize(search);
    const visible = normalizedSearch
      ? options.filter((option) => normalize(option).includes(normalizedSearch))
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

  const toggleValue = (value: string) => {
    const normalizedValue = normalize(value);
    const exists = selected.some((item) => normalize(item) === normalizedValue);

    if (exists) {
      onChange(selected.filter((item) => normalize(item) !== normalizedValue));
      return;
    }

    onChange([...selected, value]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs text-muted-foreground block mb-2">{label}</label>

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="w-full border border-border bg-input-background hover:bg-secondary rounded-lg px-3 py-2.5 text-left text-sm text-foreground flex items-center justify-between"
      >
        <span className="truncate">{selected.length ? `${selected.length} selected` : placeholder}</span>
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
            {filteredOptions.map((option) => {
              const isSelected = selected.some((item) => normalize(item) === normalize(option));

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleValue(option)}
                  className="w-full text-left px-3 py-2 rounded-md text-sm text-foreground hover:bg-secondary flex items-center"
                >
                  <Check className={`mr-2 h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="truncate">{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {selected.map((item) => {
          const isCatalogValue = optionSet.has(normalize(item));
          return (
            <Badge
              key={item}
              variant="outline"
              className={`gap-1 ${isCatalogValue ? 'border-primary/30 text-primary' : 'border-amber-300/50 text-amber-700'}`}
            >
              {item}
              <button
                type="button"
                onClick={() => toggleValue(item)}
                className="rounded-full hover:bg-secondary p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
