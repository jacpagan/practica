export const multipartFingerprint = ({ videoFile }) => [
  videoFile?.name || '',
  videoFile?.size || 0,
  videoFile?.lastModified || 0,
].join('|')
