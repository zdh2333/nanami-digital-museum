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

const tokyoCalendar = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export function getNanamiAge(now = new Date()): number {
  const [birthYear, birthMonth, birthDay] = nanamiProfile.birthDate
    .split('-')
    .map(Number);
  const nowParts = tokyoCalendar.formatToParts(now);
  const [year, month, day] = ['year', 'month', 'day'].map((type) =>
    Number(nowParts.find((part) => part.type === type)?.value),
  );
  const beforeBirthday =
    month < birthMonth || (month === birthMonth && day < birthDay);

  return year - birthYear - Number(beforeBirthday);
}
