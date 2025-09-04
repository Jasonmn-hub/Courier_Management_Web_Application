import React, { useState, useRef, useEffect } from "react";
import { X, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailSuggestion {
  email: string;
  name?: string;
  type?: 'user' | 'branch' | 'contact' | 'suggestion';
}

interface MultiEmailInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: EmailSuggestion[];
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

export default function MultiEmailInput({
  value,
  onChange,
  placeholder = "Type email addresses...",
  suggestions = [],
  className,
  disabled = false,
  'data-testid': testId,
}: MultiEmailInputProps) {
  const [emails, setEmails] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<EmailSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Initialize emails from value prop
  useEffect(() => {
    if (value) {
      const emailList = value.split(',').map(email => email.trim()).filter(Boolean);
      setEmails(emailList);
    } else {
      setEmails([]);
    }
  }, [value]);

  // Update parent when emails change
  useEffect(() => {
    const emailString = emails.join(', ');
    if (emailString !== value) {
      onChange(emailString);
    }
  }, [emails, onChange, value]);

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.length > 0) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.email.toLowerCase().includes(inputValue.toLowerCase()) ||
        (suggestion.name && suggestion.name.toLowerCase().includes(inputValue.toLowerCase()))
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
    setSelectedSuggestionIndex(-1);
  }, [inputValue, suggestions]);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addEmail = (email: string) => {
    const trimmedEmail = email.trim();
    if (trimmedEmail && isValidEmail(trimmedEmail) && !emails.includes(trimmedEmail)) {
      setEmails(prev => [...prev, trimmedEmail]);
      setInputValue("");
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const removeEmail = (indexToRemove: number) => {
    setEmails(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
        addEmail(filteredSuggestions[selectedSuggestionIndex].email);
      } else if (inputValue) {
        addEmail(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      removeEmail(emails.length - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        Math.min(prev + 1, filteredSuggestions.length - 1)
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    } else if (e.key === ',' || e.key === ';') {
      e.preventDefault();
      if (inputValue) {
        addEmail(inputValue);
      }
    }
  };

  const handleSuggestionClick = (suggestion: EmailSuggestion) => {
    addEmail(suggestion.email);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputFocus = () => {
    if (filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }, 150);
  };

  const getCommonEmailSuggestions = () => {
    const input = inputValue.toLowerCase();
    if (input && input.includes('@')) {
      return [];
    }
    
    const domains = [
      'gmail.com',
      'outlook.com',
      'hotmail.com',
      'yahoo.com',
      'lightfinance.com'
    ];
    
    if (input.length > 0) {
      return domains.map(domain => ({
        email: `${input}@${domain}`,
        name: `${input}@${domain}`,
        type: 'suggestion' as const
      }));
    }
    
    return [];
  };

  const allSuggestions = [
    ...filteredSuggestions,
    ...getCommonEmailSuggestions()
  ];

  return (
    <div className={cn("relative", className)}>
      <div 
        className={cn(
          "min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "flex flex-wrap gap-1 items-center",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email, index) => (
          <div
            key={index}
            className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-xs"
          >
            <Mail className="h-3 w-3" />
            <span>{email}</span>
            <button
              type="button"
              onClick={() => removeEmail(index)}
              className="hover:bg-primary/20 rounded-full p-0.5"
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={emails.length === 0 ? placeholder : ""}
          disabled={disabled}
          className="flex-1 min-w-0 outline-none bg-transparent"
          data-testid={testId}
        />
      </div>

      {showSuggestions && allSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto"
        >
          {allSuggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2",
                index === selectedSuggestionIndex && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">{suggestion.email}</div>
                {suggestion.name && suggestion.name !== suggestion.email && (
                  <div className="text-xs text-muted-foreground">{suggestion.name}</div>
                )}
              </div>
              {suggestion.type && (
                <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                  {suggestion.type}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}