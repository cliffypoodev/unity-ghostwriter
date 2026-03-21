import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, size } = await req.json();
    if (!prompt) return Response.json({ error: 'prompt is required' }, { status: 400 });

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    const imageSize = size || '1024x1792'; // portrait for book covers

    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: imageSize,
        quality: 'standard',
        response_format: 'url',
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return Response.json({ error: data.error?.message || 'DALL-E 3 request failed' }, { status: r.status });
    }

    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      return Response.json({ error: 'No image URL in response' }, { status: 500 });
    }

    // Download and re-upload to persistent storage
    const imgResp = await fetch(imageUrl);
    const imgBlob = await imgResp.blob();
    const file = new File([imgBlob], 'cover.png', { type: 'image/png' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    return Response.json({
      url: file_url,
      revised_prompt: data.data?.[0]?.revised_prompt || prompt,
    });
  } catch (error) {
    console.error('generateCoverImage error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});