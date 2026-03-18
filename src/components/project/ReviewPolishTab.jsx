const handleFixAll = async () => {
    if (!scanResults) return;
    setFixingAll(true);
    const chaptersWithIssues = scanResults.chapterData.filter(cd => cd.findings.length > 0);

    for (const cd of chaptersWithIssues) {
      const ch = generatedChapters.find(c => c.chapter_number === cd.number);
      if (!ch) continue;
      try {
        console.log("[fixAll] Processing chapter", cd.number);
        const content = await resolveChapterContent(ch);
        if (!content || content.length < 100) {
          console.warn("[fixAll] Ch", cd.number, "no content, skipping");
          continue;
        }

        const fixedContent = autoFixChapter(content);

        if (fixedContent !== content) {
          console.log("[fixAll] Ch", cd.number, "changed, saving...");
          // Upload as file to avoid field size limit
          const blob = new Blob([fixedContent], { type: "text/plain" });
          const file = new File([blob], "chapter_" + ch.id + "_fixed.txt", { type: "text/plain" });
          let saved = false;

          // Try file upload first
          try {
            const uploadResult = await base44.integrations.Core.UploadFile({ file });
            if (uploadResult && uploadResult.file_url) {
              await base44.entities.Chapter.update(ch.id, { content: uploadResult.file_url });
              console.log("[fixAll] Ch", cd.number, "saved via file upload");
              saved = true;
            }
          } catch (upErr) {
            console.warn("[fixAll] File upload failed for ch", cd.number, upErr.message);
          }

          // Fallback to direct save
          if (!saved) {
            try {
              await base44.entities.Chapter.update(ch.id, { content: fixedContent });
              console.log("[fixAll] Ch", cd.number, "saved via direct update");
              saved = true;
            } catch (directErr) {
              console.error("[fixAll] Direct save also failed for ch", cd.number, directErr.message);
            }
          }

          if (saved) {
            const { findings, words } = scanChapter(fixedContent, cd.number, tense, targetWords);
            handleChapterScanUpdated(cd.number, findings, words);
          }
        } else {
          console.log("[fixAll] Ch", cd.number, "no changes needed");
        }
      } catch (err) {
        console.warn("[fixAll] Ch", cd.number, "error:", err.message);
      }
      await new Promise(r => setTimeout(r, 500));
    }
    setFixingAll(false);
  };