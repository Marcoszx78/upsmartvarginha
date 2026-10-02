# Up Smart na Vercel

Produção: https://upsmartvarginha.vercel.app

O projeto Vercel `upsmartvarginha`, da equipe `angel-2701`, usa o Supabase já conectado à integração `supabase-cyan-apple`. O repositório conectado é `https://github.com/Marcoszx78/upsmartvarginha`; o remoto local `origin` aponta para outro repositório e não deve ser usado por engano para atualizar esta publicação.

## Configuração

Segredos de servidor exigidos: `POSTGRES_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`), `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`. A senha administrativa fica como hash bcrypt. Nunca colocar valores secretos nos arquivos, no navegador ou no Git.

`npm run build:vercel` gera a aplicação com páginas incorporadas. Todas as rotas passam por `api/index.js`; o HTML administrativo não é disponibilizado diretamente. A versão Vercel da página de privacidade identifica Vercel e Supabase.

O PostgreSQL usa o schema isolado `upsmart`, inicializado de forma aditiva, com RLS e sem permissão pública no schema. O adaptador mantém transações e conflitos de versão do aplicativo. O certificado público em `scripts/supabase-ca.crt` veio do endereço oficial indicado no código do Supabase: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt. A conexão verifica o certificado e o nome do servidor.

As fotos ficam no bucket privado `upsmart-media`. A aplicação publica somente fotos de produtos e exige sessão para fotos de perfil. Dados e fotos não ficam no armazenamento temporário da Vercel.

## Publicação e verificação

```sh
npm ci
npm run build:vercel
npm test
npx vercel link --project upsmartvarginha --scope angel-2701
npx vercel deploy --dry --json
npx vercel deploy --prod
```

Conferir que a lista de arquivos não inclui `.env*`, `work`, `outputs`, banco local, cópias de dados ou credenciais. `.vercelignore` faz essa exclusão explicitamente. Arquivos de trabalho não devem ser enviados nem colocados em variáveis de ambiente.

Em 2 de outubro de 2026 foram importados cinco produtos, suas fotos (sete arquivos), detalhes, conteúdo de avaliações e tema escuro. Os produtos conservaram IDs, estoque, preços e estado arquivado. Apenas o acesso administrativo foi migrado; contas, sessões e dados pessoais de clientes não foram importados.

## Voltar uma publicação

Use o histórico de Deployments da Vercel para restaurar uma versão anterior do código. Isso não restaura o banco nem as fotos. Antes de alterações nos dados, faça uma cópia independente no Supabase. O site anterior em Sites permanece separado.
