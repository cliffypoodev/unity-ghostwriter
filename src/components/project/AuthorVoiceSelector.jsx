import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Author Profile Library — grouped by genre ────────────────────────────────
// Used for: (1) dropdown grouping, (2) style descriptor injection into chapter prompts

export const AUTHOR_PROFILES = {
  'Universal': [
    { id: 'basic', name: 'Basic (No specific voice)', descriptor: 'clean, neutral, competent', style_prompt: 'Clean, neutral, competent prose.', spice_range: [0, 4], beat_match: [] },
  ],
  'Romance': [
    { id: 'colleen-hoover', name: 'Colleen Hoover', descriptor: 'raw, emotional, dual POV, trauma-forward', style_prompt: 'Write with emotional rawness and psychological intensity. Use dual or close third-person POV. Characters process trauma through action and dialogue, rarely internal monologue alone. Sentences are medium length, accessible but never shallow. Endings of scenes create forward pull rather than resolution.', spice_range: [2, 4], beat_match: ['Slow Burn', 'Gritty Cinematic'] },
    { id: 'taylor-jenkins-reid', name: 'Taylor Jenkins Reid', descriptor: 'nonlinear timelines, ensemble casts, emotional excavation', style_prompt: 'Use nonlinear or dual-timeline structure when possible. Characters feel like real people whose complexity reveals slowly. Emotional moments hit hardest when underplayed. Interview or document fragments can supplement narrative. Prose is accessible, warm but not saccharine.', spice_range: [1, 3], beat_match: ['Slow Burn', 'Hollywood Blockbuster'] },
    { id: 'emily-henry', name: 'Emily Henry', descriptor: 'sharp banter, enemies-to-lovers, self-discovery through wit', style_prompt: 'Lead with dialogue and banter. Characters are intelligent and self-aware, often deflecting vulnerability with humor. Prose is witty without being glib. Internal monologue is sharp and often self-deprecating. Romantic tension builds through intellectual friction, not melodrama.', spice_range: [2, 3], beat_match: ['Slow Burn', 'Clean Romance'] },
    { id: 'sally-rooney', name: 'Sally Rooney', descriptor: 'spare, intellectual, class-conscious, Irish minimalism', style_prompt: 'Use minimal dialogue tags. Prose is stripped down, precise, and observational. Characters analyze their own emotions at slight remove. No ornament, no decoration. Social and economic context present but never heavy-handed. Sexual and romantic scenes handled with clinical intimacy.', spice_range: [2, 3], beat_match: ['Slow Burn', 'Melancholic Literary'] },
    { id: 'nicholas-sparks', name: 'Nicholas Sparks', descriptor: 'sentimental, fate-driven, Southern settings, loss-forward', style_prompt: 'Build toward emotional devastation slowly. Southern or coastal settings matter — treat them as characters. Fate and circumstance drive plot as much as choice. Prose is clean and accessible. Endings may be happy or tragic but always feel earned and inevitable.', spice_range: [0, 1], beat_match: ['Clean Romance', 'Slow Burn'] },
    { id: 'penelope-douglas', name: 'Penelope Douglas', descriptor: 'dark romance, morally grey heroes, obsessive tension', style_prompt: 'Embrace moral ambiguity without apologizing for it. Heroes are dangerous and the danger is part of the appeal. Tension is psychological as much as physical. Prose is intense, close first-person. Do not soften edges for comfort.', spice_range: [3, 4], beat_match: ['Gritty Cinematic', 'Dark Suspense'] },
    { id: 'francine-rivers', name: 'Francine Rivers', descriptor: 'faith-infused, redemption arcs, biblical parallel structure', style_prompt: 'Faith is present through character behavior, not exposition. Redemption arcs are central but hard-won. Prose is clean, warm, and accessible. Grace and forgiveness are the emotional engine.', spice_range: [0, 0], beat_match: ['Faith-Infused Contemporary', 'Clean Romance'] },
  ],
  'Thriller & Suspense': [
    { id: 'gillian-flynn', name: 'Gillian Flynn', descriptor: 'unreliable narrators, dark female interiority, shocking reveals', style_prompt: 'Use unreliable first or close-third narration. Female characters are complex, dark, and capable of violence. Prose is sharp, sometimes venomous. The reader should feel complicit. Reveals should reframe everything that came before. Never sentimentalize.', spice_range: [2, 3], beat_match: ['Dark Suspense', 'Intellectual Psychological'] },
    { id: 'tana-french', name: 'Tana French', descriptor: 'atmospheric, psychological, Irish settings, unreliable memory', style_prompt: 'Build atmosphere slowly and let it become suffocating. Dublin or Irish settings carry cultural weight — use it. Investigators have personal wounds that compromise their objectivity. Prose is literary but never ornate. The mystery of the detective matters as much as the murder.', spice_range: [1, 2], beat_match: ['Dark Suspense', 'Melancholic Literary'] },
    { id: 'james-patterson', name: 'James Patterson', descriptor: 'ultra-fast pacing, short chapters, high-concept hooks', style_prompt: 'Keep chapters under 1,500 words. End every chapter on a micro-cliffhanger or a revelation. Sentences are short. Characters are efficient. Plot mechanics are king. Never pause for introspection when action can substitute.', spice_range: [1, 2], beat_match: ['Fast-Paced Thriller', 'Hollywood Blockbuster'] },
    { id: 'michael-connelly', name: 'Michael Connelly', descriptor: 'procedural precision, Los Angeles texture, moral fatigue', style_prompt: 'Police and legal procedure must be accurate and specific. Los Angeles is a character. The detective\'s moral compass bends under sustained pressure. Prose is clean and propulsive with occasional lyrical observation. Justice is complicated and often incomplete.', spice_range: [1, 2], beat_match: ['Clinical Procedural', 'Hard-Boiled Noir'] },
    { id: 'harlan-coben', name: 'Harlan Coben', descriptor: 'suburban secrets, missing persons, family-threat hooks', style_prompt: 'Start with a stable suburban life, then crack it open. Secrets from the past reach into the present. Prose is brisk, accessible, conversational. Twists should feel earned in retrospect.', spice_range: [1, 2], beat_match: ['Fast-Paced Thriller', 'Dark Suspense'] },
    { id: 'lee-child', name: 'Lee Child', descriptor: 'stripped-down action, lone hero, tactical precision', style_prompt: 'Reacher thinks in tactics. Every scene has a spatial logic. Prose is minimal, declarative, almost military in efficiency. Dialogue is sparse and loaded. Violence is fast, mechanical, and consequence-free for the protagonist.', spice_range: [1, 2], beat_match: ['Fast-Paced Thriller', 'Hyper-Stylized Action'] },
  ],
  'Literary Fiction': [
    { id: 'toni-morrison', name: 'Toni Morrison', descriptor: 'lyrical, nonlinear, cultural memory, collective trauma', style_prompt: 'Prose is lyrical but never decorative — every image carries cultural or emotional weight. Time is nonlinear, memory intrudes on present action. Community and ancestral history are characters. Do not over-explain. Trust the image to carry the meaning.', spice_range: [0, 2], beat_match: ['Melancholic Literary', 'Poetic Magical Realism'] },
    { id: 'cormac-mccarthy', name: 'Cormac McCarthy', descriptor: 'sparse, violent, biblical cadence, no quotation marks', style_prompt: 'Remove quotation marks from dialogue — attribution through context and rhythm. Prose is spare, biblical in cadence. Violence is matter-of-fact and never softened. Landscape is vast and indifferent. No redemption is guaranteed.', spice_range: [1, 3], beat_match: ['Gritty Cinematic', 'Melancholic Literary'] },
    { id: 'kazuo-ishiguro', name: 'Kazuo Ishiguro', descriptor: 'restrained, unreliable memory, repression as narrative engine', style_prompt: 'The narrator withholds more than they reveal, often without knowing it. Emotions are never stated — they leak through gaps. Prose is polished, formal, slightly distant. The reader understands more than the narrator does. Tragedy accumulates in silences.', spice_range: [0, 1], beat_match: ['Melancholic Literary', 'Intellectual Psychological'] },
    { id: 'zadie-smith', name: 'Zadie Smith', descriptor: 'witty, social commentary, multiracial Britain, essayistic', style_prompt: 'Prose is confident, slightly essayistic, willing to editorialize. Characters represent intersecting social forces as well as being individuals. Wit is ever-present but never cheap. Race, class, and culture are examined without being reduced to lesson.', spice_range: [1, 2], beat_match: ['Satirical', 'Melancholic Literary'] },
    { id: 'donna-tartt', name: 'Donna Tartt', descriptor: 'lush, slow-burning, classical obsession, moral consequence', style_prompt: 'Prose is rich without being purple — sentences are long, carefully constructed, classical in flavor. Characters are obsessive and intellectually driven. Violence and its moral aftermath are central. Beauty and corruption are linked.', spice_range: [1, 2], beat_match: ['Slow Burn', 'Intellectual Psychological'] },
  ],
  'Mystery': [
    { id: 'agatha-christie', name: 'Agatha Christie', descriptor: 'puzzle-first, drawing room, elegant misdirection', style_prompt: 'Plot mechanics are the priority. Every detail is either a clue or a red herring — nothing is decorative. Prose is clean, efficient, and slightly dry. The solution must be both surprising and inevitable in retrospect.', spice_range: [0, 0], beat_match: ['Clinical Procedural', 'Whimsical Cozy'] },
    { id: 'louise-penny', name: 'Louise Penny', descriptor: 'atmospheric village, psychological depth, quiet menace', style_prompt: 'Three Pines is a character — its beauty and its darkness. Community relationships are load-bearing. Prose is warm but not cozy — evil is always present beneath the surface. Human frailty treated with compassion.', spice_range: [0, 1], beat_match: ['Dark Suspense', 'Slow Burn'] },
    { id: 'kate-atkinson', name: 'Kate Atkinson', descriptor: 'nonlinear, metafictional, witty, WWII intersections', style_prompt: 'Structure is a tool for meaning, not just delivery. Timelines intersect unexpectedly. Prose is witty, knowing, self-aware. Tragedy and absurdity coexist. Character interiority is sophisticated and layered.', spice_range: [1, 2], beat_match: ['Intellectual Psychological', 'Melancholic Literary'] },
  ],
  'Horror': [
    { id: 'stephen-king', name: 'Stephen King', descriptor: 'character-driven, small town, populist, earned dread', style_prompt: 'Build character before building dread — we must care before we can fear. Small towns carry deep darkness. Pop culture references ground the supernatural in the real. Prose is colloquial, sometimes meandering — but the meandering is the point. Terror is ordinary life twisted.', spice_range: [2, 4], beat_match: ['Visceral Horror', 'Dark Suspense'] },
    { id: 'shirley-jackson', name: 'Shirley Jackson', descriptor: 'domestic dread, psychological ambiguity, women and houses', style_prompt: 'The horror is in what is not said. Domestic spaces are suffocating and complicit. Female characters are constrained by social expectation. Prose is precise, slightly formal, deceptively calm. Never explain the supernatural — leave the reader uncertain.', spice_range: [0, 1], beat_match: ['Dark Suspense', 'Melancholic Literary'] },
    { id: 'paul-tremblay', name: 'Paul Tremblay', descriptor: 'literary horror, anxious realism, meta-narrative', style_prompt: 'Ground supernatural events in the possibility of rational explanation — never fully resolve which. Prose is literary, character-focused, anxiety-soaked. Contemporary fears intersect with horror tropes. Endings are ambiguous by design.', spice_range: [2, 3], beat_match: ['Visceral Horror', 'Intellectual Psychological'] },
  ],
  'Fantasy': [
    { id: 'brandon-sanderson', name: 'Brandon Sanderson', descriptor: 'intricate magic systems, epic scope, logical world-building', style_prompt: 'Magic has rules and costs — establish them early and honor them always. World-building is extensive but revealed through character experience, not exposition. Plot structure is meticulous and payoffs are earned chapters in advance. Prose is clear, functional, and paced for momentum.', spice_range: [0, 1], beat_match: ['Grandiose Space Opera', 'Epic Historical'] },
    { id: 'nk-jemisin', name: 'N.K. Jemisin', descriptor: 'second-person POV, radical structure, Afrofuturism', style_prompt: 'Structural experimentation creates meaning. Second person creates uncomfortable intimacy. Race, power, and systemic violence are embedded in the world\'s architecture. Prose is assured, sometimes confrontational. History repeats in geological cycles.', spice_range: [1, 2], beat_match: ['Cerebral Sci-Fi', 'Poetic Magical Realism'] },
    { id: 'joe-abercrombie', name: 'Joe Abercrombie', descriptor: 'grimdark, subversive tropes, morally grey, consequence-heavy', style_prompt: 'Subvert genre expectations — heroes are flawed to the point of villainy, villains have coherent logic. Violence has physical and psychological consequences. Prose is sharp, often darkly funny. No one is saved by destiny.', spice_range: [3, 4], beat_match: ['Gritty Cinematic', 'Urban Gritty Fantasy'] },
    { id: 'robin-hobb', name: 'Robin Hobb', descriptor: 'emotional devastation, slow burn, character suffering, loyalty', style_prompt: 'Build deep attachment to characters before making them suffer — and then make them suffer extensively. First-person narration creates suffocating intimacy. Prose is warm and immersive. Hope is extended and then systematically withdrawn.', spice_range: [1, 2], beat_match: ['Slow Burn', 'Melancholic Literary'] },
    { id: 'terry-pratchett', name: 'Terry Pratchett', descriptor: 'satirical, humanist, footnote-driven wit, Discworld', style_prompt: 'Satire through specificity — the joke works because the detail is accurate. Footnotes or asides can carry philosophical weight. Characters are competent and self-aware. Humor masks genuine emotional stakes. Prose is playful but never shallow.', spice_range: [0, 1], beat_match: ['Satirical', 'Whimsical Cozy'] },
    { id: 've-schwab', name: 'V.E. Schwab', descriptor: 'morally grey, multiple POVs, portal fantasy, atmospheric', style_prompt: 'Multiple POVs each have distinct voice and logic. Moral clarity is never provided. World-building is atmospheric before it is encyclopedic. Prose is propulsive with literary moments. Villains have the best arguments.', spice_range: [1, 2], beat_match: ['Dark Suspense', 'Urban Gritty Fantasy'] },
  ],
  'Science Fiction': [
    { id: 'andy-weir', name: 'Andy Weir', descriptor: 'technical problem-solving, first-person humor, hard science', style_prompt: 'Protagonist solves problems in real time, showing their work. First-person voice is witty, self-deprecating, conversational. Science must be accurate enough to feel real. Humor emerges from genuine peril. Every solution creates a new problem.', spice_range: [0, 1], beat_match: ['Cerebral Sci-Fi', 'Fast-Paced Thriller'] },
    { id: 'ursula-le-guin', name: 'Ursula K. Le Guin', descriptor: 'anthropological, philosophical, elegant prose, gender and society', style_prompt: 'Science fiction as anthropology — explore what different social structures do to human beings. Prose is elegant, unhurried, confident. Gender, race, and power are examined through invented societies. Character interiority is rich. The strange should feel inevitable.', spice_range: [0, 1], beat_match: ['Cerebral Sci-Fi', 'Poetic Magical Realism'] },
    { id: 'philip-k-dick', name: 'Philip K. Dick', descriptor: 'paranoid, reality-bending, working-class anxiety, identity', style_prompt: 'Reality is unreliable — establish it, then systematically undermine it. Protagonists are ordinary people caught in systems they cannot comprehend. Prose is functional, sometimes frantic. The philosophical question must be earned through plot, not stated.', spice_range: [1, 2], beat_match: ['Cerebral Sci-Fi', 'Intellectual Psychological'] },
    { id: 'william-gibson', name: 'William Gibson', descriptor: 'atmospheric cyberpunk, fragmented prose, future-as-present', style_prompt: 'The future has arrived unevenly. Prose is fragmented, associative, image-dense. Technology is atmospheric, not explained. Corporate power is the dominant force. Characters move through spaces simultaneously glamorous and decaying.', spice_range: [2, 3], beat_match: ['Cerebral Sci-Fi', 'Hard-Boiled Noir'] },
  ],
  'Nonfiction Narrative': [
    { id: 'erik-larson', name: 'Erik Larson', descriptor: 'dual narrative, historical, cinematic, archival depth', style_prompt: 'Run two narratives in parallel and let them collide at the climax. Every scene must be documentable from primary sources. Prose is cinematic and propulsive despite being nonfiction. Let the facts create the drama — never embellish.', spice_range: [0, 1], beat_match: ['Investigative / Nonfiction', 'Epic Historical'] },
    { id: 'david-grann', name: 'David Grann', descriptor: 'investigative, immersive, mystery structure, moral weight', style_prompt: 'Structure nonfiction like a mystery — reveal information in an order that builds suspense. The author\'s own investigation can be part of the story. Prose is clean and gripping. End on the moral implication, not just the fact.', spice_range: [0, 1], beat_match: ['Investigative / Nonfiction', 'Hard-Boiled Noir'] },
    { id: 'malcolm-gladwell', name: 'Malcolm Gladwell', descriptor: 'counterintuitive, anecdotal, accessible, idea-forward', style_prompt: 'Lead with a counterintuitive claim, then build the case through specific stories. Every abstract idea needs a concrete human face. Prose is warm, accessible, slightly breathless. The reader should feel they are being let in on a secret.', spice_range: [0, 0], beat_match: ['Reference / Educational', 'Investigative / Nonfiction'] },
    { id: 'jon-krakauer', name: 'Jon Krakauer', descriptor: 'adventure, first-person urgency, moral reckoning, obsession', style_prompt: 'The author\'s own obsession is part of the story. Physical danger is rendered with technical accuracy. Prose is urgent, occasionally self-lacerating. Research is deep but wears lightly.', spice_range: [1, 2], beat_match: ['Investigative / Nonfiction', 'Fast-Paced Thriller'] },
  ],
  'True Crime': [
    { id: 'michelle-mcnamara', name: 'Michelle McNamara', descriptor: 'literary, obsessive, personal, victim-centered', style_prompt: 'The writer\'s obsession is part of the story. Victims are people, not case numbers — give them life before the crime. Prose is literary and sometimes lyrical despite the subject matter. Dark humor is permitted as a survival mechanism.', spice_range: [1, 2], beat_match: ['Investigative / Nonfiction', 'Melancholic Literary'] },
    { id: 'robert-kolker', name: 'Robert Kolker', descriptor: 'victim-centered, empathetic journalism, systemic critique', style_prompt: 'Start with the victims as living people, not as bodies. The systemic failures that allowed crimes to occur matter as much as the crimes. Prose is empathetic, careful, never exploitative. Never sensationalize.', spice_range: [0, 1], beat_match: ['Investigative / Nonfiction'] },
  ],
  'Historical Fiction': [
    { id: 'hilary-mantel', name: 'Hilary Mantel', descriptor: 'close third present tense, immersive interiority, Tudor power', style_prompt: 'Use close third-person present tense. Power dynamics in every room. Period detail is embedded in action, never listed. Prose is dense but never slow — every sentence advances character or power. History is intimate and political simultaneously.', spice_range: [1, 2], beat_match: ['Epic Historical', 'High-Stakes Political'] },
    { id: 'ken-follett', name: 'Ken Follett', descriptor: 'epic, architectural, accessible, multi-generational saga', style_prompt: 'Characters span generations and social classes. Architecture and trade are characters. Prose is clear and propulsive — literary ambition serves story. Historical events are backdrop to personal stakes.', spice_range: [1, 3], beat_match: ['Epic Historical', 'Hollywood Blockbuster'] },
    { id: 'colm-toibin', name: 'Colm Tóibín', descriptor: 'quiet interiority, Irish exile, restrained emotion, literary', style_prompt: 'What is not said carries as much weight as what is said. Characters feel exiled from their own emotions. Prose is precise, spare, and melancholy. Endings resist resolution.', spice_range: [0, 1], beat_match: ['Melancholic Literary', 'Slow Burn'] },
  ],
  'Young Adult': [
    { id: 'john-green', name: 'John Green', descriptor: 'philosophical teens, witty dialogue, mortality themes', style_prompt: 'Teenagers who speak in essays and mean it. Wit is the primary mode of connection and deflection. Death and illness as philosophical problems. First-person voice is distinctive and self-aware. Emotional moments land hardest when underplayed.', spice_range: [0, 1], beat_match: ['Nostalgic Coming-of-Age', 'Slow Burn'] },
    { id: 'leigh-bardugo', name: 'Leigh Bardugo', descriptor: 'heist structure, ensemble cast, dark fantasy, morally grey crew', style_prompt: 'Build a crew with distinct voices and competing loyalties. Heist planning is as exciting as execution. Prose is punchy, atmospheric, occasionally savage. Characters are defined by what they want and what they\'ll sacrifice.', spice_range: [1, 2], beat_match: ['Hyper-Stylized Action', 'Urban Gritty Fantasy'] },
    { id: 'rainbow-rowell', name: 'Rainbow Rowell', descriptor: 'warm, contemporary, geek culture, found family, fandom', style_prompt: 'Characters are defined by their obsessions and passions, treated seriously. Geek culture and fandom are not punchlines. Prose is warm, funny, and emotionally honest. Romantic tension builds through shared interest rather than physical proximity.', spice_range: [0, 1], beat_match: ['Nostalgic Coming-of-Age', 'Clean Romance'] },
  ],
  'Self-Help & Business': [
    { id: 'brene-brown', name: 'Brené Brown', descriptor: 'vulnerable, research-backed, conversational, shame-focused', style_prompt: 'Lead with personal vulnerability before asking the reader to be vulnerable. Research is present but never clinical. Prose is warm, direct, occasionally funny. The author is not above the problem. Shame and courage are the twin engines.', spice_range: [0, 0], beat_match: ['Reference / Educational', 'Faith-Infused Contemporary'] },
    { id: 'james-clear', name: 'James Clear', descriptor: 'systematic, practical, habit architecture, evidence-based', style_prompt: 'Every claim has a mechanism and a practical application. Structure: story → concept → application → summary. Prose is clear, efficient, never motivational-poster shallow. The reader should finish each chapter knowing exactly what to do differently.', spice_range: [0, 0], beat_match: ['Reference / Educational'] },
    { id: 'ryan-holiday', name: 'Ryan Holiday', descriptor: 'Stoic philosophy, historical examples, masculine self-improvement', style_prompt: 'Anchor every lesson in a historical or contemporary story. Stoic philosophy is the framework but never heavy-handed. Prose is direct, slightly austere, never sentimental. The reader is challenged, not coddled.', spice_range: [0, 1], beat_match: ['Reference / Educational', 'Epic Historical'] },
  ],
};

