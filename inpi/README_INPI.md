# REGISTRO DE SOFTWARE NO INPI - MATERIAL COMPLETO

## IntegraFH v1.0.0

**Data de preparação:** 25 de Fevereiro de 2026

**Titular:** FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO

---

## CHECKLIST DE DOCUMENTOS

| Documento | Arquivo | Status |
|-----------|---------|--------|
| Descrição do Sistema | `descricao_software.md` | Pronto |
| Código-fonte (trechos) | `codigo_fonte.md` | Pronto |
| Arquivo ZIP | `software.zip` | Pronto |
| Hash SHA-512 | `hash_sha512.txt` | Pronto |

---

## HASH SHA-512 DO CÓDIGO

O hash SHA-512 está disponível no arquivo `hash_sha512.txt` desta pasta.

**Arquivo:** `software.zip`

---

## DOCUMENTOS PARA ENVIAR

### A. Código-fonte (PDF)
Arquivo: `codigo_fonte.md`
- Contém trechos dos 6 principais arquivos do sistema
- Inclui cabeçalhos de copyright
- Aproximadamente 30 páginas

Converter para PDF com:
```bash
# No Linux:
pandoc codigo_fonte.md -o codigo_fonte.pdf

# Ou usar qualquer editor de texto para salvar como PDF
```

### B. Descrição do Sistema (PDF)
Arquivo: `descricao_software.md`
- Nome e versão do software
- Objetivo e funcionalidades
- Tecnologias utilizadas
- Público-alvo
- Arquitetura do sistema

Converter para PDF com:
```bash
pandoc descricao_software.md -o descricao_software.pdf
```

### C. Hash Criptográfico
Arquivo: `hash_sha512.txt`
- Hash SHA-512 do arquivo ZIP
- Prova a existência do código na data

---

## INFORMAÇÕES PARA O FORMULÁRIO INPI

**Nome do Programa:** IntegraFH

**Versão:** 1.0.0

**Linguagem(s):** JavaScript, Python, PHP

**Campo de Aplicação:** Sistemas de Gestão e Automação

**Tipo de Programa:** Sistema Web de Integração com Plataformas de Delivery

**Descrição resumida (máx. 500 caracteres):**
> Sistema de automação e integração para estabelecimentos comerciais que utilizam plataformas de delivery de terceiros. Automatiza aceite de pedidos, captura de dados de clientes e produtos, sincronização com sistemas externos, e monitoramento em tempo real via dashboard web.

---

## LINKS ÚTEIS

- **INPI - Registro de Software:** https://www.gov.br/inpi/pt-br/servicos/programas-de-computador
- **e-Software (sistema de registro):** https://gru.inpi.gov.br/peticionamento/
- **Gerador SHA-512 online:** https://emn178.github.io/online-tools/sha512.html

---

## PRÓXIMOS PASSOS

1. [ ] Acessar o e-Software do INPI
2. [ ] Preencher formulário com dados do titular
3. [ ] Fazer upload dos documentos (PDF)
4. [ ] Informar o hash SHA-512
5. [ ] Pagar a GRU (taxa de registro)
6. [ ] Aguardar processamento

---

## IMPORTANTE

- O hash SHA-512 deve ser informado EXATAMENTE como gerado
- Os documentos devem estar em formato PDF
- Guarde uma cópia do arquivo ZIP original (não modifique)
- O número de registro será emitido após análise do INPI

---

**Arquivos gerados em:** /app/inpi/

```
/app/inpi/
├── descricao_software.md     # Descrição completa do software
├── codigo_fonte.md           # Trechos do código-fonte
├── software.zip              # ZIP com código-fonte
├── hash_sha512.txt           # Hash SHA-512 do ZIP
└── README_INPI.md            # Este arquivo
```
