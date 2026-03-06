import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const CATALOG = [
  // NONFICTION — History — Political & Military
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Assassination Attempts You've Never Heard Of", genre_tags: ["History", "True Crime", "Politics"], description: "Obscure assassination attempts and the political upheaval they caused or narrowly avoided." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Bizarre Elections and Political Campaigns", genre_tags: ["History", "Politics"], description: "Strange, comedic, and absurd elections and campaigns throughout history." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Colonial Projects That Failed Spectacularly", genre_tags: ["History", "Politics"], description: "Colonial ventures that collapsed in dramatic and often ironic fashion." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Famous Cities That Were Almost Never Built", genre_tags: ["History"], description: "The unlikely origins and near-misses behind iconic world cities." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Famous Historical Blunders", genre_tags: ["History"], description: "Catastrophic mistakes by powerful people that changed history." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Forgotten Revolutions That Changed Everything", genre_tags: ["History", "Politics"], description: "Revolutions overlooked by mainstream history that had massive lasting impact." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Historic Events Caused by Translation Errors", genre_tags: ["History"], description: "Wars, treaties, and crises triggered by mistranslations and misunderstandings." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Historical Events That Started as Mistakes", genre_tags: ["History"], description: "Accidents and blunders that accidentally ignited world-changing events." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "History's Most Absurd Wars", genre_tags: ["History"], description: "Conflicts started over ridiculous pretexts that escalated into real wars." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Propaganda Campaigns That Worked Too Well", genre_tags: ["History", "Politics"], description: "State propaganda efforts that backfired or exceeded expectations in dangerous ways." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Rebellions You've Never Heard Of", genre_tags: ["History"], description: "Forgotten uprisings and revolts that shook empires and societies." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Revolts That Started With a Joke", genre_tags: ["History"], description: "Revolutions and rebellions ignited by humor, satire, or accidental comedy." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Scandals That Reshaped Entire Nations", genre_tags: ["History", "Politics"], description: "Political and personal scandals that permanently altered nations' trajectories." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Unbelievable Diplomatic Blunders", genre_tags: ["History", "Politics"], description: "Diplomatic failures, insults, and miscommunications that broke international relations." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Underground Movements That Shaped Society", genre_tags: ["History", "Politics"], description: "Secret resistance and social movements that changed the world from the shadows." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Wartime Oddities", genre_tags: ["History"], description: "Strange, surreal, and unexpected events that occurred during wars." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "Wild Economic Experiments That Really Happened", genre_tags: ["History", "Business"], description: "Bizarre national economic schemes and experiments with unintended consequences." },
  { book_type: "nonfiction", category: "History", subcategory: "Political & Military", series_title: "World-Changing Events Caused by Weather", genre_tags: ["History", "Science"], description: "How storms, droughts, and climate shaped historical turning points." },

  // NONFICTION — History — Social & Cultural
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Banned Books and the People Who Wrote Them", genre_tags: ["History", "Education"], description: "Authors and their censored works that challenged power and changed minds." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Bizarre Beliefs That Were Once Mainstream", genre_tags: ["History", "Psychology"], description: "Scientific, medical, and social beliefs once accepted as fact." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Dark History of Fairy Tales", genre_tags: ["History"], description: "The violent and disturbing origins of beloved fairy tales and folklore." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Hidden Agendas in World Fairs and Expos", genre_tags: ["History"], description: "The political, colonial, and commercial agendas embedded in world exhibitions." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Hidden Stories Behind Everyday Objects", genre_tags: ["History"], description: "The surprising origins and strange histories of ordinary items." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Histories That Religions Tried to Erase", genre_tags: ["History", "Philosophy"], description: "Historical records, peoples, and events suppressed by religious institutions." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Mass Hysteria Events That Really Happened", genre_tags: ["History", "Psychology"], description: "Documented cases of collective delusion and mass psychogenic illness." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Obscure Origins of National Holidays", genre_tags: ["History"], description: "The strange and often forgotten stories behind how holidays came to be." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Real History Behind Fairy Tales", genre_tags: ["History"], description: "Historical events and figures that inspired classic fairy tale narratives." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Strange But True Royal Traditions", genre_tags: ["History"], description: "Bizarre ceremonies, customs, and laws from royal courts around the world." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "The Origins of Famous Myths", genre_tags: ["History", "Philosophy"], description: "Real-world roots of iconic myths, legends, and folk stories." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Unexpected Origins of Holidays", genre_tags: ["History"], description: "Counterintuitive and surprising sources of widely celebrated holidays." },
  { book_type: "nonfiction", category: "History", subcategory: "Social & Cultural", series_title: "Unexpected Origins of Popular Foods", genre_tags: ["History"], description: "How beloved foods came to exist through accident, theft, or war." },

  // NONFICTION — History — Biography & Personal
  { book_type: "nonfiction", category: "History", subcategory: "Biography & Personal", series_title: "Famous Historical Rivalries", genre_tags: ["History", "Biography"], description: "The great feuds and competitions between historical giants." },
  { book_type: "nonfiction", category: "History", subcategory: "Biography & Personal", series_title: "Famous Last Words", genre_tags: ["History", "Biography"], description: "The documented final statements of notable historical figures and what they reveal." },
  { book_type: "nonfiction", category: "History", subcategory: "Biography & Personal", series_title: "Forgotten Female Warriors", genre_tags: ["History", "Biography"], description: "Women soldiers, commanders, and fighters erased from mainstream history." },
  { book_type: "nonfiction", category: "History", subcategory: "Biography & Personal", series_title: "Historical Figures With Double Lives", genre_tags: ["History", "Biography"], description: "Famous people who concealed secret identities, careers, or beliefs." },
  { book_type: "nonfiction", category: "History", subcategory: "Biography & Personal", series_title: "Little-Known Civil Rights Heroes", genre_tags: ["History", "Biography"], description: "Unsung heroes of civil rights movements whose contributions were overlooked." },
  { book_type: "nonfiction", category: "History", subcategory: "Biography & Personal", series_title: "Misunderstood Historical Figures", genre_tags: ["History", "Biography"], description: "Historical people history has unfairly vilified or mischaracterized." },
  { book_type: "nonfiction", category: "History", subcategory: "Biography & Personal", series_title: "Remarkable Kid Geniuses", genre_tags: ["History", "Biography"], description: "Child prodigies who changed their fields and the worlds they lived in." },
  { book_type: "nonfiction", category: "History", subcategory: "Biography & Personal", series_title: "The Secret Lives of Influential Women", genre_tags: ["History", "Biography"], description: "Hidden stories, second identities, and concealed accomplishments of powerful women." },

  // NONFICTION — History — Science & Technology
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Ancient Civilizations", genre_tags: ["History", "Science"], description: "Surprising facts and overlooked achievements of ancient human societies." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Ancient Technologies That Still Baffle Scientists", genre_tags: ["History", "Science", "Technology"], description: "Engineering and science from antiquity that modern researchers struggle to explain." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Corrupt Corporations That Changed History", genre_tags: ["History", "Business"], description: "Companies whose unethical behavior inadvertently shaped the modern world." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Forgotten Inventions", genre_tags: ["History", "Technology"], description: "Technologies and inventions ahead of their time that were lost or suppressed." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Forgotten Scientific Rivalries", genre_tags: ["History", "Science"], description: "Bitter competitions between scientists whose feuds drove major discoveries." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Human Experiments Hidden in History", genre_tags: ["History", "Science", "True Crime"], description: "Covert and unethical experiments on humans that shaped medicine and policy." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Incredible Archaeological Finds", genre_tags: ["History", "Science"], description: "Astonishing discoveries that rewrote our understanding of ancient history." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Inventors Who Regretted Their Inventions", genre_tags: ["History", "Technology"], description: "Creators whose world-changing inventions brought them guilt and regret." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Lost Cities", genre_tags: ["History"], description: "Real lost and submerged cities recovered by archaeology and exploration." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Lost Civilizations and Their Untold Legacies", genre_tags: ["History", "Science"], description: "Collapsed civilizations whose influence still echoes through the modern world." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Medical Practices That Shocked the World", genre_tags: ["History", "Science"], description: "Gruesome, bizarre, or dangerous medical treatments once considered standard." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Mysterious Meteorite Impacts", genre_tags: ["History", "Science"], description: "Meteor and asteroid events that may have shaped civilizations and extinctions." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Science Gone Wrong", genre_tags: ["History", "Science"], description: "Scientific experiments and projects that went catastrophically off the rails." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Space Exploration Milestones", genre_tags: ["History", "Science", "Technology"], description: "Pivotal moments in humanity's journey beyond Earth." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Strange Medical Practices", genre_tags: ["History", "Science"], description: "Peculiar healing traditions and treatments from cultures around the world." },
  { book_type: "nonfiction", category: "History", subcategory: "Science & Technology", series_title: "Unexpected Inventions From Wartime", genre_tags: ["History", "Technology"], description: "Civilian technologies accidentally born from wartime research and necessity." },

  // NONFICTION — History — Crime & Law
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Creepy Historical Events", genre_tags: ["History", "True Crime"], description: "Unsettling and macabre events from history that defy easy explanation." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Cults and Charismatic Leaders in Real History", genre_tags: ["History", "Psychology", "True Crime"], description: "Real cults and the psychological tactics of their charismatic founders." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Daring Escapes That Sound Like Fiction", genre_tags: ["History", "True Crime"], description: "Real-life prison breaks, war escapes, and freedom runs that rival any thriller." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Famous Hoaxes", genre_tags: ["History", "True Crime"], description: "The greatest cons, forgeries, and deceptions that fooled the world." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Famous Trials That Changed Legal History", genre_tags: ["History", "True Crime"], description: "Landmark courtroom cases that established or overturned legal precedent." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Famous Trials in History", genre_tags: ["History", "True Crime"], description: "High-profile trials that captivated the public and revealed societal tensions." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "History's Greatest Escapes", genre_tags: ["History", "True Crime"], description: "Legendary escapes from impossible situations throughout history." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Outlaw Heroes and Their True Stories", genre_tags: ["History", "True Crime"], description: "Outlaws romanticized by myth and the more complex reality behind their legends." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Real Events Behind Famous Conspiracy Theories", genre_tags: ["History", "True Crime", "Politics"], description: "The documented facts that seeded popular conspiracy theories." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Secret Societies", genre_tags: ["History", "True Crime"], description: "Real secret organizations, their rituals, and their influence on world events." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Shocking Truths Hidden in Plain Sight", genre_tags: ["History"], description: "Historical facts that were always public but widely ignored or misunderstood." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Unsolved Historical Mysteries", genre_tags: ["History", "True Crime"], description: "Cold cases and unexplained events from history that remain unresolved." },
  { book_type: "nonfiction", category: "History", subcategory: "Crime & Law", series_title: "Unsolved Mysteries", genre_tags: ["History", "True Crime"], description: "Enduring mysteries across time that investigators and historians cannot crack." },

  // NONFICTION — History — Art, Music & Media
  { book_type: "nonfiction", category: "History", subcategory: "Art, Music & Media", series_title: "Hidden Messages in Art", genre_tags: ["History"], description: "Secret symbols, codes, and political messages embedded in famous artworks." },
  { book_type: "nonfiction", category: "History", subcategory: "Art, Music & Media", series_title: "Hidden Messages in Historical Art", genre_tags: ["History"], description: "Deliberate and accidental subversive imagery discovered in historical paintings." },
  { book_type: "nonfiction", category: "History", subcategory: "Art, Music & Media", series_title: "The History of Censorship", genre_tags: ["History", "Politics"], description: "How governments, religions, and institutions suppressed art and expression." },
  { book_type: "nonfiction", category: "History", subcategory: "Art, Music & Media", series_title: "The Real Stories Behind National Anthems", genre_tags: ["History"], description: "The surprising, dark, and complex origins of countries' official songs." },

  // NONFICTION — History — Archaeology & Artifacts
  { book_type: "nonfiction", category: "History", subcategory: "Archaeology & Artifacts", series_title: "Cursed Artifacts and Their Strange Journeys", genre_tags: ["History"], description: "Objects believed to carry curses and the disasters that followed them." },
  { book_type: "nonfiction", category: "History", subcategory: "Archaeology & Artifacts", series_title: "Famous Buildings With Dark Pasts", genre_tags: ["History"], description: "Iconic structures with hidden histories of tragedy, oppression, or scandal." },
  { book_type: "nonfiction", category: "History", subcategory: "Archaeology & Artifacts", series_title: "Forbidden Places on Earth", genre_tags: ["History"], description: "Restricted, dangerous, and off-limits locations around the globe." },
  { book_type: "nonfiction", category: "History", subcategory: "Archaeology & Artifacts", series_title: "History's Most Expensive Mistakes", genre_tags: ["History", "Business"], description: "Catastrophic financial blunders that bankrupted nations and institutions." },
  { book_type: "nonfiction", category: "History", subcategory: "Archaeology & Artifacts", series_title: "When Animals Changed the Course of History", genre_tags: ["History", "Science"], description: "Animals — horses, dogs, birds — whose actions altered historical events." },

  // NONFICTION — Reference & Educational
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Bizarre Animal Facts", genre_tags: ["Education", "Science"], description: "Astonishing, counterintuitive, and surprising facts about animals." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Cultural Taboos", genre_tags: ["Education", "Psychology"], description: "Practices forbidden across different cultures and the reasons behind them." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Extreme Weather Events", genre_tags: ["Education", "Science"], description: "The most violent, unusual, and record-breaking weather events ever recorded." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Facts About Historical Foods", genre_tags: ["Education", "History"], description: "What people ate throughout history and how food shaped civilizations." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Famous Landmarks", genre_tags: ["Education", "Travel"], description: "The stories, secrets, and surprising histories of the world's iconic landmarks." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Freaky Facts About the Human Body", genre_tags: ["Education", "Science", "Health"], description: "Weird, disgusting, and mind-bending facts about human anatomy and biology." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "History of Everyday Objects", genre_tags: ["Education", "History"], description: "How mundane objects we use daily were invented and evolved." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Odd Jobs That Once Existed", genre_tags: ["Education", "History"], description: "Strange and obsolete professions from history that no longer exist." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Origins of Common Sayings", genre_tags: ["Education"], description: "The real-world and often grim origins of everyday phrases and idioms." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Peculiar Traditions", genre_tags: ["Education"], description: "Unusual rituals and customs practiced by communities around the world." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Rare Natural Phenomena", genre_tags: ["Education", "Science"], description: "Breathtaking and scientifically fascinating natural events that rarely occur." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Secrets of the Deep Sea", genre_tags: ["Education", "Science"], description: "The most mysterious, alien, and unexplored regions of Earth's oceans." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Superstitions From Around the World", genre_tags: ["Education", "Psychology"], description: "Global superstitions and the cultural anxieties and histories behind them." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Unusual Sports Facts", genre_tags: ["Education"], description: "Strange rules, bizarre records, and forgotten sports from around the world." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "Weird Laws Around the World", genre_tags: ["Education"], description: "Real laws still on the books that are absurd, archaic, or inexplicable." },
  { book_type: "nonfiction", category: "Reference & Educational", subcategory: "General", series_title: "World Records That Still Stand", genre_tags: ["Education"], description: "Unbroken world records and the remarkable humans behind them." },

  // FICTION — Academic & Institutional Horror
  { book_type: "fiction", category: "Horror", subcategory: "Academic & Institutional Horror", series_title: "Arkham Academic Investigations", genre_tags: ["Horror"], description: "Investigators uncovering cosmic horrors within academic institutions in Lovecraftian Arkham." },
  { book_type: "fiction", category: "Horror", subcategory: "Academic & Institutional Horror", series_title: "Arkham Asylum Patient Records", genre_tags: ["Horror"], description: "Psychological horror narratives told through the records of asylum patients." },
  { book_type: "fiction", category: "Horror", subcategory: "Academic & Institutional Horror", series_title: "Disappearing Scholars of Miskatonic", genre_tags: ["Horror"], description: "Researchers vanishing after delving too deeply into forbidden knowledge." },
  { book_type: "fiction", category: "Horror", subcategory: "Academic & Institutional Horror", series_title: "Forbidden Necronomicon Translations", genre_tags: ["Horror"], description: "The horrific consequences of translating and reading from cursed texts." },
  { book_type: "fiction", category: "Horror", subcategory: "Academic & Institutional Horror", series_title: "Libraries That Should Not Exist", genre_tags: ["Horror"], description: "Impossible archives containing knowledge humanity was never meant to possess." },
  { book_type: "fiction", category: "Horror", subcategory: "Academic & Institutional Horror", series_title: "Mental Hospitals and Forbidden Knowledge", genre_tags: ["Horror"], description: "Psychiatric institutions concealing supernatural and eldritch truths." },
  { book_type: "fiction", category: "Horror", subcategory: "Academic & Institutional Horror", series_title: "Miskatonic University Restricted Archives", genre_tags: ["Horror"], description: "Secret collections of dangerous texts and artifacts at a cursed university." },
  { book_type: "fiction", category: "Horror", subcategory: "Academic & Institutional Horror", series_title: "Secret Societies at Universities", genre_tags: ["Horror", "Mystery"], description: "Campus secret societies with dark rituals and eldritch allegiances." },
  { book_type: "fiction", category: "Horror", subcategory: "Academic & Institutional Horror", series_title: "Vanishing Professors and Lecturers", genre_tags: ["Horror", "Mystery"], description: "Academics who disappear after making dangerous discoveries." },

  // FICTION — Maritime & Coastal Horror
  { book_type: "fiction", category: "Horror", subcategory: "Maritime & Coastal Horror", series_title: "Coastal Towns Under Deep One Influence", genre_tags: ["Horror"], description: "Seaside communities slowly corrupted by ancient aquatic entities." },
  { book_type: "fiction", category: "Horror", subcategory: "Maritime & Coastal Horror", series_title: "Cursed Maritime Trade Routes", genre_tags: ["Horror", "Adventure"], description: "Ocean trade lanes haunted by ancient curses and eldritch sea creatures." },
  { book_type: "fiction", category: "Horror", subcategory: "Maritime & Coastal Horror", series_title: "Fishermen Who Return Changed", genre_tags: ["Horror"], description: "Sailors returning from sea fundamentally altered by what they encountered." },
  { book_type: "fiction", category: "Horror", subcategory: "Maritime & Coastal Horror", series_title: "Haunted Whaling Ships", genre_tags: ["Horror", "Adventure"], description: "Whaling vessels beset by supernatural forces from the deep ocean." },
  { book_type: "fiction", category: "Horror", subcategory: "Maritime & Coastal Horror", series_title: "Lighthouses Connected to Eldritch Worship", genre_tags: ["Horror"], description: "Isolated lighthouse keepers serving as guardians for ancient oceanic cults." },
  { book_type: "fiction", category: "Horror", subcategory: "Maritime & Coastal Horror", series_title: "Strange Tides and Coastal Omens", genre_tags: ["Horror"], description: "Unusual tidal events and maritime signs that herald cosmic horror." },

  // FICTION — Rural & Folk Horror
  { book_type: "fiction", category: "Horror", subcategory: "Rural & Folk Horror", series_title: "Cult Infiltration of Local Churches", genre_tags: ["Horror"], description: "Eldritch cults that have taken root inside small-town religious congregations." },
  { book_type: "fiction", category: "Horror", subcategory: "Rural & Folk Horror", series_title: "Cult Rituals in New England Towns", genre_tags: ["Horror"], description: "Ancient ritual practices kept alive by isolated New England communities." },
  { book_type: "fiction", category: "Horror", subcategory: "Rural & Folk Horror", series_title: "Dunwich Rural Horror Cases", genre_tags: ["Horror"], description: "Investigators confronting cosmic corruption in remote rural New England." },
  { book_type: "fiction", category: "Horror", subcategory: "Rural & Folk Horror", series_title: "Remote Farmsteads and Cosmic Corruption", genre_tags: ["Horror"], description: "Isolated farms where the land itself has been touched by something ancient." },
  { book_type: "fiction", category: "Horror", subcategory: "Rural & Folk Horror", series_title: "Rural Folklore Hiding Cosmic Truths", genre_tags: ["Horror"], description: "Folk legends that turn out to be literal warnings about eldritch entities." },

  // FICTION — Estate & Gothic Horror
  { book_type: "fiction", category: "Horror", subcategory: "Estate & Gothic Horror", series_title: "Abandoned Mansions with Non-Euclidean Layouts", genre_tags: ["Horror"], description: "Gothic estates with impossible architecture that defies physical laws." },
  { book_type: "fiction", category: "Horror", subcategory: "Estate & Gothic Horror", series_title: "Family Bloodlines Tied to Ancient Pacts", genre_tags: ["Horror"], description: "Aristocratic families whose bloodlines are bound to eldritch entities by old bargains." },
  { book_type: "fiction", category: "Horror", subcategory: "Estate & Gothic Horror", series_title: "Inherited Estates with Unnatural Histories", genre_tags: ["Horror"], description: "New owners discovering the terrible secrets within inherited properties." },
  { book_type: "fiction", category: "Horror", subcategory: "Estate & Gothic Horror", series_title: "Unmarked Graves and Forgotten Burials", genre_tags: ["Horror"], description: "Mysterious graves on old estates and the entities tied to the interred." },

  // FICTION — Investigation & Mystery Horror
  { book_type: "fiction", category: "Horror", subcategory: "Investigation & Mystery Horror", series_title: "Archaeological Digs Awakening Ancient Forces", genre_tags: ["Horror", "Adventure"], description: "Excavation sites that disturb sleeping cosmic entities." },
  { book_type: "fiction", category: "Horror", subcategory: "Investigation & Mystery Horror", series_title: "Forbidden Artifacts in Private Collections", genre_tags: ["Horror", "Mystery"], description: "Collectors who acquire dangerous objects that bring ruin upon them." },
  { book_type: "fiction", category: "Horror", subcategory: "Investigation & Mystery Horror", series_title: "Innsmouth Aftermath Mysteries", genre_tags: ["Horror", "Mystery"], description: "Investigators picking through the fallout of the infamous Innsmouth raid." },
  { book_type: "fiction", category: "Horror", subcategory: "Investigation & Mystery Horror", series_title: "Lost Journals of Occult Researchers", genre_tags: ["Horror", "Mystery"], description: "Recovered journals revealing the final discoveries of doomed occultists." },
  { book_type: "fiction", category: "Horror", subcategory: "Investigation & Mystery Horror", series_title: "Occult Societies in Boston", genre_tags: ["Horror", "Mystery"], description: "Secret occult organizations operating in 1920s Boston's high society." },
  { book_type: "fiction", category: "Horror", subcategory: "Investigation & Mystery Horror", series_title: "Ritual Murders Without Bodies", genre_tags: ["Horror", "Mystery"], description: "Murder investigations where the victims have been completely consumed or taken." },

  // FICTION — Supernatural & Psychological Horror
  { book_type: "fiction", category: "Horror", subcategory: "Supernatural & Psychological Horror", series_title: "Strange Dreams Affecting Multiple Witnesses", genre_tags: ["Horror"], description: "Shared nightmares and visions connecting people to a cosmic entity." },
  { book_type: "fiction", category: "Horror", subcategory: "Supernatural & Psychological Horror", series_title: "Town Records That Rewrite Themselves", genre_tags: ["Horror"], description: "Historical documents that alter themselves, erasing dangerous truths." },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Clear existing catalog
    const existing = await base44.asServiceRole.entities.PromptCatalog.list();
    await Promise.all(existing.map(e => base44.asServiceRole.entities.PromptCatalog.delete(e.id)));

    // Insert all entries
    const created = await base44.asServiceRole.entities.PromptCatalog.bulkCreate(CATALOG);

    return Response.json({ success: true, count: created.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});