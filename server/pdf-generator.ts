import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export interface PDFGenerationOptions {
  templateContent: string;
  fieldValues: Record<string, any>;
  fileName?: string;
}

export class PDFGenerator {
  private static replacePlaceholders(template: string, values: Record<string, any>): string {
    let result = template;
    
    // Replace ##field## placeholders
    Object.entries(values).forEach(([key, value]) => {
      const placeholder = `##${key}##`;
      const stringValue = value?.toString() || '';
      
      // Apply text transformations based on field settings
      let transformedValue = stringValue;
      if (values[`${key}_transform`]) {
        switch (values[`${key}_transform`]) {
          case 'uppercase':
            transformedValue = stringValue.toUpperCase();
            break;
          case 'capitalize':
            transformedValue = stringValue.replace(/\b\w/g, (l: string) => l.toUpperCase());
            break;
          case 'toggle':
            transformedValue = stringValue.split('').map((c: string) => 
              c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()
            ).join('');
            break;
          default:
            transformedValue = stringValue;
        }
      }
      
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), transformedValue);
    });
    
    // Add current date
    const currentDate = new Date().toLocaleDateString('en-GB');
    result = result.replace(/##currentDate##/g, currentDate);
    result = result.replace(/##current_date##/g, currentDate);
    
    return result;
  }

  private static getDefaultHTMLTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Authority Letter</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 20px;
            color: #000;
        }
        .logo-section {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 15px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #666;
            margin-bottom: 5px;
        }
        .logo-subtitle {
            font-size: 10px;
            color: #999;
            letter-spacing: 2px;
        }
        .header {
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            margin: 20px 0 30px 0;
            text-decoration: underline;
        }
        .date {
            text-align: left;
            margin-bottom: 20px;
        }
        .address-section {
            margin-bottom: 20px;
        }
        .address-line {
            margin-bottom: 3px;
        }
        .subject {
            font-weight: bold;
            margin: 30px 0 20px 0;
            text-align: center;
            text-decoration: underline;
            font-size: 13px;
        }
        .content {
            margin-bottom: 20px;
            text-align: justify;
            line-height: 1.5;
        }
        .note {
            font-weight: bold;
            margin: 20px 0;
            font-style: italic;
        }
        .thanking {
            margin: 30px 0 40px 0;
        }
        .signature-section {
            margin-top: 40px;
        }
        .company-name {
            font-weight: bold;
            margin-bottom: 40px;
        }
        .signature-line {
            border-bottom: 1px solid #000;
            width: 200px;
            margin: 15px 0 5px 0;
        }
        .footer {
            position: fixed;
            bottom: 15px;
            left: 20px;
            right: 20px;
            font-size: 8px;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 10px;
        }
        .footer-line {
            margin-bottom: 2px;
        }
        @media print {
            body { margin: 0; padding: 15px; }
        }
    </style>
</head>
<body>
    <div class="logo-section">
        <div class="logo">☀ Light</div>
        <div class="logo-subtitle">MICROFINANCE</div>
    </div>
    
    <div class="header">AUTHORITY LETTER</div>
    
    <div class="date">##current_date##</div>
    
    <div class="address-section">
        <div>To,</div>
        <br>
        <div class="address-line">##courier_company##</div>
        <div class="address-line">##courier_address##</div>
    </div>
    
    <div class="subject">SUB- LETTER AUTHORISING M/S ##courier_company##</div>
    
    <div class="content">
Dear Sir/Ma'am,<br><br>
We hereby authorize M/s. ##courier_company## to provide the services of transporting the System of ##company_name## from Head Office ##head_office_location## to its branch office ##branch_location## "##branch_name##" said authority is only for transporting the computer system to the above-mentioned branch address and not any other purpose.
    </div>
    
    <div class="note">
        *NOTE: - NOT FOR SALE THIS ##asset_name## ARE FOR ONLY OFFICE USE. (Asset Value ##asset_value## /-)
    </div>
    
    <div class="thanking">
        <u>Thanking you,</u>
    </div>
    
    <div class="signature-section">
        <div class="company-name">FOR ##company_name##</div>
        
        <div class="signature-line"></div>
        <div>##signatory_name##</div>
        <div>[##signatory_designation##]</div>
    </div>

    <div class="footer">
        <div class="footer-line">##company_name##</div>
        <div class="footer-line">Registered Office: - ##registered_office##</div>
        <div class="footer-line">Corporate Office: - ##corporate_office##</div>
    </div>
</body>
</html>`;
  }

  public static async generatePDF(options: PDFGenerationOptions): Promise<Buffer> {
    let browser;
    try {
      // Use the default template if none provided
      const template = options.templateContent || this.getDefaultHTMLTemplate();
      
      // Replace placeholders with actual values
      const htmlContent = this.replacePlaceholders(template, options.fieldValues);
      
      // Launch Puppeteer with system Chromium
      browser = await puppeteer.launch({
        headless: true,
        executablePath: '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // This helps in serverless environments
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      const page = await browser.newPage();
      
      // Set content and generate PDF
      await page.setContent(htmlContent);
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });
      
      return Buffer.from(pdfBuffer);
      
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  public static async generateBulkPDFs(
    templateContent: string,
    csvData: Array<Record<string, any>>,
    fieldMappings: Record<string, string>
  ): Promise<Array<{ data: Buffer; fileName: string }>> {
    const results: Array<{ data: Buffer; fileName: string }> = [];
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const fieldValues: Record<string, any> = {};
      
      // Map CSV columns to template fields
      Object.entries(fieldMappings).forEach(([templateField, csvColumn]) => {
        fieldValues[templateField] = row[csvColumn] || '';
      });
      
      // Generate unique filename
      const fileName = `authority_letter_${i + 1}_${Date.now()}.pdf`;
      
      try {
        const pdfBuffer = await this.generatePDF({
          templateContent,
          fieldValues,
          fileName
        });
        
        results.push({
          data: pdfBuffer,
          fileName
        });
      } catch (error) {
        console.error(`Failed to generate PDF for row ${i + 1}:`, error);
        // Continue with other rows
      }
    }
    
    return results;
  }
}