
import React from 'react';
import { Song, User, UserRole } from './types';

export const MOCK_SONGS: Song[] = [
  {
    id: '1',
    title: 'This Masquerade',
    author: 'Leon Russell',
    body: "(intro)\n[Fm]1.(flute)  [Fm7/Eb]2.  [DbM7]3.  [Dm7-5]4.(pia #1a) [Db9/Ab]5.  [C7]6.  [Fm]7.  [Bb]8.(pia #1b)  [Fm]9.  [Bb]10.\n\n[Fm]Are we real[Fm+7]ly happy with this [Fm7]lonely game we [Bb7]play\n[Fm]Looking for the [Db9]right words to [C7]say [C7](e.pia #2)\n[Fm]Searching but not [Fm+7]finding under[Fm7]standing any[Bb7]way\nWe're [Db7]lost in this [C7]masque[Fm]rade [Fm]\n\n{soc}\n[Ebm7]Both afraid to [Ab7]say we're just too [DbM7]far away [Bbm7](pia #7)\nFrom [Ebm7]being close to[Ab7]gether [B7] from the [DbM7]start [DbM7](pia #9)\n● We [Dm7]tried to talk it [G7]over but … the [CM7]words got in the way (s.riff #3)\nWe're [Bb7]lost in[G7]side … this [C7]lonely game we play [C7-9](harp #4)\n{eoc}\n\n[Fm]Thoughts of leaving [Fm+7]disappear each [Fm7]time I see your [Bb7]eyes (pia #5)\nAnd [Fm]no matter how [Db9]hard I [C7]try  [C7] (s.riff #2)\n[Fm]To understand the [Fm+7]reason why we [Fm7]carry on this [Bb7]way\nWe're [Db7]lost in a [C7]masque[Fm]rade \n\n|(1st) [Bb](str #8) [Fm] [Bb]  (solo fr top: piano/verse, flute/chorus)\n(repeat from ● - to coda)\n|(2nd:coda)\n\nCoda:\n(slow)\n[Fm7/Eb] We're [DbM7](break) lost .. in a [C7+5+9]masque .. [Fm]-rade (cont.)\n(flute #6) [Fm7/Eb] [DbM7] [Dm7-5]\nAnd we're [Abdim7]lost in a [C7]masque .. [Fm]-rade [Bb] [Fm] [Bb] [Fm] (fadeout)\n\n# #1a: {-5^123589} |0:2 =\n# #2: {-653!6532| |1:2 =\n# #3: {-535321!5} |b7:2\n# #4: {-5^b2458b9^^2} |1:4\n# #5: {--43431!7} |8:2 =\n# #6: (like 1st phrase of intro/lyric)\n# #7: {-1356'_7'653} |\n# #8: {-#6543423} |1:4\n# #9: - {13} 5+ 8'_9' 8 |{76532} ?\n##\n",
    key: 'Fm',
    tempo: 70,
    keywords: 'jazz standard romantic',
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
    theme: 'light',
    chordColor: '',
    sectionColor: ''
  }
};
