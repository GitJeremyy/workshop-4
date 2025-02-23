import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";
import { generateRsaKeyPair, exportPubKey, exportPrvKey } from "../crypto";

export type Node = { nodeId: number; pubKey: string, prvKey: string };

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: { nodeId: number; pubKey: string }[];
};

const nodes: Node[] = [];

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  // TODO implement the status route
  _registry.get("/status", (req, res) => {
    res.send("live");
  });
  
  //3.1
  _registry.post("/registerNode", async (req: Request, res: Response) => {
    const { nodeId, pubKey } = req.body as RegisterNodeBody;
    // Generate a pair of private and public keys
    const { publicKey, privateKey } = await generateRsaKeyPair();
    const prvKeyBase64 = await exportPrvKey(privateKey);
    const pubKeyBase64 = await exportPubKey(publicKey);
    if (prvKeyBase64 && pubKeyBase64) {
      nodes.push({ nodeId, pubKey: pubKeyBase64, prvKey: prvKeyBase64 });
      res.sendStatus(200);
    } else {
      res.status(500).send("Failed to export keys");
    }
    res.sendStatus(200);
  });

  //3.2
  _registry.get("/getPrivateKey", (req: Request, res: Response) => {
    const { nodeId } = req.query;
    const node = nodes.find((n) => n.nodeId === Number(nodeId));
    if (node) {
      res.json({ result: node.prvKey });
    } else {
      res.status(404).send("Node not found");
    }
  });

  // 3.4
  _registry.get("/getNodeRegistry", (req: Request, res: Response<GetNodeRegistryBody>) => {
    const nodeRegistry = nodes.map(({ nodeId, pubKey }) => ({ nodeId, pubKey }));
    res.json({ nodes: nodeRegistry });
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