// Flatten for lookups
export const ALL_AUTHOR_PROFILES = Object.values(AUTHOR_PROFILES).flat();

// Get a profile by ID
export function getAuthorProfile(id) {
  return ALL_AUTHOR_PROFILES.find(a => a.id === id) || ALL_AUTHOR_PROFILES.find(a => a.id === 'basic');
}

// Legacy ID mapping — maps old IDs to new ones for backward compatibility
const LEGACY_ID_MAP = {
  'hemingway': 'cormac-mccarthy',  // sparse prose → McCarthy is the new equivalent
  'austen': 'emily-henry',
  'morrison': 'toni-morrison',
  'mccarthy': 'cormac-mccarthy',
  'vonnegut': 'terry-pratchett',
  'didion': 'kazuo-ishiguro',
  'tolkien': 'brandon-sanderson',
  'rowling': 'rainbow-rowell',
  'leguin': 'ursula-le-guin',
  'gaiman': 've-schwab',
  'pratchett': 'terry-pratchett',
  'chandler': 'michael-connelly',
  'christie': 'agatha-christie',
  'marquez': 'toni-morrison',
  'atwood': 'gillian-flynn',
  'king': 'stephen-king',
  'gladwell': 'malcolm-gladwell',
  'bryson': 'malcolm-gladwell',
  'sagan': 'andy-weir',
};

