export const nanamiProfile = Object.freeze({
  name: 'Nanami',
  sex: 'male' as const,
  birthDate: '2021-04-01',
  birthplace: Object.freeze({
    city: 'Utsunomiya',
    region: 'Tochigi',
    country: 'Japan',
  }),
  species: 'cat' as const,
  coat: 'black',
  eyeColor: 'yellow-green',
  signature: 'right-angle tail tip',
  collar: 'red',
  alive: true,
});

export function getNanamiAge(now = new Date()): number {
  const birthYear = 2021;
  const birthdayMonthIndex = 3;
  const birthdayDay = 1;
  const beforeBirthday =
    now.getMonth() < birthdayMonthIndex ||
    (now.getMonth() === birthdayMonthIndex && now.getDate() < birthdayDay);

  return now.getFullYear() - birthYear - Number(beforeBirthday);
}
