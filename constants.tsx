
import React from 'react';
import { Song, User, UserRole } from './types';

export const MOCK_SONGS: Song[] = [
  {
    id: '1',
    title: 'Amazing Grace',
    author: 'John Newton',
    body: '[G]Amazing [G7]grace! How [C]sweet the [G]sound\nThat [G]saved a [Em]wretch like [D]me!\nI [G]once was [G7]lost, but [C]now am [G]found;\nWas [Em]blind, but [D]now I [G]see.',
    key: 'G',
    tempo: 72,
    keywords: 'hymn classic grace',
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
