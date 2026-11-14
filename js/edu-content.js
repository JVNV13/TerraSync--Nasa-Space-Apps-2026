// Every word on the Learn page lives here: the deck's six story cards, the glossary that
// feeds the tooltips, and the six game rounds. The components in js/views/edu.js hold no
// copy at all, so this is the only file to edit when the wording changes.
//
// Glossary tooltips: wrap a term in double brackets inside any story, claim, reason or
// reaction string and it becomes a dotted-underlined word with a hover/focus/tap
// definition.
//   [[regolith]]               -> shows "regolith", defines "regolith"
//   [[lava tube|lava tubes]]   -> shows "lava tubes", defines "lava tube"
// Keys must exist in GLOSSARY below. The renderer lives in js/term.js.
//
// Photos: each card names a file under images/learn/. Drop a real photo there and the
// card shows it instead of the animated SVG; if the file is missing the SVG stays. See
// images/learn/README.md.

export const HERO = {
  crumb: 'Learn',
  title: 'Learn',
  sub: 'How Earth helps us get ready for the Moon and Mars.',
};

export const DECK = {
  cardLabel: 'Card',
  of: 'of',
  flipHint: 'Flip me',
  flipBack: 'Flip back',
  prev: 'Previous card',
  next: 'Next card',
  toGame: 'Play the game',
  dotLabel: 'Go to card',
  readLabel: 'read',
};

/* ------------------------------------------------------------------ story cards
   art:   key in js/edu-art.js
   photo: optional file; used instead of the SVG when it exists
   story: 80-120 words, told as a tiny story about Rookie
   badge: a short fun fact shown on the back
   cta:   optional { label, href, external } */
