# Geralindica

Plataforma de indicações de planos de saúde: site público, painel do **Indicador**, painel do **Consultor** e painel **Admin**, com login, banco de dados e regras de acesso reais (Supabase).

Stack: Vite + React 19 + TypeScript + Tailwind (tokens da Geralindica) + React Query + Supabase (Postgres, Auth, Storage). Ícones `lucide-react`.

## Rodar localmente

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # gera dist/
```

Precisa do `.env.local` (veja `.env.example`) com a URL e a chave *publishable* do projeto Supabase.

> Mantenha esta pasta fora do Google Drive: o `npm install` falha dentro de pastas sincronizadas.

## Contas de demonstração

Criadas por `supabase/seed.sql` (senha de todas no próprio arquivo). Rodando localmente (`npm run dev`), a tela **Entrar** mostra botões de acesso rápido:

| Papel | E-mail |
|---|---|
| Indicador | `carlos.mendes@demo.geralindica.com.br` |
| Consultor | `juliana.prado@demo.geralindica.com.br` |
| Admin | `admin@demo.geralindica.com.br` |

As contas de demonstração são só de teste e saem antes do lançamento. Os botões **não aparecem** no build de produção. Antes de abrir o site ao público, apague ou troque a senha dessas contas.

## Rotas

| Área | Rotas |
|---|---|
| Site | `/`, `/consultores`, `/consultores/:id`, `/entrar`, `/cadastro?papel=indicador\|consultor&consultor=<id>`, `/redefinir-senha`, `/termos`, `/privacidade` |
| QR Code | `/q/:codigo` conta o escaneamento e abre o WhatsApp com a mensagem e o código do canal |
| Indicador | `/indicador`, `/indicador/qr`, `/indicador/extrato` (minhas vendas), `/indicador/consultor`, `/indicador/dados` |
| Consultor | `/consultor`, `/consultor/leads`, `/consultor/leads/:id`, `/consultor/indicadores`, `/consultor/perfil` |
| Admin | `/admin`, `/admin/split`, `/admin/usuarios`, `/admin/catalogo` |

## Como está organizado

```
src/
  auth/            sessão, perfil e proteção de rotas por papel
  components/      UI compartilhada (botões, badges, modal, toasts, layout dos painéis)
  data/queries.ts  consultas públicas (vitrine, avaliações, config, catálogo)
  integrations/    pontos de encaixe das integrações externas (hoje só o link do WhatsApp)
  lib/negocio.ts   regras puras: split, máscaras LGPD, etapas, ranking, vagas
  pages/           site público + indicador/ consultor/ admin/
supabase/
  migrations/      todo o banco: tabelas, RLS, triggers e funções
  seed.sql         dados de demonstração
```

## Regras de negócio (aplicadas no banco)

- **Sem dinheiro na plataforma**: o consultor atende o cliente, recebe a adesão, segura até a entrevista de saúde (Verdinho), devolve se reprovado e faz os Pix do indicador e da Geralindica por fora. Na plataforma ele só **registra a venda** (`registrar_venda()`).
- **Split**: valor − imposto do consultor (PF 27,5%; PJ 6% ou 15,5%) = líquido → 50% do indicador. A outra metade fica com o consultor, que soma a bonificação da operadora (também sem imposto) e divide esse bolo com a Geralindica. Ex.: PF, R$ 400, bonificação 100% → indicador R$ 145, consultor R$ 217,50, Geralindica R$ 217,50. Tudo configurável em Admin → Split. Os valores na plataforma são só estimativa.
- **Temperatura**: reputação pública do consultor (0 a 100), em `private.calcular_temperatura()` (fórmula provisória: vendas aprovadas registradas, avaliações e vendas dos últimos 30 dias).
- **LGPD**: o indicador não lê leads nem vendas; vê `vendas_indicador()`, que só devolve primeiro nome, data, canal, status e valores.
- **Vagas**: no máximo 30 indicadores por consultor; trocar para um consultor lotado é bloqueado.
- **Ranking**: ordenado pela temperatura; "Em alta" = 5+ vendas aprovadas em 30 dias; "Top 10" = top 10 com 75+ vendas.
- Colunas sensíveis (papel, métricas, atribuição, escaneamentos) não podem ser alteradas pela API; mudanças passam por funções com checagem de permissão.

## Integrações

Veja `src/integrations/README.md`. O QR Code → WhatsApp é real. O contrato Gov.br é manual: a pessoa assina o PDF em assinador.iti.br e envia pelo painel; o admin confere em Usuários. Não há robô, Cotaí nem pagamento.

## Publicar (Vercel)

`vercel.json` já faz o roteamento da SPA. Configure as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no projeto da Vercel e, no Supabase (Authentication → URL Configuration), adicione o domínio em *Site URL* e *Redirect URLs*.

## Pendências fora do código

1. **E-mail de confirmação**: o servidor de e-mail padrão do Supabase só envia para membros da equipe e tem limite baixo. Para cadastro público, configure um SMTP (ex.: Resend) em Authentication → Emails, ou desligue "Confirm email" em Authentication → Providers → Email.
2. **Senhas vazadas**: ligar "Leaked password protection" em Authentication → Policies.
3. **WhatsApp**: cada consultor cadastra o dele em Meus dados (o QR abre nele); o número geral de reserva fica em Admin → Split e configurações.
4. **Termos e privacidade**: os textos em `/termos` e `/privacidade` são rascunhos para revisão jurídica.
