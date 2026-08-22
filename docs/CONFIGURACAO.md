# Como colocar o Eucodo Vendas de pe

O codigo compila e passa no typecheck, mas ainda nao existe banco. Estes sao os
passos, na ordem, para o sistema funcionar de verdade.

Uma decisao vale entender antes: **a aplicacao nao guarda segredo nenhum**. Ela
so conhece a URL do Supabase e a chave publica, que aparecem no navegador de
qualquer jeito. Chave de servico e token de terceiro vivem em Edge Function, do
lado do Supabase. E por isso que `.env.example` e tao curto.

## 1. Criar o projeto no Supabase

Crie um projeto novo, regiao South America. Anote, de Project Settings:

- **Project URL** e **Publishable key**, em API
- **Reference ID**, em General
- A **senha do banco** que voce escolheu na criacao

Como existe um projeto so, ele e producao. Nao ha ambiente de teste.

## 2. Preencher o `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=https://SEUPROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Em producao, `NEXT_PUBLIC_SITE_URL` vira o dominio real. As mesmas tres
variaveis vao no projeto da Vercel.

## 3. Cadastrar os segredos do GitHub

Em Settings, Secrets and variables, Actions:

| Segredo | Onde encontrar |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Conta do Supabase, Access Tokens |
| `SUPABASE_PROJECT_REF` | Project Settings, General, Reference ID |
| `SUPABASE_DB_PASSWORD` | A senha do banco |

## 4. Aplicar as migrations

Nao usamos Docker nem banco local. As migrations vao pela esteira:

- **Pull request** roda `supabase db push --dry-run` e mostra o que seria
  aplicado, sem tocar em nada. Como nao ha banco de teste, esse dry-run e o
  portao de qualidade.
- **Merge em `main`** aplica de verdade e publica as Edge Functions.

Na primeira vez, o push inicial em `main` ja dispara a aplicacao das duas
migrations que existem hoje. Detalhes e a regra de nunca editar migration
aplicada estao em `supabase/README.md`.

## 5. Ajustar a autenticacao

Em Authentication, URL Configuration:

- Site URL: o dominio de producao (e `http://localhost:3000` enquanto so existe local)
- Redirect URLs: adicione `/auth/callback` de cada endereco que voce usar

Em Authentication, Providers, Email: desligue "Confirm email". O acesso ja e
controlado pela liberacao do administrador, e pedir confirmacao de e-mail so
atrasaria quem vai usar o painel.

## 6. Criar a sua conta e virar administrador

Suba com `npm run dev`, acesse `/criar-conta` e cadastre-se. A conta nasce como
`pendente` e nao entra. Rode isto uma unica vez no SQL Editor:

```sql
update public.perfis
set status = 'ativo', papel = 'admin'
where email = 'eucodosolutions@gmail.com';
```

Dai em diante voce libera as proximas contas pelo painel.

## 7. Cadastrar a instancia do WhatsApp

O envio funciona sem isso: sem instancia conectada, o painel devolve um botao
que abre o WhatsApp com a mensagem pronta e voce manda na mao. Cadastrar a
instancia e o que faz a mensagem sair sozinha, com a arte anexada.

O token fica cifrado no Vault do Supabase, e a tabela guarda so o id do
segredo. Quem decifra e uma funcao que so a chave de servico executa, ou seja,
so a Edge Function de envio. No SQL Editor:

```sql
select public.registrar_instancia_whatsapp(
  'Eucodo',
  'https://eucodosolutions.uazapi.com',
  'TOKEN_DA_INSTANCIA'
);

update public.configuracoes
set instancia_id = (select id from public.instancias_whatsapp order by criado_em desc limit 1)
where id = true;
```

Para trocar o token depois, sem criar segredo orfao:

```sql
select public.trocar_token_instancia('ID_DA_INSTANCIA', 'NOVO_TOKEN');
```

Antes de cada envio a funcao consulta `GET /instance/status` na uazapi. Se a
instancia estiver desconectada, ou se voce marcar `ativo = false` porque o
assinante parou de pagar, o sistema volta sozinho para o link manual. Nenhuma
venda depende da API estar de pe.

## 8. Conferir o caminho todo

1. Entre em `/vender`
2. Escolha tamanho, tecnologia e cor, veja o preco
3. Preencha nome do negocio, WhatsApp e link de avaliacao
4. Feche o pedido

Voce deve cair na pagina do pedido com a arte gerada, o botao de baixar o JPG e
o aviso de que a mensagem saiu (ou o botao para manda-la na mao). Se a arte nao
aparecer, use "Gerar a arte" na propria pagina: o pedido nunca e perdido por
falha de renderizacao.

## Comandos

| Comando | Para que serve |
| --- | --- |
| `npm run dev` | Sobe o sistema em desenvolvimento |
| `npm run build:check` | Valida o build sem mexer no `.next` do dev |
| `npm run typecheck` | So os tipos |
| `npm run arte:previa` | Gera as artes de amostra em `.preview/` |
| `npm run arte:aprovacao` | Remonta a pagina de aprovacao da arte |

## O que ainda falta

- PIX copia e cola junto da arte
- Busca do link de avaliacao pelo nome do negocio (Google Places)
- Link publico de catalogo e de pedido
- Tela de ajustes: precos, tamanhos, modelos de mensagem e liberacao de contas
