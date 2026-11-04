// Pre-rolled session values for persona generation.
//
// The failure mode this exists to fix: batch generation converges. Every run sees the same image,
// the same prompt and nothing else, so it reaches for the same character — sunny surface, dark
// secret, "being watched" — and the batch comes out looking like one person repeated. Instructions
// to "be more varied" do not help much, because the model has no way to know what the other runs
// already took.
//
// So the variety is decided before the model sees the request: one value per non-appearance channel
// is drawn here, injected above the prompt as a default block, and kept with the draft so
// regenerating a card does not silently re-roll it into a different person.
//
// Appearance is not pre-rolled. Age, body, skin and hair come from the image; these channels are
// everything the image cannot tell you.

/**
 * Channels, in the order they appear in the block. Each entry is written to be usable verbatim and
 * to be specific — a concrete claim the prose can be built on. Entries deliberately include
 * unflattering, low-status and unglamorous options, and avoid eye/gaze imagery, which the prompt's
 * banned-phrase list targets.
 */
export const CHARACTER_THEMES = [
    { label: 'Warm and lived-in', text: 'Warm and lived-in: second-hand furniture, chipped mugs, food on the stove, a hall light left on for somebody.' },
    { label: 'Neon and rain-slick', text: 'Neon and rain-slick: wet asphalt, signs in three colours, train announcements at 2am, a jacket that never quite dries.' },
    { label: 'Gothic and candlelit', text: 'Gothic and candlelit: cold stone, draughts under doors, beeswax and iron, rooms that were grand once.' },
    { label: 'Dystopian and rationed', text: 'Dystopian and rationed: patched uniforms, queue tickets, grey daylight, a speaker on a pole that still works.' },
    { label: 'Sun-bleached and tired', text: 'Sun-bleached and tired: dust on the windowsill, warm beer, a fan that turns, everything a shade paler than it was.' },
    { label: 'Corporate and glass', text: 'Corporate and glass: lanyards, polished floors, a plant nobody waters, a meeting room with the blinds down.' },
    { label: 'Pastoral and muddy', text: 'Pastoral and muddy: boot scrapers, wet wool, a cattle grid, mornings that smell of silage.' },
    { label: 'Weird and folkloric', text: 'Weird and folkloric: charms nailed over doors, a path everyone takes the long way round, rules nobody explains.' },
    { label: 'Mythic and storm-lit', text: 'Mythic and storm-lit: bronze, salt, low cloud, names with weight in them, weather that answers to somebody.' },
    { label: 'Liminal and fluorescent', text: 'Liminal and fluorescent: corridors after hours, vending machines, one strip light buzzing, a clock ten minutes fast.' },
    { label: 'Heat and humidity', text: 'Heat and humidity: fans moving warm air, sweat at the collarbone, screens propped open, everything sticky at six.' },
    { label: 'Cold and industrial', text: 'Cold and industrial: concrete, work gloves, breath in the air, a shift bell, a kettle on a pallet.' },
    { label: 'Soft and domestic', text: 'Soft and domestic: knitted blankets, bread cooling, a radio in the next room, shoes left where they were kicked.' },
    { label: 'Glitter and grit', text: 'Glitter and grit: sequins under a work jacket, sticky floors, cab receipts, a dress worth more than the flat.' },
    { label: 'Salt and sea-air', text: 'Salt and sea-air: ropes, gulls, diesel, a town that smells of low tide.' },
    { label: 'Paper and old smoke', text: 'Paper and old smoke: books with pencil in the margins, ashtrays, worn stair carpet, doors that stick.' },
];

export const WORLD_THEMES = [
    { label: 'Cozy but fraying', text: 'Cozy but fraying: a town with one bakery and one problem nobody has fixed; warmth that has started to run down.' },
    { label: 'Neon noir', text: 'Neon noir: rain, signs, debt, a police force on the take, beauty in the reflection, rot under the arcade.' },
    { label: 'Dystopian austerity', text: 'Dystopian austerity: quotas, permits, a loudspeaker, a black market, a bureaucracy that works for somebody else.' },
    { label: 'Pastoral gothic', text: 'Pastoral gothic: fields, a chapel, a family that has owned the land too long, weather as a character.' },
    { label: 'Solarpunk', text: 'Solarpunk: scaffolding with plants on it, civic pride, repairs instead of replacements, an argument about water.' },
    { label: 'Post-collapse', text: 'Post-collapse: salvage, convoys, local treaties, a working radio and no working grid.' },
    { label: 'Corporate arcology', text: 'Corporate arcology: company housing, floors as class, a transit atrium, contracts that include your sleep.' },
    { label: 'Mythic', text: 'Mythic: a harbour with gods in the ledger, oaths that bind, storms with intent, festivals that must be kept.' },
    { label: 'Liminal', text: 'Liminal: an airport town, a motel with long stays, shift work, a place people pass through.' },
    { label: 'Coastal working town', text: 'Coastal working town: a cannery, a ferry timetable, tourists in summer, everyone knows the water.' },
    { label: 'Frontier', text: 'Frontier: distance, a land office, a rail head, a sheriff who was elected because nobody else would.' },
    { label: 'Underground', text: 'Underground: tunnels, a lift with a queue, damp concrete, hydroponics, a whole economy that never sees sky.' },
    { label: 'Orbital', text: 'Orbital: a station ring, maintenance rotas, Earth as weather, air as a billed utility.' },
    { label: 'Weird fiction', text: 'Weird fiction: a town with one unexplained rule, a survey office, locals who correct outsiders, a season that repeats.' },
    { label: 'Industrial river city', text: 'Industrial river city: foundries, bridges, shift whistles, a river that carries what is dumped in it.' },
    { label: 'Academic town', text: 'Academic town: a college, a library with restricted floors, term rhythms, a reputation to keep.' },
    { label: 'Suburban night', text: 'Suburban night: cul-de-sacs and a strip-mall lot twenty minutes from a city, a big high school with a packed lot, a house with the parents away, a late diner, a rumour mill faster than the school\'s.' },
];

/** Theme pickers for the character and world screens; the value sent as a steer is the entry text. */
export const THEME_OPTIONS = {
    character: CHARACTER_THEMES.map(theme => ({ value: theme.text, label: theme.label })),
    world: WORLD_THEMES.map(theme => ({ value: theme.text, label: theme.label })),
};

/** Personality energy levels; each narrows the mask list to a cell. */
export const PERSONA_VIBES = ['Shy', 'Reserved', 'Steady', 'Outgoing', 'Big personality'];

/** How she handles the people she reaches for. Paired with a vibe, this picks one mask cell. */
export const PERSONA_WARMTHS = ['Sweet', 'Neutral', 'Sharp'];

