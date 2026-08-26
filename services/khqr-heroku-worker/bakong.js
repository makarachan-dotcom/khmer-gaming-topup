"use strict";

const axios = require("axios");

const client = axios.create({
  timeout: 10_000,
  headers: { "content-type": "application/json", accept: "application/json" },
  validateStatus: () => true,
});

async function renewAccessToken({ baseUrl, email }) {
  try {
    const response = await client.post(`${baseUrl}/v1/renew_token`, { email });
    const token = response.data?.responseCode === 0 && typeof response.data?.data?.token === "string" ? response.data.data.token.trim() : "";
    return token || null;
  } catch {
    return null;
  }
}

async function checkTransactionByMd5({ baseUrl, token, md5 }) {
  try {
    const response = await client.post(`${baseUrl}/v1/check_transaction_by_md5`, { md5 }, { headers: { authorization: `Bearer ${token}` } });
    return { httpStatus: response.status, payload: normalizePayload(response.data) };
  } catch {
    return { httpStatus: 0, payload: null };
  }
}

function normalizePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value.data && typeof value.data === "object" && !Array.isArray(value.data) ? value.data : null;
  return {
    responseCode: typeof value.responseCode === "number" ? value.responseCode : undefined,
    errorCode: typeof value.errorCode === "number" ? value.errorCode : undefined,
    data: data ? {
      hash: typeof data.hash === "string" ? data.hash : undefined,
      amount: typeof data.amount === "string" || typeof data.amount === "number" ? data.amount : undefined,
      currency: typeof data.currency === "string" ? data.currency : undefined,
      toAccountId: typeof data.toAccountId === "string" ? data.toAccountId : undefined,
    } : null,
  };
}

module.exports = { checkTransactionByMd5, renewAccessToken };
