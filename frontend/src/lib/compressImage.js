// Downscale a phone photo to a JPEG of at most `maxSide` px before uploading.
// A 5–10 MB camera photo typically ends up around 150–300 KB.
export async function compressImage(file, maxSide = 1280, quality = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return blob || file;
  } catch {
    return file; // undecodable in this browser — let Cloudinary handle it
  } finally {
    URL.revokeObjectURL(url);
  }
}
