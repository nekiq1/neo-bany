/// <reference path="../pb_data/types.d.ts" />
/**
 * AI proxy — key only on server (env AI_API_KEY).
 * POST /api/pspbrf/ai  { messages: [...] }
 * Compatible with PocketBase 0.22+ / 0.40+
 */
routerAdd("POST", "/api/pspbrf/ai", (e) => {
  const apiKey = $os.getenv("AI_API_KEY") || ""
  if (!apiKey) {
    return e.json(503, {
      error: "AI_API_KEY не задан на сервере",
      fallback: true,
    })
  }

  const body = e.requestInfo().body || {}
  const messages = body.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return e.json(400, { error: "messages required" })
  }

  const base = ($os.getenv("AI_API_BASE") || "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  )
  const model = $os.getenv("AI_MODEL") || "gpt-4o-mini"

  try {
    const res = $http.send({
      url: base + "/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.4,
        max_tokens: 400,
      }),
      timeout: 30,
    })

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const text =
        typeof res.body === "string"
          ? res.body
          : JSON.stringify(res.json || res.body)
      return e.json(res.statusCode, {
        error: "upstream " + res.statusCode,
        detail: String(text).slice(0, 500),
        fallback: true,
      })
    }

    const data =
      typeof res.body === "string" ? JSON.parse(res.body) : res.json || res.body
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : ""
    return e.json(200, {
      content: typeof content === "string" ? content.trim() : "",
      model: model,
    })
  } catch (err) {
    return e.json(502, {
      error: String(err),
      fallback: true,
    })
  }
})
