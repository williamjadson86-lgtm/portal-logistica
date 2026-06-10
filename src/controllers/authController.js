const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const HttpError = require("../errors/HttpError");
const repository = require("../repositories/userRepository");
const {
  validateLogin,
  validateRegistration,
} = require("../validations/userValidation");

function buildTokenPayload(user) {
  return {
    sub: user.id,
    nome: user.nome,
    matricula: user.matricula,
    tipoUsuario: user.tipoUsuario,
  };
}

function setAuthCookie(res, token) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: env.jwtExpiresInMs,
  });
}

async function register(req, res) {
  const { errors, data } = validateRegistration(req.body);

  if (errors.length) {
    throw new HttpError(422, "Dados invalidos", errors);
  }

  const [emailExists, matriculaExists] = await Promise.all([
    repository.findByEmail(data.email),
    repository.findByMatricula(data.matricula),
  ]);

  if (emailExists) {
    throw new HttpError(409, "E-mail ja cadastrado");
  }

  if (matriculaExists) {
    throw new HttpError(409, "Matricula ja cadastrada");
  }

  const senhaHash = await bcrypt.hash(data.senha, 10);
  const user = await repository.create({
    ...data,
    senhaHash,
  });

  const token = jwt.sign(buildTokenPayload(user), env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

  setAuthCookie(res, token);

  res.status(201).json({
    mensagem: "Cadastro realizado com sucesso",
    usuario: user,
  });
}

async function login(req, res) {
  const { errors, data } = validateLogin(req.body);

  if (errors.length) {
    throw new HttpError(422, "Dados invalidos", errors);
  }

  const user = await repository.findByMatricula(data.matricula);

  if (!user || !user.ativo) {
    throw new HttpError(401, "Credenciais invalidas");
  }

  const senhaCorreta = await bcrypt.compare(data.senha, user.senhaHash);

  if (!senhaCorreta) {
    throw new HttpError(401, "Credenciais invalidas");
  }

  const token = jwt.sign(buildTokenPayload(user), env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

  setAuthCookie(res, token);

  res.json({
    mensagem: "Login realizado com sucesso",
    usuario: {
      id: user.id,
      nome: user.nome,
      matricula: user.matricula,
      tipoUsuario: user.tipoUsuario,
    },
  });
}

function logout(_req, res) {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
  });

  res.json({ mensagem: "Logout realizado com sucesso" });
}

module.exports = { register, login, logout };
