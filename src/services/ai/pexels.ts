export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  video_files: { id: number; quality: string; file_type: string; width: number; height: number; link: string }[];
}

export async function searchPexelsVideos(query: string, perPage = 5): Promise<PexelsVideo[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error("PEXELS_API_KEY is not configured");

  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}`,
    {
      headers: { Authorization: apiKey },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pexels API error: ${err}`);
  }

  const data = await res.json();
  return data.videos ?? [];
}

export async function searchPexelsPhotos(query: string, perPage = 5): Promise<{ src: string }[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error("PEXELS_API_KEY is not configured");

  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`,
    {
      headers: { Authorization: apiKey },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pexels API error: ${err}`);
  }

  const data = await res.json();
  return (data.photos ?? []).map((p: { src: { original: string } }) => ({ src: p.src.original }));
}
