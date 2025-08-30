import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';

export interface WordGenerationOptions {
  templatePath: string;
  fieldValues: Record<string, any>;
  fileName?: string;
}

export class WordGenerator {
  private static replacePlaceholders(fieldValues: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Process field values and apply transformations
    Object.entries(fieldValues).forEach(([key, value]) => {
      const stringValue = value?.toString() || '';
      
      // Apply text transformations based on field settings
      let transformedValue = stringValue;
      if (fieldValues[`${key}_transform`]) {
        switch (fieldValues[`${key}_transform`]) {
          case 'uppercase':
            transformedValue = stringValue.toUpperCase();
            break;
          case 'capitalize':
            transformedValue = stringValue.split(' ').map((word: string) => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
            break;
          case 'toggle':
            transformedValue = stringValue.split('').map((char: string) => 
              char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()
            ).join('');
            break;
          default:
            transformedValue = stringValue;
        }
      }
      
      result[key] = transformedValue;
    });
    
    // Add current date
    const currentDate = new Date().toLocaleDateString('en-GB');
    result['currentDate'] = currentDate;
    result['current_date'] = currentDate;
    result['Currunt Date'] = currentDate; // Handle typo in existing templates
    
    return result;
  }

  static async generateWordDocument(options: WordGenerationOptions): Promise<Buffer> {
    try {
      // Read the Word template file
      const templateBuffer = fs.readFileSync(options.templatePath);
      const zip = new PizZip(templateBuffer);
      
      // Create docxtemplater instance
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // Process field values
      const processedValues = this.replacePlaceholders(options.fieldValues);
      
      // Set the template data
      doc.setData(processedValues);

      try {
        // Render the document
        doc.render();
      } catch (error: any) {
        // Handle template rendering errors
        throw new Error(`Template rendering failed: ${error.message}`);
      }

      // Generate the Word document buffer
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      return buffer;
    } catch (error: any) {
      console.error('Word generation error:', error);
      throw new Error(`Failed to generate Word document: ${error.message}`);
    }
  }

  static async generateBulkWordDocuments(
    templatePath: string,
    dataArray: Array<Record<string, any>>,
    fieldMappings: Record<string, string>
  ): Promise<Array<{ fileName: string; data: Buffer }>> {
    const results: Array<{ fileName: string; data: Buffer }> = [];

    for (let i = 0; i < dataArray.length; i++) {
      const rowData = dataArray[i];
      
      try {
        // Map CSV columns to template fields
        const mappedData: Record<string, any> = {};
        Object.entries(fieldMappings).forEach(([csvColumn, templateField]) => {
          if (rowData[csvColumn] !== undefined) {
            mappedData[templateField] = rowData[csvColumn];
          }
        });

        // Generate unique filename
        const fileName = `authority_letter_${i + 1}.docx`;
        
        // Generate Word document
        const wordBuffer = await this.generateWordDocument({
          templatePath,
          fieldValues: mappedData,
          fileName,
        });

        results.push({
          fileName,
          data: wordBuffer,
        });
      } catch (error) {
        console.error(`Failed to generate Word document for row ${i + 1}:`, error);
        // Continue with other documents
      }
    }

    return results;
  }
}