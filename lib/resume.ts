interface ResumeParseOptions {
  graduationYear?: number | null;
  major?: string | null;
}

export interface StructuredResumeEvidence {
  source_section: string;
  evidence: string;
  metrics: string[];
  technical_skills: string[];
  implied_soft_skills: string[];
}

export interface StructuredResumeSkillSignal {
  skill: string;
  evidence: string;
}

export interface StructuredResume {
  quantified_achievements: StructuredResumeEvidence[];
  relevant_experience: StructuredResumeEvidence[];
  education_details: string[];
  extracurricular_activities: string[];
  soft_skills: StructuredResumeSkillSignal[];
  positioning_signals: string[];
  technical_skills: {
    explicit: string[];
    implied: string[];
  };
}

interface ResumeSection {
  name: string;
  lines: string[];
}

interface PdfTextItem {
  str: string;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
}

const technologyPatterns = [
  { label: "Python", pattern: /\bpython\b/i },
  { label: "Java", pattern: /\bjava\b/i },
  { label: "JavaScript", pattern: /\bjavascript\b/i },
  { label: "TypeScript", pattern: /\btypescript\b/i },
  { label: "SQL", pattern: /\bsql\b/i },
  { label: "Excel", pattern: /\bexcel\b/i },
  { label: "JSON", pattern: /\bjson\b/i },
  { label: "Power BI", pattern: /\bpower\s*bi\b/i },
  { label: "Tableau", pattern: /\btableau\b/i },
  { label: "Alteryx", pattern: /\balteryx\b/i },
  { label: "MATLAB", pattern: /\bmatlab\b/i },
  { label: "R", pattern: /(?:^|[\s(,])r(?:$|[\s),])/i },
  { label: "C++", pattern: /\bc\+\+\b/i },
  { label: "C", pattern: /(?:^|[\s(,])c(?:$|[\s),])/i },
  { label: "React", pattern: /\breact\b/i },
  { label: "Next.js", pattern: /\bnext\.?js\b/i },
  { label: "Node.js", pattern: /\bnode\.?js\b/i },
  { label: "HTML", pattern: /\bhtml\b/i },
  { label: "CSS", pattern: /\bcss\b/i },
  { label: "Git", pattern: /\bgit\b/i },
  { label: "AWS", pattern: /\baws\b/i },
  { label: "Azure", pattern: /\bazure\b/i },
  { label: "GCP", pattern: /\bgcp\b|\bgoogle cloud\b/i },
  { label: "Salesforce", pattern: /\bsalesforce\b/i },
  { label: "Figma", pattern: /\bfigma\b/i },
  { label: "Machine Learning", pattern: /\bmachine learning\b|\bml\b/i },
  { label: "AI", pattern: /\bartificial intelligence\b|\bai\b/i },
  { label: "Automation", pattern: /\bautomation\b|\bautomated\b/i },
  { label: "Data Analysis", pattern: /\bdata analysis\b|\banalytics\b/i },
  { label: "CRM", pattern: /\bcrm\b/i },
  { label: "SAP", pattern: /\bsap\b/i },
  { label: "PowerPoint", pattern: /\bpowerpoint\b/i },
  { label: "Word", pattern: /\bword\b/i },
];

const softSkillRules = [
  {
    pattern:
      /\bspecial needs\b|\bpatients?\b|\bchildren\b|\bkids\b|\bcaregiver\b|\bvolunteer\b/i,
    skills: ["Empathy", "Patience", "Adaptability"],
  },
  {
    pattern:
      /\bfounded\b|\bco-founded\b|\bstarted\b|\blaunched\b|\bran\b.+\bbusiness\b|\bowner\b/i,
    skills: ["Entrepreneurial drive", "Initiative", "Self-management"],
  },
  {
    pattern:
      /\bled\b|\bpresident\b|\bcaptain\b|\bchair\b|\bdirected\b|\bmanaged\b|\bhead of\b/i,
    skills: ["Leadership", "Ownership", "Decision-making"],
  },
  {
    pattern:
      /\bcollaborated\b|\bcross-functional\b|\bworked with\b|\bpartnered\b|\bclient\b|\bcustomer\b/i,
    skills: ["Communication", "Teamwork", "Stakeholder management"],
  },
  {
    pattern:
      /\btaught\b|\btutor(?:ed|ing)?\b|\bmentor(?:ed|ing)?\b|\btrain(?:ed|ing)?\b|\binstruct(?:ed|ing)?\b/i,
    skills: ["Communication", "Coaching", "Patience"],
  },
  {
    pattern:
      /\banaly(?:zed|sis)\b|\bresearch(?:ed)?\b|\bmodeled\b|\bforecast(?:ed|ing)?\b|\bdashboard\b/i,
    skills: ["Analytical thinking", "Problem solving", "Curiosity"],
  },
  {
    pattern:
      /\bdeadline\b|\bwhile taking\b|\bfull course load\b|\bmultiple projects\b|\bsimultaneously\b/i,
    skills: ["Time management", "Prioritization", "Resilience"],
  },
  {
    pattern:
      /\bpitch(?:ed|ing)?\b|\bpresent(?:ed|ing)?\b|\bsales\b|\boutreach\b|\bmarket(?:ed|ing)?\b/i,
    skills: ["Persuasion", "Presentation", "Relationship-building"],
  },
];

