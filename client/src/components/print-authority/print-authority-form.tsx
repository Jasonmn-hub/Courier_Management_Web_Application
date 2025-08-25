import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Printer } from "lucide-react";

// List of branches from the uploaded file
const BRANCHES = [
  "Abu Road", "Agar Malwa", "Ameth", "Anand", "Badnagar", "Bagidora", "Balotra", "Bansur", 
  "Bardoli", "Barmer", "Beawar", "Behror", "Bharatpur", "Bhavnagar", "Bhawanimandi", "Bhilwara", 
  "Bhim", "Bhinder", "Bhinmal", "Bhiwani", "Bijainagar", "Bijoliya", "Bikaner", "Bilaspur", 
  "Botad", "Charkhi Dadri", "Degana", "Dholka", "Dhrangadhra", "Falna", "Fatepura", "Gadhada", 
  "Gandhidham2", "Gandhinagar", "Ghoghamba", "Guna", "Halol", "Hanumangarh", "Hisar", "Hoshangabad", 
  "Idar", "Indore", "Jaora", "Jasdan", "Jhajjar", "Jhalawar", "Jhunjhunu", "Jind", "Jirapur", 
  "Kaithal", "Khatushyamji", "Kheda", "Kherli", "Kosli", "Kota", "Ladwa", "Limdi", "Limkheda", 
  "Losal", "Lunawada", "Mandalgarh", "Mandsaur", "Maninagar", "Morbi", "Morva", "Nadiad", "Nagor", 
  "Naraingarh", "Neem Ka Thana", "Nimbahera", "Nohar", "Nokha", "Padmapur", "Padra", "Pali", 
  "Palitana", "Panipat", "Parbatsar", "Pataudi", "Petlad", "Pilani", "Piplod", "Rajkot", "Rajsamand", 
  "Ratangarh", "Ratlam", "Sagwara", "Salumbar", "Sanjeli", "Santrampur", "Sardarshahar", "Shahpura 2", 
  "Shamgarh", "Singhana", "Sirohi", "Sirsa", "Suratgarh", "Takhatgarh", "Taranagar", "Thanagazi", 
  "Thandla", "Thasra", "Udaipurwati", "Ujjain", "Vadali", "Valsad", "Viramgam", "Vyara", "Waghodia", 
  "Godhara", "Jetpur", "Jam Khambhalia", "Kangra", "Una", "Deoli", "Bassi", "Sanchor", "Gohana", 
  "Sonipat", "Bhopalgarh", "Uklana Mandi", "Jamnagar", "Anuppur", "Chhatarpur", "Dabra", "Katni", 
  "Dahod", "Mandla", "Rewa", "Satna", "Sidhi", "Bilaspur_Hp", "Malpura", "Osian", "Gudha Malani", 
  "Nakhatrana", "Paonta Sahib", "Ellishbridge", "Bayana", "Gharaunda", "Jhabua", "Meghraj", "Mora", 
  "Jhabrera", "Chauhtan", "Bar", "Ramganjmandi", "Gangartalai", "Devgarhbaria", "Didwana", "Asind", 
  "Mahwa", "Shakkargarh", "Sarsawa", "Bhattu Mandi", "Zalod", "Meghnagar", "Dharuhera", "Pundri", 
  "Naroda", "Sukhsar", "Shamli", "Diwada", "Dhanpur", "Muzaffarnagar", "Nagal", "Dhampur", 
  "Shikohabad", "Chhata", "Balakati", "Khambhat", "Siyana", "Najibabad", "Govardhan", "Mawana", 
  "Khatauli", "Gajraula", "Kiraoli", "Tundla", "Kashipur", "Khair", "Fatehabad", "Rudrapur", 
  "Laksar", "Chandikhol", "Khorda", "Keonjhar", "Champua", "Odagaon", "Balugaon", "Bundu", 
  "Nischintakoili", "Mander", "Balikuda", "Bhadrak", "Chatra", "Rahama", "Jind 2", "Giridih", 
  "Limdi-2", "Shant Road", "Shahera", "Domchanch", "Nayagarh", "Basudevpur", "Barhi", "Rajganj", 
  "Chandankiyari", "Bisrampur", "Aska", "Bhanjanagar", "Kamakhyanagar", "Dhenkanal", "Hazaribagh", 
  "Deoghar", "Rajdhanwar", "Panki", "Gumla", "Bagodar", "Patan", "Talcher", "Chhendipada", "Angul", 
  "Digapahandi", "Hinjilicut", "Buguda", "Sasni", "Kasganj", "Jalesar", "Bulandshahr", "Sakhigopal", 
  "Lohgarh", "Gangapur", "Garbada", "Rania", "Gira", "Jojawar", "Kalyanpur", "Khairthal", "Kumher", 
  "Ramsar", "Rupbas", "Sikar", "Sindhari", "Laxmangarh", "Damnagar", "Singvad", "Waghjipur", 
  "Malhargarh", "Raghogarh"
];

