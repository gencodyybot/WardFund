const fs = require("fs");
const path = require("path");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const WALLET_FILE = path.join(__dirname, "wallets.json");
const PROJECTS = [
  "greener-neighbourhoods",
  "cleaner-streets",
  "community-programs",
];

async function main() {
  const [projectId, amountArg] = process.argv.slice(2);
  const amount = Number(amountArg);

  if (!PROJECTS.includes(projectId)) {
    throw new Error(
      `Project must be one of: ${PROJECTS.join(", ")}`
    );
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > 0.1) {
    throw new Error("Amount must be greater than 0 and at most 0.1 SOL.");
  }

  if (!fs.existsSync(WALLET_FILE)) {
    throw new Error("wallets.json not found. Generate the wallets first.");
  }

  const SENDER_WALLET_FILE = path.join(__dirname, "sender-wallet.json");

  if (!fs.existsSync(SENDER_WALLET_FILE)) {
    throw new Error("sender-wallet.json not found.");
  }

  const senderWallet = JSON.parse(
    fs.readFileSync(SENDER_WALLET_FILE, "utf8")
  );

  const senderSecret = senderWallet.secretKey;

  if (
    !Array.isArray(senderSecret) ||
    senderSecret.length !== 64 ||
    !senderSecret.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
  ) {
    throw new Error("Sender secret key must be a 64-number JSON array.");
  }

  const sender = Keypair.fromSecretKey(Uint8Array.from(senderSecret));
  const wallets = JSON.parse(fs.readFileSync(WALLET_FILE, "utf8"));
  if (!wallets[projectId]?.publicKey) {
    throw new Error(`Wallet not found for project: ${projectId}`);
  }

  const recipient = new PublicKey(wallets[projectId].publicKey);

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const lamports = Math.round(amount * LAMPORTS_PER_SOL);

  const balance = await connection.getBalance(sender.publicKey);

  if (balance < lamports + 10000) {
    throw new Error(
      `Insufficient Devnet SOL. Sender balance: ${balance / LAMPORTS_PER_SOL} SOL. Fund it using the official Devnet faucet first.`
    );
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: recipient,
      lamports,
    })
  );

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [sender],
    { commitment: "confirmed" }
  );

  console.log(JSON.stringify({
    network: "devnet",
    projectId,
    from: sender.publicKey.toBase58(),
    to: recipient.toBase58(),
    amountSol: amount,
    signature,
    explorer_url: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  }, null, 2));
}

main().catch((error) => {
  console.error("Transfer failed:", error.message);
  process.exitCode = 1;
});
