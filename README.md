# Portal Logística

Sistema completo de gestão logística desenvolvido com Node.js, Express e PostgreSQL.

## Principais Funcionalidades

### Operação Logística
- Gestão de Entregas
- Rotas Operacionais
- Clientes
- Motoristas
- Veículos
- Comprovantes de Entrega
- Timeline Operacional

### Gestão Financeira
- Financeiro
- Rentabilidade
- Centro de Custos
- Relatórios Gerenciais
- Exportação CSV/XLSX

### Gestão Fiscal
- Documentos Fiscais
- Controle de Status
- Relatórios Fiscais

### Frota
- Gestão de Veículos
- Manutenção Preventiva
- Manutenção Corretiva
- Agenda de Revisões
- Indicadores por KM

### Rastreamento
- Rastreamento Operacional
- Histórico por Veículo
- Alertas de Atraso
- Alertas de Parada Longa

### Aplicativo do Motorista
- PWA Instalável
- Atualização de Status
- Upload de Comprovantes
- Integração com Rastreamento

### Business Intelligence
- BI Executivo Avançado
- Receita
- Despesa
- Lucro
- Margem
- Tendências por Período
- Indicadores Operacionais

## Segurança

- Multiempresa (Tenancy)
- RBAC (Controle de Permissões)
- JWT via Cookie HttpOnly
- Validações centralizadas
- Auditoria de acesso por módulo

## Tecnologias

- Node.js
- Express
- PostgreSQL
- JavaScript
- HTML/CSS
- Docker Compose

## Qualidade

- Arquitetura em Camadas
- Testes Automatizados
- Exportações CSV/XLSX
- 266 testes passando

## Instalação

```bash
npm install
npm run db:init
npm start
```

Acesse:

```text
http://localhost:3000
```

## Repositório

https://github.com/williamjadson86-lgtm/portal-logistica
