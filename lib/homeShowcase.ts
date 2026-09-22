// Homepage-only artwork. Replacing these assets does not change studio results.
export const homeArtwork = {
  portrait: { src: "/home/portrait.webp", alt: "Photoreal portrait of a man, with detailed skin texture and soft studio lighting" },
  music: { src: "/home/music-sleeve.svg", alt: "Blue vinyl record sleeve with a sculptural silver disc" },
  environment: { src: "/home/spaceport.webp", alt: "A cinematic Astra spaceport with spacecraft and luminous blue beams" },
  game: { src: "/home/interceptor.webp", alt: "Astra interceptor spacecraft concept artwork" },
  product: { src: "/create/amber-still-life.webp", alt: "Amber glass product photography in sculptural warm light" },
};

export const homeVideo: { src?: string; poster: string; alt: string } = {
  // Add src: "/home/video-preview.mp4" when the final HavnAI clip is approved.
  // Delivery requirements and provenance: public/home/README.md.
  poster: "/home/spaceport.webp",
  alt: "Cinematic Astra spaceport artwork, the Video Studio preview poster",
};

export const homePortfolio = [
  { ...homeArtwork.portrait, label: "Portrait", className: "portrait" },
  { ...homeArtwork.environment, label: "Worlds", className: "environment" },
  { ...homeArtwork.game, label: "Game art", className: "game" },
  { ...homeArtwork.product, label: "Product", className: "product" },
  { ...homeArtwork.music, label: "Cover art", className: "music" },
];
