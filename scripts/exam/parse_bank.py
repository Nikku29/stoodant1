"""Turns the question bank .docx into JSON: python3 -I parse_bank.py bank.docx out.json
Each question: id, class, subject, level (easy/medium/hard), text, options[4], answer (0-3)."""
import json, re, sys
import docx

SUBJECTS = {"MATHEMATICS": "maths", "SCIENCE": "science", "REASONING": "reasoning", "ENGLISH": "english"}
LEVELS = {"Easy": "easy", "Medium": "medium", "Hard": "hard"}

def clean(text: str) -> str:
    text = text.replace(" ", " ")
    # Template artefacts such as 1.3333333333333333π: written as fractions.
    text = re.sub(r"1\.3333333333333333", "(4/3)", text)
    text = re.sub(r"0\.3333333333333333", "(1/3)", text)
    text = re.sub(r"0\.6666666666666666", "(2/3)", text)
    text = re.sub(r"(\d+\.\d{4,})", lambda m: f"{float(m.group(1)):g}", text)
    return re.sub(r"\s+", " ", text).strip()

def options(line: str):
    parts = re.split(r"\(([A-D])\)\s*", line)
    found = {parts[i]: clean(parts[i + 1]) for i in range(1, len(parts) - 1, 2)}
    return [found.get(k, "") for k in "ABCD"]

def main(src, out):
    paras = [p.text for p in docx.Document(src).paragraphs if p.text.strip()]
    questions, cls, subject, level, pending, i = [], None, None, None, {}, 0
    while i < len(paras):
        p = paras[i].strip()
        m = re.match(r"CLASS (\d+) — (\w+)", p)
        if m:
            cls, subject = m.group(1), SUBJECTS[m.group(2)]
        elif re.match(r"^(Easy|Medium|Hard) — \d+ questions", p):
            level = LEVELS[p.split()[0]]
            pending = {}
        elif re.match(r"^(Easy|Medium|Hard) Answer Key", p):
            pass
        elif re.match(r"^\d+-[A-D]", p):
            for n, a in re.findall(r"(\d+)-([A-D])", p):
                q = pending.get(int(n))
                if q is not None: q["answer"] = "ABCD".index(a)
        elif cls and level and re.match(r"^\d+\. ", p):
            n = int(p.split(".", 1)[0])
            text = clean(p.split(".", 1)[1])
            opts = options(paras[i + 1]) if i + 1 < len(paras) and paras[i + 1].lstrip().startswith("(A)") else ["", "", "", ""]
            if opts[0]: i += 1
            q = {"id": f"c{cls}-{subject}-{level}-{n:02d}", "class": cls, "subject": subject, "level": level, "text": text, "options": opts, "answer": None}
            pending[n] = q
            questions.append(q)
        i += 1
    json.dump(questions, open(out, "w"), ensure_ascii=False, indent=1)
    print(len(questions), "questions")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
