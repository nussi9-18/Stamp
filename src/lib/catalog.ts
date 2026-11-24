// Appendix A — seed data, used exactly as given in the build prompt.
// Heat scores are sample ratings for the prototype. Sample people and feed are fictional.

import type { Dispatch, HeatVector, Item, Kind, LiveSession, Mood, Person, Place, Rating } from './types';

/* ===== CATALOG: id, kind, title, year, by, minutes, country, heat vectors
   (sex,violence,gore,dread,language,substances,flashing,animal: 0-3), logline ===== */
type Raw = [string, Kind, string, number, string, number, string, string, string];

const RAW: Raw[] = [
  ['chungking', 'film', 'Chungking Express', 1994, 'Wong Kar-wai', 98, 'HK', '01011100', 'Two lovesick Hong Kong cops, a snack bar, and a woman in a blonde wig — told in two halves.'],
  ['in-the-mood', 'film', 'In the Mood for Love', 2000, 'Wong Kar-wai', 98, 'HK', '10010100', 'Neighbours in 1962 Hong Kong discover their spouses are having an affair, and keep their distance.'],
  ['fallen-angels', 'film', 'Fallen Angels', 1995, 'Wong Kar-wai', 99, 'HK', '12111200', 'A hitman, his partner and a mute drifter cross paths in neon-lit night.'],
  ['stalker', 'film', 'Stalker', 1979, 'Andrei Tarkovsky', 162, 'SU', '01020100', 'A guide leads a writer and a scientist into the Zone, where a room may grant your deepest wish.'],
  ['mirror', 'film', 'The Mirror', 1975, 'Andrei Tarkovsky', 107, 'SU', '00020000', 'A dying man remembers his childhood, his mother and the war, out of order.'],
  ['persona', 'film', 'Persona', 1966, 'Ingmar Bergman', 83, 'SE', '21030100', 'A nurse cares for an actress who has stopped speaking, and their identities begin to blur.'],
  ['paris-texas', 'film', 'Paris, Texas', 1984, 'Wim Wenders', 145, 'DE', '10010110', 'A man walks out of the desert after four years and tries to put his family back together.'],
  ['perfect-days', 'film', 'Perfect Days', 2023, 'Wim Wenders', 124, 'JP', '00000100', 'A Tokyo toilet cleaner finds small joys in cassette tapes, books and the light through the trees.'],
  ['parasite', 'film', 'Parasite', 2019, 'Bong Joon-ho', 132, 'KR', '12220200', 'A poor family schemes its way into the home of a rich one. Then the doorbell rings.'],
  ['spirited-away', 'film', 'Spirited Away', 2001, 'Hayao Miyazaki', 125, 'JP', '01010000', 'A girl must work in a bathhouse for spirits to free her parents, who have been turned into pigs.'],
  ['totoro', 'film', 'My Neighbor Totoro', 1988, 'Hayao Miyazaki', 86, 'JP', '00010000', 'Two sisters move to the countryside and befriend the forest spirits next door.'],
  ['cleo', 'film', 'Cléo from 5 to 7', 1962, 'Agnès Varda', 90, 'FR', '10010100', 'A singer wanders Paris for two hours while waiting for a medical result.'],
  ['la-jetee', 'film', 'La Jetée', 1962, 'Chris Marker', 28, 'FR', '01020000', 'A time-travel story told almost entirely in still photographs.'],
  ['moonlight', 'film', 'Moonlight', 2016, 'Barry Jenkins', 111, 'US', '12013300', 'Three chapters in the life of a young man growing up in Miami.'],
  ['portrait', 'film', 'Portrait of a Lady on Fire', 2019, 'Céline Sciamma', 122, 'FR', '20010000', 'A painter is hired to secretly paint a bride-to-be on an isolated Breton island.'],
  ['drive-my-car', 'film', 'Drive My Car', 2021, 'Ryusuke Hamaguchi', 179, 'JP', '21020110', 'A grieving actor-director is assigned a quiet young driver for a theatre festival.'],
  ['aftersun', 'film', 'Aftersun', 2022, 'Charlotte Wells', 102, 'GB', '10020200', 'A woman revisits a holiday she took with her father when she was eleven.'],
  ['past-lives', 'film', 'Past Lives', 2023, 'Celine Song', 106, 'US', '00000100', 'Childhood friends separated by emigration meet again in New York, twenty years later.'],
  ['zone-of-interest', 'film', 'The Zone of Interest', 2023, 'Jonathan Glazer', 105, 'GB', '01130110', 'A commandant’s family builds an ordinary home life beside the walls of Auschwitz.'],
  ['mulholland', 'film', 'Mulholland Drive', 2001, 'David Lynch', 147, 'US', '22131200', 'An aspiring actress and a woman with amnesia search Los Angeles for answers.'],
  ['satantango', 'film', 'Sátántangó', 1994, 'Béla Tarr', 439, 'HU', '12130203', 'A failing Hungarian farm collective awaits the return of a man presumed dead.'],
  ['caramel', 'film', 'Caramel', 2007, 'Nadine Labaki', 96, 'LB', '10000100', 'Five women share love, gossip and sugar wax in a Beirut beauty salon.'],
  ['capernaum', 'film', 'Capernaum', 2018, 'Nadine Labaki', 126, 'LB', '02122200', 'A twelve-year-old boy in Beirut sues his parents for giving him life.'],
  ['wadjda', 'film', 'Wadjda', 2012, 'Haifaa al-Mansour', 98, 'SA', '00000000', 'A girl in Riyadh enters a Quran competition to win money for a green bicycle.'],
  ['cure', 'film', 'Cure', 1997, 'Kiyoshi Kurosawa', 111, 'JP', '02330210', 'A detective chases a string of murders committed by people who can’t say why.'],
  ['beau-travail', 'film', 'Beau Travail', 1999, 'Claire Denis', 93, 'FR', '11010100', 'A Foreign Legion sergeant in Djibouti grows jealous of a new recruit.'],
  ['jeanne-dielman', 'film', 'Jeanne Dielman', 1975, 'Chantal Akerman', 201, 'BE', '22020000', 'Three days of a widow’s exact routine — until the routine slips.'],
  ['yi-yi', 'film', 'Yi Yi', 2000, 'Edward Yang', 173, 'TW', '10010100', 'A Taipei family, from a wedding to a funeral, seen partly through a boy’s camera.'],
  ['close-up', 'film', 'Close-Up', 1990, 'Abbas Kiarostami', 98, 'IR', '00000000', 'The true story of a man who pretended to be a famous director, re-enacted by the real people.'],
  ['taste-of-cherry', 'film', 'Taste of Cherry', 1997, 'Abbas Kiarostami', 95, 'IR', '00020000', 'A man drives the hills outside Tehran looking for someone to do him a favour.'],
  ['days-of-heaven', 'film', 'Days of Heaven', 1978, 'Terrence Malick', 94, 'US', '11010001', 'Drifters work a Texas wheat harvest in 1916, and a love triangle forms.'],
  ['iron-giant', 'film', 'The Iron Giant', 1999, 'Brad Bird', 86, 'US', '01010000', 'A boy in 1957 Maine befriends a giant robot that fell from the sky.'],
  ['severance', 'series', 'Severance', 2022, 'Dan Erickson', 950, 'US', '02131100', 'Office workers have their memories split between work and home. Then they start asking questions.'],
  ['twin-peaks', 'series', 'Twin Peaks', 1990, 'David Lynch & Mark Frost', 1440, 'US', '12231200', 'An FBI agent investigates the murder of a homecoming queen in a strange logging town.'],
  ['the-bear', 'series', 'The Bear', 2022, 'Christopher Storer', 1000, 'US', '01013100', 'A fine-dining chef comes home to run his late brother’s chaotic Chicago sandwich shop.'],
  ['normal-people', 'series', 'Normal People', 2020, 'Lenny Abrahamson', 360, 'IE', '30021100', 'Two teenagers from a small Irish town fall in and out of love through university.'],
  ['blood-meridian', 'book', 'Blood Meridian', 1985, 'Cormac McCarthy', 720, 'US', '03321103', 'A teenage runaway rides with a gang of scalp hunters across the 1840s borderlands.'],
  ['never-let-me-go', 'book', 'Never Let Me Go', 2005, 'Kazuo Ishiguro', 420, 'GB', '10020000', 'A woman remembers her boarding school and the friends she grew up with — and what they were for.'],
  ['the-prophet', 'book', 'The Prophet', 1923, 'Kahlil Gibran', 120, 'LB', '00000000', 'Before sailing home, a prophet answers the townspeople’s questions about love, work and death.'],
  ['season-migration', 'book', 'Season of Migration to the North', 1966, 'Tayeb Salih', 300, 'SD', '22020100', 'A young man returns to his Sudanese village and meets a stranger with a dark London past.'],
  ['punpun', 'manga', 'Goodnight Punpun', 2007, 'Inio Asano', 900, 'JP', '22031200', 'A boy drawn as a little bird grows up through a family falling apart.'],
  ['berserk', 'manga', 'Berserk', 1989, 'Kentaro Miura', 1500, 'JP', '33331103', 'A lone mercenary with a giant sword is hunted by demons and his own past.'],
  ['nausicaa', 'manga', 'Nausicaä of the Valley of the Wind', 1982, 'Hayao Miyazaki', 480, 'JP', '02110001', 'A princess tries to stop a war in a world swallowed by a toxic forest.'],
  ['disco-elysium', 'game', 'Disco Elysium', 2019, 'ZA/UM', 1800, 'EE', '12123300', 'An amnesiac detective solves a murder while arguing with the voices in his own head.'],
  ['journey', 'game', 'Journey', 2012, 'thatgamecompany', 150, 'US', '00010000', 'A robed traveller crosses a desert toward a distant mountain, sometimes with a stranger.'],
  ['outer-wilds', 'game', 'Outer Wilds', 2019, 'Mobius Digital', 1200, 'US', '00020000', 'A solar system explodes every 22 minutes. Find out why before it happens again.'],
  ['elden-ring', 'game', 'Elden Ring', 2022, 'FromSoftware', 6000, 'JP', '03320010', 'A tarnished warrior crosses a broken kingdom to become Elden Lord.'],
  ['in-rainbows', 'album', 'In Rainbows', 2007, 'Radiohead', 42, 'GB', '00000000', 'Ten songs released by pay-what-you-want download, warm where the band used to be cold.'],
  ['raasuk', 'album', 'Raasük', 2013, 'Mashrou’ Leila', 45, 'LB', '10001100', 'The Beirut band’s third album: dance songs about the city, protest and desire.'],
  ['blonde', 'album', 'Blonde', 2016, 'Frank Ocean', 60, 'US', '10002200', 'A hazy, unhurried record about memory, love and growing up.'],
];