/** Mask palettes by "energy/warmth" cell. Two per cell; a missing axis unions the cells. */
export const MASK_CELLS = {
    "shy/sweet": [
        "Shy and warm: leaves small kindnesses where they will be found and looks away before they land.",
        "Soft-spoken and eager to please: agrees first, thinks later, hates being the reason plans change."
    ],
    "shy/neutral": [
        "Shy in a way that reads as rude: answers late, looks at the floor, thaws one to one.",
        "Quiet and watchful: notices everything from the edge of the room and volunteers none of it."
    ],
    "shy/sharp": [
        "Nervous and clipped: short answers, flinches at raised voices, sharpest in the margins.",
        "Withdrawn and quietly judgmental: watches, decides against you, tells nobody."
    ],
    "reserved/sweet": [
        "Quiet by choice and unexpectedly kind: small acts, no announcement.",
        "Self-contained and gentle: keeps her own weather, gives attention in careful doses."
    ],
    "reserved/neutral": [
        "Flat, unimpressed and literal: answers in facts, not feelings.",
        "Guarded and slow to answer, as if translating from somewhere."
    ],
    "reserved/sharp": [
        "Polite to the point of coldness: scrupulously correct, and it reads as distance.",
        "Dry and hard to offend: one word, half meant."
    ],
    "steady/sweet": [
        "Steady and welcoming: keeps things moving, makes room without a fuss.",
        "Unfussy and kind: practical favours, plain words, remembers what you needed."
    ],
    "steady/neutral": [
        "Fussy about small things and careless about big ones.",
        "Practical and even: no performance, no drama, still there at the end."
    ],
    "steady/sharp": [
        "Blunt and unwelcoming: short answers, no smile, no effort to be liked.",
        "Matter-of-fact and merciless about what is broken; fixes it anyway."
    ],
    "outgoing/sweet": [
        "Warm and loud: greets everyone, remembers names, asks the follow-up.",
        "Chatty and curious: will talk to a queue, a dog, and a bouncer."
    ],
    "outgoing/neutral": [
        "Brash and funny: says the thing, lands it, buys the next round.",
        "Untidy and carelessly generous with other people's lighter fluid and cupboard doors."
    ],
    "outgoing/sharp": [
        "Hard to offend and hard to impress: says what the room was thinking, eyes the door.",
        "Sharp-tongued and quick: teasing that lands a little too true, never explains the joke."
    ],
    "big personality/sweet": [
        "Loud, generous and everyone's favourite: mid-story before she reaches the table, buys the first round.",
        "Big-hearted show-off: sings, dances, drags the quiet one up."
    ],
    "big personality/neutral": [
        "Noisy and tiring: talks over people, laughs at the wrong moment, impossible to correct.",
        "Restless and impatient: never finishes a drink, stands when other people sit."
    ],
    "big personality/sharp": [
        "Magnetic and exhausting: pulls people in, burns bright, leaves early.",
        "Runs on attention and gives the room a show; cruel only when the room asks."
    ]
};

export const PERSONA_STEER_OPTIONS = {
    VIBE: PERSONA_VIBES,
    WARMTH: PERSONA_WARMTHS,
    SEXUALITY: ['Bisexual', 'Heterosexual', 'Lesbian', 'Gay'],
    SOURCE: [
        { value: 'virgin', label: 'Virgin' },
        { value: 'some', label: 'Some experience' },
        { value: 'experienced', label: 'Experienced' },
        { value: 'hedonist', label: 'Hedonist' },
    ],
};

/** Population bands each theme tolerates. */
export const THEME_SCALES = {
    'Cozy but fraying': [1, 2],
    'Neon noir': [4, 5],
    'Dystopian austerity': [3, 5],
    'Pastoral gothic': [0, 1],
    'Solarpunk': [2, 3],
    'Post-collapse': [0, 1],
    'Corporate arcology': [5],
    'Mythic': [0, 1, 2],
    'Liminal': [2, 3, 4],
    'Coastal working town': [1, 2],
    'Frontier': [0, 1],
    'Underground': [4, 5],
    'Orbital': [4, 5],
    'Weird fiction': [0, 1, 2],
    'Industrial river city': [2, 4],
    'Academic town': [2, 3],
    'Suburban night': [3],
};

/** Which place kinds each world theme tolerates; a mismatch is moved rather than forced. */
export const THEME_PLACE_KINDS = {
    "Cozy but fraying": [
        "suburban",
        "smallcity",
        "lake",
        "rural"
    ],
    "Neon noir": [
        "urban"
    ],
    "Dystopian austerity": [
        "urban",
        "smallcity"
    ],
    "Pastoral gothic": [
        "rural"
    ],
    "Solarpunk": [
        "smallcity",
        "urban",
        "suburban"
    ],
    "Post-collapse": [
        "rural",
        "smallcity"
    ],
    "Corporate arcology": [
        "urban"
    ],
    "Mythic": [
        "coastal",
        "rural"
    ],
    "Liminal": [
        "urban",
        "smallcity",
        "rural"
    ],
    "Coastal working town": [
        "coastal",
        "island"
    ],
    "Frontier": [
        "rural"
    ],
    "Underground": [
        "urban"
    ],
    "Orbital": [
        "urban"
    ],
    "Weird fiction": [
        "rural",
        "smallcity",
        "coastal"
    ],
    "Industrial river city": [
        "smallcity",
        "urban"
    ],
    "Academic town": [
        "college",
        "smallcity",
        "suburban"
    ],
    "Suburban night": [
        "suburban",
        "lake",
        "smallcity",
        "urban"
    ]
};

