Deno.serve(async (req) => {
  try {
    const authors = [
      {
        id: "basic",
        name: "Basic (No specific voice)",
        description: "Clean, competent prose without mimicking any particular author's style."
      },
      {
        id: "hemingway",
        name: "Ernest Hemingway",
        description: "Terse, declarative sentences. Iceberg theory."
      },
      {
        id: "king",
        name: "Stephen King",
        description: "Conversational, immersive. Rich inner monologue, building dread."
      },
      {
        id: "austen",
        name: "Jane Austen",
        description: "Witty, ironic social commentary."
      },
      {
        id: "tolkien",
        name: "J.R.R. Tolkien",
        description: "Mythic, elevated prose. Rich world-building."
      },
      {
        id: "morrison",
        name: "Toni Morrison",
        description: "Lyrical, poetic. Vivid sensory detail."
      },
      {
        id: "rowling",
        name: "J.K. Rowling",
        description: "Accessible, whimsical. Clever wordplay."
      },
      {
        id: "mccarthy",
        name: "Cormac McCarthy",
        description: "Sparse, biblical. No quotation marks."
      },
      {
        id: "atwood",
        name: "Margaret Atwood",
        description: "Sharp, sardonic. Precise word choices."
      },
      {
        id: "gaiman",
        name: "Neil Gaiman",
        description: "Mythic yet modern. Fairy-tale cadence."
      },
      {
        id: "pratchett",
        name: "Terry Pratchett",
        description: "Satirical. Comedic fantasy, warm humanity."
      },
      {
        id: "le_guin",
        name: "Ursula K. Le Guin",
        description: "Sparse elegance, philosophical depth."
      },
      {
        id: "vonnegut",
        name: "Kurt Vonnegut",
        description: "Dark humor, short sentences. Absurdist."
      },
      {
        id: "garcia_marquez",
        name: "Gabriel Garcia Marquez",
        description: "Lush magical realism. Sprawling sentences."
      },
      {
        id: "chandler",
        name: "Raymond Chandler",
        description: "Hardboiled noir. First-person cynicism."
      },
      {
        id: "christie",
        name: "Agatha Christie",
        description: "Puzzle-box plotting. Clean readable prose."
      },
      {
        id: "gladwell",
        name: "Malcolm Gladwell",
        description: "Nonfiction storytelling. Counterintuitive hooks."
      },
      {
        id: "bryson",
        name: "Bill Bryson",
        description: "Humorous nonfiction. Self-deprecating wit."
      },
      {
        id: "sagan",
        name: "Carl Sagan",
        description: "Awe-inspiring science writing. Poetic wonder."
      },
      {
        id: "didion",
        name: "Joan Didion",
        description: "Cool, precise observation."
      },
      {
        id: "wilshire",
        name: "Logan Wilshire",
        description: "Contemporary literary voice with sharp character insight."
      },
      {
        id: "carpenter",
        name: "Sarah J. Carpenter",
        description: "Engaging narrative style with emotional depth."
      },
      {
        id: "cheskey",
        name: "Arina Cheskey",
        description: "Vivid descriptive prose with authentic dialogue."
      }
      ];

      return Response.json(authors);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});