export const CARDS = [
  {
    id: 'day-one',
    n: 1,
    art: 'rover',
    photo: 'images/learn/card-1.jpg',
    title: 'Rookie’s first day',
    teaser: 'Why can’t Rookie leave for Mars tomorrow?',
    story: 'Rookie is a small rover with one big plan: go to Mars. Tomorrow, ideally. Mission control says no. First you practise here, in places on Earth that behave like the place you are going. Those practice places are called [[analog|analogs]]. Rookie is not impressed — until someone mentions that the Apollo astronauts did exactly the same thing. Before walking on the Moon they trained in places like Iceland and Hawaii, learning to read rocks and move over rough ground. So Rookie gets a map of Earth instead of a rocket. Day one: find the places that lie convincingly about being Mars.',
    badge: 'Apollo crews trained in Iceland and Hawaii first.',
  },
  {
    id: 'beach',
    n: 2,
    art: 'twins',
    photo: 'images/learn/card-2.jpg',
    title: 'The beach mistake',
    teaser: 'Sand in the photo. Is it Mars?',
    story: 'Rookie rolls onto a sandy beach, scans the dunes and announces: Mars. Mission control replies: wet, warm, and absolutely full of life. Three strikes. A photo can fool you, because sand in a picture says nothing about temperature, water, or what the grains are made of. So Rookie tries again in the Atacama Desert in Chile — one of the driest places on Earth, where real Mars rovers and instruments have been tested. Same colour palette, completely different story. Looks alike is not the same as is alike. Data decides, and the data has no interest in your holiday photos.',
    badge: 'Atacama: one of the driest places on Earth.',
  },
  {
    id: 'checklist',
    n: 3,
    art: 'checklist',
    photo: 'images/learn/card-3.jpg',
    title: 'The checklist',
    teaser: 'How many boxes make a good stand-in?',
    story: 'Mission control hands Rookie a clipboard. Six boxes, because alike is not one question. One: geology and [[mineralogy]], what the ground is made of, down to the loose [[regolith]] on top. Two: [[topography]], the shape of the land. Three: temperature and lighting. Four: water and ice, including [[permafrost]], which decides whether an [[extremophile]] could hang on and whether a [[biosignature]] would keep. Five: dust and wind, the [[aeolian]] business that scratches lenses. Six: caves and [[lava tube|lava tubes]], the natural shelters. Rookie ticks every box and feels extremely professional. Six ticks is the dream. Six ticks almost never happens.',
    badge: 'Six boxes. Each one scored on its own.',
  },
  {
    id: 'imperfect',
    n: 4,
    art: 'bars',
    photo: 'images/learn/card-4.jpg',
    title: 'Nobody’s perfect',
    teaser: 'Is there one perfect Mars twin on Earth?',
    story: 'Rookie wants one perfect twin: a single place on Earth that matches Mars in every box. There isn’t one. A site can score brilliantly on rocks and badly on temperature, or nail the dust and miss the ice completely. Squashing all of that into one number would hide exactly the part you needed to know. So our tool gives a [[similarity score]] for each feature separately. Then you pick the site that matches the part your mission cares about, and you know precisely what you are faking. Rookie calls this cheating. Mission control calls it engineering.',
    badge: 'A score per feature — never one average.',
    cta: { label: 'Try it in Find a Twin', href: '#finder' },
  },
  {
    id: 'shadows',
    n: 5,
    art: 'shadow',
    photo: 'images/learn/card-5.jpg',
    title: 'The land of long shadows',
    teaser: 'What happens when the Sun never rises properly?',
    story: 'In the simulator, Rookie drives to the Moon’s south pole. The Sun never climbs high there. It hangs near the horizon, so every rock throws a shadow that goes on and on, and some crater floors never see sunlight at all. Those are [[permanently shadowed region|permanently shadowed regions]]. Rookie’s cameras hate it: half the view is blinding, half is pure black, and the rim of an [[impact crater]] looks like a cliff that isn’t there. Drivers get confused too. So we look for Earth places with the same awkward lighting, and practise until the shadows stop lying.',
    badge: 'Some crater floors never see sunlight.',
    // No lighting case-study route exists yet, so this opens the project's own shadow
    // write-up. Swap href for the route (e.g. '#terrain') when that page lands.
    cta: { label: 'Open the lighting case study', href: 'Why%20Shadows%20Matter%20on%20Mars.pdf', external: true },
  },
  {
    id: 'limits',
    n: 6,
    art: 'jump',
    photo: 'images/learn/card-6.jpg',
    title: 'What Earth can’t fake',
    teaser: 'What can no desert on Earth copy?',
    story: 'Rookie has one last idea: practise a Moon jump. Big wind-up, brave launch, immediate thud. Earth pulls far too hard. Moon gravity is about one sixth of ours and Mars gravity about 38% of ours, and no desert, crater or cave on this planet will change that. Earth also refuses to supply the Moon’s vacuum, Mars’s thin air, or space radiation, because the air and sky here are busy keeping us alive. So [[analog|analogs]] stay what they are: practice, not the real thing. Rookie writes that down, slightly dented, and books a seat anyway.',
    badge: 'Moon ≈ 1/6 g · Mars ≈ 38% g',
  },
];

/* ------------------------------------------------------------------ glossary
   One sentence each. There is no glossary list on the page by design: these only ever
   appear as tooltips on the dotted words above. */
export const GLOSSARY = {
  'analog': { term: 'Analog', def: 'A place on Earth used to stand in for another world, because something about it behaves the same way.' },
  'regolith': { term: 'Regolith', def: 'The layer of loose, broken rock and dust sitting on top of solid bedrock.' },
  'lava tube': { term: 'Lava tube', def: 'A cave left behind when a river of lava crusts over on top and the molten rock inside drains away.' },
  'permafrost': { term: 'Permafrost', def: 'Ground that stays frozen all year round, year after year.' },
  'permanently shadowed region': { term: 'Permanently shadowed region', def: 'A spot, usually a crater floor near a pole, that never receives direct sunlight.' },
  'impact crater': { term: 'Impact crater', def: 'The bowl-shaped scar left where a meteorite or asteroid slammed into a surface.' },
  'extremophile': { term: 'Extremophile', def: 'A living thing that thrives in conditions most life would find lethal, such as extreme cold, salt or dryness.' },
  'topography': { term: 'Topography', def: 'The shape of a surface: its hills, slopes, dips, and how high everything sits.' },
  'mineralogy': { term: 'Mineralogy', def: 'Which minerals a rock or soil is actually made of.' },
  'aeolian': { term: 'Aeolian', def: 'Wind-driven: anything shaped or moved by wind, like dunes and dust storms.' },
  'biosignature': { term: 'Biosignature', def: 'A trace that life leaves behind, which an instrument could detect.' },
  'similarity score': { term: 'Similarity score', def: 'A percentage saying how closely two places match on one measured feature.' },
};