export const PRE_ROLL_CHANNELS = [
    {
        key: 'VIBE',
        label: 'VIBE',
        entries: PERSONA_VIBES,
    },
    {
        key: 'WARMTH',
        label: 'WARMTH',
        entries: PERSONA_WARMTHS,
    },
    {
        key: 'MASK TEMPERAMENT',
        label: 'MASK TEMPERAMENT',
        groups: MASK_CELLS,
        entries: [
            'Shy and warm: leaves small kindnesses where they will be found and looks away before they land.',
            'Soft-spoken and eager to please: agrees first, thinks later, hates being the reason plans change.',
            'Shy in a way that reads as rude: answers late, looks at the floor, thaws one to one.',
            'Quiet and watchful: notices everything from the edge of the room and volunteers none of it.',
            'Nervous and clipped: short answers, flinches at raised voices, sharpest in the margins.',
            'Withdrawn and quietly judgmental: watches, decides against you, tells nobody.',
            'Quiet by choice and unexpectedly kind: small acts, no announcement.',
            'Self-contained and gentle: keeps her own weather, gives attention in careful doses.',
            'Flat, unimpressed and literal: answers in facts, not feelings.',
            'Guarded and slow to answer, as if translating from somewhere.',
            'Polite to the point of coldness: scrupulously correct, and it reads as distance.',
            'Dry and hard to offend: one word, half meant.',
            'Steady and welcoming: keeps things moving, makes room without a fuss.',
            'Unfussy and kind: practical favours, plain words, remembers what you needed.',
            'Fussy about small things and careless about big ones.',
            'Practical and even: no performance, no drama, still there at the end.',
            'Blunt and unwelcoming: short answers, no smile, no effort to be liked.',
            'Matter-of-fact and merciless about what is broken; fixes it anyway.',
            'Warm and loud: greets everyone, remembers names, asks the follow-up.',
            'Chatty and curious: will talk to a queue, a dog, and a bouncer.',
            'Brash and funny: says the thing, lands it, buys the next round.',
            'Untidy and carelessly generous with other people\'s lighter fluid and cupboard doors.',
            'Hard to offend and hard to impress: says what the room was thinking, eyes the door.',
            'Sharp-tongued and quick: teasing that lands a little too true, never explains the joke.',
            'Loud, generous and everyone\'s favourite: mid-story before she reaches the table, buys the first round.',
            'Big-hearted show-off: sings, dances, drags the quiet one up.',
            'Noisy and tiring: talks over people, laughs at the wrong moment, impossible to correct.',
            'Restless and impatient: never finishes a drink, stands when other people sit.',
            'Magnetic and exhausting: pulls people in, burns bright, leaves early.',
            'Runs on attention and gives the room a show; cruel only when the room asks.',
        ],
    },
    {
        key: 'FRICTION DIRECTION',
        label: 'FRICTION DIRECTION',
        entries: [
            'She gives generously and cannot stand to be thanked for it.',
            'She asks for exactly what she wants and then apologises for asking.',
            'She is honest to the point of cruelty about other people and dishonest to the point of vanishing about herself.',
            'She needs to be needed and resents every instance of it.',
            'She is braver than she is wise, knows it, and goes anyway.',
            'She treats strangers with real tenderness and her own people with impatience.',
            'She can sit with anyone else\'s bad news and has no shelf for her own.',
            'She is generous with her body and stingy with her attention.',
            'She wants to be chosen and distrusts anyone who chooses her.',
            'She is colder to the people she loves, because they can take it.',
            'She obeys quickly and then does the thing she wanted anyway, later, somewhere else.',
            'She is proud of being hard to shock, and quietly hurt that nobody tests it.',
            'She would rather be useful than right.',
            'She remembers everyone\'s name and forgets what she promised them.',
        ],
    },
    {
        key: 'SETTING',
        label: 'SETTING',
        entries: [
            'A rented room above a laundromat in a coastal town, off-season.',
            'A working farm in the last week of a wet autumn.',
            'A night shift at a motorway diner that never closes.',
            'A small apartment shared with two people she did not choose.',
            'A training barracks in the fortnight before intake ends.',
            'A hotel her father manages, where she is neither guest nor staff.',
            'A river boat yard; everything smells of paint thinner and cold water.',
            'A cathedral town where her family has been known for four generations.',
            'A research station at the end of a very long supply line.',
            'The back room of a bookshop she does not technically work at.',
            'A house half-renovated by somebody who left in the middle of it.',
            'A school she is eleven weeks into and still nobody\'s friend at.',
            'A summer job hauling ice at an amusement park that is failing.',
            'A flat above a veterinary clinic, where the dogs wake her at three.',
        ],
    },
    {
        key: 'FASHION',
        label: 'FASHION',
        entries: [
            'Modern streetwear: skirts and crop tops, comfy panties, anything that shows her body, and she pretends not to notice being looked at.',
            "Cottagecore: linen dresses, cardigans, thick wool socks, soft colors, and clothes that look borrowed from a grandmother's closet.",
            'Athletic: leggings, sports bras, hoodies with the hood up, and clothes that look like she came straight from practice.',
            'Preppy: pleated skirts, polo shirts, tidy blazers, and clothes that look like they cost more than they did.',
            "Goth: black layers, lace, heavy boots, silver rings, and clothes that keep people at arm's length.",
            'Y2K: low-rise jeans, tiny tops, chunky jewelry, and clothes that look like a music video from 2003.',
            'Boho: long skirts, loose cotton, layered jewelry, and clothes that move when she walks.',
            'Grunge: flannel over a band t-shirt, ripped denim, worn boots, and clothes that look like they were picked up off the floor.',
            'Business-casual: blouses, tailored trousers, flats, and clothes that are trying to be taken seriously.',
            'Gymwear worn everywhere: sports leggings, hoodies, sneakers, and clothes that are always ready for a workout that never happens.',
            'Vintage: high-waisted trousers, tucked shirts, leather belts, and clothes that were bought secondhand on purpose.',
            'Loungewear: oversized hoodies, sweatpants, thick socks, and clothes that are a wall with sleeves.',
            'Cheap and cute: fast-fashion dresses, crop tops, chunky platforms, and clothes replaced every season.',
            'Practical and plain: jeans, t-shirts, work boots, and clothes that ask nothing of anyone.',
            'Femme sporty: a fitted track jacket, a crisp tennis skirt, tube socks and retro trainers, and clothes that look like a warm-up she never skips.',
            'Coastal: an open linen shirt over a bikini top, denim cutoffs, and a shell anklet; clothes for a town with one main street.',
            'Soft girl: a cropped cardigan, a pleated pastel skirt, and Mary Janes with little socks, and clothes that are deliberately gentle.',
            'Rave-ready: cargo pants with straps, a mesh top, and platform boots, and clothes built to be seen in the dark.',
            'Cowgirl: denim cutoffs, a plaid shirt tied at the waist, and scuffed boots; clothes for wide open ground.',
            'Skate: an oversized tee, baggy jeans, and flat skate shoes, and clothes she has fallen off in.',
            'Clean girl: a matching knit set, white trainers, and gold hoops; clothes with nothing out of place.',
            'Dark coquette: a black lace corset top, a mini skirt, and ribbon-tied heels, and clothes that are sweet with teeth.',
            'Retro seventies: flared jeans, a crochet halter, and a fringed suede jacket; clothes from a decade she never saw.',
            'Tomboy: a button-down over a white tee, loose trousers, and beat-up trainers, and clothes that ask for no comment.',
            'Chrome and leather: a silver chain top, a leather skirt, and chunky boots; clothes that flash when she moves.',
            'Festival: a crochet top, denim cutoffs, and an armful of bracelets, and clothes with dust already on them.',
            'Indie sleaze: a band tee, a studded belt, and ripped black jeans, and clothes borrowed from a much louder friend.',
            'Tennis-club preppy: a cable-knit vest, a white pleated skirt, and a visor, and clothes that expect a lawn.',
        ],
    },
    {
        key: 'SEXUALITY',
        label: 'SEXUALITY',
        // First entry is untouched default: the prompt resolves it by the card's gender.
        entries: [
            'Default to the gender: Bisexual for a female card, Heterosexual for a male card, Bisexual for non-binary',
            'Bisexual',
            'Heterosexual',
            'Lesbian',
            'Gay',
        ],
    },
    {
        key: 'SOURCE OF EXPERIENCE',
        label: 'SOURCE OF EXPERIENCE',
        groups: {
            "virgin": [
                "Virgin: her own hands and a lot of reading.",
                "Only her own hands, and a very good idea of what she likes.",
                "Virgin: a year of thorough reading and her own hands.",
                "Only ever her own hands, and happy to keep it that way."
            ],
            "some": [
                "Oral sex with one trusted partner, and long enough with them to know what she likes.",
                "Vaginal sex with two boyfriends, all of it asked for.",
                "A summer with one woman, and a lot of firsts she still flinches about.",
                "Vaginal sex and oral (receiving), always after asking."
            ],
            "experienced": [
                "Oral sex (giving and receiving), vaginal sex, and a few one-night stands.",
                "Oral sex both ways, vaginal sex, and a threesome with two men.",
                "Anal sex, oral both ways, and rope.",
                "Oral sex with women and men, vaginal sex, and a summer she only half remembers."
            ],
            "hedonist": [
                "Sleeps around: oral, vaginal, toys, light bondage.",
                "Vaginal sex with several people, oral both ways, and group sex.",
                "Toys, bondage, exhibitionism, oral both ways, and a lot of partners.",
                "Oral sex with men and women, vaginal and anal sex, and a rotating cast of partners."
            ]
        },
        orientationTags: {
            "Vaginal sex with two boyfriends, all of it asked for.": "m",
            "A summer with one woman, and a lot of firsts she still flinches about.": "w",
            "Oral sex both ways, vaginal sex, and a threesome with two men.": "m",
            "Oral sex with women and men, vaginal sex, and a summer she only half remembers.": "b",
            "Oral sex with men and women, vaginal and anal sex, and a rotating cast of partners.": "b"
        },
        entries: [
            'Virgin: her own hands and a lot of reading.',
            'Only her own hands, and a very good idea of what she likes.',
            'Virgin: a year of thorough reading and her own hands.',
            'Only ever her own hands, and happy to keep it that way.',
            'Oral sex with one trusted partner, and long enough with them to know what she likes.',
            'Vaginal sex with two boyfriends, all of it asked for.',
            'A summer with one woman, and a lot of firsts she still flinches about.',
            'Vaginal sex and oral (receiving), always after asking.',
            'Oral sex (giving and receiving), vaginal sex, and a few one-night stands.',
            'Oral sex both ways, vaginal sex, and a threesome with two men.',
            'Anal sex, oral both ways, and rope.',
            'Oral sex with women and men, vaginal sex, and a summer she only half remembers.',
            'Sleeps around: oral, vaginal, toys, light bondage.',
            'Vaginal sex with several people, oral both ways, and group sex.',
            'Toys, bondage, exhibitionism, oral both ways, and a lot of partners.',
            'Oral sex with men and women, vaginal and anal sex, and a rotating cast of partners.',
        ],
    },
    {
        key: 'MOTIF',
        label: 'MOTIF',
        entries: [
            'Keys worn on a shoelace.',
            'The smell of hot metal, solder and rust.',
            'A chipped mug she will not replace.',
            'Hands scrubbed raw and the sound of a tap left running.',
            'A song she only plays when nobody is home.',
            'The weight of a coat she never takes off indoors.',
            'Counting things without meaning to: stairs, coins, breaths.',
            'A scar on the inside of a forearm and the story attached to it.',
            'Hair tied up and taken down again and again in the middle of a conversation.',
            'The noise of a door that does not latch.',
            'A photograph she keeps face down.',
            'Cheap coffee and the ritual she has built around it.',
        ],
    },
    {
        key: 'PRIMARY KINK',
        label: 'PRIMARY KINK',
        entries: [
            'Gangbangs — being shared with several people at once makes her feel wanted.',
            'Spanking — pain she can point to afterwards, like a trophy.',
            "Breeding — being filled and marked as somebody else's.",
            'Exhibitionism — the risk of being seen is most of the thrill.',
            'Breathplay — a hand at her throat until the room goes quiet.',
            'Bondage — rope or cuffs, and no vote in what happens next.',
            'Praise — being told she is good at it, in detail.',
            'Food play — syrup and cream on her tits and cunt, and being left messy.',
            'Sensory deprivation — a blindfold, and nothing to do but feel.',
            'Public play — a hand under the table, a quiet corner, someone almost noticing.',
            'Oral fixation — something in her mouth whenever she can get it.',
            "Being owned — a collar, a claim, one person's word over hers.",
            'Rough handling — hair pulled, hips gripped, bruises in the morning.',
            'Impact play — a belt or a paddle, and marks she can press on the next day.',
        ],
    },
];

