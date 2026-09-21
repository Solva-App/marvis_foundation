import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimetypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedMimetypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and PDF are allowed.'));
  }
};

export const submitUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
}).fields([
  { name: 'passport', maxCount: 1 },
  { name: 'invoice', maxCount: 1 },
  { name: 'billProof', maxCount: 1 }
]);