async function me(req, res) {
  res.json({ usuario: req.user });
}

module.exports = { me };
