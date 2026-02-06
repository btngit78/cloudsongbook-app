
import React from 'react';
import { Song, User, UserRole } from './types';

export const MOCK_SONGS: Song[] = [
  {
    id: '1',
    title: 'Beyond the Sea',
    author: 'Charlie Trenet, Jack Lawrence',
    body:  "Some[F]where [Dm]..[Gm7] [C7]beyond the [F]sea [Dm]\nSome[Gm7]where [C7]waiting for [F]me [A7][Dm]\n[C7]My lover [F]stands on [Dm]golden [Bb]sands [D7][Gm7]\nAnd [C7]watches the [Dm]ships [Bb]that go [G7]sail-[C7]ing\n\nSome[F]where [Dm]..[Gm7] [C7]beyond the [F]sea [Dm]\nShe's [Gm7]there [C7]watching for [F]me [A7][Dm]\n[C7]If I could [F]fly like [Dm]birds on [Bb]high [D7][Gm7]\nThen [C7]straight to her [Dm]arms .. [Bb]I'd go [Gm7]sail[C7]-[F]ing [F][E7]\n\n{soc}\nIt's [A]far [F#m]..[Bm7] [E7]beyond the [A]stars [F#m]\nIt's [Bm7]near be[E7]yond the [A]moon [A][G7] ● \nI [C]know [Am]..[Dm7] [G7]beyond a [C]doubt [Am]\nMy [Dm7]heart will [G7]lead me there [C]soon [C][C7]\n{eoc}\n\nWe'll [F]meet [Dm]..[Gm7] be[C7]yond the [F]shore [Dm]\nWe'll [Gm7]kiss [C7]just as [F]before [A7][Dm]\n[C7]Happy we'll [F]be be[Dm]yond the [Bb]sea [D7][Gm7]\nAnd [C7]never [Dm]again [Bb]I'll go [Gm7][C7]sai[F]ling\n\n(solo from verse 2)\n\n{soc}\n(continue solo 'till ●)\nI [C]know [Am]..[Dm7] [G7]beyond a [C]doubt [Am]\nMy [Dm7]heart will [G7]lead me there [C]soon [C][C7]\n{eoc}\n\nWe'll [F]meet [Dm]I know we’ll [Gm7]meet .. be[C7]yond the [F]shore [Dm]\nWe'll [Gm7]kiss [C7]just as [F]before [A7][Dm]\n[C7]Happy we'll [F]be be[Dm]yond the [Bb]sea [D7][Gm7]\nAnd [C7]never [Dm]again [Bb]I'll go [Gm7][C7]sai[F]ling\n\n[Dm][Gm7] [C7]No more [F]sailing ...\n[Dm][Gm7] [C7]So long [F]sailing ...\n[Dm][Gm7] [C7]Bye, bye [F]sailing\n\n\n",    key: 'G',
    tempo: 72,
    keywords: 'classic jazz romantic',
    language: 'English',
    isPdf: false,
    createdAt: Date.now() - 1000000,
    lastUsedAt: Date.now(),
  },
  {
    id: '2',
    title: 'Hallelujah',
    author: 'Leonard Cohen',
    body: 'I [C]heard there was a [Am]secret chord\nThat [C]David played and it [Am]pleased the Lord\nBut [F]you don\'t really [G]care for music, [C]do ya? [G]\nIt [C]goes like this: the [F]fourth, the [G]fifth\nThe [Am]minor fall, the [F]major lift\nThe [G]baffled king com[E7]posing Halle[Am]lujah',
    key: 'C',
    tempo: 80,
    keywords: 'ballad spiritual modern-classic',
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