/* ------------------------------------------------------------------ game */
export const GAME = {
  title: 'Analog or Not?',
  intro: 'Six claims. Swipe right for Analog, left for Nope — or use the buttons and arrow keys.',
  yes: 'Analog!',
  no: 'Nope!',
  swipeYes: 'Analog',
  swipeNo: 'Nope',
  rightLabel: 'Correct',
  wrongLabel: 'Not quite',
  roundLabel: 'Round',
  reactionLabel: 'Rookie says',
  next: 'Next round',
  finish: 'See my rank',
  rounds: [
    {
      art: 'desert',
      photo: 'images/learn/game-1.jpg',
      place: 'Atacama Desert, Chile',
      claim: 'A good analog for how dry Mars is.',
      answer: true,
      reason: 'One of the driest places on Earth, which is exactly the point.',
      reaction: 'I packed water. Then water for the water.',
    },
    {
      art: 'tube',
      photo: 'images/learn/game-2.jpg',
      place: 'Lava tubes in Hawaii',
      claim: 'A good analog for caves on the Moon and Mars.',
      answer: true,
      reason: 'The Moon and Mars have [[lava tube|lava tubes]] too, so these are the rehearsal caves.',
      reaction: 'Free roof. Ten out of ten, would park here.',
    },
    {
      art: 'beach',
      photo: 'images/learn/game-3.jpg',
      place: 'A tropical beach',
      claim: 'A good analog for Mars dunes, because it is sandy.',
      answer: false,
      reason: 'Wet, warm and full of life. Looks are not data.',
      reaction: 'In my defence, the dunes looked very convincing.',
    },
    {
      art: 'crater',
      photo: 'images/learn/game-4.jpg',
      place: 'Haughton Crater, Devon Island, Canada',
      claim: 'A good analog for a cold impact crater.',
      answer: true,
      reason: 'A real [[impact crater]] in a cold, barren place. Both boxes ticked.',
      reaction: 'Cold, empty, full of rocks. I feel at home.',
    },
    {
      art: 'valley',
      photo: 'images/learn/game-5.jpg',
      place: 'Antarctica’s Dry Valleys',
      claim: 'A good analog for cold, dry Mars conditions.',
      answer: true,
      reason: 'Cold and bone-dry at the same time, which is rare on Earth.',
      reaction: 'Technically a desert. I still want a blanket.',
    },
    {
      art: 'gravity',
      photo: 'images/learn/game-6.jpg',
      place: 'Any site on Earth',
      claim: 'This site matches Mars in everything, including gravity.',
      answer: false,
      reason: 'No place on Earth can copy Mars’s gravity.',
      reaction: 'I tested this personally. The ground won.',
    },
  ],
  ranks: [
    { min: 0, name: 'Space Intern', note: 'You fetched the coffee. In zero g. It went everywhere.' },
    { min: 3, name: 'Rover Driver', note: 'Solid instincts. One minor crater incident, nothing official.' },
    { min: 5, name: 'Mission Commander', note: 'You read the data before trusting the photo. Hired.' },
  ],
  scoreLabel: 'out of',
  again: 'Play again',
  toTool: 'Find a real twin',
  toolHref: '#finder',
};