const printAuthoritySchema = z.object({
  branch: z.string().min(1, "Branch is required"),
  fromAddress: z.string().min(1, "From address is required"),
  toAddress: z.string().min(1, "To address is required"),
});

type PrintAuthorityFormData = z.infer<typeof printAuthoritySchema>;

export default function PrintAuthorityForm() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<PrintAuthorityFormData>({
    resolver: zodResolver(printAuthoritySchema),
    defaultValues: {
      branch: "",
      fromAddress: "",
      toAddress: "",
    },
  });

  const onSubmit = async (data: PrintAuthorityFormData) => {
    setIsGenerating(true);
    try {
      // For now, we'll just show a success message
      // In a real implementation, you would generate a PDF or print document
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
      
      toast({
        title: "Print Authority Generated",
        description: `Print authority created for ${data.branch} branch`,
      });
      
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate print authority",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Print Authority Later
        </CardTitle>
        <p className="text-sm text-slate-500">
          Generate print authority documents for later processing
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Branch Selection */}
            <div className="space-y-2">
              <Label htmlFor="branch">Branch *</Label>
              <Select 
                value={form.watch("branch")} 
                onValueChange={(value) => form.setValue("branch", value)}
              >
                <SelectTrigger data-testid="select-branch">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {BRANCHES.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.branch && (
                <p className="text-sm text-red-500">{form.formState.errors.branch.message}</p>
              )}
            </div>

            {/* From Address */}
            <div className="space-y-2">
              <Label htmlFor="fromAddress">From Address *</Label>
              <Input
                id="fromAddress"
                placeholder="Enter from address"
                {...form.register("fromAddress")}
                data-testid="input-from-address"
              />
              {form.formState.errors.fromAddress && (
                <p className="text-sm text-red-500">{form.formState.errors.fromAddress.message}</p>
              )}
            </div>

            {/* To Address */}
            <div className="space-y-2">
              <Label htmlFor="toAddress">To Address *</Label>
              <Input
                id="toAddress"
                placeholder="Enter to address"
                {...form.register("toAddress")}
                data-testid="input-to-address"
              />
              {form.formState.errors.toAddress && (
                <p className="text-sm text-red-500">{form.formState.errors.toAddress.message}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isGenerating}
              className="flex items-center gap-2"
              data-testid="button-generate-authority"
            >
              <Printer className="h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate Print Authority"}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              data-testid="button-reset-form"
            >
              Reset Form
            </Button>
          </div>

          {/* Preview Section */}
          {form.watch("branch") && form.watch("fromAddress") && form.watch("toAddress") && (
            <div className="mt-6 p-4 bg-slate-50 rounded-lg border">
              <h3 className="font-medium mb-3">Print Authority Preview:</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Branch:</strong> {form.watch("branch")}</p>
                <p><strong>From:</strong> {form.watch("fromAddress")}</p>
                <p><strong>To:</strong> {form.watch("toAddress")}</p>
                <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}