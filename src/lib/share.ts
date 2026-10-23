export function shareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    x: `https://x.com/intent/post?url=${u}&text=${text}`,
    telegram: `https://t.me/share/url?url=${u}&text=${text}`,
  };
}