// Characters and worlds converge for the same reason personas did: one image, one prompt, and no
// knowledge of what the rest of the batch already took. These are the same kind of channel sets, one
// for each generator. Unlike the persona channels they may describe behaviour, because {{char}} is
// played by the model, not by the user.

export const CHARACTER_CHANNELS = [
    {
        key: 'THEME',
        label: 'CHARACTER THEME',
        entries: CHARACTER_THEMES.map(theme => theme.text),
    },
    {
        key: 'STATION',
        label: 'STATION',
        entries: [
            'Night baker on a failing high street: in at two, out by ten, sleeps through the afternoon.',
            'Ambulance dispatcher on the graveyard shift, six years in, no plans to move.',
            'Groundskeeper at a private school that pays badly and pretends otherwise.',
            'Wedding photographer, bankrupt twice, booking again.',
            'Diesel mechanic, the only woman in the shop, keeps her tools locked.',
            'Line cook in a casino kitchen, fastest hands on the pass, worst temper.',
            'Junior partner in a family law firm she will inherit whether she wants it or not.',
            'Ferry deckhand, four days on, three days off, lives for the three.',
            'Librarian in a town that funds everything else first.',
            'Barber in her father\'s shop, keeping the chair warm while he recovers.',
            'Warehouse supervisor on nights, schedules everyone\'s breaks but never her own.',
            'Phone repair kiosk in a mall, half the town\'s secrets on her bench.',
        ],
    },
    {
        key: 'WANT',
        label: 'WANT',
        entries: [
            'Wants the shop lease in her own name before the owner sells the building.',
            'Wants to finish the course she abandoned twice, and has told nobody she re-enrolled.',
            'Wants custody of a younger sibling from a mother who is not unfit, just tired.',
            'Wants to pay off a debt she took on for someone else before she tells them it exists.',
            'Wants to be the one who notices things first: not power, precedence.',
            'Wants a rival out of her trade, fairly, which may not be possible.',
            'Wants to stop being the one who fixes everything and has not worked out how.',
            'Wants four months of the year somewhere else, and is afraid of the quiet.',
            'Wants her father to admit he was wrong once, about one thing, before he dies.',
            'Wants the new house to feel like hers, which is different from being hers.',
            'Wants to be promoted over a friend, and knows exactly what that will cost.',
            'Wants to hear her own name said by someone who is not asking her for anything.',
        ],
    },
    {
        key: 'SECRET',
        label: 'SECRET',
        entries: [
            'Tells everyone she moved here for the job; she moved to get away from a friend who stopped speaking to her, and does not know why.',
            'Has been quietly paying a bill in her ex\'s name since the break-up, and would rather die than admit it.',
            'Saw something at work last winter and signed the report that said otherwise.',
            'Keeps her mother\'s diagnosis to herself, so nobody treats her differently yet.',
            'Told her sister she would not take the money. She took it.',
            'Was the one who walked away first, and has let everyone believe it was the other way round.',
            'Writes every conversation down, word for word, and mentions it to nobody.',
            'Has never told anyone what she wants to be, because she is waiting to be sure.',
            'Still keeps a spare key to a house she has no right to any more.',
            'Knows the marriage everyone admires is over, and has not told her friend.',
            'Fails a thing at work regularly and has got very good at fixing it before anyone sees.',
            'Turned down a different life seven years ago and revisits it at night.',
        ],
    },
    {
        key: 'VOICE',
        label: 'VOICE',
        entries: [
            'Clipped and polite: drops the "please" when she is angry and never repeats a question.',
            'Warm, fast and self-interrupting: fine detail, no overview, three starts per sentence.',
            'Unhurried and exact: answers the literal question, jokes land later, deadpan.',
            'Talks like she is explaining something to a child she likes, without condescension.',
            'Customer-service patter that switches off the moment the customer leaves.',
            'Says "we" when she means "I", which is how she gets people on her side.',
            'Says the hard thing plainly and changes the subject before there is a reply.',
            'Over-elaborates with technical words when nervous; goes quiet when furious.',
            'Answers quietly, always with a question back, always two steps from leaving.',
            'Fast and funny and fluent in the local slang, and never uses it when she is serious.',
            'Short sentences, formal courtesy, profanity rare and devastating.',
            'Narrates her own actions out loud when uncomfortable: "and now she is putting the kettle on."',
        ],
    },
    {
        key: 'TROUBLE',
        label: 'TROUBLE',
        entries: [
            'She is paid to be pleasant, and the pleasantness goes off duty with the clock.',
            'She arranges her life to need nobody, and finds other people\'s needs an imposition.',
            'She tells you the truth immediately, which is not the same as being open.',
            'She is the one who leaves first, every time, and calls it being sensible.',
            'She cannot accept a favour without paying it back twice.',
            'She gets bored of being needed the moment it becomes a habit.',
            'Her loyalty is real, her judgement is absolute, and she will not discuss it.',
            'She wants the last word, and cannot bear the silence after she has it.',
            'She is generous with things and stingy with time.',
            'She rescues people from their problems and will not let them be angry about it.',
        ],
    },
    {
        key: 'HISTORY',
        label: 'HISTORY',
        entries: [
            'Grew up in a shared house with a rotating cast of lodgers and learned to lock her bedroom door.',
            'Left school at sixteen and has been catching up quietly, in libraries, ever since.',
            'Spent three years on a fishing boat; the money was worse than the smell and she loved it.',
            'Was the middle child who mediated everything and was never asked anything.',
            'Her first job was mopping the floors of the place she now manages.',
            'Married once for eleven months at twenty-three, and does not talk about it.',
            'Looked after her mother for six years and nobody thanked her, because it is invisible.',
            'Grew up two streets from here; the people who knew her then still use her childhood name.',
            'Moved eleven times before she was eighteen; now she stays in jobs for years and rooms for months.',
            'Was the clever one in the family, and is the one who stayed.',
            'The first money she ever saved went on a car she has never learned to drive properly.',
            'Was in a band that got close enough to feel it, then broke up in an argument she still replays.',
        ],
    },
    {
        key: 'APPETITE',
        label: 'APPETITE',
        entries: [
            'Oral fixation: craves a cock or a clit in her mouth and the taste of it, and the ache in her jaw after.',
            'Praise: wants to be called good and told she takes it well, because the words are proof she did it right.',
            'Being owned: a collar, a claim, one person\'s word over hers, and the weight of deciding lifted.',
            'Bondage: wrists tied, ankles tied, and no vote in what happens next.',
            'Exhibitionism: being watched while she does it, and not allowed to look away.',
            'Rough handling: hair pulled, hips grabbed, marks she can press the next morning.',
            'Breeding: filled and left leaking, marked as somebody\'s for the night.',
            'Spanking: pain she can point to the next day, like a receipt.',
            'Sensory deprivation: a blindfold, and nothing to do but feel what arrives.',
            'Gangbangs: being shared, several people at once, wanted by all of them.',
            'Breathplay: a hand at her throat until the room goes quiet.',
            'Hair-pulling: a fist in it, head back, throat exposed.',
        ],
    },
    {
        key: 'SEXUALITY',
        label: 'SEXUALITY',
        entries: [
            'Default to the gender: Bisexual for a female card, Heterosexual for a male card, Bisexual for non-binary',
            'Bisexual',
            'Heterosexual',
            'Lesbian',
            'Gay',
        ],
    },
    {
        key: 'EXPERIENCE',
        label: 'EXPERIENCE',
        // Older drafts wrote this channel as LIMITS; the parser still reads that label.
        aliases: ['LIMITS'],
        groups: {
            "virgin": [
                "Virgin: her own hands and a lot of reading.",
                "Only her own hands, and a very good idea of what she likes.",
                "Virgin: a year of thorough reading and her own hands.",
                "Only ever her own hands, and happy to keep it that way."
            ],
            "some": [
                "Oral sex with one trusted partner, and long enough with them to know what she likes.",
                "Vaginal sex with two boyfriends, all of it asked for.",
                "A summer with one woman, and a lot of firsts she still flinches about.",
                "Vaginal sex and oral (receiving), always after asking."
            ],
            "experienced": [
                "Oral sex (giving and receiving), vaginal sex, and a few one-night stands.",
                "Oral sex both ways, vaginal sex, and a threesome with two men.",
                "Anal sex, oral both ways, and rope.",
                "Oral sex with women and men, vaginal sex, and a summer she only half remembers."
            ],
            "hedonist": [
                "Sleeps around: oral, vaginal, toys, light bondage.",
                "Vaginal sex with several people, oral both ways, and group sex.",
                "Toys, bondage, exhibitionism, oral both ways, and a lot of partners.",
                "Oral sex with men and women, vaginal and anal sex, and a rotating cast of partners."
            ]
        },
        orientationTags: {
            "Vaginal sex with two boyfriends, all of it asked for.": "m",
            "A summer with one woman, and a lot of firsts she still flinches about.": "w",
            "Oral sex both ways, vaginal sex, and a threesome with two men.": "m",
            "Oral sex with women and men, vaginal sex, and a summer she only half remembers.": "b",
            "Oral sex with men and women, vaginal and anal sex, and a rotating cast of partners.": "b"
        },
        entries: [
            'Virgin: her own hands and a lot of reading.',
            'Only her own hands, and a very good idea of what she likes.',
            'Virgin: a year of thorough reading and her own hands.',
            'Only ever her own hands, and happy to keep it that way.',
            'Oral sex with one trusted partner, and long enough with them to know what she likes.',
            'Vaginal sex with two boyfriends, all of it asked for.',
            'A summer with one woman, and a lot of firsts she still flinches about.',
            'Vaginal sex and oral (receiving), always after asking.',
            'Oral sex (giving and receiving), vaginal sex, and a few one-night stands.',
            'Oral sex both ways, vaginal sex, and a threesome with two men.',
            'Anal sex, oral both ways, and rope.',
            'Oral sex with women and men, vaginal sex, and a summer she only half remembers.',
            'Sleeps around: oral, vaginal, toys, light bondage.',
            'Vaginal sex with several people, oral both ways, and group sex.',
            'Toys, bondage, exhibitionism, oral both ways, and a lot of partners.',
            'Oral sex with men and women, vaginal and anal sex, and a rotating cast of partners.',
        ],
    },
];

