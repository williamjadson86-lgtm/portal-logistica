const { execFile } = require("child_process");
const path = require("path");

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(__dirname, scriptName)], (error, stdout, stderr) => {
      if (stdout) {
        process.stdout.write(stdout);
      }

      if (stderr) {
        process.stderr.write(stderr);
      }

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function main() {
  await runScript("dbMigrate.js");
  await runScript("dbSeed.js");
}

main().catch((error) => {
  console.error("Falha ao inicializar o banco:", error.message);
  process.exit(1);
});
