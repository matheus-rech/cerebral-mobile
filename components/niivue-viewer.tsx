import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";

interface NiiVueViewerProps {
  imageUri: string;
  segmentationUri?: string;
  width?: number;
  height?: number;
}

/**
 * NiiVue 3D Brain Viewer Component
 * Renders interactive 3D visualization of MRI scans and segmentations
 */
export function NiiVueViewer({
  imageUri,
  segmentationUri,
  width = 400,
  height = 400,
}: NiiVueViewerProps) {
  const [htmlContent, setHtmlContent] = useState<string>("");

  useEffect(() => {
    // Generate HTML content with NiiVue embedded
    const html = generateNiiVueHTML(imageUri, segmentationUri, width, height);
    setHtmlContent(html);
  }, [imageUri, segmentationUri, width, height]);

  if (Platform.OS === "web") {
    // For web, we can use an iframe or direct DOM manipulation
    return (
      <View style={[styles.container, { width, height }]}>
        <div
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    );
  }

  // For mobile, use WebView
  return (
    <View style={[styles.container, { width, height }]}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        scrollEnabled={false}
      />
    </View>
  );
}

function generateNiiVueHTML(
  imageUri: string,
  segmentationUri: string | undefined,
  width: number,
  height: number
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>NiiVue Brain Viewer</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    #canvas-container {
      width: 100%;
      height: 100%;
      position: relative;
    }
    
    canvas {
      width: 100% !important;
      height: 100% !important;
      display: block;
    }
    
    .controls {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      padding: 12px 20px;
      border-radius: 24px;
      display: flex;
      gap: 12px;
      z-index: 10;
    }
    
    .control-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      padding: 8px 16px;
      border-radius: 16px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .control-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .control-btn:active {
      transform: scale(0.95);
    }
    
    .info {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      padding: 12px 16px;
      border-radius: 12px;
      color: white;
      font-size: 12px;
      z-index: 10;
    }
    
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 16px;
      z-index: 5;
    }
  </style>
</head>
<body>
  <div id="canvas-container">
    <canvas id="gl"></canvas>
    <div class="loading" id="loading">Loading MRI data...</div>
    <div class="info" id="info">
      <div>Slice: <span id="slice">0</span></div>
      <div>Contrast: <span id="contrast">T1</span></div>
    </div>
    <div class="controls">
      <button class="control-btn" onclick="nv.setSliceType(nv.sliceTypeAxial)">Axial</button>
      <button class="control-btn" onclick="nv.setSliceType(nv.sliceTypeCoronal)">Coronal</button>
      <button class="control-btn" onclick="nv.setSliceType(nv.sliceTypeSagittal)">Sagittal</button>
      <button class="control-btn" onclick="nv.setSliceType(nv.sliceTypeRender)">3D</button>
      <button class="control-btn" onclick="toggleSegmentation()">Toggle Seg</button>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@niivue/niivue@latest/dist/niivue.umd.js"></script>
  <script>
    let nv;
    let segmentationVisible = true;
    
    async function init() {
      try {
        // Initialize NiiVue
        nv = new niivue.Niivue({
          backColor: [0, 0, 0, 1],
          show3Dcrosshair: true,
          onLocationChange: handleLocationChange
        });
        
        await nv.attachToCanvas(document.getElementById('gl'));
        
        // Load volumes
        const volumes = [];
        
        // Main MRI volume
        volumes.push({
          url: '${imageUri}',
          colormap: 'gray',
          opacity: 1.0
        });
        
        // Segmentation overlay (if provided)
        ${
          segmentationUri
            ? `
        volumes.push({
          url: '${segmentationUri}',
          colormap: 'red',
          opacity: 0.5
        });
        `
            : ""
        }
        
        await nv.loadVolumes(volumes);
        
        // Set initial view
        nv.setSliceType(nv.sliceTypeMultiplanar);
        
        document.getElementById('loading').style.display = 'none';
        
        console.log('NiiVue initialized successfully');
      } catch (error) {
        console.error('Error initializing NiiVue:', error);
        document.getElementById('loading').textContent = 'Error loading MRI data';
      }
    }
    
    function handleLocationChange(data) {
      if (data && data.mm) {
        document.getElementById('slice').textContent = 
          Math.round(data.mm[2]) + ' mm';
      }
    }
    
    function toggleSegmentation() {
      if (nv.volumes.length > 1) {
        segmentationVisible = !segmentationVisible;
        nv.setOpacity(1, segmentationVisible ? 0.5 : 0);
        nv.updateGLVolume();
      }
    }
    
    // Initialize on load
    window.addEventListener('load', init);
    
    // Handle resize
    window.addEventListener('resize', () => {
      if (nv) {
        nv.resizeListener();
      }
    });
  </script>
</body>
</html>
  `;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
