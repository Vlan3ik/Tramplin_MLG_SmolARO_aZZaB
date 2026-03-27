import { ChevronLeft, ChevronRight, Image as ImageIcon, Play, Trash2, Upload, X } from 'lucide-react'
import { type ChangeEvent, useMemo, useState } from 'react'
import type { CompanyMedia } from '../../types/company'

type CompanyMediaGalleryProps = {
  items: CompanyMedia[]
  isLoading?: boolean
  title?: string
  emptyText?: string
  className?: string
  uploadButtonLabel?: string
  canManage?: boolean
  isUploading?: boolean
  deletingMediaId?: number | null
  onUpload?: (file: File) => Promise<void> | void
  onDelete?: (mediaId: number) => Promise<void> | void
}

function isVideoMedia(item: CompanyMedia) {
  return item.type === 'video' || item.mimeType?.toLowerCase().startsWith('video/') === true
}

function normalizeItems(items: CompanyMedia[]) {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder
    }

    return a.id - b.id
  })
}

export function CompanyMediaGallery({
  items,
  isLoading = false,
  title = 'Медиа компании',
  emptyText = 'Пока нет фото и видео.',
  className = '',
  uploadButtonLabel = 'Добавить фото или видео',
  canManage = false,
  isUploading = false,
  deletingMediaId = null,
  onUpload,
  onDelete,
}: CompanyMediaGalleryProps) {
  const orderedItems = useMemo(() => normalizeItems(items), [items])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const activeItem = viewerIndex == null ? null : orderedItems[viewerIndex] ?? null

  function onUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''

    if (!file || !onUpload) {
      return
    }

    void onUpload(file)
  }

  return (
    <section className={`company-media-gallery ${className}`.trim()}>
      <div className="company-media-gallery__head">
        <h3>{title}</h3>
        {canManage && onUpload ? (
          <label className={`company-media-gallery__upload-btn ${isUploading ? 'is-loading' : ''}`}>
            <Upload size={16} />
            {isUploading ? 'Загрузка...' : uploadButtonLabel}
            <input type="file" accept="image/*,video/*" disabled={isUploading} onChange={onUploadChange} />
          </label>
        ) : null}
      </div>

      {isLoading ? (
        <div className="company-media-gallery__grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`company-media-skeleton-${index}`} className="company-media-gallery__skeleton" />
          ))}
        </div>
      ) : orderedItems.length ? (
        <div className="company-media-gallery__grid">
          {orderedItems.map((item, index) => {
            const isVideo = isVideoMedia(item)
            const deleteDisabled = deletingMediaId === item.id

            return (
              <article key={item.id} className="company-media-gallery__item">
                <button type="button" className="company-media-gallery__preview" onClick={() => setViewerIndex(index)}>
                  {isVideo ? (
                    <>
                      <video src={item.url} muted playsInline preload="metadata" />
                      <span className="company-media-gallery__video-badge">
                        <Play size={14} />
                        Видео
                      </span>
                    </>
                  ) : (
                    <img src={item.url} alt="Фото компании" loading="lazy" />
                  )}
                </button>

                {canManage && onDelete ? (
                  <button
                    type="button"
                    className="company-media-gallery__delete-btn"
                    onClick={() => void onDelete(item.id)}
                    disabled={deleteDisabled}
                  >
                    <Trash2 size={14} />
                    {deleteDisabled ? 'Удаляем...' : 'Удалить'}
                  </button>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="company-media-gallery__empty">
          <ImageIcon size={20} />
          <p>{emptyText}</p>
        </div>
      )}

      {activeItem ? (
        <div className="company-media-viewer" role="dialog" aria-modal="true" aria-label="Просмотр медиа" onClick={() => setViewerIndex(null)}>
          <div className="company-media-viewer__backdrop" />
          <div className="company-media-viewer__content" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="company-media-viewer__close" onClick={() => setViewerIndex(null)} aria-label="Закрыть просмотр">
              <X size={18} />
            </button>
            {orderedItems.length > 1 ? (
              <button
                type="button"
                className="company-media-viewer__nav company-media-viewer__nav--prev"
                onClick={() => setViewerIndex((current) => (current == null ? 0 : (current - 1 + orderedItems.length) % orderedItems.length))}
                aria-label="Предыдущее медиа"
              >
                <ChevronLeft size={20} />
              </button>
            ) : null}

            {isVideoMedia(activeItem) ? (
              <video src={activeItem.url} controls autoPlay className="company-media-viewer__video" />
            ) : (
              <img src={activeItem.url} alt="Медиа компании" className="company-media-viewer__image" />
            )}

            {orderedItems.length > 1 ? (
              <button
                type="button"
                className="company-media-viewer__nav company-media-viewer__nav--next"
                onClick={() => setViewerIndex((current) => (current == null ? 0 : (current + 1) % orderedItems.length))}
                aria-label="Следующее медиа"
              >
                <ChevronRight size={20} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
