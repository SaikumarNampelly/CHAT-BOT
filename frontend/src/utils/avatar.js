export const QUICK_EMOJIS = ['🌸', '✨', '🤖', '💖', '🫂'];


export function isImageAvatar(str) {
  if (!str) return false;
  return str.startsWith('data:image') || str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/');
}

export function compressImageFile(file, maxWidth = 256, maxHeight = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const width = img.width;
        const height = img.height;

        // Crop square from center
        const size = Math.min(width, height);
        const startX = (width - size) / 2;
        const startY = (height - size) / 2;

        canvas.width = maxWidth;
        canvas.height = maxHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, size, size, 0, 0, maxWidth, maxHeight);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