export function resolveAuthorId(id) {
  if (!id || id === 'basic') return 'basic';
  // Check if it's already a new ID
  if (ALL_AUTHOR_PROFILES.some(a => a.id === id)) return id;
  // Try legacy mapping
  return LEGACY_ID_MAP[id] || 'basic';
}

export default function AuthorVoiceSelector({ value, onValueChange }) {
  const resolvedValue = resolveAuthorId(value);
  const selectedAuthor = ALL_AUTHOR_PROFILES.find(a => a.id === resolvedValue);

  const handleChange = (newId) => {
    onValueChange(newId);
  };

  return (
    <div className="space-y-2">
      <Select value={resolvedValue} onValueChange={handleChange}>
        <SelectTrigger className="mt-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {Object.entries(AUTHOR_PROFILES).map(([groupName, authors]) => (
            <div key={groupName}>
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide sticky top-0 bg-white">
                {groupName}
              </div>
              {authors.map((author) => (
                <SelectItem key={author.id} value={author.id}>
                  <span className="font-medium">{author.name}</span>
                  <span className="text-slate-400 ml-1.5 text-xs">— {author.descriptor}</span>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
      {selectedAuthor && selectedAuthor.id !== "basic" && (
        <p className="text-xs text-slate-500 italic">{selectedAuthor.descriptor}</p>
      )}
    </div>
  );
}