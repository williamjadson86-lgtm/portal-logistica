# Decisao 001: npm audit transitivo em exceljs

## Contexto

O Portal Logistica passou a usar `exceljs@4.4.0` para exportacao de relatorios em `.xlsx` com multiplas abas.

Depois da instalacao da dependencia, o comando `npm audit` passou a reportar 2 vulnerabilidades moderadas transitivas.

## Problema

O finding identificado pelo `npm audit` esta em:

- `uuid < 11.1.1`

A cadeia de dependencia reportada e:

```text
exceljs@4.4.0
└── uuid@8.3.2
```

O `npm audit` sugere:

```powershell
npm audit fix --force
```

Na pratica, essa sugestao tenta instalar `exceljs@3.4.0`, o que representa downgrade de major/minor relevante para a implementacao atual da exportacao `.xlsx`.

## Pacote Afetado

- Dependencia direta: `exceljs@4.4.0`
- Dependencia transitiva vulneravel: `uuid@8.3.2`

## Risco Real

O risco reportado e moderado e transitivo.

Pelo advisory do `uuid`, o problema afeta cenarios especificos de uso das geracoes `v3/v5/v6` quando um `buf` e fornecido.

No projeto:

- nao usamos `uuid` diretamente
- o uso de `uuid` ocorre apenas de forma interna dentro do `exceljs`
- nao foi identificado impacto funcional direto no fluxo atual do Portal Logistica

Mesmo assim, o finding nao deve ser ignorado. Ele deve permanecer monitorado.

## Alternativas Avaliadas

### 1. `npm audit fix`

Tentativa realizada.

Resultado:

- nao resolveu o problema
- o finding permaneceu no `npm audit`

### 2. `npm audit fix --force`

Nao aplicado.

Motivo:

- tenta fazer downgrade para `exceljs@3.4.0`
- pode quebrar a exportacao `.xlsx`
- nao e seguro aplicar automaticamente sem revisao tecnica e regressao completa

### 3. Override de `uuid`

Foi avaliado de forma experimental.

Resultado:

- produz arvore inconsistente com a faixa esperada pelo `exceljs`
- nao caracteriza uma correcao suportada pelo fornecedor da dependencia
- nao foi adotado

### 4. Trocar a biblioteca de XLSX

Alternativa valida para o futuro caso o `exceljs` siga sem atualizar a dependencia vulneravel em versoes compativeis.

Nao adotada agora porque:

- a implementacao atual esta estavel
- a exportacao `.xlsx` esta funcionando
- a troca aumentaria custo e risco de regressao neste momento

## Decisao Tomada

Manter `exceljs@4.4.0` por enquanto.

Nao aplicar `npm audit fix --force`.

Aceitar temporariamente o finding moderado transitivo, com monitoramento explicito, porque:

- a correcao automatica disponivel e potencialmente quebravel
- nao ha correcao segura suportada no ecossistema atual do `exceljs`
- a funcionalidade de exportacao `.xlsx` e importante e esta validada pelos testes

## Plano Futuro

- monitorar novas versoes do `exceljs`
- revisar periodicamente o `npm audit`
- reavaliar migracao para outra biblioteca de `.xlsx` se o finding permanecer sem correcao suportada
- nao aplicar `npm audit fix --force` sem analise tecnica e regressao completa
