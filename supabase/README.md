# Banco e Edge Functions

## A regra que nao se quebra

**Migration aplicada nunca mais e editada.** Se algo precisa mudar, nasce uma
migration nova. Como existe um banco so, e ele e o de producao, editar um
arquivo que ja rodou cria uma diferenca invisivel entre o que esta no Git e o
que esta no Postgres, e essa diferenca so aparece no pior momento possivel.

## Como nasce uma migration

```
npx supabase migration new nome_do_que_muda
```

Isso cria `supabase/migrations/<timestamp>_nome_do_que_muda.sql`. Escreva o SQL
a mao. O timestamp e a ordem de aplicacao, entao nunca renomeie o arquivo.

Escreva sempre de forma reaplicavel onde der (`create ... if not exists`,
`on conflict do nothing`). Se a esteira falhar no meio, a segunda tentativa
precisa passar.

## Como uma migration chega no banco

Nao existe Docker nem banco local neste projeto.

1. Abra um pull request. A action `Banco` roda `db push --dry-run` e mostra o
   que seria aplicado, sem tocar em nada.
2. Faca o merge em `main`. A mesma action aplica de verdade e, em seguida,
   publica as Edge Functions.

Aplicar direto pelo SQL Editor do painel funciona, mas deixa o Git mentindo.
Use so em emergencia, e depois traga a mesma mudanca para uma migration.

## Segredos que a action precisa

Em Settings, Secrets and variables, Actions do repositorio:

| Segredo | Onde encontrar |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Conta do Supabase, Access Tokens |
| `SUPABASE_PROJECT_REF` | Project Settings, General, Reference ID |
| `SUPABASE_DB_PASSWORD` | A senha do banco, definida na criacao do projeto |

O ambiente `producao` do GitHub existe para poder exigir aprovacao antes de
aplicar, se um dia voce quiser essa trava.

## Onde vive cada segredo

Nada de segredo entra no Vercel nem no `.env` da aplicacao.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ja chegam
injetados em toda Edge Function, sem precisar cadastrar.

O token da uazapi e diferente: cada assinante tem a sua instancia, entao o token
nao pode ser um valor global de funcao. Ele fica **cifrado no Vault**, uma linha
por instancia, e a tabela `instancias_whatsapp` guarda so o id do segredo.

Quem cadastra, no caminho normal, e a Edge Function `whatsapp-instancia`, quando
o assinante clica em "Conectar o WhatsApp" em Ajustes. As funcoes abaixo existem
para o caso de precisar mexer na mao:

- Cadastrar: `select public.registrar_instancia_whatsapp(rotulo, host, token, observacao, assinatura_id);`
- Trocar: `select public.trocar_token_instancia(id, novo_token);`
- Esquecer: `public.esquecer_instancia_whatsapp(id)` apaga a linha e o segredo
  junto, e so a `service_role` executa. E o que desentala uma conta cuja
  instancia sumiu do lado da uazapi.
- Ler: `public.token_da_instancia(id)`, com `execute` concedido apenas a
  `service_role`. E a unica porta de saida do token, e ela so abre de dentro da
  Edge Function.

O **admintoken** da uazapi, esse sim, e segredo de funcao: e um so para a
plataforma inteira, e e com ele que a instancia de cada assinante e criada.

```
npx supabase secrets set UAZAPI_HOST=https://SEUSERVIDOR.uazapi.com --project-ref SEUREF
npx supabase secrets set UAZAPI_ADMIN_TOKEN=... --project-ref SEUREF
```

A chave do Google e o outro caso, e o oposto do da uazapi: ela e a mesma para a
plataforma inteira, nao muda por assinante, entao e segredo de funcao mesmo.

```
npx supabase secrets set GOOGLE_PLACES_API_KEY=... --project-ref SEUREF
```

E uma chave de **Places API (New)**, restrita a essa API so, com teto diario de
requisicoes no console do Google. Sem restricao por IP nem por referrer, porque
a funcao sai de IP dinamico e a chamada nao parte do navegador: o que protege e
a chave nunca sair daqui.

Se um dia surgir outro token de terceiro que seja mesmo global, ai sim vale
`npx supabase secrets set CHAVE=valor --project-ref SEUREF`.

## Migrations existentes

| Arquivo | O que faz |
| --- | --- |
| `20260822120000_esquema_inicial.sql` | Tipos, tabelas, RLS e o bucket das artes |
| `20260822120100_dados_iniciais.sql` | Tamanhos A6 e A5, as oito variantes e os modelos de mensagem |
| `20260822180000_instancias_whatsapp.sql` | Instancias da uazapi, com o token cifrado no Vault |
