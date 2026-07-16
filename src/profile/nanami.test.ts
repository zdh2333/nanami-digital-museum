import { describe, expect, it } from 'vitest';

import { getNanamiAge, nanamiProfile } from './nanami';

describe('nanamiProfile', () => {
  it('contains the exact truthful profile facts', () => {
    expect(nanamiProfile).toEqual({
      name: 'Nanami',
      sex: 'male',
      birthDate: '2021-04-01',
      birthplace: {
        city: 'Utsunomiya',
        region: 'Tochigi',
        country: 'Japan',
      },
      species: 'cat',
      coat: 'black',
      eyeColor: 'yellow-green',
      signature: 'right-angle tail tip',
      collar: 'red',
      alive: true,
    });
  });

  it('keeps the profile and nested birthplace immutable', () => {
    expect(Object.isFrozen(nanamiProfile)).toBe(true);
    expect(Object.isFrozen(nanamiProfile.birthplace)).toBe(true);
  });
});

describe('getNanamiAge', () => {
  it.each([
    ['before the 2026 birthday', '2026-03-31T12:00:00+09:00', 4],
    ['at the start of the 2026 birthday', '2026-04-01T00:00:00+09:00', 5],
    ['after the 2026 birthday', '2026-07-16T12:00:00+09:00', 5],
  ])('returns the local-calendar age %s', (_case, now, expectedAge) => {
    expect(getNanamiAge(new Date(now))).toBe(expectedAge);
  });
});
