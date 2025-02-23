import bodyParser from "body-parser";
import express from "express";
import http from "http";
import { BASE_USER_PORT, REGISTRY_PORT, BASE_ONION_ROUTER_PORT } from "../config";
import { createRandomSymmetricKey, exportSymKey, rsaEncrypt, symEncrypt } from "../crypto";

let lastReceivedMessage: string | null = null;
let lastSentMessage: string | null = null;

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export type ReceiveMessageBody = {
  message: string;
};

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  // TODO implement the status route
  _user.get("/status", (req, res) => {
    res.send("live");
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  _user.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });

  _user.post("/message", (req, res) => {
    const { message } = req.body as ReceiveMessageBody;
    lastReceivedMessage = message;
    res.sendStatus(200);
  });

  // 6.1 
  _user.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body as SendMessageBody;

    // Fetch the node registry
    const registryData = await new Promise<any>((resolve, reject) => {
      http.get(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`, (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
          data += chunk;
        });
        resp.on('end', () => {
          resolve(JSON.parse(data));
        });
      }).on("error", (err) => {
        reject(err);
      });
    });
    const nodes = registryData.nodes;

    // Create a random circuit of 3 distinct nodes
    const circuit: any[] = [];
    while (circuit.length < 3) {
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
      if (!circuit.includes(randomNode)) {
        circuit.push(randomNode);
      }
    }

    // Create each layer of encryption
    let encryptedMessage = message;
    for (let i = circuit.length - 1; i >= 0; i--) {
      const node = circuit[i];
      const symmetricKey = await createRandomSymmetricKey();
      const symKeyBase64 = await exportSymKey(symmetricKey);

      // Encrypt the destination
      const destination = i === circuit.length - 1
        ? `000000${destinationUserId}`.slice(-10)
        : `000000${circuit[i + 1].nodeId}`.slice(-10);

      // Encrypt the message with the symmetric key
      const encryptedLayer = await symEncrypt(symmetricKey, destination + encryptedMessage);

      // Encrypt the symmetric key with the node's public key
      const encryptedSymKey = await rsaEncrypt(symKeyBase64, node.pubKey);

      // Concatenate the encrypted symmetric key and the encrypted layer
      encryptedMessage = encryptedSymKey + encryptedLayer;
    }

    // Forward the encrypted message to the entry node
    const entryNode = circuit[0];
    const postData = JSON.stringify({ message: encryptedMessage });

    const options = {
      hostname: 'localhost',
      port: BASE_ONION_ROUTER_PORT + entryNode.nodeId,
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

    lastSentMessage = message;
    res.sendStatus(200);
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
    );
  });

  return server;
}