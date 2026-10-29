export const PARTY_LEVELS = [
  { id:'slime-forest', name:'史莱姆森林', monster:'史莱姆团子', target:2, damage:10, reward:'萌芽伙伴徽章', theme:'forest', visual:'slime' },
  { id:'ghost-realm', name:'幽灵秘境', monster:'迷雾幽灵', target:3, damage:10, reward:'驱雾小队徽章', theme:'mist', visual:'ghost' },
  { id:'dragon-castle', name:'巨龙城堡', monster:'城堡巨龙', target:4, damage:10, reward:'屠龙同盟徽章', theme:'castle', visual:'dragon' },
] as const
export const FIRST_LEVEL = PARTY_LEVELS[0]
export type PartyLevel = typeof PARTY_LEVELS[number]
