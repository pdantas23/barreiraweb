# Deploy do Barreira

Cheatsheet pro VPS Ubuntu 22.04 com Node + pm2 + nginx (já instalados).

## Variáveis usadas neste guia

- VPS IP: `129.121.52.119`
- SSH: `ssh -p 22022 root@129.121.52.119`
- Domínio temporário: `129-121-52-119.sslip.io` (sslip.io resolve sozinho pro IP)
- Diretório do app no VPS: `/var/www/barreira`

## 1. Arquiva o myfollowers antigo

```bash
# Confere se está no pm2
pm2 list

# Para o processo (se aparecer myfollowers na lista)
pm2 stop myfollowers && pm2 delete myfollowers

# Arquiva os arquivos
mv /var/www/myfollowers /root/_archive_myfollowers

# Remove do nginx se tiver site enabled
ls /etc/nginx/sites-enabled/
# (se houver myfollowers.conf ou similar, remove o symlink:)
# rm /etc/nginx/sites-enabled/myfollowers
nginx -t && systemctl reload nginx
```

## 2. Clona o repo

```bash
cd /var/www
git clone git@github.com:SEU_USER/barreira.git
cd barreira
npm install
```

(Pra `git clone` SSH funcionar, precisa de chave SSH no VPS adicionada ao GitHub —
ver "Setup SSH key no VPS" abaixo.)

## 3. Configura .env

```bash
cd /var/www/barreira/server
cp .env.example .env
# edita se quiser ajustar valores (default já é bom pra prod)
```

## 4. Sobe o server via pm2

```bash
cd /var/www/barreira/server
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 logs barreira-server   # confere se subiu
```

Auto-start no boot:

```bash
pm2 save
pm2 startup
# pm2 vai imprimir um comando — copia e cola pra executar
```

Teste local (no próprio VPS):

```bash
curl http://localhost:3000/health
# {"ok":true,"ts":...}
```

## 5. Configura o nginx

```bash
# Copia o template do repo pro sites-available
cp /var/www/barreira/deploy/nginx/barreira.conf /etc/nginx/sites-available/barreira

# Habilita
ln -s /etc/nginx/sites-available/barreira /etc/nginx/sites-enabled/

# Testa e recarrega
nginx -t
systemctl reload nginx
```

Teste pelo IP público (do seu PC):

```bash
curl http://129-121-52-119.sslip.io/nginx-health   # ok do nginx
curl http://129-121-52-119.sslip.io/health         # ok do node
```

## 6. Instala TLS via Let's Encrypt

```bash
apt update
apt install -y certbot python3-certbot-nginx

certbot --nginx -d 129-121-52-119.sslip.io
# Aceita os termos, dá um email, escolhe redirect HTTP→HTTPS
```

Teste:

```bash
curl https://129-121-52-119.sslip.io/health
```

Renovação automática (certbot configura cron sozinho, mas confirma):

```bash
systemctl status certbot.timer
certbot renew --dry-run
```

## 7. Atualiza o app mobile

No PC, edita `mobile/.env`:

```
EXPO_PUBLIC_SERVER_URL=https://129-121-52-119.sslip.io
```

Restart o Expo (`Ctrl+C` no terminal do `expo start` e roda de novo).

## Setup SSH key no VPS (uma vez só)

```bash
# No VPS:
ssh-keygen -t ed25519 -C "vps@hostgator-barreira"
# (enter pra senha em branco quando perguntar)
cat ~/.ssh/id_ed25519.pub
```

Copia o output e cola em GitHub → Settings → SSH and GPG keys → New SSH key.

Testa: `ssh -T git@github.com` deve dizer "Hi USER!".

## Updates futuros (após mudanças no código)

```bash
cd /var/www/barreira
git pull
npm install        # só se package.json mudou
cd server
pm2 restart barreira-server
```

## Comandos úteis

```bash
pm2 list                          # status
pm2 logs barreira-server --lines 100   # últimos logs
pm2 restart barreira-server
pm2 monit                         # dashboard ao vivo
journalctl -u nginx -f            # logs nginx
nginx -t                          # valida config
```
