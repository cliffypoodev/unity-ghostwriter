import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Lightweight project exporter — avoids CPU-intensive docx library to stay within Deno Deploy limits.
// Supports: txt, markdown, doc (MHTML-based Word-compatible format)

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toMarkdown(html) {
  if (!html) return '';
  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<li>/gi, '- ');
  md = md.replace(/<\/li>/gi, '\n');
  md = md.replace(/<[^>]*>/g, '');
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

async function resolveContent(content) {
  if (!content) return '';
  if (content.startsWith('http://') || content.startsWith('https://')) {
    const r = await fetch(content);
    if (!r.ok) return '';
    const t = await r.text();
    if (t.trim().startsWith('<') && !t.trim().startsWith('<p') && !t.trim().startsWith('<h')) return '';
    return t;
  }
  return content;
}

function buildMhtmlDoc(title, chapters, spec, settings) {
  const bodyFont = settings?.default_body_font || 'Georgia';
  const headingFont = settings?.default_heading_font || 'Georgia';
  const fontSize = settings?.default_font_size || '12pt';
  const lineSpacing = settings?.default_line_spacing || '1.5';
  const margins = settings?.default_margins || '1in';

  const chaptersHtml = chapters.map(ch => {
    const content = ch.resolvedContent || '';
    return `<div style="page-break-before: always;">
<h1 style="font-family: '${headingFont}', serif; font-size: 18pt; margin-bottom: 0.5em;">Chapter ${ch.chapter_number}: ${ch.title || 'Untitled'}</h1>
<div style="font-family: '${bodyFont}', serif; font-size: ${fontSize}; line-height: ${lineSpacing};">
${content.includes('<') ? content : content.split('\n\n').map(p => `<p>${p}</p>`).join('\n')}
</div>
</div>`;
  }).join('\n');

  const genre = spec?.genre || '';
  const audience = spec?.target_audience || '';

  return `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_NextPart_boundary"

------=_NextPart_boundary
Content-Type: text/html; charset="utf-8"

<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<style>
@page { margin: ${margins}; }
body { font-family: '${bodyFont}', serif; font-size: ${fontSize}; line-height: ${lineSpacing}; }
h1 { font-family: '${headingFont}', serif; page-break-before: always; }
h1:first-of-type { page-break-before: avoid; }
p { margin: 0.4em 0; text-indent: 0; }
</style>
</head>
<body>
<div style="text-align: center; margin-bottom: 2em;">
<h1 style="font-size: 24pt; page-break-before: avoid;">${title}</h1>
${genre ? `<p style="font-style: italic; color: #666;">${genre}${audience ? ' — ' + audience : ''}</p>` : ''}
</div>
${chaptersHtml}
</body>
</html>
------=_NextPart_boundary--`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { project_id, format, settings } = await req.json();
  if (!project_id) return Response.json({ error: 'project_id required' }, { status: 400 });

  const exportFormat = (format || 'txt').toLowerCase();

  // Load project data
  const [projects, chapters, specs, appSettingsList] = await Promise.all([
    base44.entities.Project.filter({ id: project_id }),
    base44.entities.Chapter.filter({ project_id }, 'chapter_number'),
    base44.entities.Specification.filter({ project_id }),
    base44.entities.AppSettings.list(),
  ]);

  const project = projects[0];
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

  const spec = specs[0] || {};
  const appSettings = appSettingsList[0] || {};
  const mergedSettings = { ...appSettings, ...settings };
  const projectTitle = project.name || 'Untitled Project';

  // Filter to generated chapters and resolve content
  const generatedChapters = chapters.filter(c => c.status === 'generated' && c.content);
  for (const ch of generatedChapters) {
    ch.resolvedContent = await resolveContent(ch.content);
  }

  // ── TXT Export ──
  if (exportFormat === 'txt') {
    let text = `${projectTitle}\n${'='.repeat(projectTitle.length)}\n\n`;
    if (spec.genre) text += `Genre: ${spec.genre}\n`;
    if (spec.target_audience) text += `Audience: ${spec.target_audience}\n`;
    text += '\n---\n\n';

    for (const ch of generatedChapters) {
      text += `CHAPTER ${ch.chapter_number}: ${ch.title || 'Untitled'}\n\n`;
      text += stripHtml(ch.resolvedContent) + '\n\n---\n\n';
    }

    const totalWords = generatedChapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0);
    text += `\nTotal word count: ~${totalWords}\n`;

    return new Response(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${projectTitle.replace(/[^a-zA-Z0-9 ]/g, '')}.txt"`,
      },
    });
  }

  // ── Markdown Export ──
  if (exportFormat === 'markdown' || exportFormat === 'md') {
    let md = `# ${projectTitle}\n\n`;
    if (spec.genre) md += `*${spec.genre}*\n\n`;
    if (spec.topic) md += `> ${spec.topic.slice(0, 200)}...\n\n`;
    md += '---\n\n';

    // Table of contents
    md += '## Table of Contents\n\n';
    for (const ch of generatedChapters) {
      md += `- [Chapter ${ch.chapter_number}: ${ch.title || 'Untitled'}](#chapter-${ch.chapter_number})\n`;
    }
    md += '\n---\n\n';

    for (const ch of generatedChapters) {
      md += `## Chapter ${ch.chapter_number}: ${ch.title || 'Untitled'} {#chapter-${ch.chapter_number}}\n\n`;
      md += toMarkdown(ch.resolvedContent) + '\n\n---\n\n';
    }

    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${projectTitle.replace(/[^a-zA-Z0-9 ]/g, '')}.md"`,
      },
    });
  }

  // ── DOC / DOCX Export (MHTML-based — Word-compatible, lightweight) ──
  if (exportFormat === 'doc' || exportFormat === 'docx') {
    const mhtml = buildMhtmlDoc(projectTitle, generatedChapters, spec, mergedSettings);

    return new Response(mhtml, {
      headers: {
        'Content-Type': 'application/msword',
        'Content-Disposition': `attachment; filename="${projectTitle.replace(/[^a-zA-Z0-9 ]/g, '')}.doc"`,
      },
    });
  }

  return Response.json({ error: `Unsupported format: ${exportFormat}` }, { status: 400 });
});