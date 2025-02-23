import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = { nodeId: number; pubKey: string };

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = { nodes: Node[] };

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  // TODO implement the status route
  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  let nodes: Node[] = []; 
  
  //3.1
  _registry.post("/registerNode", async (req: Request, res: Response) => {
    const { nodeId, pubKey } = req.body as RegisterNodeBody;
    const node = nodes.find((n) => n.nodeId === nodeId);
    if(node){
      node.pubKey = pubKey;
    }
    else{
      nodes.push({ nodeId, pubKey });
    }
    res.sendStatus(200);
  });

  // 3.4
  _registry.get("/getNodeRegistry", (req: Request, res: Response<GetNodeRegistryBody>) => {
    const response: GetNodeRegistryBody = { nodes };
    res.json(response);
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
