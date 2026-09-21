import { bucket } from '../config/firebase';
import path from 'path';

export const uploadFileToFirebase = async (file: Express.Multer.File, folderName: string): Promise<string> => {
  const fileExtension = path.extname(file.originalname);

  const fileName = `foundation/${folderName}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}${fileExtension}`;

  const blob = bucket.file(fileName);

  const blobStream = blob.createWriteStream({
    metadata: {
      contentType: file.mimetype,
    },
    resumable: false,
  });

  return new Promise((resolve, reject) => {
    blobStream.on('error', (err) => reject(err));

    blobStream.on('finish', async () => {
      try {
        await blob.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        resolve(publicUrl);
      } catch (err) {
        reject(err);
      }
    });

    blobStream.end(file.buffer);
  });
};