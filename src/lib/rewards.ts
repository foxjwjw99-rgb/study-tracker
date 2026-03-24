export type RewardPrizeType = "cash" | "item"

export type RewardPrizeDefinition = {
  key: string
  label: string
  type: RewardPrizeType
  value: number
  probability: number
  probabilityLabel: string
}

export const REWARD_DRAW_COST_MINUTES = 60

export const REWARD_POOL: RewardPrizeDefinition[] = [
  {
    key: "cash_1000",
    label: "1000 元",
    type: "cash",
    value: 1000,
    probability: 1,
    probabilityLabel: "1%",
  },
  {
    key: "cash_500",
    label: "500 元",
    type: "cash",
    value: 500,
    probability: 1,
    probabilityLabel: "1%",
  },
  {
    key: "cash_200",
    label: "200 元",
    type: "cash",
    value: 200,
    probability: 20,
    probabilityLabel: "20%",
  },
  {
    key: "cash_100",
    label: "100 元",
    type: "cash",
    value: 100,
    probability: 30,
    probabilityLabel: "30%",
  },
  {
    key: "cash_50",
    label: "50 元",
    type: "cash",
    value: 50,
    probability: 40,
    probabilityLabel: "40%",
  },
  {
    key: "pokemon_pack_159",
    label: "159 元寶可夢卡包 1 包",
    type: "item",
    value: 159,
    probability: 8,
    probabilityLabel: "8%",
  },
]

export const REWARD_EXPECTED_VALUE = Number(
  REWARD_POOL.reduce((sum, prize) => sum + (prize.probability / 100) * prize.value, 0).toFixed(2)
)

export function pickRewardPrize(randomValue = Math.random()) {
  const roll = randomValue * 100
  let cursor = 0

  for (const prize of REWARD_POOL) {
    cursor += prize.probability
    if (roll < cursor) {
      return prize
    }
  }

  return REWARD_POOL[REWARD_POOL.length - 1]
}
