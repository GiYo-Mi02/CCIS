// CCIS Support Desk: Profanity & Vulgarity Detection Pipeline
// Enforces clean language workspace matching the Lowercase -> Normalize -> Leet -> Symbol -> Collapse -> Tokenize check workflow.

const BLOCKED_WORDS = [
  '2g1c', '2 girls 1 cup', 'acrotomophilia', 'alabama hot pocket', 'alaskan pipeline',
  'anal', 'anilingus', 'anus', 'apeshit', 'arsehole', 'ass', 'asshole', 'assmunch',
  'auto erotic', 'autoerotic', 'babeland', 'baby batter', 'baby juice', 'ball gag',
  'ball gravy', 'ball kicking', 'ball licking', 'ball sack', 'ball sucking',
  'bangbros', 'bangbus', 'bareback', 'barely legal', 'barenaked', 'bastard',
  'bastardo', 'bastinado', 'bbw', 'bdsm', 'beaner', 'beaners', 'beaver cleaver',
  'beaver lips', 'beastiality', 'bestiality', 'big black', 'big breasts',
  'big knockers', 'big tits', 'bimbos', 'birdlock', 'bitch', 'bitches',
  'black cock', 'blonde action', 'blonde on blonde action', 'blowjob', 'blow job',
  'blow your load', 'blue waffle', 'blumpkin', 'bollocks', 'bondage', 'boner',
  'boob', 'boobs', 'booty call', 'brown showers', 'brunette action', 'bukkake',
  'bulldyke', 'bullet vibe', 'bullshit', 'bung hole', 'bunghole', 'busty', 'butt',
  'buttcheeks', 'butthole', 'camel toe', 'camgirl', 'camslut', 'camwhore',
  'carpet muncher', 'carpetmuncher', 'chocolate rosebuds', 'cialis', 'circlejerk',
  'cleveland steamer', 'clit', 'clitoris', 'clover clamps', 'clusterfuck',
  'cock', 'cocks', 'coprolagnia', 'coprophilia', 'cornhole', 'coon', 'coons',
  'creampie', 'cum', 'cumming', 'cumshot', 'cumshots', 'cunnilingus', 'cunt',
  'darkie', 'date rape', 'daterape', 'deep throat', 'deepthroat', 'dendrophilia',
  'dick', 'dildo', 'dingleberry', 'dingleberries', 'dirty pillows', 'dirty sanchez',
  'doggie style', 'doggiestyle', 'doggy style', 'doggystyle', 'dog style',
  'dolcett', 'domination', 'dominatrix', 'dommes', 'donkey punch', 'double dong',
  'double penetration', 'dp action', 'dry hump', 'dvda', 'eat my ass', 'ecchi',
  'ejaculation', 'erotic', 'erotism', 'escort', 'eunuch', 'fag', 'faggot',
  'fecal', 'felch', 'fellatio', 'feltch', 'female squirting', 'femdom', 'figging',
  'fingerbang', 'fingering', 'fisting', 'foot fetish', 'footjob', 'frotting',
  'fuck', 'fuck buttons', 'fuckin', 'fucking', 'fucktards', 'fudge packer',
  'fudgepacker', 'futanari', 'gangbang', 'gang bang', 'gay sex', 'genitals',
  'giant cock', 'girl on', 'girl on top', 'girls gone wild', 'goatcx', 'goatse',
  'god damn', 'gokkun', 'golden shower', 'goodpoop', 'goo girl', 'goregasm',
  'grope', 'group sex', 'g-spot', 'guro', 'hand job', 'handjob', 'hard core',
  'hardcore', 'hentai', 'homoerotic', 'honkey', 'hooker', 'horny', 'hot carl',
  'hot chick', 'how to kill', 'how to murder', 'huge fat', 'humping', 'incest',
  'intercourse', 'jack off', 'jail bait', 'jailbait', 'jelly donut', 'jerk off',
  'jigaboo', 'jiggaboo', 'jiggerboo', 'jizz', 'juggs', 'kike', 'kinbaku',
  'kinkster', 'kinky', 'knobbing', 'leather restraint', 'leather straight jacket',
  'lemon party', 'livesex', 'lolita', 'lovemaking', 'make me come', 'male squirting',
  'masturbate', 'masturbating', 'masturbation', 'menage a trois', 'milf',
  'missionary position', 'mong', 'motherfucker', 'mound of venus', 'mr hands',
  'muff diver', 'muffdiving', 'nambla', 'nawashi', 'negro', 'neonazi', 'nigga',
  'nigger', 'nig nog', 'nimphomania', 'nipple', 'nipples', 'nsfw', 'nsfw images',
  'nude', 'nudity', 'nutten', 'nympho', 'nymphomania', 'octopussy', 'omorashi',
  'one cup two girls', 'one guy one jar', 'orgasm', 'orgy', 'paedophile', 'paki',
  'panties', 'panty', 'pedobear', 'pedophile', 'pegging', 'penis', 'phone sex',
  'piece of shit', 'pikey', 'pissing', 'piss pig', 'pisspig', 'playboy',
  'pleasure chest', 'pole smoker', 'ponyplay', 'poof', 'poon', 'poontang',
  'punany', 'poop chute', 'poopchute', 'porn', 'porno', 'pornography',
  'prince albert piercing', 'pthc', 'pubes', 'pussy', 'queaf', 'queef', 'quim',
  'raghead', 'raging boner', 'rape', 'raping', 'rapist', 'rectum', 'reverse cowgirl',
  'rimjob', 'rimming', 'rosy palm', 'rosy palm and her 5 sisters', 'rusty trombone',
  'sadism', 'santorum', 'scat', 'schlong', 'scissoring', 'semen', 'sex', 'sexcam',
  'sexo', 'sexy', 'sexual', 'sexually', 'sexuality', 'shaved beaver', 'shaved pussy',
  'shemale', 'shibari', 'shit', 'shitblimp', 'shitty', 'shota', 'shrimping',
  'skeet', 'slanteye', 'slut', 's&m', 'smut', 'snatch', 'snowballing', 'sodomize',
  'sodomy', 'spastic', 'spic', 'splooge', 'splooge moose', 'spooge', 'spread legs',
  'spunk', 'strap on', 'strapon', 'strappado', 'strip club', 'style doggy',
  'suck', 'sucks', 'suicide girls', 'sultry women', 'swastika', 'swinger',
  'tainted love', 'taste my', 'tea bagging', 'threesome', 'throating', 'thumbzilla',
  'tied up', 'tight white', 'tit', 'tits', 'titties', 'titty', 'tongue in a',
  'topless', 'tosser', 'towelhead', 'tranny', 'tribadism', 'tub girl', 'tubgirl',
  'tushy', 'twat', 'twink', 'twinkie', 'two girls one cup', 'undressing',
  'upskirt', 'urethra play', 'urophilia', 'vagina', 'venus mound', 'viagra',
  'vibrator', 'violet wand', 'vorarephilia', 'voyeur', 'voyeurweb', 'voyuer',
  'vulva', 'wank', 'wetback', 'wet dream', 'white power', 'whore', 'worldsex',
  'wrapping men', 'wrinkled starfish', 'xx', 'xxx', 'yaoi', 'yellow showers',
  'yiffy', 'zoophilia', '🖕',
  'putang ina', 'putangina', 'tangina', 'gago', 'tarantado', 'ulol',
  'kupal', 'pakyu', 'pokpok', 'pepe', 'dede', 'pekpek',
  'sana mamatay ka', 'yawa', 'gagi', 'bobo',
  'hijo puta', 'puki', 'titi', 'memek', 'memey', 'engot', 'ebang', 'putangina mo', 
  'putangina nyo', 'gago ka', 'gago kayo', 'pota', 'potangina', 'pota ina', 
  'ina mo', 'inamot', 'inanay', 'putangina mo talaga',
  'puta nyo', 'puta ka', 'tarantado mo', 'tarantado kayo', 'tarantado mo talaga',
  'ulol mo', 'ulol kayo', 'ulol ka', 'ulol mo talaga',
  'kupal mo', 'kupal kayo', 'kupal ka', 'kupal mo talaga',
  'pakyu mo', 'pakyu kayo', 'pakyu ka', 'pakyu mo talaga',
  'pokpok mo', 'pokpok kayo', 'pokpok ka', 'pokpok mo talaga',
  'pepe mo', 'pepe kayo', 'pepe ka', 'pepe mo talaga',
  'dede mo', 'dede kayo', 'dede ka', 'dede mo talaga',
  'ass mo', 'ass kayo', 'ass ka', 'ass mo talaga',
  'pekpek mo', 'pekpek kayo', 'pekpek ka', 'pekpek mo talaga',
  'sana mamatay kayo', 'sana mamatay mo talaga',
  'puki mo', 'puki nyo', 
  'titi mo', 'titi nyo', 'memek mo', 'memek nyo', 'memey mo', 'memey nyo', 
  'engot mo', 'engot nyo', 'ebang mo', 'ebang nyo', 'tarantado nyo', 
  'ulol nyo', 'kupal nyo', 'pakyu nyo', 
  'pokpok nyo', 'pepe nyo', 'dede nyo', 
  'ass nyo', 'pekpek nyo', 'puta mo', 
  'putang ina mo', 'putang ina nyo', 
  'sana mamatay nyo', 'sana mamatay mo', 
  'putang ina mo tlaga', 'putangina mo tlaga',
  'puki ka', 'titi ka', 'memek ka', 'memey ka', 'engot ka', 'ebang ka','shibal',
  'shibal ka', 'shibal ka',
];

