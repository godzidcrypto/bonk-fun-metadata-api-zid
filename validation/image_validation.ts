import { type } from "arktype";

// --- Validation Constants ---
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ALLOWED_MIME_TYPES.map(t => t.split('/')[1]);

// --- ArkType Definition using ctx.reject ---
const ValidImageFileType = type('unknown')
  // 1. Check if it's actually a File object using a type predicate narrow
  .narrow(
    (data, ctx): data is File => {
        if (data instanceof File) {
            return true;
        }
        // Use ctx.reject for a structured error
        return ctx.reject({
            expected: "a File object",
            actual: typeof data, // Give info on what was received
            description: `Input must be a File object, but received type '${typeof data}'.`
        });
    }
  )
  // 2. Check the file size using ctx.reject
  .narrow((file: File, ctx) => { // file is now safely typed as File
    if (file.size <= MAX_FILE_SIZE_BYTES) {
      return true; // Validation passes for this step
    }
    // Reject with specific details
    return ctx.reject({
        expected: `file size <= ${MAX_FILE_SIZE_BYTES} bytes (${MAX_FILE_SIZE_MB}MB)`,
        actual: `${file.size} bytes`,
        description: `Max file size is ${MAX_FILE_SIZE_MB}MB (received ${Math.round(file.size / 1024 / 1024 * 100)/100}MB).`
    });
  })
  // 3. Check the MIME type using ctx.reject
  .narrow((file: File, ctx) => { // file is still File
    if (ALLOWED_MIME_TYPES.includes(file.type)) {
      return true; // Validation passes for this step
    }
    // Reject with specific details
    return ctx.reject({
        expected: `MIME type in [${ALLOWED_MIME_TYPES.join(', ')}]`,
        actual: file.type,
        description: `Invalid file type '${file.type}'. Only ${ALLOWED_EXTENSIONS.join(', ')} are allowed.`
    });
  });


// --- ArkType Schema for the Form Data ---
export const ImageUploadSchema = type({
  image: ValidImageFileType,
  // description: 'string?',
});