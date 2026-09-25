/**
 * AARTHIKA Multilingual Spoken Number Parser
 * Converts spoken words/phrases across Indian languages into validated numeric values.
 */

// Indic digit conversion maps
const INDIC_DIGIT_MAP: Record<string, string> = {
  // Devanagari (Hindi, Bhojpuri)
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  // Bengali
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  // Telugu
  '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4',
  '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9',
  // Gurmukhi (Punjabi)
  '੦': '0', '੧': '1', '੨': '2', '੩': '3', '੪': '4',
  '੫': '5', '੬': '6', '੭': '7', '੮': '8', '੯': '9',
  // Kannada
  '೦': '0', '೧': '1', '೨': '2', '೩': '3', '೪': '4',
  '೫': '5', '೬': '6', '೭': '7', '೮': '8', '೯': '9',
  // Malayalam
  '൦': '0', '൧': '1', '൨': '2', '൩': '3', '൪': '4',
  '൫': '5', '൬': '6', '൭': '7', '൮': '8', '൯': '9',
};

// Word values in English, Hindi, Bengali
const WORD_NUMBERS: Record<string, number> = {
  // English words
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
  'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  'hundred': 100, 'thousand': 1000, 'lakh': 100000, 'lakhs': 100000, 'lac': 100000,
  'crore': 10000000, 'crores': 10000000, 'k': 1000, 'm': 1000000,

  // Hindi words
  'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
  'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15,
  'सोलह': 16, 'सत्रह': 17, 'अट्ठारह': 18, 'उन्नीस': 19, 'बीस': 20,
  'पच्चीस': 25, 'तीस': 30, 'पैंतीस': 35, 'चालीस': 40, 'पैंतालीस': 45, 'पचास': 50,
  'पचपन': 55, 'साठ': 60, 'पैंसठ': 65, 'सत्तर': 70, 'पचहत्तर': 75, 'अस्सी': 80,
  'पचासी': 85, 'नब्बे': 90, 'पंचानवे': 95,
  'सौ': 100, 'हजार': 1000, 'हज़ार': 1000, 'लाख': 100000, 'करोड़': 10000000,
  'डेढ़': 1.5, 'ढाई': 2.5, 'साढ़े': 0.5, 'सवा': 1.25,

  // Bengali words
  'শূন্য': 0, 'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5,
  'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9, 'দশ': 10,
  'এগারো': 11, 'বারো': 12, 'তেরো': 13, 'চৌদ্দ': 14, 'পনেরো': 15,
  'ষোল': 16, 'সতেরো': 17, 'আঠারো': 18, 'উনিশ': 19, 'কুড়ি': 20, 'বিশ': 20,
  'পঁচিশ': 25, 'ত্রিশ': 30, 'পঁয়ত্রিশ': 35, 'চল্লিশ': 40, 'পঁয়তাল্লিশ': 45, 'পঞ্চাশ': 50,
  'পঞ্চান্ন': 55, 'ষাট': 60, 'পঁয়ষট্টি': 65, 'সত্তর': 70, 'পঁচাত্তর': 75, 'আশি': 80,
  'পঁচাশি': 85, 'নব্বই': 90, 'পঁচানব্বই': 95,
  'শত': 100, 'শো': 100, 'হাজার': 1000, 'লাখ': 100000, 'লক্ষ': 100000, 'কোটি': 10000000,
  'দেড়': 1.5, 'আড়াই': 2.5,

  // Hinglish / Latin script Indian words
  'ek': 1, 'do': 2, 'teen': 3, 'chaar': 4, 'char': 4, 'paanch': 5, 'panch': 5,
  'chhah': 6, 'che': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
  'gyaarah': 11, 'baarah': 12, 'terah': 13, 'chaudah': 14, 'pandrah': 15,
  'solah': 16, 'satrah': 17, 'atharah': 18, 'unnees': 19, 'bees': 20,
  'pachees': 25, 'tees': 30, 'paintees': 35, 'chaalees': 40, 'chalis': 40, 'paintaalees': 45, 'pachaas': 50, 'pachas': 50,
  'pachpan': 55, 'saath': 60, 'painsath': 65, 'sattar': 70, 'pachhattar': 75, 'assee': 80, 'assi': 80,
  'pachaasee': 85, 'pachasi': 85, 'nabbe': 90, 'panchaanbe': 95,
  'sau': 100, 'dedh': 1.5, 'dhaai': 2.5, 'saadhe': 0.5, 'sava': 1.25,
};

