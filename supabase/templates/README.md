# Modelos de e-mail (Supabase Auth)

Colar em Supabase → **Authentication → Emails → Templates**:

| Arquivo | Template | Assunto |
|---|---|---|
| `1-confirmacao-cadastro.html` | Confirm signup | `Confirme seu e-mail — Geralindica` |
| `2-recuperacao-senha.html` | Reset password | `Redefinir sua senha — Geralindica` |

Abrir o arquivo no Bloco de Notas, copiar tudo e colar em **Message body**. Não mexer em `{{ .ConfirmationURL }}` e `{{ .Email }}`.

## Envio (SMTP)
Hoje: **Brevo** (grátis, 300 e-mails por dia), remetente `nao-responda@geralindica.com.br`, nome **Geralindica**.
Supabase → Authentication → Emails → SMTP Settings: host `smtp-relay.brevo.com`, porta `587`, usuário e senha (chave SMTP) do painel do Brevo.
Depois subir o limite em Authentication → Rate Limits → "Emails sent per hour".

Quando houver clientes: migrar para o Resend (mesmo passo a passo, host `smtp.resend.com`).
