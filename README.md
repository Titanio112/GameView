# GameView

Plataforma de comunidade gamer para descobrir, avaliar e compartilhar resenhas de jogos.

## Stack

- **Frontend:** Vanilla HTML/CSS/JavaScript (ES Modules)
- **Backend:** Supabase (Auth + Database + Realtime)
- **API de Jogos:** RAWG Video Games Database API
- ** Hospedagem:** Estático (localhost:3000 via `npx serve .`)

## Funcionalidades

- **Resenhas:** Criar, ler e comentar resenhas de jogos com sistema de notas (1-5 estrelas)
- **Feed:** Feed de resenhas com filtragem por gênero e trending semanal
- **Catálogo:** Explorar jogos populares, lançamentos recentes e detalhes completos
- **Carousel:** Destaques de jogos com alta avaliação na página inicial
- **Perfil:** Editar perfil com avatar, bio, pronomes e jogos favoritos
- **Auth:** Login/cadastro com e-mail e senha, recuperação de senha, confirmação por e-mail
- **Busca:** Busca de jogos integrada com a RAWG API
- **LFG:** Sistema de procura de grupo para jogos (em desenvolvimento)
- **Biblioteca:** Controle de jogos do usuário (em desenvolvimento)
- **Notificações:** Sistema de notificações em tempo real (em desenvolvimento)

## Como Rodar

```bash
npx serve .
```

Acesse http://localhost:3000

## Estrutura do Projeto

```
GameView/
├── index.html          # Página principal com todas as seções
├── css/
│   ├── base.css        # Variáveis globais, reset, scrollbar
│   ├── layout.css      # Header, navegação, layout geral
│   ├── components.css  # Cards, modais, formulários, tags
│   └── pages.css       # Carousel, vitrines, páginas, responsivo
├── js/
│   ├── config.js       # Configuração Supabase e RAWG API
│   ├── main.js         # Inicialização, navegação, event delegation
│   ├── auth.js         # Autenticação (login, signup, logout, sessão)
│   ├── api.js          # Chamadas RAWG e operações Supabase
│   ├── ui.js           # Utilitários de UI (toasts, modais, skeleton)
│   ├── games.js        # Cards de jogos, carousel, vitrines
│   ├── reviews.js      # Resenhas, comentários, validação
│   ├── social.js       # Sistema social (em desenvolvimento)
│   ├── library.js      # Biblioteca do usuário (em desenvolvimento)
│   ├── lfg.js          # LFG - Looking for Group (em desenvolvimento)
│   └── notifications.js # Notificações (em desenvolvimento)
├── assets/             # Ícones e imagens
└── docs/               # Documentação
```

## Configuração

### Supabase

As credenciais do Supabase estão configuradas em `js/config.js`. Para usar seu próprio projeto:

1. Crie um projeto no [Supabase](https://supabase.com)
2. Atualize `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `js/config.js`
3. Execute as migrações do banco de dados
4. Habilite o provider de e-mail em Authentication > Providers

### RAWG API

A API key do RAWG está em `js/config.py`. Para usar sua própria chave:

1. Crie uma conta no [RAWG](https://rawg.io/apidocs)
2. Gere uma API key
3. Atualize `RAWG_CONFIG.apiKey` em `js/config.js`

## Licença

Projeto para fins educacionais.
