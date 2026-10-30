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
 * @returns {{seed: number, values: Record<string, string>}}
 */
export function rollPreRoll({ seed = Date.now(), avoid = {} } = {}) {
    const random = makeRandom(seed);
    const values = {};
    for (const channel of PRE_ROLL_CHANNELS) {
        const used = new Set(avoid[channel.key] || []);
        const unused = channel.entries.filter(entry => !used.has(entry));
        const pool = unused.length ? unused : channel.entries;
        values[channel.key] = pool[Math.floor(random() * pool.length)];
    }
    return { seed: Number(seed), values };
}

/** Renders a roll as the binding block the persona prompt expects above itself. */
export function formatPreRoll(values) {
    if (!values) return '';
    const lines = PRE_ROLL_CHANNELS
        .filter(channel => values[channel.key])
        .map(channel => `${channel.label}: ${values[channel.key]}`);
    if (!lines.length) return '';
    return `PRE-ROLLED FOR THIS SESSION (binding; use these exactly, do not substitute your own, do not add a second one)
${lines.join('\n')}

Write the persona so that MASK TEMPERAMENT and FRICTION DIRECTION are true of the same person at the
same time, and let the MASK TEMPERAMENT be visible in the Personality traits. Let the MOTIF recur as concrete sensory detail. Age, body, skin and hair come from the
image; clothes come from FASHION and not from the image; everything else here comes from here.

If the user's details speak to one of these channels, the details win and this value becomes
background for the rest. Do not discard the other channels.`;
}

/**
 * Reads a block back into channel values, so an edited block in the editor round-trips.
 * @param {string} text
 * @returns {Record<string, string>|null}
 */
export function parsePreRoll(text) {
    const values = {};
    for (const line of String(text || '').split('\n')) {
        for (const channel of PRE_ROLL_CHANNELS) {
            if (line.startsWith(channel.label + ': ')) {
                values[channel.key] = line.slice(channel.label.length + 2).trim();
            }
        }
    }
    return Object.keys(values).length ? values : null;
}

/** All entries for one channel, by key. */
export function channelEntries(key) {
    return PRE_ROLL_CHANNELS.find(channel => channel.key === key)?.entries || [];
}
