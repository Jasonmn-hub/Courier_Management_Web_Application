import { format } from 'date-fns';

export interface FieldTransformOptions {
  textTransform?: string;
  numberFormat?: string;
  dateFormat?: string;
  fieldType?: string;
}

export class FieldTransformations {
  /**
   * Apply text transformations based on the specified transform type
   */
  static applyTextTransform(value: string, transform: string = 'none'): string {
    if (!value || typeof value !== 'string') return value || '';
    
    switch (transform) {
      case 'sentence':
        // Sentence case - first letter uppercase, rest lowercase
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
        
      case 'lowercase':
        return value.toLowerCase();
        
      case 'uppercase':
        return value.toUpperCase();
        
      case 'capitalize_words':
        // Capitalize Each Word
        return value.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        
      case 'toggle':
        // tOGGLE CASE - swap upper and lower case
        return value.split('').map(char => 
          char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()
        ).join('');
        
      case 'capitalize':
      case 'none':
      default:
        return value;
    }
  }

  /**
   * Apply number formatting based on the specified format type
   */
  static applyNumberFormat(value: any, numberFormat: string = 'none'): string {
    if (value === null || value === undefined) return '';
    
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : Number(value);
    
    if (isNaN(numValue)) return value.toString();
    
    switch (numberFormat) {
      case 'with_commas':
        return numValue.toLocaleString('en-US');
        
      case 'none':
      default:
        return numValue.toString();
    }
  }

  /**
   * Apply date formatting based on the specified format type
   */
  static applyDateFormat(value: any, dateFormat: string = 'DD-MM-YYYY'): string {
    if (!value) return '';
    
    // Parse the date - handle various input formats
    let date: Date;
    
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      // Try to parse different date formats
      date = new Date(value);
      if (isNaN(date.getTime())) {
        // Try parsing DD-MM-YYYY format
        const parts = value.split(/[-/.]/);
        if (parts.length === 3) {
          // Assume DD-MM-YYYY format
          date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
    } else {
      date = new Date(value);
    }
    
    if (isNaN(date.getTime())) return value.toString();
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthAbbr = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    const monthName = monthNames[date.getMonth()];
    const monthShort = monthAbbr[date.getMonth()];
    
    switch (dateFormat) {
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      case 'MM-DD-YYYY':
        return `${month}-${day}-${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY/MM/DD':
        return `${year}/${month}/${day}`;
      case 'DD.MM.YYYY':
        return `${day}.${month}.${year}`;
      case 'MM.DD.YYYY':
        return `${month}.${day}.${year}`;
      case 'YYYY.MM.DD':
        return `${year}.${month}.${day}`;
      case 'DD Mon YYYY':
        return `${day} ${monthShort} ${year}`;
      case 'DD Month YYYY':
        return `${day} ${monthName} ${year}`;
      case 'Month DD, YYYY':
        return `${monthName} ${day}, ${year}`;
      case 'YYYY Month DD':
        return `${year} ${monthName} ${day}`;
      default:
        return `${day}-${month}-${year}`;
    }
  }

  /**
   * Transform field value based on field configuration
   */
  static transformFieldValue(value: any, field: FieldTransformOptions): string {
    if (value === null || value === undefined) return '';
    
    let transformedValue = value.toString();
    
    // Apply transformations based on field type
    switch (field.fieldType) {
      case 'text':
      case 'textarea':
        transformedValue = this.applyTextTransform(transformedValue, field.textTransform);
        break;
        
      case 'number':
        transformedValue = this.applyNumberFormat(value, field.numberFormat);
        break;
        
      case 'date':
        transformedValue = this.applyDateFormat(value, field.dateFormat);
        break;
        
      default:
        // For unknown field types, just apply text transform if specified
        if (field.textTransform && field.textTransform !== 'none') {
          transformedValue = this.applyTextTransform(transformedValue, field.textTransform);
        }
    }
    
    return transformedValue;
  }

  /**
   * Transform all field values using their configurations
   */
  static transformAllFields(fieldValues: Record<string, any>, fieldConfigs: Record<string, FieldTransformOptions>): Record<string, any> {
    const result: Record<string, any> = {};
    
    Object.entries(fieldValues).forEach(([fieldName, value]) => {
      const config = fieldConfigs[fieldName] || {};
      result[fieldName] = this.transformFieldValue(value, config);
    });
    
    return result;
  }
}