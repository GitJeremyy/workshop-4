import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT, REGISTRY_PORT, BASE_ONION_ROUTER_PORT } from "../config";
import { createRandomSymmetricKey, importSymKey, exportSymKey, rsaEncrypt, symEncrypt } from "../crypto";
import { GetNodeRegistryBody } from "../registry/registry";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export type ReceiveMessageBody = {
  message: string;
};
export type nodeCircuit = { nodeId: number; pubKey: string };

let lastCircuit: nodeCircuit[] | null = null;

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  let lastReceivedMessage: string | null = null;
  let lastSentMessage: string | null = null;

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
    res.status(200).send("success");
  });

  
  _user.get("/getLastCircuit", (req, res) => {
    if (lastCircuit) {
      const nodeIds = lastCircuit.map(node => node.nodeId);
      res.json({ result: nodeIds });
    } else {
      res.status(404).send("No circuit found");
    }
  });

  // 6.1 
  _user.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body as SendMessageBody;
  
    // Fetch the node registry
    const response = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`);
    const { nodes } = await response.json() as GetNodeRegistryBody;
  
    // Create a random circuit of 3 distinct nodes
    const circuit: any[] = [];
    while (circuit.length < 3) {
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
      if (!circuit.includes(randomNode)) {
        circuit.push(randomNode);
      }
    }
    lastCircuit = circuit.map((n) => n.nodeId);
  
    // Create each layer of encryption
    let encryptedMessage = message;
    let destination = String(BASE_USER_PORT + destinationUserId).padStart(10, '0');
  
    for (const node of circuit) {
      const symKeyCrypto = await createRandomSymmetricKey();
      const symKeyString = await exportSymKey(symKeyCrypto);
      const symKey = await importSymKey(symKeyString);
  
      const tempMessage = await symEncrypt(symKey, destination + encryptedMessage);
  
      destination = String(BASE_ONION_ROUTER_PORT + node.nodeId).padStart(10, '0');
  
      const encryptedSymKey = await rsaEncrypt(symKeyString, node.pubKey);
  
      encryptedMessage = encryptedSymKey + tempMessage;
    }
    circuit.reverse();
    lastCircuit = circuit;
    lastSentMessage = message; // Set the last sent message
  
    // Forward the encrypted message to the entry node
    const entryNode = circuit[0];
    await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + entryNode.nodeId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: encryptedMessage }),
    });
    res.sendStatus(200);
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
    );
  });

  return server;
}