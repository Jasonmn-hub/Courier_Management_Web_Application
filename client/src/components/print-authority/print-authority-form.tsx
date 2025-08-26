import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Printer, FileText } from "lucide-react";
import { format } from "date-fns";

export default function PrintAuthorityForm() {
  const [formData, setFormData] = useState({
    currentDate: new Date(),
    address: "",
    assetName: "",
    value: "",
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (value: string) => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^\d.]/g, '');
    
    // Add commas for thousands separator
    if (numericValue) {
      const parts = numericValue.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    }
    return '';
  };

  const handleValueChange = (value: string) => {
    const formatted = formatCurrency(value);
    handleInputChange("value", formatted);
  };

  const handlePrint = () => {
    // Create the authority letter with the user's data
    const authorityLetterContent = `
AUTHORITY LETTER

${format(formData.currentDate, 'dd/MM/yyyy')}

To,

Maruti Courier 

UF-16, Sanskar-1 Complex

Nr Ketav Petrol Pump

Polytechnic Road Ambawadi

Ahmedabad -380015



SUB- LETTER AUTHORISING M/S MARUTI COURIER

Dear Sir/Ma'am,

We hereby authorize M/s. Maruti Courier to provide the services of transporting the System of Light Microfinance Pvt. Ltd. from Head Office Ahmedabad to its branch office Light Microfinance "${formData.address}" said authority is only for transporting the computer system to the above-mentioned branch address and not any other purpose. 



*NOTE: - NOT FOR SALE THIS ${formData.assetName.toUpperCase()} ARE FOR ONLY OFFICE USE. (Asset Value ${formData.value} /-)



Thanking you,



FOR LIGHT MICROFINANCE PVT. LTD



_____________________________

Jigar Jodhani

[Manager - IT]
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Authority Letter</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
                line-height: 1.6;
                max-width: 800px;
                margin: 0 auto;
              }
              .letter-content {
                white-space: pre-wrap;
                font-size: 14px;
              }
              @media print {
                body { margin: 0; padding: 15px; }
              }
            </style>
          </head>
          <body>
            <div class="letter-content">${authorityLetterContent}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Authority Letter Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="current-date">Current Date</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-select-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.currentDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.currentDate}
                    onSelect={(date) => {
                      if (date) {
                        setFormData((prev) => ({ ...prev, currentDate: date }));
                        setIsCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <Label htmlFor="value">Asset Value</Label>
              <Input
                id="value"
                placeholder="Enter asset value (e.g., 50,000)"
                value={formData.value}
                onChange={(e) => handleValueChange(e.target.value)}
                data-testid="input-asset-value"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Branch Address</Label>
            <Textarea
              id="address"
              placeholder="Enter branch address for Light Microfinance"
              value={formData.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
              rows={3}
              data-testid="textarea-address"
            />
          </div>

          <div>
            <Label htmlFor="asset-name">Asset Name</Label>
            <Input
              id="asset-name"
              placeholder="Enter asset name (e.g., Computer System)"
              value={formData.assetName}
              onChange={(e) => handleInputChange("assetName", e.target.value)}
              data-testid="input-asset-name"
            />
            <p className="text-sm text-slate-500 mt-1">
              Asset name will automatically be converted to capitals in the letter
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handlePrint} 
              className="flex items-center gap-2"
              data-testid="button-print-authority"
            >
              <Printer className="h-4 w-4" />
              Generate & Print Authority Letter
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setFormData({
                currentDate: new Date(),
                address: "",
                assetName: "",
                value: "",
              })}
              data-testid="button-clear-form"
            >
              Clear Form
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Letter Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 p-4 rounded-md font-mono text-sm whitespace-pre-wrap">
            {`AUTHORITY LETTER

${format(formData.currentDate, 'dd/MM/yyyy')}

To,

Maruti Courier 

UF-16, Sanskar-1 Complex

Nr Ketav Petrol Pump

Polytechnic Road Ambawadi

Ahmedabad -380015



SUB- LETTER AUTHORISING M/S MARUTI COURIER

Dear Sir/Ma'am,

We hereby authorize M/s. Maruti Courier to provide the services of transporting the System of Light Microfinance Pvt. Ltd. from Head Office Ahmedabad to its branch office Light Microfinance "${formData.address || '##Address##'}" said authority is only for transporting the computer system to the above-mentioned branch address and not any other purpose. 



*NOTE: - NOT FOR SALE THIS ${formData.assetName ? formData.assetName.toUpperCase() : '##Asset Name##'} ARE FOR ONLY OFFICE USE. (Asset Value ${formData.value || '##Value##'} /-)



Thanking you,



FOR LIGHT MICROFINANCE PVT. LTD



_____________________________

Jigar Jodhani

[Manager - IT]`}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}