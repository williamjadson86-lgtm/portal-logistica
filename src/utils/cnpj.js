function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCnpj(value) {
  const cnpj = onlyDigits(value);

  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const calculateDigit = (base, factors) => {
    const total = base
      .split("")
      .reduce((sum, digit, index) => sum + Number(digit) * factors[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return cnpj === `${cnpj.slice(0, 12)}${firstDigit}${secondDigit}`;
}

function formatCnpj(value) {
  const cnpj = onlyDigits(value);
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

module.exports = {
  onlyDigits,
  isValidCnpj,
  formatCnpj,
};
