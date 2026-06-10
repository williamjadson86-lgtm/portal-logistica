const path = require("path");

function resolveView(name) {
  return path.join(__dirname, "..", "..", "views", name);
}

module.exports = resolveView;
