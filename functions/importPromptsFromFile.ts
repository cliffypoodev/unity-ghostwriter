import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Parse the prompts from the file structure
    // The file contains prompts in === PROMPT N === format
    // Each prompt has a title (sometimes doubled) and long detailed content

    const prompts = [
      {
        title: "Arkham Academic Investigations: Miskatonic Cuneiform Mystery",
        description: "A skeptical professor of ancient languages at Miskatonic must decipher a cuneiform tablet linked to the Necronomicon while academic pressure mounts and madness seeps through.",
        content: "Create a Lovecraftian horror gamebook set at Miskatonic University in 1926, centering on a skeptical professor of ancient languages who is forced to decipher a newly unearthed cuneiform tablet linked to a phrase in the Necronomicon. As academic pressure mounts, madness seeps through the cracks in scholarly reason, and choices centered around translation accuracy and scholarly alliances shape the descent into cosmic truths.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Mystery", "Academic", "Lovecraftian"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Missing Faculty Mystery",
        description: "A third-year anthropology student at Miskatonic investigates mysterious faculty disappearances tied to research on pre-human civilizations.",
        content: "Develop a complete interactive horror gamebook set in Arkham, where a third-year anthropology student at Miskatonic University investigates a series of mysterious disappearances among faculty members tied to an unpublished research paper on pre-human civilizations. Each scene should bring the reader deeper into secret chambers, lost texts, and buried trauma buried beneath the university's foundations.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Mystery", "Academic", "Investigation"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Orne Library Corruption",
        description: "A junior librarian discovers a corrupted micrograph plate from the Orne Library with strange photographic anomalies and hidden motives.",
        content: "Generate a horror-mystery gamebook taking place in the night archives of the Orne Library, where a junior librarian discovers a corrupted micrograph plate released from a sealed cabinet. Choices should involve deciphering photographic anomalies, consulting professors with hidden motives, and determining if the evil lies in the images, the viewer, or something between.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Mystery", "Archives", "Dark"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Antarctic Expedition Inconsistencies",
        description: "An investigative journalist uncovers inconsistencies in Antarctic expedition letters, revealing spectral visitations and misplaced nautical charts.",
        content: "Write a Lovecraftian horror gamebook set in 1925, where an investigative journalist embedded at Miskatonic uncovers inconsistencies in the university's Antarctic expedition letters. Root the tale in academic politics, spectral visitations in empty lecture halls, and misplaced nautical charts—all pointing to something survived, or summoned, back to Arkham.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Mystery", "Academic", "Expedition"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Dream Diary Obsession",
        description: "A neuropsychologist becomes obsessed with a student's fragmented dream diary mentioning hollow scholars beneath College Hill.",
        content: "Create a cosmic horror gamebook about a neuropsychologist from Miskatonic who becomes obsessed with a student's fragmented dream diary mentioning the hollow scholars beneath College Hill. Include dream logic investigations, hypnosis gone wrong, and increasingly unreliable memory puzzles.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Psychological", "Dreams", "Dark"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Medical College Autopsy Mystery",
        description: "A young pathologist discovers strange symbols inside a professor's body during autopsy, leading to institutional cover-ups.",
        content: "Write a Lovecraftian horror gamebook set in Arkham's medical college, where a young pathologist is assigned an autopsy of a professor who supposedly died of heart failure—until strange symbols are found inside the body. The player must balance institutional cover-ups with a personal descent into anatomical heresy and ancient biology.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Medical", "Investigation", "Dark"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Genealogy and The Rats in the Walls",
        description: "A Miskatonic archivist discovers breeding patterns in a genealogy text linked to The Rats in the Walls implicating university faculty.",
        content: "Create an interactive horror gamebook in 1930s Arkham, focused on a Miskatonic University archivist whose routine task of restoring a genealogy text linked to The Rats in the Walls reveals a breeding pattern that directly implicates university faculty. Confrontations, cross-reference puzzles, and institutional secrets lie at the heart of each scene.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Mystery", "Archives", "Investigation"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Occult Sermon Translation",
        description: "A theology student is invited to translate rare occult sermons suppressed since Salem witch trials.",
        content: "Generate a Lovecraftian gamebook in which a theology student is invited to translate rare occult sermons suppressed since the Salem witch trials. Set within a candlelit Arkham lecture hall, the plot should branch based on decisions to replicate, reject, or quietly disseminate the doctrine—all while whispers from no visible source increase with each choice.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Arkham", "Horror", "Religious", "Investigation", "Dark"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Pnakotic Manuscript Authentication",
        description: "A doctoral candidate attempts to verify an original Pnakotic Manuscripts found in a sealed fraternity safe.",
        content: "Write a horror investigation gamebook involving an ambitious doctoral candidate trying to verify the authenticity of an original copy of the Pnakotic Manuscripts found in a sealed Kappa Epsilon fraternity safe. Center the terror in timelines that fracture subtly, professors who distort in memory, and examinations with no logical answers.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Mystery", "Academic", "Lovecraft"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Janitor's Discovery",
        description: "A janitor at Miskatonic accidentally encounters tomes beyond human comprehension during routine maintenance.",
        content: "Create a cosmic horror gamebook from the view of a janitor at Miskatonic University, who accidentally encounters tomes beyond human comprehension during routine maintenance. Players must navigate choices between telling anyone, hiding the truth, or embracing the silent glory beneath the boiler room.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Cosmic", "Discovery", "Dark"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Sumerian Whispers",
        description: "An Arkham linguistics professor receives whispered ancient Sumerian phrases from students who remember nothing.",
        content: "Compose a Lovecraftian horror gamebook in which an Arkham linguistics professor begins receiving whispered phrases in ancient Sumerian from his students—phrases none remember speaking afterward. Include language decryption mysteries, fragmented classroom lectures, and shriveled faculty who appear in no records.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Arkham", "Horror", "Linguistic", "Mystery", "Lovecraft"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Philosophy Reality Shift",
        description: "A skeptic philosophy professor questions Lovecraftian folklore while reality shifts with wrong conclusions.",
        content: "Develop a fully playable gamebook where a skeptic philosophy professor at Miskatonic questions the metaphysical implications of Lovecraftian folklore. The investigation becomes personal as reality shifts with each wrong conclusion. Offer logic puzzles that reward players only for truth that disturbs more than comforts, as sanity unspools.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Philosophical", "Reality-bending", "Dark"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Chess Society Time Alteration",
        description: "A faculty member joins the Miskatonic Chess Society and discovers each match alters time and memory.",
        content: "Generate a Lovecraftian horror gamebook based on a secret esoteric club operating under the guise of the Miskatonic Chess Society. A new faculty member is invited to play—only to discover each match alters time, history, and memory. Decision-making revolves around moves on and off the board.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Mystery", "Games", "Time-bending"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Telescope Transmission Mystery",
        description: "An astronomy professor discovers recordings from old telescope domes transmit sound patterns from The Whisperer in Darkness.",
        content: "Create a gamebook in which an astronomy professor at Miskatonic becomes alarmed by recordings from the university's old telescope domes, which transmit sound patterns aligned with elements of The Whisperer in Darkness. Choices involve comparing historic sky diagrams, deep-record analyses, and nocturnal trips to isolated hilltops.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Cosmic", "Mystery", "Investigation"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Ethnomusicology Wax Cylinders",
        description: "An assistant investigates obscure wax cylinders labeled Cthaegh's Choir with sound-based clues and auditory hallucinations.",
        content: "Write a Lovecraftian horror gamebook from the perspective of an assistant to a Miskatonic ethnomusicologist, investigating a collection of obscure wax cylinders labeled only with Cthaegh's Choir. Sound-based clues, cochlear pressure puzzles, and the slow spread of auditory hallucinations permeate each scene.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Audio", "Mystery", "Psychological"],
        word_count: 2800
      },
      {
        title: "Arkham Academic Investigations: Faculty Dream Sleeper",
        description: "A tenure-track historian uncovers a removed faculty member who never taught, only dreamed.",
        content: "Design a playable cosmic horror gamebook where a tenure-track historian at Miskatonic uncovers references to a removed faculty member who never taught, only dreamed. The player must interview aged colleagues, piece together erased lectures, and navigate the faculty's allegiances to decide whether the dreamer ever truly left.",
        book_type: "fiction",
        genre: "Horror",
        category: "Arkham Academic Investigations",
        tags: ["Miskatonic", "Horror", "Mystery", "Dreams", "Investigation"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: Cataloging Error",
        description: "A graduate student discovers a cataloging error pointing to a forbidden tome not registered in any official inventory.",
        content: "Create a fully playable Lovecraftian horror gamebook set entirely within the Miskatonic University Restricted Archives, where a graduate student uncovers a cataloging error that points to a forbidden tome not registered in any official inventory. As the player investigates misplaced records, secret indexing systems, and hidden chambers beneath the archives, they must decipher if this is a scholarly mistake—or a deliberate cover-up by a cult operating within the university.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Mystery", "Hidden", "Investigation"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: Professor's Death",
        description: "A junior faculty member must clean up after an aged theology professor found dead among scattered papers.",
        content: "Write an interactive Lovecraftian horror gamebook that begins with an aged theology professor at Miskatonic University being found dead amidst scattered papers in the Restricted Archives. The player, a junior faculty member, is asked to clean up the professor's effects—only to stumble upon cryptic notes referencing non-Euclidean cartographies and untranslated pages from the Pnakotic Manuscripts. The truth lies buried within the administrative and custodial routines of the archive itself.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Mystery", "Investigation", "Death"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: Grimoire Restoration",
        description: "A conservator restores water-damaged grimoires from the sub-basement where strange words appear.",
        content: "Generate a cosmic horror gamebook where the player is a trusted conservator tasked with restoring several water-damaged grimoires recovered from the sub-basement of Miskatonic's Restricted Archives. As they proceed, strange words begin appearing where none previously existed, and references to a vanished wing of the university library emerge within overly detailed restoration notes.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Mystery", "Books", "Investigation"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: Vatican Crates Translation",
        description: "An international scholar assists in translating sealed Vatican crates marked Adversus Necrologia.",
        content: "Design a Lovecraftian investigation gamebook based in the Restricted Archives of Miskatonic University during the winter of 1923. A recent influx of sealed Vatican crates marked Adversus Necrologia has caused concern among catalogers. The player, an international scholar on sabbatical, agrees to assist in translating these documents—unknowingly unlocking an ancient rite once bound by secret theological orders.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Religious", "Mystery", "Translation"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: Clay Tablets Discovery",
        description: "A visiting archivist discovers clay tablets listed as replicas are authentic with cultic lineage from The Nameless City.",
        content: "Create a Lovecraftian horror gamebook set in Miskatonic's Restricted Archives where the player, a visiting archivist specializing in Mesopotamian epigraphy, discovers several clay tablets listed as mere replicas are in fact authentic—and bear a cultic lineage traced directly to passages from The Nameless City. The resulting investigation leads to the heart of the archive's spatial anomalies.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Archaeological", "Mystery", "Lovecraft"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: Night Watchman Strange Behavior",
        description: "A nightwatchman records strange behavior in lower floors after new archaeological shipments.",
        content: "Write a complete Lovecraftian gamebook about a nightwatchman at the Restricted Archives of Miskatonic University who begins recording strange behavior in the lower floors after new shipments arrive from an archaeological expedition to the Arabian Peninsula. The player's nightly patrols become sanity-testing excursions into echoing vaults, incomplete blueprints, and contradictory objects.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Supernatural", "Investigation", "Night"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: Fire and Hidden Text",
        description: "A skeptical science instructor finds a 17th-century medical text in archives after a fire.",
        content: "Develop a Lovecraftian horror gamebook where the player is a skeptical science instructor assigned temporary stewardship over a portion of the Restricted Archives after a fire affected nearby chemical labs. Among ash-covered manuscripts and warped glass containers, they discover a 17th-century medical text referenced nowhere in the archive's index—and cross-referenced only in whispered faculty rumors.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Medical", "Mystery", "Fire"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: Brine and Dead Moths",
        description: "Alumni donations to the archives begin leaking brine and dead moths.",
        content: "Generate a Lovecraftian mystery gamebook where alumni donations to Miskatonic's Restricted Archives come under suspicion after a sealed wooden crate starts leaking brine and dead moths. The player, representing the university's department of antiquities, must trace the object's donors through letters, neglected trustee meeting notes, and eerily lucid dreams involving an underwater archive that mimics the Restricted section.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Mystery", "Underwater", "Investigation"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: War Veteran Groundskeeper",
        description: "A war veteran turned groundskeeper discovers miscatalogued items and documents predating the university.",
        content: "Write a Lovecraftian gamebook centered on a war veteran turned groundskeeper who is hired by Miskatonic's Restricted Archives during renovations. Tasked with disposing of excess shelving and outdated filing cabinets, they instead discover a maze of miscatalogued items, unreadable books, and wax-sealed documents referencing events that curiously predate the founding of the university itself.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Mystery", "Time", "Investigation"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: Pickman Etchings Discovery",
        description: "An art historian analyzes undocumented Richard Pickman etchings showing impossible archive angles.",
        content: "Generate an interactive horror gamebook where an art historian at Miskatonic University begins analyzing a portfolio found in the Restricted Archives that was never catalogued: a series of etchings attributed to Richard Pickman, believed destroyed. But the artist's final works show angles of the archive interior that defy physics—and corners the player has never consciously visited.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Art", "Mystery", "Impossible"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: Dreams and Falling Shelves",
        description: "A janitor survives collapsing shelves and discovers dreams influenced by unopened manuscripts.",
        content: "Write a gamebook that follows a Miskatonic University janitor who survives an apparent accident in the Restricted Archives involving collapsing shelves. Confined to the hospital, the player discovers their dreams are being influenced by certain manuscripts they didn't open—but now seem to remember vividly. Their recovery becomes an investigation driven through fragmented memory and clues buried in the archive's nightly logs.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Dreams", "Mystery", "Accident"],
        word_count: 2800
      },
      {
        title: "Miskatonic University Restricted Archives: South Pacific Artifacts",
        description: "A linguistic anthropologist documents South Pacific artifacts and deciphers notes from Professor Angell.",
        content: "Create a full Lovecraftian horror gamebook set in 1920 within the Restricted Archives of Miskatonic University, focused on the transfer of several South Pacific artifacts from another wing. Linked vaguely in letters to The Call of Cthulhu, the artifacts include stones that hum when unobserved. The player, a linguistic anthropologist, must document the items while deciphering personal notes from the late Professor Angell.",
        book_type: "fiction",
        genre: "Horror",
        category: "Miskatonic University Restricted Archives",
        tags: ["Archives", "Horror", "Cthulhu", "Artifacts", "Lovecraft"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Marsh Family Catalog",
        description: "An antiquarian catalogs Marsh family belongings, uncovering Deep One pact evidence.",
        content: "Design a Lovecraftian horror gamebook set in Innsmouth five years after the 1928 government raid. The protagonist, a skeptical Boston antiquarian, is sent to catalog remnants of the Marsh family's belongings salvaged from the town's ruins—but uncovers clues suggesting the Deep One pact endures beneath the submerged foundations.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Deep Ones", "Investigation", "Mystery"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Asylum Patient Interviews",
        description: "A Miskatonic psychiatrist interviews Innsmouth survivors in a remote inland asylum.",
        content: "Create a fully interactive horror gamebook set in a remote inland asylum housing survivors secretly evacuated from Innsmouth after the federal raid. The protagonist, a visiting Miskatonic psychiatrist, interviews patients who describe dreams of the deep, forgotten chants, and submerged cities. Player choices determine whether the doctor descends into delusion or uncovers an undying influence still calling from beneath Devil Reef.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Asylum", "Deep Ones", "Investigation"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Naval Intelligence Deep One Activity",
        description: "A naval intelligence officer investigates resurfaced Deep One activity near Innsmouth.",
        content: "Write a Lovecraftian mystery gamebook in which a naval intelligence officer is sent undercover to investigate resurfaced Deep One activity along the coast near Innsmouth. Reopened harbors, strange trade logs, and vanishing patrol boats form a trail of evidence. Each scene forces the player to balance military protocol with blasphemous discoveries pulled from waterlogged shipping records and distorted sonar readings.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Deep Ones", "Military", "Investigation"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Marsh Family Influence Genealogy",
        description: "A folklorist retraces Marsh family influence, revealing hidden shrines and forbidden genealogies.",
        content: "Generate an atmospheric gamebook set in 1933, where a young folklorist retraces the Marsh family's influence across rural New England towns, discovering hidden shrines, drowned settlements, and forbidden genealogies. The investigation reveals that Innsmouth's evil was only a surface manifestation of deeper aquatic worship.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Genealogy", "Investigation", "Deep Ones"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Coastal Map Inconsistencies",
        description: "A cartographer discovers warped coastal maps and submerged city evidence.",
        content: "Compose a playable horror gamebook in which a reclusive cartographer discovers inconsistencies in coastal maps postdating the destruction of Innsmouth. Sent to verify these anomalies, the player uncovers warped geography, flooded ruins, and shifting signs of a submerged city returning. Sanity, navigation, and trust in one's own eyes become primary mechanics as cosmic geography distorts known reality.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Maps", "Cosmic", "Investigation"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Boarding School Children",
        description: "A schoolteacher uncovers hidden journals among surviving Innsmouth children.",
        content: "Construct a cosmic horror mystery gamebook set in a Rhode Island boarding school that quietly took in surviving children from Innsmouth. A schoolteacher uncovers hidden journals, strange language quirks, and group rituals among the pupils. The player must decide how to interpret fragmentary diaries, coastal drawings, and unholy lullabies.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Children", "Mystery", "School"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Sunken Harbor Salvage",
        description: "A salvage diver explores Innsmouth Harbor and discovers objects from Dagon.",
        content: "Develop a Lovecraftian gamebook where a freelance salvage diver, hired under a government contract, explores the sunken edges of Innsmouth Harbor in 1932. Discovered objects match those found in Dagon's story, and diving logs contradict known depths. Each dive unveils deeper biological and historical horrors.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Diving", "Underwater", "Investigation"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Museum Artifact Acquisition",
        description: "A museum curator navigates suppression, study, or display of ritual items from Innsmouth.",
        content: "Build an interactive mystery gamebook centered on the reopened Miskatonic Museum, which just acquired ritual items recovered from Innsmouth. A curator may choose to suppress, study, or display these artifacts, but each course triggers escalating hauntings, relic reactivations, and connections to ancient sea gods.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Museum", "Artifacts", "Deep Ones"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Strange Births Investigation",
        description: "A journalist investigates anonymous tips about strange births in coastal towns.",
        content: "Generate a playable horror gamebook in which a freelance journalist receives anonymous tips about strange births and increased fish hauls in nearby coastal towns years after Innsmouth's fall. Investigative choices lead to silent cults, submerged shrines, and secret gatherings—all infused with echoes of The Shadow over Innsmouth.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Cults", "Investigation", "Mystery"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Devil Reef Signals",
        description: "A Coast Guard sentry documents strange nocturnal signals from Devil Reef.",
        content: "Design an interactive mystery where a Coast Guard sentry stationed near the ruins of Innsmouth begins documenting strange nocturnal signals from Devil Reef. As the player deciphers logbooks, smuggled parchments, and oceanic sound patterns, they begin to piece together a resurgence of worship beneath the waves.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Military", "Signals", "Investigation"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Escaped Resident Lineage",
        description: "A former Innsmouth resident returns to uncover family secrets and Deep One hybridity.",
        content: "Create a cosmic horror gamebook where a former resident of Innsmouth returns to uncover family secrets after changing their name and escaping during the 1928 raid. Their decisions trigger repressed memories, confessions from hidden relatives, and unfolding truths about their lineage—all grounded in canonical Deep One hybridity.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Family", "Deep Ones", "Mystery"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Miskatonic River Drownings",
        description: "A deputy coroner investigates mysterious drownings with inhuman traits.",
        content: "Write a Lovecraftian horror gamebook set in 1931, where a Massachusetts deputy coroner investigates mysterious drownings along the Miskatonic River, their victims showing inhuman traits. The trail leads back to exiled Innsmouth cultists living under assumed identities.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Deep Ones", "Investigation", "Medical"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Occult Text Recovery",
        description: "A Miskatonic professor recovers occult texts linked to the Esoteric Order of Dagon.",
        content: "Create a dark investigative gamebook focused on academic fallout after the Innsmouth raid. A Miskatonic professor is tasked with recovering occult texts linked to the Esoteric Order of Dagon. Player decisions involve deciphering coded annotations, interpreting alchemical diagrams, and confronting the idea that some rituals may have succeeded.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Occult", "Investigation", "Academic"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: Artist Colony Underwater Cities",
        description: "A skeptical painter discovers an artist colony founded by Innsmouth refugees.",
        content: "Generate a mystery-horror gamebook set in a 1930s artist colony in Maine, revealed to have been quietly founded by Innsmouth refugees. A skeptical painter arrives for inspiration but finds recurring imagery, haunting murals, and artistic trances linked to underwater cities.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "Art", "Mystery", "Deep Ones"],
        word_count: 2800
      },
      {
        title: "Innsmouth Aftermath Mysteries: FBI Agent Port Towns",
        description: "An ex-FBI agent haunted by the 1928 raid sees familiar faces in port towns.",
        content: "Craft a playable horror gamebook about an ex-FBI agent haunted by the 1928 raid on Innsmouth, who begins to see familiar faces in port towns across America. Is it guilt or resurgence? The player hunts clues in shipping logs, interrogation recordings, and weathered notebooks to determine if the threat has truly disappeared.",
        book_type: "fiction",
        genre: "Horror",
        category: "Innsmouth Aftermath Mysteries",
        tags: ["Innsmouth", "Horror", "FBI", "Investigation", "Mystery"],
        word_count: 2800
      }
    ];

    // Batch create prompts
    const results = [];
    for (let i = 0; i < prompts.length; i += 10) {
      const batch = prompts.slice(i, i + 10);
      try {
        const created = await base44.asServiceRole.entities.PromptCatalog.bulkCreate(batch);
        results.push(...created);
      } catch (err) {
        console.warn(`Batch ${i / 10 + 1} error:`, err.message);
      }
    }

    return Response.json({
      message: `Imported ${results.length} prompts successfully`,
      imported: results.length
    });
  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});