# Geralindica · notas para o Claude

Plataforma de indicações de planos de saúde ("Hotmart das indicações"). Sócios: Eduardo e Luis Novinho. Especificação completa no Obsidian: `Eduardo/Projetos/Geralindica/` (o projeto se chamava Indikei até 23/10/2026). Design original: `G:\Meu Drive\Luis Novinho\Geralindica\geralindica-design-system-pronto` (Claude Design).

## Stack e comandos
- Vite + React 19 + TS + Tailwind 3 + React Query + Supabase. Plugin React **SWC** (o plugin Babel quebra no dev neste ambiente).
- `npm run dev`, `npm run build` (roda `tsc --noEmit` antes).
- Projeto Supabase: `nzutayedhkpytmtxoola` (org "Geralindica", sa-east-1). Mudanças de banco: criar migration em `supabase/migrations/` **e** aplicar no projeto.
- Esta pasta fica em `C:\Users\Info\Projetos\geralindica-web` (fora do Google Drive, que quebra o npm).

## Regras de negócio (não quebrar)
- **Verdinho**: transação nasce em `contrato`; `custodia`/`entrevista` = em custódia; `aprovado` = verdinho; `reprovado` = estorno 100%; `repassado` trava a etapa. Tudo em `private.tg_lead_depois`.
- **Split**: `calcularSplit()` em `src/lib/negocio.ts` e a mesma fórmula nas funções SQL (`round(bruto*(1-aliquota/100)*pct/100, 2)`). Nunca escrever valor de comissão à mão no JSX.
- **LGPD**: indicador nunca lê `leads`; só `extrato_indicador()`/`funil_indicador()`/`canais_resumo()`. Dados do cliente sempre mascarados para ele.
- **Vagas**: máx. 30 por consultor (`private.tg_indicador_vaga`). Portabilidade só para quem tem vaga.
- Métricas (`vendas`, `leads_total`, `ocupacao`, `vendas_30d`) são mantidas por trigger; a API não pode escrevê-las (privilégios por coluna).

## Convenções
- Texto da interface em português do Brasil; valores com `brl()`; datas `dd/mm/aaaa`.
- Integrações externas só por `src/integrations/` (hoje simuladas). Segredos de terceiros nunca no front: usar Edge Functions.
- Logo: ainda não existe. A única fonte é `public/marca.svg` (espaço reservado), lida por `src/components/Logo.tsx`, pelo favicon e pelas artes dos QR Codes (`src/pages/indicador/artes.ts`); nome da marca em `src/lib/marca.ts`. Quando a logo chegar, trocar só o `marca.svg`. Paleta: verde (dinheiro/ação principal) + neutros azul-marinho (`ink`), para combinar com a logo verde e azul.
- Cores e espaçamentos dos tokens (`tailwind.config.js` / `src/tokens.css`); status financeiro via `StatusBadge`.
- `window.scrollTo` devolve Promise em navegadores novos: nunca usar como retorno de `useEffect`.
