module.exports = {
  apps: [
    {
      name: "bbtown",
      script: "server.ts",
      interpreter: "node",
      interpreter_args: "--loader ts-node/esm", // Wichtig für ESM Support
      env: {
        NODE_ENV: "production",
        PORT: 3004,
        DATABASE_URL: "file:./dev.db"
      }
    }
  ]
};