export const CNAME: Record<string, string> = {
  HK: 'Hong Kong',
  SU: 'Soviet Union',
  SE: 'Sweden',
  DE: 'West Germany',
  JP: 'Japan',
  KR: 'South Korea',
  FR: 'France',
  US: 'United States',
  GB: 'United Kingdom',
  HU: 'Hungary',
  LB: 'Lebanon',
  SA: 'Saudi Arabia',
  BE: 'Belgium',
  TW: 'Taiwan',
  IR: 'Iran',
  IE: 'Ireland',
  SD: 'Sudan',
  EE: 'Estonia',
};

export function countryName(cc?: string): string {
  if (!cc) return '';
  return CNAME[cc.toUpperCase()] ?? cc.toUpperCase();
}

function parseVector(s: string): HeatVector {
  return s.split('').map((c) => Number(c)) as HeatVector;
}

export const CATALOG: Item[] = RAW.map(([id, kind, title, year, by, mins, cc, v, log]) => ({
  id,
  kind,
  title,
  year,
  by,
  mins,
  cc,
  v: parseVector(v),
  log,
}));

export const CATALOG_BY_ID: Record<string, Item> = Object.fromEntries(CATALOG.map((i) => [i.id, i]));

/* ===== PEOPLE (sample citizens) ===== */
const PEOPLE_RAW: Omit<Person, 'sample' | 'canon'>[] = [
  { id: 'lina', name: 'Lina Haddad', handle: 'lina.reels', city: 'Beirut', av: '#F5C6D0', bio: 'Arab cinema, tender dramas, anything with a Fairuz song.', r: { capernaum: 5, caramel: 5, wadjda: 5, 'in-the-mood': 5, 'perfect-days': 4, aftersun: 5, 'past-lives': 5, 'the-prophet': 4, raasuk: 5, 'spirited-away': 4, chungking: 4, 'season-migration': 5 } },
  { id: 'marcus', name: 'Marcus Ode', handle: 'marcus_noir', city: 'Paris', av: '#7EA8BE', bio: 'Dread, slow burns and cold horror. High heat tolerance.', r: { cure: 5, 'zone-of-interest': 5, severance: 5, mulholland: 5, stalker: 4, persona: 5, parasite: 4, 'blood-meridian': 5, 'twin-peaks': 5, chungking: 3, berserk: 4 } },
  { id: 'jude', name: 'Jude Park', handle: 'judepark', city: 'Seoul', av: '#E2DCCE', bio: 'Family dramas, long takes, and games you can finish in an evening.', r: { 'yi-yi': 5, 'past-lives': 5, parasite: 5, 'drive-my-car': 5, 'perfect-days': 5, aftersun: 4, totoro: 4, journey: 5, 'in-rainbows': 4, chungking: 4 } },
  { id: 'sara', name: 'Sara Mendes', handle: 'sara.frames', city: 'Lisbon', av: '#B8894A', bio: 'French New Wave and the women who came after it.', r: { cleo: 5, 'la-jetee': 4, portrait: 5, 'beau-travail': 5, 'jeanne-dielman': 5, 'in-the-mood': 5, 'days-of-heaven': 4, 'normal-people': 4, 'never-let-me-go': 4 } },
  { id: 'omar', name: 'Omar Rizk', handle: 'omarplays', city: 'Cairo', av: '#F5C6D0', bio: 'Kiarostami on weekdays, Outer Wilds on weekends.', r: { wadjda: 5, 'close-up': 5, 'taste-of-cherry': 4, 'disco-elysium': 5, 'outer-wilds': 5, 'elden-ring': 4, nausicaa: 5, 'iron-giant': 5, 'spirited-away': 5, journey: 4 } },
  { id: 'ines', name: 'Ines Varga', handle: 'ines.durational', city: 'Budapest', av: '#7EA8BE', bio: 'If it’s longer than three hours, I’m in.', r: { satantango: 5, stalker: 5, mirror: 5, 'jeanne-dielman': 5, berserk: 4, punpun: 5, 'blood-meridian': 4, 'the-bear': 3, 'yi-yi': 5 } },
];

