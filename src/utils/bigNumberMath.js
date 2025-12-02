import BigNumber from 'bignumber.js';

// Safely parse a numeric string or number
export const toBN = (value) => new BigNumber(value ?? 0);

// Sum value = sum(price * amount) for a list of assets
export const sumPortfolioValue = (positions) =>
  positions.reduce((acc, pos) => {
    const price = toBN(pos.price);
    const amount = toBN(pos.amount);
    return acc.plus(price.times(amount));
  }, new BigNumber(0));

// Compute allocation percentages based on value
export const computeAllocations = (positions) => {
  const total = sumPortfolioValue(positions);
  if (total.isZero()) {
    return positions.map((p) => ({ ...p, allocation: 0 }));
  }

  return positions.map((p) => {
    const value = toBN(p.price).times(toBN(p.amount));
    const allocation = value.dividedBy(total).times(100);
    return {
      ...p,
      allocation: allocation.toNumber(),
    };
  });
};
