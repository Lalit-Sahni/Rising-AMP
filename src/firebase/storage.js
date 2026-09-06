import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable,
  getDownloadURL, 
  deleteObject, 
  listAll,
  getMetadata 
} from "firebase/storage";
import { getFirebaseStorage } from "./callable";
import { getActiveOrgId } from "./tenancy";

// Collection names
const STORAGE_PATHS = {
  RECEIPTS: 'receipts'
};

/**
 * Upload a receipt image to Firebase Storage
 * @param {string} jobId - Job ID
 * @param {string} expenseId - Expense ID
 * @param {File} imageFile - Image file to upload
 * @returns {Promise<{success: boolean, url?: string, path?: string, error?: string}>}
 */
export const uploadReceiptImage = async (jobId, expenseId, imageFile) => {
  const storage = await getFirebaseStorage();
  try {
    // Validate inputs
    if (!jobId || !expenseId || !imageFile) {
      throw new Error('Missing required parameters: jobId, expenseId, or imageFile');
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
    
    // Create storage reference. Path stays three segments so existing
    // receipts and currently deployed Storage rules keep working.
    // orgId is in custom metadata so rules can stop hardcoding the org.
    const storagePath = `${STORAGE_PATHS.RECEIPTS}/${jobId}/${expenseId}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    const uploadResult = await uploadBytes(storageRef, compressedFile, {
      contentType: compressedFile.type || imageFile.type,
      customMetadata: {
        orgId: getActiveOrgId(),
        jobId,
      },
    });
    
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
 * @param {string} jobId - Job ID
 * @param {string} expenseId - Expense ID
 * @param {string} fileName - File name (optional, gets latest if not provided)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const getReceiptImageUrl = async (jobId, expenseId, fileName = null) => {
  const storage = await getFirebaseStorage();
  try {
    if (!jobId || !expenseId) {
      throw new Error('Missing required parameters: jobId or expenseId');
    }

    let storagePath;
    if (fileName) {
      storagePath = `${STORAGE_PATHS.RECEIPTS}/${jobId}/${expenseId}/${fileName}`;
    } else {
      // Get the latest file in the expense folder
      const folderPath = `${STORAGE_PATHS.RECEIPTS}/${jobId}/${expenseId}`;
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
 * @param {string} jobId - Job ID
 * @param {string} expenseId - Expense ID
 * @param {string} fileName - File name (optional, deletes all if not provided)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteReceiptImage = async (jobId, expenseId, fileName = null) => {
  const storage = await getFirebaseStorage();
  try {
    if (!jobId || !expenseId) {
      throw new Error('Missing required parameters: jobId or expenseId');
    }

    if (fileName) {
      // Delete specific file
      const storagePath = `${STORAGE_PATHS.RECEIPTS}/${jobId}/${expenseId}/${fileName}`;
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } else {
      // Delete all files in the expense folder
      const folderPath = `${STORAGE_PATHS.RECEIPTS}/${jobId}/${expenseId}`;
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
 * @param {string} jobId - Job ID
 * @returns {Promise<{success: boolean, receipts?: Array, error?: string}>}
 */
export const listReceiptImages = async (jobId) => {
  const storage = await getFirebaseStorage();
  try {
    if (!jobId) {
      throw new Error('Missing required parameter: jobId');
    }

    const userFolderPath = `${STORAGE_PATHS.RECEIPTS}/${jobId}`;
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
 * Compress an image. Receipts and job files share this. If the browser
 * cannot decode the file (common with HEIC on desktop), the original is
 * returned so the caller can still store it when rules allow.
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} quality
 * @param {string | null} outputType - e.g. image/jpeg for HEIC
 * @returns {Promise<File>}
 */
export const compressImage = async (file, maxWidth = 1920, quality = 0.8, outputType = null) => {
  return new Promise((resolve) => {
    const type = String((file && file.type) || '');
    if (!file || !type.startsWith('image/') || type.includes('dwg')) {
      resolve(file);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const src = URL.createObjectURL(file);
    const finish = (result) => {
      URL.revokeObjectURL(src);
      resolve(result);
    };

    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      if (!ctx) {
        finish(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const blobType = outputType || file.type || 'image/jpeg';
      canvas.toBlob((blob) => {
        if (!blob) {
          finish(file);
          return;
        }
        let name = file.name || 'image';
        if (blobType === 'image/jpeg' && !/\.jpe?g$/i.test(name)) {
          name = `${String(name).replace(/\.[^.]+$/, '')}.jpg`;
        }
        finish(new File([blob], name, {
          type: blobType,
          lastModified: Date.now(),
        }));
      }, blobType, quality);
    };

    img.onerror = () => finish(file);
    img.src = src;
  });
};

/**
 * 320px JPEG thumbnail for lists and grids. Never used as a substitute
 * for the stored original. Returns null if the image cannot be drawn.
 * @param {File} file
 * @param {number} maxEdge
 * @param {number} quality
 * @returns {Promise<File | null>}
 */
export const generateImageThumbnail = async (file, maxEdge = 320, quality = 0.8) => {
  return new Promise((resolve) => {
    const type = String((file && file.type) || '');
    if (!file || !type.startsWith('image/') || type.includes('dwg')) {
      resolve(null);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const src = URL.createObjectURL(file);
    const finish = (result) => {
      URL.revokeObjectURL(src);
      resolve(result);
    };

    img.onload = () => {
      let { width, height } = img;
      const longest = Math.max(width, height) || 1;
      if (longest > maxEdge) {
        const scale = maxEdge / longest;
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
      canvas.width = width;
      canvas.height = height;
      if (!ctx) {
        finish(null);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          finish(null);
          return;
        }
        finish(new File([blob], 'thumb.jpg', {
          type: 'image/jpeg',
          lastModified: Date.now(),
        }));
      }, 'image/jpeg', quality);
    };

    img.onerror = () => finish(null);
    img.src = src;
  });
};

/**
 * Upload a blob to a known path. Progress is 0–1 when onProgress is set.
 * Storage first; the caller writes Firestore only after this resolves.
 * @param {string} path
 * @param {Blob | File} data
 * @param {{ contentType?: string, jobId?: string, onProgress?: (fraction: number) => void }} [options]
 */
export async function uploadStorageBlob(path, data, options = {}) {
  const storage = await getFirebaseStorage();
  const storageRef = ref(storage, path);
  const metadata = {
    contentType: options.contentType || (data && data.type) || 'application/octet-stream',
    customMetadata: {
      orgId: getActiveOrgId(),
      jobId: options.jobId || '',
    },
  };

  if (typeof options.onProgress !== 'function') {
    await uploadBytes(storageRef, data, metadata);
    return { path };
  }

  await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, data, metadata);
    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          options.onProgress(snapshot.bytesTransferred / snapshot.totalBytes);
        }
      },
      reject,
      () => resolve(task.snapshot),
    );
  });
  return { path };
}

/** Download URL for a Storage path. Lists must pass a thumbnail path, never the original. */
export async function getDownloadUrlForPath(path) {
  if (!path) return null;
  try {
    const storage = await getFirebaseStorage();
    return await getDownloadURL(ref(storage, path));
  } catch (error) {
    return null;
  }
}

/**
 * Get receipt image metadata
 * @param {string} jobId - Job ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<{success: boolean, metadata?: Object, error?: string}>}
 */
export const getReceiptImageMetadata = async (jobId, expenseId) => {
  const storage = await getFirebaseStorage();
  try {
    if (!jobId || !expenseId) {
      throw new Error('Missing required parameters: jobId or expenseId');
    }

    const folderPath = `${STORAGE_PATHS.RECEIPTS}/${jobId}/${expenseId}`;
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