/** A sample citizen's canonical nine: their ratings, highest first, in the order given. */
function sampleCanon(r: Record<string, number>): string[] {
  return Object.entries(r)
    .map(([id, rating], i) => ({ id, rating, i }))
    .sort((a, b) => b.rating - a.rating || a.i - b.i)
    .slice(0, 9)
    .map((x) => x.id);
}

export const PEOPLE: Person[] = PEOPLE_RAW.map((p) => ({ ...p, sample: true, canon: sampleCanon(p.r) }));
export const PEOPLE_BY_ID: Record<string, Person> = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

export const FEED: Dispatch[] = [
  { id: 'd1', p: 'lina', item: 'capernaum', rating: 5, place: 'out', date: '2026-11-17', ago: '2 h', note: 'Zain’s face in the last shot. I sat through the credits.' },
  { id: 'd2', p: 'marcus', item: 'cure', rating: 4, place: 'home', date: '2026-11-16', ago: '1 d', note: 'Watched alone at 1 a.m. Mistake. Great mistake.' },
  { id: 'd3', p: 'jude', item: 'yi-yi', rating: 5, place: 'event', date: '2026-11-15', ago: '2 d', note: 'Three hours that felt like a family album.' },
  { id: 'd4', p: 'omar', item: 'outer-wilds', rating: 5, place: 'home', date: '2026-11-15', ago: '2 d', note: 'Finished it and immediately wanted to forget it so I could play again.' },
  { id: 'd5', p: 'sara', item: 'cleo', rating: 4, place: 'out', date: '2026-11-14', ago: '3 d', note: 'Paris in real time. I want to walk that route now.' },
  { id: 'd6', p: 'ines', item: 'berserk', rating: 4, place: 'home', date: '2026-11-13', ago: '4 d', note: 'Volume 14 is the hardest thing I’ve read this year.' },
  { id: 'd7', p: 'lina', item: 'raasuk', rating: 5, place: 'event', date: '2026-11-12', ago: '5 d', note: '' },
  { id: 'd8', p: 'ines', item: 'satantango', rating: 5, place: 'event', date: '2026-11-09', ago: '1 w', note: 'Seven and a half hours. Stamped with pride.' },
].map((d) => ({ ...(d as Dispatch), sample: true }));

