import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject, 
  listAll,
  getMetadata 
} from "firebase/storage";
import { storage } from "./config";

// Collection names
const STORAGE_PATHS = {
  RECEIPTS: 'receipts'
};

/**
 * Upload a receipt image to Firebase Storage
 * @param {string} accessCode - User's access code
 * @param {string} expenseId - Expense ID
 * @param {File} imageFile - Image file to upload
 * @returns {Promise<{success: boolean, url?: string, path?: string, error?: string}>}
 */
export const uploadReceiptImage = async (accessCode, expenseId, imageFile) => {
  try {
    // Validate inputs
    if (!accessCode || !expenseId || !imageFile) {
      throw new Error('Missing required parameters: accessCode, expenseId, or imageFile');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(imageFile.type)) {
      throw new Error('Invalid file type. Please upload JPG, PNG, GIF, or WebP images.');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (imageFile.size > maxSize) {
      throw new Error('File size too large. Please upload images smaller than 5MB.');
    }

    // Compress image if needed (basic compression)
    const compressedFile = await compressImage(imageFile);

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const fileExtension = imageFile.name.split('.').pop() || 'jpg';
    const fileName = `receipt_${timestamp}.${fileExtension}`;
    
    // Create storage reference
    const storagePath = `${STORAGE_PATHS.RECEIPTS}/${accessCode}/${expenseId}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    // Upload file
    const uploadResult = await uploadBytes(storageRef, compressedFile);
    
    // Get download URL
    const downloadURL = await getDownloadURL(uploadResult.ref);

    return {
      success: true,
      url: downloadURL,
      path: storagePath,
      fileName: fileName,
      size: compressedFile.size,
      uploadedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error uploading receipt image:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get download URL for a receipt image
 * @param {string} accessCode - User's access code
 * @param {string} expenseId - Expense ID
 * @param {string} fileName - File name (optional, gets latest if not provided)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const getReceiptImageUrl = async (accessCode, expenseId, fileName = null) => {
  try {
    if (!accessCode || !expenseId) {
      throw new Error('Missing required parameters: accessCode or expenseId');
    }

    let storagePath;
    if (fileName) {
      storagePath = `${STORAGE_PATHS.RECEIPTS}/${accessCode}/${expenseId}/${fileName}`;
    } else {
      // Get the latest file in the expense folder
      const folderPath = `${STORAGE_PATHS.RECEIPTS}/${accessCode}/${expenseId}`;
      const folderRef = ref(storage, folderPath);
      const fileList = await listAll(folderRef);
      
      if (fileList.items.length === 0) {
        throw new Error('No receipt found for this expense');
      }
      
      // Get the most recent file
      const latestFile = fileList.items.sort((a, b) => {
        return b.name.localeCompare(a.name);
      })[0];
      
      storagePath = latestFile.fullPath;
    }

    const storageRef = ref(storage, storagePath);
    const downloadURL = await getDownloadURL(storageRef);

    return {
      success: true,
      url: downloadURL,
      path: storagePath
    };

  } catch (error) {
    console.error('Error getting receipt image URL:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete a receipt image from Firebase Storage
 * @param {string} accessCode - User's access code
 * @param {string} expenseId - Expense ID
 * @param {string} fileName - File name (optional, deletes all if not provided)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteReceiptImage = async (accessCode, expenseId, fileName = null) => {
  try {
    if (!accessCode || !expenseId) {
      throw new Error('Missing required parameters: accessCode or expenseId');
    }

    if (fileName) {
      // Delete specific file
      const storagePath = `${STORAGE_PATHS.RECEIPTS}/${accessCode}/${expenseId}/${fileName}`;
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } else {
      // Delete all files in the expense folder
      const folderPath = `${STORAGE_PATHS.RECEIPTS}/${accessCode}/${expenseId}`;
      const folderRef = ref(storage, folderPath);
      const fileList = await listAll(folderRef);
      
      // Delete all files
      const deletePromises = fileList.items.map(fileRef => deleteObject(fileRef));
      await Promise.all(deletePromises);
    }

    return {
      success: true
    };

  } catch (error) {
    console.error('Error deleting receipt image:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * List all receipt images for a user
 * @param {string} accessCode - User's access code
 * @returns {Promise<{success: boolean, receipts?: Array, error?: string}>}
 */
export const listReceiptImages = async (accessCode) => {
  try {
    if (!accessCode) {
      throw new Error('Missing required parameter: accessCode');
    }

    const userFolderPath = `${STORAGE_PATHS.RECEIPTS}/${accessCode}`;
    const userFolderRef = ref(storage, userFolderPath);
    const folderList = await listAll(userFolderRef);

    const receipts = [];

    // Get all expense folders
    for (const expenseFolder of folderList.prefixes) {
      const expenseId = expenseFolder.name;
      const expenseFolderRef = ref(storage, expenseFolder.fullPath);
      const fileList = await listAll(expenseFolderRef);

      // Get all files in this expense folder
      for (const fileRef of fileList.items) {
        try {
          const metadata = await getMetadata(fileRef);
          const downloadURL = await getDownloadURL(fileRef);
          
          receipts.push({
            expenseId,
            fileName: fileRef.name,
            url: downloadURL,
            path: fileRef.fullPath,
            size: metadata.size,
            uploadedAt: metadata.timeCreated,
            contentType: metadata.contentType
          });
        } catch (fileError) {
          console.warn(`Error getting metadata for file ${fileRef.name}:`, fileError);
        }
      }
    }

    return {
      success: true,
      receipts: receipts.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    };

  } catch (error) {
    console.error('Error listing receipt images:', error);
    return {
      success: false,
      error: error.message,
      receipts: []
    };
  }
};

/**
 * Compress image file to reduce size
 * @param {File} file - Original image file
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} quality - Compression quality (0-1)
 * @returns {Promise<File>} Compressed file
 */
const compressImage = async (file, maxWidth = 1920, quality = 0.8) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        const compressedFile = new File([blob], file.name, {
          type: file.type,
          lastModified: Date.now()
        });
        resolve(compressedFile);
      }, file.type, quality);
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Get receipt image metadata
 * @param {string} accessCode - User's access code
 * @param {string} expenseId - Expense ID
 * @returns {Promise<{success: boolean, metadata?: Object, error?: string}>}
 */
export const getReceiptImageMetadata = async (accessCode, expenseId) => {
  try {
    if (!accessCode || !expenseId) {
      throw new Error('Missing required parameters: accessCode or expenseId');
    }

    const folderPath = `${STORAGE_PATHS.RECEIPTS}/${accessCode}/${expenseId}`;
    const folderRef = ref(storage, folderPath);
    const fileList = await listAll(folderRef);

    if (fileList.items.length === 0) {
      return {
        success: false,
        error: 'No receipt found for this expense'
      };
    }

    // Get metadata for the latest file
    const latestFile = fileList.items.sort((a, b) => {
      return b.name.localeCompare(a.name);
    })[0];

    const metadata = await getMetadata(latestFile);
    const downloadURL = await getDownloadURL(latestFile);

    return {
      success: true,
      metadata: {
        fileName: latestFile.name,
        url: downloadURL,
        path: latestFile.fullPath,
        size: metadata.size,
        contentType: metadata.contentType,
        uploadedAt: metadata.timeCreated,
        updatedAt: metadata.updated
      }
    };

  } catch (error) {
    console.error('Error getting receipt metadata:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
