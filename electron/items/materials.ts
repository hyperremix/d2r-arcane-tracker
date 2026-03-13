export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  imageFilename: string;
}

export const materials: MaterialItem[] = [
  { id: 'rvs', code: 'rvs', name: 'Rejuvenation Potion', imageFilename: 'invvps.png' },
  { id: 'rvl', code: 'rvl', name: 'Full Rejuvenation Potion', imageFilename: 'invvpl.png' },
  { id: 'xa1', code: 'xa1', name: 'Western Worldstone Shard', imageFilename: 'invtoa.png' },
  { id: 'xa2', code: 'xa2', name: 'Eastern Worldstone Shard', imageFilename: 'invtoa.png' },
  { id: 'xa3', code: 'xa3', name: 'Southern Worldstone Shard', imageFilename: 'invtoa.png' },
  { id: 'xa5', code: 'xa5', name: 'Northern Worldstone Shard', imageFilename: 'invtoa.png' },
  { id: 'xa4', code: 'xa4', name: 'Deep Worldstone Shard', imageFilename: 'invtoa.png' },
  { id: 'ua1', code: 'ua1', name: "Talic's Anguish", imageFilename: 'invjbi.png' },
  { id: 'ua2', code: 'ua2', name: "Korlic's Pain", imageFilename: 'invjbi.png' },
  { id: 'ua3', code: 'ua3', name: "Madawc's Ire", imageFilename: 'invjbi.png' },
  { id: 'ua4', code: 'ua4', name: "Bul-Kathos' Nightmare", imageFilename: 'invjbi.png' },
  { id: 'ua5', code: 'ua5', name: "Worusk's End", imageFilename: 'invjbi.png' },
  { id: 'pk1', code: 'pk1', name: 'Key of Terror', imageFilename: 'invmph.png' },
  { id: 'pk2', code: 'pk2', name: 'Key of Hate', imageFilename: 'invmph.png' },
  { id: 'pk3', code: 'pk3', name: 'Key of Destruction', imageFilename: 'invmph.png' },
  { id: 'dhn', code: 'dhn', name: "Diablo's Horn", imageFilename: 'invfang.png' },
  { id: 'bey', code: 'bey', name: "Baal's Eye", imageFilename: 'inveye.png' },
  { id: 'mbr', code: 'mbr', name: "Mephisto's Brain", imageFilename: 'invbrnz.png' },
  { id: 'toa', code: 'toa', name: 'Token of Absolution', imageFilename: 'invtoa.png' },
  { id: 'tes', code: 'tes', name: 'Twisted Essence of Suffering', imageFilename: 'invtes.png' },
  { id: 'ceh', code: 'ceh', name: 'Charged Essence of Hatred', imageFilename: 'invceh.png' },
  { id: 'bet', code: 'bet', name: 'Burning Essence of Terror', imageFilename: 'invbet.png' },
  { id: 'fed', code: 'fed', name: 'Festering Essence of Destruction', imageFilename: 'invfed.png' },
];

export const materialDisplayNameByCode: Readonly<Record<string, string>> = Object.fromEntries(
  materials.map((m) => [m.code, m.name]),
);
