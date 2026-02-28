import { dataManager } from '../services/dataManager';

import { logger } from './logger';

/**
 * Export JSON data and trigger download
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function exportJSONData(onProgress = () => {}) {
  try {
    onProgress('Preparing data...');
    const { blob, filename } = await dataManager.exportData('json', onProgress);

    // Create blob URL and trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up blob URL to prevent memory leaks
    URL.revokeObjectURL(url);

    logger.success('Data exported successfully');
    return { success: true };
  } catch (error) {
    logger.error('Error exporting JSON:', error);
    return {
      success: false,
      error: error.message || 'Export failed',
    };
  }
}
