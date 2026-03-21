import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType } from 'npm:docx@9.5.0';

// Sanitize text for XML/DOCX safety — strips control chars and normalizes unicode
function sanitizeForDocx(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    // Smart quotes → straight quotes
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    // Em/en dash → hyphen-minus
    .replace(/[\u2013\u2014]/g, '-')
    // Ellipsis → three dots
    .replace(/\u2026/g, '...')
    // Remove null bytes and control characters (keep tab, newline, carriage return)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove characters outside the XML 1.0 legal range
    .replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/g, '');
}

function stripHtml(html) {
  if (!html) return '';
  return sanitizeForDocx(
    html
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
      .trim()
  );
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
    try {
      const r = await fetch(content, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return '';
      const t = await r.text();
      if (t.trim().startsWith('<') && !t.trim().startsWith('<p') && !t.trim().startsWith('<h')) return '';
      return t;
    } catch (e) {
      console.error('resolveContent fetch failed:', e.message);
      return '';
    }
  }
  return content;
}

function buildDocxDocument(projectTitle, generatedChapters, spec, settings) {
  const bodyFont = settings?.bodyFont || settings?.default_body_font || 'Georgia';
  const headingFont = settings?.headingFont || settings?.default_heading_font || 'Georgia';
  const bodySize = parseInt(settings?.bodyFontSize || settings?.default_font_size || '12', 10) || 12;
  // docx uses half-points (1pt = 2 half-points)
  const bodySizeHp = bodySize * 2;
  const lineSpacing = parseFloat(settings?.lineSpacing || settings?.default_line_spacing || '1.5');
  // Line spacing in docx is in 240ths of a line
  const lineSpacingVal = Math.round(lineSpacing * 240);

  const sections = [];

  // Title page section
  const titleChildren = [
    new Paragraph({ spacing: { before: 4000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: sanitizeForDocx(projectTitle),
          font: headingFont,
          size: 56,
          bold: true,
        }),
      ],
    }),
  ];

  if (settings?.subtitle) {
    titleChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          new TextRun({
            text: sanitizeForDocx(settings.subtitle),
            font: headingFont,
            size: 28,
            italics: true,
            color: '666666',
          }),
        ],
      })
    );
  }

  if (settings?.authorName) {
    titleChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [
          new TextRun({
            text: sanitizeForDocx(settings.authorName),
            font: bodyFont,
            size: 28,
            italics: true,
          }),
        ],
      })
    );
  }

  if (spec?.genre) {
    titleChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          new TextRun({
            text: sanitizeForDocx([spec.genre, spec.target_audience].filter(Boolean).join(' - ')),
            font: bodyFont,
            size: 22,
            color: '888888',
          }),
        ],
      })
    );
  }

  sections.push({
    children: titleChildren,
  });

  // Chapter sections — each wrapped in try/catch so one bad chapter doesn't kill the export
  for (const ch of generatedChapters) {
    try {
      const rawContent = ch.resolvedContent || '';
      // Skip chapters with no real content
      if (!rawContent || rawContent.trim().length < 10) {
        console.warn(`Chapter ${ch.chapter_number} has no usable content, inserting placeholder`);
        sections.push({
          properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 600, after: 300 },
              children: [new TextRun({ text: sanitizeForDocx(`Chapter ${ch.chapter_number}: ${ch.title || 'Untitled'}`), font: headingFont, size: 36, bold: true })],
            }),
            new Paragraph({
              children: [new TextRun({ text: '[Chapter content not yet generated]', font: bodyFont, size: bodySizeHp, italics: true, color: '999999' })],
            }),
          ],
        });
        continue;
      }

      const plainText = stripHtml(rawContent);
      const paragraphs = plainText.split(/\n\n+/).filter(p => p.trim());

      const chChildren = [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 600, after: 300 },
          children: [
            new TextRun({
              text: sanitizeForDocx(`Chapter ${ch.chapter_number}: ${ch.title || 'Untitled'}`),
              font: headingFont,
              size: 36,
              bold: true,
            }),
          ],
        }),
      ];

      for (const p of paragraphs) {
        const trimmed = p.trim();
        if (/^[\*\-_]{3,}$/.test(trimmed) || trimmed === '* * *') {
          chChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [new TextRun({ text: '* * *', font: bodyFont, size: bodySizeHp })],
            })
          );
          continue;
        }

        const runs = [];
        const parts = trimmed.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
        for (const part of parts) {
          if (!part) continue;
          const safeText = sanitizeForDocx(part.startsWith('**') ? part.slice(2, -2) : part.startsWith('*') ? part.slice(1, -1) : part);
          if (!safeText) continue;
          runs.push(new TextRun({
            text: safeText,
            font: bodyFont,
            size: bodySizeHp,
            bold: part.startsWith('**') && part.endsWith('**') ? true : undefined,
            italics: part.startsWith('*') && part.endsWith('*') && !part.startsWith('**') ? true : undefined,
          }));
        }

        if (runs.length > 0) {
          chChildren.push(
            new Paragraph({
              spacing: { after: Math.round(bodySize * 8), line: lineSpacingVal },
              children: runs,
            })
          );
        }
      }

      sections.push({
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: chChildren,
      });
    } catch (chapterErr) {
      console.error(`DOCX: Chapter ${ch.chapter_number} failed:`, chapterErr.message);
      sections.push({
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: sanitizeForDocx(`Chapter ${ch.chapter_number}: ${ch.title || 'Untitled'}`), font: headingFont, size: 36, bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: `[Export error: ${chapterErr.message}]`, font: bodyFont, size: bodySizeHp, italics: true, color: 'CC0000' })],
          }),
        ],
      });
    }
  }

  return new Document({
    sections,
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { project_id, projectId: altProjectId, format, settings } = body;
  const pid = project_id || altProjectId;
  if (!pid) return Response.json({ error: 'project_id required' }, { status: 400 });

  const exportFormat = (format || 'txt').toLowerCase();

  const [projects, chapters, specs, appSettingsList] = await Promise.all([
    base44.entities.Project.filter({ id: pid }),
    base44.entities.Chapter.filter({ project_id: pid }, 'chapter_number'),
    base44.entities.Specification.filter({ project_id: pid }),
    base44.entities.AppSettings.list(),
  ]);

  const project = projects[0];
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

  const spec = specs[0] || {};
  const appSettings = appSettingsList[0] || {};
  const mergedSettings = { ...appSettings, ...settings };
  const projectTitle = project.name || 'Untitled Project';

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

    // Upload as file and return URL — avoids response size limits
    const safeTitle = projectTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'book';
    const blob = new Blob([text], { type: 'text/plain' });
    const file = new File([blob], `${safeTitle}.txt`, { type: 'text/plain' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    return Response.json({ file_url, filename: `${safeTitle}.txt` });
  }

  // ── Markdown Export ──
  if (exportFormat === 'markdown' || exportFormat === 'md') {
    let md = `# ${projectTitle}\n\n`;
    if (spec.genre) md += `*${spec.genre}*\n\n`;
    if (spec.topic) md += `> ${spec.topic.slice(0, 200)}...\n\n`;
    md += '---\n\n';

    md += '## Table of Contents\n\n';
    for (const ch of generatedChapters) {
      md += `- [Chapter ${ch.chapter_number}: ${ch.title || 'Untitled'}](#chapter-${ch.chapter_number})\n`;
    }
    md += '\n---\n\n';

    for (const ch of generatedChapters) {
      md += `## Chapter ${ch.chapter_number}: ${ch.title || 'Untitled'} {#chapter-${ch.chapter_number}}\n\n`;
      md += toMarkdown(ch.resolvedContent) + '\n\n---\n\n';
    }

    const safeTitle = projectTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'book';
    const blob = new Blob([md], { type: 'text/markdown' });
    const file = new File([blob], `${safeTitle}.md`, { type: 'text/markdown' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    return Response.json({ file_url, filename: `${safeTitle}.md` });
  }

  // ── DOCX Export (proper Open XML via docx library) ──
  if (exportFormat === 'docx') {
    try {
      const doc = buildDocxDocument(projectTitle, generatedChapters, spec, mergedSettings);
      const buffer = await Packer.toBuffer(doc);
      const safeTitle = projectTitle.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'book';
      const filename = `${safeTitle}.docx`;

      // Upload the DOCX as a file to avoid response size limits
      const docxBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const docxFile = new File([docxBlob], filename, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: docxFile });

      return Response.json({
        file_url,
        filename,
      });
    } catch (err) {
      console.error('DOCX generation error:', err.message);
      return Response.json({ error: `DOCX generation failed: ${err.message}` }, { status: 500 });
    }
  }

  return Response.json({ error: `Unsupported format: ${exportFormat}` }, { status: 400 });
});