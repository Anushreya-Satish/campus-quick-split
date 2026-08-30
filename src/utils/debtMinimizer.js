export const simplifyDebts = (balances) => {
  let debtors = [];
  let creditors = [];

  Object.keys(balances).forEach((person) => {
    const amount = Number(balances[person].toFixed(2));
    if (amount < -0.01) debtors.push({ name: person, amount: -amount });
    if (amount > 0.01) creditors.push({ name: person, amount: amount });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const minAmount = Math.min(debtors[i].amount, creditors[j].amount);

    transactions.push({
      from: debtors[i].name,
      to: creditors[j].name,
      amount: Number(minAmount.toFixed(2)),
    });

    debtors[i].amount -= minAmount;
    creditors[j].amount -= minAmount;

    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return transactions;
};