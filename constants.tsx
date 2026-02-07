
import React from 'react';
import { Song, User, UserRole } from './types';

export const MOCK_SONGS: Song[] = [
  {
    id: '1',
    title: 'You Should Be Dancing',
    author: 'Bee Gees',
    body:  "(intro)\n|(drum only x4) [Gm]|(synth riff){-171#615-} (guitar) | (x 4)\n\n[Gm7]My baby moves at midnight (riff) \nGoes right on 'til the dawn (riff)\n[Gm7]My woman takes me higher (riff) \nMy woman keeps me warm (riff)\n\nChorus:\nWhat you [Cm]doin' on your back? [Cm+7/B]. [Cm7/Bb] Ah [Cm7+7/B].\nWhat you [Cm]doin' on your back? [Cm+7/B]. [Cm7/Bb] Ah [Cm7+7/B].\nYou should be [Gm7]dancing, yeah .. Dancing, yeah\n\n[Gm7]She's juicy and she's trouble (riff) \nShe gets it to me good (riff)\n[Gm7]My woman gives me power (riff) \nGoes right down to my blood (riff)\n\n(chorus x 2)\n\n(interlude: brass solo)\n[Gm7]|{8\"8' 7\"}{7' 9\"9\"_}{9\"7\"7'}{7\"#7\"8'} [Gm7]|{8\"8' 7\"}{0' 7\"8\"} = |\n[Gm7]|{8\"8' 7\"}{7' 9\"9\"_}{9\"7\"7'}{7\"#7\"8'} [Gm7]|{8\"8' 7\"}{0' 7\"8\"} - {89} |\n[Gm7]|0:4 (g.riff) [Am7]|9:4  [Gm7]|8' 7\"9' 7\"8' - [Gm7]|8' 7\"9' 7\"8' {89} | \n[Gm7]|0:4 (g.riff) [Am7]|9:4  [Gm7]|8' 8\"8' -++ [Gm7]|=  | \n\n[Gm7]My baby moves at midnight (riff) \nGoes right on 'til the dawn, yeah (riff)\n[Gm7]My woman takes me higher (riff) \nMy woman keeps me warm (riff)\n\n(chorus x 2)\n\n[Gm7]You should be dancing, yeah (x 4)\n\n(-accomp)\nYou should be dancing, yeah (x 4) \n(brass riff, at 'dancing') |-' 5 7\"8 0++ |-' ^4 3\"1 !7++ | \n\n(+accomp)\n[Gm7]You should be dancing, yeah (x 4)\n",
    key: 'Gm',
    tempo: 120,
    keywords: 'disco classic upbeat',
    language: 'English',
    isPdf: false,
    createdAt: Date.now() - 1000000,
    lastUsedAt: Date.now(),
  },
  {
    id: '2',
    title: 'Beyond The Sea',
    author: 'Charles Trenet / Jack Lawrence',
    body: "Some[F]where [Dm]..[Gm7] [C7]beyond the [F]sea [Dm]\nSome[Gm7]where [C7]waiting for [F]me [A7][Dm]\n[C7]My lover [F]stands on [Dm]golden [Bb]sands [D7][Gm7]\nAnd [C7]watches the [Dm]ships [Bb]that go [G7]sail-[C7]ing\n\nSome[F]where [Dm]..[Gm7] [C7]beyond the [F]sea [Dm]\nShe's [Gm7]there [C7]watching for [F]me [A7][Dm]\n[C7]If I could [F]fly like [Dm]birds on [Bb]high [D7][Gm7]\nThen [C7]straight to her [Dm]arms .. [Bb]I'd go [Gm7]sail[C7]-[F]ing [F][E7]\n\n{soc}\nIt's [A]far [F#m]..[Bm7] [E7]beyond the [A]stars [F#m]\nIt's [Bm7]near be[E7]yond the [A]moon [A][G7] ● \nI [C]know [Am]..[Dm7] [G7]beyond a [C]doubt [Am]\nMy [Dm7]heart will [G7]lead me there [C]soon [C][C7]\n{eoc}\n\nWe'll [F]meet [Dm]..[Gm7] be[C7]yond the [F]shore [Dm]\nWe'll [Gm7]kiss [C7]just as [F]before [A7][Dm]\n[C7]Happy we'll [F]be be[Dm]yond the [Bb]sea [D7][Gm7]\nAnd [C7]never [Dm]again [Bb]I'll go [Gm7][C7]sai[F]ling\n\n(solo from verse 2)\n\n{soc}\n(continue solo 'till ●)\nI [C]know [Am]..[Dm7] [G7]beyond a [C]doubt [Am]\nMy [Dm7]heart will [G7]lead me there [C]soon [C][C7]\n{eoc}\n\nWe'll [F]meet [Dm]I know we’ll [Gm7]meet .. be[C7]yond the [F]shore [Dm]\nWe'll [Gm7]kiss [C7]just as [F]before [A7][Dm]\n[C7]Happy we'll [F]be be[Dm]yond the [Bb]sea [D7][Gm7]\nAnd [C7]never [Dm]again [Bb]I'll go [Gm7][C7]sai[F]ling\n\n[Dm][Gm7] [C7]No more [F]sailing ...\n[Dm][Gm7] [C7]So long [F]sailing ...\n[Dm][Gm7] [C7]Bye, bye [F]sailing\n\n\n",
    key: 'F',
    tempo: 80,
    keywords: 'jazz standard romantic',
    language: 'English',
    isPdf: false,
    createdAt: Date.now() - 2000000,
    lastUsedAt: Date.now() - 50000,
  }
];

export const MOCK_USER: User = {
  id: 'u1',
  name: 'John Doe',
  email: 'john@example.com',
  role: UserRole.PREMIUM,
  settings: {
    fontSize: 18,
    showChords: true,
    theme: 'light'
  }
};
