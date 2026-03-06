import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AUTHOR_VOICES = [
  {
    group: "Universal",
    authors: [
      { id: "basic", name: "Basic (No specific voice)", adjectives: "clean, neutral, competent" }
    ]
  },
  {
    group: "Literary & Classic",
    authors: [
      { id: "hemingway", name: "Ernest Hemingway", adjectives: "terse, understated, declarative" },
      { id: "austen", name: "Jane Austen", adjectives: "witty, ironic, elegant" },
      { id: "morrison", name: "Toni Morrison", adjectives: "lyrical, poetic, nonlinear" },
      { id: "mccarthy", name: "Cormac McCarthy", adjectives: "sparse, biblical, unflinching" },
      { id: "vonnegut", name: "Kurt Vonnegut", adjectives: "absurdist, darkly-humorous, metafictional" },
      { id: "didion", name: "Joan Didion", adjectives: "cool, precise, observational" }
    ]
  },
  {
    group: "Fantasy & Sci-Fi",
    authors: [
      { id: "tolkien", name: "J.R.R. Tolkien", adjectives: "mythic, elevated, archaic" },
      { id: "rowling", name: "J.K. Rowling", adjectives: "accessible, whimsical, warm" },
      { id: "leguin", name: "Ursula K. Le Guin", adjectives: "sparse, philosophical, anthropological" },
      { id: "gaiman", name: "Neil Gaiman", adjectives: "mythic, modern, genre-blending" },
      { id: "pratchett", name: "Terry Pratchett", adjectives: "satirical, comedic, warm" }
    ]
  },
  {
    group: "Mystery & Thriller",
    authors: [
      { id: "chandler", name: "Raymond Chandler", adjectives: "hardboiled, cynical, atmospheric" },
      { id: "christie", name: "Agatha Christie", adjectives: "puzzle-box, clean, misdirecting" }
    ]
  },
  {
    group: "Magical Realism",
    authors: [
      { id: "marquez", name: "Gabriel García Márquez", adjectives: "lush, sprawling, mythic-mundane" },
      { id: "atwood", name: "Margaret Atwood", adjectives: "sharp, sardonic, precise" }
    ]
  },
  {
    group: "Horror & Dark",
    authors: [
      { id: "king", name: "Stephen King", adjectives: "conversational, immersive, dread-building" }
    ]
  },
  {
    group: "Nonfiction & Popular Science",
    authors: [
      { id: "gladwell", name: "Malcolm Gladwell", adjectives: "narrative-driven, counterintuitive, anecdotal" },
      { id: "bryson", name: "Bill Bryson", adjectives: "humorous, curious, self-deprecating" },
      { id: "sagan", name: "Carl Sagan", adjectives: "awe-inspiring, poetic, accessible" }
    ]
  }
];

export default function AuthorVoiceSelector({ value, onValueChange }) {
  const selectedAuthor = AUTHOR_VOICES.flatMap(g => g.authors).find(a => a.id === value);

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="mt-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AUTHOR_VOICES.map((group) => (
            <div key={group.group}>
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {group.group}
              </div>
              {group.authors.map((author) => (
                <SelectItem key={author.id} value={author.id}>
                  <span className="font-medium">{author.name}</span>
                  <span className="text-slate-500 ml-2">— {author.adjectives}</span>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
      {selectedAuthor && selectedAuthor.id !== "basic" && (
        <p className="text-xs text-slate-500 italic">{selectedAuthor.adjectives}</p>
      )}
    </div>
  );
}