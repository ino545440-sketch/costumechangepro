import { AspectRatio } from './types';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const getImageDimensions = (file: File): Promise<{ width: number; height: number; aspectRatio: AspectRatio }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      let selectedRatio: AspectRatio = '1:1';

      // Determine closest supported aspect ratio
      if (ratio > 1.5) selectedRatio = '16:9';
      else if (ratio > 1.2) selectedRatio = '4:3';
      else if (ratio < 0.6) selectedRatio = '9:16';
      else if (ratio < 0.85) selectedRatio = '3:4';
      else selectedRatio = '1:1';

      resolve({
        width: img.width,
        height: img.height,
        aspectRatio: selectedRatio
      });
    };
    img.src = URL.createObjectURL(file);
  });
};

export const getDisplayUrl = (file: File): string => {
  return URL.createObjectURL(file);
};
