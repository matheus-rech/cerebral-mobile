# Unified ML Gateway Design

**Date:** 2025-12-31
**Status:** Approved
**Author:** Claude Code + User

## Problem Statement

The current ML infrastructure consists of 5 separate Python services running on ports 5002-5006. This causes:

- **Timeouts** - Requests hang, especially on larger scans
- **Crashes** - Services die and need manual restart
- **Connection failures** - Services not started or port conflicts
- **Poor developer experience** - Multiple terminals, no visibility into what's running

Services are often started by AI agents (Claude Code, Manus AI) and become orphaned, leading to unpredictable state.

## Solution

A **Unified ML Gateway** - one Python service on port 5000 that:

- Routes requests to the appropriate model internally
- Manages model lifecycle (load/unload)
- Handles retries and timeouts transparently
- Exposes health monitoring
- Provides MCP tools for agent workflows

## Architecture

### File Structure

```
ml-backend/
  gateway/
    __init__.py
    app.py              # FastAPI app, routes, middleware
    config.py           # Model configs, timeouts, ports
    model_manager.py    # Loads/unloads models, tracks state
    mcp_server.py       # MCP tool definitions
    models/
      base.py           # Abstract base class for all models
      unet.py           # UNet lesion detector
      synthseg.py       # SynthSeg brain parcellation
      medsam2.py        # MedSAM2 interactive segmentation
      sam3.py           # SAM3 text/point/box segmentation
    utils/
      retry.py          # Retry decorator with backoff
      timeout.py        # Timeout wrapper for inference
      health.py         # Health check logic
  requirements.txt      # Consolidated dependencies
  start_gateway.py      # Single entry point
  tests/
    test_gateway.py
    test_model_manager.py
    test_retry.py
    test_mcp.py
    fixtures/
      small_brain.nii.gz
```

### Components

| Component | Responsibility |
|-----------|----------------|
| `app.py` | HTTP routing, request validation, error responses |
| `model_manager.py` | Singleton tracking loaded models, handles load/unload |
| `models/*.py` | Thin wrappers around existing inference code |
| `mcp_server.py` | Exposes gateway as MCP tools for agents |
| `retry.py` | Decorator: `@with_retry(max_attempts=2, backoff=1.0)` |
| `timeout.py` | Wraps inference in thread with timeout |

## API Design

### REST Endpoints

```
POST /api/ml/unet/detect          # Lesion detection
POST /api/ml/synthseg/segment     # 32-structure brain parcellation
POST /api/ml/medsam2/segment      # Interactive segmentation (with prompts)
POST /api/ml/sam3/segment         # Text/point/box segmentation
GET  /health                      # Overall gateway + per-model status
GET  /models                      # List available models and their state
POST /models/{name}/load          # Force load a model (warm-up)
POST /models/{name}/unload        # Free memory
```

### Request Flow

```
1. Request arrives → /api/ml/sam3/segment
2. Gateway checks if SAM3 is loaded
   → If not: load model (lazy), update state
3. Validate input (file format, size limits)
4. Call inference with timeout wrapper (120s for SAM3)
   → If timeout/crash: retry once
   → If second failure: return error with details
5. Return JSON response with base64 overlay
```

### Health Response

```json
{
  "status": "healthy",
  "uptime_seconds": 3600,
  "models": {
    "unet": { "loaded": true, "last_used": "2025-12-31T01:30:00Z", "requests": 42 },
    "synthseg": { "loaded": true, "last_used": "2025-12-31T01:28:00Z", "requests": 15 },
    "medsam2": { "loaded": false },
    "sam3": { "loaded": false }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "TIMEOUT",
    "message": "SAM3 inference exceeded 120s timeout",
    "model": "sam3",
    "retriable": false,
    "suggestion": "Try a smaller image or use UNet for faster results"
  }
}
```

## Model Loading Strategy

**Hybrid approach:**

- **Eager:** UNet (7.7M) + SynthSeg (18M) - loaded at startup
- **Lazy:** MedSAM2 (89M) + SAM3 (636M) - loaded on first request

**Memory management:**
- Auto-unload models unused for 30+ minutes
- Before loading large model, check available memory
- If memory low, unload least-recently-used model first

## Reliability

### Timeout Configuration

| Model | Timeout | Retry | Reason |
|-------|---------|-------|--------|
| UNet | 30s | Yes | Small model, fast inference |
| SynthSeg | 60s | Yes | Medium model, 32 structures |
| MedSAM2 | 90s | Yes | Larger model, interactive |
| SAM3 | 120s | Yes | Largest model (636M params) |

### Retry Strategy

```python
@with_retry(max_attempts=2, backoff_seconds=1.0)
def run_inference(model, input_data):
    with timeout(model.timeout_seconds):
        return model.predict(input_data)
```

- First failure → wait 1 second → retry once
- Second failure → return structured error

## MCP Integration

Tools exposed to AI agents:

| Tool | Description |
|------|-------------|
| `ml_detect_lesions` | Run UNet lesion detection |
| `ml_segment_brain` | Run SynthSeg 32-structure parcellation |
| `ml_segment_interactive` | Run MedSAM2 with point/box prompts |
| `ml_segment_text` | Run SAM3 with text prompt |
| `ml_health_check` | Get gateway and model status |
| `ml_load_model` | Pre-load a model for faster first inference |

MCP server runs alongside the gateway in the same process.

## Testing

| Layer | Approach |
|-------|----------|
| Unit tests | Test each model wrapper with mock inputs |
| Integration tests | Test full request flow with small test images |
| Health checks | Verify `/health` returns correct states |
| Timeout tests | Verify timeouts trigger correctly |
| Retry tests | Simulate failures, verify retry behavior |

## Migration Plan

1. **Build gateway** alongside existing services (no disruption)
2. **Test gateway** on port 5000 while old services run
3. **Update Node.js proxy** to point to gateway
4. **Verify frontend** works with new gateway
5. **Deprecate old services** - remove individual service files
6. **Update CLAUDE.md** - document new single startup command

## What Gets Replaced

- `synthseg_service.py` (port 5002)
- `unet_lesion_detector.py` (port 5003)
- `lesion_tracker_3d.py` (port 5004)
- `medsam2_service.py` (port 5005)
- `sam3_service.py` (port 5006)

## New Developer Workflow

```bash
cd ml-backend
python start_gateway.py   # One command. That's it.
```

## Success Criteria

- Single process to start/monitor
- No more orphaned services
- Automatic retry handles transient failures
- Health endpoint shows real-time model status
- MCP tools work for agent-based workflows
- All existing frontend functionality preserved
