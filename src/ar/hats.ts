import crown from './assets/crown.svg'
import pirate from './assets/pirate.svg'
import wizard from './assets/wizard.svg'
import party from './assets/party.svg'

export const HATS = {
  crown: { name: '皇冠', src: crown }, pirate: { name: '海盗帽', src: pirate },
  wizard: { name: '魔法帽', src: wizard }, party: { name: '派对帽', src: party },
} as const
export type HatId = keyof typeof HATS
export const HAT_IDS = Object.keys(HATS) as HatId[]
export const defaultHat = (index: number): HatId => HAT_IDS[index % HAT_IDS.length]
export function isHatId(value: unknown): value is HatId { return typeof value === 'string' && Object.hasOwn(HATS, value) }
