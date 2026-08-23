// Herkennen of een geüpload item een foto of een video is. De kolom
// media_type (zie scripts/018_videos.sql) is leidend; valt die weg, dan
// bepaalt de bestandsextensie het.

const VIDEO_EXTENSIES = /\.(mp4|mov|m4v|webm|avi|3gp|mkv)$/i

export function isVideoPad(pad?: string | null): boolean {
  return !!pad && VIDEO_EXTENSIES.test(pad.split('?')[0])
}

export interface MediaItem {
  media_type?: string | null
  storage_path?: string | null
}

export function isVideoItem(item: MediaItem): boolean {
  if (item.media_type) return item.media_type === 'video'
  return isVideoPad(item.storage_path)
}
