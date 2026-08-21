import { readFileSync } from "node:fs";

const raw = readFileSync("/home/ubuntu/upload/api.fzr.cards_public_docs_openapi.json_1787307022455.md", "utf8");
const normalized = raw.replaceAll("\\[", "[").replaceAll("\\]", "]").replaceAll("\\*", "*");
const specification = JSON.parse(normalized);
for (const path of ["/api/v2/topups/offers", "/api/v2/topups/order", "/api/v2/topups/validate-id"]) {
  const operation = Object.entries(specification.paths[path] ?? {}).find(([method]) => ["get", "post"].includes(method))?.[1];
  const request = operation?.requestBody?.content?.["application/json"]?.schema?.properties ?? {};
  const response = operation?.responses?.["200"]?.content?.["application/json"]?.schema?.properties ?? {};
  console.log(JSON.stringify({ path, parameterNames: (operation?.parameters ?? []).map((item) => item.name), requestPropertyNames: Object.keys(request), responsePropertyNames: Object.keys(response) }));
}
