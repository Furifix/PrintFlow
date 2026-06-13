// src/components/ColorCard.jsx — Color swatch + name + toggle for MockupReview
export default function ColorCard({ color, mockupUrl, enabled, onToggle, onExpand }) {
  return (
    <div
      className={`relative rounded-none overflow-hidden hdk-border border-black dark:border-white transition-all ${
        enabled ? '' : 'opacity-40'
      }`}
    >
      {/* Mockup image */}
      <button
        id={`mockup-expand-${color.colorId}`}
        onClick={onExpand}
        className="w-full block bg-slate-50"
      >
        {mockupUrl ? (
          <img
            src={mockupUrl}
            alt={color.colorName}
            className="w-full aspect-square object-cover"
          />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center text-slate-300">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </button>

      {/* Footer */}
      <div className="p-2 flex items-center gap-2 bg-white dark:bg-slate-800 border-t border-black dark:border-white">
        <div
          className="w-5 h-5 rounded-none border border-black dark:border-white flex-shrink-0"
          style={{ backgroundColor: color.colorHex || '#ccc' }}
        />
        <span className="text-xs font-bold text-black dark:text-white uppercase tracking-wider flex-1 truncate">{color.colorName}</span>
        <label className="toggle-switch flex-shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            aria-label={`Toggle ${color.colorName}`}
          />
          <span className="toggle-slider" />
        </label>
      </div>
    </div>
  );
}
