// Single source of truth for catalog category groupings
// Used by the browser modal to filter sidebar + tag cloud + results

export const CATALOG_TAXONOMY = {
  fiction: {
    label: 'Fiction',
    categories: [
      'Thriller', 'Romance', 'Fantasy', 'Epic Fantasy', 'Dark Fantasy', 'Urban Fantasy',
      'Horror', 'Cosmic Horror', 'Science Fiction', 'Space Opera', 'Literary Fiction',
      'Mystery', 'Cozy Mystery', 'Crime', 'Noir', 'Erotica', 'Coming-of-Age',
      'Supernatural', 'Paranormal', 'Historical Fiction', 'Dystopian', 'Adventure',
      'Psychological', 'Romantic Comedy', 'Magical Realism', 'Interactive',
      'Gamebook', 'Lovecraftian Gamebooks', 'Gamebooks', 'Lovecraftian',
    ],
  },
  nonfiction: {
    label: 'Nonfiction',
    categories: [
      'True Crime', 'History', 'Political History', 'Historical Figures', 'Historical Events',
      'Legal History', 'Military History', 'Cultural History', 'Biography', 'Memoir',
      'Self-Help', 'Business', 'Investigative', 'Propaganda', 'Censorship',
      'Rogue Diplomacy', 'Diplomacy', 'Colonialism', 'Politics', 'Science',
      'Philosophy', 'Social Commentary', 'Travel', 'Educational', 'Reference',
      'Cemeteries', 'War', 'Investigation', 'nonfiction', 'culture', 'science',
    ],
  },
  shared: ['Forbidden Knowledge', 'Uncategorized'],
};

// Given a category name, determine which book type it belongs to
export function getCategoryType(categoryName) {
  if (!categoryName) return 'shared';
  const name = categoryName.toLowerCase().trim();
  if (CATALOG_TAXONOMY.fiction.categories.some(c => c.toLowerCase() === name)) return 'fiction';
  if (CATALOG_TAXONOMY.nonfiction.categories.some(c => c.toLowerCase() === name)) return 'nonfiction';
  return 'shared';
}

// Filter category objects to only those matching bookType
export function filterCategoriesByType(allCategories, bookType) {
  if (!bookType || bookType === 'all') return allCategories;
  return allCategories.filter(cat => {
    const t = getCategoryType(cat.name);
    return t === bookType || t === 'shared';
  });
}

// Filter tag objects to only those appearing on prompts of the correct type
export function filterTagsByType(allTags, bookType, prompts) {
  if (!bookType || bookType === 'all') return allTags;
  const relevantPrompts = prompts.filter(p => {
    if (p.book_type === bookType) return true;
    const catType = getCategoryType(p.category);
    return catType === bookType || catType === 'shared';
  });
  const relevantTagSet = new Set();
  relevantPrompts.forEach(p => {
    if (Array.isArray(p.tags)) p.tags.forEach(t => relevantTagSet.add(t.toLowerCase()));
  });
  return allTags.filter(({ tag }) => relevantTagSet.has(tag.toLowerCase()));
}