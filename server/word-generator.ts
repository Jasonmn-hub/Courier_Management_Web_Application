import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import { FieldTransformations, FieldTransformOptions } from './field-transformations';

export interface WordGenerationOptions {
  templatePath: string;
  fieldValues: Record<string, any>;
  fieldConfigs?: Record<string, FieldTransformOptions>;
  fileName?: string;
}

export class WordGenerator {
  private static processFieldValues(fieldValues: Record<string, any>, fieldConfigs: Record<string, FieldTransformOptions> = {}): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Process field values and apply transformations using the new utility
    Object.entries(fieldValues).forEach(([key, value]) => {
      const config = fieldConfigs[key] || {};
      result[key] = FieldTransformations.transformFieldValue(value, config);
    });
    
    // Add current date in multiple formats for backward compatibility (only if not already set)
    const currentDate = new Date().toLocaleDateString('en-GB');
    if (!result['currentDate']) result['currentDate'] = currentDate;
    if (!result['current_date']) result['current_date'] = currentDate;
    if (!result['Currunt Date']) result['Currunt Date'] = currentDate; // Handle typo in existing templates
    if (!result['Current Date']) result['Current Date'] = currentDate;
    
    return result;
  }

  static async generateWordDocument(options: WordGenerationOptions): Promise<Buffer> {
    try {
      // Read the Word template file
      const templateBuffer = fs.readFileSync(options.templatePath);
      const zip = new PizZip(templateBuffer);
      
      // Create docxtemplater instance with all options
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '##',
          end: '##'
        }
      });

      // Process field values with transformations
      const processedValues = this.processFieldValues(options.fieldValues, options.fieldConfigs || {});
      
      try {
        // Render the document with processed data
        doc.render(processedValues);
      } catch (error: any) {
        // Handle template rendering errors
        console.error('Template rendering error:', error);
        console.error('Processed values:', processedValues);
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