// Multipliers
const SCALE_MAP: Record<string, number> = {
  'k': 1000,
  'thousand': 1000,
  'हजार': 1000,
  'हज़ार': 1000,
  'হাজার': 1000,
  'వేలు': 1000,
  'ആയിരം': 1000,
  'ਸਾਹ': 1000,
  'hazaar': 1000,
  'hazar': 1000,

  'lakh': 100000,
  'lakhs': 100000,
  'lac': 100000,
  'लाख': 100000,
  'লক্ষ': 100000,
  'లక్ష': 100000,
  'ലക്ഷം': 100000,
  'ਲੱਖ': 100000,

  'crore': 10000000,
  'crores': 10000000,
  'करोड़': 10000000,
  'কোটি': 10000000,
  'కోటి': 10000000,
  'കോടി': 10000000,

  'hundred': 100,
  'सौ': 100,
  'শত': 100,
  'শো': 100,
  'వంద': 100,
  'നൂറ്': 100,
};

export interface NumberParseResult {
  success: boolean;
  value: number;
  formatted: string;
  rawText: string;
}

export function parseSpokenNumber(input: string): NumberParseResult {
  if (!input || typeof input !== 'string') {
    return { success: false, value: 0, formatted: '', rawText: '' };
  }

  let text = input.trim();
  const rawText = text;

  // 1. Normalize Indic digits (०-९, ০-৯, etc.) to ASCII 0-9
  text = text.replace(/[\u0966-\u096F\u09E6-\u09EF\u0C66-\u0C6F\u0A66-\u0A6F\u0CE6-\u0CEF\u0D66-\u0D6F]/g, (match) => {
    return INDIC_DIGIT_MAP[match] || match;
  });

  // 2. Remove currency symbols, commas, words like "rupees", "रुपये", "টাকা", etc.
  text = text
    .replace(/[₹$,]/g, '')
    .replace(/\b(rupees|rupee|inr|rs|taka|paisa|रुपये|रुपया|টাকা|రూపాయలు|രൂപ|ਰੁਪਏ)\b/gi, '')
    .trim()
    .toLowerCase();

  // 3. Direct numeric extraction if plain digits/floats exist (e.g., "50000", "50000.50")
  const directMatch = text.match(/^[-+]?[0-9]*\.?[0-9]+$/);
  if (directMatch) {
    const val = parseFloat(directMatch[0]);
    if (!isNaN(val) && val >= 0) {
      return { success: true, value: val, formatted: val.toString(), rawText };
    }
  }

  // 4. Combined Digit + Scale (e.g. "50k", "2.5 lakh", "50 हजार", "2 লাখ", "1.5 crore")
  const digitScaleMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*([a-z\u0900-\u0D7F]+)/i);
  if (digitScaleMatch) {
    const numPart = parseFloat(digitScaleMatch[1]);
    const scaleWord = digitScaleMatch[2].toLowerCase();
    if (SCALE_MAP[scaleWord]) {
      const total = numPart * SCALE_MAP[scaleWord];
      return { success: true, value: total, formatted: total.toString(), rawText };
    }
  }

  // 5. Word-by-word parser for verbal sentences
  // e.g. "पचास हजार", "পঞ্চাশ হাজার", "fifty thousand", "two lakh fifty thousand"
  const tokens = text.split(/[\s,]+/);
  let currentTotal = 0;
  let currentSegment = 0;
  let hasNumberToken = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    // Check if direct digit
    if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
      currentSegment += parseFloat(token);
      hasNumberToken = true;
      continue;
    }

    // Check scale words
    if (SCALE_MAP[token]) {
      const scale = SCALE_MAP[token];
      if (currentSegment === 0) currentSegment = 1;
      currentTotal += currentSegment * scale;
      currentSegment = 0;
      hasNumberToken = true;
      continue;
    }

    // Check word numbers
    if (WORD_NUMBERS[token] !== undefined) {
      const val = WORD_NUMBERS[token];
      if (val === 1.5 || val === 2.5) {
        // Special fractional words like "डेढ़", "ढाई", "দেড়", "আড়াই"
        // Look ahead for scale (e.g. "डेढ़ लाख" -> 1.5 * 100000 = 150000)
        const nextToken = tokens[i + 1];
        if (nextToken && SCALE_MAP[nextToken]) {
          currentSegment = val;
        } else {
          currentSegment += val;
        }
      } else {
        currentSegment += val;
      }
      hasNumberToken = true;
      continue;
    }
  }

  const finalTotal = currentTotal + currentSegment;
  if (hasNumberToken && finalTotal > 0) {
    return {
      success: true,
      value: finalTotal,
      formatted: finalTotal.toString(),
      rawText
    };
  }

  // 6. If not recognized, return failure
  return { success: false, value: 0, formatted: '', rawText };
}