const sectionMatchers = [
  { name: "education", pattern: /^education$/i },
  { name: "experience", pattern: /^(experience|work experience|professional experience|employment|internship experience)$/i },
  { name: "projects", pattern: /^(projects|project experience|academic projects)$/i },
  { name: "leadership", pattern: /^(leadership|activities|campus involvement|extracurriculars?)$/i },
  { name: "research", pattern: /^(research|research experience)$/i },
  { name: "service", pattern: /^(volunteer|service|community service)$/i },
  { name: "skills", pattern: /^(skills|technical skills|tools|languages|certifications?)$/i },
];

const actionVerbPattern =
  /\b(built|created|developed|designed|launched|led|managed|analyzed|researched|implemented|optimized|automated|improved|increased|reduced|grew|generated|presented|pitched|won|taught|mentored)\b/i;

const outcomePattern =
  /\b(increased|reduced|improved|saved|grew|generated|boosted|streamlined|accelerated|won|expanded|cut)\b/i;

const metricPatterns = [
  /\$[\d,.]+(?:\s?(?:k|m|b|million|billion|thousand))?/gi,
  /\b\d+(?:\.\d+)?\s*%/g,
  /\b\d+(?:\.\d+)?x\b/gi,
  /\b\d+(?:,\d{3})*(?:\+)?\s+(?:users?|customers?|clients?|students?|children|employees?|team members?|hours?|days?|weeks?|months?|years?|projects?|campaigns?|events?|models?|reports?|dashboards?|applications?|interviews?|followers?|subscribers?|views?|downloads?|leads?|sales?|orders?)\b/gi,
];

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function normalizeResumeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[•▪◦·●]/g, "•")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isContactLine(line: string) {
  return (
    /@/.test(line) ||
    /\b(?:linkedin|github)\b/i.test(line) ||
    /\bhttps?:\/\/\S+/i.test(line) ||
    /\bwww\.\S+/i.test(line) ||
    /(?:\+?1[\s.-]*)?(?:\(\d{3}\)|\d{3})[\s.-]*\d{3}[\s.-]*\d{4}/.test(line)
  );
}

function isLikelyNameLine(line: string) {
  const normalized = line.trim();

  if (!normalized || normalized.length > 60) {
    return false;
  }

  if (/[|@0-9]/.test(normalized)) {
    return false;
  }

  if (detectSectionHeading(normalized)) {
    return false;
  }

  if (/\b(?:university|college|school|institute)\b/i.test(normalized)) {
    return false;
  }

  return /^[A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’. -]+){1,3}$/.test(normalized);
}

function isLikelyHeaderLocationLine(line: string) {
  const normalized = line.trim();

  if (!normalized || normalized.length > 80) {
    return false;
  }

  if (/[|@]/.test(normalized)) {
    return false;
  }

  return /^[A-Za-z.' -]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/.test(normalized);
}

function stripPersonalHeaderLines(lines: string[]) {
  const sanitized: string[] = [];

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const inHeaderWindow = index < 8;

    if (isContactLine(trimmed)) {
      continue;
    }

    if (inHeaderWindow && isLikelyNameLine(trimmed)) {
      continue;
    }

    if (inHeaderWindow && isLikelyHeaderLocationLine(trimmed)) {
      continue;
    }

    sanitized.push(trimmed);
  }

  return sanitized;
}

