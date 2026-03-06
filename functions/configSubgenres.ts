Deno.serve(async (req) => {
  try {
    const subgenres = {
      fiction: {
        "Literary Fiction": ["Contemporary", "Postmodern", "Experimental", "Southern Gothic", "Domestic", "Satirical", "Transgressive"],
        "Science Fiction": ["Hard Sci-Fi", "Space Opera", "Cyberpunk", "Post-Apocalyptic", "First Contact", "Time Travel", "Military Sci-Fi", "Biopunk", "Solarpunk"],
        "Fantasy": ["High Fantasy", "Urban Fantasy", "Dark Fantasy", "Grimdark", "Sword & Sorcery", "Mythic Fantasy", "Portal Fantasy", "Romantasy", "Cozy Fantasy"],
        "Mystery/Thriller": ["Cozy Mystery", "Hardboiled", "Police Procedural", "Legal Thriller", "Psychological Thriller", "Spy Thriller", "Noir", "Whodunit", "Domestic Thriller"],
        "Romance": ["Contemporary", "Historical", "Paranormal", "Romantic Suspense", "Enemies-to-Lovers", "Slow Burn", "Rom-Com", "Dark Romance"],
        "Horror": ["Psychological", "Cosmic", "Gothic", "Slasher", "Body Horror", "Folk Horror", "Supernatural", "Quiet Horror"],
        "Historical Fiction": ["Medieval", "Regency", "Victorian", "WWII", "Ancient World", "Renaissance", "American West", "1920s Jazz Age"],
        "Adventure": ["Survival", "Treasure Hunt", "Expedition", "Swashbuckler", "Sea Adventure", "Heist"],
        "Dystopian": ["Authoritarian", "Corporate", "Climate Fiction", "Tech Dystopia", "Post-Collapse"],
        "Magical Realism": ["Latin American", "Contemporary", "Cultural", "Surrealist", "Fabulist"],
        "Young Adult": ["Coming-of-Age", "YA Fantasy", "YA Sci-Fi", "YA Romance", "YA Thriller", "YA Contemporary"],
        "Children's": ["Middle Grade", "Chapter Books", "Picture Book Text", "Early Reader"]
      },
      nonfiction: {
        "Self-Help": ["Personal Development", "Productivity", "Mindfulness", "Relationships", "Financial Freedom", "Habits"],
        "Business": ["Entrepreneurship", "Leadership", "Marketing", "Startup", "Corporate Strategy", "Innovation"],
        "Biography/Memoir": ["Autobiography", "Celebrity", "Political", "Literary", "Coming-of-Age", "Travel Memoir"],
        "History": ["Military", "Social", "Cultural", "Ancient", "Modern", "Microhistory"],
        "Science": ["Physics", "Biology", "Astronomy", "Chemistry", "Ecology"],
        "Technology": ["AI", "Cybersecurity", "Blockchain", "Programming", "Data Science"],
        "Philosophy": ["Epistemology", "Ethics", "Metaphysics", "Logic", "Aesthetics"],
        "Psychology": ["Cognitive", "Behavioral", "Developmental", "Clinical", "Social"],
        "Health": ["Mental Health", "Nutrition", "Fitness", "Medical", "Wellness"],
        "Travel": ["Adventure Travel", "Cultural", "Food Travel", "Solo Travel", "Travel Guide"],
        "True Crime": ["Murder Cases", "Serial Killers", "Cold Cases", "Forensics", "Criminal Psychology"],
        "Education": ["Teaching Methods", "Learning Science", "Curriculum", "Higher Ed", "Lifelong Learning"]
      }
    };

    return Response.json(subgenres);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});