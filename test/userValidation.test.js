const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isValidCpf,
  validateLogin,
  validateRegistration,
} = require("../src/validations/userValidation");

test("aceita cpf valido conhecido", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
});

test("rejeita cpf invalido", () => {
  assert.equal(isValidCpf("111.111.111-11"), false);
});

test("normaliza dados validos de cadastro", () => {
  const result = validateRegistration({
    nome: "  Maria da Silva  ",
    cpf: "529.982.247-25",
    email: "  MARIA@EMPRESA.COM ",
    telefone: "(11) 99999-9999",
    matricula: " col1234 ",
    senha: "123456",
    confirmacaoSenha: "123456",
    tipoUsuario: "colaborador",
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.data.nome, "Maria da Silva");
  assert.equal(result.data.email, "maria@empresa.com");
  assert.equal(result.data.matricula, "COL1234");
});

test("exige matricula e senha no login", () => {
  const result = validateLogin({});
  assert.deepEqual(result.errors, [
    "matricula e obrigatoria",
    "senha e obrigatoria",
  ]);
});
