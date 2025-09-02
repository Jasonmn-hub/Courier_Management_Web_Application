import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Check, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutocompleteOption {
  value: string;
  label: string;
  type?: 'user' | 'branch';
  profileImageUrl?: string;
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
    // Show suggestions after 1 character is typed
    if (isOpen && value && value.length >= 1) {
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(value.toLowerCase()) ||
        option.value.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOptions(filtered);
      setHighlightedIndex(-1);
    } else if (isOpen && value && value.length < 1) {
      // Show empty state when no characters and dropdown is open
      setFilteredOptions([]);
      setHighlightedIndex(-1);
    } else if (!isOpen) {
      // When dropdown is closed, reset filtered options and highlighted index
      setFilteredOptions([]);
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
        // Trigger useEffect to filter options based on current input value
        // This ensures that when the dropdown opens, it's already filtered
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
        } else if (value && !options.find(opt => opt.value.toLowerCase() === value.toLowerCase()) && onAddNew) {
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

  const handleFocus = () => {
    // When the input is focused, and the value has at least 2 characters, open the dropdown and show filtered options
    if (value && value.length >= 2) {
      setIsOpen(true);
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(value.toLowerCase()) ||
        option.value.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOptions(filtered);
      setHighlightedIndex(-1);
    } else if (value && value.length < 2) {
      // If less than 2 characters, show the "Type at least 2 characters" message
      setFilteredOptions([]);
      setIsOpen(true);
    } else {
      // If input is empty, show all options or handle as needed
      setFilteredOptions(options); // Or setFilteredOptions([]) if you don't want to show anything initially
      setIsOpen(true);
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
        onFocus={handleFocus} // Use the new handleFocus function
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        data-testid={testId}
        className="w-full"
      />

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {value && value.length < 2 ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              Type at least 2 characters to see suggestions...
            </div>
          ) : filteredOptions.length > 0 ? (
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
                <div className="flex items-center gap-2 flex-1 mr-2">
                  {option.type === 'user' && (
                    <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {option.profileImageUrl ? (
                        <img 
                          src={option.profileImageUrl} 
                          alt="Profile" 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  )}
                  <span className="whitespace-nowrap">{option.label}</span>
                </div>
                {value === option.value && <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-gray-500 text-sm">
              No matches found
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