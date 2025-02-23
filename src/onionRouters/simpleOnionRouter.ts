import bodyParser from "body-parser";
import express from "express";
import http from "http";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT, BASE_USER_PORT } from "../config";
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

  // Register the node on the registry
  await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nodeId,
      pubKey: pubKeyBase64,
    }),
  });

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

  // 6.2 Implement the /message route
  onionRouter.post("/message", async (req, res) => {
    const { message } = req.body as { message: string };
    lastReceivedEncryptedMessage = message;

    // Decrypt the outer layer
    if (prvKeyBase64 === null) {
      res.status(500).send("Private key is null");
      return;
    }
    const privateKey = await importPrvKey(prvKeyBase64);
    const encryptedSymKey = message.slice(0, 344); // RSA encrypted key length in base64
    const encryptedLayer = message.slice(344);

    const symKeyBase64 = await rsaDecrypt(encryptedSymKey, privateKey);
    const decryptedLayer = await symDecrypt(symKeyBase64, encryptedLayer);

    // Extract the destination and the inner message
    const destination = decryptedLayer.slice(0, 10);
    const innerMessage = decryptedLayer.slice(10);

    lastReceivedDecryptedMessage = innerMessage;
    lastMessageDestination = parseInt(destination, 10);

    // Forward the message to the next node or user
    const nextPort = parseInt(destination, 10);
    const postData = JSON.stringify({ message: innerMessage });

    const options = {
      hostname: 'localhost',
      port: nextPort,
      path: '/message',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const request = http.request(options, (response) => {
      response.on('data', (d) => {
        process.stdout.write(d);
      });
    });

    request.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
    });

    // Write data to request body
    request.write(postData);
    request.end();

    res.sendStatus(200);
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${
        BASE_ONION_ROUTER_PORT + nodeId
      }`
    );
  });

  return server;
}