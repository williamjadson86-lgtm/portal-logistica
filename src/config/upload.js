const fs = require("fs");
const path = require("path");
const multer = require("multer");
const HttpError = require("../errors/HttpError");
const {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} = require("../validations/proofValidation");

const proofUploadDir = path.join(__dirname, "..", "..", "uploads", "comprovantes");

fs.mkdirSync(proofUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, proofUploadDir);
  },
  filename(_req, file, callback) {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    callback(null, `${Date.now()}-${sanitizedName}`);
  },
});

function fileFilter(_req, file, callback) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(new HttpError(400, "Tipo de arquivo nao permitido"));
    return;
  }

  callback(null, true);
}

const proofUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

module.exports = {
  proofUpload,
  proofUploadDir,
};
