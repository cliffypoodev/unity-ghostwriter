Deno.serve(async (req) => {
  try {
    const subgenres = {
      fiction: {
        "Fantasy": ["Epic Fantasy", "Urban Fantasy", "Dark Fantasy", "Sword & Sorcery", "Mythic Fantasy", "Gaslamp Fantasy", "Portal Fantasy", "Progression Fantasy"],
        "Science Fiction": ["Space Opera", "Cyberpunk", "Hard Sci-Fi", "Military Sci-Fi", "Post-Apocalyptic", "Dystopian", "Time Travel", "Biopunk", "Climate Fiction"],
        "Romance": ["Contemporary Romance", "Historical Romance", "Paranormal Romance", "Romantic Suspense", "Steamy Romance", "Mafia Romance", "Billionaire Romance", "Sports Romance", "Reverse Harem", "Slow Burn"],
        "Mystery": ["Cozy Mystery", "Hardboiled Detective", "Police Procedural", "Amateur Sleuth", "Locked Room", "Noir", "Legal Thriller"],
        "Thriller": ["Psychological Thriller", "Political Thriller", "Techno-Thriller", "Medical Thriller", "Spy Thriller", "Domestic Thriller", "Conspiracy Thriller"],
        "Horror": ["Cosmic Horror", "Gothic Horror", "Supernatural Horror", "Psychological Horror", "Body Horror", "Folk Horror", "Slasher"],
        "Literary Fiction": ["Contemporary Literary", "Magical Realism", "Experimental", "Autobiographical Fiction", "Satire"],
        "Historical Fiction": ["Medieval", "Victorian", "World War II", "Ancient Civilizations", "Colonial Era", "Renaissance"],
        "Erotica": ["Contemporary Erotica", "BDSM", "Paranormal Erotica", "Historical Erotica", "Romantic Erotica", "Dark Erotica", "LGBTQ+ Erotica"]
      },
      nonfiction: {
        "History": ["Military History", "Social History", "Ancient History", "Modern History", "Biography"],
        "Self-Help": ["Personal Development", "Relationships", "Career", "Mindfulness", "Financial"],
        "Business": ["Entrepreneurship", "Leadership", "Marketing", "Strategy", "Productivity"],
        "Science": ["Popular Science", "Nature", "Technology", "Psychology", "Medicine"],
        "Memoir": ["Personal Memoir", "Travel Memoir", "Celebrity Memoir", "War Memoir"]
      }
    };

    return Response.json(subgenres);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});