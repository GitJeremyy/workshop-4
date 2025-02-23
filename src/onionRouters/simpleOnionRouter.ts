import bodyParser from "body-parser";
import express from "express";
import http from "http";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT} from "../config";
import { generateRsaKeyPair, exportPubKey, exportPrvKey, rsaDecrypt, symDecrypt, importPrvKey, importSymKey } from "../crypto";

let lastReceivedEncryptedMessage: string | null = null;
let lastReceivedDecryptedMessage: string | null = null;
let lastMessageDestination: number | null = null;

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  // 3.3 
  // Generate a pair of private and public keys
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const pubKeyBase64 = await exportPubKey(publicKey);
  const prvKeyBase64 = await exportPrvKey(privateKey);

  // TODO implement the status route
  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  //2.1
  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });
  
  //3.2
  onionRouter.get("/getPrivateKey", (req, res) => {
    res.json({ result: prvKeyBase64 });
  });

  // 6.2 Implement the /message route
  onionRouter.post("/message", async (req, res) => {
    try{
      const { message } = req.body as { message: string };
      lastReceivedEncryptedMessage = message;

      const encryptedSymKey = message.slice(0, 344); // RSA encrypted key length in base64
      const encryptedLayer = message.slice(344);

      const symKeyBase64 = await rsaDecrypt(encryptedSymKey, privateKey);
      const decryptedLayer = await symDecrypt(symKeyBase64, encryptedLayer);

      // Extract the destination and the inner message
      const destination = decryptedLayer.slice(0, 10);
      const innerMessage = decryptedLayer.slice(10);

      lastReceivedDecryptedMessage = innerMessage;
      lastMessageDestination = parseInt(destination, 10);

      // Forward the message
      await fetch(`http://localhost:${destination}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: innerMessage })
      });

        res.json({ success: true });
      } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: 'Failed to process message' });
      }
  });
    
  // Register node with registry
  try {
    await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, pubKey: pubKeyBase64 })
    });
  } catch (error) {
    console.error('Failed to register node:', error);
  }

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${
        BASE_ONION_ROUTER_PORT + nodeId
      }`
    );
  });

  return server;
}