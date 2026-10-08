export const QUICK_EMOJIS = [
  '🌸', '🫂', '✨', '⚡', '💖', '🦊', '🐱', '🦋',
  '🌟', '💎', '🌿', '☕', '🌷', '🎀', '🧸', '🌺'
];

export const PRESET_AVATARS = [
  { id: 'av1', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80', label: 'Priya' },
  { id: 'av2', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', label: 'Ananya' },
  { id: 'av3', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80', label: 'Sneha' },
  { id: 'av4', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80', label: 'Arjun' },
  { id: 'av5', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', label: 'Karthik' },
  { id: 'av6', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80', label: 'Rahul' },
];

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