export const LIVE: LiveSession[] = [
  { p: 'marcus', item: 'severance', pct: 42, label: 'S2 · E6' },
  { p: 'omar', item: 'elden-ring', pct: 55, label: '46 h in' },
  { p: 'ines', item: 'berserk', pct: 30, label: 'Vol. 14' },
  { p: 'jude', item: 'in-rainbows', pct: 70, label: 'Track 7 of 10' },
];

export type SeedStamp = { rating: Rating; tags: Mood[]; date: string; place: Place; note: string };

export const SEED: Record<string, SeedStamp> = {
  chungking: { rating: 5, tags: ['Rain-soaked', 'Dreamlike'], date: '2026-01-14', place: 'home', note: 'California Dreamin’ is stuck in my head for good.' },
  'perfect-days': { rating: 5, tags: ['Tender'], date: '2026-02-02', place: 'out', note: '' },
  parasite: { rating: 4, tags: ['Funny', 'Unsettling'], date: '2026-03-21', place: 'home', note: '' },
  severance: { rating: 5, tags: ['Unsettling', 'Slow burn'], date: '2026-04-12', place: 'home', note: '' },
  stalker: { rating: 4, tags: ['Slow burn'], date: '2026-05-09', place: 'event', note: 'Needed the whole walk home to think.' },
  raasuk: { rating: 5, tags: ['Gorgeous'], date: '2026-06-01', place: 'home', note: '' },
  aftersun: { rating: 5, tags: ['Devastating'], date: '2026-07-30', place: 'home', note: '' },
  'spirited-away': { rating: 5, tags: ['Dreamlike', 'Gorgeous'], date: '2026-09-12', place: 'out', note: '' },
  caramel: { rating: 4, tags: ['Funny', 'Tender'], date: '2026-10-03', place: 'home', note: '' },
  totoro: { rating: 5, tags: ['Tender'], date: '2025-02-10', place: 'home', note: '' },
  persona: { rating: 4, tags: ['Unsettling'], date: '2025-04-02', place: 'out', note: '' },
  'drive-my-car': { rating: 5, tags: ['Slow burn', 'Tender'], date: '2025-06-21', place: 'out', note: '' },
  'the-prophet': { rating: 4, tags: ['Tender'], date: '2025-08-08', place: 'home', note: '' },
  journey: { rating: 5, tags: ['Gorgeous'], date: '2025-10-15', place: 'home', note: '' },
  mulholland: { rating: 4, tags: ['Dreamlike', 'Unsettling'], date: '2025-12-01', place: 'event', note: '' },
};

export const SEED_CANON = ['chungking', 'perfect-days', 'aftersun', 'spirited-away', 'severance'];

export const KIND_LABEL: Record<Kind, string> = {
  film: 'Film',
  series: 'Series',
  book: 'Book',
  manga: 'Manga',
  game: 'Game',
  album: 'Album',
};

export const KINDS: Kind[] = ['film', 'series', 'book', 'manga', 'game', 'album'];
