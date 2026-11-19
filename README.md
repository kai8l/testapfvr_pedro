# NeuroConecta (Expo + TypeScript + Supabase)

## 1. Supabase (back-end)
1. Crie um projeto em https://supabase.com.
2. SQL Editor → rode **`supabase/schema.sql`** e **depois `supabase/02_features.sql`** (pode rodar o 02 mais de uma vez).
   O 02 contém: trava de segurança do Premium, pagamentos, subtarefas, sessões de foco e o cron de vencimento.
3. Authentication → Providers → Email: ligado. Para testar rápido, desative "Confirm email".
4. Recuperação de senha por e-mail: Authentication → Email Templates → "Reset Password" → inclua `{{ .Token }}`
   (ex.: `Seu código: {{ .Token }}`), pois o app pede o código de 6 dígitos.
5. Project Settings → API: copie a *Project URL* e a *anon key*.

### 1.1 Login com Google e Apple
1. **Authentication → URL Configuration → Redirect URLs**: adicione
   `neuroconecta://auth/callback` (build/APK) e, para testar no Expo Go, `exp://**`.
2. **Google**: Google Cloud Console → Credenciais → ID do cliente OAuth tipo *Web*. Em "URIs de redirecionamento autorizados"
   coloque `https://<ref>.supabase.co/auth/v1/callback`. Cole Client ID/Secret em Authentication → Providers → Google.
3. **Apple**: precisa de conta Apple Developer paga. Crie um *Services ID*, uma *Key* (Sign in with Apple) e configure em
   Authentication → Providers → Apple (o *secret* é um JWT que **expira em até 6 meses** — renove).
   Return URL = `https://<ref>.supabase.co/auth/v1/callback`.
   > Para publicar na App Store, considere o login Apple nativo (`expo-apple-authentication` + `signInWithIdToken`); o fluxo atual abre o navegador.

### 1.2 Recuperação de senha por SMS
1. Authentication → Providers → **Phone**: ligue e escolha o provedor (Twilio / Twilio Verify / MessageBird / Vonage). Ajuste validade/tamanho do OTP.
2. O SMS só vai para números **verificados**: o usuário precisa abrir *Perfil → Dados da conta → Verificar telefone* (SMS de confirmação)
   antes de poder recuperar a senha por telefone. Número não verificado = nenhuma conta é criada e nada é enviado.
3. Custo/abuso: SMS é pago. Revise os *rate limits* em Authentication → Rate Limits e considere ligar CAPTCHA.

### 1.3 Pagamento (Mercado Pago)
1. Mercado Pago → Suas integrações → crie uma aplicação. Em **Credenciais de teste** pegue a *Public Key* e o *Access Token*.
2. Instale o CLI do Supabase, faça `supabase login` e `supabase link --project-ref <ref>`.
3. Segredos (NUNCA no app):
   ```bash
   cp supabase/functions/.env.example supabase/functions/.env     # preencha MP_ACCESS_TOKEN (e MP_WEBHOOK_SECRET)
   supabase secrets set --env-file supabase/functions/.env
   ```
4. Deploy:
   ```bash
   supabase functions deploy create-payment
   supabase functions deploy check-payment
   supabase functions deploy mp-webhook --no-verify-jwt     # o Mercado Pago não envia JWT
   ```
5. Painel do MP → Webhooks: URL `https://<ref>.supabase.co/functions/v1/mp-webhook`, evento **Pagamentos**; copie a
   "assinatura secreta" para `MP_WEBHOOK_SECRET` (e rode o `secrets set` de novo). Com o secret definido, notificações sem assinatura válida são recusadas.
6. Preços: a fonte da verdade é `supabase/functions/_shared/mp.ts` (o app só exibe, em `src/lib/payments.ts`). Mantenha os dois iguais.

**Como funciona:** o app tokeniza o cartão direto no Mercado Pago (chave pública) → envia só o token à `create-payment` →
a função cria o pagamento com o valor do servidor → o webhook (e o `check-payment`, usado pelo app como plano B) consulta o
pagamento na API do MP, confere o valor e chama `grant_premium`, que liga `profiles.is_premium` e define `premium_until`.
O usuário **não consegue** mais alterar `is_premium` pelo app (permissão removida no `02_features.sql`).

> O plano é **pré-pago pelo período** (30 dias / 12 meses) e **não renova sozinho**; ao vencer, `is_premium` volta a `false`.
> Renovação automática no cartão exige a API de Assinaturas (preapproval) do Mercado Pago — é outro fluxo.

**Testes (credenciais de teste):** cartão Mastercard `5031 4332 1540 6351`, CVV `123`, validade `11/30`, nome do titular `APRO`
(aprovado) / `OTHE` (recusado) / `CONT` (pendente), CPF `123.456.789-09`.

## 2. App (front-end)
```bash
npm install
npx expo install --fix      # alinha as versões das libs com o SDK 52 (importante após as libs novas)
cp .env.example .env        # preencha URL, ANON KEY e EXPO_PUBLIC_MP_PUBLIC_KEY
npx expo start -c --android # com o emulador do Android Studio aberto
npm run typecheck
```
Login Google/Apple e o retorno `neuroconecta://` funcionam melhor em **development build** (`npx expo run:android`) do que no Expo Go.
Android Studio: abra o AVD Manager, inicie um emulador (API 34+). Para gerar APK: `npx expo run:android` ou EAS Build.

## 3. Logo e ícones do Figma
Exporte em PNG (@3x, fundo transparente), coloque em `src/assets/` e registre em **`src/assets/index.ts`**:
`logo` para a logo; `icons.<nome-do-ícone-Ionicons>` para cada ícone. Tudo no app já passa pelo componente `Icon`
(`src/components/ui.tsx`), que usa a imagem quando existe e cai no Ionicons quando não. Para ícone do app/splash, ajuste `icon`/`splash` em `app.json`.

## Estrutura
- `src/screens/auth.tsx` login (e-mail, Google, Apple), cadastro, recuperação por e-mail e por SMS
- `src/screens/tasks.tsx | agenda.tsx | goals.tsx | finance.tsx` módulos principais (tarefas agora com subtarefas)
- `src/screens/focus.tsx` temporizador Pomodoro + conquista "Foco mestre"
- `src/screens/menu.tsx` menu, conquistas, estatísticas, dicas, FAQ, termos
- `src/screens/account.tsx` perfil, verificação de telefone, configurações, acessibilidade, premium, pagamento
- `src/lib/oauth.ts | mercadopago.ts | payments.ts | br.ts` login social, tokenização do cartão, chamadas às functions, utilitários BR
- `src/context/*` sessão (Supabase Auth) e configurações/tema/acessibilidade
- `supabase/schema.sql` + `supabase/02_features.sql` banco; `supabase/functions/*` Edge Functions

## Pendências conhecidas
- Textos finais de Termos/Privacidade (placeholders em `menu.tsx`)
- Recursos Premium ainda não são bloqueados no app (nada consulta `is_premium` para limitar uso)
- Assinatura recorrente automática (ver nota acima); boleto e carteiras digitais foram removidos da tela de pagamento
