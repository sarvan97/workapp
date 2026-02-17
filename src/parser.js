const ACTIVITY_PATTERNS = [
  { type: 'gym', letter: 'W', color: '#3f9142', patterns: [/\bgym\b/i, /\bweights?\b/i, /\bleg day\b/i, /\bchest\b/i, /\btriceps\b/i] },
  { type: 'run', letter: 'R', color: '#1b75bb', patterns: [/\bran\b/i, /\brun\b/i, /\bjog\b/i, /\b5k\b/i, /\b10k\b/i] },
  { type: 'swim', letter: 'S', color: '#0e7490', patterns: [/\bswam\b/i, /\bswim\b/i, /\bpool\b/i] },
  { type: 'yoga', letter: 'Y', color: '#8b5cf6', patterns: [/\byoga\b/i, /\bvinyasa\b/i, /\bstretch\b/i] },
  { type: 'walk', letter: 'K', color: '#ca8a04', patterns: [/\bwalk\b/i, /\bwalked\b/i, /\bhike\b/i] }
];

const CATEGORY_PATTERNS = [
  'chest', 'back', 'legs', 'triceps', 'biceps', 'shoulders', 'cardio', 'core', 'full body'
];

function parseDurationMinutes(text) {
  const lower = text.toLowerCase();

  const hourMatch = lower.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)\b/i);
  const minuteMatch = lower.match(/(\d{1,3})\s*(?:m|min|mins|minute|minutes)\b/i);

  if (hourMatch) {
    return Number(hourMatch[1]) * 60 + Number(minuteMatch?.[1] || 0);
  }

  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  return null;
}

function parseTags(text) {
  const hashtags = [...text.matchAll(/#([a-z0-9_-]+)/gi)].map((m) => m[1].toLowerCase());
  const tagsLabel = text.match(/\btags?\s*:\s*([^.;\n]+)/i);
  const labeled = tagsLabel
    ? tagsLabel[1]
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const merged = [...new Set([...hashtags, ...labeled])];
  return merged.length ? merged : null;
}

function detectActivityType(text) {
  for (const config of ACTIVITY_PATTERNS) {
    if (config.patterns.some((pattern) => pattern.test(text))) {
      return config.type;
    }
  }
  return null;
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  const hits = CATEGORY_PATTERNS.filter((category) => lower.includes(category));
  if (!hits.length) {
    return null;
  }
  return hits.join(', ');
}

function parserMetadata(type) {
  const found = ACTIVITY_PATTERNS.find((p) => p.type === type);
  return {
    indicator_letter: found?.letter ?? '?',
    indicator_color: found?.color ?? '#64748b'
  };
}

function parseWorkoutText(rawText) {
  const activity_type = detectActivityType(rawText);
  const duration_minutes = parseDurationMinutes(rawText);
  const category = detectCategory(rawText);
  const tags = parseTags(rawText);

  const notes = rawText
    .replace(/#[a-z0-9_-]+/gi, '')
    .trim();

  return {
    raw_text: rawText,
    activity_type,
    duration_minutes,
    category,
    tags,
    notes: notes.length ? notes : null,
    ...parserMetadata(activity_type)
  };
}

module.exports = {
  parseWorkoutText,
  ACTIVITY_PATTERNS
};
