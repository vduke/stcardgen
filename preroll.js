// Pre-rolled session values for persona generation.
//
// The failure mode this exists to fix: batch generation converges. Every run sees the same image,
// the same prompt and nothing else, so it reaches for the same character — sunny surface, dark
// secret, "being watched" — and the batch comes out looking like one person repeated. Instructions
// to "be more varied" do not help much, because the model has no way to know what the other runs
// already took.
//
// So the variety is decided before the model sees the request: one value per non-appearance channel
// is drawn here, injected above the prompt as a binding block, and kept with the draft so
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
export const PRE_ROLL_CHANNELS = [
    {
        key: 'MASK TEMPERAMENT',
        label: 'MASK TEMPERAMENT',
        entries: [
            'Blunt and unwelcoming: short answers, no smile, no effort to be liked.',
            'Noisy and tiring: talks over people, laughs at the wrong moment, impossible to correct.',
            'Polite to the point of coldness: scrupulously correct, and it reads as distance.',
            'Untidy and casually careless with other people\'s belongings: eats standing up, leaves every cupboard open, loses their lighters.',
            'Eager, clumsy and over-sharing: three sentences into a story before she knows where it is going.',
            'Flat, unimpressed and literal: answers in facts, not feelings.',
            'Deliberately charming, and it works, and it costs her something.',
            'Unsocial rather than shy: quiet because she is not trying to be liked.',
            'Fussy about small things and careless about big ones.',
            'Hard to offend and hard to impress.',
            'Anxious and over-compensating: performs competence she does not feel, badly, and everyone lets her.',
            'Sweet and disarming on purpose, and she knows it and uses it.',
            'Restless and impatient: never finishes a drink, stands when other people sit.',
            'Guarded and slow to answer, as if translating from somewhere.',
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
        ],
    },
    {
        key: 'SOURCE OF EXPERIENCE',
        label: 'SOURCE OF EXPERIENCE',
        entries: [
            'Oral sex (giving and receiving), vaginal sex, a few one-night stands, no anal.',
            'Vaginal sex with two boyfriends, oral both ways, nothing else yet.',
            'Virgin: nothing but her own hands and a lot of reading.',
            'Oral sex both ways, vaginal sex, a threesome, anal once and not again.',
            'Vaginal sex, no oral, no anal, and she does not finish with a partner.',
            'Oral sex (giving), handjobs, vaginal sex twice, anal virgin.',
            'Sleeps around: oral, vaginal, toys, light bondage, no anal yet.',
            'Vaginal sex, oral (receiving), nothing she has not asked for twice.',
            'Anal sex, oral both ways, bondage, no penetration without it being decided for her.',
            'Vaginal sex, oral both ways, she has never let anyone watch.',
            'Nothing with a partner yet, but she knows her own body well.',
            'Vaginal sex with several people, oral (giving), one night of anal she still thinks about.',

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
        key: 'LIMITS',
        label: 'LIMITS',
        entries: [
            'Oral sex (giving and receiving), vaginal sex, a few one-night stands, no anal.',
            'Virgin: nothing but her own hands and a lot of reading.',
            'Vaginal sex with two long-term partners, oral both ways, nothing since.',
            'Sleeps around: oral, vaginal, toys, light bondage, no anal yet.',
            'Anal sex, oral both ways, bondage, no penetration without it being decided for her.',
            'Vaginal sex, no oral, no anal, and she does not finish with a partner.',
            'Oral sex both ways, vaginal sex, a threesome, anal once and not again.',
            'Vaginal sex, oral (receiving), nothing she has not asked for twice.',
            'Oral sex (giving), handjobs, vaginal sex twice, anal virgin.',
            'Vaginal sex with several people, oral (giving), one night of anal she still thinks about.',
            'Nothing with a partner yet, but she knows her own body well.',
            'Vaginal sex, oral both ways, she has never let anyone watch.',
        ],
    },
];

export const WORLD_CHANNELS = [
    {
        key: 'PLACE',
        label: 'PLACE',
        entries: [
            'A harbour town where the fishing quota was cut this spring.',
            'A commuter suburb where every house is being renovated and nobody knows the neighbours.',
            'A university town in the middle of a building scandal.',
            'A border town with two currencies and one working road.',
            'A desert motel town forty minutes from the nearest supermarket.',
            'A cold-water island with one ferry a day and a school that closed last year.',
            'A city district under a compulsory-purchase order; half the shops are empty.',
            'A logging town in the last year before the mill shuts.',
            'A canal town where the locks are being automated.',
            'A mountain village with a new ski lift and old money.',
            'A railway junction, five hours from anywhere, where the trains still stop.',
            'A river town rebuilding after the second flood in two years.',
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
same time, and let the MASK TEMPERAMENT be visible in the Personality traits. Let the MOTIF recur as concrete sensory detail. Age, body, skin and hair come from the
image; clothes come from FASHION and not from the image; everything else here comes from here.`,
    character: `Build one person in whom STATION, WANT, SECRET, TROUBLE and HISTORY are all true at once. Let
the VOICE shape every line of dialogue, let the APPETITE and LIMITS become the sexual profile, and give
the WANT a life outside {{user}}. Appearance comes from the image; everything else comes from here.`,
    world: `Build the world out of PLACE, PRESSURE, POWER, TEXTURE, SEASON and OPENING. The persona's card is how
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
 * @returns {{seed: number, values: Record<string, string>}}
 */
export function rollPreRoll({ seed = Date.now(), avoid = {}, type = 'persona' } = {}) {
    const random = makeRandom(seed);
    const values = {};
    for (const channel of channelsFor(type)) {
        const used = new Set(avoid[channel.key] || []);
        const unused = channel.entries.filter(entry => !used.has(entry));
        const pool = unused.length ? unused : channel.entries;
        values[channel.key] = pool[Math.floor(random() * pool.length)];
    }
    return { seed: Number(seed), values };
}

/** Renders a roll as the binding block the matching prompt expects above itself. */
export function formatPreRoll(values, type = 'persona') {
    if (!values) return '';
    const lines = channelsFor(type)
        .filter(channel => values[channel.key])
        .map(channel => `${channel.label}: ${values[channel.key]}`);
    if (!lines.length) return '';
    return `PRE-ROLLED FOR THIS SESSION (binding; use these exactly, do not substitute your own, do not add a second one)
${lines.join('\n')}

${SET_FOOTERS[type] || SET_FOOTERS.persona}

If the user's details speak to one of these channels, the details win and this value becomes
background for the rest. Do not discard the other channels.`;
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
            if (line.startsWith(channel.label + ': ')) {
                values[channel.key] = line.slice(channel.label.length + 2).trim();
            }
        }
    }
    return Object.keys(values).length ? values : null;
}
