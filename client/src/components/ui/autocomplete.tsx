import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutocompleteOption {
  value: string;
  label: string;
}

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  onAddNew?: (value: string) => void;
  className?: string;
  "data-testid"?: string;
}

export function Autocomplete({
  value,
  onChange,
  options,
  placeholder = "Type to search...",
  onAddNew,
  className,
  "data-testid": testId
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<AutocompleteOption[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && value && value.length >= 2) {
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(value.toLowerCase()) ||
        option.value.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOptions(filtered);
      setHighlightedIndex(-1);
    } else if (isOpen && value && value.length < 2) {
      // Show empty state when less than 2 characters
      setFilteredOptions([]);
      setHighlightedIndex(-1);
    } else {
      setFilteredOptions(options);
      setHighlightedIndex(-1);
    }
  }, [value, options, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
  };

  const handleOptionSelect = (option: AutocompleteOption) => {
    onChange(option.value);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleOptionSelect(filteredOptions[highlightedIndex]);
        } else if (value && !options.find(opt => opt.value === value) && onAddNew) {
          onAddNew(value);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleAddNew = () => {
    if (value && onAddNew) {
      onAddNew(value);
      setIsOpen(false);
    }
  };

  const showAddButton = value && 
    !options.find(opt => opt.value.toLowerCase() === value.toLowerCase()) && 
    onAddNew;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        data-testid={testId}
        className="w-full"
      />
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <div
                key={option.value}
                className={cn(
                  "px-3 py-2 cursor-pointer flex items-center justify-between",
                  "hover:bg-gray-100",
                  highlightedIndex === index && "bg-gray-100"
                )}
                onClick={() => handleOptionSelect(option)}
              >
                <span className="whitespace-nowrap flex-1 mr-2">{option.label}</span>
                {value === option.value && <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-gray-500 text-sm">
              {value && value.length < 2 ? "Type at least 2 characters to see suggestions..." : "No matches found"}
            </div>
          )}
          
          {showAddButton && (
            <div className="border-t border-gray-200 p-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddNew}
                className="w-full text-sm flex items-center gap-2"
                data-testid={`${testId}-add-new`}
              >
                <Plus className="h-4 w-4" />
                Add "{value}"
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}