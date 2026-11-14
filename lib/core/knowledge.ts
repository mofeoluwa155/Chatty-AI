export type KnowledgeEntry = {
  title: string;
  aliases: string[];
  keywords: string[];
  explanation: string;
  example?: string;
};

const KNOWLEDGE: KnowledgeEntry[] = [
  {
    title: "Binary",
    aliases: ["binary number system", "base two"],
    keywords: ["binary", "base", "two", "digits", "zero", "one", "computer"],
    explanation: "Binary is a number system that uses only two digits: 0 and 1. Computers represent data using binary because electronic circuits can work with two states, commonly described as off and on.",
    example: "The binary number 101 represents 5 in denary: 4 + 0 + 1 = 5.",
  },
  {
    title: "Bit and byte",
    aliases: ["bits", "bytes", "data units"],
    keywords: ["bit", "byte", "eight", "data", "storage"],
    explanation: "A bit is one binary digit: either 0 or 1. A byte is a group of 8 bits. A byte can represent 256 different bit patterns because 2⁸ = 256.",
    example: "One byte: 01000001.",
  },
  {
    title: "Algorithm",
    aliases: ["algorithms"],
    keywords: ["algorithm", "steps", "problem", "solution", "sequence"],
    explanation: "An algorithm is a finite sequence of clear steps used to solve a problem or complete a task. A good algorithm has a defined start and finish and produces the intended result.",
    example: "To find the largest of two numbers: input both numbers, compare them, then output the larger number.",
  },
  {
    title: "Variable",
    aliases: ["variables"],
    keywords: ["variable", "programming", "value", "memory", "change"],
    explanation: "A variable is a named location used by a program to store a value. The value can change while the program runs.",
    example: "score = 10 stores the value 10 in a variable named score.",
  },
  {
    title: "Array",
    aliases: ["one dimensional array", "1d array", "arrays"],
    keywords: ["array", "elements", "index", "collection", "same", "type"],
    explanation: "An array is a data structure that stores several values under one name. Each value is an element, and its position is identified by an index. In many languages, array indexing begins at 0.",
    example: "marks = [72, 81, 65] stores three marks in one array.",
  },
  {
    title: "Selection",
    aliases: ["if statement", "if else"],
    keywords: ["selection", "condition", "if", "else", "decision", "programming"],
    explanation: "Selection is a programming construct that chooses which instruction or block of instructions to run based on a condition. Common forms include IF, IF-ELSE and nested IF statements.",
    example: "IF temperature > 20 THEN output 'Warm' ELSE output 'Cool'.",
  },
  {
    title: "Iteration",
    aliases: ["loops", "repetition", "while loop", "for loop"],
    keywords: ["iteration", "loop", "repeat", "while", "for", "condition"],
    explanation: "Iteration is a programming construct that repeats a set of instructions. A condition-controlled loop repeats while a condition is true; a count-controlled loop repeats a set number of times.",
    example: "A loop can add each number in an array to a running total.",
  },
  {
    title: "Photosynthesis",
    aliases: ["how plants make food"],
    keywords: ["photosynthesis", "plants", "light", "glucose", "carbon", "dioxide", "water", "oxygen"],
    explanation: "Photosynthesis is the process by which green plants use light energy to make glucose from carbon dioxide and water. Chlorophyll in the chloroplasts absorbs the light energy. Oxygen is released.",
    example: "Word equation: carbon dioxide + water → glucose + oxygen (using light energy).",
  },
  {
    title: "Alkanes",
    aliases: ["alkane", "saturated hydrocarbons"],
    keywords: ["alkane", "alkanes", "hydrocarbon", "saturated", "single", "bond", "carbon"],
    explanation: "Alkanes are saturated hydrocarbons. They contain only carbon and hydrogen atoms, with single covalent bonds between carbon atoms. The general formula for straight-chain alkanes is CₙH₂ₙ₊₂.",
    example: "Methane is CH₄ and ethane is C₂H₆.",
  },
  {
    title: "Alkenes",
    aliases: ["alkene", "unsaturated hydrocarbons"],
    keywords: ["alkene", "alkenes", "hydrocarbon", "unsaturated", "double", "bond", "carbon"],
    explanation: "Alkenes are unsaturated hydrocarbons because they contain at least one carbon–carbon double bond. The general formula for a straight-chain alkene with one double bond is CₙH₂ₙ.",
    example: "Ethene is C₂H₄. Alkenes decolourise orange bromine water.",
  },
  {
    title: "Intermolecular forces and boiling point",
    aliases: ["boiling points", "molecular size"],
    keywords: ["intermolecular", "forces", "boiling", "point", "molecules", "size", "energy"],
    explanation: "When molecules are larger, the intermolecular attractions between them are generally stronger. More energy is then needed to separate the molecules, so the boiling point generally increases.",
    example: "For a homologous series such as alkanes, boiling point generally increases as the carbon chain gets longer.",
  },
  {
    title: "The water cycle",
    aliases: ["hydrological cycle"],
    keywords: ["water", "cycle", "evaporation", "condensation", "precipitation"],
    explanation: "The water cycle describes the continuous movement of water. Water evaporates, water vapour cools and condenses into clouds, and water returns to the surface as precipitation. It can then collect in bodies of water or flow over and through the ground.",
  },
];

function words(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 1);
}

export function findKnowledge(query: string): KnowledgeEntry | null {
  const normalised = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const queryWords = new Set(words(normalised));
  let best: { entry: KnowledgeEntry; score: number } | null = null;

  for (const entry of KNOWLEDGE) {
    const title = entry.title.toLowerCase();
    const aliases = entry.aliases.map((alias) => alias.toLowerCase());
    let score = 0;

    if (normalised.includes(title)) score += 8;
    for (const alias of aliases) {
      if (normalised.includes(alias)) score += 7;
    }
    for (const keyword of entry.keywords) {
      if (queryWords.has(keyword)) score += keyword.length > 5 ? 1.5 : 1;
    }

    if (!best || score > best.score) best = { entry, score };
  }

  return best && best.score >= 3 ? best.entry : null;
}

export function listKnowledgeTopics(): string[] {
  return KNOWLEDGE.map((entry) => entry.title);
}
