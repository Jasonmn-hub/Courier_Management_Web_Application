import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Palette, Monitor, Sun, Moon, Droplets, Leaf, Grape } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-9 w-9 px-0"
        disabled
      >
        <Palette className="h-4 w-4" />
        <span className="sr-only">Loading theme...</span>
      </Button>
    );
  }

  return <ThemeToggleContent />;
}

function ThemeToggleContent() {
  const { theme, setTheme, themes } = useTheme();

  const getThemeIcon = (themeName: string) => {
    switch (themeName) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      case "blue":
        return <Droplets className="h-4 w-4" />;
      case "green":
        return <Leaf className="h-4 w-4" />;
      case "purple":
        return <Grape className="h-4 w-4" />;
      case "system":
        return <Monitor className="h-4 w-4" />;
      default:
        return <Palette className="h-4 w-4" />;
    }
  };

  const getThemeLabel = (themeName: string) => {
    switch (themeName) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      case "blue":
        return "Blue";
      case "green":
        return "Green";
      case "purple":
        return "Purple";
      case "system":
        return "System";
      default:
        return themeName.charAt(0).toUpperCase() + themeName.slice(1);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-9 w-9 px-0"
          data-testid="button-theme-toggle"
        >
          {getThemeIcon(theme || "light")}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {["system", ...themes].map((themeName) => (
          <DropdownMenuItem
            key={themeName}
            onClick={() => setTheme(themeName)}
            className="flex items-center gap-2"
            data-testid={`theme-option-${themeName}`}
          >
            {getThemeIcon(themeName)}
            <span>{getThemeLabel(themeName)}</span>
            {theme === themeName && (
              <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}