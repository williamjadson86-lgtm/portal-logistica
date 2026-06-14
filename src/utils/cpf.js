function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

module.exports = {
  onlyDigits,
};