function normalizeHeadingValue(line: string) {
  return line
    .replace(/[^a-zA-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function detectSectionHeading(line: string) {
  if (line.length > 40) {
    return null;
  }

  const normalized = normalizeHeadingValue(line);

  if (!normalized) {
    return null;
  }

  for (const matcher of sectionMatchers) {
    if (matcher.pattern.test(normalized)) {
      return matcher.name;
    }
  }

  return null;
}

function formatSectionLabel(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function splitIntoSections(lines: string[]) {
  const sections: ResumeSection[] = [];
  let currentSection: ResumeSection = { name: "general", lines: [] };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const heading = detectSectionHeading(line);

    if (heading) {
      if (currentSection.lines.length) {
        sections.push(currentSection);
      }

      currentSection = { name: heading, lines: [] };
      continue;
    }

    currentSection.lines.push(line);
  }

  if (currentSection.lines.length) {
    sections.push(currentSection);
  }

  return sections;
}

function extractTechnologyMatches(text: string) {
  return technologyPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label);
}

function extractMetricPhrases(text: string) {
  const matches = metricPatterns.flatMap((pattern) => text.match(pattern) ?? []);
  return unique(matches.map((match) => match.trim())).slice(0, 5);
}

function inferSoftSkills(text: string) {
  return unique(
    softSkillRules.flatMap((rule) => (rule.pattern.test(text) ? rule.skills : [])),
  );
}

function buildEvidenceChunks(sectionName: string, lines: string[]) {
  const chunks: StructuredResumeEvidence[] = [];

  for (const line of lines) {
    const normalizedLine = line.replace(/^[•*-]\s*/, "").trim();

    if (!normalizedLine) {
      continue;
    }

    const fragments =
      normalizedLine.length > 220
        ? normalizedLine
            .split(/[.;](?=\s+[A-Z0-9])/)
            .map((fragment) => fragment.trim())
            .filter(Boolean)
        : [normalizedLine];

    for (const fragment of fragments) {
      const metrics = extractMetricPhrases(fragment);
      const technicalSkills = extractTechnologyMatches(fragment);
      const impliedSoftSkills = inferSoftSkills(fragment);
      const shouldKeep =
        metrics.length > 0 ||
        technicalSkills.length > 0 ||
        impliedSoftSkills.length > 0 ||
        actionVerbPattern.test(fragment) ||
        outcomePattern.test(fragment);

      if (!shouldKeep || fragment.length < 25) {
        continue;
      }

      chunks.push({
        source_section: formatSectionLabel(sectionName),
        evidence: fragment,
        metrics,
        technical_skills: unique(technicalSkills),
        implied_soft_skills: impliedSoftSkills,
      });
    }
  }

  return chunks;
}

function extractEducationDetails(sections: ResumeSection[]) {
  return unique(
    sections
      .filter((section) => section.name === "education")
      .flatMap((section) => section.lines)
      .map((line) => line.replace(/^[•*-]\s*/, "").trim())
      .filter((line) => line.length >= 8 && line.length <= 180)
      .filter((line) => !isContactLine(line))
      .filter((line) => !isLikelyHeaderLocationLine(line)),
  ).slice(0, 4);
}

function extractExtracurricularActivities(sections: ResumeSection[]) {
  const activitySections = new Set(["leadership", "service", "research"]);

  return unique(
    sections
      .filter((section) => activitySections.has(section.name))
      .flatMap((section) => buildEvidenceChunks(section.name, section.lines))
      .map((item) => item.evidence),
  ).slice(0, 6);
}

function scoreEvidence(item: StructuredResumeEvidence) {
  let score = 0;

  if (item.metrics.length) {
    score += item.metrics.length * 4;
  }

  if (item.technical_skills.length) {
    score += item.technical_skills.length * 2;
  }

  if (item.implied_soft_skills.length) {
    score += item.implied_soft_skills.length;
  }

  if (actionVerbPattern.test(item.evidence)) {
    score += 2;
  }

  if (outcomePattern.test(item.evidence)) {
    score += 2;
  }

  if (item.source_section === "Experience" || item.source_section === "Projects") {
    score += 2;
  }

  return score;
}

function extractExplicitSkills(sections: ResumeSection[]) {
  const explicitSkillText = sections
    .filter((section) => section.name === "skills")
    .flatMap((section) => section.lines)
    .join("\n");

  if (explicitSkillText) {
    return unique(extractTechnologyMatches(explicitSkillText));
  }

  const likelySkillLines = sections
    .flatMap((section) => section.lines)
    .filter((line) => line.split(/[|,]/).length >= 4)
    .join("\n");

  return unique(extractTechnologyMatches(likelySkillLines));
}

function extractPositioningSignals(
  normalizedText: string,
  evidence: StructuredResumeEvidence[],
  options: ResumeParseOptions,
) {
  const signals: string[] = [];
  const currentYear = new Date().getFullYear();
  const big4Pattern = /\bpwc\b|\bdeloitte\b|\bey\b|\bkpmg\b/i;
  const entrepreneurshipPattern =
    /\bfounded\b|\bco-founded\b|\blaunched\b|\bran\b.+\bbusiness\b|\bowner\b/i;
  const servicePattern =
    /\bspecial needs\b|\bpatients?\b|\bchildren\b|\bkids\b|\bcaregiver\b/i;
  const researchPattern = /\bresearch\b|\blab\b|\bpublished\b|\bthesis\b/i;
  const leadershipPattern = /\bcaptain\b|\bpresident\b|\bchair\b|\bfounder\b/i;
  const recognitionPattern =
    /\baward\b|\bscholarship\b|\bdean'?s list\b|\bhonors?\b|\bfellowship\b/i;

  const standoutLines = evidence
    .map((item) => item.evidence)
    .slice(0, 12)
    .join("\n");

  if (entrepreneurshipPattern.test(standoutLines)) {
    signals.push(
      "Entrepreneurial signal: this student has built or run something independently, which reads as initiative and self-direction.",
    );
  }

  if (big4Pattern.test(normalizedText)) {
    if (options.graduationYear && options.graduationYear - currentYear >= 2) {
      signals.push(
        "Early brand-name validation: Big 4 experience this early in college stands out for someone still before graduation.",
      );
    } else {
      signals.push(
        "Institutional validation: brand-name firm experience gives outside proof that this student can operate in a structured, client-facing environment.",
      );
    }
  }

  if (servicePattern.test(standoutLines)) {
    signals.push(
      "Human-centered signal: service work with people who need support suggests empathy, patience, and adaptability under pressure.",
    );
  }

  if (researchPattern.test(standoutLines)) {
    signals.push(
      "Research signal: analytical or lab work suggests comfort with ambiguity, structured problem solving, and evidence-based thinking.",
    );
  }

  if (leadershipPattern.test(standoutLines)) {
    signals.push(
      "Leadership signal: there is visible evidence of taking ownership, not just participating.",
    );
  }

  if (recognitionPattern.test(normalizedText)) {
    signals.push(
      "Recognition signal: selective honors or awards give third-party proof that the student stands out beyond baseline coursework.",
    );
  }

  if (options.major?.trim()) {
    signals.push(
      `${options.major.trim()} major with resume signals that extend beyond coursework, which helps this student look more developed than a typical same-year candidate.`,
    );
  }

  return unique(signals).slice(0, 6);
}

function extractSoftSkillSignals(evidence: StructuredResumeEvidence[]) {
  const signals: StructuredResumeSkillSignal[] = [];
  const seen = new Set<string>();

  for (const item of evidence) {
    for (const skill of item.implied_soft_skills) {
      const key = `${skill}:${item.evidence}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      signals.push({
        skill,
        evidence: item.evidence,
      });
    }
  }

  return signals.slice(0, 8);
}

function dedupeEvidence(items: StructuredResumeEvidence[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.evidence)) {
      return false;
    }

    seen.add(item.evidence);
    return true;
  });
}

export function analyzeResumeText(
  resumeText: string,
  options: ResumeParseOptions = {},
): StructuredResume {
  const normalizedText = normalizeResumeText(resumeText);

  if (!normalizedText) {
    return {
      quantified_achievements: [],
      relevant_experience: [],
      education_details: [],
      extracurricular_activities: [],
      soft_skills: [],
      positioning_signals: [],
      technical_skills: {
        explicit: [],
        implied: [],
      },
    };
  }

  const lines = stripPersonalHeaderLines(
    normalizedText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const sections = splitIntoSections(lines);
  const evidence = dedupeEvidence(
    sections.flatMap((section) => buildEvidenceChunks(section.name, section.lines)),
  ).sort((left, right) => scoreEvidence(right) - scoreEvidence(left));

  const quantifiedAchievements = evidence
    .filter((item) => item.metrics.length > 0 || outcomePattern.test(item.evidence))
    .slice(0, 8);

  const relevantExperience = evidence.slice(0, 10);
  const explicitSkills = extractExplicitSkills(sections).slice(0, 25);
  const impliedSkills = unique(
    evidence.flatMap((item) => item.technical_skills).filter((skill) => !explicitSkills.includes(skill)),
  ).slice(0, 20);

  return {
    quantified_achievements: quantifiedAchievements,
    relevant_experience: relevantExperience,
    education_details: extractEducationDetails(sections),
    extracurricular_activities: extractExtracurricularActivities(sections),
    soft_skills: extractSoftSkillSignals(relevantExperience),
    positioning_signals: extractPositioningSignals(
      lines.join("\n"),
      relevantExperience,
      options,
    ),
    technical_skills: {
      explicit: explicitSkills,
      implied: impliedSkills,
    },
  };
}

export async function extractResumeText(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (extension === "pdf") {
    return extractPdfText(buffer);
  }

  if (extension === "docx") {
    return extractDocxText(buffer);
  }

  throw new Error("Only PDF and DOCX resumes are supported.");
}

async function extractPdfText(buffer: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let currentLine: Array<{ text: string; rawText: string; x: number; width: number }> = [];
    let currentY: number | null = null;
    let previousY: number | null = null;

    const flushLine = () => {
      if (!currentLine.length || currentY === null) {
        return;
      }

      let previousEnd: number | null = null;
      let lineText = "";

      currentLine
        .sort((left, right) => left.x - right.x)
        .forEach((item) => {
          const normalizedText = item.text;

          if (!normalizedText) {
            return;
          }

          const previousChar = lineText.slice(-1);
          const currentChar = normalizedText[0];
          const gap = previousEnd === null ? 0 : item.x - previousEnd;
          const hadLeadingSpace = /^\s/.test(item.rawText);
          const needsSpace =
            previousEnd !== null &&
            !/^[,.;:%)\]}]/.test(normalizedText) &&
            !/[([{/]$/.test(previousChar) &&
            (hadLeadingSpace || gap > 3.5);

          if (needsSpace) {
            lineText += " ";
          } else if (
            previousEnd !== null &&
            previousChar &&
            /[A-Za-z0-9]/.test(previousChar) &&
            /^[A-Za-z0-9]/.test(currentChar) &&
            gap >= 2.6
          ) {
            lineText += " ";
          }

          lineText += normalizedText;
          previousEnd = item.x + item.width;
        });

      lineText = lineText
        .replace(/\s+([,.;:])/g, "$1")
        .replace(/\(\s+/g, "(")
        .replace(/\s+\)/g, ")")
        .replace(/[ \t]{2,}/g, " ")
        .trim();

      if (lineText) {
        if (previousY !== null && Math.abs(previousY - currentY) > 18) {
          lines.push("");
        }

        lines.push(lineText);
        previousY = currentY;
      }

      currentLine = [];
      currentY = null;
    };

    for (const item of content.items as PdfTextItem[]) {
      if (!("str" in item)) {
        continue;
      }

      const rawText = item.str;
      const text = rawText.replace(/\s+/g, " ").trim();

      if (!text) {
        continue;
      }

      const y = item.transform?.[5] ?? 0;
      const x = item.transform?.[4] ?? 0;
      const width = item.width ?? Math.max(text.length * 4.5, 4);

      if (currentY === null) {
        currentY = y;
      } else if (Math.abs(currentY - y) > 2.5) {
        flushLine();
        currentY = y;
      }

      currentLine.push({ text, rawText, x, width });

      if (item.hasEOL) {
        flushLine();
      }
    }

    flushLine();

    const pageText = normalizeResumeText(lines.join("\n"));

    if (pageText) {
      pages.push(pageText);
    }
  }

  const text = pages.join("\n\n").trim();

  if (!text) {
    throw new Error("Signal could not extract text from that PDF.");
  }

  return text;
}

async function extractDocxText(buffer: ArrayBuffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const text = normalizeResumeText(result.value);

  if (!text) {
    throw new Error("Signal could not extract text from that DOCX file.");
  }

  return text;
}
