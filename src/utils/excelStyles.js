// Excel styling constants and color schemes for professional export

// Category Color Schemes
export const CATEGORY_COLORS = {
  labour: {
    primary: '#3B82F6',      // Blue
    light: '#EFF6FF',        // Light blue
    dark: '#1E40AF'          // Dark blue
  },
  trade: {
    primary: '#9333EA',       // Purple
    light: '#F3E8FF',        // Light purple
    dark: '#7C3AED'          // Dark purple
  },
  equipment: {
    primary: '#10B981',       // Green
    light: '#D1FAE5',        // Light green
    dark: '#059669'          // Dark green
  },
  service: {
    primary: '#4F46E5',      // Indigo
    light: '#E0E7FF',        // Light indigo
    dark: '#4338CA'          // Dark indigo
  },
  purchase: {
    primary: '#F97316',      // Orange
    light: '#FFEDD5',        // Light orange
    dark: '#EA580C'          // Dark orange
  },
  installation: {
    primary: '#EF4444',      // Red
    light: '#FEE2E2',        // Light red
    dark: '#DC2626'          // Dark red
  }
};

// Status Colors
export const STATUS_COLORS = {
  reviewed: '#D1FAE5',       // Light green
  pending: '#FEF3C7'         // Light yellow
};

// Header Colors
export const HEADER_COLORS = {
  primary: '#1E3A8A',        // Dark blue
  secondary: '#F3F4F6',      // Light gray
  text: '#FFFFFF',           // White text
  textSecondary: '#374151'   // Dark gray text
};

// Font Styles
export const FONT_STYLES = {
  title: {
    name: 'Arial',
    size: 18,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  },
  header: {
    name: 'Arial',
    size: 14,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  },
  subheader: {
    name: 'Arial',
    size: 11,
    bold: true,
    color: { argb: 'FF374151' }
  },
  data: {
    name: 'Arial',
    size: 10,
    bold: false,
    color: { argb: 'FF000000' }
  },
  summary: {
    name: 'Arial',
    size: 11,
    bold: true,
    color: { argb: 'FF000000' }
  }
};

// Border Styles
export const BORDER_STYLES = {
  thick: {
    style: 'thick',
    color: { argb: 'FF000000' }
  },
  thin: {
    style: 'thin',
    color: { argb: 'FF000000' }
  },
  double: {
    style: 'double',
    color: { argb: 'FF000000' }
  }
};

// Alignment Styles
export const ALIGNMENT = {
  center: {
    horizontal: 'center',
    vertical: 'middle'
  },
  left: {
    horizontal: 'left',
    vertical: 'middle'
  },
  right: {
    horizontal: 'right',
    vertical: 'middle'
  }
};

// Number Format Styles
export const NUMBER_FORMATS = {
  currency: '$#,##0.00',
  percentage: '0.0%',
  date: 'MM/DD/YYYY',
  number: '#,##0.00',
  hours: '0.0',
  integer: '#,##0'
};

// Helper function to convert hex color to Excel ARGB format
export const hexToArgb = (hex) => {
  const cleanHex = hex.replace('#', '');
  return `FF${cleanHex}`;
};

// Helper function to get category color
export const getCategoryColor = (category, type = 'primary') => {
  return CATEGORY_COLORS[category]?.[type] || CATEGORY_COLORS.labour[type];
};

// Helper function to get status color
export const getStatusColor = (status) => {
  return STATUS_COLORS[status] || STATUS_COLORS.pending;
};

// Helper function to create cell style
export const createCellStyle = (options = {}) => {
  const {
    font = FONT_STYLES.data,
    fill = null,
    border = null,
    alignment = ALIGNMENT.left,
    numFmt = null
  } = options;

  return {
    font,
    fill: fill ? { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(fill) } } : undefined,
    border,
    alignment,
    numFmt
  };
};

// Predefined cell styles for common use cases
export const CELL_STYLES = {
  title: createCellStyle({
    font: FONT_STYLES.title,
    fill: HEADER_COLORS.primary,
    alignment: ALIGNMENT.center
  }),
  header: createCellStyle({
    font: FONT_STYLES.header,
    fill: HEADER_COLORS.primary,
    alignment: ALIGNMENT.center,
    border: {
      top: BORDER_STYLES.thin,
      bottom: BORDER_STYLES.thick,
      left: BORDER_STYLES.thin,
      right: BORDER_STYLES.thin
    }
  }),
  subheader: createCellStyle({
    font: FONT_STYLES.subheader,
    fill: HEADER_COLORS.secondary,
    alignment: ALIGNMENT.left
  }),
  data: createCellStyle({
    font: FONT_STYLES.data,
    alignment: ALIGNMENT.left
  }),
  currency: createCellStyle({
    font: FONT_STYLES.data,
    alignment: ALIGNMENT.right,
    numFmt: NUMBER_FORMATS.currency
  }),
  percentage: createCellStyle({
    font: FONT_STYLES.data,
    alignment: ALIGNMENT.right,
    numFmt: NUMBER_FORMATS.percentage
  }),
  date: createCellStyle({
    font: FONT_STYLES.data,
    alignment: ALIGNMENT.center,
    numFmt: NUMBER_FORMATS.date
  }),
  number: createCellStyle({
    font: FONT_STYLES.data,
    alignment: ALIGNMENT.right,
    numFmt: NUMBER_FORMATS.number
  }),
  hours: createCellStyle({
    font: FONT_STYLES.data,
    alignment: ALIGNMENT.right,
    numFmt: NUMBER_FORMATS.hours
  }),
  summary: createCellStyle({
    font: FONT_STYLES.summary,
    alignment: ALIGNMENT.right,
    border: {
      top: BORDER_STYLES.double,
      bottom: BORDER_STYLES.thin,
      left: BORDER_STYLES.thin,
      right: BORDER_STYLES.thin
    }
  })
};

const excelStyles = {
  CATEGORY_COLORS,
  STATUS_COLORS,
  HEADER_COLORS,
  FONT_STYLES,
  BORDER_STYLES,
  ALIGNMENT,
  NUMBER_FORMATS,
  hexToArgb,
  getCategoryColor,
  getStatusColor,
  createCellStyle,
  CELL_STYLES
};

export default excelStyles;