export const WORLD_CHANNELS = [
    {
        key: 'THEME',
        label: 'WORLD THEME',
        entries: WORLD_THEMES.map(theme => theme.text),
    },
    {
        key: 'SCALE',
        label: 'SCALE',
        // Population band. The theme narrows it; the notes outrank both.
        entries: [
            'A village under a thousand people.',
            'A town of a few thousand.',
            'A small city of sixty thousand.',
            'A metro suburb of forty-five thousand with a big high school.',
            'A city neighbourhood in a metro of half a million.',
        ],
    },
    {
        key: 'PLACE',
        label: 'PLACE',
        // Kind lets the theme narrow the place pool; the notes still outrank both.
        kinds: {
            "A harbour town where the fishing quota was cut this spring.": "coastal",
            "A commuter suburb where every house is being renovated and nobody knows the neighbours.": "suburban",
            "A university town in the middle of a building scandal.": "college",
            "A border town with two currencies and one working road.": "rural",
            "A desert motel town forty minutes from the nearest supermarket.": "rural",
            "A cold-water island with one ferry a day and a school for every age.": "island",
            "A city district under a compulsory-purchase order; half the shops are empty.": "urban",
            "A logging town in the last year before the mill shuts.": "rural",
            "A canal town where the locks are being automated.": "rural",
            "A mountain village with a new ski lift and old money.": "mountain",
            "A railway junction, five hours from anywhere, where the trains still stop.": "rural",
            "A river town rebuilding after the second flood in two years.": "smallcity",
            "A suburb of cul-de-sacs, a strip mall and a high school with a new astroturf field.": "suburban",
            "A lake town in the last week of summer: rented pontoons, a party cove, seasonal money.": "lake",
            "A small city north side: one high school, a diner, a bowling alley, a bus that runs late.": "smallcity",
            "An apartment complex at the edge of a college town, half students and half families.": "college",
            "A sun-belt suburb of new builds, irrigation warnings and a school run at seven.": "suburban",
            "A rust-belt town where the plant is still open, just smaller than it was.": "smallcity",
            "A coastal tourist town in high season: boardwalk, seasonal staff, locals priced out.": "coastal",
            "A city neighbourhood with a high school, a corner shop and a transit stop.": "urban",
            "A mountain resort town with two schools on one campus and staff housing behind the hotel.": "mountain",
            "A rural county seat with a courthouse square and a Walmart twenty minutes out.": "rural",
            "A metro suburb of forty-five thousand with three high schools, a mall and a commuter lot.": "suburban",
            "A gated subdivision beside a six-lane road, with a business park where an orchard used to be.": "suburban",
            "A suburb of shrunken lawns and new driveways, with a chain coffee place where the video shop was.": "suburban",
            "A small city of ninety thousand with a downtown strip, a community college and a party district.": "smallcity",
            "A city neighbourhood where the high school lets out onto six lanes and a bus shelter.": "urban"
        },
        entries: [
            'A harbour town where the fishing quota was cut this spring.',
            'A commuter suburb where every house is being renovated and nobody knows the neighbours.',
            'A university town in the middle of a building scandal.',
            'A border town with two currencies and one working road.',
            'A desert motel town forty minutes from the nearest supermarket.',
            'A cold-water island with one ferry a day and a school for every age.',
            'A city district under a compulsory-purchase order; half the shops are empty.',
            'A logging town in the last year before the mill shuts.',
            'A canal town where the locks are being automated.',
            'A mountain village with a new ski lift and old money.',
            'A railway junction, five hours from anywhere, where the trains still stop.',
            'A river town rebuilding after the second flood in two years.',
            'A suburb of cul-de-sacs, a strip mall and a high school with a new astroturf field.',
            'A lake town in the last week of summer: rented pontoons, a party cove, seasonal money.',
            'A small city north side: one high school, a diner, a bowling alley, a bus that runs late.',
            'An apartment complex at the edge of a college town, half students and half families.',
            'A sun-belt suburb of new builds, irrigation warnings and a school run at seven.',
            'A rust-belt town where the plant is still open, just smaller than it was.',
            'A coastal tourist town in high season: boardwalk, seasonal staff, locals priced out.',
            'A city neighbourhood with a high school, a corner shop and a transit stop.',
            'A mountain resort town with two schools on one campus and staff housing behind the hotel.',
            'A rural county seat with a courthouse square and a Walmart twenty minutes out.',
            'A metro suburb of forty-five thousand with three high schools, a mall and a commuter lot.',
            'A gated subdivision beside a six-lane road, with a business park where an orchard used to be.',
            'A suburb of shrunken lawns and new driveways, with a chain coffee place where the video shop was.',
            'A small city of ninety thousand with a downtown strip, a community college and a party district.',
            'A city neighbourhood where the high school lets out onto six lanes and a bus shelter.',
        ],
    },
    {
        key: 'PRESSURE',
        label: 'PRESSURE',
        entries: [
            'The biggest employer announced a consultation everyone knows the answer to.',
            'Rent rose for the whole street in the same month and nobody knows who bought the buildings.',
            'A council vote next week decides whether the market stays or becomes a car park.',
            'Wages are four weeks late and the payroll clerk has stopped answering.',
            'Two families have fallen out over a boundary nobody can find on a map.',
            'The tourist season starts in nine days and half the seasonal staff have not come back.',
            'A water bill for the whole block was paid to the wrong account and the taps are still on.',
            'The school is being merged with one six miles away.',
            'A public health notice about the water was withdrawn without explanation.',
            'The old manager died in spring and nobody was ever officially put in charge.',
            'The highway will bypass the town in two years and everyone talks about nothing else.',
            'The only pharmacy is closing on Fridays from next month.',
        ],
    },
    {
        key: 'POWER',
        label: 'POWER',
        entries: [
            'A mayor elected on promises and a dock boss who actually decides.',
            'The council is elected and the developer has been seen buying the coffee.',
            'A police chief who is reasonable, tired, and knows exactly how much he can afford to notice.',
            'The parish priest holds the food bank, the hall and the only quiet room.',
            'The family that owns the mill also owns the paper and the bus company.',
            'A tenants\' association of three people doing the work of forty.',
            'The clinic is understaffed and the nurse practitioner has become the local authority.',
            'A contractor controls every job site in a ninety-mile radius.',
            'The gang is small and well-mannered, and the police visit it rather than the other way round.',
            'The union branch holds the vote but its chair answers to his brother-in-law.',
            'The head teacher has more real power in town than the council.',
            'Nobody is in charge: the postmaster, the priest and the librarian quietly do the governing.',
        ],
    },
    {
        key: 'TEXTURE',
        label: 'TEXTURE',
        entries: [
            'Radio and landlines; nobody has a mobile phone, and people agree to meet at a place, at a time.',
            'Salt, diesel and hot tar, and everything metal rusting from the inside.',
            'Cars with manual windows and cassette decks, and a lot of driving.',
            'Snow four months of the year, and the shops sell boots rather than shoes.',
            'Cheap plastic signs, sodium lights, a fried-food smell that never lifts.',
            'Paper everywhere: forms, ledgers, carbon copies, rubber stamps.',
            'The street smells of yeast and bread from two o\'clock onwards.',
            'Everything is a ten-minute walk and everyone knows whose dog is barking.',
            'Soft mountains behind the town and no streetlights past the last house.',
            'The technology works, but the weather interferes with it four days in ten.',
            'Old money made of wood and brass, and new money made of chrome and impatience.',
            'A single radio station, a single newspaper, and both of them careful.',
            'Phones in every hand, group chats faster than the adults, and one bar of signal at the school.',
            'Iced coffee cups, hair straighteners, a speaker in a tote bag, and a charger everyone borrows.',
            'A gas station neon glow and the blue light of a phone screen; everything else is dark.',
            'Bus timetables, lifts from parents, and somebody always asking for a ride.',
            'New builds with no fences yet, and a show home nobody has moved into.',
        ],
    },
    {
        key: 'SEASON',
        label: 'SEASON',
        entries: [
            'The last week of summer; the fair opens on Friday.',
            'The fortnight before the frost, when everyone is harvesting and nobody sleeps.',
            'The tail of a mild winter with no snow and a lot of mud.',
            'The first week of school, four hundred children and one bus.',
            'The middle of a dry autumn: burn warnings in the fields and dust in the shop windows.',
            'The week after a wedding the whole town attended and half of them are still angry about.',
            'Election week, and every third conversation is about it.',
            'Three days before Christmas, and the last ferry has already gone.',
            'The night of the summer festival, when the town doubles in size for six hours.',
            'A funeral tomorrow, and the whole street has rearranged its schedule for it.',
            'The first week of the fishing season, boats going out before dawn.',
            'Late autumn, wind off the water, and the first shop has already put up tinsel.',
        ],
    },
    {
        key: 'OPENING',
        label: 'OPENING',
        entries: [
            'A wake for someone the town knew and nobody liked, at the back of the pub.',
            'A job left unstaffed for six weeks, and the person everyone suspects of quitting.',
            'A stranger at the bar asking where the swimming spot is, in a town with one.',
            'A shared shift with a person who will not stop talking and a person who will not talk at all.',
            'A shelf of unclaimed lost property and a search for an item that matters more than it should.',
            'A late-night doorbell ring, then nobody there, and then it rings again.',
            'A bus that does not arrive, a crowd that waits, and the small talk that happens while it does not.',
            'A mutual friend\'s spare room and a sofa for the night, with rules nobody has written down.',
            'A queue for rationed fuel where everyone has to talk to whoever is next to them.',
            'A rehearsal for something the persona has been talked into taking part in.',
            'A bad day in a quiet week, and a knock about a small thing that is not small.',
            'A power cut that leaves the same faces in the same doorway for twenty minutes.',
            'The first warm evening of the year, and the whole street outside at once.',
            'A text that says come over, with no explanation and no time.',
            'The last hour of a shift, and the person closing up with her.',
            'A town event being set up badly, and somebody asking for a second pair of hands.',
        ],
    },
];

