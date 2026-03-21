// WriterSection — Extracted from GenerateTab (Phase 6 split)
// Chapter list grouped by acts, action buttons bar (regen outline, generate scenes,
// write all, write act), write-all modal, proceed button

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2, Sparkles, RefreshCw, Zap, LayoutGrid, ArrowRight
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import WriteAllChaptersModal from "../WriteAllChaptersModal";
import ProjectWordCount from "../ProjectWordCount";
import ExplicitTagsWarning from "../ExplicitTagsWarning";
import InteriorityGateBanner, { hasProtagonistInteriority, needsInteriorityGate } from "../InteriorityGateBanner";
import { getActChapters, getActStatus } from "../ActDetection";
import ActHeader from "../ActHeader";
import ActSplitEditor from "../ActSplitEditor";
import ChapterItem from "./ChapterItem";
import { safeParse } from "./OutlineSection";

export default function WriterSection({
  projectId, spec, projectData, chapters, acts, parsedOutline,
  // Outline actions
  isPartial, generating, generateError,
  onGenerateOutline, onResumeDetail,
  // Scene generation
  generatingAllScenes, allScenesProgress, onGenerateAllScenes,
  // Chapter writing
  activeChapterIds, streamingChapterId, streamingContent, chapterProgress,
  resumingFromChapter, writeAllActive, writeAllModalOpen, writeAllProgress,
  writingActNumber, targetLength, interiorityMissing,
  onWriteChapter, onResumeFromChapter, onWriteAllChapters,
  onWriteAct, onStopWriteAll, onSetWriteAllModalOpen, onSetCustomActSplits,
  refetchChapters, onProceed,
  // Outline resolved data for erotica check
  resolvedOutlineData, outline, queryClient,
}) {
  const [regenOutlineConfirm, setRegenOutlineConfirm] = useState(false);

  const generatedCount = chapters.filter(c => c.status === "generated" || (c.status === "error" && c.word_count > 100)).length;
  const totalCount = chapters.length;
  const allGenerated = totalCount > 0 && generatedCount === totalCount;

  return (
    <div className="space-y-6">
      {/* Progress + Word Count */}
      {totalCount > 0 && <ProjectWordCount chapters={chapters} targetLength={spec?.target_length || "medium"} />}

      {/* Protagonist interiority gate for fiction */}
      {needsInteriorityGate(spec) && !hasProtagonistInteriority(spec, projectData) && (
        <InteriorityGateBanner onGoToSpec={() => window.dispatchEvent(new CustomEvent('navigateToPhase', { detail: 'setup' }))} />
      )}

      {/* Explicit tags warning for erotica projects */}
      {spec && /erotica|erotic/i.test(((spec.genre || '') + ' ' + (spec.subgenre || ''))) && resolvedOutlineData && (() => {
        const parsed = safeParse(resolvedOutlineData);
        if (!parsed) return null;
        return <ExplicitTagsWarning outlineData={parsed} outlineRaw={resolvedOutlineData} outline={outline} projectId={projectId} onResolved={() => queryClient.invalidateQueries({ queryKey: ["outline", projectId] })} />;
      })()}

      {/* Partial outline banner */}
      {isPartial && !generating && !generateError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center justify-between">
          <span>Outline structure is ready but detail is incomplete.</span>
          <Button size="sm" onClick={onResumeDetail} className="bg-amber-600 hover:bg-amber-700 text-white ml-3 shrink-0"><Sparkles className="w-3 h-3 mr-1" /> Resume</Button>
        </div>
      )}

      {generateError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{generateError}</div>}

      {/* Action buttons bar */}
      <div className="flex flex-wrap justify-end gap-2">
        {isPartial && <Button size="sm" onClick={onResumeDetail} disabled={generating} className="bg-amber-600 hover:bg-amber-700 text-white"><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Resume Detail Generation</Button>}
        <Button variant="outline" size="sm" onClick={() => {
          const hasWritten = chapters.some(c => c.status === 'generated');
          if (hasWritten) setRegenOutlineConfirm(true); else onGenerateOutline();
        }} style={{ color: '#52516a', borderColor: '#e8e8ec' }}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {generateError ? 'Retry' : 'Regenerate Outline'}</Button>

        {totalCount > 0 && chapters.some(c => !c.scenes || c.scenes.trim() === 'null' || c.scenes.trim() === '[]' || c.scenes.trim() === '' || c.scenes.trim() === '{}') && (
          <Button onClick={onGenerateAllScenes} disabled={generatingAllScenes || writeAllActive}
            style={{ background: '#5b50f0' }} className="hover:opacity-90 text-white">
            {generatingAllScenes ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{spec?.book_type === 'nonfiction' ? 'Generating Beat Sheets…' : 'Generating Scenes…'}</>
              : <><LayoutGrid className="w-4 h-4 mr-2" />{spec?.book_type === 'nonfiction' ? 'Generate All Beat Sheets' : 'Generate All Scenes'}</>}
          </Button>
        )}
        {totalCount > 0 && generatedCount < totalCount && (
          <Button variant="outline" size="sm" onClick={onWriteAllChapters} disabled={generating || writeAllActive} style={{ color: '#52516a', borderColor: '#e8e8ec' }} title="Write all chapters sequentially">
            <Zap className="w-3.5 h-3.5 mr-1.5" /> {writeAllActive ? "Writing..." : `Write All (${totalCount - generatedCount} remaining)`}
          </Button>
        )}
      </div>
      {allScenesProgress && <div className="text-sm font-medium text-right" style={{ color: '#5b50f0' }}>{allScenesProgress}</div>}

      {/* Chapters grouped by Act */}
      {chapters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base" style={{ color: 'var(--ink, #18171f)' }}>Chapters</h3>
            {acts && <ActSplitEditor acts={acts} totalChapters={totalCount} onSave={onSetCustomActSplits} />}
          </div>
          {[1, 2, 3].map(actNum => {
            const act = acts?.[`act${actNum}`];
            if (!act) return null;
            const actChapters = getActChapters(chapters, acts, actNum);
            if (actChapters.length === 0) return null;
            const actStatus = getActStatus(chapters, acts, actNum);
            const actGenerated = actChapters.filter(c => c.status === 'generated').length;
            const prevComplete = actNum === 1 || getActStatus(chapters, acts, actNum - 1) === 'complete';

            return (
              <div key={actNum} className="space-y-2">
                <ActHeader actNumber={actNum} act={act} status={actStatus} chapterCount={actChapters.length} generatedCount={actGenerated}
                  onWriteAct={onWriteAct} isWriting={writingActNumber === actNum} disabled={!prevComplete || writeAllActive || interiorityMissing} prevActComplete={prevComplete} />
                {actChapters.map(chapter => {
                  const olCh = parsedOutline?.chapters?.find(c => (c.number || c.chapter_number) === chapter.chapter_number);
                  const beatData = olCh?.beat_function ? { beat_name: olCh.beat_name, beat_function: olCh.beat_function } : null;
                  return (
                    <ChapterItem key={chapter.id} chapter={chapter} spec={spec} project={projectData}
                      onWrite={onWriteChapter} onRewrite={onWriteChapter} onResume={onResumeFromChapter}
                      streamingContent={streamingContent[chapter.id] || ""} isStreaming={streamingChapterId === chapter.id}
                      isWriting={activeChapterIds.has(chapter.id)} isResuming={resumingFromChapter === chapter.chapter_number}
                      chapterProgress={chapterProgress[chapter.id] || null} onScenesUpdated={refetchChapters} beatData={beatData} />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Proceed button */}
      {allGenerated && (
        <div className="flex justify-end pt-2">
          <Button onClick={onProceed} className="bg-indigo-600 hover:bg-indigo-700 px-6">Proceed to Editor <ArrowRight className="w-4 h-4 ml-2" /></Button>
        </div>
      )}

      {/* Write All Chapters Modal */}
      <WriteAllChaptersModal isOpen={writeAllModalOpen} onClose={() => onSetWriteAllModalOpen(false)} onProceed={onProceed} progress={writeAllProgress} onStop={onStopWriteAll} targetLength={targetLength} />

      {/* Regenerate Outline Confirmation */}
      <AlertDialog open={regenOutlineConfirm} onOpenChange={setRegenOutlineConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Regenerate Outline?</AlertDialogTitle><AlertDialogDescription>This will erase all written chapters and generate a completely new outline. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { setRegenOutlineConfirm(false); onGenerateOutline(); }}>Erase Chapters & Regenerate</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}