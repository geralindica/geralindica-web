# Geralindica · notas para o Claude

Plataforma de indicações de planos de saúde ("Hotmart das indicações"). Sócios: Eduardo e Luis Novinho. Especificação completa no Obsidian: `Eduardo/Projetos/Geralindica/` (o projeto se chamava Indikei até 23/10/2026). Design original: `G:\Meu Drive\Luis Novinho\Geralindica\geralindica-design-system-pronto` (Claude Design).

## Stack e comandos
- Vite + React 19 + TS + Tailwind 3 + React Query + Supabase. Plugin React **SWC** (o plugin Babel quebra no dev neste ambiente).
- `npm run dev`, `npm run build` (roda `tsc --noEmit` antes).
- Projeto Supabase: `nzutayedhkpytmtxoola` (org "Geralindica", sa-east-1). Mudanças de banco: criar migration em `supabase/migrations/` **e** aplicar no projeto.
- Esta pasta fica em `C:\Users\Info\Projetos\geralindica-web` (fora do Google Drive, que quebra o npm).

## Regras de negócio (não quebrar)
- **Modelo de 27/10/2026** (Obsidian: "Geralindica - Modelo de negócio (corrigido 27-10-2026)"): a plataforma **não atende o cliente e não movimenta dinheiro**. Sem robô de WhatsApp, Cotaí, reengajamento, custódia, saque ou chave Pix. O consultor atende, recebe, segura até o Verdinho, devolve se reprovado e faz os Pix (indicador e Geralindica) por fora. O admin só acompanha.
- **Vendas**: o consultor registra pela RPC `registrar_venda()` (uma por lead; status `aguardando_entrevista`/`aprovado`/`reprovado`). Só aceita código de indicador da própria carteira. A etapa do lead acompanha a venda. Leads novos: `criar_lead()`.
- **Split**: só configuração (`config_split`, vazio = a definir; nada fixo no código). Estimativa do indicador em `private.estimativa_indicador()` e `calcularSplit()` (`src/lib/negocio.ts`). Sempre mostrar como informativa.
- **Temperatura**: `consultores.temperatura` (0–100), calculada só em `private.calcular_temperatura()` (fórmula PROVISÓRIA). Faixas de exibição em `faixaTemperatura()`.
- **LGPD**: indicador nunca lê `leads` nem `vendas`; só `vendas_indicador()`/`funil_indicador()`/`canais_resumo()`. Venda guarda só o primeiro nome do cliente.
- Qualquer mudança de banco: rodar `npm run test:banco` (e `npm run test:seed`) antes.
- **Vagas**: máx. 30 por consultor (`private.tg_indicador_vaga`). Portabilidade só para quem tem vaga.
- Métricas (`vendas`, `leads_total`, `ocupacao`, `vendas_30d`) são mantidas por trigger; a API não pode escrevê-las (privilégios por coluna).

## Convenções
- Texto da interface em português do Brasil; valores com `brl()`; datas `dd/mm/aaaa`.
- Integrações externas só por `src/integrations/` (hoje: link do WhatsApp real e Gov.br simulado). Segredos de terceiros nunca no front: usar Edge Functions.
- Logo: ainda não existe. A única fonte é `public/marca.svg` (espaço reservado), lida por `src/components/Logo.tsx`, pelo favicon e pelas artes dos QR Codes (`src/pages/indicador/artes.ts`); nome da marca em `src/lib/marca.ts`. Quando a logo chegar, trocar só o `marca.svg`. Paleta: verde (dinheiro/ação principal) + neutros azul-marinho (`ink`), para combinar com a logo verde e azul.
- Cores e espaçamentos dos tokens (`tailwind.config.js` / `src/tokens.css`); status da venda via `StatusBadge`, temperatura via `TemperaturaBadge`.
- `window.scrollTo` devolve Promise em navegadores novos: nunca usar como retorno de `useEffect`.
