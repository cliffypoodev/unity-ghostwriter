import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Strip HTML tags to plain text
function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// HTML to Markdown
function htmlToMarkdown(html) {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, (_, t) => `# ${htmlToText(t)}\n\n`)
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, (_, t) => `## ${htmlToText(t)}\n\n`)
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, (_, t) => `### ${htmlToText(t)}\n\n`)
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, (_, t) => `#### ${htmlToText(t)}\n\n`)
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '_$1_')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '_$1_')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Build TOC markdown with anchors from chapters
function buildMarkdownToc(chapters) {
  const sorted = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
  let toc = '## Table of Contents\n\n';
  sorted.forEach(ch => {
    const anchor = `chapter-${ch.chapter_number}-${ch.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
    toc += `- [Chapter ${ch.chapter_number}: ${ch.title}](#${anchor})\n`;
  });
  return toc + '\n---\n\n';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { projectId, format } = body;

    if (!projectId || !format) {
      return Response.json({ error: 'projectId and format are required' }, { status: 400 });
    }

    // Fetch project data
    const [projects, chapters, specs] = await Promise.all([
      base44.entities.Project.filter({ id: projectId }),
      base44.entities.Chapter.filter({ project_id: projectId }),
      base44.entities.Specification.filter({ project_id: projectId }),
    ]);

    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const sortedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
    const spec = specs[0];
    const title = project.name || 'Untitled';

    // ── TXT Export ─────────────────────────────────────────────────────────────
    if (format === 'txt') {
      let text = `${title}\n${'='.repeat(title.length)}\n\n`;
      if (spec?.genre || spec?.target_audience) {
        text += `${[spec.genre, spec.target_audience].filter(Boolean).join(' · ')}\n\n`;
      }
      sortedChapters.forEach(ch => {
        const heading = `Chapter ${ch.chapter_number}: ${ch.title}`;
        text += `${heading}\n${'-'.repeat(heading.length)}\n\n`;
        if (ch.content) {
          text += ch.content.trim() + '\n\n';
        } else {
          text += '[Chapter not yet written]\n\n';
        }
      });

      return new Response(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.txt"`,
        },
      });
    }

    // ── Markdown Export ─────────────────────────────────────────────────────────
    if (format === 'md') {
      let md = `# ${title}\n\n`;
      if (spec?.genre || spec?.target_audience) {
        md += `_${[spec.genre, spec.target_audience].filter(Boolean).join(' · ')}_\n\n`;
      }
      md += buildMarkdownToc(sortedChapters);

      sortedChapters.forEach(ch => {
        const anchor = `chapter-${ch.chapter_number}-${ch.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
        md += `## Chapter ${ch.chapter_number}: ${ch.title} {#${anchor}}\n\n`;
        if (ch.content) {
          // Convert content to markdown if it contains HTML, else use as-is
          const isHtml = ch.content.includes('<');
          md += (isHtml ? htmlToMarkdown(ch.content) : ch.content.trim()) + '\n\n';
        } else {
          md += '_[Chapter not yet written]_\n\n';
        }
      });

      return new Response(md, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.md"`,
        },
      });
    }

    // ── DOCX Export (via HTML → MHTML) ─────────────────────────────────────────
    if (format === 'docx') {
      const { html: editorHtml, settings: ds } = body;

      const bodyFamily = ds?.bodyFont
        ? ({
            "georgia": "Georgia, serif",
            "times-new-roman": '"Times New Roman", Times, serif',
            "garamond": 'Garamond, "EB Garamond", serif',
            "palatino": 'Palatino, "Palatino Linotype", serif',
            "baskerville": 'Baskerville, "Baskerville Old Face", serif',
            "arial": "Arial, sans-serif",
            "helvetica": "Helvetica, Arial, sans-serif",
            "verdana": "Verdana, Geneva, sans-serif",
            "trebuchet-ms": '"Trebuchet MS", Helvetica, sans-serif',
            "calibri": "Calibri, Candara, sans-serif",
            "courier-new": '"Courier New", Courier, monospace',
            "consolas": 'Consolas, "Courier New", monospace',
          }[ds.bodyFont] || "Georgia, serif")
        : "Georgia, serif";

      const headingFamily = ds?.headingFont
        ? ({
            "georgia": "Georgia, serif",
            "times-new-roman": '"Times New Roman", Times, serif',
            "garamond": 'Garamond, "EB Garamond", serif',
            "palatino": 'Palatino, "Palatino Linotype", serif',
            "baskerville": 'Baskerville, "Baskerville Old Face", serif',
            "arial": "Arial, sans-serif",
            "helvetica": "Helvetica, Arial, sans-serif",
            "verdana": "Verdana, Geneva, sans-serif",
            "trebuchet-ms": '"Trebuchet MS", Helvetica, sans-serif',
            "calibri": "Calibri, Candara, sans-serif",
            "courier-new": '"Courier New", Courier, monospace',
            "consolas": 'Consolas, "Courier New", monospace',
          }[ds.headingFont] || "Georgia, serif")
        : "Georgia, serif";

      const margin = ds?.margins || "1in";
      const lineH = ds?.lineSpacing || "1.5";
      const fontSize = ds?.bodyFontSize || "14px";

      const docTitle = ds?.bookTitle || title;
      const author = ds?.authorName || "";
      const subtitle = ds?.subtitle || "";
      const headerText = ds?.headerText || "";
      const footerText = ds?.footerText || "";

      const style = `
        body { font-family: ${bodyFamily}; font-size: ${fontSize}; line-height: ${lineH}; color: #1e293b; margin: ${margin}; }
        h1, h2, h3, h4 { font-family: ${headingFamily}; }
        h1 { font-size: 28pt; font-weight: 700; text-align: center; margin-bottom: 0.5em; }
        h2 { font-size: 18pt; font-weight: 600; margin-top: 2em; margin-bottom: 0.5em; }
        h3 { font-size: 14pt; font-weight: 600; margin-top: 1.5em; }
        p { margin-bottom: 0.8em; }
        .title-page { text-align: center; padding-top: 2in; page-break-after: always; }
        .title-page h1 { font-size: 28pt; font-weight: 700; margin-bottom: 0.3em; }
        .title-page .subtitle { font-size: 16pt; color: #64748b; margin-bottom: 1em; }
        .title-page .author { font-size: 14pt; font-style: italic; }
        .page-header { color: #64748b; font-size: 9pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 4pt; margin-bottom: 16pt; }
        .page-footer { color: #64748b; font-size: 9pt; border-top: 1px solid #e2e8f0; padding-top: 4pt; margin-top: 16pt; }
      `;

      let titlePageHtml = '';
      if (docTitle || author || subtitle) {
        titlePageHtml = `<div class="title-page">
          ${docTitle ? `<h1>${docTitle}</h1>` : ''}
          ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
          ${author ? `<p class="author">by ${author}</p>` : ''}
        </div>`;
      }

      const headerHtml = headerText ? `<div class="page-header">${headerText}</div>` : '';
      const footerHtml = footerText ? `<div class="page-footer">${footerText}</div>` : '';

      const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <style>${style}</style>
  <!--[if gte mso 9]>
  <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml>
  <![endif]-->
</head>
<body>
  ${titlePageHtml}
  ${headerHtml}
  ${editorHtml || ''}
  ${footerHtml}
</body>
</html>`;

      const mhtml = [
        'MIME-Version: 1.0',
        'Content-Type: multipart/related; boundary="----=_NextPart_01"',
        '',
        '------=_NextPart_01',
        'Content-Location: file:///C:/doc.htm',
        'Content-Transfer-Encoding: quoted-printable',
        'Content-Type: text/html; charset="utf-8"',
        '',
        fullHtml,
        '',
        '------=_NextPart_01--',
      ].join('\r\n');

      return new Response(mhtml, {
        headers: {
          'Content-Type': 'application/msword',
          'Content-Disposition': `attachment; filename="${docTitle.replace(/[^a-z0-9]/gi, '_')}.doc"`,
        },
      });
    }

    return Response.json({ error: 'Unknown format' }, { status: 400 });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});