/** Small deterministic PRNG (mulberry32), so a seed reproduces a roll exactly. */
function makeRandom(seed) {
    let state = (Number(seed) || 1) >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** The channel set each generator draws from. Personas are the default, for older callers. */
const CHANNEL_SETS = {
    persona: PRE_ROLL_CHANNELS,
    character: CHARACTER_CHANNELS,
    world: WORLD_CHANNELS,
};

/**
 * Closing instruction for each set. The persona footer is persona-specific on purpose: the block is
 * the only place that says what the channels are *for*, and a generic footer was ignored.
 */
const SET_FOOTERS = {
    persona: `Write the persona so that MASK TEMPERAMENT and FRICTION DIRECTION are true of the same person at the
same time, and let the MASK TEMPERAMENT be visible in the Personality traits. VIBE is the energy the
MASK was drawn from and WARMTH is how she handles people; together they set the register, so let
them show in FRICTION and MOTIF too. SEXUALITY is the orientation unless it says "default to the
gender", which means Bisexual for a female card and Heterosexual for a male card. Let the MOTIF recur
as concrete sensory detail. Age, body, skin and hair come from the image; clothes come from FASHION,
not from the image; every channel the details leave open comes from here.

When the user's details describe a kind of person or a scene, they win: drop the rolled MASK
TEMPERAMENT and FASHION when the details answer them, and bend a channel only where the details tint
it. "Sociable party girls" must not come back quiet and reserved because MASK TEMPERAMENT rolled
that way.

Go through these channels before writing. Any channel the user's details already answer is settled:
follow the details and ignore the rolled value for that channel, because the details cover it. Where
the details only tint a channel, bend the rolled value. A channel the details leave open is used as
rolled.`,
    character: `Build one person in whom STATION, WANT, SECRET, TROUBLE and HISTORY are all true at once. Let
the VOICE shape every line of dialogue, let the APPETITE, SEXUALITY and EXPERIENCE become the sexual profile (sexuality resolves the
block's default by the card's gender), and give the WANT a life outside {{user}}. Appearance comes from the image; every channel the details leave
open comes from here.

CHARACTER THEME is atmosphere, not costume: let it colour the station, the room, the prose and the
props, and never name it as a genre label in the card. When the user's details describe a kind of person or a
scene, they win: drop the rolled CHARACTER THEME, STATION, VOICE and TROUBLE when the details answer them, and
bend a channel only where the details tint it.

Go through these channels before writing. Any channel the user's details already answer is settled:
follow the details and ignore the rolled value for that channel. Where they only tint a channel, bend
it to fit. A channel the details leave open is used as rolled.`,
    world: `Build the world out of WORLD THEME, PLACE, PRESSURE, POWER, TEXTURE, SEASON and OPENING. WORLD THEME is the
physical and social atmosphere — light, materials, sound, money, weather — not a genre sticker, and
it must show in the entries rather than be announced. The persona's card is how
they experience this world, not a specification for what the world contains or what people know about
them: nobody in this world has read their card.`,
};

/** Channels for a generator type. Unknown types fall back to personas. */
export function channelsFor(type) {
    return CHANNEL_SETS[type] || PRE_ROLL_CHANNELS;
}

/**
 * Draws one value per channel.
 *
 * `avoid` lets a caller push the draw away from values already used in the batch it is filling:
 * pass an object keyed by channel whose values are collections of previously used entries. Channels
 * are drawn from the unused remainder while it lasts, so a short batch picks distinct values.
 *
 * @param {object} [options]
 * @param {number} [options.seed] Makes the draw reproducible.
 * @param {Record<string, string[]|Set<string>>} [options.avoid] Previously used entries per channel.
 * @param {'persona'|'character'|'world'} [options.type] Which channel set to draw from.
 * @param {Record<string, string>} [options.steer] VIBE, WARMTH, SEXUALITY and SOURCE picks. Vibe and warmth
 * narrow the mask cell; sexuality settles before experience so incompatible acts are filtered out.
 * @returns {{seed: number, values: Record<string, string>}}
 */
export function rollPreRoll({ seed = Date.now(), avoid = {}, type = 'persona', steer = {} } = {}) {
    const random = makeRandom(seed);
    const values = {};
    for (const channel of channelsFor(type)) {
        const pick = (pool) => {
            const used = new Set(avoid[channel.key] || []);
            const unused = pool.filter(entry => !used.has(entry));
            const from = unused.length ? unused : pool;
            return from[Math.floor(random() * from.length)];
        };
        const wanted = String(steer[channel.key] || '').toLowerCase();

        // Themes and any future exact-entry steer force the channel before any pooling.
        const exact = channel.entries.find(entry => entry === steer[channel.key]);
        if (exact) {
            values[channel.key] = exact;
            continue;
        }
        if (channel.key === 'VIBE' || channel.key === 'WARMTH') {
            values[channel.key] = channel.entries.find(entry => entry.toLowerCase() === wanted) || pick(channel.entries);
            continue;
        }
        if (channel.key === 'SEXUALITY') {
            values[channel.key] = channel.entries.find(entry => entry === steer.SEXUALITY) || channel.entries[0];
            continue;
        }
        if (channel.key === 'MASK TEMPERAMENT' && (steer.VIBE || steer.WARMTH)) {
            const vibe = String(steer.VIBE || '').toLowerCase();
            const warmth = String(steer.WARMTH || '').toLowerCase();
            const keys = Object.keys(channel.groups || {}).filter(key =>
                (!vibe || key.startsWith(vibe + '/')) && (!warmth || key.endsWith('/' + warmth)));
            if (keys.length) {
                values[channel.key] = pick(keys.flatMap(key => channel.groups[key]));
                continue;
            }
        }
        const themeLabel = WORLD_THEMES.find(theme => theme.text === values.THEME)?.label;
        if (channel.key === 'SCALE' && THEME_SCALES[themeLabel]) {
            const allowed = THEME_SCALES[themeLabel];
            const fitting = channel.entries.filter((entry, index) => allowed.includes(index));
            values[channel.key] = pick(fitting.length ? fitting : channel.entries);
            continue;
        }
        if (channel.key === 'PLACE' && channel.kinds && THEME_PLACE_KINDS[themeLabel]) {
            const allowed = THEME_PLACE_KINDS[themeLabel];
            const fitting = channel.entries.filter(entry => allowed.includes(channel.kinds[entry]));
            if (fitting.length) values[channel.key] = pick(fitting);
            else values[channel.key] = pick(channel.entries);
            continue;
        }
        if (channel.key === 'SOURCE OF EXPERIENCE' || channel.key === 'EXPERIENCE') {
            const group = channel.groups?.[steer.SOURCE];
            if (group) {
                const orientation = values.SEXUALITY;
                const likely = (entry) => {
                    const tag = channel.orientationTags?.[entry];
                    if (!tag || !orientation || orientation.startsWith('Default')) return true;
                    if (tag === 'b') return true;
                    if (orientation === 'Lesbian') return tag !== 'm';
                    if (orientation === 'Gay') return tag !== 'w';
                    return true;
                };
                const compatible = group.filter(likely);
                values[channel.key] = pick(compatible.length ? compatible : group);
                continue;
            }
        }
        values[channel.key] = pick(channel.entries);
    }
    return { seed: Number(seed), values };
}

/** Renders a roll as the defaults block the matching prompt expects above itself. */
export function formatPreRoll(values, type = 'persona') {
    if (!values) return '';
    const lines = channelsFor(type)
        .filter(channel => values[channel.key])
        .map(channel => `${channel.label}: ${values[channel.key]}`);
    if (!lines.length) return '';
    return `PRE-ROLLED FOR THIS SESSION (defaults only: the user's details win every conflict and settle any channel they answer)
${lines.join('\n')}

${SET_FOOTERS[type] || SET_FOOTERS.persona}

If the user's details already answer a channel, that channel is settled: follow the details and
ignore the rolled value for it, because the details cover the channel. If they only tint it, bend the
value to fit. A channel the details leave open is used as rolled.`;
}

/**
 * Reads a block back into channel values, so an edited block in the editor round-trips. Parses across
 * every set: the labels are distinct, so one function serves the persona, character and world editors.
 * @param {string} text
 * @returns {Record<string, string>|null}
 */
export function parsePreRoll(text) {
    const values = {};
    const all = [...PRE_ROLL_CHANNELS, ...CHARACTER_CHANNELS, ...WORLD_CHANNELS];
    for (const line of String(text || '').split('\n')) {
        for (const channel of all) {
            const labels = [channel.label, ...(channel.aliases || [])];
            const hit = labels.find(label => line.startsWith(label + ': '));
            if (hit) values[channel.key] = line.slice(hit.length + 2).trim();
        }
    }
    return Object.keys(values).length ? values : null;
}
