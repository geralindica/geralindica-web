# Indikei · notas para o Claude

Plataforma de indicações de planos de saúde ("Hotmart das indicações"). Sócios: Eduardo e Luis Novinho. Especificação completa no Obsidian: `Eduardo/Projetos/Indikei/`. Design original: `G:\Meu Drive\Luis Novinho\Indikei\indikei-design-system-pronto` (Claude Design).

## Stack e comandos
- Vite + React 19 + TS + Tailwind 3 + React Query + Supabase. Plugin React **SWC** (o plugin Babel quebra no dev neste ambiente).
- `npm run dev`, `npm run build` (roda `tsc --noEmit` antes).
- Projeto Supabase: `nzutayedhkpytmtxoola` (org "Eduardo's", sa-east-1). Mudanças de banco: criar migration em `supabase/migrations/` **e** aplicar no projeto.
- Esta pasta fica em `C:\Users\Info\Projetos\indikei-web` (fora do Google Drive, que quebra o npm).

## Regras de negócio (não quebrar)
- **Verdinho**: transação nasce em `contrato`; `custodia`/`entrevista` = em custódia; `aprovado` = verdinho; `reprovado` = estorno 100%; `repassado` trava a etapa. Tudo em `private.tg_lead_depois`.
- **Split**: `calcularSplit()` em `src/lib/negocio.ts` e a mesma fórmula nas funções SQL (`round(bruto*(1-aliquota/100)*pct/100, 2)`). Nunca escrever valor de comissão à mão no JSX.
- **LGPD**: indicador nunca lê `leads`; só `extrato_indicador()`/`funil_indicador()`/`canais_resumo()`. Dados do cliente sempre mascarados para ele.
- **Vagas**: máx. 30 por consultor (`private.tg_indicador_vaga`). Portabilidade só para quem tem vaga.
- Métricas (`vendas`, `leads_total`, `ocupacao`, `vendas_30d`) são mantidas por trigger; a API não pode escrevê-las (privilégios por coluna).

## Convenções
- Texto da interface em português do Brasil; valores com `brl()`; datas `dd/mm/aaaa`.
- Integrações externas só por `src/integrations/` (hoje simuladas). Segredos de terceiros nunca no front: usar Edge Functions.
- Cores e espaçamentos dos tokens (`tailwind.config.js` / `src/tokens.css`); status financeiro via `StatusBadge`.
- `window.scrollTo` devolve Promise em navegadores novos: nunca usar como retorno de `useEffect`.
