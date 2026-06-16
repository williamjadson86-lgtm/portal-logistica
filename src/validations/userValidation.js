const USER_TYPES = [
  "colaborador",
  "motorista",
  "operador",
  "financeiro",
  "administrador",
  "admin",
  "gestor",
];

function normalizeUserType(value) {
  if (value === "admin") {
    return "administrador";
  }

  return value;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCpf(value) {
  const cpf = onlyDigits(value);

  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf[index]) * (10 - index);
  }
  let digit = (sum * 10) % 11;
  if (digit === 10) {
    digit = 0;
  }
  if (digit !== Number(cpf[9])) {
    return false;
  }

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf[index]) * (11 - index);
  }
  digit = (sum * 10) % 11;
  if (digit === 10) {
    digit = 0;
  }

  return digit === Number(cpf[10]);
}

function formatCpf(value) {
  const cpf = onlyDigits(value);
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function validateRegistration(input) {
  const errors = [];
  const data = {};

  if (typeof input.nome !== "string" || input.nome.trim().length < 3) {
    errors.push("nome deve ter pelo menos 3 caracteres");
  } else {
    data.nome = input.nome.trim();
  }

  if (!isValidCpf(input.cpf)) {
    errors.push("cpf invalido");
  } else {
    data.cpf = formatCpf(input.cpf);
  }

  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    errors.push("email invalido");
  } else {
    data.email = email;
  }

  const telefone = typeof input.telefone === "string" ? input.telefone.trim() : "";
  if (telefone.length < 10 || telefone.length > 20) {
    errors.push("telefone deve ter entre 10 e 20 caracteres");
  } else {
    data.telefone = telefone;
  }

  const matricula =
    typeof input.matricula === "string" ? input.matricula.trim().toUpperCase() : "";
  if (matricula.length < 4 || matricula.length > 50) {
    errors.push("matricula deve ter entre 4 e 50 caracteres");
  } else {
    data.matricula = matricula;
  }

  if (typeof input.senha !== "string" || input.senha.length < 6) {
    errors.push("senha deve ter pelo menos 6 caracteres");
  } else {
    data.senha = input.senha;
  }

  if (input.senha !== input.confirmacaoSenha) {
    errors.push("confirmacao de senha nao confere");
  }

  if (!USER_TYPES.includes(input.tipoUsuario)) {
    errors.push("tipoUsuario invalido");
  } else {
    data.tipoUsuario = normalizeUserType(input.tipoUsuario);
  }

  return { errors, data };
}

function validateLogin(input) {
  const errors = [];
  const data = {};

  const matricula =
    typeof input.matricula === "string" ? input.matricula.trim().toUpperCase() : "";
  if (!matricula) {
    errors.push("matricula e obrigatoria");
  } else {
    data.matricula = matricula;
  }

  if (typeof input.senha !== "string" || !input.senha) {
    errors.push("senha e obrigatoria");
  } else {
    data.senha = input.senha;
  }

  return { errors, data };
}

module.exports = {
  USER_TYPES,
  normalizeUserType,
  isValidCpf,
  validateRegistration,
  validateLogin,
};
