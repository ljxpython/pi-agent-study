# OpenAI-Compatible Images API Reference

## Basics

- Base URL: Priority lookup (`IMAGE_25_URL` via project `.env` > process env > `~/.my_best/.env`)
- Auth header: `Authorization: Bearer <API_KEY>`
- User-Agent header: `User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36` (Required to bypass WAF / anti-bot blocks)
- Content type: `application/json` for JSON requests, `multipart/form-data` for local file edits

## Endpoints

- `POST /v1/images/generations` for text-to-image
- `POST /v1/images/edits` for image-to-image or mask edits
- Models: `gpt-image-2.5-flare`, `gpt-image-2`

## Generation Request Fields

- `prompt` required
- `n` optional, 1-10 (default: 1)
- `size` optional (e.g. `1024x1024`, `2048x1152`, etc.)
- `quality` optional: `auto`, `low`, `medium`, `high`
- `output_format` optional: `png`, `jpeg`, `webp`
- `response_format` optional: `b64_json` or `url`
- `output_compression` optional for `jpeg` and `webp`
- `background` optional: `auto` or `opaque`
- `moderation` optional: `auto` or `low`
- `stream` optional
- `partial_images` optional for stream mode
- `user` optional stable end-user identifier

## Size Presets

- 1K horizontal: `1024x576`
- 1K vertical: `576x1024`
- 1K square: `1024x1024`
- 2K horizontal: `2048x1152`
- 2K vertical: `1152x2048`
- 2K square: `2048x2048`
- 4K horizontal: `3840x2160`
- 4K vertical: `2160x3840`

Custom sizes:
- longest side <= 3840
- both sides must be multiples of 16
- aspect ratio <= 3:1
- total pixels between 655,360 and 8,294,400

## Curl Example (Direct)

```bash
curl -s "https://wawapii.com/v1/images/generations" \
  -H "Authorization: Bearer sk-..." \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2.5-flare",
    "prompt": "一张干净的 SaaS 产品官网首屏插图，现代扁平插画风格，浅色背景",
    "n": 1,
    "size": "1024x1024",
    "quality": "medium",
    "output_format": "png",
    "response_format": "b64_json"
  }'
```
