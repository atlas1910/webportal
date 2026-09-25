# Passo a Passo: Publicando o ATLAS1910 no GitHub e na Vercel

Este guia foi feito especialmente para quem está começando do zero. Ao final destes 3 passos simples, o seu geoportal estará no ar com link público (ex: `atlas1910.vercel.app`) para você divulgar para a Fiel Torcida!

---

## 🧭 Visão Geral

```
[Seu Computador] ──(Sobe o código)──> [GitHub] ──(Vercel lê o GitHub)──> [Site no ar]
```

Toda vez que você adicionar uma camada nova no seu computador e subir para o GitHub, a **Vercel atualiza o seu site automaticamente em menos de 1 minuto**!

---

## 1️⃣ Passo 1: Criar o Repositório no GitHub

1. Acesse [github.com](https://github.com/) e faça login (ou crie uma conta gratuita se não tiver).
2. No canto superior direito, clique no botão **`+`** e selecione **"New repository"** (Novo repositório).
3. Preencha as informações:
   - **Repository name**: `atlas1910` (ou o nome que preferir)
   - **Public**: Deixe marcado como público para que a Vercel gratuita possa acessar.
   - **NÃO** precisa marcar "Add a README file" nem `.gitignore` (já criamos esses arquivos para você!).
4. Clique no botão verde **"Create repository"**.
5. Mantenha essa página aberta! Ela mostrará o link do seu repositório (ex: `https://github.com/seu-usuario/atlas1910.git`).

---

## 2️⃣ Passo 2: Subir o Projeto para o GitHub

Você pode fazer isso de duas formas (escolha a que achar mais fácil):

### Opção 1: Pelo Navegador (Sem Instalar Nada)
1. No repositório recém-criado no [GitHub](https://github.com/), clique no link **"uploading an existing file"** (está logo abaixo de "Quick setup").
2. Abra a pasta do projeto no seu computador:
   `C:\Users\Felipe\.gemini\antigravity\scratch\atlas1910_geoportal`
3. Selecione todos os arquivos e pastas e arraste para dentro da janela do GitHub no navegador.
4. Na parte inferior, clique no botão verde **"Commit changes"**. Pronto!

---

### Opção 2: Pelo GitHub Desktop (Aplicativo Visual Recomendado)
Se você for atualizar as camadas com frequência, o GitHub Desktop é a forma mais prática:
1. Baixe e instale o [GitHub Desktop](https://desktop.github.com/) (gratuito e em português).
2. Faça login com sua conta do GitHub.
3. Clique em **File** ➔ **Add Local Repository...** e selecione a pasta:
   `C:\Users\Felipe\.gemini\antigravity\scratch\atlas1910_geoportal`
4. Se ele disser que o repositório ainda não foi criado, clique em **"create a repository"**.
5. Clique no botão azul **"Publish repository"** no topo da tela. Pronto, seu projeto está no GitHub!

---

## 3️⃣ Passo 3: Colocar no Ar na Vercel

1. Acesse [vercel.com](https://vercel.com/) e clique em **"Sign Up"** ou **"Log In"**.
2. Escolha **"Continue with GitHub"** (isso conecta sua conta do GitHub à Vercel).
3. No painel inicial da Vercel, clique no botão **"Add New..."** ➔ **"Project"**.
4. Você verá a lista de repositórios do seu GitHub. Encontre o `atlas1910` e clique em **"Import"**.
5. Na tela seguinte:
   - A Vercel já detectará que é um projeto estático (`Framework Preset: Other`).
   - Você não precisa alterar nenhuma configuração!
6. Clique no botão **"Deploy"**.
7. Aguarde cerca de 20 segundos enquanto a tela exibe confetes 🎉!

---

## 🌐 Seu Site Está no Ar!
A Vercel gerará um link gratuito como:
👉 `https://atlas1910.vercel.app` (ou similar)

Você pode abrir no celular, mandar para amigos ou compartilhar em redes sociais. Qualquer pessoa poderá interagir com o mapa, mas ninguém terá acesso a botões de download dos dados originais.

---

## 🔄 Como atualizar o site quando você adicionar novas camadas do QGIS?
Sempre que você exportar uma nova camada do QGIS e colocá-la no `js/camadas.js`, basta enviar para o GitHub:
```bash
git add .
git commit -m "Nova camada adicionada"
git push
```
A Vercel atualizará o site online instantaneamente e de forma automática!
