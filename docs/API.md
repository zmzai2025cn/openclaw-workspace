# API 接口文档

## 基础信息

- **Base URL**: `https://api.kimiclaw.com/v1`
- **认证方式**: Header `Authorization: Bearer {api_key}`
- **Content-Type**: `application/json`

---

## 接口列表

### 1. 健康检查

```
GET /health
```

**响应**:
```json
{
  "status": "ok",
  "version": "1.4.0",
  "timestamp": "2024-02-20T01:20:00Z"
}
```

---

### 2. 采集数据上传

```
POST /capture/upload
```

**请求体**:
```json
{
  "timestamp": "2024-02-20T01:20:00Z",
  "userId": "user_001",
  "deviceId": "dev_abc123",
  "triggerType": "window_switch",
  "appName": "Visual Studio Code",
  "windowTitle": "Program.cs",
  "imageEncrypted": "base64_encoded_aes_encrypted_image",
  "textFeatures": "perceptual_hash_string",
  "metadata": {
    "screenResolution": "1920x1080",
    "cpuUsage": 15.5,
    "memoryUsage": 256
  }
}
```

**响应**:
```json
{
  "success": true,
  "messageId": "msg_abc123",
  "sessionId": "sess_xyz789"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "Invalid API key",
  "code": 401
}
```

---

### 3. 数据查询

```
GET /query?user_id={user_id}&start_time={iso_time}&end_time={iso_time}
```

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | string | 是 | 用户ID |
| start_time | string | 否 | 开始时间(ISO8601) |
| end_time | string | 否 | 结束时间(ISO8601) |
| limit | number | 否 | 返回条数，默认100 |

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "msg_001",
      "timestamp": "2024-02-20T01:20:00Z",
      "appName": "VSCode",
      "windowTitle": "test.js",
      "sessionId": "sess_001"
    }
  ],
  "total": 150
}
```

---

### 4. 会话分析

```
GET /analytics/sessions?user_id={user_id}&date={YYYY-MM-DD}
```

**响应**:
```json
{
  "success": true,
  "sessions": [
    {
      "sessionId": "sess_001",
      "appName": "VSCode",
      "startTime": "2024-02-20T09:00:00Z",
      "endTime": "2024-02-20T11:30:00Z",
      "duration": 9000,
      "captureCount": 45
    }
  ],
  "summary": {
    "totalSessions": 12,
    "totalDuration": 28800,
    "topApps": ["VSCode", "Chrome", "Outlook"]
  }
}
```

---

### 5. 飞书消息接收

```
POST /webhook/feishu
```

**请求体**: 飞书开放平台标准格式

**响应**:
```json
{
  "success": true,
  "messageId": "msg_feishu_001"
}
```

---

## 错误码

| 码 | 说明 |
|----|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 限流策略

- 上传接口：100次/分钟/用户
- 查询接口：1000次/分钟/用户
- 超出限流返回 429 状态码