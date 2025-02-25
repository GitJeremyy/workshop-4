import bodyParser from "body-parser";
import express from "express";
import fetch from "node-fetch";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import { generateRsaKeyPair, exportPubKey, exportPrvKey, rsaDecrypt, symDecrypt } from "../crypto";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  // Status route
  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  // Generate a pair of private and public keys
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const pubKeyBase64 = await exportPubKey(publicKey);
  const prvKeyBase64 = await exportPrvKey(privateKey);

  await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId, pubKey: pubKeyBase64 }),
  });

  // Routes
  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });

  onionRouter.get("/getPrivateKey", (req, res) => {
    res.json({ result: prvKeyBase64 });
  });

  onionRouter.post("/message", async (req, res) => {
    const message = req.body.message;

    const encryptedSymKey = message.slice(0, 344); // RSA encrypted key length in base64
    const encryptedLayer = message.slice(344);

    const symKeyBase64 = await rsaDecrypt(encryptedSymKey, privateKey);
    const decryptedLayer = await symDecrypt(symKeyBase64, encryptedLayer);

    // Extract the destination and the inner message
    const destination = decryptedLayer.slice(0, 10);
    const innerMessage = decryptedLayer.slice(10);

    lastMessageDestination = parseInt(destination, 10);
    lastReceivedDecryptedMessage = innerMessage;

    // Forward the message
    if (lastMessageDestination) {
      await fetch(`http://localhost:${lastMessageDestination}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: lastReceivedDecryptedMessage }),
      });
    } else {
      res.send("failed");
    }
    res.send("success");
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`
    );
  });

  return server;
}