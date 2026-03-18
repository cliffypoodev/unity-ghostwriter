import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { book_type, genre } = await req.json();
    if (!book_type) return Response.json({ error: 'book_type required' }, { status: 400 });

    // Fetch all catalog entries for this book_type
    const all = await base44.entities.PromptCatalog.filter({ book_type });

    // Filter by genre if provided — match genre_tags or be lenient if no genre yet
    let results = all;
    if (genre) {
      const genreLower = genre.toLowerCase();
      // Try exact genre_tags match first
      const exact = all.filter(entry =>
        Array.isArray(entry.genre_tags) &&
        entry.genre_tags.some(t => t.toLowerCase() === genreLower)
      );
      // Fall back to category/subcategory keyword match
      const fuzzy = all.filter(entry =>
        !exact.includes(entry) && (
          entry.category?.toLowerCase().includes(genreLower) ||
          entry.subcategory?.toLowerCase().includes(genreLower) ||
          entry.series_title?.toLowerCase().includes(genreLower) ||
          entry.description?.toLowerCase().includes(genreLower)
        )
      );
      results = [...exact, ...fuzzy];
    }

    return Response.json({ suggestions: results.slice(0, 20) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});