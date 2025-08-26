import { useState } from "react";
import { Calendar, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ExportDialogProps {
  title: string;
  exportType: 'couriers' | 'audit-logs';
  children: React.ReactNode;
}

export function ExportDialog({ title, exportType, children }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem('auth_token');
      
      // Build query parameters
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const endpoint = exportType === 'couriers' ? '/api/couriers/export' : '/api/audit-logs/export';
      const url = `${endpoint}?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        
        // Generate filename with date range
        const dateRange = startDate && endDate ? `_${startDate}_to_${endDate}` : '';
        const filename = exportType === 'couriers' 
          ? `couriers-export${dateRange}.csv`
          : `audit-logs-export${dateRange}.csv`;
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        
        toast({
          title: "Export Successful",
          description: `${title} exported successfully.`,
        });
        
        setOpen(false);
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const clearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-slate-600">
            {exportType === 'couriers' 
              ? "Export both sent and received couriers data with status information."
              : "Export audit logs with user activity details."
            }
          </div>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="start-date" className="text-sm font-medium">
                Start Date (Optional)
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
                data-testid="input-start-date"
              />
            </div>
            
            <div>
              <Label htmlFor="end-date" className="text-sm font-medium">
                End Date (Optional)
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
                min={startDate || undefined}
                data-testid="input-end-date"
              />
            </div>
            
            {(startDate || endDate) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearDates}
                className="text-xs"
                data-testid="button-clear-dates"
              >
                Clear Dates (Export All)
              </Button>
            )}
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1"
              data-testid="button-export"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isExporting}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}