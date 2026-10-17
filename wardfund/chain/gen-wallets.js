
const fs = require("fs");
const path = require("path");
const { Keypair } = require("@solana/web3.js");

const outputPath = path.join(__dirname, "wallets.json");

if (fs.existsSync(outputPath)) {
  console.error("wallets.json already exists. Refusing to overwrite it.");
  process.exit(1);
}

const projects = [
  "greener-neighbourhoods",
  "cleaner-streets",
  "community-programs",
];

const wallets = {};

for (const project of projects) {
  const keypair = Keypair.generate();

  wallets[project] = {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: Array.from(keypair.secretKey),
  };
}

fs.writeFileSync(
  outputPath,
  JSON.stringify(wallets, null, 2),
  { mode: 0o600, flag: "wx" }
);

console.log("Generated project wallets successfully.\n");

for (const [project, wallet] of Object.entries(wallets)) {
  console.log(`${project}: ${wallet.publicKey}`);
}

console.log("\nPrivate keys are saved in wallets.json.");
console.log("Never share this file or commit it to Git.");
