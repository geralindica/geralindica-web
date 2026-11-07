# Integrações externas

Tudo o que depende de serviços de terceiros passa por `src/integrations/index.ts`. Para ligar uma integração, troque só o corpo da função; as telas continuam iguais.

Desde o modelo de 27/10/2026 a Geralindica **não atende o cliente e não movimenta dinheiro**: não há robô de WhatsApp, Cotaí, gateway de Pix nem saque. O consultor faz o atendimento e os Pix (para o indicador e para a Geralindica) por fora, e só **registra a venda** na plataforma.

| Integração | Função | Hoje | Para ativar |
|---|---|---|---|
| QR Code → WhatsApp | rota `/q/:codigo` + `registrar_escaneamento()` | **Real.** Conta o escaneamento e abre o `wa.me` do **consultor do indicador** com a mensagem e o código do canal (sem telefone cadastrado, usa o número geral de Admin → Split) | Consultor cadastrar o WhatsApp no perfil |
| Gov.br | (manual) `src/components/painel/Contrato.tsx` | A pessoa assina o PDF em assinador.iti.br e envia; o admin confere em Usuários | Depois: ZapSign ou Clicksign (automático, pago) |

Credenciais de serviços **nunca** vão para o front-end: devem ficar em Supabase Edge Functions com secrets.
