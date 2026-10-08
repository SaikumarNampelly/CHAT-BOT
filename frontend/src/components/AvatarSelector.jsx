import { useState, useRef } from 'react';
import { QUICK_EMOJIS, isImageAvatar, compressImageFile } from '../utils/avatar';

export default function AvatarSelector({ value, onChange, companionName = '' }) {
  const [activeTab, setActiveTab] = useState(isImageAvatar(value) ? 'photo' : 'emoji');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const isImg = isImageAvatar(value);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    try {
      setUploadError('');
      const compressedDataUrl = await compressImageFile(file);
      onChange(compressedDataUrl);
      setActiveTab('photo');
    } catch (err) {
      console.error('Image compression error:', err);
      setUploadError('Failed to process image. Try a different photo.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Current Avatar Preview */}
      <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#F8F7FC] dark:bg-[#0C0A1B] border border-[#E7E5F0] dark:border-[#26214B]">
        <div className="relative group shrink-0">
          {isImg ? (
            <img
              src={value}
              alt="Avatar preview"
              className="w-16 h-16 rounded-2xl object-cover border-2 border-[#643EF3]/40 shadow-sm"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#643EF3] to-[#3A1ABB] flex items-center justify-center text-3xl text-white shadow-sm border border-white/20 select-none">
              {value || '🌸'}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload new photo"
            className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-[#171533] dark:text-[#F4F3FA] truncate">
            {companionName ? `${companionName}'s Avatar` : 'Companion Avatar'}
          </div>
          <div className="text-[11px] text-[#68657D] dark:text-[#A09DB8] mt-0.5">
            {isImg ? 'Custom photo selected' : `Emoji avatar: ${value || '🌸'}`}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] font-semibold text-[#643EF3] hover:text-[#3A1ABB] dark:text-[#AD55FB] cursor-pointer"
            >
              Upload Photo
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              type="button"
              onClick={() => {
                setActiveTab('emoji');
                onChange('🌸');
              }}
              className="text-[11px] text-[#68657D] hover:text-[#171533] dark:text-[#A09DB8] dark:hover:text-white cursor-pointer"
            >
              Reset to Emoji
            </button>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="text-[11px] text-[#E4586E] bg-[#E4586E]/10 p-2 rounded-xl border border-[#E4586E]/20">
          ⚠️ {uploadError}
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#141228] border border-[#E7E5F0] dark:border-[#26214B]">
        <button
          type="button"
          onClick={() => setActiveTab('emoji')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'emoji'
              ? 'bg-white dark:bg-[#1E1A3C] text-[#643EF3] dark:text-[#AD55FB] shadow-xs'
              : 'text-[#68657D] dark:text-[#A09DB8] hover:text-[#171533]'
          }`}
        >
          🌸 Emoji
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('photo')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'photo'
              ? 'bg-white dark:bg-[#1E1A3C] text-[#643EF3] dark:text-[#AD55FB] shadow-xs'
              : 'text-[#68657D] dark:text-[#A09DB8] hover:text-[#171533]'
          }`}
        >
          📷 Photo
        </button>
      </div>

      {/* Tab: Emojis (5 useful emojis) */}
      {activeTab === 'emoji' && (
        <div className="grid grid-cols-5 gap-2 pt-0.5">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => onChange(em)}
              className={`h-11 rounded-xl flex items-center justify-center text-xl transition-all cursor-pointer ${
                value === em
                  ? 'border-2 border-[#643EF3] bg-[#F1EEFF] dark:bg-[#1E1A3C] scale-105 shadow-xs'
                  : 'border border-[#E7E5F0] dark:border-[#26214B] bg-[#F8F7FC] dark:bg-[#0C0A1B] hover:scale-105 hover:border-[#643EF3]/40'
              }`}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Tab: Photo Upload */}
      {activeTab === 'photo' && (
        <div className="space-y-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-4 rounded-2xl border-2 border-dashed border-[#643EF3]/40 hover:border-[#643EF3] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-center transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-[#F1EEFF] dark:bg-[#1E1A3C] text-[#643EF3] dark:text-[#AD55FB] flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-xs font-bold text-[#171533] dark:text-[#F4F3FA]">
              Choose Photo from Device
            </div>
            <div className="text-[10px] text-[#68657D] dark:text-[#A09DB8] mt-0.5">
              Supports PNG, JPG, WEBP • Automatically cropped to square
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
