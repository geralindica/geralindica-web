# Integrações externas

Tudo o que depende de serviços de terceiros passa por `src/integrations/index.ts`. Hoje as funções rodam em **modo simulado**: gravam no banco o que teria acontecido (histórico do lead, status, saque), sem chamar o serviço real. Para ligar uma integração, troque só o corpo da função; as telas continuam iguais.

| Integração | Função | Hoje (simulado) | Para ativar |
|---|---|---|---|
| QR Code → WhatsApp | rota `/q/:codigo` + `registrar_escaneamento()` | **Real.** Conta o escaneamento e abre o `wa.me` com a mensagem e o código do canal | Cadastrar o número oficial em Admin → Split e impostos → WhatsApp da operação |
| Robô do WhatsApp (triagem) | `registrar_lead_whatsapp()` no banco | Consultor/admin cria o lead pelo botão "Simular lead do WhatsApp" | Webhook do ManyChat / API da Meta (Edge Function) chamando `POST /rest/v1/rpc/registrar_lead_whatsapp` com a chave *service role*. Parâmetros: `p_codigo` (código do canal na mensagem), `p_nome`, `p_telefone`, `p_triagem` (JSON com as respostas), `p_triagem_passo` (0–7), `p_abandonou` (manda para a fila de recuperação 48h) e `p_consultor` quando não houver código. **Já aceita a chave de servidor (testado).** |
| Reenviar cotação / reengajar | `reenviarCotacao`, `reengajarLead` | Registra no histórico do lead | Templates aprovados na API oficial do WhatsApp |
| Cotaí | `gerarNovaCotacao` | Estima a mensalidade localmente e registra o envio | Login com as credenciais da corretora e geração do PDF (em Edge Function, nunca no navegador) |
| Administradora | `pedirDescontoAdministradora` | Marca o lead com desconto "solicitado" | E-mail/API da Administradora |
| Gov.br | `assinarContratoGovBr` | Simula o retorno e grava a data de assinatura | Credenciamento no Assinador Gov.br |
| Pix / gateway | `sacarViaPix` → `solicitar_saque()` | Marca as comissões como repassadas na hora | Gateway (Stripe, PicPay ou banco) + webhook de confirmação |

Credenciais de serviços (Cotaí, Meta, gateway) **nunca** vão para o front-end: devem ficar em Supabase Edge Functions com secrets.
