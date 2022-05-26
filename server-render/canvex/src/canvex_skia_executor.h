#pragma once
#include "../include/canvex_c_api.h"
#include "canvas_display_list.h"
#include "canvex_skia_resource_context.h"
#include <filesystem>

namespace canvex {

enum RenderFormat {
  Rgba,
  Bgra,
};

struct GraphicsExecutionStats {
  int64_t graphicsRender_us;
  int64_t fileWrite_us;
};

bool RenderDisplayListToPNG(
  const VCSCanvasDisplayList& dl,
  const std::filesystem::path& dstFile,
  const std::filesystem::path& resourceDir,
  CanvexSkiaResourceContext* skiaResCtx, // optional cache between calls
  GraphicsExecutionStats* stats  // optional stats
);

bool RenderDisplayListToRawBuffer(
  const VCSCanvasDisplayList& dl,
  RenderFormat format,
  uint8_t *imageBuffer,
  uint32_t w,
  uint32_t h,
  uint32_t rowBytes,
  CanvexAlphaMode alphaMode,
  const std::filesystem::path& resourceDir,
  CanvexSkiaResourceContext* skiaResCtx // optional cache between calls
);

} // namespace canvex