export const checkIsProfane = (inputText: string): boolean => {
  // 1. Lowercase
  let text = inputText.toLowerCase();
  
  // 2. Unicode Normalize
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // 3. Remove Zero-width Characters
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // 4. Replace Leetspeak
  const leetMap: Record<string, string> = {
    '4': 'a', '@': 'a',
    '3': 'e', '€': 'e',
    '1': 'i', '!': 'i', '|': 'i',
    '0': 'o',
    '5': 's', '$': 's',
    '7': 't',
    '8': 'b',
    '9': 'g',
    'v': 'u',
    '(': 'c', '[': 'c'
  };
  let leetCleaned = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    leetCleaned += leetMap[char] || char;
  }
  text = leetCleaned;
  
  // 5. Remove Symbols (keep only alphanumeric and spaces)
  text = text.replace(/[^a-z0-9\s]/g, '');
  
  // 6. Collapse Repeated Letters
  const collapsed3 = text.replace(/(.)\1{2,}/g, '$1');
  const collapsedAll = text.replace(/(.)\1+/g, '$1');
  
  // 7. Tokenize
  const tokens = new Set([
    ...text.split(/\s+/),
    ...collapsed3.split(/\s+/),
    ...collapsedAll.split(/\s+/),
  ]);
  
  // 8. Dictionary Match
  // Match exact tokens (or collapsed tokens)
  for (const token of tokens) {
    if (!token) continue;
    if (BLOCKED_WORDS.includes(token)) return true;
    for (const blocked of BLOCKED_WORDS) {
      if (token === blocked || token === blocked.replace(/(.)\1+/g, '$1')) {
        return true;
      }
    }
  }

  // 8.5 Core Curse Roots Check (substring checks for high-confidence curse roots to catch concatenation)
  const CORE_CURSE_ROOTS = [
    'fuck', 'shit', 'cunt', 'pussy', 'bitch', 'asshole',
    'tangina', 'tangena', 'putangina', 'putangena',
    'gago', 'tarantado', 'ulol', 'kupal', 'pakyu', 'shet', 'shibal'
  ];

  for (const root of CORE_CURSE_ROOTS) {
    if (
      text.includes(root) ||
      collapsed3.includes(root) ||
      collapsedAll.includes(root)
    ) {
      return true;
    }
  }

  // 8.6 Spaced-out Core Curse Check (catches spaces between letters like p u t a n g i n a)
  const SPACED_CURSE_CHECK_ROOTS = [
    'fuck', 'shit', 'cunt', 'pussy', 'bitch', 'asshole',
    'tangina', 'tangena', 'putangina', 'putangena', 'pakyu', 'shibal'
  ];
  const textNoSpaces = text.replace(/\s+/g, '');
  const collapsed3NoSpaces = collapsed3.replace(/\s+/g, '');
  const collapsedAllNoSpaces = collapsedAll.replace(/\s+/g, '');
  for (const root of SPACED_CURSE_CHECK_ROOTS) {
    if (
      textNoSpaces.includes(root) ||
      collapsed3NoSpaces.includes(root) ||
      collapsedAllNoSpaces.includes(root)
    ) {
      return true;
    }
  }
  
  // 9. Substring match ONLY for multi-word phrases or emojis/symbols
  for (const blocked of BLOCKED_WORDS) {
    const cleanBlocked = blocked.replace(/[^a-z0-9\s]/g, '');
    
    // If it is an emoji or symbol only
    if (!cleanBlocked) {
      if (inputText.includes(blocked)) {
        return true;
      }
      continue;
    }

    // Only apply substring match if the blocked term is a multi-word phrase
    if (blocked.includes(' ')) {
      const collapsedBlocked = cleanBlocked.replace(/(.)\1+/g, '$1');
      if (
        text.includes(cleanBlocked) ||
        collapsed3.includes(cleanBlocked) ||
        collapsedAll.includes(collapsedBlocked)
      ) {
        return true;
      }
    }
  }
  
  return false;
};
