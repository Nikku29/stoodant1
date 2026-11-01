// The practice paper on /exam?practice=9 or 10: same screens and rules as the real test, 12 questions, 15 minutes.
// These questions are written only for practice and are NOT in the exam question bank, so practising never shows a real
// exam question. When adding a question here, make sure it isn't in the bank file (and don't add these to the bank).
// Loaded only when a family opens the practice paper.

export type PracticeQuestion = { subject: "maths" | "science" | "reasoning" | "english"; text: string; options: string[]; answer: number };

export const PRACTICE_MINUTES = 15;

export const PRACTICE: Record<"9" | "10", PracticeQuestion[]> = {
  "9": [
    { subject: "maths", text: "If a + b = 7 and ab = 10, then a^2 + b^2 equals:", options: ["19", "29", "39", "69"], answer: 1 },
    { subject: "maths", text: "The interior angles of a polygon add up to 1260°. How many sides does it have?", options: ["7", "8", "9", "10"], answer: 2 },
    { subject: "maths", text: "A number leaves remainder 4 when divided by 6. What remainder does its square leave when divided by 6?", options: ["0", "1", "2", "4"], answer: 3 },
    { subject: "science", text: "A car starts from rest and speeds up uniformly to 20 m/s in 5 s. How far does it travel in these 5 s?", options: ["25 m", "40 m", "50 m", "100 m"], answer: 2 },
    { subject: "science", text: "Which of these contains the largest number of atoms?", options: ["1 g of hydrogen gas (H₂)", "16 g of oxygen gas (O₂)", "14 g of nitrogen gas (N₂)", "18 g of water (H₂O)"], answer: 3 },
    { subject: "science", text: "Which of these is NOT found in a prokaryotic cell such as a bacterium?", options: ["Ribosomes", "Cell membrane", "Membrane-bound organelles such as mitochondria", "Genetic material in a nucleoid"], answer: 2 },
    { subject: "reasoning", text: "Find the next number: 3, 8, 15, 24, 35, ?", options: ["46", "48", "49", "50"], answer: 1 },
    { subject: "reasoning", text: "In a code, CAT is written as XZG. How is DOG written in that code?", options: ["WLT", "WMT", "XLT", "WLS"], answer: 0 },
    { subject: "reasoning", text: "What is the smaller angle between the hour and minute hands of a clock at 3:40?", options: ["120°", "130°", "140°", "150°"], answer: 1 },
    { subject: "english", text: "Which word is spelt correctly?", options: ["Occurence", "Ocurrence", "Occurrence", "Occurrance"], answer: 2 },
    { subject: "english", text: "Choose the word closest in meaning to TENACIOUS.", options: ["Weak", "Persistent", "Careless", "Tender"], answer: 1 },
    { subject: "english", text: "The idiom 'to get cold feet' means:", options: ["To catch a cold", "To become nervous and back out", "To walk barefoot", "To stay very calm"], answer: 1 },
  ],
  "10": [
    { subject: "maths", text: "One zero of the polynomial x^2 − 7x + k is 3. What is k?", options: ["4", "10", "12", "21"], answer: 2 },
    { subject: "maths", text: "What is the 10th term of the AP 2, 7, 12, 17, …?", options: ["45", "47", "50", "52"], answer: 1 },
    { subject: "maths", text: "If sin θ = 3/5 and θ is acute, then tan θ + sec θ equals:", options: ["1", "8/5", "7/4", "2"], answer: 3 },
    { subject: "science", text: "A convex lens of focal length 20 cm forms a real image of the same size as the object. How far is the object from the lens?", options: ["10 cm", "20 cm", "40 cm", "60 cm"], answer: 2 },
    { subject: "science", text: "What is the SI unit of resistivity?", options: ["Ω", "Ω/m", "Ω m", "Ω m^2"], answer: 2 },
    { subject: "science", text: "Zinc is added to blue copper sulphate solution and the blue colour slowly fades. What type of reaction is this?", options: ["Combination", "Decomposition", "Displacement", "Double displacement"], answer: 2 },
    { subject: "reasoning", text: "A is the brother of B. B is the daughter of C. D is the father of A. How is C related to D?", options: ["Sister", "Wife", "Mother", "Daughter"], answer: 1 },
    { subject: "reasoning", text: "Which number is the odd one out?", options: ["64", "125", "144", "216"], answer: 2 },
    { subject: "reasoning", text: "Ravi walks 10 m north, turns right and walks 6 m, then turns right again and walks 18 m. How far is he from the start, and in which direction?", options: ["10 m south-east", "10 m north-east", "14 m south-east", "8 m south"], answer: 0 },
    { subject: "english", text: "Choose the passive form of: The committee will announce the results tomorrow.", options: ["The results will be announced by the committee tomorrow.", "The results would be announced by the committee tomorrow.", "The results will announce the committee tomorrow.", "The committee will be announced the results tomorrow."], answer: 0 },
    { subject: "english", text: "Choose the word opposite in meaning to VIVID.", options: ["Bright", "Dull", "Clear", "Sharp"], answer: 1 },
    { subject: "english", text: "Which part of this sentence has an error? He is / one of the / best player / in the school.", options: ["He is", "one of the", "best player", "in the school"], answer: 2 },
  ],
};
