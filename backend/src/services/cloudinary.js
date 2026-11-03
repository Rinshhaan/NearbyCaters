const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Check if Cloudinary credentials are provided
const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Local uploads directory (ensures uploads directly from device/gallery work out of the box)
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);
const MEDIA_MIMES = new Set([...IMAGE_MIMES, 'video/mp4', 'video/quicktime', 'video/webm']);
const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
};
const acceptedFile = (allowedMimes) => (_req, file, callback) => {
  const extensionMime = MIME_BY_EXTENSION[path.extname(file.originalname || '').toLowerCase()];
  const mimeIsAllowed = !file.mimetype || allowedMimes.has(file.mimetype) || (
    file.mimetype === 'application/octet-stream' && extensionMime &&
    (allowedMimes.has(extensionMime) || (extensionMime === 'image/jpeg' && allowedMimes.has('image/jpg')))
  );
  if (mimeIsAllowed) return callback(null, true);
  const error = new Error('Unsupported file type');
  error.status = 415;
  callback(error);
};

function detectMedia(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg', resourceType: 'image' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: 'image/png', ext: '.png', resourceType: 'image' };
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return { mime: 'image/gif', ext: '.gif', resourceType: 'image' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: '.webp', resourceType: 'image' };
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (['avif', 'avis'].includes(brand)) return { mime: 'image/avif', ext: '.avif', resourceType: 'image' };
    if (['qt  '].includes(brand)) return { mime: 'video/quicktime', ext: '.mov', resourceType: 'video' };
    return { mime: 'video/mp4', ext: '.mp4', resourceType: 'video' };
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { mime: 'video/webm', ext: '.webm', resourceType: 'video' };
  return null;
}

// Memory storage is bounded; content is signature-checked before it reaches storage.
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: acceptedFile(MEDIA_MIMES),
});
const signupUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: acceptedFile(MEDIA_MIMES),
});
const eventImageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: acceptedFile(IMAGE_MIMES),
});

/**
 * Upload buffer helper
 * If Cloudinary keys are configured, it uploads to Cloudinary.
 * Otherwise, it saves directly to local disk (/uploads) and returns the accessible URL.
 */
const uploadBufferToCloudinary = async (
  fileBuffer,
  originalName = 'upload.jpg',
  folder = 'nearme-catering',
  mimeType = 'image/jpeg'
) => {
  const media = detectMedia(fileBuffer);
  const mimeMatches = !mimeType || mimeType === 'application/octet-stream' || mimeType === media?.mime || (mimeType === 'image/jpg' && media?.mime === 'image/jpeg');
  if (!media || !mimeMatches) {
    const error = new Error('The file content does not match a supported image or video type');
    error.status = 415;
    throw error;
  }
  if (hasCloudinary) {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder, resource_type: media.resourceType },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(fileBuffer);
      });
      return {
        secure_url: result.secure_url,
        public_id: result.public_id,
        resource_type: media.resourceType,
      };
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        const uploadError = new Error('Media storage is temporarily unavailable');
        uploadError.status = 503;
        throw uploadError;
      }
      console.warn('[Cloudinary] Upload failed; using local development storage:', err.message);
    }
  } else if (process.env.NODE_ENV === 'production') {
    const error = new Error('Media storage is not configured');
    error.status = 503;
    throw error;
  }

  const uniqueName = `${crypto.randomBytes(16).toString('hex')}${media.ext}`;
  const filePath = path.join(uploadsDir, uniqueName);

  await fs.promises.writeFile(filePath, fileBuffer);

  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
  if (process.env.NODE_ENV === 'production' && !baseUrl.startsWith('https://')) {
    const error = new Error('A public HTTPS API_BASE_URL is required for local media storage');
    error.status = 503;
    throw error;
  }
  const localUrl = `${baseUrl}/uploads/${uniqueName}`;

  return {
    secure_url: localUrl,
    public_id: uniqueName,
    resource_type: media.resourceType,
  };
};

module.exports = { cloudinary, upload, signupUpload, eventImageUpload, uploadBufferToCloudinary, detectMedia, acceptedFile };
