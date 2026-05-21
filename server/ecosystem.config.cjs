// Config do pm2 — gerenciador de processos que mantém o server vivo,
// reinicia se cair, e dá auto-start no boot do VPS.
//
// Comandos úteis (rodar dentro de /var/www/barreira/server no VPS):
//   pm2 start ecosystem.config.cjs    # inicia
//   pm2 logs barreira-server          # vê logs em tempo real
//   pm2 restart barreira-server       # reinicia (ex: depois de git pull)
//   pm2 stop barreira-server          # para
//   pm2 save && pm2 startup           # auto-start no boot (rodar 1 vez só)

module.exports = {
  apps: [
    {
      name: "barreira-server",
      // Roda via npm run start (que é "tsx src/index.ts"). Funciona sem
      // build step — tsx interpreta TS direto. Quando a base ficar maior,
      // dá pra trocar por build estático sem mexer nessa config.
      script: "npm",
      args: "run start",
      cwd: __dirname,

      // Restart automático: até 10 tentativas em 1 min antes de desistir.
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",

      // Memória limite — se vazar acima disso, pm2 reinicia.
      max_memory_restart: "512M",

      // Logs separados pra debug ficar fácil.
      out_file: "./logs/out.log",
      error_file: "./logs/err.log",
      time: true,

      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
